import './sheet.css';
import { SETTLE, THROWN, animateSpring, project, rubberband, velocityOf, type SpringState } from './spring';

export type Sheet = { open(): void; close(): void; dispose(): void };

// iOS Safari paints the focus ring on whatever a sheet focuses as it opens, even after a tap. A tap therefore
// lands on the sheet's title, which shows no ring; a keyboard open lands on the close button, which does.
let keyboard = false;
addEventListener('keydown', () => { keyboard = true; }, { capture: true, passive: true });
addEventListener('pointerdown', () => { keyboard = false; }, { capture: true, passive: true });

const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

/** Markup for a Home bottom sheet; `body` is the sheet's own content. */
export const sheetMarkup = (className: string, titleId: string, title: string, closeLabel: string, body: string) =>
  `<dialog class="home-sheet ${className}" aria-labelledby="${titleId}"><div class="home-sheet-scrim"></div><div class="home-sheet-panel">
    <div class="home-sheet-grab" aria-hidden="true"></div>
    <div class="home-sheet-head"><h2 id="${titleId}" tabindex="-1">${title}</h2><button class="home-sheet-close" type="button" data-sheet-close aria-label="${closeLabel}">${closeIcon}</button></div>
    <div class="home-sheet-body">${body}</div>
  </div></dialog>`;

/**
 * A dialog that behaves like an iOS sheet: it rises on a spring, follows the finger 1:1 from where it
 * was grabbed, can be caught mid-flight, and on release lets the throw (not just the position) decide
 * whether it closes. Native <dialog> still provides focus trapping, Escape and focus return.
 */
export function bottomSheet(dialog: HTMLDialogElement): Sheet {
  const panel = dialog.querySelector<HTMLElement>('.home-sheet-panel')!;
  const scrim = dialog.querySelector<HTMLElement>('.home-sheet-scrim')!;
  const body = dialog.querySelector<HTMLElement>('.home-sheet-body')!;
  const title = dialog.querySelector<HTMLElement>('.home-sheet-head h2')!;
  const closeButton = dialog.querySelector<HTMLElement>('.home-sheet-close')!;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let y = 0, closing = false, suppressClick = false;
  let motion: { stop(): SpringState } | null = null;
  let drag: { id: number; startY: number; from: number; samples: { t: number; v: number }[]; active: boolean } | null = null;

  const height = () => panel.offsetHeight;
  const render = (value: number) => {
    y = value;
    panel.style.transform = `translate3d(0,${value}px,0)`;
    scrim.style.opacity = String(Math.min(1, Math.max(0, 1 - value / height())));
  };
  // Every animation starts from the live value and velocity, so catching or reversing it never jumps.
  const halt = () => { const state = motion?.stop() ?? { value: y, velocity: 0 }; motion = null; return state; };
  const springTo = (target: number, velocity: number, config = SETTLE, then?: () => void) => {
    halt();
    motion = animateSpring({ value: y, velocity }, target, config, render, () => { motion = null; then?.(); });
  };
  const finish = () => { closing = false; dialog.close(); render(0); };

  function open() {
    if (dialog.open) return;
    dialog.showModal();
    (keyboard ? closeButton : title).focus({ preventScroll: true });
    // Short sheets drag from anywhere; a sheet whose content scrolls keeps the scroll and drags by its header.
    panel.classList.toggle('is-scrollable', body.scrollHeight > body.clientHeight + 1);
    if (reduced()) { render(0); dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }); return; }
    render(height());
    springTo(0, 0);
  }
  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    if (reduced()) { halt(); dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' }).onfinish = finish; return; }
    springTo(height(), 0, SETTLE, finish);
  }

  const onPointerDown = (event: PointerEvent) => {
    suppressClick = false;
    if (event.button !== 0) return;
    const handle = (event.target as Element).closest('.home-sheet-grab, .home-sheet-head');
    if (!handle && panel.classList.contains('is-scrollable')) return;
    drag = { id: event.pointerId, startY: event.clientY, from: halt().value, samples: [{ t: event.timeStamp, v: event.clientY }], active: false };
    closing = false;
    // Follow the pointer anywhere until release; it often leaves the panel before the drag has begun.
    listen(true);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = event.clientY - drag.startY;
    // A little hysteresis so taps on options never wobble the sheet.
    if (!drag.active) { if (Math.abs(moved) < 10) return; drag.active = true; panel.setPointerCapture(event.pointerId); }
    drag.samples = [...drag.samples.slice(-7), { t: event.timeStamp, v: event.clientY }];
    const next = drag.from + moved;
    render(next < 0 ? rubberband(next, height()) : next);
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { active, samples } = drag;
    drag = null;
    listen(false);
    if (!active) { if (y !== 0 && dialog.open && !closing) springTo(0, 0); return; }
    suppressClick = true;
    // The release itself is the last sample, so a pause before letting go reads as no throw.
    const velocity = event.type === 'pointercancel' ? 0 : velocityOf([...samples, { t: event.timeStamp, v: event.clientY }]);
    // A clear flick decides by direction; otherwise by where the throw would come to rest.
    const dismiss = velocity > 300 || (velocity > -300 && y + project(velocity) > height() / 2);
    if (dismiss) { closing = true; if (reduced()) close(); else springTo(height(), velocity, SETTLE, finish); }
    else if (reduced()) render(0);
    else springTo(0, velocity, THROWN);
  };
  const onClick = (event: MouseEvent) => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); return; }
    const target = event.target as Element;
    if (target === scrim || target.closest('[data-sheet-close]')) close();
  };
  // Escape plays the same exit as the close button instead of vanishing.
  const onCancel = (event: Event) => { event.preventDefault(); close(); };

  function listen(on: boolean) {
    if (on) { addEventListener('pointermove', onPointerMove); addEventListener('pointerup', onPointerEnd); addEventListener('pointercancel', onPointerEnd); }
    else { removeEventListener('pointermove', onPointerMove); removeEventListener('pointerup', onPointerEnd); removeEventListener('pointercancel', onPointerEnd); }
  }
  panel.addEventListener('pointerdown', onPointerDown);
  dialog.addEventListener('click', onClick, true);
  dialog.addEventListener('cancel', onCancel);
  return { open, close, dispose() { halt(); listen(false); if (dialog.open) dialog.close(); } };
}
