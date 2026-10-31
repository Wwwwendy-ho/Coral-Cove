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

## Korean

Korean lines that have no clip from the Claude version (the role-plays and their hints, for Coral Classroom) are
made with the SNAP Piper Korean voice (`softguy777/snap_piper_korean_22k` on Hugging Face, Apache 2.0), file
`snap_female12_kind_22k.onnx`, speaker 2 ("20s, bright and friendly"). The voice reads Korean pronunciation, not
spelling, so `ko_g2p.py` turns each phrase into its pronunciation first with g2pkk (감사합니다 → 감사함니다), word by
word and without MeCab. In a folder holding the model, its `.onnx.json` and a `phrases.json` of `[key, text, "ko"]`
rows:

    pip install piper-tts g2pkk onnxruntime numpy
    python3 path/to/tools/voice/gen_ko.py phrases.json   # -> clips/ (MP3, 24 kHz mono, 64 kb/s)
    python3 path/to/tools/voice/pack.py                  # -> a new pack in voice/ and an updated voice/index.json
