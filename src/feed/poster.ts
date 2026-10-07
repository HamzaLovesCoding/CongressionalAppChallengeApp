// A decorative media fallback, not a depiction of a lesson's correct driving action.
export function roadPoster(index: number) {
  const id = `road-${index}`;
  return `<svg class="lane-road-art" viewBox="0 0 430 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-grass" x2=".6" y2="1"><stop stop-color="#d8efac"/><stop offset="1" stop-color="#b9d8b6"/></linearGradient>
      <linearGradient id="${id}-car" x2="1" y2="1"><stop stop-color="#f9fff1"/><stop offset="1" stop-color="#c5dea9"/></linearGradient>
      <filter id="${id}-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#173b20" flood-opacity=".12"/></filter>
    </defs>
    <rect width="430" height="900" fill="url(#${id}-grass)"/>
    <path d="M-90 240Q140 40 500 135M-90 780Q30 575 500 710" fill="none" stroke="#e8f1c8" stroke-width="80" opacity=".45"/>
    <path d="M265-80C380 100 305 185 225 310S170 520 210 640 205 810 140 970" fill="none" stroke="#a9c89c" stroke-width="132"/>
    <path d="M265-80C380 100 305 185 225 310S170 520 210 640 205 810 140 970" fill="none" stroke="#f0f4dc" stroke-width="118"/>
    <path d="M265-80C380 100 305 185 225 310S170 520 210 640 205 810 140 970" fill="none" stroke="#6f8874" stroke-width="105"/>
    <path d="M265-80C380 100 305 185 225 310S170 520 210 640 205 810 140 970" fill="none" stroke="#f2efd0" stroke-width="3" stroke-dasharray="17 20" opacity=".85"/>
    <g fill="#a5c790" opacity=".5"><ellipse cx="81" cy="343" rx="38" ry="17"/><ellipse cx="342" cy="563" rx="38" ry="17"/><ellipse cx="44" cy="748" rx="44" ry="20"/></g>
    <g filter="url(#${id}-shadow)"><g fill="#7da86c"><circle cx="75" cy="300" r="29"/><circle cx="94" cy="318" r="25"/><circle cx="57" cy="321" r="23"/></g><circle cx="72" cy="302" r="23" fill="#97bf7d"/>
    <g fill="#7aa475"><circle cx="350" cy="517" r="31"/><circle cx="331" cy="539" r="26"/><circle cx="367" cy="539" r="23"/></g><circle cx="348" cy="518" r="23" fill="#95b986"/>
    <g fill="#719f69"><circle cx="38" cy="705" r="32"/><circle cx="57" cy="721" r="30"/><circle cx="24" cy="732" r="26"/></g><circle cx="36" cy="707" r="26" fill="#8db67a"/></g>
    <g class="lane-poster-car" filter="url(#${id}-shadow)"><g transform="translate(212 441) rotate(-3)"><rect x="-19" y="-30" width="38" height="67" rx="14" fill="url(#${id}-car)"/><rect x="-15" y="-15" width="30" height="36" rx="9" fill="#344f41"/><rect x="-12" y="-4" width="24" height="17" rx="5" fill="#dbeaca"/><path d="M-11-24h6m10 0h6" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M-11 28h5m11 0h-5" stroke="#ce8974" stroke-width="3" stroke-linecap="round"/></g></g>
    <g opacity=".6" fill="#f1f7d8"><ellipse cx="68" cy="159" rx="25" ry="9" transform="rotate(-35 68 159)"/><ellipse cx="342" cy="752" rx="23" ry="8" transform="rotate(-35 342 752)"/></g>
  </svg>`;
}
