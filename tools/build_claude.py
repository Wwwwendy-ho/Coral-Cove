"""Builds the Claude version of Coral Cove from this repository (the GitHub copy is the main one).

The Claude app shows one self-contained page: it can't load the side files GitHub Pages serves, and it runs
scripts only from a few CDNs. So this script takes index.html and:
  - removes the side-file scripts that only the GitHub copy uses (seed data, on-device storage, offline
    support, Home Screen icons). Inside Claude the app saves to the artifact's own database instead;
  - loads three.js from cdnjs instead of the local three.min.js;
  - puts inside the page what the GitHub copy loads from files: the 3D models (reef-models.js), the Library
    (library.js), Ask Shelly's word help (words.js and its dictionary words-data.js) and the songs. The songs
    are re-encoded at 56 kbps with ffmpeg so the page stays under Claude's 16 MB limit (the GitHub copy keeps
    full quality); without ffmpeg the originals are used, if they fit.
The voice packs (voice/) stay out: inside Claude the app falls back to the device's own voice.

Usage:  python3 tools/build_claude.py [output.html]        (default: build/coral-cove-claude.html)
Then publish the output to the Coral Cove artifact (see ARCHITECTURE.md, "The two copies").
"""
import base64, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
SONGS = ['day-song', 'night-song', 'lobby-song', 'deck-song', 'timer-song', 'game-song', 'win']
LIMIT = 16 * 1024 * 1024


def read(name):
    with open(os.path.join(ROOT, name), encoding='utf8') as f:
        return f.read()


def replace_once(html, old, new, what):
    n = html.count(old)
    if n != 1:
        sys.exit(f'build_claude: expected "{what}" exactly once in index.html, found {n}. Update this script.')
    return html.replace(old, new)


def script(code, what):
    if '</script' in code.lower():
        sys.exit(f'build_claude: {what} contains "</script", which would end the inline script early.')
    return '<script>\n' + code + '\n</script>\n'


def song_b64(name, tmp):
    src = os.path.join(ROOT, name + '.mp3')
    out = os.path.join(tmp, name + '.mp3')
    if name != 'win' and shutil.which('ffmpeg'):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-codec:a', 'libmp3lame', '-b:a', '56k', '-ac', '2', '-ar', '44100', out], check=True)
    else:
        out = src
    with open(out, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def main(out_path):
    html = read('index.html')

    # 1. side-file scripts and Home Screen tags only the GitHub copy uses
    head_only = [
        r'<meta name="mobile-web-app-capable"[^>]*>\n', r'<meta name="apple-mobile-web-app-status-bar-style"[^>]*>\n',
        r'<meta name="apple-mobile-web-app-title"[^>]*>\n', r'<meta name="theme-color"[^>]*>\n',
        r'<link rel="manifest"[^>]*>\n', r'<link rel="apple-touch-icon"[^>]*>\n', r'<link rel="icon"[^>]*>\n',
        r'<script src="seed-data\.js[^"]*"></script>\n', r'<script src="audio-clips\.js[^"]*"></script>\n',
        r'<script src="storage\.js[^"]*"></script>\n', r'<script src="library\.js[^"]*"[^>]*></script>\n',
        r'<script src="words\.js[^"]*"[^>]*></script>\n', r"<script>if\('serviceWorker' in navigator\).*?</script>\n",
    ]
    for pat in head_only:
        html, n = re.subn(pat, '', html, count=1)
        if n != 1:
            sys.exit(f'build_claude: did not find {pat!r} in index.html. Update this script.')

    # 2. three.js from the CDN
    html = replace_once(html, "var REEF_THREE_URL = 'three.min.js';", f"var REEF_THREE_URL = '{THREE_CDN}';", 'REEF_THREE_URL')

    # 3. what the GitHub copy loads from files, inside the page
    parts = []
    parts.append('<script id="reef-models-inline">\n' + read('reef-models.js') + '\n</script>\n')
    with tempfile.TemporaryDirectory() as tmp:
        for name in SONGS:
            parts.append(f'<script type="text/plain" id="reef-song-{name}" data-type="audio/mpeg">{song_b64(name, tmp)}</script>\n')
    parts.append(script('/* The Library (library.js, inlined: the Claude app cannot load side scripts) */\n' + read('library.js'), 'library.js'))
    data = read('words-data.js')
    data = data[data.index('window.CORAL_WORDS = ') + len('window.CORAL_WORDS = '):data.rindex(';')]
    json.loads(data)   # it must be plain JSON to go into a JSON script tag
    parts.append('<script type="application/json" id="coralWordsData">' + data.replace('</', '<\\/') + '</script>\n')
    parts.append(script('/* Ask Shelly offline word help (words.js, inlined) */\n' + read('words.js'), 'words.js'))
    end = html.rindex('</body></html>')
    html = html[:end] + ''.join(parts) + html[end:]

    size = len(html.encode('utf8'))
    if size > LIMIT:
        sys.exit(f'build_claude: the page is {size / 1e6:.1f} MB, over the 16 MB limit for Claude artifacts.')
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w', encoding='utf8') as f:
        f.write(html)
    print(f'build_claude: wrote {out_path} ({size / 1e6:.1f} MB)')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'coral-cove-claude.html'))
