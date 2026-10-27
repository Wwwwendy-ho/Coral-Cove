# Builds the offline Chinese data: traditional words (deck words + the most common words) with tone-mark pinyin,
# short everyday meanings, and each character's parts.
import json, re, sys, unicodedata, wordfreq
DL, SEED = sys.argv[1], sys.argv[2]
s = open(DL + '/cedict/package/data/all.js', encoding='utf8').read()
ced = json.loads(s[s.index('{'):])['all']
by_trad, simp2trad = {}, {}
for e in ced:
    by_trad.setdefault(e[0], []).append(e)
    simp2trad.setdefault(e[1], [])
    if e[0] not in simp2trad[e[1]]: simp2trad[e[1]].append(e[0])

TONES = {'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}
def syl(p):
    m = re.fullmatch(r'([a-zü:]+)([1-5])', p.lower().replace('u:', 'ü').replace('v', 'ü'))
    if not m: return p.lower()
    b, t = m.group(1), int(m.group(2))
    if t == 5: return b
    for v in ('a', 'e'):
        if v in b: return b.replace(v, TONES[v][t - 1], 1)
    if 'ou' in b: return b.replace('o', TONES['o'][t - 1], 1)
    for i in range(len(b) - 1, -1, -1):
        if b[i] in TONES: return b[:i] + TONES[b[i]][t - 1] + b[i + 1:]
    return b
def pinyin(p): return ' '.join(syl(x) for x in p.split())

DROP = re.compile(r'^(variant of|old variant|used in|surname|abbr\.|see |CL:|Kangxi radical|also pr\.|also written|erhua variant|(\(.*\) )?variant)', re.I)
LABEL = re.compile(r'\((idiom|bound form|literary|archaic|dialect|Tw|old|coll\.|colloquial|onom\.|loanword|in names)\)\s*', re.I)
ADULT = re.compile(r'cuckold|slang|vulgar|\bsex|sexual|kill oneself|penis|vagina|genital|prostitut|whore|bitch|fuck|porn|erotic|opium|heroin|testicle|breast|orgasm|derog|offensive|suicide|pimp|brothel|adulter|lewd|obscen|nude|naked|masturb|condom|scrotum|anus|buttock|ass\b|bastard|drunk', re.I)
def clean(d):
    d = re.sub(r'\[[^\]]*\]', '', d)
    d = re.sub(r'(\S+)\|(\S+)', lambda m: m.group(1), d)
    d = re.sub(r'\(?\s*(Taiwan|also) pr\.\s*\)?', '', d)
    d = re.sub(r'\bsth\b', 'something', re.sub(r'\bsb\b', 'someone', d))
    return re.sub(r'\s+', ' ', LABEL.sub('', d)).strip(' ;,')
def senses(es):
    out = []
    for e in es:
        ds = e[3] if isinstance(e[3], list) else [e[3]]
        for d in ds:
            if DROP.search(d) or ADULT.search(d) or re.search(r'\((literary|archaic)\)', d): continue
            c = clean(d)
            if c and c not in out and len(c) <= 40: out.append(c)
    if not out:  # nothing short: keep the first suitable sense, cut at its first clause
        for e in es:
            for d in (e[3] if isinstance(e[3], list) else [e[3]]):
                if DROP.search(d) or ADULT.search(d): continue
                c = re.split(r'[;(]', clean(d))[0].strip(' ,')
                if c: return [c[:60]]
    return out
def best(trad, depth=0):
    b = best0(trad)
    if b or depth: return b
    for e in by_trad.get(trad, []):  # "variant of 臺灣|台湾[Tai2 wan1]": use the main form's meaning
        ds = e[3] if isinstance(e[3], list) else [e[3]]
        m = re.match(r'^variant of (\S+?)(\||\[)', ds[0])
        if m and m.group(1) != trad: return best(m.group(1), 1)
    return None
def best0(trad):
    es = [e for e in by_trad.get(trad, []) if e[2][:1].islower()]
    proper = not es
    if proper: es = [e for e in by_trad.get(trad, []) if senses([e])]  # names of places, festivals, countries
    if not es: return None
    es.sort(key=lambda e: -len(senses([e])))  # the reading with the most everyday senses first
    m = senses(es[:1]) or senses(es)
    if not m: return None
    p = pinyin(es[0][2])
    if proper: p = p[:1].upper() + p[1:]
    return {'p': p, 'm': '; '.join([x.strip() for x in '; '.join(m).split(';') if x.strip()][:2])}

# words: deck words + common words
seed = open(SEED, encoding='utf8').read()
deck = set(re.findall(r'[一-鿿]+', seed))
def to_trad(w):
    if w in by_trad: return w
    t = simp2trad.get(w)
    return t[0] if t else None
words = {}
for w in list(deck) + wordfreq.top_n_list('zh', 15000):
    for t in ([w] if w in by_trad else []) + simp2trad.get(w, []):
        if t in words: continue
        b = best(t)
        if b: words[t] = b
    if len(words) >= 12000 and w not in deck: pass
# characters in those words
decomp = {}
for line in open(DL + '/cjk-decomp.txt', encoding='utf8'):
    m = re.match(r'^(.+?):(\w+)\((.*)\)$', line.strip())
    if m: decomp[m.group(1)] = (m.group(2), [x for x in m.group(3).split(',') if x])
RAD = {'氵':'water','扌':'hand','亻':'person','忄':'heart / feeling','艹':'grass / plant','訁':'speech','言':'speech','宀':'roof','辶':'walk','⻌':'walk','灬':'fire','钅':'metal','釒':'metal','糹':'silk / thread','礻':'spirit / showing','衤':'clothing','阝':'hill or town','刂':'knife','犭':'animal','冫':'ice','疒':'sickness','攵':'hit / act','彳':'step','罒':'net','⺮':'bamboo','𥫗':'bamboo','飠':'food','𩙿':'food','月':'moon / body part','王':'king / jade','卩':'seal','廾':'two hands','丶':'dot','丿':'stroke','乚':'hook','亠':'lid','冖':'cover','勹':'wrap','匚':'box','厂':'cliff','囗':'enclosure','广':'shelter','尸':'body','彡':'hair / lines','夂':'go slowly','爫':'claw','耂':'old','覀':'cover','虍':'tiger'}
def parts(ch, depth=0):
    d = decomp.get(ch)
    # only splits that show meaningful parts: side by side, top and bottom, around, or repeated (not shapes drawn inside others)
    if not d or not (d[0] in ('a', 'd') or d[0].startswith('s') or d[0].startswith('r')) or depth > 3: return [ch]
    out = []
    for c in d[1]:
        if c.isdigit() or (c not in by_trad and c not in RAD and len(c) == 1 and unicodedata.category(c) != 'Lo'):
            out += [x for x in parts(c, depth + 1) if x]
        else: out.append(c)
    return out
chars = {}
for w in list(words):
    for ch in w:
        if ch in chars: continue
        b = best(ch) or {'p': '', 'm': ''}
        ps = [p for p in parts(ch) if p != ch and not p.isdigit() and unicodedata.category(p[0]) == 'Lo' or p in RAD]
        ps = [p for p in ps if p != ch][:4]
        b['k'] = ps
        chars[ch] = b
for ch in list(chars):
    for p in chars[ch]['k']:
        if p not in chars:
            b = best(p)
            if not b and simp2trad.get(p): b = best(simp2trad[p][0])
            chars[p] = {'p': b['p'] if b else '', 'm': RAD.get(p) or (b['m'] if b else ''), 'k': []}
        elif p in RAD and not chars[p]['m']: chars[p]['m'] = RAD[p]
for ch in chars: chars[ch]['k'] = [p for p in chars[ch]['k'] if chars.get(p, {}).get('m')]
chars = {k: v for k, v in chars.items() if v['m'] or v['k'] or any(k in w for w in words)}
# single characters are kept in chars only
for w in [w for w in words if len(w) == 1]: chars[w].update(words.pop(w)) if False else None
s2t = {}
for t in list(words) + list(chars):
    for e in by_trad.get(t, []):
        if e[1] != t and e[1] not in s2t: s2t[e[1]] = t
out = {'w': words, 'c': chars, 's': s2t}
json.dump(out, open('zh_data.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(words), len(chars), len(s2t), round(len(json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode()) / 1e6, 2), 'MB')
for k in ['好', '媽媽', '火車', '你好', '語', '學校', '謝謝', '海', '烏龜', '中秋節']:
    print(k, words.get(k) or chars.get(k), [(p, chars.get(p, {}).get('m')) for p in chars.get(k[0], {}).get('k', [])])
