import { createRemoteJWKSet, jwtVerify } from "jose";
import { getAuthDiscovery, getNeonAuthResource } from "./neon-auth";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

export async function authenticateOAuthRequest(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  try {
    const discovery = await getAuthDiscovery();

    const { payload } = await jwtVerify(token, getJwks(discovery.jwks_uri), {
      algorithms: ["EdDSA"],
      issuer: discovery.issuer,
      audience: getNeonAuthResource(),
    });

    if (!payload.sub) {
      return null;
    }

    return { userId: payload.sub };
  } catch {
    return null;
  }
}
