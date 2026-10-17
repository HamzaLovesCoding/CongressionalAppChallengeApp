-- Lane learner foundation: anonymous learners, private progress, server-validated XP and a
-- privacy-safe weekly leaderboard. Applies to a Supabase project with anonymous sign-ins enabled.
--
-- Security model
-- - Every table has row level security. Learners may SELECT only their own rows.
-- - Learners never write tables directly. All writes go through public.sync_learner(), a
--   SECURITY DEFINER function that takes the user from auth.uid(), validates every value against
--   allow-lists and ranges, and is idempotent on client event IDs.
-- - XP is never accepted from the client. sync_learner() grants each catalog lesson's points once
--   per learner, when that lesson is reported complete.
-- - public.weekly_leaderboard() returns only rank, alias, car and weekly XP.
-- - public.delete_my_data() lets a learner erase their rows.

-- Lessons that can earn XP. Seeded from src/feed/clips.ts; scripts/supabase-schema.test.mjs keeps
-- the two in step.
create table public.lesson_catalog (
  id text primary key,
  xp smallint not null default 10 check (xp between 0 and 50)
);
insert into public.lesson_catalog (id) values
  ('lane-end-scan'), ('after-collision'), ('emergency-kit'), ('front-curb'), ('dark-signal'),
  ('emergency-pull-right'), ('emergency-right-edge'), ('intersection-right-of-way'), ('high-beams'),
  ('passing-bicyclist'), ('freeway-entry'), ('freeway-merge'), ('drive-test-readiness'),
  ('blind-spot-check'), ('blind-curve'), ('blind-bend'), ('merging-trailer'), ('stopping-distance'),
  ('three-second-check'), ('yellow-light'), ('roundabout'), ('four-way-stop'), ('following-distance'),
  ('school-bus');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The learner's username (never a required real name): 3–20 letters, numbers, hyphens or
  -- underscores, unique ignoring case. Claimed only through public.set_username().
  alias text check (alias is null or alias ~ '^[A-Za-z0-9_-]{3,20}$'),
  car_id text check (car_id is null or car_id in ('hatchback', 'sedan', 'wagon', 'pickup', 'minivan', 'classic-coupe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_alias_unique on public.profiles (lower(alias)) where alias is not null;

-- Days on which the learner earned XP (their local calendar day), for streaks shared with buddies.
create table public.activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

create table public.learner_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  permit_test_date date,
  daily_goal smallint not null default 50 check (daily_goal in (10, 30, 50)),
  first_session_completed_at timestamptz,
  -- Reserved: reminders need a separate consent flow before anything uses this.
  reminders_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.content_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lesson_catalog (id),
  tries integer not null default 0 check (tries >= 0),
  first_try boolean not null default false,
  done boolean not null default false,
  completed_at timestamptz,
  watched_ratio real not null default 0 check (watched_ratio between 0 and 1),
  key_segment_seen boolean not null default false,
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_event_id text not null check (char_length(client_event_id) between 8 and 64),
  kind text not null check (kind in ('quiz_attempt')),
  lesson_id text not null references public.lesson_catalog (id),
  topic_id text not null check (char_length(topic_id) between 1 and 64),
  attempt_kind text not null check (attempt_kind in ('primary', 'followUp', 'similar', 'harder', 'review', 'recall', 'glossary')),
  correct boolean not null,
  active_ms integer not null check (active_ms between 0 and 3600000),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);
create index learning_events_user_time on public.learning_events (user_id, occurred_at desc);

create table public.topic_mastery (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text not null check (char_length(topic_id) between 1 and 64),
  mastery real check (mastery is null or mastery between 0 and 1),
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0),
  skips integer not null default 0 check (skips >= 0),
  help integer not null default 0 check (help >= 0),
  retries integer not null default 0 check (retries >= 0),
  review_attempts integer not null default 0 check (review_attempts >= 0),
  review_correct integer not null default 0 check (review_correct >= 0),
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table public.review_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 80),
  topic_id text not null check (char_length(topic_id) between 1 and 64),
  reason text not null check (reason in ('menu', 'skip', 'sim-exit', 'sim-unsafe', 'help', 'missed')),
  added_at timestamptz not null,
  resolved_at timestamptz,
  primary key (user_id, item_key)
);

create table public.simulation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_event_id text not null check (char_length(client_event_id) between 8 and 64),
  scenario_id text not null check (scenario_id in ('four-way-stop', 'unprotected-left-turn', 'roundabout-entry', 'lane-ends-merge',
    'blind-spot-motorcycle', 'emergency-vehicle-yield', 'railroad-clear-exit', 'yellow-light-stop', 'freeway-entrance-merge', 'right-turn-scan')),
  topic_id text not null check (char_length(topic_id) between 1 and 64),
  outcome text not null check (outcome in ('safe', 'unsafe', 'timeout', 'retry', 'exit')),
  chosen_action text check (chosen_action is null or char_length(chosen_action) <= 40),
  elapsed_seconds real check (elapsed_seconds is null or elapsed_seconds between 0 and 600),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);
