import test from 'node:test';
import assert from 'node:assert/strict';
import { leaderboardRows } from '../src/home/leaderboard-model.ts';
process.env.TZ = 'America/Los_Angeles';
let sequence=0;
async function store(daily) {
  let saved=JSON.stringify({xp:150,daily,clips:{},saved:[],liked:[]});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>saved,setItem:(_key,value)=>{saved=value;}}});
  return import(`../src/feed/progress.ts?weekly-${sequence++}`);
}
test('weekly XP includes Monday through today, excluding last week and future dates',async()=>{
  const api=await store({'2026-10-04':90,'2026-10-05':10,'2026-10-06':20,'2026-10-07':30,'2026-10-08':80});
  const now=new Date(2026,9,7,14);
  const week=api.weeklyProgress(now);
  assert.equal(week.xp,60); assert.equal(week.daysUntilReset,5);
  assert.equal(week.resetsAt.getDay(),1); assert.equal(week.resetsAt.getHours(),0);
  assert.equal(week.resetsAt.getDate(),12);
  api.buyAvatar('sunny');
  assert.deepEqual(api.weeklyProgress(now),week,'Avatar purchases do not lower weekly XP');
  assert.equal(now.getHours(),14,'Caller date is not mutated');
});
test('Sunday to Monday switches weeks at local midnight without clearing history',async()=>{
  const api=await store({'2026-10-05':10,'2026-10-11':20,'2026-10-12':5});
  assert.equal(api.weeklyProgress(new Date(2026,9,11,23,59,59)).xp,30);
  assert.equal(api.weeklyProgress(new Date(2026,9,11,23,59,59)).daysUntilReset,1);
  const monday=api.weeklyProgress(new Date(2026,9,12));
  assert.equal(monday.xp,5); assert.equal(monday.daysUntilReset,7);
  assert.equal(monday.resetsAt.getDate(),19);
  assert.equal(api.stats().xpTotal,150);
});
test('calendar resets survive year boundaries and daylight-saving transitions',async()=>{
  const api=await store({'2025-12-29':20,'2026-01-01':10});
  const jan=api.weeklyProgress(new Date(2026,0,1,16));
  assert.equal(jan.xp,30); assert.equal(jan.resetsAt.getDate(),5);
  for(const day of [new Date(2026,2,8,0),new Date(2026,10,1,0)]) {
    const week=api.weeklyProgress(day);
    assert.equal(week.daysUntilReset,1); assert.equal(week.resetsAt.getHours(),0); assert.equal(week.resetsAt.getDay(),1);
  }
  const empty=await store({}); assert.equal(empty.weeklyProgress(new Date(2026,9,7)).xp,0);
});
const entry=(rank,isYou=false)=>({rank,nickname:`Learner ${rank}`,avatar:'sprout',xp:100-rank,isYou});
const you={avatar:'sunny',xp:30};
test('current user outside the top five is pinned with supplied rank and real local XP/avatar',()=>{
  const source={entries:[entry(5),entry(2),entry(1),entry(4),entry(3),entry(6,true)],yourRank:6};
  const rows=leaderboardRows(source,you);
  assert.deepEqual(rows.top.map(row=>row.rank),[1,2,3,4,5]);
  assert.deepEqual(rows.pinned,{nickname:'You',...you,rank:6,isYou:true});
  assert.equal(source.entries[0].rank,5,'Input is not mutated');
});
test('current user in top list is shown once and stale snapshot XP/avatar are replaced',()=>{
  const rows=leaderboardRows({entries:[entry(1),entry(2,true),entry(3)],yourRank:2},you);
  assert.equal(rows.pinned,null);
  assert.deepEqual(rows.top[1],{nickname:'You',...you,rank:2,isYou:true});
});
test('missing rankings never fabricate a rank or hide the current user',()=>{
  const rows=leaderboardRows({entries:[],yourRank:null},you);
  assert.deepEqual(rows.top,[]); assert.equal(rows.pinned.rank,null); assert.equal(rows.pinned.xp,30);
  assert.equal(leaderboardRows({entries:[entry(1)],yourRank:42},you).pinned.rank,42);
});
