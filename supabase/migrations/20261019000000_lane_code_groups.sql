-- Code groups: a learner makes a group, gets a 6-character code, and friends who type the code join
-- its weekly leaderboard.
--
-- Privacy model (users are minors)
-- - A group is found only by its exact code; there is no search or list of groups.
-- - Members see only each other's username, car and weekly XP, the same fields as the global board.
-- - No free text: a group's name is made from its creator's username.
-- - A username is required to make or join a group, so no member shows up nameless.
-- - The tables have no direct access; everything goes through the functions below.

create table public.code_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name text not null,
  owner uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.code_group_members (
  group_id uuid not null references public.code_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index code_group_members_user on public.code_group_members (user_id);
alter table public.code_groups enable row level security;
alter table public.code_group_members enable row level security;
revoke all on public.code_groups, public.code_group_members from anon, authenticated;

-- Six characters without look-alikes (no I, O, 0 or 1). gen_random_uuid() is the randomness source
-- because it is cryptographic and needs no extension; a v4 UUID's first six bytes are all random.
create function public.lane_group_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  result text := '';
begin
  for i in 0..5 loop result := result || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1); end loop;
  return result;
end;
$$;

-- Makes a group with the caller as its first member. Returns {status, code}; status is
-- 'ok' · 'need-username' · 'limit' (in 10 groups, or made 5 today).
create function public.create_group() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  owner_alias text;
  new_code text;
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select alias into owner_alias from public.profiles where user_id = uid;
  if owner_alias is null then return jsonb_build_object('status', 'need-username'); end if;
  if (select count(*) from public.code_group_members where user_id = uid) >= 10
    or (select count(*) from public.code_groups where owner = uid and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('status', 'limit');
  end if;
  loop
    new_code := public.lane_group_code();
    begin
      insert into public.code_groups (code, name, owner) values (new_code, owner_alias || '''s group', uid) returning id into new_id;
      exit;
    exception when unique_violation then -- the code is taken; draw another
    end;
  end loop;
  insert into public.code_group_members (group_id, user_id) values (new_id, uid);
  return jsonb_build_object('status', 'ok', 'code', new_code);
end;
$$;

-- Joins a group by code (case and spaces ignored). Returns
-- 'joined' · 'already' · 'not-found' · 'need-username' · 'limit' (in 10 groups) · 'full' (50 members) · 'invalid'.
create function public.join_group(group_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  wanted text := upper(regexp_replace(coalesce(group_code, ''), '[\s-]', '', 'g'));
  target uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if wanted !~ '^[A-HJ-NP-Z2-9]{6}$' then return 'invalid'; end if;
  if not exists (select 1 from public.profiles where user_id = uid and alias is not null) then return 'need-username'; end if;
  select id into target from public.code_groups where code = wanted;
  if target is null then return 'not-found'; end if;
  if exists (select 1 from public.code_group_members where group_id = target and user_id = uid) then return 'already'; end if;
  if (select count(*) from public.code_group_members where user_id = uid) >= 10 then return 'limit'; end if;
  if (select count(*) from public.code_group_members where group_id = target) >= 50 then return 'full'; end if;
  insert into public.code_group_members (group_id, user_id) values (target, uid);
  return 'joined';
end;
$$;

-- Leaves a group. The last member out deletes it, so an empty group's code stops working.
create function public.leave_group(group_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id into target from public.code_groups where code = upper(group_code);
  delete from public.code_group_members where group_id = target and user_id = uid;
  if not found then return false; end if;
  delete from public.code_groups g where g.id = target and not exists (select 1 from public.code_group_members m where m.group_id = target);
  return true;
end;
$$;

-- The caller's groups, newest first.
create function public.my_groups()
returns table (code text, name text, members integer, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select g.code, g.name, (select count(*)::integer from public.code_group_members c where c.group_id = g.id), g.owner = auth.uid()
  from public.code_group_members m join public.code_groups g on g.id = m.group_id
  where m.user_id = auth.uid()
  order by m.joined_at desc;
$$;

-- One group's weekly leaderboard, for its members only (anyone else gets no rows).
create function public.code_group_leaderboard(group_code text)
returns table (rank integer, alias text, car_id text, xp integer, is_you boolean)
language sql stable security definer set search_path = '' as $$
  with target as (
    select g.id from public.code_groups g
    where g.code = upper(group_code)
      and exists (select 1 from public.code_group_members m where m.group_id = g.id and m.user_id = auth.uid())
  ), week as (
    select m.user_id, coalesce(sum(x.points), 0)::integer as xp
    from public.code_group_members m join target t on t.id = m.group_id
      left join public.xp_events x on x.user_id = m.user_id
        and x.created_at >= date_trunc('week', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
    group by m.user_id
  )
  select (rank() over (order by w.xp desc))::integer, p.alias, p.car_id, w.xp, w.user_id = auth.uid()
  from week w left join public.profiles p on p.user_id = w.user_id
  order by 1, 2;
$$;

-- "Delete synced data" also leaves every group; groups left empty are deleted.
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.code_group_members where user_id = uid;
  delete from public.code_groups g where not exists (select 1 from public.code_group_members m where m.group_id = g.id);
  delete from public.comment_votes where user_id = uid;
  delete from public.lesson_comments where user_id = uid;
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

revoke all on function public.lane_group_code(), public.create_group(), public.join_group(text), public.leave_group(text),
  public.my_groups(), public.code_group_leaderboard(text), public.delete_my_data() from public, anon, authenticated;
grant execute on function public.create_group(), public.join_group(text), public.leave_group(text),
  public.my_groups(), public.code_group_leaderboard(text), public.delete_my_data() to authenticated;
