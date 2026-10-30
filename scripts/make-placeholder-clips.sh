#!/usr/bin/env bash
# Usage: make-placeholder-clips.sh <id> <hex> "<label>"
# Produces public/clips/<id>.webm (VP9), <id>.mp4 (H.264), <id>.jpg poster. 4 s, 720x1280, silent.
set -euo pipefail
id="${1:?id}"; hex="${2:?hex colour, e.g. 6b2bff}"; label="${3:?label}"
hex="${hex#\#}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/public/clips"; mkdir -p "$out"
FFMPEG="${FFMPEG:-$(command -v ffmpeg || echo /opt/homebrew/bin/ffmpeg)}"

# Homebrew ffmpeg has no drawtext, so the big label is painted as drawbox cells (scripts/label-filter.mjs).
# Order: label first on the source frame, then zoompan scales label+gradient together (slow zoom).
labels="$(node "$root/scripts/label-filter.mjs" "$label" 720 1280)"
filter="${labels},zoompan=z='1+0.0008*on':d=1:s=720x1280:fps=25,format=yuv420p"
src="gradients=s=720x1280:c0=0x${hex}:c1=0x101018:x0=0:y0=0:x1=720:y1=1280:d=4:r=25"

"$FFMPEG" -y -loglevel error -f lavfi -i "$src" -vf "$filter" -t 4 -an \
  -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 "$out/$id.webm"
"$FFMPEG" -y -loglevel error -f lavfi -i "$src" -vf "$filter" -t 4 -an \
  -c:v libx264 -crf 30 -preset slow -movflags +faststart "$out/$id.mp4"
"$FFMPEG" -y -loglevel error -i "$out/$id.mp4" -frames:v 1 -q:v 5 "$out/$id.jpg"
ls -l "$out/$id".{webm,mp4,jpg}
