-- Streak buddies: two learners who add each other by username keep a shared (duo) streak and
-- appear on each other's Group leaderboard.
--
-- Privacy model (users are minors)
-- - A learner is found only by typing their exact username; there is no search or browse.
-- - Nothing is shared until the other learner accepts. Either learner can remove the link.
-- - Buddies see only each other's username, car, weekly XP, whether they practiced today, and the
--   duo streak. No IDs, progress, answers or settings leave the server.
-- - No messages, comments or free text: the only text a learner controls is their username.
-- - Rows are readable only by the two learners in them; all writes go through the functions below.

create table public.buddy_links (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);
-- One link per pair, whichever learner asked first.
create unique index buddy_links_pair on public.buddy_links (least(requester, addressee), greatest(requester, addressee));
create index buddy_links_addressee on public.buddy_links (addressee);

alter table public.buddy_links enable row level security;
create policy "own links" on public.buddy_links for select to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));
revoke all on public.buddy_links from anon, authenticated;
grant select on public.buddy_links to authenticated;

-- "Today" for streaks is the Pacific calendar day (Lane is a California app).
create function public.lane_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/Los_Angeles')::date; $$;

-- Consecutive days, ending today or yesterday, on which both learners practiced. A streak survives
-- until the end of the day after the last shared practice.
create function public.duo_streak(a uuid, b uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := public.lane_today();
  streak integer := 0;
begin
  if not (exists (select 1 from public.activity_days x where x.user_id = a and x.day = d)
      and exists (select 1 from public.activity_days x where x.user_id = b and x.day = d)) then d := d - 1; end if;
  loop
    exit when streak >= 366
      or not exists (select 1 from public.activity_days x where x.user_id = a and x.day = d)
      or not exists (select 1 from public.activity_days x where x.user_id = b and x.day = d);
    streak := streak + 1;
    d := d - 1;
  end loop;
  return streak;
end;
$$;

-- Sends a buddy request by exact username. Returns:
--   'sent' · 'accepted' (they had already asked you) · 'already' (linked or pending)
--   'not-found' · 'self' · 'need-username' (pick yours first) · 'limit' (too many) · 'invalid'
create function public.request_buddy(username text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  other uuid;
  existing public.buddy_links;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if username is null or username !~ '^[A-Za-z0-9_-]{3,20}$' then return 'invalid'; end if;
  if not exists (select 1 from public.profiles where user_id = uid and alias is not null) then return 'need-username'; end if;
  select user_id into other from public.profiles where lower(alias) = lower(username);
  if other is null then return 'not-found'; end if;
  if other = uid then return 'self'; end if;
  select * into existing from public.buddy_links l
    where least(l.requester, l.addressee) = least(uid, other) and greatest(l.requester, l.addressee) = greatest(uid, other);
  if found then
    -- They asked first: adding them back accepts.
    if existing.status = 'pending' and existing.addressee = uid then
      update public.buddy_links set status = 'accepted', accepted_at = now() where id = existing.id;
      return 'accepted';
    end if;
    return 'already';
  end if;
  if (select count(*) from public.buddy_links where requester = uid and status = 'pending') >= 20
    or (select count(*) from public.buddy_links where (requester = uid or addressee = uid) and status = 'accepted') >= 50 then return 'limit'; end if;
  insert into public.buddy_links (requester, addressee) values (uid, other);
  return 'sent';
end;
$$;

-- Accepts or declines a request sent to the caller. Declining deletes it without telling the sender.
create function public.respond_buddy(link_id uuid, accept boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if accept then
    update public.buddy_links set status = 'accepted', accepted_at = now() where id = link_id and addressee = uid and status = 'pending';
  else
    delete from public.buddy_links where id = link_id and addressee = uid and status = 'pending';
  end if;
  return found;
end;
$$;

-- Removes a buddy, or cancels a request the caller sent. Either learner may do this.
create function public.remove_buddy(link_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.buddy_links where id = link_id and (requester = uid or addressee = uid);
  return found;
end;
$$;

-- The caller's buddies and requests. Incoming and outgoing requests show only the username.
create function public.my_buddies()
returns table (link_id uuid, username text, car_id text, relation text, duo_streak integer, you_today boolean, them_today boolean, weekly_xp integer)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid), links as (
    select l.id, l.status, case when l.requester = me.uid then l.addressee else l.requester end as other,
      case when l.status = 'accepted' then 'buddy' when l.requester = me.uid then 'outgoing' else 'incoming' end as relation
    from public.buddy_links l, me where me.uid in (l.requester, l.addressee)
  )
  select l.id, p.alias,
    case when l.relation = 'buddy' then p.car_id end,
    l.relation,
    case when l.relation = 'buddy' then public.duo_streak((select uid from me), l.other) else 0 end,
    exists (select 1 from public.activity_days a where a.user_id = (select uid from me) and a.day = public.lane_today()),
    l.relation = 'buddy' and exists (select 1 from public.activity_days a where a.user_id = l.other and a.day = public.lane_today()),
    case when l.relation = 'buddy' then (select coalesce(sum(x.points), 0)::integer from public.xp_events x
      where x.user_id = l.other and x.created_at >= date_trunc('week', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') else 0 end
  from links l join public.profiles p on p.user_id = l.other
  order by l.relation, p.alias;
$$;

-- Group leaderboard: the caller and accepted buddies, by verified weekly XP.
create function public.group_leaderboard()
returns table (rank integer, alias text, car_id text, xp integer, is_you boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid), members as (
    select uid as user_id from me
    union
    select case when l.requester = me.uid then l.addressee else l.requester end
    from public.buddy_links l, me where l.status = 'accepted' and me.uid in (l.requester, l.addressee)
  ), week as (
    select m.user_id, coalesce(sum(x.points), 0)::integer as xp
    from members m left join public.xp_events x on x.user_id = m.user_id
      and x.created_at >= date_trunc('week', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
    group by m.user_id
  )
  select (rank() over (order by w.xp desc))::integer, p.alias, p.car_id, w.xp, w.user_id = (select uid from me)
  from week w left join public.profiles p on p.user_id = w.user_id
  order by 1, 2;
$$;

-- "Delete synced data" also removes the caller's buddy links.
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.buddy_links where requester = uid or addressee = uid;
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

-- lane_today and duo_streak are internal: callable only from the functions above, never by a learner directly
-- (duo_streak takes any two IDs). Supabase's default grant to authenticated is revoked with the rest.
revoke all on function public.lane_today(), public.duo_streak(uuid, uuid), public.request_buddy(text), public.respond_buddy(uuid, boolean),
  public.remove_buddy(uuid), public.my_buddies(), public.group_leaderboard() from public, anon, authenticated;
grant execute on function public.request_buddy(text), public.respond_buddy(uuid, boolean), public.remove_buddy(uuid),
  public.my_buddies(), public.group_leaderboard() to authenticated;
