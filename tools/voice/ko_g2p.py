"""Offline Korean spelling -> pronunciation (g2pkk), without MeCab or the English dictionary (all phrases here are Korean)."""
import nltk
class _C:
    def dict(self): return {}
nltk.corpus.cmudict = _C()
import g2pkk.g2pkk as gg
gg.annotate = lambda string, mecab: string   # skip the grammar tags: the sound rules still apply
from g2pkk import G2p
_g = G2p()
def pron(s):
    # word by word: the sound rules inside a word (감사합니다 -> 감사함니다), not across the spaces between words
    return ' '.join(_g(w) for w in s.split(' ') if w)
