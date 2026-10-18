import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

// Clerk publishable key = pk_(test|live)_ + base64("<frontend-api-host>$"); session JWTs are issued by https://<host>.
export const clerkIssuer = (publishableKey: string) =>
  'https://' + Buffer.from(publishableKey.split('_')[2] ?? '', 'base64').toString().replace(/\$$/, '');

/** Returns the Clerk user id (`sub`) if the token is valid and unexpired, else null. */
export async function verifyToken(token: string, keys: JWTVerifyGetKey, issuer: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, keys, { issuer, clockTolerance: 5 });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

let remoteKeys: JWTVerifyGetKey | undefined;

/** Clerk user id from the request's `Authorization: Bearer <session token>` header, or null. */
export async function authenticate(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error('CLERK_PUBLISHABLE_KEY is not set');
  const issuer = clerkIssuer(publishableKey);
  remoteKeys ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return verifyToken(token, remoteKeys, issuer);
}
