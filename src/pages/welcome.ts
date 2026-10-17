import '../home/home.css';
import './pages.css';
import { CLIPS } from '../feed/clips';
import { cleanAlias, completeOnboarding, GOALS, setDisplayAlias, settings, type Goal } from '../feed/progress';
import { appSync } from '../data/sync';
import { PRIVACY, TERMS, type LegalDocument } from '../legal/documents';
import { go, type View } from '../navigation';
import { WELCOME_COPY as copy } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const documentBody = (doc: LegalDocument) => doc.sections.map(section => `<h3>${esc(section.heading)}</h3>${section.body.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}`).join('');

// #/welcome: first launch only (main.ts). Step 1 picks an optional username and accepts the Terms;
// step 2 asks for the main goal, which only changes how Home words the readiness goal.
export function mountWelcome(root: HTMLElement): View {
  const sync = appSync(CLIPS.map(clip => clip.id));
  const page = document.createElement('div');
  page.className = 'home-preview lane-sub welcome-page';
  page.innerHTML = `<div class="home-phone"><main class="sub-content" aria-labelledby="welcome-title" tabindex="-1">
    <header class="sub-top"><span class="home-wordmark-art" role="img" aria-label="Lane"></span></header>
    <div class="sub-body" data-step></div></main></div>`;
  root.append(page);
  const body = page.querySelector<HTMLElement>('[data-step]')!;
  const main = page.querySelector<HTMLElement>('main')!;

  function stepOne() {
    body.innerHTML = `<p class="review-progress">${copy.step(1)}</p><h1 id="welcome-title" class="welcome-title">${copy.title}</h1>
      <form data-account novalidate>
        <div class="sub-field"><label for="welcome-name">${copy.usernameLabel}</label>
          <input id="welcome-name" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(settings().displayAlias ?? '')}">
          <p class="sub-note">${copy.usernameNote}</p></div>
        <details class="welcome-doc"><summary>${copy.readTerms}</summary><div class="welcome-doc-body">${documentBody(TERMS)}</div></details>
        <details class="welcome-doc"><summary>${copy.readPrivacy}</summary><div class="welcome-doc-body">${documentBody(PRIVACY)}</div></details>
        <label class="welcome-check"><input type="checkbox" name="terms"><span>${copy.agree}</span></label>
        <p class="sub-status" role="status" data-status></p>
        <div class="sub-actions"><button class="ui-button" type="submit">${copy.next}</button></div>
      </form>`;
    main.focus({ preventScroll: true });
  }
  function stepTwo() {
    body.innerHTML = `<p class="review-progress">${copy.step(2)}</p><h1 id="welcome-title" class="welcome-title">${copy.goalTitle}</h1>
      <form data-goal novalidate>
        <fieldset class="welcome-goals"><legend class="home-sr-only">${copy.goalTitle}</legend>
          ${GOALS.map(goal => `<label class="welcome-goal"><input type="radio" name="goal" value="${goal}"><span>${copy.goals[goal]}</span></label>`).join('')}
        </fieldset>
        <div class="sub-field" data-other hidden><label for="welcome-other">${copy.otherLabel}</label><input id="welcome-other" type="text" maxlength="80" autocomplete="off"></div>
        <p class="sub-status" role="status" data-status></p>
        <div class="sub-actions"><button class="ui-button" type="submit">${copy.start}</button></div>
      </form>`;
    main.focus({ preventScroll: true });
  }
  const status = (text: string) => { body.querySelector<HTMLElement>('[data-status]')!.textContent = text; };

  body.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.name === 'goal') body.querySelector<HTMLElement>('[data-other]')!.hidden = input.value !== 'other';
  });
  body.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (form.matches('[data-account]')) {
      if (!form.querySelector<HTMLInputElement>('[name="terms"]')!.checked) { status(copy.needTerms); return; }
      const raw = form.querySelector<HTMLInputElement>('#welcome-name')!.value;
      const name = raw.trim() ? cleanAlias(raw) : null;
      if (raw.trim() && !name) { status(copy.usernameRule); return; }
      // With a server, the name is claimed there first so no two learners share it.
      if (!name || !sync.configured) { setDisplayAlias(name); stepTwo(); return; }
      status(copy.saving);
      void sync.setUsername(name).then(result => {
        if (result === 'ok') { setDisplayAlias(name); stepTwo(); return; }
        status(result === 'taken' ? copy.taken : result === 'invalid' ? copy.usernameRule : copy.offline);
      });
      return;
    }
    const goal = form.querySelector<HTMLInputElement>('[name="goal"]:checked')?.value as Goal | undefined;
    if (!goal) { status(copy.needGoal); return; }
    completeOnboarding(goal, goal === 'other' ? form.querySelector<HTMLInputElement>('#welcome-other')!.value : null);
    go('#/home', true);
  });
  stepOne();
  return { dispose() { page.remove(); } };
}
