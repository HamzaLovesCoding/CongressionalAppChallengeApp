// Builds supabase/functions/coach/handbook.ts, the driver coach's copy of the California Driver's Handbook.
//   node scripts/extract-handbook.mjs path/to/DL-600X.pdf
// macOS only: it reads the PDF's text with PDFKit through osascript (no other PDF tool is installed here).
// Written for the DMV's "California Quick Reference Driver's Handbook" (DL 600X, 2025; 68 PDF pages).
// That copy's heading font and ligatures extract as garbage ("Traffic Con(ro)", "tra!c"), and its
// pictures carry meaning text can't, so every repair below is an explicit replacement checked against
// the page images. The script stops on anything it doesn't recognize rather than guessing; a different
// edition needs these tables redone.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const pdf = process.argv[2];
if (!pdf) { console.error('Usage: node scripts/extract-handbook.mjs path/to/DL-600X.pdf'); process.exit(1); }

// Each line with the point size and position of its first character. Size is the only structure the
// copy keeps (every font reports as Helvetica): 12.0 and 11.8 are body text, 14.0 is a bullet glyph,
// other sizes are headings, captions, picture lettering and the page number. Position tells a list
// item's wrapped lines (indented) from the paragraph after the list, and paragraphs apart (taller gap).
const jxa = `ObjC.import('PDFKit'); ObjC.import('AppKit');
function run(argv) {
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]));
  const out = [];
  for (let i = 0; i < doc.pageCount; i++) {
    const page = doc.pageAtIndex(i), text = page.attributedString;
    if (!text) continue;
    let start = 0;
    for (const line of text.string.js.split('\\n')) {
      const lead = line.search(/\\S/);
      if (lead >= 0) {
        const font = text.attributeAtIndexEffectiveRange($.NSFontAttributeName, start + lead, null);
        const box = page.selectionForRange($.NSMakeRange(start + lead, 1)).boundsForPage(page);
        const round = n => Math.round(n * 10) / 10;
        out.push([i + 1, font && !font.isNil() ? round(font.pointSize) : null, round(box.origin.x), round(box.origin.y), line]);
      }
      start += line.length + 1;
    }
  }
  return JSON.stringify(out);
}`;
const rows = JSON.parse(execFileSync('osascript', ['-l', 'JavaScript', '-e', jxa, pdf], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString());

// PDF pages 5–65 are the handbook's printed pages 1–61. The cover, letter, copyright page, contents
// and the closing DMV adverts are left out; the copyright notice is credited in the app instead.
const FIRST = 5, LAST = 65;
const BODY = new Set([12, 11.8]);
const BULLET_SIZE = 14;
const HEADING_SIZE = 14.6;
const CAPTION_SIZE = 10;
const TABLE_SIZE = 8.3;
const PAGE_NUMBER_SIZE = 11.4;
const PARAGRAPH_GAP = 15.5; // lines advance 13.5 pt; a new paragraph adds about 3 pt

// The heading font's text layer maps letters to punctuation differently in each heading.
const HEADINGS = new Map([
  ['Signals, Horns, And Headligh,s', 'Signals, Horns, And Headlights'],
  ['Law Enforc()(nt Stop,', 'Law Enforcement Stops'],
  ['Traffic Con(ro)', 'Traffic Control'],
  ['Right-of-Wa( R)le,: Who Goe, Fi-,t?', 'Right-of-Way Rules: Who Goes First?'],
  ['Sharing th( R)ad', 'Sharing the Road'],
  ['Other Import()t Ro(dw(, I)-orm(t.o)', 'Other Important Roadway Information'],
  ['Be Aware of Your Surrou()i(g,', 'Be Aware of Your Surroundings'],
  ['Understand t(e R)ad C)nditi)ns', 'Understand the Road Conditions'],
  ['Protect Yourse() an, Your Passen-ers', 'Protect Yourself and Your Passengers'],
  ['Manage Your S(ee)', 'Manage Your Speed'],
  ['Choose Be,-een Ha.ar)s', 'Choose Between Hazards'],
  ['Know How to Handl( E)(rg(n,-(.', 'Know How to Handle Emergencies'],
  ['Do Not Drive Distr()ted', 'Do Not Drive Distracted'],
  ['Cell P,o-es (-d Te.ti-/', 'Cell Phones and Texting'],
  ['Mi-ors (-d Cell P,o-es', 'Minors and Cell Phones'],
  ['Be A0(re o1 C(r2o- Mo-o.ide', 'Be Aware of Carbon Monoxide'],
  // One heading on two lines: "… Cannabis" / "Products in a Vehicle".
  ['Use or Possession of A()oho( or Canna,is', 'Use or Possession of Alcohol or Cannabis'],
  ['Pro-.)/s in a Vehi)(e', 'Products in a Vehicle'],
  ['Blood Alcohol Concen()a(ion (BAC) Li,i(-', 'Blood Alcohol Concentration (BAC) Limits'],
  ['DUI Conv()t(ons', 'DUI Convictions'],
  ['Dr(vers Under 21', 'Drivers Under 21'],
  ['Insurance Re(u)rements', 'Insurance Requirements'],
  ['C,--)s),ns', 'Collisions'],
  ['Collisions on Your Dri()r’s R)cord', 'Collisions on Your Driver’s Record'],
]);
// Headings in that font that extracted correctly.
const CLEAN_HEADINGS = new Set(['Card Designations', 'Traffic Lanes', 'Turns', 'Merging And Exiting', 'Passing', 'Parking', 'DUI Arrests']);

// Ligatures in the body text: "!" (a few times "$") stands for ff, fi, fl or ffi.
const LIGATURES = {
  'di!erent': 'different', '!rst': 'first', '!nd': 'find', 'con!rm': 'confirm', 'a!ect': 'affect', '!ve': 'five',
  '!ashers': 'flashers', 'tra!c': 'traffic', 'o!': 'off', 'o!ces': 'offices', 'o!cer': 'officer', 'o!cers': 'officers',
  'speci!c': 'specific', '!nish': 'finish', 'di!erence': 'difference', '!ashing': 'flashing', '!ash': 'flash',
  '!ashes': 'flashes', '!agman': 'flagman', '!ned': 'fined', '!ne': 'fine', '!nancial': 'financial',
  'noti!cation': 'notification', 'di!culty': 'difficulty', '!oor': 'floor', '!ooding': 'flooding', '!ood': 'flood',
  're!ect': 'reflect', '!ow': 'flow', 'in!uence': 'influence', 'Certi!cate': 'Certificate', 'di!cult': 'difficult',
  'o$cer': 'officer', 'o$': 'off', '$ashers': 'flashers', '$ashing': 'flashing',
};
const UNICODE_LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };

