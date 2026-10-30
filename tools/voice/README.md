# Natural voice for the app's own words

Coral Cove reads things aloud with recorded natural-voice clips (`voice/*.mp3`, listed in `voice/index.json`) and
only falls back to the device's own voice for text that has no clip. Cards' words came with the Claude version.
These scripts add clips for everything else the app says: praise, hints, Shelly's lines, sea-friend facts, the
Library's tutor, talks, role-plays, maths tips and feedback, deck names, and the maths cards ("3 + 4", "3 plus 4
equals 7").

The voice is Kokoro (Apache 2.0) with its `af_heart` voice, the closest match to the existing clips. Clips are
MP3, 24 kHz mono, 64 kb/s, bundled into packs of about 2.5 MB named `en-num-N.mp3` (numbers and sums) and
`en-talk-N.mp3` (everything else). `tools/sync_from_artifact.py` keeps these packs when it copies the Claude
version's `voice/` folder.

Run from an empty working folder, after `pip install kokoro-onnx soundfile` and downloading `kokoro-v1.0.onnx` and
`voices-v1.0.bin` from the kokoro-onnx releases:

    python3 path/to/tools/voice/harvest.py   # -> phrases.json: sentences that have no clip yet
    python3 path/to/tools/voice/gen.py       # -> clips/ (about 1.5 s per sentence on a laptop CPU)
    python3 path/to/tools/voice/pack.py      # -> new packs in voice/ and an updated voice/index.json

The app looks clips up sentence by sentence, so a line like "Shelly says: Let's dive into Soccer Practice!"
plays as two natural clips.
