const paths = {
  bookmark: '<path d="M6 3h12v19l-6-4-6 4Z"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m7 12 3 3 7-7"/>',
  flame: '<path d="M13 2c1 7-6 6-3 12 2-1 3-3 3-5 5 4 6 7 4 11-2 3-8 3-11 0C1 14 6 9 8 7c-1 4 1 4 1 4C8 5 12 5 13 2Z"/>',
  menu: '<rect x="3" y="3" width="7" height="7" rx="3"/><rect x="14" y="3" width="7" height="7" rx="3"/><rect x="3" y="14" width="7" height="7" rx="3"/><rect x="14" y="14" width="7" height="7" rx="3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9 0 1 2 1 9 1s9 0 9-1c0-2-3-2-3-9Z"/><path d="M9 21c1 2 5 2 6 0"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  book: '<path d="M12 5C9 2 5 2 1 3v17c4-1 8-1 11 2 3-3 7-3 11-2V3c-4-1-8-1-11 2Zm0 0v17M5 6v10m14-10v10"/>',
  practice: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 2h6v5H9Zm0 10h6m-6 4h4"/>',
  progress: '<path d="M5 3h9a5 5 0 0 1 0 10h-4a4 4 0 0 0 0 8h9"/><circle cx="5" cy="3" r="2" fill="currentColor"/><path d="m17 18 3 3-3 3"/>',
  feed: '<rect x="4" y="2" width="16" height="20" rx="4"/><path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none"/>',
  profile: '<circle cx="12" cy="7" r="5"/><path d="M4 23v-2a8 8 0 0 1 16 0v2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v7l4 3"/>',
  star: '<path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z" fill="currentColor" stroke="none"/>',
  tick: '<path d="m6 12.5 4 4 8-9" stroke-width="2.4"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M6 12a10 10 0 0 1 12 0m-8 4a4 4 0 0 1 4 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
};
export const icon = (name: keyof typeof paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
