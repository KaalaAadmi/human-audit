import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32-byte key from TOKEN_ENCRYPTION_KEY (base64). Generate with: openssl rand -base64 32 */
function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return k;
}

/** AES-256-GCM. Layout: iv(12) | tag(16) | ciphertext. */
export function encrypt(plain: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}

export function decrypt(blob: Buffer): string {
  const d = createDecipheriv('aes-256-gcm', key(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString('utf8');
}

const stateKey = () => {
  const k = process.env.OAUTH_STATE_SIGNING_KEY;
  if (!k) throw new Error('OAUTH_STATE_SIGNING_KEY is not set');
  return k;
};
const sign = (body: string) => createHmac('sha256', stateKey()).update(body).digest('base64url');

/** `state` = base64url(JSON{nonce, exp}).hmac. Single use is enforced by the oauth_states table, not here. */
export function signState(nonce: string, ttlMs = 10 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ nonce, exp: Date.now() + ttlMs })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Returns the nonce if the signature is valid and unexpired, else null. */
export function verifyState(state: string): string | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { nonce, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof nonce === 'string' && typeof exp === 'number' && exp > Date.now() ? nonce : null;
  } catch {
    return null;
  }
}
