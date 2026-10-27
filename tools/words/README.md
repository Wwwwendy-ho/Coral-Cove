# Ask Shelly's offline dictionary

Builds `words-data.js` (used by `words.js`) from:

| Step | Script | Source |
|---|---|---|
| English word list: the 5,000 most common words plus every English word in the decks | `lists.py` | wordfreq, WordNet (for base forms), `seed-data.js` |
| Child-friendly English definitions, written for Coral Cove in batches | `defs/d0.json` … `d9.json` (+ hand fixes in `overrides.json`) | `batches/b0.json` … `b9.json` |
| Grown-up backup definitions for 20,000 more words, and word forms | `enwn.py` | WordNet 3.0 |
| Chinese words, meanings, pinyin with tone marks, character parts (traditional) | `zh.py` | CC-CEDICT, cjk-decomp, wordfreq |
| Join everything into `words-data.js` | `build_data.py` | |

Rebuild (needs `pip install wordfreq nltk`, the WordNet 3.0 files under `<dl>/nltk/corpora/wordnet`,
the `cc-cedict` npm package unpacked to `<dl>/cedict`, and `cjk-decomp.txt` in `<dl>`):

```
python3 lists.py <dl> ../../seed-data.js        # only if the word list should change
NLTK_DATA=<dl>/nltk python3 enwn.py <dl>
python3 zh.py <dl> ../../seed-data.js
python3 build_data.py 2026-10-28
cp words-data.js ../../ && cp words-data.js ../../coral-cove/
node test_words.js                               # needs words.js beside it: cp ../../words.js .
```

New English definitions: add them to `overrides.json` in the same shape (`[{"pos", "def", "ex"}]`).
