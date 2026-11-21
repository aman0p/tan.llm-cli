import { getAuth, updateAuth } from "./auth";

export type AuthDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function getNeonAuthBaseUrl() {
  return requiredEnv("NEON_AUTH_BASE_URL").replace(/\/+$/, "");
}

export function getNeonAuthClientId() {
  return requiredEnv("NEON_AUTH_CLIENT_ID");
}

export function getNeonAuthResource() {
  return requiredEnv("NEON_AUTH_RESOURCE");
}

export function getApiUrl() {
  return process.env.API_URL?.trim() || "http://localhost:3000";
}

let discoveryPromise: Promise<AuthDiscovery> | null = null;

export function getAuthDiscovery(): Promise<AuthDiscovery> {
  if (!discoveryPromise) {
    discoveryPromise = fetch(`${getNeonAuthBaseUrl()}/.well-known/oauth-authorization-server`, {
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Auth discovery failed with status ${response.status}`);
        }

        const metadata = (await response.json()) as Partial<AuthDiscovery>;
        if (
          typeof metadata.issuer !== "string" ||
          typeof metadata.authorization_endpoint !== "string" ||
          typeof metadata.token_endpoint !== "string"
        ) {
          throw new Error("Auth discovery returned invalid metadata");
        }

        if (metadata.issuer !== getNeonAuthBaseUrl()) {
          throw new Error("Auth discovery issuer does not match configured Auth URL");
        }

        return metadata as AuthDiscovery;
      })
      .catch((error: unknown) => {
        discoveryPromise = null;
        throw error;
      });
  }

  return discoveryPromise;
}

let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const auth = getAuth();
    if (!auth?.refreshToken) return null;

    try {
      const discovery = await getAuthDiscovery();
      const response = await fetch(discovery.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: auth.refreshToken,
          client_id: getNeonAuthClientId(),
          resource: getNeonAuthResource(),
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      if (!data.access_token) return null;

      updateAuth({
        token: data.access_token,
        ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
        ...(typeof data.expires_in === "number"
          ? { expiresAt: Date.now() + data.expires_in * 1000 }
          : {}),
      });

      return data.access_token;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function getValidAccessToken(): Promise<string | null> {
  const auth = getAuth();
  if (!auth) return null;

  if (auth.expiresAt && auth.expiresAt - 60_000 > Date.now()) {
    return auth.token;
  }

  return (await refreshAccessToken()) ?? auth.token;
}
