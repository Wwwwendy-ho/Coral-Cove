# Joins the parts into words-data.js: child-friendly English (defs/d*.json), WordNet backup, word forms, Chinese.
import glob, json, sys
en, skip = {}, set()
for f in sorted(glob.glob('defs/d*.json')):
    d = json.load(open(f))
    skip |= set(d.get('skip', []))
    for w, ss in d['defs'].items():
        en[w] = [{'pos': s['pos'], 'def': s['def'], 'ex': s.get('ex', '')} for s in ss[:2]]
for w, ss in json.load(open('overrides.json')).items():  # checked by hand
    en[w] = ss; skip.discard(w)
wn = json.load(open('en_wn.json'))
enwn = {w: v for w, v in wn['w'].items() if w not in en and w not in skip}
forms = {f: l for f, l in wn['f'].items() if (l in en or l in enwn) and f not in en}
IRREG = {'am': 'be', 'is': 'be', 'are': 'be', 'was': 'be', 'were': 'be', 'been': 'be', 'has': 'have', 'had': 'have', 'does': 'do', 'did': 'do', 'done': 'do',
         'went': 'go', 'gone': 'go', 'goes': 'go', 'saw': 'see', 'seen': 'see', 'ate': 'eat', 'eaten': 'eat', 'made': 'make', 'said': 'say', 'got': 'get', 'took': 'take', 'came': 'come', 'knew': 'know', 'thought': 'think', 'told': 'tell', 'found': 'find', 'gave': 'give', 'felt': 'feel', 'left': 'leave', 'kept': 'keep', 'ran': 'run', 'sat': 'sit', 'stood': 'stand', 'wrote': 'write', 'bought': 'buy', 'brought': 'bring', 'caught': 'catch', 'taught': 'teach', 'slept': 'sleep', 'woke': 'wake', 'drank': 'drink', 'sang': 'sing', 'began': 'begin', 'flew': 'fly', 'drew': 'draw', 'grew': 'grow', 'threw': 'throw', 'fell': 'fall', 'held': 'hold', 'met': 'meet', 'paid': 'pay', 'sent': 'send', 'spent': 'spend', 'built': 'build', 'lost': 'lose', 'won': 'win', 'heard': 'hear', 'mice': 'mouse', 'geese': 'goose', 'teeth': 'tooth', 'feet': 'foot', 'men': 'man', 'women': 'woman', 'people': 'person'}
for f, l in IRREG.items():
    if f not in en and l in en: forms[f] = l
zh = json.load(open('zh_data.json'))
data = {'en': en, 'enwn': enwn, 'enf': forms, 'zh': zh}
body = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
head = ('/* Coral Cove offline dictionary for Ask Shelly. Built ' + sys.argv[1] + '.\n'
  '   English child-friendly definitions: written for Coral Cove. English backup definitions: WordNet 3.0, Princeton University (WordNet licence).\n'
  '   Chinese words and meanings: CC-CEDICT (https://cc-cedict.org), licensed CC BY-SA 4.0; this file\'s Chinese part is shared under the same licence.\n'
  '   Character parts: cjk-decomp by Aaron Madlon-Kay (Apache License 2.0). */\n')
open('words-data.js', 'w').write(head + 'window.CORAL_WORDS = ' + body + ';\n')
open('words-data.json', 'w').write(body)
print(len(en), len(skip), len(enwn), len(forms), round(len(body.encode()) / 1e6, 2), 'MB')
