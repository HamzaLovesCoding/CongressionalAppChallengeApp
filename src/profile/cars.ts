// Each model has its own silhouette, cabin and panels. The shared nose-up SVG also drives the highway.
export const CARS = [
  { id: 'hatchback', name: 'Hatchback', description: 'A little city hatch with a short hood, rounded cabin, and wide rear window.', price: 0, color: 'var(--lane-accent)',
    body: 'M31 16Q50 9 69 16Q82 22 83 43L85 133Q84 154 70 161H30Q16 154 15 133L17 43Q18 22 31 16Z',
    hood: 'M28 37Q50 29 72 37L73 52Q50 47 27 52Z',
    glass: 'M26 58Q50 47 74 58L69 81H31Z', roof: 'M33 86H67L70 116Q50 122 30 116Z', rear: 'M29 123Q50 130 71 123L74 141Q50 151 26 141Z',
    side: 'M23 68 28 85 27 115 22 122ZM77 68 72 85 73 115 78 122Z', seams: 'M22 94h5m46 0h5M22 153h56', front: 40, back: 124, end: 158, mirror: 67, detail: 'hatch' },
  { id: 'sedan', name: 'Sedan', description: 'A four-door sedan with a long sculpted hood, a separate trunk, and a low cabin.', price: 15, color: 'var(--lane-success)',
    body: 'M30 6Q50 1 70 6Q81 11 82 33L84 148Q84 172 70 177H30Q16 172 16 148L18 33Q19 11 30 6Z',
    hood: 'M27 28Q50 20 73 28L70 58Q50 53 30 58Z',
    glass: 'M26 66Q50 56 74 66L68 88H32Z', roof: 'M33 94H67L69 120H31Z', rear: 'M32 126H68L74 145Q50 151 26 145Z',
    side: 'M23 76 28 91 27 108 22 108ZM22 114h5l2 12-6 12ZM77 76 72 91 73 108h5ZM78 114h-5l-2 12 6 12Z', seams: 'M21 111h8m42 0h8M28 155q22 5 44 0M31 32l3 21m35-21-3 21', front: 37, back: 141, end: 173, mirror: 75, detail: 'sedan' },
  { id: 'wagon', name: 'Wagon', description: 'A long-roof wagon with roof rails, extra rear windows, and an upright cargo hatch.', price: 25, color: 'var(--lane-roof)',
    body: 'M30 5Q50 0 70 5Q82 12 83 34L85 160Q85 178 72 182H28Q15 178 15 160L17 34Q18 12 30 5Z',
    hood: 'M27 27Q50 20 73 27L71 52H29Z',
    glass: 'M26 61Q50 51 74 61L69 81H31Z', roof: 'M32 87H68L71 146H29Z', rear: 'M27 153H73V167Q50 174 27 167Z',
    side: 'M23 72 28 86 27 112h-5ZM22 118h5v24l-5 6ZM77 72 72 86 73 112h5ZM78 118h-5v24l5 6Z', seams: 'M21 115h8m42 0h8M23 175h54', front: 35, back: 146, end: 178, mirror: 70, detail: 'rails' },
  { id: 'pickup', name: 'Pickup', description: 'A sturdy pickup with a broad hood, a separate cab, and a deep open cargo bed.', price: 35, color: 'var(--lane-error)',
    body: 'M25 7H75Q85 10 85 23V86L82 95V180H18V95L15 86V23Q15 10 25 7Z',
    hood: 'M25 29H75L72 53H28Z',
    glass: 'M24 59Q50 54 76 59L71 75H29Z', roof: 'M29 80H71V91H29Z', rear: 'M30 95H70V102H30Z',
    side: 'M21 65 26 79v14l-5-5ZM79 65 74 79v14l5-5Z', seams: 'M19 110h62M22 174h56M31 33v15m38-15v15', front: 35, back: 148, end: 178, mirror: 66, detail: 'bed' },
  { id: 'minivan', name: 'Minivan', description: 'A roomy minivan with a short nose, tall cabin, sliding doors, and three rows of windows.', price: 45, color: 'var(--lane-muted)',
    body: 'M32 3Q50-3 68 3Q85 13 86 34V157Q85 180 72 184H28Q15 180 14 157V34Q15 13 32 3Z',
    hood: 'M27 22Q50 12 73 22L76 37Q50 30 24 37Z',
    glass: 'M23 45Q50 32 77 45L71 68H29Z', roof: 'M31 75H69L73 147Q50 154 27 147Z', rear: 'M26 155Q50 162 74 155L73 171Q50 178 27 171Z',
    side: 'M20 55 26 73v23h-6ZM20 103h6v25h-6ZM20 135h6l-2 17-4-5ZM80 55 74 73v23h6ZM80 103h-6v25h6ZM80 135h-6l2 17 4-5Z', seams: 'M18 100h10m44 0h10M18 132h10m44 0h10', front: 33, back: 150, end: 180, mirror: 56, detail: 'van' },
  { id: 'classic-coupe', name: 'Classic coupe', description: 'A two-door classic with a curved cream roof, round headlights, and sculpted fenders.', price: 60, color: 'var(--lane-accent-ink)',
    body: 'M36 8Q50 3 64 8L72 23Q85 26 86 45L81 70 77 99 86 137Q90 162 73 172Q50 179 27 172Q10 162 14 137L23 99 19 70 14 45Q15 26 28 23Z',
    hood: 'M35 23Q50 17 65 23L70 66Q50 60 30 66Z',
    glass: 'M29 78Q50 64 71 78L66 97H34Z', roof: 'M35 103Q50 96 65 103L69 125Q50 133 31 125Z', rear: 'M32 132Q50 140 68 132L73 149Q50 157 27 149Z',
    side: 'M25 88 30 103 28 126l-6 6ZM75 88 70 103 72 126l6 6Z', seams: 'M28 158q22 8 44 0M37 28l3 31m23-31-3 31', front: 36, back: 140, end: 172, mirror: 84, detail: 'classic' },
] as const;

