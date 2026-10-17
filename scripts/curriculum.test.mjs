import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';

// Top-level MP4 boxes, plus whether the video track is H.264 ('avc1' sample entry inside moov).
function mp4(path) {
  const fd = openSync(path, 'r'), boxes = [], header = Buffer.alloc(16);
  let offset = 0, avc = false;
  try {
    while (readSync(fd, header, 0, 16, offset) >= 8) {
      const size = header.readUInt32BE(0) === 1 ? Number(header.readBigUInt64BE(8)) : header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      boxes.push(type);
      if (type === 'moov') { const moov = Buffer.alloc(size); readSync(fd, moov, 0, size, offset); avc = moov.includes('avc1'); }
      if (size < 8) break;
      offset += size;
    }
  } finally { closeSync(fd); }
  return { boxes, avc };
}

test('all 19 curriculum clips are present, in order, with unique ids and a local file', () => {
  assert.equal(VIDEO_LESSONS.length, 19);
  assert.equal(new Set(VIDEO_LESSONS.map(lesson => lesson.id)).size, 19);
  assert.equal(VIDEO_LESSONS[0].id, 'lane-end-scan');
  assert.equal(VIDEO_LESSONS[18].id, 'three-second-check');
  for (const lesson of VIDEO_LESSONS) {
    assert.equal(lesson.video, `videos/${lesson.id}.mp4`);
    assert.ok(existsSync(new URL(`../public/${lesson.video}`, import.meta.url)), `${lesson.id} has a video file`);
  }
});

test('every clip plays on iPhones, starts before it finishes downloading and has a poster', () => {
  for (const lesson of VIDEO_LESSONS) {
    const { boxes, avc } = mp4(new URL(`../public/${lesson.video}`, import.meta.url));
    // VP9 and AV1 in MP4 don't play on most iPhones; re-encode with scripts/encode-videos.sh.
    assert.ok(avc, `${lesson.id} is H.264`);
    assert.ok(boxes.indexOf('moov') < boxes.indexOf('mdat'), `${lesson.id} is faststart (moov before mdat)`);
    assert.ok(existsSync(new URL(`../public/images/lessons/posters/${lesson.id}.jpg`, import.meta.url)), `${lesson.id} has a poster`);
  }
});

test('every quick check has a valid answer, a handbook citation and stays a draft until approved', () => {
  for (const lesson of VIDEO_LESSONS) {
    assert.ok(lesson.options.length >= 2, lesson.id);
    assert.ok(Number.isInteger(lesson.answer) && lesson.answer >= 0 && lesson.answer < lesson.options.length, `${lesson.id} answer index`);
    assert.match(lesson.source, /Handbook \(DL 600X, 2025\)/, `${lesson.id} cites the handbook`);
    assert.equal(lesson.draft, true, `${lesson.id} is draft`);
  }
});

test('every clip shows a California rule and credits its source video', () => {
  for (const { id, lesson } of VIDEO_LESSONS) {
    assert.ok(lesson.californiaRule.length > 40, `${id} has a California rule`);
    assert.match(lesson.credit.url, /^https:\/\/www\.youtube\.com\/shorts\/[\w-]{11}$/, `${id} credit URL`);
    assert.ok(lesson.handbook && lesson.local && lesson.summary && lesson.category, `${id} has lesson context`);
  }
  // Clips filmed in left-hand traffic must say so on screen.
  for (const id of ['emergency-right-edge', 'blind-curve', 'blind-bend']) {
    assert.match(VIDEO_LESSONS.find(lesson => lesson.id === id).lesson.californiaRule, /left-hand traffic|drives on the left/, id);
  }
});
