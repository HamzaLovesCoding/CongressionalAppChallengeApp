-- Driver coach (owner direction, 2026-10-18): the AI coach on Practice answers through the `coach` Edge
-- Function (supabase/functions/coach), which calls coach_take_turn() before every question. It caps how
-- many questions each learner, and everyone together, can ask per Pacific day, so a public app can't run
-- up the Anthropic bill. Only counts are stored here: questions and answers never reach the database.
--
-- Security model, same as the rest of Lane: no direct table access; the function takes the learner from
-- auth.uid(). A learner who calls it directly only uses up their own allowance. delete_my_data() leaves
-- these counts alone (otherwise it would reset the daily limit); they are deleted after a week.

create table public.coach_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  questions integer not null check (questions > 0),
  primary key (user_id, day)
);
create index coach_usage_day on public.coach_usage (day);
alter table public.coach_usage enable row level security;
revoke all on public.coach_usage from anon, authenticated;

-- Counts one question. Returns {status: 'ok', remaining, learner}, {status: 'daily'} once this learner has
-- asked 30 questions today, or {status: 'busy'} once all learners together have asked 500.
create function public.coach_take_turn() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := public.lane_today();
  used integer;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.coach_usage where day < today - 7;
  if (select coalesce(sum(questions), 0) from public.coach_usage where day = today) >= 500 then
    return jsonb_build_object('status', 'busy');
  end if;
  insert into public.coach_usage as u (user_id, day, questions) values (uid, today, 1)
  on conflict (user_id, day) do update set questions = u.questions + 1 where u.questions < 30
  returning u.questions into used;
  if used is null then return jsonb_build_object('status', 'daily'); end if;
  return jsonb_build_object('status', 'ok', 'remaining', 30 - used, 'learner', uid);
end;
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default.
revoke all on function public.coach_take_turn() from public, anon, authenticated;
grant execute on function public.coach_take_turn() to authenticated;
