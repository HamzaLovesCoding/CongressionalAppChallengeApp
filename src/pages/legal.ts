import { LEARNING_SOURCES, OPEN_SOURCE, ORIGINAL_MATERIALS, VIDEO_CREDITS } from '../legal/credits';
import { OWNER_PLACEHOLDER, PRIVACY, TERMS, type LegalDocument } from '../legal/documents';
import type { View } from '../navigation';
import { subpage } from './subpage';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
// Each source is one full-width row link, so the whole row is the tap target.
const row = (url: string | null, title: string, detail: string) => url
  ? `<li><a class="sub-row" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span><b>${esc(title)}</b><small>${detail}</small></span><i aria-hidden="true">↗</i></a></li>`
  : `<li class="sub-row"><span><b>${esc(title)}</b><small>${detail}</small></span></li>`;

function mountDocument(root: HTMLElement, doc: LegalDocument): View {
  const view = subpage(root, { title: doc.title, back: '#/settings', backLabel: 'Back to settings', className: 'legal-page' });
  view.body.innerHTML = `<p class="sub-note">Version ${esc(doc.version)} · ${esc(doc.effective ?? OWNER_PLACEHOLDER.effective)}</p>
    ${doc.sections.map(section => `<h2>${esc(section.heading)}</h2>${section.body.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}`).join('')}`;
  return view;
}
export const mountPrivacy = (root: HTMLElement) => mountDocument(root, PRIVACY);
export const mountTerms = (root: HTMLElement) => mountDocument(root, TERMS);

// #/credits: rendered from the attribution register, so each video credit comes from its lesson data.
export function mountCredits(root: HTMLElement): View {
  const view = subpage(root, { title: 'Credits & sources', back: '#/settings', backLabel: 'Back to settings', className: 'legal-page' });
  view.body.innerHTML = `
    <h2>Lesson videos</h2>
    <p class="sub-note">Each video is used under Creative Commons, as confirmed by the project owner.</p>
    <ul class="sub-list">${VIDEO_CREDITS.map(credit => row(credit.sourceUrl, credit.lessonTitle, `Original: ${esc(credit.sourceTitle)}${credit.creator ? ` · ${esc(credit.creator)}` : ''}${credit.licenseVariant ? ` · ${esc(credit.licenseVariant)}` : ''}`)).join('')}</ul>
    <h2>Learning sources</h2>
    <ul class="sub-list">${LEARNING_SOURCES.map(source => row(source.url, source.title, `${esc(source.publisher)}. ${esc(source.use)}`)).join('')}</ul>
    <p class="sub-note">Lane is not affiliated with or endorsed by the California DMV or the Office of Traffic Safety.</p>
    <h2>Open-source software</h2>
    <ul class="sub-list">${OPEN_SOURCE.map(item => row(item.url, item.name, `${esc(item.version)} · ${esc(item.license)} · ${esc(item.use)}`)).join('')}</ul>
    <h2>Lane materials</h2>
    <ul class="sub-list">${ORIGINAL_MATERIALS.map(text => `<li class="sub-row"><span><small>${esc(text)}</small></span></li>`).join('')}</ul>`;
  return view;
}
