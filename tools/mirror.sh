#!/bin/sh
# Copies the site into coral-cove/, the copy kept for devices that saved the older address ending in
# /coral-cove/. Run it after changing any of these files (tools/check/run.sh fails if the two differ).
cd "$(dirname "$0")/.." || exit 1
for f in index.html library.js words.js words-data.js storage.js sw.js seed-data.js audio-clips.js reef-models.js three.min.js \
         manifest.webmanifest icon-180.png icon-192.png icon-512.png README.md CHANGELOG.md \
         day-song.mp3 night-song.mp3 lobby-song.mp3 deck-song.mp3 timer-song.mp3 game-song.mp3 win.mp3; do
  cp "$f" "coral-cove/$f"
done
rm -rf coral-cove/voice && cp -R voice coral-cove/voice
rm -rf coral-cove/vocab-pics && cp -R vocab-pics coral-cove/vocab-pics
echo "coral-cove/ now matches the site"
