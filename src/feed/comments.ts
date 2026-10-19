import { CLIPS } from './clips';
import { settings } from './progress';
import { appSync, type CommentRow } from '../data/sync';
import { COMMENT_COPY as copy } from './content';
import { isClean } from './moderation';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const up = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>';
const down = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg>';
const dots = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

// The comments sheet under a lesson (owner direction, 2026-10-16). Comments live on the backend: each
// shows the author's username or "Anonymous", the date and time, and its vote score. Learners vote up or
// down once per comment (on their own, one upvote only) and delete their own from ⋯. There is no editing.
export function commentsSheet(dialog: HTMLDialogElement) {
  const sync = appSync(CLIPS.map(clip => clip.id));
  let lessonId = '', rows: CommentRow[] = [], menuFor: string | null = null, loading = false;

  const row = (entry: CommentRow) => `<li class="lane-comment">
    <div class="lane-comment-head"><b>${esc(entry.author ?? copy.anonymous)}</b><time datetime="${esc(entry.created_at)}">${when(entry.created_at)}</time>
      ${entry.is_mine ? `<button class="lane-comment-more" data-comment-menu="${esc(entry.id)}" aria-label="${copy.options}" aria-expanded="${menuFor === entry.id}">${dots}</button>` : ''}</div>
    ${menuFor === entry.id ? `<div class="lane-comment-menu"><button data-comment-delete="${esc(entry.id)}">${copy.delete}</button></div>` : ''}
    <p>${esc(entry.body)}</p>
    <div class="lane-comment-votes">
      <button data-vote="1" data-comment-id="${esc(entry.id)}" aria-label="${copy.upvote}" aria-pressed="${entry.my_vote === 1}">${up}</button>
      <span aria-label="${copy.score(Number(entry.score) || 0)}">${Number(entry.score) || 0}</span>
      <button data-vote="-1" data-comment-id="${esc(entry.id)}" aria-label="${copy.downvote}" aria-pressed="${entry.my_vote === -1}"${entry.is_mine ? ' disabled' : ''}>${down}</button>
    </div></li>`;
  const list = () => dialog.querySelector<HTMLElement>('[data-comment-list]');
  const status = (text: string) => { const line = dialog.querySelector<HTMLElement>('[data-comment-status]'); if (line) line.textContent = text; };
  function paint() {
    const target = list();
    if (target) target.innerHTML = loading ? `<li class="lane-comments-empty">${copy.loading}</li>` : rows.length ? rows.map(row).join('') : `<li class="lane-comments-empty">${copy.empty}</li>`;
  }
  async function load() {
    loading = true; paint();
    const result = await sync.comments(lessonId);
    loading = false;
    if (result) rows = result; else status(copy.offline);
    paint();
  }

  dialog.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target === dialog) { dialog.close(); return; }
    const voteButton = event.target.closest<HTMLButtonElement>('[data-vote]');
    if (voteButton) {
      const entry = rows.find(item => item.id === voteButton.dataset.commentId);
      const pick = Number(voteButton.dataset.vote) as 1 | -1;
      // Your own comment takes one upvote and no downvote; anyone else's takes one vote, up or down.
      if (!entry || (entry.is_mine && pick === -1)) return;
      const previous = entry.my_vote, next = previous === pick ? null : pick;
      // Shown right away; put back if the server doesn't take it.
      entry.score += (next ?? 0) - (previous ?? 0); entry.my_vote = next; paint();
      void sync.voteComment(entry.id, next ?? 0).then(result => {
        if (result === 'ok') { status(''); return; }
        entry.score -= (next ?? 0) - (previous ?? 0); entry.my_vote = previous; paint();
        status(result === 'refused' ? copy.voteRefused : copy.offline);
      });
      return;
    }
    const more = event.target.closest<HTMLButtonElement>('[data-comment-menu]');
    if (more) { menuFor = menuFor === more.dataset.commentMenu ? null : more.dataset.commentMenu!; paint(); return; }
    const remove = event.target.closest<HTMLButtonElement>('[data-comment-delete]');
    if (remove) {
      remove.disabled = true;
      void sync.deleteComment(remove.dataset.commentDelete!).then(result => {
        if (result === 'ok') { rows = rows.filter(item => item.id !== remove.dataset.commentDelete); menuFor = null; paint(); status(copy.deleted); }
        else { remove.disabled = false; status(result === 'refused' ? copy.deleteRefused : copy.offline); }
      });
    }
  });
  dialog.addEventListener('submit', event => {
    const form = event.target as HTMLFormElement;
    if (!form.matches('[data-comment-form]')) return;
    event.preventDefault();
    const input = form.querySelector<HTMLTextAreaElement>('textarea')!, button = form.querySelector<HTMLButtonElement>('button')!;
    const message = input.value.trim();
    if (!message) return;
    if (!isClean(message)) { status(copy.keepClean); return; }
    button.disabled = true; status(copy.posting);
    void sync.postComment(lessonId, message).then(result => {
      button.disabled = false;
      if (result === 'ok') { input.value = ''; status(copy.posted); void load(); return; }
      status(result === 'invalid' ? copy.invalid : result === 'limit' ? copy.limit : copy.offline);
    });
  });

  return {
    open(id: string) {
      lessonId = id; rows = []; menuFor = null;
      const alias = settings().displayAlias;
      dialog.innerHTML = `<div class="lane-about-panel lane-comments-panel">
        <div class="lane-sheet-head"><h2 id="lane-comments-title">${copy.title}</h2><form method="dialog"><button class="lane-close" aria-label="${copy.close}">×</button></form></div>
        ${sync.configured ? `<ol class="lane-comments-list" aria-label="${copy.title}" data-comment-list></ol>
          <form class="lane-comments-form" data-comment-form><label class="home-sr-only" for="lane-comment-input">${copy.add}</label>
            <textarea id="lane-comment-input" maxlength="300" rows="2" placeholder="${copy.add}"></textarea><button class="ui-button" type="submit">${copy.post}</button></form>
          <p class="lane-comments-as">${alias ? copy.postingAs(esc(alias)) : copy.postingAnonymous}</p>
          <p class="lane-comments-status" role="status" data-comment-status></p>`
        : `<p class="lane-comments-empty">${copy.comingSoon}</p>`}</div>`;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('.lane-close')?.focus();
      if (sync.configured) void load();
    },
  };
}
