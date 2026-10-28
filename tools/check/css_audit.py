"""Style audit for index.html. Reports, and exits with 1 if it finds any:
   - class names used in the styles but nowhere in the page or scripts (a class the code builds from parts,
     like 'reef-tx-' + kind, counts as used);
   - [data-x="value"] selectors whose value is never set;
   - @keyframes nothing uses;
   - values a later rule with the identical selector always overrides (cssedit.py dead removes them).
   Usage: python3 css_audit.py            (needs: pip install tinycss2)"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cssedit

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

def main():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()
    css = ''.join(m.group(2) for m in re.finditer(r'(<style[^>]*>)(.*?)</style>', html, re.S))
    code = re.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=re.S) + open(os.path.join(ROOT, 'library.js'), encoding='utf8').read()
    found = 0

    def used(name):
        if re.search(r'(?<![\w-])' + re.escape(name) + r'(?![\w-])', code): return True
        for i in range(len(name) - 1, 0, -1):   # built from a prefix: 'c-' + kind, `cw-${x}`
            if name[i - 1] == '-' and re.search(re.escape(name[:i]) + r"""(['"]\s*\+|\$\{)""", code): return True
        return False

    classes = sorted(set(re.findall(r'\.([A-Za-z][\w-]*)(?=[^{}]*\{)', re.sub(r'/\*.*?\*/', '', css, flags=re.S))))
    for c in classes:
        if not re.match(r'^[0-9a-fA-F]{3,8}$', c) and not used(c):
            found += 1; print('unused class:', c)
    for attr, val in sorted(set(re.findall(r'\[(data-[\w-]+)="([^"]+)"\]', css))):
        camel = re.sub(r'-(\w)', lambda m: m.group(1).upper(), attr[5:])
        if not any(p in code for p in (attr + '="' + val, attr + "='" + val, attr + '=\\"' + val, 'dataset.' + camel)):
            found += 1; print(f'never set: [{attr}="{val}"]')
    for k in cssedit.unused_keyframes(html):
        found += 1; print('unused @keyframes:', k)
    _, n = cssedit.apply(html, cssedit.dead())
    if n:
        found += 1; print(f'{n} rule(s) have values a later identical rule overrides: run  python3 tools/check/cssedit.py dead')
    print('css audit: clean' if not found else f'{found} finding(s)')
    return 1 if found else 0

if __name__ == '__main__':
    sys.exit(main())
