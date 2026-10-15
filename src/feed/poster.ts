// Decorative street map for lessons that do not yet have licensed video.
export type PosterScene = 'roundabout';

const car = (x: number, y: number, angle = 0, fill = 'var(--lane-accent)') =>
  `<g transform="translate(${x} ${y}) rotate(${angle})"><rect x="-12" y="-28" width="24" height="55" rx="7" fill="${fill}" stroke="var(--lane-ink)" stroke-width="2"/><path d="M-8-13H8L6-3H-6ZM-6 11H6L8 19H-8Z" fill="var(--lane-ink)"/><path d="M-8-22h5m6 0h5" stroke="var(--lane-surface)" stroke-width="3"/></g>`;

// A two-lane roundabout. Traffic circulates counterclockwise, as in California: the route enters from
// the south, keeps right around the island and leaves north, while a car already on the ring heads for
// that entry. Yield lines mark every entry.
const roundabout = () => {
  // Roads stop at y 640 like the intersection map, so the lesson title below always sits on the cream page.
  const roads = 'M215 85V640M-30 400H465';
  return `<svg class="lane-road-art" viewBox="0 0 430 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="430" height="900" fill="var(--lane-page)"/>
    <g fill="var(--lane-soft)" stroke="var(--lane-line)" stroke-width="1">
      <rect x="-24" y="100" width="152" height="188" rx="12"/><rect x="302" y="100" width="160" height="188" rx="12"/>
      <rect x="-24" y="512" width="152" height="128" rx="12"/><rect x="302" y="512" width="160" height="128" rx="12"/>
    </g>
    <g fill="none" stroke="var(--lane-map-line)" stroke-width="18"><circle cx="215" cy="400" r="131"/><path d="M164 85V640M266 85V640M-30 349H465M-30 451H465"/></g>
    <g fill="none" stroke="var(--lane-ink)"><path d="${roads}" stroke-width="78"/><circle cx="215" cy="400" r="88" stroke-width="68"/></g>
    <g fill="none" stroke="var(--lane-road)"><path d="${roads}" stroke-width="74"/><circle cx="215" cy="400" r="88" stroke-width="64"/></g>
    <circle cx="215" cy="400" r="55" fill="var(--lane-soft)" stroke="var(--lane-ink)" stroke-width="2"/><circle cx="215" cy="400" r="34" fill="var(--lane-map-line)"/>
    <g fill="none" stroke="var(--lane-page)" stroke-width="2" stroke-dasharray="12 16"><circle cx="215" cy="400" r="88"/><path d="M215 85V276M215 524V640M-30 400H91M339 400H465"/></g>
    <g stroke="var(--lane-surface)" stroke-width="4" stroke-dasharray="4 6"><path d="M217 523H251M179 277H213M337 363V398M93 402V437"/></g>
    <path d="M233.5 627V570C233.5 536 270 492 288.5 473.5A104 104 0 0 0 288.5 326.5C270 308 233.5 270 233.5 240V60" fill="none" stroke="var(--lane-accent)" stroke-width="4" stroke-linecap="round"/>
    ${car(164, 451, 135, 'var(--lane-surface)')}${car(233.5, 600)}
  </svg>`;
};

export function roadPoster(index: number, scene?: PosterScene) {
  if (scene === 'roundabout') return roundabout();
  const turn = index % 2 ? 'M-30 450H200Q265 450 265 385V-30' : 'M220-30V350Q220 450 320 450H470';
  return `<svg class="lane-road-art" viewBox="0 0 430 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="430" height="900" fill="var(--lane-page)"/>
    <g fill="var(--lane-soft)" stroke="var(--lane-line)" stroke-width="1">
      <rect x="-24" y="145" width="156" height="125" rx="12"/><rect x="324" y="145" width="138" height="125" rx="12"/>
      <rect x="-24" y="335" width="156" height="72" rx="12"/><rect x="324" y="335" width="138" height="72" rx="12"/>
      <rect x="-24" y="504" width="156" height="126" rx="12"/><rect x="324" y="504" width="138" height="126" rx="12"/>
    </g>
    <g fill="none" stroke="var(--lane-map-line)" stroke-width="22"><path d="M-20 302H450M165 95V650M298 95V650"/></g>
    <path d="M220 85V640M-30 450H465" fill="none" stroke="var(--lane-ink)" stroke-width="78"/>
    <path d="M220 85V640M-30 450H465" fill="none" stroke="var(--lane-road)" stroke-width="74"/>
    <path d="M220 85V395M220 510V640M-30 450H170M277 450H465" fill="none" stroke="var(--lane-page)" stroke-width="2" stroke-dasharray="12 16"/>
    <path d="${turn}" fill="none" stroke="var(--lane-accent)" stroke-width="4" stroke-linecap="round"/>
    <g stroke="var(--lane-surface)" stroke-width="4" stroke-dasharray="4 6"><path d="M188 390H251M188 513H251M159 419V482M279 419V482"/></g>
    ${car(index % 2 ? 280 : 232, 300)}
  </svg>`;
}
