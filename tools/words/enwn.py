# Backup English definitions from WordNet for common words that have no child-friendly definition yet.
# Shortened to the first clause of the most common sense and filtered for anything unsuitable for a child.
import json, re, sys, wordfreq
from nltk.corpus.reader.wordnet import WordNetCorpusReader
DL = sys.argv[1]
wn = WordNetCorpusReader(DL + '/nltk/corpora/wordnet', None)
ADULT = re.compile(r'sex|penis|vagina|genital|prostitut|whore|bitch|fuck|porn|erotic|opium|heroin|cocaine|marijuana|testic|breast|orgasm|derog|offensive|obscen|vulgar|slang|pimp|brothel|adulter|lewd|nude|naked|masturb|condom|scrotum|anus|buttock|bastard|semen|copulat|intercourse|rape|suicide|torture|excret|feces|urin', re.I)
POS = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
kid = set(json.load(open('en_words.json'))['all'])
out, forms = {}, {}
for w in wordfreq.top_n_list('en', 60000):
    if len(out) >= 20000: break
    if not re.fullmatch(r'[a-z]{2,}', w): continue
    lems = [m for m in (wn.morphy(w, p) for p in 'nvar') if m]
    if not lems: continue
    lem = lems[0]
    base = next((m for m in lems if m != w and m in kid), None) or next((m for m in lems if m != w), None)
    if base: forms[w] = base  # "running" -> "run", even though WordNet also lists "running" as a noun
    if lem in kid or lem in out: continue
    syns = wn.synsets(lem)
    cnt = lambda s: sum(l.count() for l in s.lemmas() if l.name() == lem)
    if syns and max(cnt(x) for x in syns) >= 3: syns = sorted(syns, key=lambda x: -cnt(x))  # WordNet's own order unless usage counts are clear
    if not syns or any(ADULT.search(s.definition()) for s in syns[:3]) or ADULT.search(lem): continue
    s = syns[0]
    g = re.sub(r'\([^)]*\)', '', s.definition().split(';')[0]).strip()
    g = re.sub(r'\s+', ' ', g)
    if 3 <= len(g) <= 150: out[lem] = [POS[s.pos()], g]
forms = {k: v for k, v in forms.items() if v in out or v in kid}
json.dump({'w': out, 'f': forms}, open('en_wn.json', 'w'), separators=(',', ':'))
print(len(out), len(forms), round(len(json.dumps({'w': out, 'f': forms}, separators=(',', ':'))) / 1e6, 2), 'MB')
for k in ['otter', 'galaxy', 'volcano', 'kangaroo', 'telescope', 'gigantic', 'sprint']: print(k, out.get(k))
