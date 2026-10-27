"""Coral Cove's original background loops, played on real sampled instruments (the FluidR3 General MIDI
soundfont, MIT licence) instead of raw synth waves, so they sound smooth rather than 8-bit.
  deck-song:  calm, for studying (64 bpm): rippling harp over a warm pad, soft bass. No drums.
  game-song:  light and bouncy, for minigames (104 bpm, swung): steel-drum tune with marimba, nylon guitar,
              upright bass, brushed drums.
  lobby-song: easy jazz for the profile screen and waiting (112 bpm, swung): vibraphone, walking bass, brushes.
  timer-song: for Timed Choice cards (120 bpm, so a beat is half a second): a kalimba that ticks firmly on
              every second, softly in between, over a light bass and shaker. The app starts it in step with
              each card's countdown.
Each loop is rendered with its reverb tail folded back onto the start, so it repeats without a bump.

The day and night reef songs are the family's own; their in-app copies were softened with smooth_reef_song()
below (highs rolled off, a little more space at night). Keep the untouched originals elsewhere.

usage: python3 tools/compose_music.py OUTDIR [SOUNDFONT [song names...]]
needs: mido (pip), fluidsynth, ffmpeg, numpy; soundfont default /usr/share/sounds/sf2/FluidR3_GM.sf2
"""
import sys, os, subprocess, wave, random
import numpy as np
import mido

SR = 44100
SF = sys.argv[2] if len(sys.argv) > 2 else '/usr/share/sounds/sf2/FluidR3_GM.sf2'
TPB = 480                                     # MIDI ticks per beat

class Song:
    def __init__(self, bpm, seed):
        self.bpm = bpm; self.ev = []; self.rnd = random.Random(seed); self.programs = {}
    def program(self, ch, prog, vol=100, pan=64, rev=60, bank=0):
        self.programs[ch] = (prog, vol, pan, rev, bank)
    def note(self, ch, pitch, beat, beats, vel, human=True):
        if human:   # a player is never exactly on the grid or exactly as loud
            beat += self.rnd.uniform(-.012, .012); vel = int(vel * self.rnd.uniform(.9, 1.08))
        on = int(max(0, beat) * TPB); off = int((beat + beats) * TPB)
        self.ev.append((on, 1, mido.Message('note_on', channel=ch, note=pitch, velocity=max(1, min(127, vel)))))
        self.ev.append((off, 0, mido.Message('note_off', channel=ch, note=pitch, velocity=0)))
    def write(self, path, total_beats):
        mf = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mf.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm)))
        for ch, (prog, vol, pan, rev, bank) in self.programs.items():
            if bank: tr.append(mido.Message('control_change', channel=ch, control=0, value=bank))
            tr.append(mido.Message('program_change', channel=ch, program=prog))
            for cc, v in ((7, vol), (10, pan), (91, rev), (93, 20)): tr.append(mido.Message('control_change', channel=ch, control=cc, value=v))
        t = 0
        for at, _, msg in sorted(self.ev, key=lambda e: (e[0], e[1])):
            tr.append(msg.copy(time=at - t)); t = at
        tail = int((total_beats + 8) * TPB)   # let everything ring out; the tail is folded onto the start later
        tr.append(mido.MetaMessage('end_of_track', time=max(0, tail - t)))
        mf.save(path)

def render(song, total_beats, out, lufs, room=.6, level=.7):   # room/level: how big and how strong the reverb is
    mid = out + '.mid'; wav = out + '.wav'
    song.write(mid, total_beats)
    subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', str(SR), '-o', 'synth.reverb.room-size=%s' % room, '-o', 'synth.reverb.level=%s' % level, '-o', 'synth.reverb.width=0.9',
                    '-F', wav, SF, mid], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with wave.open(wav) as w: x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).astype(np.float32) / 32768
    L = int(round(total_beats * 60 / song.bpm * SR)); loop = x[:L].copy()
    tail = x[L:]; n = min(len(tail), L); loop[:n] += tail[:n]          # fold the ring-out onto the start: seamless
    raw = out + '.f32'; loop.astype('<f4').tofile(raw)
    # gentle polish: roll off the top (harsh highs are tiring under a game) and warm the low end, then loudness-normalise (EBU R128)
    af = 'highshelf=f=5000:g=-4.5,lowpass=f=13000,lowshelf=f=180:g=1.5,loudnorm=I=%d:TP=-3:LRA=9' % lufs
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw, '-af', af,
                    '-ar', str(SR), '-b:a', '128k', out], check=True)
    for f in (mid, wav, raw): os.remove(f)

