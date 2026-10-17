import * as progress from '../feed/progress.ts';
import { configFromEnv, createClient, RemoteError, type Session, type SupabaseClient } from './supabase.ts';

// The backend boundary. Local progress (src/feed/progress.ts) is always written first and is the
// source of truth on this device; a configured backend receives a copy through sync_learner().
// Conflict policy (enforced by the server, see the migration): completion is sticky, counters and
// watch coverage only grow, events are idempotent on client IDs, review items upsert by key, and
// nothing is ever pulled back over local data in this version.

export type SyncStatus =
  | { state: 'local-only' }
  | { state: 'syncing'; lastSyncedAt: string | null }
  | { state: 'synced'; lastSyncedAt: string }
  | { state: 'error'; reason: 'offline' | 'unauthorized' | 'server'; lastSyncedAt: string | null };
export type RemoteRow = { rank: number; alias: string | null; car_id: string | null; xp: number; is_you: boolean };
export type BuddyRow = { link_id: string; username: string; car_id: string | null; relation: 'buddy' | 'incoming' | 'outgoing'; duo_streak: number; you_today: boolean; them_today: boolean; weekly_xp: number };
export type UsernameResult = 'ok' | 'taken' | 'invalid' | 'offline';
// A lesson comment as the server returns it; author is null for a learner without a username (shown as Anonymous).
export type CommentRow = { id: string; author: string | null; body: string; created_at: string; score: number; my_vote: -1 | 1 | null; is_mine: boolean };
export type PostResult = 'ok' | 'invalid' | 'limit' | 'offline';
// A vote or delete the server turned down (refused) is not a connection problem (offline).
export type ActionResult = 'ok' | 'refused' | 'offline';
export type GroupRow = { code: string; name: string; members: number; is_owner: boolean };
export type CreateGroupResult = { status: 'ok'; code: string } | { status: 'need-username' | 'limit' | 'offline' };
export type JoinResult = 'joined' | 'already' | 'not-found' | 'need-username' | 'limit' | 'full' | 'invalid' | 'offline';
export type RequestResult = 'sent' | 'accepted' | 'already' | 'not-found' | 'self' | 'need-username' | 'limit' | 'invalid' | 'offline';

const AUTH_KEY = 'lane-auth';
type AuthRecord = { session?: Session; lastSyncedAt?: string };

// The store's validated readers; passed in so the boundary can be tested with any store instance.
export type Store = Pick<typeof progress, 'activeDays' | 'attempts' | 'carState' | 'dailyGoal' | 'exportLearnerState' | 'reviewHistory' | 'settings' | 'simulations' | 'topicIds' | 'topicRecord' | 'videoRecord'>;

// Everything the server needs. XP totals, likes, saves and purchases are never sent. The username is
// claimed separately (setUsername) so the server can keep it unique.
export function buildPayload(store: Store, lessonIds: string[]) {
  const { activeDays, attempts, carState, dailyGoal, reviewHistory, settings, simulations, topicIds, topicRecord, videoRecord } = store;
  const state = store.exportLearnerState();
  const review = new Map<string, ReturnType<typeof reviewHistory>[number]>();
  for (const item of reviewHistory()) review.set(item.itemId, item); // latest entry per item wins
  return {
    profile: { carId: carState().selected },
    activeDays: activeDays(),
    settings: { permitTestDate: settings().permitTestDate, dailyGoal: dailyGoal(), firstSessionCompletedAt: state.firstSessionCompletedAt ?? null },
    lessons: lessonIds.filter(id => state.clips[id] || videoRecord(id).lastWatchedAt).map(id => {
      const clip = state.clips[id], video = videoRecord(id);
      return { id, tries: clip?.tries ?? 0, firstTry: clip?.firstTry ?? false, done: clip?.done ?? false, completedAt: clip?.completedAt ?? null,
        watchedRatio: video.maxWatchedRatio, keySegmentSeen: video.keySegmentSeen, lastPlayedAt: video.lastWatchedAt };
    }),
    attempts: attempts().map(a => ({ id: a.id, lessonId: a.itemId, topicId: a.topicId, kind: a.kind, correct: a.correct, activeMs: a.activeMs, at: a.at })),
    simulations: simulations().map(s => ({ id: s.id, scenarioId: s.scenarioId, topicId: s.topicId, outcome: s.outcome, chosenAction: s.chosenAction ?? null, elapsedSeconds: s.elapsedSeconds ?? null, at: s.at })),
    topics: topicIds().map(id => ({ id, ...topicRecord(id) })),
    review: [...review.values()].map(item => ({ itemId: item.itemId, topicId: item.topicId, reason: item.reason, addedAt: item.addedAt, resolvedAt: item.resolvedAt ?? null })),
  };
}

