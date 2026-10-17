import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIPS } from '../src/feed/clips.ts';
import { CARS } from '../src/profile/cars.ts';

// Static checks on the migration. The behavioral RLS checks run on Postgres in supabase/tests/rls.check.mjs.
const sql = readFileSync(new URL('../supabase/migrations/20261015000000_lane_learner_foundation.sql', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../src/simulation/registry.ts', import.meta.url), 'utf8');
const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map(match => match[1]);

test('every table has row level security and no client write policy', () => {
  assert.ok(tables.length >= 9);
  for (const table of tables) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), table);
  assert.doesNotMatch(sql, /for (insert|update|delete|all) to/i, 'clients write only through sync_learner()');
});

test('security definer functions pin search_path and are not executable by anon', () => {
  const definers = [...sql.matchAll(/create function (public\.\w+)\([^)]*\)[\s\S]*?language \w+[^\n]*security definer([^\n]*)/g)];
  assert.ok(definers.length >= 3);
  for (const [, name, rest] of definers) assert.match(rest, /set search_path = ''/, name);
  assert.match(sql, /revoke all on function [^;]*public\.sync_learner\(jsonb\)[^;]* from public, anon, authenticated;/);
});

test('the lesson catalog, scenario list and car list match the app', () => {
  const catalog = [...sql.match(/insert into public\.lesson_catalog \(id\) values([\s\S]*?);/)[1].matchAll(/'([a-z-]+)'/g)].map(match => match[1]);
  assert.deepEqual(catalog, CLIPS.map(clip => clip.id));
  const scenarios = [...registry.matchAll(/\{ id: '([a-z-]+)', number:/g)].map(match => match[1]);
  for (const id of scenarios) assert.ok(sql.split(`'${id}'`).length >= 3, `${id} allowed in table and function`);
  for (const car of CARS) assert.ok(sql.includes(`'${car.id}'`), car.id);
});

test('the leaderboard returns only rank, alias, car, weekly XP and is_you', () => {
  assert.match(sql, /returns table \(rank integer, alias text, car_id text, xp integer, is_you boolean\)/);
});
