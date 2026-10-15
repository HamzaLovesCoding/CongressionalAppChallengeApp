IBM Plex Sans, self-hosted under the SIL Open Font License 1.1 (`ibm-plex-OFL.txt`).

- `ibm-plex-sans-var-latin1.woff2`: `fonts/split/woff2/IBM Plex Sans Var-Roman-Latin1.woff2`
- `ibm-plex-sans-var-pi.woff2`: `fonts/split/woff2/IBM Plex Sans Var-Roman-Pi.woff2` (arrows, check mark)

Both come unmodified (renamed only) from IBM's npm package `@ibm/plex-sans-variable` 0.2.0
(https://github.com/IBM/plex). `src/feed/feed.css` declares them with IBM's own `unicode-range`
values, so a page downloads only the subsets it uses. Replaced the 537 KB TrueType file on
October 13, 2026 because it delayed first video playback on mobile data.
