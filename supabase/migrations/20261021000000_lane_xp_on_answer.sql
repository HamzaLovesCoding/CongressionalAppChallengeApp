-- sync_learner saves completions before answers. Award a waiting completion in the same
-- transaction as its correct answer; the existing guard and unique reward key still apply.
create function public.lane_xp_on_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.xp_events (user_id, lesson_id, reason, points)
  select cp.user_id, cp.lesson_id, 'lesson_completed', c.xp
  from public.content_progress cp join public.lesson_catalog c on c.id = cp.lesson_id
  where cp.user_id = new.user_id and cp.lesson_id = new.lesson_id and cp.done
  on conflict (user_id, lesson_id, reason) do nothing;
  return new;
end;
$$;
revoke all on function public.lane_xp_on_answer() from public, anon, authenticated;

create trigger xp_on_answer after insert on public.learning_events
  for each row when (new.correct) execute function public.lane_xp_on_answer();
