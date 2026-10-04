export type View = { dispose(): void };

// Replace is for automatic hops (answered → drive → feed) so the back button
// returns to the feed instead of bouncing through a screen that redirects again.
export function go(hash: string, replace = false) {
  if (replace) location.replace(hash);
  else location.hash = hash;
}
