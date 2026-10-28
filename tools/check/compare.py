"""Compares two folders of screenshots from snapshots.js and lists the screens that differ.
   Usage: python3 compare.py <before-folder> <after-folder> [diff-folder]
   A screen counts as changed when more than 0.05% of its pixels differ by a visible amount.
   For each changed screen a picture is saved in diff-folder with the changed pixels in magenta."""
import sys, os, json, re
from PIL import Image, ImageChops

def main(a, b, out=None):
    changed = 0
    for name in sorted(f for f in os.listdir(a) if f.endswith('.png')):
        if not os.path.exists(os.path.join(b, name)):
            print('missing  ', name); changed += 1; continue
        x = Image.open(os.path.join(a, name)).convert('RGB'); y = Image.open(os.path.join(b, name)).convert('RGB')
        if x.size != y.size:
            print('size     ', name, x.size, y.size); changed += 1; continue
        d = ImageChops.difference(x, y).convert('L').point(lambda v: 255 if v > 24 else 0)
        n = d.histogram()[255]; share = n / (x.size[0] * x.size[1])
        if share > .0005:
            changed += 1; print('CHANGED  ', name, f'{share:.2%} of pixels')
            if out:
                os.makedirs(out, exist_ok=True)
                m = y.copy(); m.paste((255, 0, 255), mask=d); m.save(os.path.join(out, name))
        else:
            print('same     ', name)
    # computed styles (from snapshots.js): every element's style must be the same
    for name in sorted(f for f in os.listdir(a) if f.endswith('.styles.json')):
        if not os.path.exists(os.path.join(b, name)): continue
        x = json.load(open(os.path.join(a, name))); y = json.load(open(os.path.join(b, name)))
        diffs = [k for k in x if k in y and x[k] != y[k]]
        if diffs:
            changed += 1; print('STYLES   ', name, len(diffs), 'element(s) differ, e.g.', diffs[0][-80:])
            dx = dict(p.split(':', 1) for p in x[diffs[0]].split(';\n') if ':' in p); dy = dict(p.split(':', 1) for p in y[diffs[0]].split(';\n') if ':' in p)
            print('           ', [(k, dx.get(k), dy.get(k)) for k in set(dx) | set(dy) if dx.get(k) != dy.get(k)][:6])
        else: print('styles ok', name, len(x), 'elements')
    print(changed, 'screen(s) changed')
    return changed

if __name__ == '__main__':
    sys.exit(1 if main(*sys.argv[1:4]) else 0)
