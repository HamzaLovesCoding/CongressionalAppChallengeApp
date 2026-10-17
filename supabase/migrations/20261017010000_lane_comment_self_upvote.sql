-- Comment votes (owner direction, 2026-10-16): on your own comment you may upvote it once (no
-- downvote); on anyone else's you get one vote, up or down, which you can change or clear.

create or replace function public.vote_comment(comment uuid, vote integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); author uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select c.user_id into author from public.lesson_comments c where c.id = comment;
  if author is null or vote not in (-1, 0, 1) or (author = uid and vote = -1) then return false; end if;
  if vote = 0 then delete from public.comment_votes v where v.comment_id = comment and v.user_id = uid;
  else
    insert into public.comment_votes (comment_id, user_id, value) values (comment, uid, vote)
    on conflict (comment_id, user_id) do update set value = excluded.value;
  end if;
  return true;
end;
$$;

revoke all on function public.vote_comment(uuid, integer) from public, anon, authenticated;
grant execute on function public.vote_comment(uuid, integer) to authenticated;