// QR-code captions (the coach can't open the pages they point to) and picture lettering.
const DROP = new Set([
  'Scan the QR Code for more detailed information on', 'An Introduction to Driving',
  'Scan the QR code for more information on Pedestrians,', 'which is located under Traffic Control.',
  'Scan the QR code for more information on Bicycles,', 'which is located under Sharing the Road.',
  'R R', 'Downhill Uphill No Curb',
]);

// Pictures whose labels mean nothing as bare text, described from the page images ("Pictured: …").
const LINES = new Map([
  ['Right Wrong', 'Pictured: Right: the car leaves wide space as it passes the bicyclist. Wrong: the car passes close beside the bicyclist.'],
  ['Left Turn Right Turn Slow or Stop', 'Pictured: Left Turn: the driver’s left arm held straight out. Right Turn: the left arm bent up at the elbow. Slow or Stop: the left arm bent down at the elbow.'],
]);
// Printed pages 28 and 29 are sign charts: pictures with short captions. Page 31's two numbered lists
// extracted with their numbers bunched up ("1. 2. 3. …") beside a picture. '' is a blank line.
const PAGES = new Map([
  ['28', [
    'Red and White Regulatory Signs', '',
    'Pictured: No U-Turn, No Left Turn and No Right Turn signs: a black arrow inside a red circle with a red line through it.', '',
    'White Regulatory Signs', '',
    'Pictured: TWO WAY TRAFFIC AHEAD; NO PARKING ANY TIME; YIELD TO UPHILL TRAFFIC; ONE WAY with an arrow; EMERGENCY PARKING ONLY; NO TURNS; LEFT TURN YIELD ON GREEN with a green circle; DO NOT PASS; a black ONE WAY arrow sign; a left-turn arrow marked ONLY; a turn arrow sign; DO NOT BLOCK INTERSECTION; SLOWER TRAFFIC KEEP RIGHT; KEEP RIGHT with an arrow; 3 TRACKS.', '',
    'Highway Construction and Maintenance Signs', '',
    'Pictured: orange diamond signs: THRU TRAFFIC MERGE LEFT; ROAD CLOSED AHEAD; ROAD MACHINERY AHEAD; a flagger with a flag; SHOULDER WORK AHEAD.', '',
    'Guide Signs', '',
    'Pictured: a green airport sign, a brown recreation sign and a blue REST AREA 1 MILE sign.', '',
    'Hazardous Loads Placards', '',
    'Pictured: diamond placards marked FLAMMABLE, RADIOACTIVE, EXPLOSIVES and a numbered poison placard.', '',
    'Slow Moving Vehicle', '',
    'Pictured: an orange triangle with a red border.',
  ]],
  ['29', [
    'Warning Signs', '',
    'Pictured: yellow diamond warning signs: Slippery When Wet; Merging Traffic; Divided Highway; Two Way Traffic; Lane Ends; End Divided Highway; Traffic Signal Ahead; Pedestrian Crossing; Added Lane; Crossroad; Stop Ahead; Yield Ahead; Curve; T Intersection; Winding Road; and a rectangular Directional Arrow sign.', '',
    'For more information, visit dot.ca.gov.',
  ]],
  ['31', [
    'Roundabouts', '',
    'In a roundabout, traffic travels in one direction around a central island.',
    'How to use a roundabout:',
    '1. Slow down as you approach.',
    '2. Yield to all traffic already in the roundabout.',
    '3. Enter heading to the right when there is a big enough gap in traffic to merge safely.',
    '4. Watch for signs and lane markings that guide you.',
    '5. Travel in a counterclockwise direction. Do not stop or pass.',
    '6. Signal when you change lanes or exit.',
    '7. If you miss your exit, continue around until you return to your exit.',
    'If the roundabout has multiple lanes, choose your entry or exit lane based on your destination. This is shown in the image below. To:', '',
    'Roundabout Examples', '',
    'Pictured: three two-lane roundabouts labeled Right Turn, Straight and Left Turn.', '',
    '1. Turn right (yellow car): Choose the right lane and exit in the right lane.',
    '2. Go straight (red car): Choose either lane. Exit in the lane you entered.',
    '3. Turn left: Enter and continue driving until you reach the exit in the direction you choose (blue car).',
  ]],
]);

