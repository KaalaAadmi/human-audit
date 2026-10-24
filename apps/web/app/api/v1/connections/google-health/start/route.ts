import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withAuth } from '../../../../../../lib/route';
import { query } from '../../../../../../lib/db';
import { signState } from '../../../../../../lib/connectors/crypto';
import { SCOPES } from '../../../../../../lib/connectors/googleHealth';
import { isUuid } from '../../../../../../lib/connectors/store';

/** Creates a signed, single-use OAuth state and returns Google's consent URL. The app opens it with WebBrowser.openAuthSessionAsync. */
export const POST = withAuth(async (req, userId) => {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID, redirect = process.env.GOOGLE_HEALTH_REDIRECT_URI;
  if (!clientId || !redirect) return NextResponse.json({ error: 'Google Health is not configured on the server' }, { status: 503 });
  const { deviceId } = await req.json().catch(() => ({}));
  const nonce = randomUUID();
  await query(`INSERT INTO oauth_states (nonce, user_id, device_id, expires_at) VALUES ($1,$2,$3, now() + interval '10 minutes')`,
    [nonce, userId, isUuid(deviceId) ? deviceId : null]);
  await query(`DELETE FROM oauth_states WHERE expires_at < now()`); // keep the table small
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent',
    scope: SCOPES.join(' '), state: signState(nonce),
  }).toString();
  return NextResponse.json({ authUrl: url.toString() });
});
