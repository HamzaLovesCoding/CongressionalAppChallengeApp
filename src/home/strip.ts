import { SETTLE, animateSpring, nearest, project, rubberband, velocityOf, type SpringState } from './spring';

/**
 * The lesson strip scrolls natively, so touch gets the platform's own momentum, snapping and edge
 * bounce. A mouse can't swipe, so mouse drags get the same physics by hand: 1:1 tracking from the grab
 * point, a throw projected to the nearest card, and resistance past either end.
 */
export function lessonStrip(track: HTMLElement, startIndex: number) {
  const items = [...track.querySelectorAll<HTMLElement>('.home-strip-item')];
  const max = () => track.scrollWidth - track.clientWidth;
  const snaps = () => {
    const padding = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    return items.map(item => Math.min(max(), Math.max(0, item.offsetLeft - padding)));
  };
  // Position may run past either end while dragging; the excess is drawn as rubber-band offset.
  let position = 0, suppressClick = false;
  let motion: { stop(): SpringState } | null = null;
  let drag: { id: number; startX: number; from: number; samples: { t: number; v: number }[]; active: boolean } | null = null;
  const render = (value: number) => {
    position = value;
    const clamped = Math.min(max(), Math.max(0, value));
    track.scrollLeft = clamped;
    track.style.transform = value === clamped ? '' : `translate3d(${-rubberband(value - clamped, track.clientWidth)}px,0,0)`;
  };
  const halt = () => { const state = motion?.stop() ?? { value: track.scrollLeft, velocity: 0 }; motion = null; return state; };

  track.scrollLeft = snaps()[Math.min(startIndex, items.length - 1)] ?? 0;

  const onPointerDown = (event: PointerEvent) => {
    suppressClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, startX: event.clientX, from: motion ? halt().value : track.scrollLeft, samples: [{ t: event.timeStamp, v: event.clientX }], active: false };
    listen(true);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = event.clientX - drag.startX;
    if (!drag.active) {
      if (Math.abs(moved) < 6) return;
      drag.active = true;
      track.setPointerCapture(event.pointerId);
      // Snapping would fight every programmatic scroll, so it's off until the strip comes to rest.
      track.style.scrollSnapType = 'none';
      track.classList.add('is-dragging');
    }
    drag.samples = [...drag.samples.slice(-7), { t: event.timeStamp, v: event.clientX }];
    render(drag.from - moved);
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { active, samples } = drag;
    drag = null;
    listen(false);
    if (!active) return;
    suppressClick = true;
    track.classList.remove('is-dragging');
    const velocity = event.type === 'pointercancel' ? 0 : -velocityOf([...samples, { t: event.timeStamp, v: event.clientX }]);
    const target = nearest(snaps(), position + project(velocity));
    const from = position;
    motion = animateSpring({ value: from, velocity }, target, SETTLE, render, () => {
      motion = null;
      track.style.scrollSnapType = '';
    });
  };
  // A drag that ends over a card must not also open it.
  const onClick = (event: MouseEvent) => { if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); } };

  function listen(on: boolean) {
    if (on) { addEventListener('pointermove', onPointerMove); addEventListener('pointerup', onPointerEnd); addEventListener('pointercancel', onPointerEnd); }
    else { removeEventListener('pointermove', onPointerMove); removeEventListener('pointerup', onPointerEnd); removeEventListener('pointercancel', onPointerEnd); }
  }
  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('click', onClick, true);
  return { dispose() { halt(); listen(false); } };
}
