"""Step 2 of 3. Speak each harvested phrase with Kokoro (af_heart), encode like the existing packs (MP3, 24 kHz mono, 64 kb/s)
and bundle them into pack files of about 2.5 MB, grouped (maths / everything else). Writes packs + new_index.json."""
import json, subprocess, sys, os, time, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro(os.environ.get('KOKORO_MODEL', 'kokoro-v1.0.onnx'), os.environ.get('KOKORO_VOICES', 'voices-v1.0.bin'))
rows = json.load(open('phrases.json'))
limit = int(sys.argv[1]) if len(sys.argv) > 1 else len(rows)
os.makedirs('clips', exist_ok=True)
done = json.load(open('clips/done.json')) if os.path.exists('clips/done.json') else {}
t0 = time.time()
for i, (key, text, variant) in enumerate(rows[:limit]):
    if key in done: continue
    a, sr = k.create(text, voice='af_heart', speed=.8 if variant == 'eq' else 1.0, lang='en-us')
    nz = np.where(np.abs(a) > .01)[0]
    if len(nz): a = a[max(0, nz[0] - 1200): nz[-1] + 2400]   # trim silence, keep a short tail
    a = np.concatenate([np.zeros(240, a.dtype), a])
    fn = 'clips/%s.mp3' % __import__('hashlib').sha1(key.encode()).hexdigest()[:16]   # named by the phrase, so a later run never overwrites one
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', 'pipe:0', '-ar', '24000', '-ac', '1', '-b:a', '64k',
                    '-write_xing', '0', '-id3v2_version', '0', fn], input=a.astype('<f4').tobytes(), check=True)
    done[key] = fn
    if i % 50 == 0:
        json.dump(done, open('clips/done.json', 'w')); print(i, '%.1fs elapsed' % (time.time() - t0), flush=True)
json.dump(done, open('clips/done.json', 'w')); print('generated', len(done), 'in %.0fs' % (time.time() - t0))