export const DEFAULT_CAR = CARS[0].id;
export type CarId = typeof CARS[number]['id'];
export const carById = (id: string) => CARS.find(car => car.id === id);

export function carArt(id: CarId) {
  const c = carById(id)!;
  const wheels = [c.front, c.back].map(y => `<g fill="var(--lane-ink)" stroke="var(--lane-ink)" stroke-width="2"><rect x="9" y="${y}" width="14" height="25" rx="5"/><rect x="77" y="${y}" width="14" height="25" rx="5"/><path d="M12 ${y + 5}v15m76-15v15" stroke="var(--lane-muted)" stroke-width="3"/></g>`).join('');
  const detail = c.detail === 'bed'
    ? '<path d="M24 116H76V168H24Z" fill="var(--lane-ink)"/><path d="M28 120H72V163H28Z" fill="var(--lane-support)"/><path d="M33 124v34m8-34v34m9-34v34m9-34v34m8-34v34" stroke="var(--lane-line)" stroke-width="2"/><path d="M21 115v54m58-54v54" stroke="var(--lane-surface)" stroke-opacity=".6" stroke-width="3"/>'
    : c.detail === 'rails'
      ? '<g stroke="var(--lane-ink)" stroke-width="5" stroke-linecap="round"><path d="M35 91v51m30-51v51M35 99h30m-30 34h30"/></g><path d="M35 91v51m30-51v51" stroke="var(--lane-soft)" stroke-width="2" stroke-linecap="round"/>'
      : c.detail === 'van'
        ? '<rect x="36" y="84" width="28" height="24" rx="6" fill="var(--lane-ink)"/><path d="m40 89 18 0-18 14Z" fill="var(--lane-soft)" opacity=".45"/><path d="M17 106v35m66-35v35" stroke="var(--lane-soft)" stroke-width="2"/>'
        : c.detail === 'hatch'
          ? '<path d="M27 143q23 9 46 0" stroke="var(--lane-ink)" stroke-width="5"/><path d="m45 136 14 3" stroke="var(--lane-soft)" stroke-width="2"/>' : '';
  return `<g data-car-art="${c.id}" transform="scale(.22) translate(-50 -93)" stroke-linejoin="round" stroke-linecap="round">
    <path d="${c.body}" transform="translate(4 6)" fill="var(--lane-ink)" opacity=".22"/>
    ${wheels}
    <path d="${c.body}" fill="${c.color}" stroke="var(--lane-ink)" stroke-width="4"/>
    <path d="${c.body}" fill="none" stroke="var(--lane-surface)" stroke-opacity=".28" stroke-width="2" transform="translate(4 4) scale(.92 .95)"/>
    <path d="${c.hood}" fill="var(--lane-surface)" fill-opacity=".16" stroke="var(--lane-ink)" stroke-opacity=".3" stroke-width="1.5"/>
    <path d="${c.side}" fill="var(--lane-ink)"/>
    <path d="${c.glass}" fill="var(--lane-ink)" stroke="var(--lane-ink)" stroke-width="3"/>
    <path d="${c.glass}" fill="var(--lane-soft)" fill-opacity=".45" transform="translate(10 4) scale(.8 .89)"/>
    <path d="${c.roof}" transform="translate(2 3)" fill="var(--lane-ink)" opacity=".25"/>
    <path d="${c.roof}" fill="${c.detail === 'classic' ? 'var(--lane-page)' : c.color}" stroke="var(--lane-ink)" stroke-width="2"/>
    <path d="${c.roof}" fill="var(--lane-surface)" fill-opacity=".17" stroke="var(--lane-surface)" stroke-opacity=".3" stroke-width="1" transform="translate(5 4) scale(.9 .94)"/>
    <path d="${c.rear}" fill="var(--lane-ink)" stroke="var(--lane-ink)" stroke-width="2"/>
    <path d="${c.rear}" fill="var(--lane-soft)" fill-opacity=".3" transform="translate(10 7) scale(.8 .94)"/>
    <path d="${c.seams}" fill="none" stroke="var(--lane-ink)" stroke-opacity=".5" stroke-width="1.5"/>
    <g fill="${c.color}" stroke="var(--lane-ink)" stroke-width="2"><path d="M18 ${c.mirror}q-13-3-13 6l13 2ZM82 ${c.mirror}q13-3 13 6l-13 2Z"/></g>
    ${c.detail === 'classic'
      ? '<g fill="var(--lane-surface)" stroke="var(--lane-ink)" stroke-width="2"><ellipse cx="26" cy="33" rx="7" ry="9"/><ellipse cx="74" cy="33" rx="7" ry="9"/></g><path d="M36 16h28M22 165q28 12 56 0" fill="none" stroke="var(--lane-soft)" stroke-width="4"/>'
      : `<path d="M24 20h12m28 0h12" fill="none" stroke="var(--lane-surface)" stroke-width="6"/><path d="M39 16h22" stroke="var(--lane-ink)" stroke-width="3"/>`}
    <path d="M24 ${c.end - 5}h9m34 0h9" stroke="var(--lane-error)" stroke-width="6"/>
    <rect x="43" y="${c.end - 3}" width="14" height="4" rx="1" fill="var(--lane-soft)"/>
    ${detail}
  </g>`;
}

export const carPreview = (id: CarId) => `<svg class="profile-car-art" viewBox="-29 -29 58 58" aria-hidden="true" focusable="false"><g transform="rotate(-28)">${carArt(id)}</g></svg>`;
