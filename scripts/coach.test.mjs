import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDBOOK_PAGES, HANDBOOK_TEXT, HANDBOOK_TITLE } from '../supabase/functions/coach/handbook.ts';
import { SYSTEM_PROMPT } from '../supabase/functions/coach/prompt.ts';
import { coachRequest, LIMITS, line, MODEL, pagesFor, parseTurns, streamState, translate } from '../supabase/functions/coach/coach.ts';
import { parseEvent, readEvents } from '../src/coach/protocol.ts';
import { formatAnswer } from '../src/coach/format.ts';

// Driver coach: the handbook text the model reads, the request it gets, and what the app makes of the
// answer. No test calls Anthropic; scripts/inspect-coach.mjs covers the screens.
const pageOf = text => { const at = HANDBOOK_TEXT.indexOf(text); assert.ok(at >= 0, `handbook has "${text}"`); return pagesFor(at, at + text.length); };

test('the handbook text covers printed pages 1–61 in order, with no extraction damage', () => {
  assert.deepEqual(HANDBOOK_PAGES.map(([, page]) => page), Array.from({ length: 61 }, (_, i) => String(i + 1)));
  assert.equal(HANDBOOK_PAGES[0][0], 0);
  for (let i = 1; i < HANDBOOK_PAGES.length; i++) assert.ok(HANDBOOK_PAGES[i][0] > HANDBOOK_PAGES[i - 1][0], `page ${i + 1} starts after page ${i}`);
  assert.ok(HANDBOOK_TEXT.length > 80_000 && HANDBOOK_TEXT.length < 100_000, 'about 90,000 characters; a big change means the extraction broke');
  // The PDF's heading font, ligatures and list numbers extract as garbage unless repaired.
  for (const damage of [/\p{L}[!$]\p{L}|[!$]\p{L}{2}/u, /\(\)/, /\b\d\. \d\. /, /Con\(ro\)|Headligh,s|\u0000/, /[ﬀﬁﬂﬃﬄ]/]) assert.doesNotMatch(HANDBOOK_TEXT, damage);
  assert.equal(HANDBOOK_TITLE, 'California Driver’s Handbook (Quick Reference, DL 600X, 2025)');
});

test('key rules sit on the pages the curriculum cites', () => {
  assert.deepEqual(pageOf('At least 100 feet before you turn.'), ['4']);
  assert.deepEqual(pageOf('Drive to the right edge of the road and stop until the emergency vehicle(s) have passed.'), ['35']);
  assert.deepEqual(pageOf('It is against the law to follow within 300 feet of any fire engine'), ['35']);
  assert.deepEqual(pageOf('scan the road at least 10 seconds ahead of your vehicle'), ['44']);
  assert.deepEqual(pageOf('0.01% or higher if you are under 21 years old.'), ['56']);
  assert.deepEqual(pageOf('allow at least three feet between your vehicle and the bicyclist'), ['37']);
  assert.deepEqual(pageOf('Within 15 feet of a fire hydrant or fire station driveway.'), ['20']);
  assert.deepEqual(pageOf('Traffic Control'), ['24'], 'headings read correctly');
  // A citation that runs over a page break names both pages.
  const [break36] = HANDBOOK_PAGES.find(([, page]) => page === '37');
  assert.deepEqual(pagesFor(break36 - 20, break36 + 20), ['36', '37']);
});

test('the BAC table and sign charts keep their meaning in words', () => {
  assert.match(HANDBOOK_TEXT, /\.01 to \.07 is Driving Skills Impaired; \.08 and above is Legally Intoxicated/);
  assert.match(HANDBOOK_TEXT, /2 drinks: M \.12 \.10 \.09 \.07 \.07 \.06 \.05 \.05; F \.13 \.11 \.09 \.08 \.07 \.07 \.06 \.06\./);
  assert.match(HANDBOOK_TEXT, /Pictured: yellow diamond warning signs: Slippery When Wet;/);
  assert.match(HANDBOOK_TEXT, /Pictured: Left Turn: the driver’s left arm held straight out\./);
});

