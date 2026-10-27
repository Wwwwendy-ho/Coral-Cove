# Builds the English headword list: words in her decks + the most common English words, as dictionary forms.
import json, re, sys, wordfreq
from nltk.corpus.reader.wordnet import WordNetCorpusReader
DL, SEED = sys.argv[1], sys.argv[2]
wn = WordNetCorpusReader(DL + '/nltk/corpora/wordnet', None)
def lemma(w):
    for pos in ('n', 'v', 'a', 'r'):
        m = wn.morphy(w, pos)
        if m and m != w and wordfreq.zipf_frequency(m, 'en') > 0: return m
    return w
s = open(SEED, encoding='utf8').read()
seed = json.loads(s[s.index('CORAL_COVE_SEED =') + 17:s.rindex(';')])
deck = set()
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ('front', 'back', 'text', 'answer', 'question', 'sentence', 'title') and isinstance(v, str):
                for w in re.findall(r"[A-Za-z]+(?:'[a-z]+)?", re.sub(r'<[^>]+>', ' ', v)):
                    if len(w) > 1 or w in ('a', 'I'): deck.add(w.lower())
            else: walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(seed)
common, seen = [], set()
for w in wordfreq.top_n_list('en', 12000):
    if not re.fullmatch(r"[a-z]+", w): continue
    l = lemma(w)
    if l not in seen: seen.add(l); common.append(l)
    if len(common) >= 5000: break
deckl = sorted({lemma(w) for w in deck if "'" not in w})
allw = list(dict.fromkeys(common + [w for w in deckl if w not in seen]))
json.dump({'common': common, 'deck': deckl, 'all': allw}, open('en_words.json', 'w'))
print(len(common), len(deckl), len(allw), [w for w in deckl if w not in seen][:60])
