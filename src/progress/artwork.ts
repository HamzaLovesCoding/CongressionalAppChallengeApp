const paths = {
  flag: '<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-5 2h10"/>',
  check: '<path d="m5 12 4 4L19 6" stroke-width="4"/>',
  wheel: '<circle cx="12" cy="12" r="9" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="m4 8 8 4 8-4m-8 4v9" stroke-width="3"/>',
  road: '<path d="M6 3 2 21M18 3l4 18M12 3v3m0 5v3m0 5v2" stroke-width="3"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="currentColor" stroke="none"/>',
  up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  down: '<path d="M12 5v14m-6-6 6 6 6-6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
};
export const pathIcon = (name: keyof typeof paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
