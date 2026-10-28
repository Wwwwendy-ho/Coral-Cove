"""Replaces the starting data (seed-data.js, audio-clips.js) with an export of the Claude artifact's database.

Use it when the decks made in the Claude version should become the starting decks on the GitHub copy. Devices
that already have Coral Cove keep their own progress: storage.js only adds documents a device doesn't have yet.

  python3 tools/export_seed.py <db-export-dir> <date YYYY-MM-DD> [Old=New]

<db-export-dir> holds one JSON file per database document, in folders that mirror the document paths
(profiles/<id>.json, settings/pin.json, ...). Old=New renames a word everywhere in the data (for example a
child's real name to "Child"); the export stops if the old word is still there afterwards. The date becomes the
seed version and the cache version, so every device fetches the new files. It then rebuilds index.html and
updates the coral-cove/ copy. Never put Coral Calendar records here.
"""
import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_db(root):
    docs = {}
    for f in sorted(root.rglob('*.json')):
        docs[f.relative_to(root).with_suffix('').as_posix()] = json.loads(f.read_text(encoding='utf-8'))
    if not any(p.startswith('profiles/') for p in docs):
        sys.exit('The database export has no profiles; refusing to write an empty app.')
    return docs


def rename(text, old, new):
    for a, b in [(old, new), (old.lower(), new.lower()), (old.upper(), new.upper())]:
        text = text.replace(a, b)
    return text


def main(dbdir, date, swap=None):
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        sys.exit('The date must look like 2026-10-28.')
    docs = load_db(pathlib.Path(dbdir))
    audio = {p: d for p, d in docs.items() if p.startswith('audio-clips/')}
    seed = {p: d for p, d in docs.items() if not p.startswith('audio-clips/')}
    seed_js = (f'/* Coral Cove starting data, exported from the Claude artifact on {date}. */\n'
               f'window.CORAL_COVE_SEED_VERSION = {json.dumps(date)};\n'
               f'window.CORAL_COVE_SEED = {json.dumps(seed, ensure_ascii=False, separators=(",", ":"))};\n')
    audio_js = ('/* Recorded pronunciation clips (read-only). */\n'
                f'window.CORAL_COVE_AUDIO = {json.dumps(audio, separators=(",", ":"))};\n')
    if swap:
        old, _, new = swap.partition('=')
        if not old or not new:
            sys.exit('The rename must look like Old=New')
        seed_js = rename(seed_js, old, new)
        if old.lower() in (seed_js + audio_js).lower():
            sys.exit(f'{old} is still in the data; nothing written.')
    v = date.replace('-', '')
    (ROOT / 'seed-data.js').write_text(seed_js, encoding='utf-8')
    (ROOT / 'audio-clips.js').write_text(audio_js, encoding='utf-8')
    # new file versions, so iPads fetch the new data instead of their saved copy
    for p in (ROOT / 'src' / 'page.html', ROOT / 'sw.js'):
        text = re.sub(r'(seed-data|audio-clips|storage)\.js\?v=\d+', lambda m: f'{m.group(1)}.js?v={v}', p.read_text(encoding='utf-8'))
        if p.name == 'sw.js':
            text = re.sub(r"var CACHE = 'coral-cove-[^']*';", f"var CACHE = 'coral-cove-{v}';", text)
        p.write_text(text, encoding='utf-8')
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'build.py')], check=True)
    subprocess.run(['sh', str(ROOT / 'tools' / 'mirror.sh')], check=True)
    print(f'Wrote {len(seed)} documents and {len(audio)} clips')


if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    main(*sys.argv[1:])
