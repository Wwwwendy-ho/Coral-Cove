"""Korean natural-voice clips for Coral Cove: SNAP Piper Korean (Apache 2.0), 'kind' female speaker 2 (20s, bright and
friendly), fed the offline pronunciation of each phrase (g2pkk) as jamo, the way the voice's own demo does when its
online grammar service is not used. Output matches the existing packs: MP3, 24 kHz mono, 64 kb/s."""
import json, os, sys, subprocess, hashlib, numpy as np, onnxruntime as ort
from ko_g2p import pron
CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'; JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
def jamo(t):
    out = []
    for ch in t:
        c = ord(ch) - 0xAC00
        if 0 <= c <= 11171: out += [CHO[c // 588], JUNG[(c % 588) // 28]] + ([JONG[c % 28]] if c % 28 else [])
        else: out.append(ch)
    return out
cfg = json.load(open('snap_female12_kind_22k.onnx.json')); tok = {k: v[0] for k, v in cfg['phoneme_id_map'].items()}
sess = ort.InferenceSession('snap_female12_kind_22k.onnx'); SID = int(os.environ.get('SID', 2))
def synth(text, slow=1.0):
    ids = [tok['^']]
    for j in jamo(pron(text)):
        if j in tok: ids.append(tok[j]); ids += [tok[' '], tok[' ']] if j == ',' else []
        elif j.isspace(): ids.append(tok[' '])
    ids.append(tok['$'])
    x = [0]
    for i in ids: x += [i, 0]
    x = np.array([x], dtype=np.int64)
    out = sess.run(None, { 'input': x, 'pos': np.zeros_like(x), 'input_lengths': np.array([x.shape[1]], dtype=np.int64),
                           'scales': np.array([0.20, 1.15 * slow, 0.4], dtype=np.float32), 'sid': np.array([SID], dtype=np.int64) })
    a = out[0][0, 0].astype(np.float32); a = a / max(np.abs(a).max(), 1e-6) * .89
    nz = np.where(np.abs(a) > .01)[0]
    if len(nz): a = a[max(0, nz[0] - 1100): nz[-1] + 2200]
    return np.concatenate([np.zeros(220, np.float32), a])
if __name__ == '__main__':
    rows = json.load(open(sys.argv[1])); os.makedirs('clips', exist_ok=True)
    done = json.load(open('clips/done.json')) if os.path.exists('clips/done.json') else {}
    for key, text, _ in rows:
        if key in done: continue
        a = synth(text); fn = 'clips/ko-%s.mp3' % hashlib.sha1(key.encode()).hexdigest()[:16]
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', '22050', '-ac', '1', '-i', 'pipe:0', '-ar', '24000', '-ac', '1', '-b:a', '64k',
                        '-write_xing', '0', '-id3v2_version', '0', fn], input=a.tobytes(), check=True)
        done[key] = fn; print('%.2fs' % (len(a) / 22050), text, '->', pron(text), flush=True)
    json.dump(done, open('clips/done.json', 'w'), ensure_ascii=False)
