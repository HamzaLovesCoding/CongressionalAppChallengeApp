-- The global weekly board lists every learner who has earned XP this week. A learner who has not
-- chosen a username is returned with a null alias and the app shows "Anonymous"; the board still
-- returns only rank, alias, car, XP and is-you (no IDs). Before, learners without a username were
-- left off the board entirely. A learner with no XP this week is still not listed.
create or replace function public.weekly_leaderboard(max_rows integer default 10)
returns table (rank integer, alias text, car_id text, xp integer, is_you boolean)
language sql stable security definer set search_path = '' as $$
  with week as (
    select x.user_id, sum(x.points)::integer as xp
    from public.xp_events x
    where x.created_at >= date_trunc('week', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
    group by x.user_id
    having sum(x.points) > 0
  ), ranked as (
    select w.user_id, p.alias, p.car_id, w.xp, (rank() over (order by w.xp desc))::integer as rank
    from week w join public.profiles p on p.user_id = w.user_id
  )
  select r.rank, r.alias, r.car_id, r.xp, r.user_id = auth.uid()
  from ranked r
  where r.rank <= least(greatest(coalesce(max_rows, 10), 1), 50) or r.user_id = auth.uid()
  order by r.rank, r.alias nulls last;
$$;
