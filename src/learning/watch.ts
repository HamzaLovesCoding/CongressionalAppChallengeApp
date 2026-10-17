// Turns what a <video> actually played into watch facts. Pure, so it can be unit-tested.

export type Range = [start: number, end: number];

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).map(([a, b]): Range => [a, b]).sort((x, y) => x[0] - y[0]);
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function coverage(ranges: Range[], start: number, end: number) {
  if (!(end > start)) return 0;
  const covered = mergeRanges(ranges).reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, end) - Math.max(a, start)), 0);
  return Math.min(1, covered / (end - start));
}

// A key segment counts as seen once 90% of it has played.
export const KEY_SEGMENT_SEEN = 0.9;

// Without supplied timings, the whole clip is treated as the key part. This is a stated policy,
// not a claim about where the rule appears in the video.
export function watchSummary(ranges: Range[], duration: number, keySegment?: { start: number; end: number }) {
  if (!(duration > 0)) return { watchedRatio: 0, keySegmentSeen: false };
  const segment = keySegment && keySegment.end > keySegment.start ? { start: Math.max(0, keySegment.start), end: Math.min(duration, keySegment.end) } : { start: 0, end: duration };
  return { watchedRatio: coverage(ranges, 0, duration), keySegmentSeen: coverage(ranges, segment.start, segment.end) >= KEY_SEGMENT_SEEN };
}

export function rangesFrom(played: TimeRanges): Range[] {
  return Array.from({ length: played.length }, (_, index): Range => [played.start(index), played.end(index)]);
}
