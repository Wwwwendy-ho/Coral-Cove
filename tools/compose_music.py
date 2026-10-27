"""Two original background loops for Coral Cove, synthesized from scratch (no samples, no licences needed).
  deck-song: calm and sparse for studying (72 bpm, soft electric piano + warm pad, no drums)
  game-song: bouncy and light for minigames (120 bpm, marimba melody, plucked bass, soft kit)
Each loop is rendered circularly (tails wrap to the start) so it repeats without a bump.
usage: python3 tools/compose_music.py .   (needs numpy and ffmpeg; writes deck-song.mp3 and game-song.mp3)
"""
import sys, subprocess, numpy as np

SR = 44100
rng = np.random.default_rng(7)
def hz(n): return 440.0 * 2 ** ((n - 69) / 12)
def env(n, a, d, s, r, hold):
    t = np.arange(n) / SR; e = np.ones(n) * s
    ai = t < a; e[ai] = t[ai] / a
    di = (t >= a) & (t < a + d); e[di] = 1 - (1 - s) * (t[di] - a) / d
    ri = t >= hold; e[ri] = s * np.exp(-(t[ri] - hold) / r)
    return e

def add(buf, x, at, pan=0.0):
    """Mix mono x into the stereo loop at sample `at`, wrapping round the end (a seamless loop)."""
    L = buf.shape[1]; idx = (np.arange(len(x)) + at) % L
    np.add.at(buf[0], idx, x * np.sqrt(.5 * (1 - pan))); np.add.at(buf[1], idx, x * np.sqrt(.5 * (1 + pan)))

def epiano(note, dur, vel=.5):
    n = int((dur + 1.8) * SR); t = np.arange(n) / SR; f = hz(note)
    mod = np.sin(2 * np.pi * f * t) * 1.6 * np.exp(-t * 2.5)            # FM bell, softening as it rings
    x = np.sin(2 * np.pi * f * t + mod) + .25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3)
    return x * env(n, .006, .6, .35, .7, dur) * vel

def pad(note, dur, vel=.2):
    n = int((dur + 2.5) * SR); t = np.arange(n) / SR; f = hz(note); x = np.zeros(n)
    for dt in (-.07, 0, .06):                                           # three detuned soft saws, low-passed below
        ph = (f * 2 ** (dt / 12) * t) % 1; x += 2 * ph - 1
    return lowpass(x / 3, 900) * env(n, 1.2, .5, .8, 1.4, dur) * vel

def marimba(note, vel=.5):
    n = int(.9 * SR); t = np.arange(n) / SR; f = hz(note)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + .35 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 22)
    return x * np.minimum(1, t / .002) * vel

def pluck_bass(note, dur, vel=.6):
    n = int((dur + .3) * SR); t = np.arange(n) / SR; f = hz(note)
    x = np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 8)
    return x * env(n, .004, .15, .5, .08, dur) * vel

def kick(vel=.7):
    n = int(.35 * SR); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * vel
def snare(vel=.25):
    n = int(.2 * SR); t = np.arange(n) / SR
    return (highpass(rng.standard_normal(n), 1500) * np.exp(-t * 22) + .4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)) * vel
def hat(vel=.08):
    n = int(.06 * SR); t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 7000) * np.exp(-t * 70) * vel
def shaker(vel=.035):
    n = int(.09 * SR); t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 5000) * np.sin(np.pi * t / t[-1]) * vel

def lowpass(x, fc):   # a gentle 12 dB/octave low-pass, done in the frequency domain (numpy only)
    n = len(x); f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) / (1 + (f / fc) ** 2), n)
def highpass(x, fc): return x - lowpass(x, fc)

def reverb(buf, mix=.25, size=1.0):
    """Circular comb-filter reverb (in the frequency domain, so the tail wraps round the loop)."""
    L = buf.shape[1]; ir = np.zeros(L); t = np.arange(int(2.2 * size * SR)) / SR
    noise = rng.standard_normal(len(t)) * np.exp(-t * 3.2 / size); ir[:len(t)] = lowpass(noise, 4500) * .05
    F = np.fft.rfft(ir)
    for c in range(2): buf[c] = buf[c] * (1 - mix) + np.fft.irfft(np.fft.rfft(buf[c]) * F, L) * mix * 6