create index simulation_attempts_user_time on public.simulation_attempts (user_id, occurred_at desc);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lesson_catalog (id),
  reason text not null check (reason in ('lesson_completed')),
  points smallint not null check (points between 0 and 50),
  created_at timestamptz not null default now(),
  -- One reward per lesson per learner: replays and re-syncs never add XP.
  unique (user_id, lesson_id, reason)
);
create index xp_events_week on public.xp_events (created_at, user_id);

-- Row level security: own rows only, read-only for clients.
alter table public.lesson_catalog enable row level security;
alter table public.activity_days enable row level security;
alter table public.profiles enable row level security;
alter table public.learner_settings enable row level security;
alter table public.content_progress enable row level security;
alter table public.learning_events enable row level security;
alter table public.topic_mastery enable row level security;
alter table public.review_items enable row level security;
alter table public.simulation_attempts enable row level security;
alter table public.xp_events enable row level security;

create policy "own profile" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "own settings" on public.learner_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "own progress" on public.content_progress for select to authenticated using (user_id = (select auth.uid()));
create policy "own events" on public.learning_events for select to authenticated using (user_id = (select auth.uid()));
create policy "own mastery" on public.topic_mastery for select to authenticated using (user_id = (select auth.uid()));
create policy "own review" on public.review_items for select to authenticated using (user_id = (select auth.uid()));
create policy "own simulations" on public.simulation_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "own xp" on public.xp_events for select to authenticated using (user_id = (select auth.uid()));
create policy "own activity" on public.activity_days for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.activity_days, public.lesson_catalog, public.profiles, public.learner_settings, public.content_progress, public.learning_events,
  public.topic_mastery, public.review_items, public.simulation_attempts, public.xp_events from anon, authenticated;
grant select on public.activity_days, public.profiles, public.learner_settings, public.content_progress, public.learning_events,
  public.topic_mastery, public.review_items, public.simulation_attempts, public.xp_events to authenticated;

-- Clamp a client timestamp to the past (never the future).
create function public.lane_past(value text) returns timestamptz
language sql stable set search_path = '' as $$
  select least(coalesce(nullif(value, '')::timestamptz, now()), now());
$$;