// The BAC table (printed page 56) carries its meaning in cell colors, which text extraction loses.
const BAC_TABLE = [
  'Blood alcohol concentration (BAC) table for Male (M) / Female (F). Columns are body weight in pounds: 100, 120, 140, 160, 180, 200, 220, 240.',
  '0 drinks: M .00 .00 .00 .00 .00 .00 .00 .00; F .00 .00 .00 .00 .00 .00 .00 .00.',
  '1 drink: M .06 .05 .04 .04 .03 .03 .03 .02; F .07 .06 .05 .04 .04 .03 .03 .03.',
  '2 drinks: M .12 .10 .09 .07 .07 .06 .05 .05; F .13 .11 .09 .08 .07 .07 .06 .06.',
  '3 drinks: M .18 .15 .13 .11 .10 .09 .08 .07; F .20 .17 .14 .12 .11 .10 .09 .08.',
  '4 drinks: M .24 .20 .17 .15 .13 .12 .11 .10; F .26 .22 .19 .17 .15 .13 .12 .11.',
  '5 drinks: M .30 .25 .21 .19 .17 .15 .14 .12; F .33 .28 .24 .21 .18 .17 .15 .14.',
  'The table colors each value by driving condition: .00 is the Only Safe Driving Limit; .01 to .07 is Driving Skills Impaired; .08 and above is Legally Intoxicated.',
  'Subtract 0.01% for each 40 minutes that lapse between drinks. 1 drink = 1.5 oz. 80 proof liquor, 12 oz. 5% beer, or 5 oz. 12% wine. Fewer than 5 persons out of 100 will exceed these values.',
].join('\n');

