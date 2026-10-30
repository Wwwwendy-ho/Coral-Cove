"""Step 1 of 3. Collect the English sentences Coral Cove speaks that have no natural-voice clip yet. Writes phrases.json (in the current folder): [[key, text_to_say, variant], ...]"""
import re, json, subprocess, sys
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
APP = os.path.join(ROOT, 'index.html')
ix = json.load(open(os.path.join(ROOT, 'voice', 'index.json')))['clips']

def key(t):
    t = t.strip().lower()
    t = re.sub(r'^[^\w]+|[^\w]+$', '', t, flags=re.U); return re.sub(r'\s+', ' ', t)
def sentences(t):   # same split the app uses (see Speech.parts)
    t = re.sub(r'<[^>]+>', ' ', t); t = re.sub(r'[\U0001F000-\U0001FFFF☀-➿️]', '', t)
    return [s.strip() for s in re.split(r'(?<=[.!?:])\s+', t) if s.strip()]
def literals(src):
    out = []
    for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"", src):
        s = m.group(1) if m.group(1) is not None else m.group(2)
        s = s.replace("\\'", "'").replace('\\"', '"').replace('\\n', ' ')
        out.append(s)
    return out
def natural(s):
    if len(s) < 4 or len(s) > 260: return False
    if re.search(r'[<>{}=;#\[\]\\|]|\.js|\.mp3|px\b|^\w+-\w+$|https?:|\$\{|&\w+;', s): return False
    if re.search(r'[가-힣㐀-鿿]', s): return False
    words = re.findall(r"[A-Za-z']+", s)
    if len(words) < 2: return False
    letters = sum(c.isalpha() for c in s)
    return letters / max(1, len(s)) > .6

want = {}   # key -> (text, variant)
def add(text, variant='n', say=None):
    for s in sentences(text):
        k = key(s)
        if not k or not re.search(r'[a-z0-9]', k): continue
        if (variant == 'n' and ('n|' + k) in ix) or (variant + '|' + k) in ix: continue
        want.setdefault((variant, k), say or s)

# 1. the Library's own words: tutor scripts, facts, questions of the day, talks, role-plays, debates, maths tips, feedback
lib = open(os.path.join(ROOT, 'library.js')).read()
lib = lib[lib.index('TUTOR.'):lib.index("CSS += ")]   # the tutor, worksheets, feedback and maths lab (not the settings or styles)
for s in literals(lib):
    if natural(s): add(s)
# 2. the app's fixed lines: praise, sea friends' facts, minigame instructions, hints, Shelly's lines
app = open(APP).read()
def block(start, end_pat=r'\n  \];|\];\n'):
    i = app.index(start); j = re.search(end_pat, app[i:]).end() + i; return app[i:j]
for b in ['var REEF_PRAISE', 'var REEF_FRIENDS', 'var REEF_GAMES']:
    for s in literals(block(b)):
        if natural(s): add(s)
for s in ['Ready to practice.', 'All done. Tap to play again.', 'Everything is done! Pick any spot to play again.', 'Shelly says:', 'Lumi says:',
          'Not quite.', 'Try again. You can tap Hint for help.', 'Yay!', "Let's look together.", 'Next stop!', 'How many numbers did you count?']:
    add(s)
for n in range(3, 31): add('Hint: start at %d.' % n); add('Count up to %d.' % n)
# 3. deck names and "let's dive into" lines, from the seed decks
seed = subprocess.run(['node', '-e', "global.window={};require(process.argv[1]);const S=window.CORAL_COVE_SEED;console.log(JSON.stringify(Object.keys(S).filter(k=>/\\/decks\\/[^/]+$/.test(k)).map(k=>S[k].name)))", os.path.join(ROOT, 'seed-data.js')], capture_output=True, text=True).stdout
for name in set(json.loads(seed)):
    if re.search(r'[가-힣㐀-鿿]', name): continue
    clean = re.sub(r'\s*\(.*?\)', '', name).replace('___', 'blank').strip()
    add(name, say=clean); add("Let's dive into %s!" % name, say="Let's dive into %s!" % clean)
for z in ['Kelp Library', 'Number Reef', 'Lantern Reef', 'Bubble Lab', 'Sandy Town', 'Coral Garden', 'The Reef', "Captain's Library", 'Cargo Hold', 'Lantern Deck', 'Engine Room', 'Galley', "Crow's Nest", 'The Wreck']:
    add("It's in the %s." % z.replace('The ', '')); add(z + '.')
# 4. maths cards: "3 + 4" read as "3 plus 4", numbers, and the equation feed's "3 plus 4 equals 7" at its slower pace
for a in range(0, 11):
    for b in range(0, 11):
        add('%d + %d' % (a, b), say='%d plus %d' % (a, b))
        add('%d plus %d equals %d' % (a, b, a + b), variant='eq')
    add('%d + ___' % a, say='%d plus what' % a)
for n in range(0, 101): add(str(n)); add("It's %d." % n)
for r in range(0, 21):
    for t in range(1, 21):
        if r <= t: add('%d out of %d!' % (r, t)); add('%d out of %d.' % (r, t))
out = [[v + '|' + k, txt, v] for (v, k), txt in sorted(want.items())]
json.dump(out, open('phrases.json', 'w'), ensure_ascii=False, indent=0)
print(len(out), 'phrases;', sum(len(t) for _, t, _ in out), 'characters')
for row in out[::max(1, len(out) // 25)]: print('  ', row[0][:70], '|', row[1][:60])
