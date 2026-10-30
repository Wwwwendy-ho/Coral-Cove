"""Step 3 of 3. Bundle the new clips into pack files (about 2.5 MB each, numbers/maths apart from talk) and add them to voice/index.json."""
import json, re, hashlib, os
V = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'voice') + os.sep
ix = json.load(open(V + 'index.json'))
done = json.load(open('clips/done.json'))
rows = json.load(open('phrases.json'))
mathy = lambda k: bool(re.match(r"^(eq\||n\|(\d+( \+ (\d+|___))?|it's \d+|\d+ out of \d+|\d+ plus \d+.*)$)", k))
new = [r for r in rows if r[0] in done and r[0] not in ix['clips']]   # only clips the index doesn't have yet
groups = {'num': [r for r in new if mathy(r[0])], 'talk': [r for r in new if not mathy(r[0])]}
LIMIT = 2_500_000
existing = set(ix['packs'])
added = 0
for g, rs in groups.items():
    n = 1; buf = b''; members = []
    pack_rows = []
    cur = []; size = 0
    for r in rs:
        b = open(done[r[0]], 'rb').read()
        if size + len(b) > LIMIT and cur: pack_rows.append(cur); cur = []; size = 0
        cur.append((r[0], b)); size += len(b)
    if cur: pack_rows.append(cur)
    first = 1 + max([int(m.group(1)) for m in (re.match(r'en-%s-(\d+)\.mp3$' % g, n) for n in ix['packs']) if m] or [0])
    for i, pr in enumerate(pack_rows):
        name = 'en-%s-%d.mp3' % (g, first + i)   # new packs after the existing ones: earlier packs never change
        if name not in ix['packs']: ix['packs'].append(name)   # a rebuilt pack keeps its number, so older entries stay valid
        p = ix['packs'].index(name)
        data = b''
        for key, b in pr:
            ix['clips'][key] = [p, len(data), len(b)]; data += b; added += 1
        open(V + name, 'wb').write(data)
        print(name, len(pr), 'clips', round(len(data) / 1e6, 2), 'MB')
ix['v'] = hashlib.sha1(json.dumps(ix['clips'], sort_keys=True).encode()).hexdigest()[:10]
json.dump(ix, open(V + 'index.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('added', added, 'clips; index now', len(ix['clips']))