function readAuth(): AuthRecord {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) ?? '{}') as AuthRecord; } catch { return {}; }
}
function writeAuth(record: AuthRecord) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(record)); } catch { /* Private browsing: the session lasts for this visit. */ }
}

export function createSync(client: SupabaseClient | null, lessonIds: string[], store: Store = progress, clock = () => Date.now()) {
  let auth = client ? readAuth() : {};
  let status: SyncStatus = client ? (auth.lastSyncedAt ? { state: 'synced', lastSyncedAt: auth.lastSyncedAt } : { state: 'syncing', lastSyncedAt: null }) : { state: 'local-only' };
  let running: Promise<SyncStatus> | null = null;
  const listeners = new Set<(status: SyncStatus) => void>();
  const set = (next: SyncStatus) => { status = next; listeners.forEach(listener => listener(next)); return next; };

  // One sign-in or renewal at a time, in this tab (a shared promise) and across tabs (a Web Lock), always
  // starting from the newest saved session. Renewal tokens work once, so two tabs renewing together
  // would otherwise strand one of them, and two sign-ins would split the learner into two accounts.
  let pending: Promise<Session> | null = null;
  const usable = (candidate: Session | undefined): candidate is Session => !!candidate && candidate.expiresAt - clock() >= 60_000;
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const locks = (globalThis as { navigator?: { locks?: { request(name: string, work: () => Promise<T>): Promise<T> } } }).navigator?.locks;
    return locks ? locks.request('lane-auth', work) : work();
  };
  function session(): Promise<Session> {
    if (!client) return Promise.reject(new RemoteError('server', 'No backend'));
    pending ??= (usable(auth.session) ? Promise.resolve(auth.session) : exclusive(obtain)).finally(() => { pending = null; });
    return pending;
  }
  async function obtain(): Promise<Session> {
    const saved = readAuth().session;
    if (saved && (!auth.session || saved.expiresAt >= auth.session.expiresAt)) auth = { ...auth, session: saved };
    if (usable(auth.session)) return auth.session;
    let next: Session;
    if (!auth.session) next = await client!.signInAnonymously();
    else {
      try { next = await client!.refresh(auth.session); }
      catch (error) {
        // A rejected renewal can never succeed; continue with a new anonymous session.
        if (!(error instanceof RemoteError && error.reason === 'unauthorized')) throw error;
        next = await client!.signInAnonymously();
      }
    }
    auth = { ...auth, session: next };
    writeAuth(auth);
    return next;
  }
  // Every backend call. An expired or revoked access token is renewed once and the call retried.
  async function call<T>(fn: string, args: object): Promise<T> {
    try { return await client!.rpc<T>(await session(), fn, args); }
    catch (error) {
      if (!(error instanceof RemoteError && error.reason === 'unauthorized') || !auth.session) throw error;
      auth = { ...auth, session: { ...auth.session, expiresAt: 0 } };
      writeAuth(auth);
      return client!.rpc<T>(await session(), fn, args);
    }
  }
  async function run(): Promise<SyncStatus> {
    if (!client) return status;
    set({ state: 'syncing', lastSyncedAt: auth.lastSyncedAt ?? null });
    try {
      const result = await call<{ syncedAt: string }>('sync_learner', { payload: buildPayload(store, lessonIds) });
      auth = { ...auth, lastSyncedAt: result.syncedAt };
      writeAuth(auth);
      return set({ state: 'synced', lastSyncedAt: result.syncedAt });
    } catch (error) {
      // Local progress is untouched; the next attempt tries again.
      return set({ state: 'error', reason: error instanceof RemoteError ? error.reason : 'server', lastSyncedAt: auth.lastSyncedAt ?? null });
    }
  }
  return {
    configured: !!client,
    status: () => status,
    subscribe(listener: (status: SyncStatus) => void) { listeners.add(listener); return () => listeners.delete(listener); },
    sync() { running ??= run().finally(() => { running = null; }); return running; },
    async leaderboard(): Promise<RemoteRow[] | null> {
      if (!client) return null;
      try { return await call<RemoteRow[]>('weekly_leaderboard', { max_rows: 10 }); } catch { return null; }
    },
    // The learner and their accepted streak buddies, by weekly XP.
    async groupLeaderboard(): Promise<RemoteRow[] | null> {
      if (!client) return null;
      try { return await call<RemoteRow[]>('group_leaderboard', {}); } catch { return null; }
    },
    // Code groups: make one (the server returns its code), join by code, leave, and read one group's board.
    async groups(): Promise<GroupRow[] | null> {
      if (!client) return null;
      try { return await call<GroupRow[]>('my_groups', {}); } catch { return null; }
    },
    async createGroup(): Promise<CreateGroupResult> {
      if (!client) return { status: 'offline' };
      try { return await call<CreateGroupResult>('create_group', {}); } catch { return { status: 'offline' }; }
    },
    async joinGroup(code: string): Promise<JoinResult> {
      if (!client) return 'offline';
      try { return await call<JoinResult>('join_group', { group_code: code }); } catch { return 'offline'; }
    },
    async leaveGroup(code: string) {
      if (!client) return false;
      try { return await call<boolean>('leave_group', { group_code: code }); } catch { return false; }
    },
    async codeGroupLeaderboard(code: string): Promise<RemoteRow[] | null> {
      if (!client) return null;
      try { return await call<RemoteRow[]>('code_group_leaderboard', { group_code: code }); } catch { return null; }
    },
    // Claims a username on the server; the store keeps it only once the server agrees.
    async setUsername(name: string | null): Promise<UsernameResult> {
      if (!client) return 'offline';
      try { return await call<UsernameResult>('set_username', { new_name: name }); } catch { return 'offline'; }
    },
    // Syncs first, so practice days and XP are current before streaks are read.
    async buddies(): Promise<BuddyRow[] | null> {
      if (!client) return null;
      await this.sync();
      try { return await call<BuddyRow[]>('my_buddies', {}); } catch { return null; }
    },
    async requestBuddy(username: string): Promise<RequestResult> {
      if (!client) return 'offline';
      try { return await call<RequestResult>('request_buddy', { username }); } catch { return 'offline'; }
    },
    async respondBuddy(linkId: string, accept: boolean) {
      if (!client) return false;
      try { return await call<boolean>('respond_buddy', { link_id: linkId, accept }); } catch { return false; }
    },
    async removeBuddy(linkId: string) {
      if (!client) return false;
      try { return await call<boolean>('remove_buddy', { link_id: linkId }); } catch { return false; }
    },
    // Lesson comments: read, post, vote (1, -1, or 0 to clear) and delete your own. No editing.
    async comments(lessonId: string): Promise<CommentRow[] | null> {
      if (!client) return null;
      try { return await call<CommentRow[]>('lesson_comments_list', { lesson: lessonId }); } catch { return null; }
    },
    async postComment(lessonId: string, message: string): Promise<PostResult> {
      if (!client) return 'offline';
      try { return await call<PostResult>('post_comment', { lesson: lessonId, message }); } catch { return 'offline'; }
    },
    async voteComment(commentId: string, vote: -1 | 0 | 1): Promise<ActionResult> {
      if (!client) return 'offline';
      try { return await call<boolean>('vote_comment', { comment: commentId, vote }) ? 'ok' : 'refused'; } catch { return 'offline'; }
    },
    async deleteComment(commentId: string): Promise<ActionResult> {
      if (!client) return 'offline';
      try { return await call<boolean>('delete_comment', { comment: commentId }) ? 'ok' : 'refused'; } catch { return 'offline'; }
    },
    async deleteRemote() {
      if (!client || !auth.session) return true;
      try { await call('delete_my_data', {}); auth = {}; writeAuth(auth); set({ state: 'syncing', lastSyncedAt: null }); return true; } catch { return false; }
    },
  };
}
export type Sync = ReturnType<typeof createSync>;

let instance: Sync | null = null;
// The app's one sync instance. Without VITE_SUPABASE_URL and a publishable key it stays local-only.
export function appSync(lessonIds: string[]) {
  if (!instance) {
    const config = configFromEnv((import.meta.env ?? {}) as Record<string, string | undefined>);
    instance = createSync(config ? createClient(config) : null, lessonIds);
  }
  return instance;
}
