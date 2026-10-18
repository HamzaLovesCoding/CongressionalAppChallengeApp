// A minimal Supabase client over fetch: anonymous sign-in, token refresh and RPC calls. It uses only
// the public URL and publishable (anon) key from VITE_* variables; a service-role key never belongs
// in browser code. Writes go through the sync_learner() RPC, which validates everything server-side.

export type SupabaseConfig = { url: string; key: string };
export type Session = { accessToken: string; refreshToken: string; expiresAt: number; userId: string };
type Fetch = typeof fetch;

export class RemoteError extends Error {
  readonly reason: 'offline' | 'unauthorized' | 'server';
  constructor(reason: RemoteError['reason'], message: string) { super(message); this.reason = reason; }
}

export function configFromEnv(env: Record<string, string | undefined>): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim(), key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

async function request(fetcher: Fetch, input: string, init: RequestInit) {
  let response: Response;
  try { response = await fetcher(input, init); }
  catch { throw new RemoteError('offline', 'Network request failed'); }
  if (response.status === 401 || response.status === 403) throw new RemoteError('unauthorized', `HTTP ${response.status}`);
  if (!response.ok) throw new RemoteError('server', `HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

function toSession(body: { access_token: string; refresh_token: string; expires_in: number; user: { id: string } }, now: number): Session {
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + body.expires_in * 1000, userId: body.user.id };
}

export function createClient(config: SupabaseConfig, fetcher: Fetch = fetch.bind(globalThis), clock = () => Date.now()) {
  const json = { apikey: config.key, 'Content-Type': 'application/json' };
  return {
    // Requires "Allow anonymous sign-ins" in the Supabase project's auth settings.
    async signInAnonymously() {
      return toSession(await request(fetcher, `${config.url}/auth/v1/signup`, { method: 'POST', headers: json, body: '{}' }), clock());
    },
    // Renewal tokens work once. A rejected one (HTTP 400) can never succeed, so it reads as unauthorized.
    async refresh(session: Session) {
      try {
        return toSession(await request(fetcher, `${config.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: json, body: JSON.stringify({ refresh_token: session.refreshToken }) }), clock());
      } catch (error) {
        if (error instanceof RemoteError && error.message === 'HTTP 400') throw new RemoteError('unauthorized', 'Refresh token rejected');
        throw error;
      }
    },
    async rpc<T>(session: Session, fn: string, args: object): Promise<T> {
      return request(fetcher, `${config.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...json, Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify(args) });
    },
    // An Edge Function whose response the caller reads itself (the driver coach streams its answer).
    // A rejected token throws like rpc() so the session can be renewed; other statuses are returned.
    async invoke(session: Session, fn: string, args: object, signal?: AbortSignal): Promise<Response> {
      let response: Response;
      try { response = await fetcher(`${config.url}/functions/v1/${fn}`, { method: 'POST', headers: { ...json, Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify(args), signal }); }
      catch (error) {
        if (signal?.aborted) throw error;
        throw new RemoteError('offline', 'Network request failed');
      }
      if (response.status === 401 || response.status === 403) throw new RemoteError('unauthorized', `HTTP ${response.status}`);
      return response;
    },
  };
}
export type SupabaseClient = ReturnType<typeof createClient>;
