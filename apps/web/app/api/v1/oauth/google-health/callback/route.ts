import { verifyState, encrypt } from '../../../../../../lib/connectors/crypto';
import { exchangeCode, identity, metricsForScopes, SCOPES } from '../../../../../../lib/connectors/googleHealth';
import { enqueue } from '../../../../../../lib/connectors/store';
import { query } from '../../../../../../lib/db';

const back = (status: string) =>
  new Response(null, { status: 302, headers: { location: `${process.env.APP_OAUTH_RETURN_URL ?? 'humanaudit://oauth/google-health'}?status=${status}` } });

/** Google -> browser redirect. No bearer token here; the signed single-use `state` identifies the user. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const nonce = verifyState(q.get('state') ?? '');
    if (!nonce) return back('error');
    // Consume the nonce atomically: a replayed callback finds nothing.
    const [st] = await query<{ user_id: string }>(`DELETE FROM oauth_states WHERE nonce = $1 AND expires_at > now() RETURNING user_id`, [nonce]);
    if (!st) return back('error');
    const code = q.get('code');
    if (!code || q.get('error')) return back('error'); // user pressed Cancel, or Google refused

    const tok = await exchangeCode(code);
    if (!tok.refresh_token) return back('error'); // only issued with access_type=offline & prompt=consent
    const scopes = (tok.scope ?? '').split(' ').filter((s) => SCOPES.includes(s)); // user may deselect scopes
    const granted = metricsForScopes(scopes);
    if (!granted.length) return back('error');

    const who = await identity(tok.access_token);
    if (!who) return back('not_linked');

    const full = scopes.length === SCOPES.length;
    const [conn] = await query<{ id: string }>(
      `INSERT INTO connections (user_id, source, status, granted_metrics, granted_scopes, external_user_id)
       VALUES ($1,'google_health',$2,$3,$4,$5)
       ON CONFLICT (user_id, source) DO UPDATE SET status = EXCLUDED.status, granted_metrics = EXCLUDED.granted_metrics,
         granted_scopes = EXCLUDED.granted_scopes, external_user_id = EXCLUDED.external_user_id, last_sync_error = NULL, connected_at = now()
       RETURNING id`,
      [st.user_id, full ? 'connected' : 'partial', granted, scopes, who.healthUserId]);
    await query(
      `INSERT INTO oauth_tokens (connection_id, refresh_token_enc, access_token_enc, access_token_expires_at, scopes)
       VALUES ($1,$2,$3, now() + make_interval(secs => $4), $5)
       ON CONFLICT (connection_id) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc, access_token_enc = EXCLUDED.access_token_enc,
         access_token_expires_at = EXCLUDED.access_token_expires_at, scopes = EXCLUDED.scopes`,
      [conn!.id, encrypt(tok.refresh_token), encrypt(tok.access_token), tok.expires_in ?? 3600, scopes]);
    await enqueue('gh_hot_load', { connectionId: conn!.id });
    return back(full ? 'connected' : 'partial');
  } catch (e) {
    console.error('[google-health callback]', e);
    return back('error');
  }
}
