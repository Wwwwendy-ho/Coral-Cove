"""Turn a download of the Coral Cove artifact into the GitHub Pages site.

Usage: python3 tools/sync_from_artifact.py <artifact-download-dir> <db-export-dir> <seed-date> [Old=New]

- artifact-download-dir: the artifact's published files (index.html, voice/...).
- db-export-dir: the artifact database exported as JSON, one file per document at
  <collection path>/<doc id>.json (the layout ArtifactData's out_dir writes).
- seed-date: YYYY-MM-DD, used as the seed version so devices pick up new decks.
- Old=New (optional): replace a name everywhere in the published copy (Old, old and OLD), including
  profile ids. Pass it on the command line so the original name is never stored in the repo.

Writes the site to the repo root and mirrors it into coral-cove/, because devices may have
either URL saved. storage.js (the on-device database) is kept as is. The iPad PIN changes in
tools/ipad_patches.py are applied to every build.
"""
import json
import pathlib
import shutil
import sys

import ipad_patches

REPO = pathlib.Path(__file__).resolve().parent.parent
TARGETS = [REPO, REPO / "coral-cove"]
SHARED = ["storage.js", "library.js", "three.min.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", ".nojekyll"]
THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
HEAD_TAGS = """<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Coral Cove">
<meta name="theme-color" content="#1c8c93">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<script src="seed-data.js?v={v}"></script>
<script src="audio-clips.js?v={v}"></script>
<script src="storage.js?v={v}"></script>
<script src="library.js?v={v}" defer></script>
<script>if('serviceWorker' in navigator){{addEventListener('load',function(){{navigator.serviceWorker.register('sw.js?v={v}').catch(function(){{}});}});}}</script>
"""


def load_db(root):
    docs = {}
    for f in sorted(root.rglob("*.json")):
        path = f.relative_to(root).with_suffix("").as_posix()
        docs[path] = json.loads(f.read_text(encoding="utf-8"))
    if not any(p.startswith("profiles/") for p in docs):
        sys.exit("The database export has no profiles; refusing to publish an empty app.")
    return docs


def rename(text, old, new):
    for a, b in [(old, new), (old.lower(), new.lower()), (old.upper(), new.upper())]:
        text = text.replace(a, b)
    return text


def main(src, dbdir, date, swap=None):
    src, dbdir = pathlib.Path(src), pathlib.Path(dbdir)
    html = (src / "index.html").read_text(encoding="utf-8")
    if "</head>" not in html or "seed-data.js" in html:
        sys.exit("index.html isn't a plain artifact download (no </head>, or already built).")
    # The cache-busting version changes with every sync so iPads fetch the new files.
    v = date.replace("-", "")
    html = html.replace("</head>", HEAD_TAGS.format(v=v) + "</head>", 1)
    html = ipad_patches.apply(html)
    # The 3D reef loads three.js from a CDN inside Claude; the iPad copy uses its own copy so it works offline.
    html = html.replace(THREE_CDN, "three.min.js")

    docs = load_db(dbdir)
    audio = {p: d for p, d in docs.items() if p.startswith("audio-clips/")}
    seed = {p: d for p, d in docs.items() if not p.startswith("audio-clips/")}
    seed_js = (f"/* Coral Cove starting data, exported from the Claude artifact on {date}. */\n"
               f"window.CORAL_COVE_SEED_VERSION = {json.dumps(date)};\n"
               f"window.CORAL_COVE_SEED = {json.dumps(seed, ensure_ascii=False, separators=(',', ':'))};\n")
    audio_js = ("/* Recorded pronunciation clips (read-only). */\n"
                f"window.CORAL_COVE_AUDIO = {json.dumps(audio, separators=(',', ':'))};\n")

    sw = (REPO / "sw.js").read_text(encoding="utf-8")
    sw = sw.replace(sw[sw.index("var CACHE"):sw.index("self.addEventListener")],
                    f"var CACHE = 'coral-cove-{v}';\n"
                    f"var FILES = ['./', 'index.html', 'seed-data.js?v={v}', 'audio-clips.js?v={v}', 'storage.js?v={v}',\n"
                    "             'library.js', 'three.min.js', 'reef-models.js', 'win.mp3', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];\n\n")

    # The offline list must only name files this build has, or the iPad's offline copy fails to install.
    for optional in ("reef-models.js", "win.mp3"):
        if not (src / optional).exists():
            sw = sw.replace(f"'{optional}', ", "")

    if swap:
        old, _, new = swap.partition("=")
        if not old or not new:
            sys.exit("The rename must look like Old=New")
        html, seed_js = rename(html, old, new), rename(seed_js, old, new)
        if old.lower() in (html + seed_js + audio_js).lower():
            sys.exit(f"{old} is still in the build; not writing it.")

    for t in TARGETS:
        t.mkdir(exist_ok=True)
        (t / "index.html").write_text(html, encoding="utf-8")
        (t / "seed-data.js").write_text(seed_js, encoding="utf-8")
        (t / "audio-clips.js").write_text(audio_js, encoding="utf-8")
        (t / "sw.js").write_text(sw, encoding="utf-8")
        shutil.rmtree(t / "voice", ignore_errors=True)
        shutil.copytree(src / "voice", t / "voice")
        if (src / "reef-models.js").exists():  # the 3D board's models (CC0), loaded when the board opens
            shutil.copy2(src / "reef-models.js", t / "reef-models.js")
        if (src / "win.mp3").exists():  # celebration music for right answers and finished decks
            shutil.copy2(src / "win.mp3", t / "win.mp3")
        for song in ("day-song.mp3", "night-song.mp3", "deck-song.mp3", "game-song.mp3"):  # background music (cached the first time it plays)
            if (src / song).exists():
                shutil.copy2(src / song, t / song)
        if t != REPO:
            for name in SHARED:
                shutil.copy2(REPO / name, t / name)
    print(f"Synced {len(seed)} documents and {len(audio)} clips into {', '.join(str(t) for t in TARGETS)}")


if __name__ == "__main__":
    if len(sys.argv) not in (4, 5):
        sys.exit(__doc__)
    main(*sys.argv[1:])
