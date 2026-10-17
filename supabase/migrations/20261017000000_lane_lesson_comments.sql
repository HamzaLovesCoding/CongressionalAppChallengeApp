-- Lesson comments (owner direction, 2026-10-16): learners post short comments under a lesson, vote
-- them up or down, and delete their own. No editing. A comment shows the author's username, or
-- "Anonymous" when they have none; it never shows an ID or anything else about them.
--
-- Security model, same as the rest of Lane: no direct table access. Every read and write goes through
-- a SECURITY DEFINER function that takes the user from auth.uid() and checks its input.
-- Limits: 1–300 characters, 30 comments per learner per 24 hours, one vote per learner per comment.

create table public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lesson_catalog (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index lesson_comments_lesson_time on public.lesson_comments (lesson_id, created_at desc);
create index lesson_comments_user_time on public.lesson_comments (user_id, created_at desc);

create table public.comment_votes (
  comment_id uuid not null references public.lesson_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (comment_id, user_id)
);

alter table public.lesson_comments enable row level security;
alter table public.comment_votes enable row level security;
revoke all on public.lesson_comments, public.comment_votes from anon, authenticated;

-- A lesson's comments, newest first: author username (null shows as Anonymous), text, time, score,
-- the caller's own vote and whether the caller wrote it.
create function public.lesson_comments_list(lesson text)
returns table (id uuid, author text, body text, created_at timestamptz, score integer, my_vote smallint, is_mine boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, p.alias, c.body, c.created_at,
    coalesce((select sum(v.value) from public.comment_votes v where v.comment_id = c.id), 0)::integer,
    (select v.value from public.comment_votes v where v.comment_id = c.id and v.user_id = auth.uid()),
    c.user_id = auth.uid()
  from public.lesson_comments c
  left join public.profiles p on p.user_id = c.user_id
  where c.lesson_id = lesson and auth.uid() is not null
  order by c.created_at desc
  limit 100;
$$;

-- Posts a comment. Returns 'ok', 'invalid' (empty, too long or unknown lesson) or 'limit'.
create function public.post_comment(lesson text, message text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(regexp_replace(coalesce(message, ''), '\s+', ' ', 'g'));
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if char_length(clean) not between 1 and 300 or not exists (select 1 from public.lesson_catalog c where c.id = lesson) then return 'invalid'; end if;
  if (select count(*) from public.lesson_comments c where c.user_id = uid and c.created_at > now() - interval '24 hours') >= 30 then return 'limit'; end if;
  insert into public.lesson_comments (lesson_id, user_id, body) values (lesson, uid, clean);
  return 'ok';
end;
$$;

-- Votes 1 (up), -1 (down) or 0 (clear). Learners can't vote on their own comments.
create function public.vote_comment(comment uuid, vote integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if vote not in (-1, 0, 1) or not exists (select 1 from public.lesson_comments c where c.id = comment and c.user_id <> uid) then return false; end if;
  if vote = 0 then delete from public.comment_votes v where v.comment_id = comment and v.user_id = uid;
  else
    insert into public.comment_votes (comment_id, user_id, value) values (comment, uid, vote)
    on conflict (comment_id, user_id) do update set value = excluded.value;
  end if;
  return true;
end;
$$;

-- Deletes the caller's own comment (its votes go with it). Returns false for anyone else's.
create function public.delete_comment(comment uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); removed integer;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.lesson_comments c where c.id = comment and c.user_id = uid;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- "Delete backed-up data" also removes the caller's comments and votes.
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
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

-- Supabase grants execute on new public functions to anon and authenticated by default, so everything
-- is revoked first and only the learner-facing functions are granted back.
revoke all on function public.lesson_comments_list(text), public.post_comment(text, text), public.vote_comment(uuid, integer),
  public.delete_comment(uuid), public.delete_my_data() from public, anon, authenticated;
grant execute on function public.lesson_comments_list(text), public.post_comment(text, text), public.vote_comment(uuid, integer),
  public.delete_comment(uuid), public.delete_my_data() to authenticated;
