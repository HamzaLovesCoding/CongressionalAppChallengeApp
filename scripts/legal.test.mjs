import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRIVACY, TERMS } from '../src/legal/documents.ts';
import { VIDEO_CREDITS, OPEN_SOURCE } from '../src/legal/credits.ts';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';

const text = doc => doc.sections.flatMap(section => section.body).join(' ');
const privacy = text(PRIVACY), terms = text(TERMS);
const sync = readFileSync(new URL('../src/data/sync.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('the privacy policy names every category the sync payload sends', () => {
  const sent = { profile: /selected car/, activeDays: /days you practiced/, settings: /permit test date, daily goal/, lessons: /lesson progress and video watch coverage/, attempts: /quiz answers and timing/, simulations: /practice scenario results/, topics: /topic records/, review: /Review later list/ };
  for (const [field, phrase] of Object.entries(sent)) {
    assert.match(sync, new RegExp(`\\n    ${field}:`), `payload still sends ${field}`);
    assert.match(privacy, phrase, `policy mentions ${field}`);
  }
  assert.match(privacy, /Likes, saves and car purchases are not sent/);
  assert.doesNotMatch(sync, /\n    (liked|saved|spentXp|ownedCars|xp):/, 'payload leaves out what the policy says is not sent');
});

test('no compliance, encryption or absolute-security claims, and the supplied owner facts appear in both policies', () => {
  for (const words of [privacy, terms]) {
    assert.doesNotMatch(words, /COPPA|FERPA|CCPA|CPRA|GDPR|fully compliant|encrypted|never shared|100% secure|guarantee(?!.*not)/i);
  }
  assert.match(privacy, /No system is perfectly secure/);
  for (const doc of [PRIVACY, TERMS]) {
    assert.equal(doc.effective, 'October 18, 2026');
    assert.equal(doc.version, '1.1', 'version 1.1 added the driver coach');
    assert.ok(text(doc).includes('Hamza Wadera'));
    assert.ok(text(doc).includes('hamza.w.3790@gmail.com'));
    assert.doesNotMatch(JSON.stringify(doc), /legal operator name to be added|Contact details will be added|0\.1 \(draft\)/);
  }
  assert.match(terms, /Never use Lane while driving/);
  assert.match(terms, /not affiliated with or endorsed by the California DMV/);
});

test('the policies describe what the driver coach sends, keeps and whom it reaches', () => {
  const coachState = readFileSync(new URL('../src/coach/state.ts', import.meta.url), 'utf8');
  const fn = readFileSync(new URL('../supabase/functions/coach/handler.ts', import.meta.url), 'utf8');
  const sql = readFileSync(new URL('../supabase/migrations/20261022000000_lane_driver_coach.sql', import.meta.url), 'utf8');
  // What goes up: the question plus earlier questions and answers, nothing from the progress store.
  assert.match(sync, /client\.invoke\(current, 'coach', \{ messages \}, signal\)/);
  assert.doesNotMatch(coachState, /feed\/progress|localStorage|sessionStorage/, 'the chat is kept in memory only');
  assert.match(privacy, /sends your question, along with the last few questions and answers from the same chat, through Lane’s server to Anthropic/);
  assert.match(privacy, /one-way code made from your anonymous account/);
  assert.match(fn, /SHA-256/, 'Anthropic gets a hash, as the policy says');
  assert.match(privacy, /Lane doesn’t store your questions or the coach’s answers/);
  assert.doesNotMatch(sql, /question text|answer text|body text/i);
  const table = sql.match(/create table public\.coach_usage \(([\s\S]*?)\n\);/)[1];
  assert.deepEqual([...table.matchAll(/^\s+(\w+) (?:uuid|date|integer)/gm)].map(([, column]) => column), ['user_id', 'day', 'questions'], 'the table holds counts only');
  assert.match(privacy, /deletes those counts after a week/);
  assert.match(sql, /delete from public\.coach_usage where day < today - 7/);
  assert.match(fn, /console\.log\(JSON\.stringify\(\{ coach: 'answered', stop: state\.stop, \.\.\.state\.usage \}\)\)/, 'logs hold token counts, not text');
  assert.match(terms, /The driver coach is an AI tool/);
  assert.match(terms, /can’t tell you that you’re ready to drive or will pass a test/);
});

test('credits cover every lesson video with its recorded source, and nothing is invented', () => {
  assert.equal(VIDEO_CREDITS.length, VIDEO_LESSONS.length);
  for (const credit of VIDEO_CREDITS) {
    const lesson = VIDEO_LESSONS.find(item => item.id === credit.lessonId);
    assert.equal(credit.sourceUrl, lesson.lesson.credit.url);
    assert.match(credit.sourceUrl, /^https:\/\/www\.youtube\.com\//);
    assert.equal(credit.creator, lesson.lesson.credit.creator);
    assert.ok(['Trubicars', 'CRUDE Ultimate Driving Education'].includes(credit.creator), `${credit.lessonId} creator is a recorded channel`);
    assert.equal(credit.licenseVariant, 'CC BY 3.0');
  }
});

test('open-source notices match what the app actually ships', () => {
  const babylon = OPEN_SOURCE.find(item => item.name.includes('@babylonjs/core'));
  assert.equal(babylon.version, pkg.dependencies['@babylonjs/core']);
  assert.deepEqual(Object.keys(pkg.dependencies), ['@babylonjs/core'], 'add a notice when a runtime dependency is added');
});
