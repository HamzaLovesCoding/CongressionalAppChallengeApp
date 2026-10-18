-- Run once in the Lane project's SQL editor. These exact accounts were matched to the
-- owner's reported rows on October 18, 2026; other anonymous learners are not targeted.
-- Deletes these four auth accounts and their cascading app records, including yob's two
-- legacy comments. This is permanent. The transaction aborts if the identities changed.
begin;
do $$
declare
  targets uuid[] := array[
    '4abb7e68-d719-42c8-a69b-463ef4c5024f'::uuid, -- dude, 60 XP
    '3b0fa74b-3668-4453-a6ea-c75d0a6026f3'::uuid, -- Anonymous, 20 XP
    'adbd502c-fbcc-4398-b8b4-713148fc9a65'::uuid, -- ben, 10 XP
    '1abf6003-b876-44ff-a407-55ec132623de'::uuid  -- yob, 10 XP, two comments
  ];
  affected_groups uuid[];
  matched integer;
begin
  select count(*) into matched from public.profiles p
  join (values
    (targets[1], 'dude'::text), (targets[2], null::text),
    (targets[3], 'ben'::text), (targets[4], 'yob'::text)
  ) expected(id, alias) on p.user_id = expected.id and p.alias is not distinct from expected.alias;
  if matched <> 4 then raise exception 'Expected exactly the four reviewed test learners; nothing deleted.'; end if;

  select array_agg(distinct group_id) into affected_groups
  from public.code_group_members where user_id = any(targets);
  delete from auth.users where id = any(targets);
  get diagnostics matched = row_count;
  if matched <> 4 then raise exception 'Expected four auth accounts; transaction rolled back.'; end if;
  delete from public.code_groups g where g.id = any(affected_groups)
    and not exists (select 1 from public.code_group_members m where m.group_id = g.id);
end;
$$;
commit;
