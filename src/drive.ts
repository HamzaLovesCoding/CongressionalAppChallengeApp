import { nextClip } from './feed/clips';
import { go, type View } from './navigation';

// Babylon is most of the bundle, so the simulator loads only when someone drives. The
// CSS is left out of the preload because it restyles the whole page once injected.
export const preloadDrive = () => import('./scene/createScene');

export function mountDrive(root: HTMLElement, clipId: string | undefined): View {
  let disposed = false;
  let lab: { dispose(): void } | null = null;
  const next = clipId ? nextClip(clipId) : undefined;
  const exit = () => go(next ? `#/feed/${next.id}` : clipId ? '#/progress' : '#/', true);
  Promise.all([preloadDrive(), import('./style.css')])
    .then(async ([{ createDrivingLab }]) => {
      if (disposed) return;
      lab = await createDrivingLab(root, exit);
      if (disposed) lab.dispose();
    })
    .catch(error => {
      console.error('Simulator failed to load', error);
      if (!disposed) root.innerHTML = '<main class="rl rl-screen"><div class="rl-screen-inner"><h1 class="rl-page-title">The simulator could not load.</h1><a class="rl-cta" href="#/">Back to the feed</a></div></main>';
    });
  return { dispose() { disposed = true; lab?.dispose(); } };
}
