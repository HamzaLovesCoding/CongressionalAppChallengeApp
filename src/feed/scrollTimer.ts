// Count visible time in this feed visit, including pauses and quiz answers.
export function createScrollTimer(start: number) {
  let last = start;
  let elapsed = 0;
  return {
    tick(now: number, visible: boolean) {
      if (visible) elapsed += Math.max(0, now - last);
      last = now;
      return Math.floor(elapsed / 1000);
    },
  };
}
