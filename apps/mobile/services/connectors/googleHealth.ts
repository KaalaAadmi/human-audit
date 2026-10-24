import * as WebBrowser from 'expo-web-browser';
import { startGoogleHealth } from './api';

export const GOOGLE_RETURN_URL = 'humanaudit://oauth/google-health';

export type GoogleResult = 'connected' | 'partial' | 'not_linked' | 'error' | 'cancelled';

/** Opens Google's consent screen; the backend callback redirects back to the app with ?status=. */
export async function connectGoogleHealth(deviceId: string): Promise<GoogleResult> {
  const authUrl = await startGoogleHealth(deviceId);
  const res = await WebBrowser.openAuthSessionAsync(authUrl, GOOGLE_RETURN_URL);
  if (res.type !== 'success') return 'cancelled';
  const status = new URL(res.url).searchParams.get('status');
  return status === 'connected' || status === 'partial' || status === 'not_linked' ? status : 'error';
}
