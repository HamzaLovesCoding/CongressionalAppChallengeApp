const paths = {
  back: '<path d="m14 6-6 6 6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="18" rx="4" fill="currentColor" stroke="none"/><rect x="8" y="2" width="8" height="5" rx="2" fill="#f6ffeb" stroke="#315422"/><path d="M9 12h6m-6 5h4" stroke="#315422"/>',
  check: '<path d="m5 12 4 4L19 6" stroke-width="4"/>',
  book: '<path d="M12 5C8 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1Z" fill="currentColor" stroke="none"/><path d="M12 5v15" stroke="#76a64c" stroke-width="1"/>',
  wheel: '<circle cx="12" cy="12" r="9" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="m4 8 8 4 8-4m-8 4v9" stroke-width="3"/>',
  road: '<path d="M6 3 2 21M18 3l4 18M12 3v3m0 5v3m0 5v2" stroke-width="3"/>',
  car: '<path d="m5 8 2-5h10l2 5M4 9h16v10H4Z" fill="currentColor" stroke-width="2"/><path d="M7 12h2m6 0h2" stroke="#5b9b28"/><path d="M6 19v3m12-3v3" stroke-width="3"/>',
  lock: '<rect x="5" y="10" width="14" height="12" rx="3" fill="currentColor" stroke="none"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke-width="3"/><path d="M12 15v3" stroke="#d4d8cf"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="currentColor" stroke="none"/>',
};
export const pathIcon = (name: keyof typeof paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

// Lightweight decorative landscape, drawn locally; no external artwork or animation dependency.
export const landscape = `<svg class="path-landscape" viewBox="0 0 430 160" preserveAspectRatio="none" fill="none" aria-hidden="true">
  <path d="M0 118Q70 98 163 128Q285 148 430 102V160H0Z" fill="#d5efaf"/>
  <path d="M0 137Q130 111 218 137Q340 154 430 127V160H0Z" fill="#afdb7a"/>
  <g stroke="#8e7345" stroke-width="5" stroke-linecap="round"><path d="M407 121V43m0 47-21-17m21 3 14-19M24 137v-28m0 12-10-8"/></g>
  <g fill="#83bd48"><circle cx="395" cy="54" r="25"/><circle cx="422" cy="41" r="28"/><circle cx="418" cy="73" r="25"/><circle cx="382" cy="76" r="18"/><circle cx="20" cy="105" r="17"/><circle cx="5" cy="114" r="13"/></g>
  <g fill="#a9d963"><circle cx="385" cy="47" r="16"/><circle cx="410" cy="30" r="20"/><circle cx="415" cy="60" r="20"/><circle cx="11" cy="102" r="11"/></g>
  <g fill="#75af3c"><ellipse cx="352" cy="133" rx="15" ry="9"/><ellipse cx="75" cy="132" rx="10" ry="7"/></g>
</svg>`;