# progressions: (bass root, voicing)
MAJ = [(36, [52, 55, 59, 62]), (33, [52, 55, 57, 60]), (29, [53, 57, 60, 64]), (31, [50, 53, 55, 59])]        # Cmaj9 Am9 Fmaj7 G
POP = [(36, [55, 60, 64]), (31, [55, 59, 62]), (33, [57, 60, 64]), (29, [57, 60, 65])]                        # C G Am F
MIN = [(33, [52, 57, 60, 64]), (29, [53, 57, 60, 64]), (31, [50, 55, 59, 62]), (28, [52, 55, 59, 62])]        # Am Fmaj7 G Em
TUNE_SLOW = {0: [(2, 76, 2)], 1: [(0, 74, 1), (1, 72, 3)], 2: [(2, 72, 2)], 3: [(0, 71, 1.5), (2, 67, 2)]}
TUNE_BOUNCE = [[(0, 72), (1, 74), (2, 76), (4, 79), (6, 76)], [(0, 74), (2, 72), (3, 69), (4, 67), (6, 69)],
               [(0, 77), (2, 76), (3, 74), (4, 72), (6, 74)], [(0, 76), (2, 74), (4, 72), (5, 67)]]

def make(bpm, prog, seed=1, swing=.5, chord=None, arp=None, lead=None, bass=None, drums=None, pad=None,
         arp_style='broken', lead_style='slow', bars=None, lead_oct=0, bass_style='long', vel=1.0):
    s = Song(bpm, seed); ch = 0; parts = {}
    for name, spec in (('chord', chord), ('arp', arp), ('lead', lead), ('bass', bass), ('pad', pad)):
        if spec: s.program(ch, spec[0], vol=spec[1], pan=spec[2] if len(spec) > 2 else 64, rev=spec[3] if len(spec) > 3 else 70); parts[name] = ch; ch += 1
    if drums: s.program(9, drums[0], vol=drums[1], rev=35)
    bars = bars or int(np.ceil(11 / (240 / bpm)))
    def e8(b, i): return b * 4 + i // 2 + (swing if i % 2 else 0)
    for b in range(bars):
        root, v = prog[b % len(prog)]; t = b * 4
        if 'pad' in parts:
            for n in v: s.note(parts['pad'], n, t, 4, int(34 * vel))
        if 'chord' in parts:
            if arp_style == 'strum':
                for i in (0, 3, 4, 6): [s.note(parts['chord'], n, e8(b, i) + k * .02, .45, int((50 if i == 0 else 40) * vel)) for k, n in enumerate(v)]
            elif arp_style == 'offbeat':
                for i in (1, 3, 5, 7): [s.note(parts['chord'], n, e8(b, i) + k * .012, .3, int(42 * vel)) for k, n in enumerate(v)]
            else:
                for k, n in enumerate(v): s.note(parts['chord'], n, t + k * .06, 2.4, int((42 + 3 * k) * vel))
        if 'arp' in parts:
            seq = v + [v[-1] + 12, v[1] + 12] if arp_style != 'sparse' else [v[0] + 12, v[2] + 12]
            step = .5 if arp_style in ('broken', 'strum', 'offbeat', 'tick') else 1
            if arp_style == 'sparse': step = 2
            k = 0; x = 0.0
            while x < 4 - 1e-6:
                if arp_style == 'tick':   # on the second: firm and on the grid, so it lines up with a countdown
                    firm = abs(x % 2) < 1e-6
                    s.note(parts['arp'], seq[k % len(seq)] + 12, t + x, step * 1.6, int((64 if firm else 26) * vel), human=not firm)
                else:
                    s.note(parts['arp'], seq[k % len(seq)] + 12, t + x + (swing - .5 if (x * 2) % 2 == 1 else 0), step * 1.6, int(34 * vel) + s.rnd.randint(0, 8))
                k += 1; x += step
        if 'bass' in parts:
            if bass_style == 'walk':
                for q, d in enumerate((0, 4, 7, 9 if b % 2 else 5)): s.note(parts['bass'], root - 12 + d + 12, t + q, .9, int(62 * vel))
            elif bass_style == 'bounce':
                s.note(parts['bass'], root, t, .9, int(70 * vel)); s.note(parts['bass'], root + 7, t + 2, .9, int(58 * vel)); s.note(parts['bass'], root + 12, t + 3 + swing / 2, .4, int(46 * vel))
            else:
                s.note(parts['bass'], root, t, 3.7, int(58 * vel))
        if 'lead' in parts:
            if lead_style == 'slow':
                for off, n, d in TUNE_SLOW.get(b % 4, []): s.note(parts['lead'], n + lead_oct, t + off, d, int(52 * vel))
            else:
                for i, n in TUNE_BOUNCE[b % 4]: s.note(parts['lead'], n + lead_oct, e8(b, i), .45, int((68 if i == 0 else 56) * vel))
        if drums:
            kind = drums[2]
            if kind in ('brush', 'kit'):
                s.note(9, 36, t, .2, 50); s.note(9, 36, t + 2 + (swing / 2 if kind == 'brush' else 0), .2, 36)
                s.note(9, 38, t + 1, .2, 38 if kind == 'brush' else 46); s.note(9, 38, t + 3, .2, 42 if kind == 'brush' else 50)
                for i in range(8): s.note(9, 42, e8(b, i), .1, 18 if i % 2 else 26)
            if kind == 'shaker':
                for i in range(8): s.note(9, 70, e8(b, i), .1, 22 if i % 2 else 32)
            if kind == 'lofi':
                s.note(9, 36, t, .2, 46); s.note(9, 36, t + 2.5, .2, 32); s.note(9, 38, t + 1, .2, 30); s.note(9, 38, t + 3, .2, 34)
                for i in range(8): s.note(9, 42, e8(b, i), .1, 14 if i % 2 else 20)
    return s, bars * 4


