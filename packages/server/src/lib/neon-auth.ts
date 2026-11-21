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

export function getNeonAuthResource() {
  return requiredEnv("NEON_AUTH_RESOURCE");
}

export function getNeonAuthClientId() {
  return requiredEnv("NEON_AUTH_CLIENT_ID");
}

export type AuthDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

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
          typeof metadata.token_endpoint !== "string" ||
          typeof metadata.jwks_uri !== "string"
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