// Numbered lists whose numbers extracted bunched together ("1. 2. …"), and a note's misplaced period.
const FIXES = new Map([
  ['14', [
    ['1. 2. Left turn from a two-way street.', '1. Left turn from a two-way street.'],
    ['vehicle’s direction. Right turn. Begin', 'vehicle’s direction.\n2. Right turn. Begin'],
  ]],
  ['19', [
    ['1. 2. Traffic check.', '1. Traffic check.'],
    ['blind spots. Signal. Activate', 'blind spots.\n2. Signal. Activate'],
  ]],
  ['49', [
    ['1. 2. 3. 4. Shift into a low gear and keep the front wheels straight. Gently', '1. Shift into a low gear and keep the front wheels straight.\n2. Gently'],
    ['Avoid spinning the wheels. Drive slowly', 'Avoid spinning the wheels.\n3. Drive slowly'],
    ['forward as far as possible. Shift into reverse', 'forward as far as possible.\n4. Shift into reverse'],
    ['5. 6. 7. Shift into a low gear again and drive forward. Repeat', '5. Shift into a low gear again and drive forward.\n6. Repeat'],
    ['until the vehicle rolls free. In deep mud', 'until the vehicle rolls free.\n7. In deep mud'],
  ]],
  ['53', [
    ['1. 2. Safely pull over to the right shoulder. Exit', '1. Safely pull over to the right shoulder.\n2. Exit'],
    ['3. 4. Dial 511 from your cell phone or locate a call box for assistance. Return', '3. Dial 511 from your cell phone or locate a call box for assistance.\n4. Return'],
    ['5. 6. Stay inside your vehicle with your seat belt on until help arrives. Use', '5. Stay inside your vehicle with your seat belt on until help arrives.\n6. Use'],
  ]],
  ['56', [['. NOTE It is illegal', 'NOTE: It is illegal']]],
]);

const problems = [];
function repair(line, page) {
  let text = line.replace(/\u0000/g, '').replace(/[ﬀﬁﬂﬃﬄ]/g, c => UNICODE_LIGATURES[c]);
  text = text.replace(/\.!(?=[A-Z])/g, '. '); // a stray glyph between two sentences (printed page 54)
  return text.replace(/[\p{L}’!$]*[!$][\p{L}’!$]*/gu, token => {
    if (token === '$') return token; // a dollar amount
    const [, word, tail] = token.match(/^(.*?)((?:’s)?)$/u);
    if (LIGATURES[word]) return LIGATURES[word] + tail;
    problems.push(`page ${page}: unknown ligature token "${token}"`);
    return token;
  });
}

const pages = [];
for (const [pdfPage, size, x, y, raw] of rows) {
  if (pdfPage < FIRST || pdfPage > LAST) continue;
  if (pages.at(-1)?.pdfPage !== pdfPage) pages.push({ pdfPage, label: null, lines: [] });
  pages.at(-1).lines.push({ size, x, y, line: raw.trim() });
}
for (const page of pages) {
  const numbers = page.lines.filter(line => line.size === PAGE_NUMBER_SIZE && /^\d+$/.test(line.line));
  if (numbers.length !== 1) problems.push(`PDF page ${page.pdfPage}: expected one page number, found ${numbers.length}`);
  page.label = numbers[0]?.line ?? '?';
  page.lines = page.lines.filter(line => !numbers.includes(line));
}