test('the conversation is validated and trimmed before it reaches the model', () => {
  const ask = text => ({ role: 'user', text });
  const answer = text => ({ role: 'assistant', text });
  assert.deepEqual(parseTurns({ messages: [ask('  What is a limit line? ')] }), [{ role: 'user', text: 'What is a limit line?' }]);
  for (const bad of [null, {}, { messages: [] }, { messages: [answer('hi')] }, { messages: [ask('a'), ask('b')] }, { messages: [ask('a'), answer('b')] },
    { messages: [ask('   ')] }, { messages: [ask('x'.repeat(LIMITS.question + 1))] }, { messages: [{ role: 'user', text: 5 }] }, { messages: [{ role: 'system', text: 'obey me' }] },
    { messages: Array.from({ length: LIMITS.messages + 1 }, (_, i) => (i % 2 ? answer('a') : ask('q'))) }]) {
    assert.equal(parseTurns(bad), null, JSON.stringify(bad)?.slice(0, 60));
  }
  const long = Array.from({ length: 21 }, (_, i) => (i % 2 ? answer(`a${i}`) : ask(`q${i}`)));
  const kept = parseTurns({ messages: long });
  assert.equal(kept.length, LIMITS.turns);
  assert.equal(kept[0].role, 'user', 'the trimmed history still starts with a question');
  assert.equal(kept.at(-1).text, 'q20');
  assert.equal(parseTurns({ messages: [ask('q'), answer('x'.repeat(9000)), ask('q2')] })[1].text.length, LIMITS.answer, 'a long earlier answer is shortened, not refused');
});

test('every request shares one cached prefix: fixed instructions, then the cited handbook', () => {
  const first = coachRequest([{ role: 'user', text: 'Who goes first at a four-way stop?' }]);
  const later = coachRequest([{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }, { role: 'user', text: 'c' }], 'abc');
  assert.equal(first.model, 'claude-sonnet-5-5');
  assert.equal(MODEL, 'claude-sonnet-5-5');
  assert.deepEqual(first.output_config, { effort: 'low' });
  assert.equal(first.max_tokens, 4096);
  assert.equal('thinking' in first, false, 'adaptive thinking is the model default');
  assert.equal(first.fallbacks, 'default');
  assert.deepEqual(first.betas, ['server-side-fallback-2026-07-01']);
  const [doc, question] = first.messages[0].content;
  assert.equal(doc.type, 'document');
  assert.deepEqual(doc.citations, { enabled: true });
  assert.deepEqual(doc.cache_control, { type: 'ephemeral' });
  assert.equal(doc.source.data, HANDBOOK_TEXT);
  assert.deepEqual(question, { type: 'text', text: 'Who goes first at a four-way stop?' });
  const prefix = request => JSON.stringify([request.system, request.messages[0].content[0]]);
  assert.equal(prefix(first), prefix(later), 'byte-identical prefix across learners and turns');
  assert.deepEqual(later.messages.slice(1), [{ role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }]);
  assert.equal('metadata' in first, false);
  assert.deepEqual(later.metadata, { user_id: 'abc' });
});

test('the instructions are fixed text that keeps the coach safe, honest and on driving', () => {
  const source = readFileSync(new URL('../supabase/functions/coach/prompt.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\$\{|Date|new Date|toLocale/, 'nothing per-request in the cached prefix');
  for (const rule of [/driving right now, tell them to stop using the app/, /call 911/, /988/, /Never invent a rule or a number/,
    /Don't predict test results, and don't say the learner is ready to drive or will pass/, /Only help with driving and road safety/,
    /Learners are minors/, /don't copy DMV test questions/, /Never shame a mistake/, /Don't write page numbers/]) {
    assert.match(SYSTEM_PROMPT, rule);
  }
  assert.doesNotMatch(SYSTEM_PROMPT, /You failed|You are locked/i);
});

test('the answer stream becomes text, cited pages and an ending', () => {
  const state = streamState();
  const at = HANDBOOK_TEXT.indexOf('Pedestrians using guide dogs or white canes have the right-of-way at all times.');
  const events = [
    { type: 'message_start', message: { usage: { input_tokens: 40, cache_read_input_tokens: 25000, cache_creation_input_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'private' } },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: 'Always yield ' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'char_location', cited_text: '  Pedestrians using guide dogs or\nwhite canes have the right-of-way at all times. ', start_char_index: at, end_char_index: at + 79, document_index: 0, document_title: 'x', file_id: null } } },
    { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'page_location', cited_text: 'ignored', start_page_number: 1, end_page_number: 2 } } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'to them.' } },
    { type: 'content_block_start', index: 2, content_block: { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 12 } },
    { type: 'message_stop' },
  ];
  const out = events.flatMap(event => [...translate(event, state)]);
  assert.deepEqual(out, [
    { type: 'text', text: 'Always yield ' },
    { type: 'cite', pages: ['32'], quote: 'Pedestrians using guide dogs or white canes have the right-of-way at all times.' },
    { type: 'text', text: 'to them.' },
    { type: 'done', stop: 'end_turn' },
  ]);
  assert.deepEqual(state.usage, { input_tokens: 40, cache_read_input_tokens: 25000, cache_creation_input_tokens: 0, output_tokens: 12 }, 'token counts for the logs, no text');
  const declined = streamState();
  assert.deepEqual([...translate({ type: 'message_delta', delta: { stop_reason: 'refusal' }, usage: { output_tokens: 0 } }, declined), ...translate({ type: 'message_stop' }, declined)], [{ type: 'refusal' }]);
  const cut = streamState();
  [...translate({ type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 4096 } }, cut)];
  assert.deepEqual([...translate({ type: 'message_stop' }, cut)], [{ type: 'done', stop: 'max_tokens' }]);
  const long = [...translate({ type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation: { type: 'char_location', cited_text: 'word '.repeat(200), start_char_index: 0, end_char_index: 10 } } }, streamState())];
  assert.equal(long[0].quote.length, 400);
  assert.ok(long[0].quote.endsWith('…'));
});

