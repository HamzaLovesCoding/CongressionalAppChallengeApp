import './medals.css';
import { pathIcon } from '../progress/artwork';
import type { MILESTONES } from '../progress/milestones';

// Milestone rosettes for Profile: a scalloped rim, a face with the milestone's icon and two ribbon tails.
// Each tier has its own colours (clay, olive, ochre, then ink and gold for finishing the unit), set in profile.css.
const CX = 34, CY = 33, RIM = 24, BUMPS = 16;
const round = (value: number) => Math.round(value * 100) / 100;
const point = (index: number) => {
  const angle = index / BUMPS * Math.PI * 2 - Math.PI / 2;
  return `${round(CX + RIM * Math.cos(angle))} ${round(CY + RIM * Math.sin(angle))}`;
};
// Half-circle bumps between evenly spaced points on the rim; clockwise arcs bulge outward.
const bump = round(RIM * Math.sin(Math.PI / BUMPS));
const ROSETTE = `M${point(0)}${Array.from({ length: BUMPS }, (_, index) => `A${bump} ${bump} 0 0 1 ${point(index + 1)}`).join('')}Z`;
const RING = 31.5, RING_LENGTH = round(2 * Math.PI * RING);
const spark = (x: number, y: number, size: number) => {
  const inner = size * .28;
  return `M${x} ${y - size}L${round(x + inner)} ${round(y - inner)}L${x + size} ${y}L${round(x + inner)} ${round(y + inner)}L${x} ${y + size}L${round(x - inner)} ${round(y + inner)}L${x - size} ${y}L${round(x - inner)} ${round(y - inner)}Z`;
};

export type MedalState = 'earned' | 'next' | 'locked';

/** One rosette. `progress` (0–1) draws the ring around the next milestone. */
export function medalArt(icon: typeof MILESTONES[number]['icon'], state: MedalState, progress = 0) {
  const ring = state === 'next'
    ? `<circle class="medal-track" cx="${CX}" cy="${CY}" r="${RING}"/><circle class="medal-progress" cx="${CX}" cy="${CY}" r="${RING}" stroke-dasharray="${round(RING_LENGTH * Math.min(1, Math.max(0, progress)))} ${RING_LENGTH}" transform="rotate(-90 ${CX} ${CY})"/>`
    : '';
  const sparks = state === 'earned' ? `<path class="medal-spark" d="${spark(60, 9, 5.5)}"/><path class="medal-spark is-small" d="${spark(7, 17, 3.5)}"/>` : '';
  return `<svg class="profile-medal-art" viewBox="0 0 68 76" aria-hidden="true" focusable="false">
    <path class="medal-ribbon" d="M24 46 16 71l6-3 4 6 7-24Z"/><path class="medal-ribbon is-right" d="M44 46l8 25-6-3-4 6-7-24Z"/>
    ${ring}<path class="medal-rim" d="${ROSETTE}"/><circle class="medal-face" cx="${CX}" cy="${CY}" r="18.5"/><circle class="medal-ring" cx="${CX}" cy="${CY}" r="15.5"/>
    <path class="medal-shine" d="M21.8 28.6A13 13 0 0 1 29.6 20.8"/>
    ${pathIcon(icon).replace('<svg ', `<svg class="medal-icon" x="${CX - 11}" y="${CY - 11}" width="22" height="22" `)}${sparks}
  </svg>`;
}
