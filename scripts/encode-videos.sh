#!/bin/zsh
# Re-encodes lesson clips for phones and writes each clip's first-frame poster.
#
# The source clips mix H.264, VP9 and AV1 at 1080p and up to 5 Mbps. Most iPhones can't play VP9 or AV1
# in MP4, and the bitrate slowed every start on mobile data. Output: H.264 High / AAC MP4, 720px wide,
# 30 fps, ~1–1.8 Mbps, moov atom first (faststart) so playback starts before the download finishes.
#
# Usage: FFMPEG=/path/to/ffmpeg scripts/encode-videos.sh <source.mp4> <lesson-id> [...more pairs]
# Sources are the original clips (AppMaterial/Videos.zip, kept outside git); extract only the clips being encoded.
set -euo pipefail
FFMPEG=${FFMPEG:-ffmpeg}
cd "${0:A:h}/.."
while (( $# >= 2 )); do
  src=$1 id=$2; shift 2
  "$FFMPEG" -hide_banner -loglevel error -y -i "$src" \
    -vf "scale='min(720,iw)':-2:flags=lanczos,fps=30" \
    -c:v libx264 -preset slow -crf 23 -maxrate 1600k -bufsize 3200k -profile:v high -level 4.0 -pix_fmt yuv420p \
    -g 60 -keyint_min 30 -c:a copy -movflags +faststart "public/videos/$id.mp4"
  "$FFMPEG" -hide_banner -loglevel error -y -i "public/videos/$id.mp4" -frames:v 1 \
    -vf "scale=480:-2:flags=lanczos" -q:v 6 "public/images/lessons/posters/$id.jpg"
  echo "encoded $id"
done
