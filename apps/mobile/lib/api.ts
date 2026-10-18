import Constants from 'expo-constants';
import { getClerkInstance } from '@clerk/expo';
import { CLERK_PUBLISHABLE_KEY } from './clerk';

function baseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env && !env.includes('localhost')) return env.replace(/\/+$/, '');
  // Dev: reach the Next.js server on the machine running Metro.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : (env ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** The user's *local* calendar day (YYYY-MM-DD). toISOString() would be the UTC day. */
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Authenticated call to our backend. The server identifies the user from the Clerk token, never from the body. */
export async function api<T = any>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const token = await getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY }).session?.getToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(baseUrl() + path, {
    method: init.method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 12000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json as T;
}
