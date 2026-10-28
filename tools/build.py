"""Builds index.html from the files in src/.

The app's code lives in src/: src/page.html is the page, and each line in it like
    <!-- include: js/learning.js -->
is replaced with that file (paths are relative to src/), between two comment lines:
    /* from src/js/learning.js */ ... /* end of src/js/learning.js */
The result is one index.html, which is what GitHub Pages serves and what tools/build_claude.py turns into the
Claude version. The comment lines show which file to edit, and let the check tools give src/ line numbers.

The script files are pieces of one function (page.html opens it before the first include and closes it after
the last), so they share their variables exactly as when everything was one file. That is why they are joined
here instead of loaded as separate <script> files.

Usage:  python3 tools/build.py            write index.html
        python3 tools/build.py --check    only check that index.html matches src/ (tools/check/run.sh does this)
        python3 tools/build.py --unbuild  copy changes a tool made to index.html back into src/ (used by
                                          tools/check/cssedit.py; edit src/ yourself, not index.html)
After building, run sh tools/mirror.sh to update the coral-cove/ copy.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'index.html')
INCLUDE = re.compile(r'^<!-- include: (\S+) -->$')
FROM = re.compile(r'^/\* from src/(\S+) \*/$')


def src_path(name, where):
    path = os.path.normpath(os.path.join(SRC, name))
    if not path.startswith(SRC + os.sep) or not os.path.isfile(path):
        sys.exit(f'build: {where} includes {name}, which is not a file in src/.')
    return path


def build(texts=None):
    """Returns the page; texts can supply new contents for some files ({'js/learning.js': '...'})."""
    with open(os.path.join(SRC, 'page.html'), encoding='utf8') as f:
        lines = f.read().split('\n')
    out = []
    for n, line in enumerate(lines, 1):
        m = INCLUDE.match(line)
        if not m:
            out.append(line)
            continue
        name = m.group(1)
        path = src_path(name, f'src/page.html line {n}')
        if texts and name in texts:
            text = texts[name]
        else:
            with open(path, encoding='utf8') as f:
                text = f.read()
        out += ['/* from src/' + name + ' */', text[:-1] if text.endswith('\n') else text, '/* end of src/' + name + ' */']
    return '\n'.join(out)


def unbuild():
    with open(OUT, encoding='utf8') as f:
        lines = f.read().split('\n')
    texts, i = {}, 0
    while i < len(lines):
        m = FROM.match(lines[i])
        if m:
            name, end = m.group(1), '/* end of src/' + m.group(1) + ' */'
            if end not in lines[i:]:
                sys.exit(f'build: index.html has no "{end}" line.')
            j = lines.index(end, i)
            texts[name] = '\n'.join(lines[i + 1:j]) + '\n'
            i = j
        i += 1
    if build(texts) != '\n'.join(lines):   # checked before writing anything
        sys.exit('build: index.html was changed outside the included files. Make that change in src/page.html.')
    for name, text in texts.items():
        with open(src_path(name, 'index.html'), 'w', encoding='utf8') as f:
            f.write(text)
    print('build: copied index.html back into src/')


def main():
    if '--unbuild' in sys.argv[1:]:
        return unbuild()
    html = build()
    if '--check' in sys.argv[1:]:
        with open(OUT, encoding='utf8') as f:
            current = f.read()
        if current != html:
            sys.exit('build: index.html does not match src/. Edit the files in src/, then run python3 tools/build.py.')
        print('build: index.html matches src/')
        return
    with open(OUT, 'w', encoding='utf8') as f:
        f.write(html)
    print(f'build: wrote index.html ({len(html.encode("utf8")) / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
