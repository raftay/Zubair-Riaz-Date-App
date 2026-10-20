#!/usr/bin/env bash
# Render the film in resumable segments, then join them losslessly.
#   ./film.sh [out.mp4] [segment-seconds] [extra record.mjs args...]
# Finished segments are kept in out/parts/<name>/ and skipped on re-run,
# so an interrupted render picks up where it stopped.
set -euo pipefail
cd "$(dirname "$0")"
OUT=$(realpath -m "${1:-../out/film.mp4}")
SEG=${2:-10}
shift $(( $# > 2 ? 2 : $# ))
END=$(node -e "const c=require('./choreography.json');console.log(c.keys[c.keys.length-1].t)")
PARTS="$(dirname "$OUT")/parts/$(basename "$OUT" .mp4)"
mkdir -p "$PARTS"
LIST="$PARTS/list.txt"
: > "$LIST"
i=0
from=0
while awk "BEGIN{exit !($from < $END)}"; do
  to=$(awk "BEGIN{t=$from+$SEG; print (t>$END)?$END:t}")
  part=$(printf "%s/seg-%02d.mp4" "$PARTS" "$i")
  if [ ! -f "$part" ]; then
    echo "segment $i: ${from}s → ${to}s"
    node record.mjs --out "$part.tmp.mp4" --from "$from" --to "$to" "$@"
    mv "$part.tmp.mp4" "$part"
  fi
  echo "file '$part'" >> "$LIST"
  from=$to
  i=$((i + 1))
done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy -movflags +faststart "$OUT"
echo "wrote $OUT"