# chord shapes as MIDI notes (bass root, then voicing)
def deck_song(out):   # "Dreamy": harp ripples over a warm pad, with a second, softer progression for variety
    prog = MAJ * 2 + [(28, [50, 55, 59, 62]), (33, [52, 55, 57, 60]), (26, [53, 57, 60, 64]), (31, [50, 53, 55, 59])] + MAJ
    s, beats = make(64, prog, seed=3, pad=(89, 80, 64, 100), arp=(46, 86, 50, 90), arp_style='broken', bass=(35, 60, 64, 40), bars=16)
    render(s, beats, out, -21, room=.92, level=.9)   # dreamy: a big, soft space

def lobby_song(out):   # easy jazz for waiting: vibes, walking bass, brushes
    prog = MAJ * 2 + [(28, [50, 55, 59, 62]), (33, [52, 55, 57, 60]), (26, [53, 57, 60, 64]), (31, [50, 53, 55, 59])] * 2
    s, beats = make(112, prog, seed=11, swing=.66, chord=(4, 80, 80), arp_style='offbeat', bass=(32, 96), bass_style='walk', lead=(11, 96, 46), lead_style='bounce', drums=(40, 72, 'brush'), bars=32)
    render(s, beats, out, -19, room=.55, level=.6)

def timer_song(out):   # kalimba ticking on every second (120 bpm: two beats a second); 16 bars = exactly 32 seconds
    s, beats = make(120, POP, seed=12, swing=.5, arp=(108, 92, 50, 70), arp_style='tick', bass=(45, 66), bass_style='bounce', drums=(0, 40, 'shaker'), bars=16)
    render(s, beats, out, -20, room=.3, level=.35)   # nearly dry, so every tick is crisp

