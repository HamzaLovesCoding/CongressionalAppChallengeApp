Posters for the lesson videos in `public/videos/`, one per lesson ID.

Each is the first frame of that lesson's re-encoded clip (480px wide JPEG), written by
`scripts/encode-videos.sh`. The feed shows it the moment a clip scrolls into view, before the
video has data, so it must stay the clip's exact first frame: a different still would jump when
playback starts. `freeway-entry.jpg` is white because that clip opens with a fade from white.

Same source and license as the clips themselves (see each lesson's `credit` in `src/feed/curriculum.ts`).
