// Renders a coach answer: escaped text with paragraphs, "- " or "1." lists and **bold** only, the
// subset the coach is asked to write. Everything else stays literal text.

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const inline = (text: string) => esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export function formatAnswer(text: string): string {
  let html = '', open: 'p' | 'ul' | 'ol' | null = null;
  const close = () => { if (open) html += `</${open}>`; open = null; };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (bullet) {
      if (open !== 'ul') { close(); html += '<ul>'; open = 'ul'; }
      html += `<li>${inline(bullet[1])}</li>`;
    } else if (numbered) {
      if (open !== 'ol') { close(); html += numbered[1] === '1' ? '<ol>' : `<ol start="${Number(numbered[1])}">`; open = 'ol'; }
      html += `<li>${inline(numbered[2])}</li>`;
    } else {
      // Headings aren't part of the coach's style; show their words as a plain line.
      const words = inline(line.replace(/^#{1,6}\s+/, ''));
      if (open === 'p') html += `<br>${words}`;
      else { close(); html += `<p>${words}`; open = 'p'; }
    }
  }
  close();
  return html;
}