-- The only write path. Payload shape: docs/lane/02-frontend-to-backend-map.md and src/data/sync.ts.
create function public.sync_learner(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  max_items constant integer := 500;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'bad payload' using errcode = '22023'; end if;

  -- Profile: only the car comes from sync (an invalid one is stored as null). The username is
  -- claimed separately through set_username(), so two learners can never hold the same one.
  insert into public.profiles as p (user_id, car_id)
  values (uid, case when payload->'profile'->>'carId' in ('hatchback', 'sedan', 'wagon', 'pickup', 'minivan', 'classic-coupe') then payload->'profile'->>'carId' end)
  on conflict (user_id) do update set car_id = excluded.car_id, updated_at = now();

  -- Practice days: only well-formed dates from the last 60 days up to tomorrow (time zones differ).
  insert into public.activity_days (user_id, day)
  select uid, d.value::date
  from jsonb_array_elements_text(coalesce(payload->'activeDays', '[]')) with ordinality as d(value, n)
  where d.n <= 60 and d.value ~ '^\d{4}-\d{2}-\d{2}$'
    and d.value::date between current_date - 60 and current_date + 1
  on conflict do nothing;

  insert into public.learner_settings as s (user_id, permit_test_date, daily_goal, first_session_completed_at)
  values (uid,
    case when payload->'settings'->>'permitTestDate' ~ '^\d{4}-\d{2}-\d{2}$' then (payload->'settings'->>'permitTestDate')::date end,
    case when payload->'settings'->>'dailyGoal' in ('10', '30', '50') then (payload->'settings'->>'dailyGoal')::smallint else 50 end,
    case when payload->'settings'->>'firstSessionCompletedAt' is not null then public.lane_past(payload->'settings'->>'firstSessionCompletedAt') end)
  on conflict (user_id) do update set permit_test_date = excluded.permit_test_date, daily_goal = excluded.daily_goal,
    first_session_completed_at = coalesce(s.first_session_completed_at, excluded.first_session_completed_at), updated_at = now();

  -- Progress only grows: completion is sticky and watch coverage never shrinks.
  for item in select value from jsonb_array_elements(coalesce(payload->'lessons', '[]')) limit max_items loop
    continue when not exists (select 1 from public.lesson_catalog c where c.id = item->>'id');
    insert into public.content_progress as cp (user_id, lesson_id, tries, first_try, done, completed_at, watched_ratio, key_segment_seen, last_played_at)
    values (uid, item->>'id', greatest(0, least(coalesce((item->>'tries')::integer, 0), 10000)), coalesce((item->>'firstTry')::boolean, false),
      coalesce((item->>'done')::boolean, false), case when (item->>'done')::boolean then public.lane_past(item->>'completedAt') end,
      greatest(0, least(coalesce((item->>'watchedRatio')::real, 0), 1)), coalesce((item->>'keySegmentSeen')::boolean, false),
      case when item->>'lastPlayedAt' is not null then public.lane_past(item->>'lastPlayedAt') end)
    on conflict (user_id, lesson_id) do update set
      first_try = case when cp.tries >= excluded.tries then cp.first_try else excluded.first_try end,
      tries = greatest(cp.tries, excluded.tries), done = cp.done or excluded.done,
      completed_at = coalesce(cp.completed_at, excluded.completed_at),
      watched_ratio = greatest(cp.watched_ratio, excluded.watched_ratio), key_segment_seen = cp.key_segment_seen or excluded.key_segment_seen,
      last_played_at = greatest(cp.last_played_at, excluded.last_played_at), updated_at = now();
  end loop;

  -- XP comes from the catalog, once per completed lesson, at the time the server learns of it.
  insert into public.xp_events (user_id, lesson_id, reason, points)
  select uid, cp.lesson_id, 'lesson_completed', c.xp
  from public.content_progress cp join public.lesson_catalog c on c.id = cp.lesson_id
  where cp.user_id = uid and cp.done
  on conflict (user_id, lesson_id, reason) do nothing;

  for item in select value from jsonb_array_elements(coalesce(payload->'attempts', '[]')) limit max_items loop
    continue when not exists (select 1 from public.lesson_catalog c where c.id = item->>'lessonId')
      or item->>'kind' not in ('primary', 'followUp', 'similar', 'harder', 'review', 'recall', 'glossary')
      or char_length(coalesce(item->>'id', '')) not between 8 and 64
      or char_length(coalesce(item->>'topicId', '')) not between 1 and 64;
    insert into public.learning_events (user_id, client_event_id, kind, lesson_id, topic_id, attempt_kind, correct, active_ms, occurred_at)
    values (uid, item->>'id', 'quiz_attempt', item->>'lessonId', item->>'topicId', item->>'kind', coalesce((item->>'correct')::boolean, false),
      greatest(0, least(coalesce((item->>'activeMs')::integer, 0), 3600000)), public.lane_past(item->>'at'))
    on conflict (user_id, client_event_id) do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'simulations', '[]')) limit max_items loop
    continue when item->>'scenarioId' not in ('four-way-stop', 'unprotected-left-turn', 'roundabout-entry', 'lane-ends-merge',
        'blind-spot-motorcycle', 'emergency-vehicle-yield', 'railroad-clear-exit', 'yellow-light-stop', 'freeway-entrance-merge', 'right-turn-scan')
      or item->>'outcome' not in ('safe', 'unsafe', 'timeout', 'retry', 'exit')
      or char_length(coalesce(item->>'id', '')) not between 8 and 64
      or char_length(coalesce(item->>'topicId', '')) not between 1 and 64;
    insert into public.simulation_attempts (user_id, client_event_id, scenario_id, topic_id, outcome, chosen_action, elapsed_seconds, occurred_at)
    values (uid, item->>'id', item->>'scenarioId', item->>'topicId', item->>'outcome', left(item->>'chosenAction', 40),
      case when item->>'elapsedSeconds' is not null then greatest(0, least((item->>'elapsedSeconds')::real, 600)) end, public.lane_past(item->>'at'))
    on conflict (user_id, client_event_id) do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'topics', '[]')) limit max_items loop
    continue when char_length(coalesce(item->>'id', '')) not between 1 and 64;
    insert into public.topic_mastery as tm (user_id, topic_id, mastery, attempts, correct, skips, help, retries, review_attempts, review_correct, last_practiced_at)
    values (uid, item->>'id',
      case when item->>'mastery' is not null then greatest(0, least((item->>'mastery')::real, 1)) end,
      greatest(0, coalesce((item->>'attempts')::integer, 0)), greatest(0, coalesce((item->>'correct')::integer, 0)),
      greatest(0, coalesce((item->>'skips')::integer, 0)), greatest(0, coalesce((item->>'help')::integer, 0)),
      greatest(0, coalesce((item->>'retries')::integer, 0)), greatest(0, coalesce((item->>'reviewAttempts')::integer, 0)),
      greatest(0, coalesce((item->>'reviewCorrect')::integer, 0)),
      case when item->>'lastPracticedAt' is not null then public.lane_past(item->>'lastPracticedAt') end)
    on conflict (user_id, topic_id) do update set
      mastery = coalesce(excluded.mastery, tm.mastery),
      attempts = greatest(tm.attempts, excluded.attempts), correct = greatest(tm.correct, excluded.correct),
      skips = greatest(tm.skips, excluded.skips), help = greatest(tm.help, excluded.help), retries = greatest(tm.retries, excluded.retries),
      review_attempts = greatest(tm.review_attempts, excluded.review_attempts), review_correct = greatest(tm.review_correct, excluded.review_correct),
      last_practiced_at = greatest(tm.last_practiced_at, excluded.last_practiced_at), updated_at = now();
  end loop;

  -- Review Later upserts by key, so re-queuing reactivates the same row instead of duplicating it.
  for item in select value from jsonb_array_elements(coalesce(payload->'review', '[]')) limit max_items loop
    continue when char_length(coalesce(item->>'itemId', '')) not between 1 and 80
      or char_length(coalesce(item->>'topicId', '')) not between 1 and 64
      or item->>'reason' not in ('menu', 'skip', 'sim-exit', 'sim-unsafe', 'help', 'missed');
    insert into public.review_items as r (user_id, item_key, topic_id, reason, added_at, resolved_at)
    values (uid, item->>'itemId', item->>'topicId', item->>'reason', public.lane_past(item->>'addedAt'),
      case when item->>'resolvedAt' is not null then public.lane_past(item->>'resolvedAt') end)
    on conflict (user_id, item_key) do update set topic_id = excluded.topic_id, reason = excluded.reason,
      added_at = excluded.added_at, resolved_at = excluded.resolved_at;
  end loop;

  return jsonb_build_object('syncedAt', now(), 'weeklyXp', (
    select coalesce(sum(points), 0) from public.xp_events
    where user_id = uid and created_at >= date_trunc('week', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'));
end;
$$;

-- Weekly XP leaderboard (Monday 00:00 Pacific). Learners appear only after choosing an alias; the
-- caller's own row is always included. Returns no IDs, settings, progress or events.
create function public.weekly_leaderboard(max_rows integer default 10)
returns table (rank integer, alias text, car_id text, xp integer, is_you boolean)
language sql stable security definer set search_path = '' as $$
  with week as (
    select x.user_id, sum(x.points)::integer as xp
    from public.xp_events x
    where x.created_at >= date_trunc('week', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
    group by x.user_id
  ), ranked as (
    select w.user_id, p.alias, p.car_id, w.xp, (rank() over (order by w.xp desc))::integer as rank
    from week w join public.profiles p on p.user_id = w.user_id
    where p.alias is not null or w.user_id = auth.uid()
  )
  select r.rank, r.alias, r.car_id, r.xp, r.user_id = auth.uid()
  from ranked r
  where r.rank <= least(greatest(coalesce(max_rows, 10), 1), 50) or r.user_id = auth.uid()
  order by r.rank, r.alias;
$$;

-- Claims or changes the caller's username. Returns 'ok', 'taken' or 'invalid'; null clears it.
create function public.set_username(new_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if new_name is not null and new_name !~ '^[A-Za-z0-9_-]{3,20}$' then return 'invalid'; end if;
  if new_name is not null and exists (select 1 from public.profiles p where lower(p.alias) = lower(new_name) and p.user_id <> uid) then return 'taken'; end if;
  insert into public.profiles as p (user_id, alias) values (uid, new_name)
  on conflict (user_id) do update set alias = excluded.alias, updated_at = now();
  return 'ok';
exception when unique_violation then return 'taken';
end;
$$;

-- Erases the caller's learner data. Removing the anonymous auth account itself needs the
-- service role and is handled by the owner's deletion process (docs/lane/09).
create function public.delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.activity_days where user_id = uid;
  delete from public.xp_events where user_id = uid;
  delete from public.simulation_attempts where user_id = uid;
  delete from public.review_items where user_id = uid;
  delete from public.topic_mastery where user_id = uid;
  delete from public.learning_events where user_id = uid;
  delete from public.content_progress where user_id = uid;
  delete from public.learner_settings where user_id = uid;
  delete from public.profiles where user_id = uid;
end;
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default, so the helper is revoked
-- from authenticated too, and only the learner-facing functions are granted back.
revoke all on function public.lane_past(text), public.sync_learner(jsonb), public.weekly_leaderboard(integer), public.set_username(text), public.delete_my_data() from public, anon, authenticated;
grant execute on function public.sync_learner(jsonb), public.weekly_leaderboard(integer), public.set_username(text), public.delete_my_data() to authenticated;
