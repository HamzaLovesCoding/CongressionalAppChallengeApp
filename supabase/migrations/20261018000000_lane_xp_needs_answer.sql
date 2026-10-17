-- Lesson XP needs a recorded correct answer. sync_learner used to grant XP for any lesson the app
-- marked done, so a learner editing local storage could claim every lesson's XP and top the weekly
-- leaderboard without answering anything. A completion without a correct answer on the server simply
-- earns nothing yet: sync_learner stores attempts after it tries to grant XP, so a lesson finished
-- since the last backup is credited on the next one (xp_events' unique key keeps it to once).
-- This raises the bar; it can't prove the answers were honest, because the app reports them.
create function public.lane_xp_needs_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.reason = 'lesson_completed' and not exists (
    select 1 from public.learning_events e
    where e.user_id = new.user_id and e.lesson_id = new.lesson_id and e.correct
  ) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.lane_xp_needs_answer() from public, anon, authenticated;

create trigger xp_needs_answer before insert on public.xp_events
  for each row execute function public.lane_xp_needs_answer();