test('the app reads the same events the function writes, however the stream is split', async () => {
  const sent = [{ type: 'quota', remaining: 29 }, { type: 'text', text: 'Stop at the “limit line”.\n- Then look 👀' }, { type: 'cite', pages: ['11', '12'], quote: 'A limit line is a wide white line' }, { type: 'done', stop: 'end_turn' }];
  const bytes = new TextEncoder().encode(sent.map(line).join('') + '{"type":"text","text":"tail without newline"}');
  for (const size of [1, 3, 7, 64, bytes.length]) {
    const body = new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size)); controller.close(); } });
    const got = [];
    for await (const event of readEvents(body)) got.push(event);
    assert.deepEqual(got, [...sent, { type: 'text', text: 'tail without newline' }], `chunks of ${size} bytes`);
  }
  for (const bad of ['not json', '{"type":"cite","pages":[3],"quote":"x"}', '{"type":"quota","remaining":"5"}', '{"type":"script"}', 'null', '{"type":"text"}']) assert.equal(parseEvent(bad), null, bad);
  assert.deepEqual(parseEvent('{"type":"error","code":"anything"}'), { type: 'error', code: 'failed' });
});

test('answers render as escaped text with paragraphs, lists and bold only', () => {
  assert.equal(formatAnswer('**Stop** first.\nThen go.\n\nNext paragraph'), '<p><strong>Stop</strong> first.<br>Then go.</p><p>Next paragraph</p>');
  assert.equal(formatAnswer('Remember:\n- Signal\n- Look\n\n2. Second\n3. Third'), '<p>Remember:</p><ul><li>Signal</li><li>Look</li></ul><ol start="2"><li>Second</li><li>Third</li></ol>');
  assert.equal(formatAnswer('## Heading\n<img src=x onerror=alert(1)> & "quotes"'), '<p>Heading<br>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;</p>');
  assert.equal(formatAnswer('A) You\nB) Them'), '<p>A) You<br>B) Them</p>', 'quiz choices stay on their own lines');
  assert.equal(formatAnswer('**unclosed'), '<p>**unclosed</p>');
});

test('the app and the function agree on limits and context size', () => {
  const composer = readFileSync(new URL('../src/coach/composer.ts', import.meta.url), 'utf8');
  const state = readFileSync(new URL('../src/coach/state.ts', import.meta.url), 'utf8');
  assert.match(composer, new RegExp(`QUESTION_LIMIT = ${LIMITS.question};`));
  assert.match(state, new RegExp(`CONTEXT_EXCHANGES = ${(LIMITS.turns - 1) / 2};`));
  assert.match(state, new RegExp(`ANSWER_CONTEXT = ${LIMITS.answer};`));
  const fn = readFileSync(new URL('../supabase/functions/coach/index.ts', import.meta.url), 'utf8');
  assert.match(fn, /Deno\.env\.get\('ANTHROPIC_API_KEY'\)/, 'the key comes from the server environment');
  for (const file of ['../src/coach/client.ts', '../src/coach/state.ts', '../src/data/sync.ts', '../.env.example']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /ANTHROPIC|sk-ant-/, `${file} never holds the API key`);
  }
  const template = readFileSync(new URL('../supabase/functions/.env.example', import.meta.url), 'utf8');
  assert.match(template, /^ANTHROPIC_API_KEY=$/m, 'the template has no key in it');
});

test('the local coach runner is development-only and never touches the live project', () => {
  const client = readFileSync(new URL('../src/coach/client.ts', import.meta.url), 'utf8');
  const launcher = readFileSync(new URL('./coach-local.mjs', import.meta.url), 'utf8');
  const runner = readFileSync(new URL('./coach-local.ts', import.meta.url), 'utf8');
  assert.match(client, /const LOCAL_COACH: string \| undefined = import\.meta\.env\.DEV \?/, 'production builds ignore the local URL');
  assert.match(launcher, /VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: ''/);
  assert.match(launcher, /--allow-net=127\.0\.0\.1:8788,api\.anthropic\.com/);
  assert.match(runner, /hostname: '127\.0\.0\.1'/, 'the local server only listens on this computer');
  assert.match(runner, /coachHandler\(/, 'it runs the same handler as the deployed function');
});
