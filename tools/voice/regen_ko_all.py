import json, re, os, subprocess, hashlib, numpy as np
from gen_ko import synth
ix = json.load(open('/home/user/coral-cove/voice/index.json')); c = ix['clips']; orig = json.load(open('ko_orig.json'))
QEND = re.compile(r'(까요|나요|니까|어요|예요|에요|해요|세요)$')
QWORD = re.compile(r'(어디|뭐|무엇|언제|누구|왜|어떻게|얼마|몇|무슨)')
os.makedirs('all', exist_ok=True); out = {}
keys = [k for k in c if re.search('[가-힣]', k)]
for i, k in enumerate(keys):
    var, base = k.split('|', 1)
    text = orig.get(base)
    if not text:
        text = base
        if ' ' in base and QWORD.search(base) and QEND.search(base): text += '?'   # a question, so it rises at the end
    text = text.replace(' / ', ', ')
    a = synth(text, 1.4 if var == 'slow' else 1.0)
    fn = 'all/%s.mp3' % hashlib.sha1(k.encode()).hexdigest()[:16]
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', '22050', '-ac', '1', '-i', 'pipe:0', '-ar', '24000', '-ac', '1', '-b:a', '64k',
                    '-write_xing', '0', '-id3v2_version', '0', fn], input=a.tobytes(), check=True)
    out[k] = fn
    if i % 100 == 0: print(i, k, '->', text, flush=True)
json.dump(out, open('all/done.json', 'w'), ensure_ascii=False); print('made', len(out))
