import { Pool, types } from 'pg';

// Return DATE columns as 'YYYY-MM-DD' strings; the default JS Date is shifted by the server's timezone.
types.setTypeParser(1082, (v) => v);

// Supabase is used purely as managed Postgres. Only this server touches it (privileged connection, so RLS
// is bypassed); clients go through the authenticated /api routes. Moving to a VM = change DATABASE_URL.
// NOTE: use Supabase's pooler URL here - the direct db.<ref>.supabase.co host is IPv6-only (fails on Vercel).
const g = globalThis as { __pgPool?: Pool };

function pool() {
  if (!g.__pgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    // ponytail: TLS without CA verification; pin Supabase's CA cert if strict verification is needed
    g.__pgPool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  }
  return g.__pgPool;
}

export async function query<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query(text, params)).rows;
}
