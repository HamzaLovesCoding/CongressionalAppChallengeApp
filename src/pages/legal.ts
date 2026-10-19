import { CC_BY_3, CC_BY_NC_4, HANDBOOK_LICENSE, LEARNING_SOURCES, OPEN_SOURCE, ORIGINAL_MATERIALS, SERVICES, VIDEO_CREDITS } from '../legal/credits';
import { PRIVACY, TERMS, type LegalDocument } from '../legal/documents';
import type { View } from '../navigation';
import { subpage } from './subpage';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
// Each source is one full-width row link, so the whole row is the tap target.
const row = (url: string | null, title: string, detail: string) => url
  ? `<li><a class="sub-row" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span><b>${esc(title)}</b><small>${detail}</small></span><i aria-hidden="true">↗</i></a></li>`
  : `<li class="sub-row"><span><b>${esc(title)}</b><small>${detail}</small></span></li>`;

function mountDocument(root: HTMLElement, doc: LegalDocument): View {
  const view = subpage(root, { title: doc.title, back: '#/settings', backLabel: 'Back to settings', className: 'legal-page' });
  view.body.innerHTML = `<p class="sub-note">Version ${esc(doc.version)} · Effective ${esc(doc.effective)}</p>
    ${doc.sections.map(section => `<h2>${esc(section.heading)}</h2>${section.body.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}`).join('')}`;
  return view;
}
export const mountPrivacy = (root: HTMLElement) => mountDocument(root, PRIVACY);
export const mountTerms = (root: HTMLElement) => mountDocument(root, TERMS);

// #/credits: rendered from the attribution register, so each video credit comes from its lesson data.
export function mountCredits(root: HTMLElement): View {
  const view = subpage(root, { title: 'Credits & sources', back: '#/profile', backLabel: 'Back to profile', className: 'legal-page' });
  view.body.innerHTML = `
    <h2>Lesson videos</h2>
    <p class="sub-note">Each video is by the creator named below and is used under the <a href="${CC_BY_3}" target="_blank" rel="noopener">Creative Commons Attribution 3.0 license (CC BY 3.0)</a>. Lane re-encoded the videos for phones and shows them with its own titles and California rule notes. The creators do not endorse Lane.</p>
    <ul class="sub-list">${VIDEO_CREDITS.map(credit => row(credit.sourceUrl, credit.lessonTitle, `“${esc(credit.sourceTitle)}” by ${esc(credit.creator ?? 'unknown creator')}${credit.licenseVariant ? ` · ${esc(credit.licenseVariant)}` : ''}`)).join('')}</ul>
    <h2>Learning sources</h2>
    <ul class="sub-list">${LEARNING_SOURCES.map(source => row(source.url, source.title, `${esc(source.publisher)}. ${esc(source.use)}`)).join('')}</ul>
    <p class="sub-note">Lane is not affiliated with or endorsed by the California DMV or the Office of Traffic Safety.</p>
    <h2>Driver coach</h2>
    <ul class="sub-list">${SERVICES.map(item => row(item.url, item.name, esc(item.use))).join('')}
      ${row(CC_BY_NC_4, 'Handbook text the coach answers from and quotes', `${esc(HANDBOOK_LICENSE)} Lane extracted the text, fixed encoding errors and described the pictures in words.`)}</ul>
    <h2>Open-source software</h2>
    <ul class="sub-list">${OPEN_SOURCE.map(item => row(item.url, item.name, `${esc(item.version)} · ${esc(item.license)} · ${esc(item.use)}`)).join('')}</ul>
    <h2>Lane materials</h2>
    <ul class="sub-list">${ORIGINAL_MATERIALS.map(text => `<li class="sub-row"><span><small>${esc(text)}</small></span></li>`).join('')}</ul>`;
  return view;
}