const continues = text => /^[\p{Ll}(]/u.test(text);
const join = (a, b) => a.endsWith('-') || a.endsWith('/') ? a + b : `${a} ${b}`;

function pageText(page) {
  if (PAGES.has(page.label)) return PAGES.get(page.label).join('\n');
  const margin = Math.min(...page.lines.filter(line => BODY.has(line.size)).map(line => line.x));
  // Segments: headings, picture captions, paragraphs, list items, and the BAC table. Captions sit
  // beside the text, so body lines continue across them.
  const segments = [];
  let previous = null, lastBody = null, inTable = false;
  for (const entry of page.lines) {
    const { size, x, y, line } = entry;
    // Lettering inside diagrams and sign pictures ("45°", diagram numbers) is under 8 pt or a bare number.
    if (DROP.has(line) || (size < 8 && size !== TABLE_SIZE) || /^\d+$/.test(line)) continue;
    if (size === TABLE_SIZE) { if (!inTable) segments.push({ kind: 'block', text: BAC_TABLE }); inTable = true; continue; }
    let text = LINES.get(line) ?? line;
    if (size === HEADING_SIZE) {
      if (HEADINGS.has(line)) text = HEADINGS.get(line);
      else if (!CLEAN_HEADINGS.has(line)) problems.push(`printed page ${page.label}: unreviewed heading "${line}"`);
    }
    text = repair(text, page.label);
    const last = segments.at(-1);
    const textBefore = segments.findLast(segment => segment.kind === 'para' || segment.kind === 'item');
    const onlyCaptionsSince = textBefore && segments.slice(segments.indexOf(textBefore) + 1).every(segment => segment.kind === 'caption');
    if (size === CAPTION_SIZE) {
      const caption = segments.findLast(segment => segment.kind === 'caption');
      if (caption && continues(text)) caption.text = join(caption.text, text);
      else segments.push({ kind: 'caption', text });
    } else if (!BODY.has(size) && size !== BULLET_SIZE) {
      // A heading set on two lines.
      if (last?.kind === 'heading' && last.size === size && previous?.size === size && size >= 13.7) last.text = join(last.text, text);
      else segments.push({ kind: 'heading', size, text });
    } else if (/^(•|—|\d+\.\s)/.test(text)) {
      segments.push({ kind: 'item', text });
    } else if (onlyCaptionsSince && (
      (continues(text) && previous?.size === CAPTION_SIZE) // a sentence a caption interrupted
      || x > margin + 3 // a list item's wrapped line
      || (textBefore.kind === 'para' && lastBody && lastBody.y - y > 0 && lastBody.y - y <= PARAGRAPH_GAP))) {
      textBefore.text = join(textBefore.text, text);
    } else {
      segments.push({ kind: 'para', text });
    }
    previous = entry;
    if (BODY.has(size) || size === BULLET_SIZE) lastBody = entry;
  }
  let text = '';
  const standalone = segment => segment.kind === 'heading' || segment.kind === 'caption' || segment.kind === 'block';
  for (const [i, segment] of segments.entries()) {
    if (i) text += standalone(segment) || standalone(segments[i - 1]) ? '\n\n' : '\n';
    text += segment.text;
  }
  for (const [from, to] of FIXES.get(page.label) ?? []) {
    if (text.split(from).length !== 2) problems.push(`printed page ${page.label}: fix "${from}" did not match exactly once`);
    text = text.replace(from, () => to);
  }
  return text.replace(/[ \t]+/g, ' ');
}

let handbook = '';
const offsets = [];
for (const page of pages) {
  if (handbook) handbook += '\n\n';
  offsets.push([handbook.length, page.label]);
  handbook += pageText(page);
}

const leftovers = handbook.replaceAll('(s)', '').match(/[\p{L}][(),][\p{L}]|\(\)|[!$](?=\p{L})|\p{L}\$|\d\. \d\. |\u0000/gu);
if (leftovers) problems.push(`garbled text remains: ${[...new Set(leftovers)].join(' ')}`);
if (pages.length !== LAST - FIRST + 1 || pages[0].label !== '1' || pages.at(-1).label !== '61') problems.push('unexpected page range');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const out = new URL('../supabase/functions/coach/handbook.ts', import.meta.url);
writeFileSync(out, `// Generated by scripts/extract-handbook.mjs. Do not edit by hand: fix the extractor and run it again.
// California Driver’s Handbook, California Department of Motor Vehicles, licensed under CC BY-NC 4.0
// (Quick Reference, DL 600X, 2025). Lane extracted the text of printed pages 1–61, repaired heading,
// list-number and ligature encoding errors, left out QR-code captions, described the hand-signal,
// sign-chart and bicyclist-passing pictures ("Pictured: …") and wrote out the BAC table on page 56 in
// words; the wording is otherwise the handbook's.

export const HANDBOOK_TITLE = 'California Driver’s Handbook (Quick Reference, DL 600X, 2025)';

export const HANDBOOK_TEXT = ${JSON.stringify(handbook)};

// [character offset where a printed page starts in HANDBOOK_TEXT, printed page number], in order.
export const HANDBOOK_PAGES: readonly (readonly [number, string])[] = ${JSON.stringify(offsets)};
`);
console.log(`Wrote ${out.pathname}: ${pages.length} pages, ${handbook.length} characters.`);