def game_song(out):
    s = Song(104, 23); MAR, GTR, PIZ, BASS, DR, GLK, STL = 0, 1, 2, 3, 9, 4, 5
    s.program(MAR, 12, vol=64, pan=46, rev=55)     # marimba, doubling the tune softly
    s.program(STL, 114, vol=100, pan=58, rev=60)   # steel drums carry the tune
    s.program(GTR, 24, vol=82, pan=86, rev=45)     # nylon guitar
    s.program(PIZ, 45, vol=70, pan=36, rev=60)     # pizzicato strings
    s.program(BASS, 32, vol=92, pan=64, rev=25)    # acoustic (upright) bass
    s.program(GLK, 9, vol=52, pan=74, rev=80)      # glockenspiel sparkle
    s.program(DR, 40, vol=70, pan=64, rev=35)      # brush drum kit (channel 10)
    sw = .62                                       # swing: the off-beat 8th sits late, which feels relaxed and smooth
    def e8(b, i): return b * 4 + i // 2 + (sw if i % 2 else 0)
    prog = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])] * 2 + \
           [(41, [57, 60, 65]), (43, [55, 59, 62]), (40, [55, 59, 64]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62]), (48, [55, 60, 64]), (43, [55, 59, 62])]
    prog = prog * 2                                # 32 bars
    A = [(0, 72), (1, 74), (2, 76), (4, 79), (6, 76)], [(0, 74), (2, 72), (3, 69), (4, 67), (6, 69)]
    B = [(0, 77), (2, 76), (3, 74), (4, 72), (6, 74)], [(0, 76), (2, 74), (4, 72), (5, 67)]
    for b, (root, ch) in enumerate(prog):
        t = b * 4; sec = (b % 16) // 8
        s.note(BASS, root - 12, t, .9, 70); s.note(BASS, root - 5, t + 2, .9, 60)      # walking-ish bass
        s.note(BASS, root - 12 + (2 if b % 2 else 4), t + 3 + sw / 2, .4, 46)
        for i in (1, 3, 5, 7):                                                         # guitar on the off-beats
            for k, n in enumerate(ch): s.note(GTR, n, e8(b, i) + k * .015, .35, 46)
        for i in (0, 4): s.note(PIZ, ch[-1] + 12, e8(b, i), .3, 38)
        s.note(DR, 36, t, .2, 52); s.note(DR, 36, t + 2 + sw / 2, .2, 34)              # soft kick
        s.note(DR, 38, t + 1, .2, 40); s.note(DR, 38, t + 3, .2, 44)                    # brush snare
        for i in range(8): s.note(DR, 42, e8(b, i), .1, 18 if i % 2 else 24)            # brushed hats
        phrase = (A if sec == 0 else B)[b % 2]
        if b % 8 < 6 or sec == 1:
            for i, n in phrase:
                up = 12 if 16 <= b < 24 else 0
                s.note(STL, n + up, e8(b, i), .45, 74 if i == 0 else 62); s.note(MAR, n + up - 12, e8(b, i), .45, 50)
        if b % 4 == 3: s.note(GLK, ch[-1] + 24, t + 3, 1, 36)
    render(s, len(prog) * 4, out, -19, room=.45, level=.5)   # fairly tight, so it stays bouncy

def smooth_reef_song(src, out, lufs, night=False):
    echo = 'aecho=0.85:0.55:90|180|300:0.2|0.14|0.08' if night else 'aecho=0.85:0.5:70|140:0.16|0.1'
    # The harsh part is the 8-bit lead: a buzzy square-wave melody pitched around 1.5-2.7 kHz. Turn that range down
    # (a wide dip centred on it), take the buzz above it down hard, and roll off the very top.
    af = ('equalizer=f=2100:width_type=o:width=1.3:g=-6,highshelf=f=3500:g=-9,lowpass=f=7500,'
          'acompressor=threshold=-22dB:ratio=2:attack=25:release=300,%s,loudnorm=I=%s:TP=-1.5:LRA=9') % (echo, lufs)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', af, '-b:a', '128k', out], check=True)

if __name__ == '__main__':
    od = sys.argv[1] if len(sys.argv) > 1 else '.'
    for name, fn in (('deck-song', deck_song), ('game-song', game_song), ('lobby-song', lobby_song), ('timer-song', timer_song)):
        if len(sys.argv) > 3 and name not in sys.argv[3:]: continue
        fn(os.path.join(od, name + '.mp3')); print(name)