def finish(buf, path, lufs):
    peak = np.abs(buf).max(); buf = buf / peak * .8
    raw = path + '.raw'; (buf.T.astype('<f4')).tofile(raw)
    # loudness-normalise (EBU R128) and encode; background music sits well under voices and sound effects
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw,
                    '-af', 'loudnorm=I=%d:TP=-3:LRA=7' % lufs, '-ar', str(SR), '-b:a', '112k', path], check=True)
    subprocess.run(['rm', raw])

def deck_song(out):
    bpm = 72; beat = 60 / bpm; bars = 16; L = int(bars * 4 * beat * SR); buf = np.zeros((2, L))
    # Cmaj7 - Am7 - Fmaj7 - G6sus, twice per 8 bars, then a gentler Em7 - Fmaj7 - Dm7 - Gsus turn
    chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 62]] * 2 + \
             [[40, 47, 50, 55], [41, 48, 52, 57], [38, 45, 48, 53], [43, 50, 53, 60]] + [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 62]]
    for b, ch in enumerate(chords):
        t0 = int(b * 4 * beat * SR)
        for n in ch[1:]: add(buf, pad(n, 4 * beat, .07), t0, pan=rng.uniform(-.4, .4))
        add(buf, pad(ch[0] - 12, 4 * beat, .09), t0)
        # a slow broken chord on the e-piano: up on beats 1, 2, 3, then one high note held
        for k, (beatpos, n) in enumerate([(0, ch[0] + 12), (1, ch[2] + 12), (2, ch[3] + 12), (3, ch[1] + 24)]):
            if b % 4 == 3 and k == 3: continue   # breathe at the end of every phrase
            add(buf, epiano(n, beat * 1.5, .22 + .05 * (k == 0)), t0 + int(beatpos * beat * SR), pan=-.25 + .15 * k)
    reverb(buf, .35, 1.4)
    finish(buf, out, -20)

def game_song(out):
    bpm = 120; beat = 60 / bpm; bars = 32; L = int(bars * 4 * beat * SR); buf = np.zeros((2, L))
    prog = [(60, 'M'), (57, 'm'), (53, 'M'), (55, 'M')] * 8          # C  Am  F  G
    scale = [60, 62, 64, 67, 69, 72, 74, 76]                          # major pentatonic, always happy
    motif = [0, 2, 4, 2, 5, 4, 2, None, 4, 5, 6, 5, 4, 2, 3, None]    # a little tune in scale steps, 8ths
    for b, (root, q) in enumerate(prog):
        t0 = int(b * 4 * beat * SR); third = root + (4 if q == 'M' else 3)
        for e8 in range(8):                                            # bouncy bass: root, fifth, octave
            n = [root - 24, root - 17, root - 12, root - 17][e8 % 4]
            if e8 % 2 == 0 or rng.random() < .35: add(buf, pluck_bass(n, beat * .4, .5), t0 + int(e8 * beat / 2 * SR))
        for bt in range(4):
            if bt in (0, 2): add(buf, kick(.55), t0 + int(bt * beat * SR))
            if bt in (1, 3): add(buf, snare(.11), t0 + int(bt * beat * SR), pan=.1)
        for e8 in range(8): add(buf, hat(.03 if e8 % 2 else .05), t0 + int((e8 * beat / 2 + (.02 if e8 % 2 else 0)) * SR), pan=.35)
        for k, n in enumerate([root, third, root + 7]):               # off-beat chord stabs, light
            add(buf, marimba(n + 12, .12), t0 + int((1.5 + k * .02) * beat * SR), pan=-.3); add(buf, marimba(n + 12, .1), t0 + int((3.5 + k * .02) * beat * SR), pan=-.3)
        half = b % 2; tune = motif[half * 8:(half + 1) * 8]             # the tune: bars 1-4 and 9-12, an answer an octave down in between
        if (b // 4) % 2 == 0:
            for e8, st in enumerate(tune):
                if st is None: continue
                n = scale[st] + (12 if 16 <= b < 24 else 0)   # the third time round the tune goes up an octave
                add(buf, marimba(n, .42), t0 + int(e8 * beat / 2 * SR), pan=.2)
        else:
            for e8 in (0, 3, 6):
                add(buf, marimba(scale[(b + e8) % 5], .3), t0 + int(e8 * beat / 2 * SR), pan=.2)
    reverb(buf, .18, .8)
    finish(buf, out, -18)

if __name__ == '__main__':
    od = sys.argv[1]
    deck_song(od + '/deck-song.mp3'); game_song(od + '/game-song.mp3')
