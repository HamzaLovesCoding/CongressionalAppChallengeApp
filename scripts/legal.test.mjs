import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRIVACY, TERMS, OWNER_PLACEHOLDER } from '../src/legal/documents.ts';
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

test('no compliance, encryption or absolute-security claims, and owner facts stay visible placeholders', () => {
  for (const words of [privacy, terms]) {
    assert.doesNotMatch(words, /COPPA|FERPA|CCPA|CPRA|GDPR|fully compliant|encrypted|never shared|100% secure|guarantee(?!.*not)/i);
  }
  assert.match(privacy, /No system is perfectly secure/);
  for (const doc of [PRIVACY, TERMS]) {
    assert.equal(doc.effective, null, 'effective date is set by the owner, not invented');
    assert.match(JSON.stringify(doc), new RegExp(OWNER_PLACEHOLDER.contact.replace(/[.()]/g, '\\$&')));
  }
  assert.match(terms, /Never use Lane while driving/);
  assert.match(terms, /not affiliated with or endorsed by the California DMV/);
});

test('credits cover every lesson video with its recorded source, and nothing is invented', () => {
  assert.equal(VIDEO_CREDITS.length, VIDEO_LESSONS.length);
  for (const credit of VIDEO_CREDITS) {
    const lesson = VIDEO_LESSONS.find(item => item.id === credit.lessonId);
    assert.equal(credit.sourceUrl, lesson.lesson.credit.url);
    assert.match(credit.sourceUrl, /^https:\/\/www\.youtube\.com\//);
    assert.equal(credit.creator, null, 'creator not yet recorded');
    assert.equal(credit.licenseVariant, null, 'license variant not yet recorded');
  }
});

test('open-source notices match what the app actually ships', () => {
  const babylon = OPEN_SOURCE.find(item => item.name.includes('@babylonjs/core'));
  assert.equal(babylon.version, pkg.dependencies['@babylonjs/core']);
  assert.deepEqual(Object.keys(pkg.dependencies), ['@babylonjs/core'], 'add a notice when a runtime dependency is added');
});
