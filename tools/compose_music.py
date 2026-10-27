"""Coral Cove's two original background loops, played on real sampled instruments (the FluidR3 General MIDI
soundfont, MIT licence) instead of raw synth waves, so they sound smooth rather than 8-bit.
  deck-song: calm, for studying (70 bpm): soft electric piano, warm strings, fretless bass. No drums.
  game-song: light and bouncy, for minigames (104 bpm, swung): marimba tune, nylon guitar, pizzicato,
             upright bass, brushed drums.
Each loop is rendered with its reverb tail folded back onto the start, so it repeats without a bump.

usage: python3 tools/compose_music.py OUTDIR [SOUNDFONT]
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

def render(song, total_beats, out, lufs, gain_db=0):
    mid = out + '.mid'; wav = out + '.wav'
    song.write(mid, total_beats)
    subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', str(SR), '-o', 'synth.reverb.room-size=0.6', '-o', 'synth.reverb.width=0.9',
                    '-F', wav, SF, mid], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with wave.open(wav) as w: x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).astype(np.float32) / 32768
    L = int(round(total_beats * 60 / song.bpm * SR)); loop = x[:L].copy()
    tail = x[L:]; n = min(len(tail), L); loop[:n] += tail[:n]          # fold the ring-out onto the start: seamless
    raw = out + '.f32'; loop.astype('<f4').tofile(raw)
    # gentle polish: roll off the top a little and warm the mids, then loudness-normalise (EBU R128)
    af = 'highshelf=f=7000:g=-3,lowshelf=f=180:g=1.5,loudnorm=I=%d:TP=-3:LRA=9' % lufs
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw, '-af', af,
                    '-ar', str(SR), '-b:a', '128k', out], check=True)
    for f in (mid, wav, raw): os.remove(f)

# chord shapes as MIDI notes (bass root, then voicing)
def deck_song(out):
    s = Song(70, 11); EP, STR, BASS, VIB = 0, 1, 2, 3
    s.program(EP, 4, vol=96, pan=54, rev=70)       # electric piano (Rhodes-like)
    s.program(STR, 49, vol=62, pan=78, rev=90)     # slow strings
    s.program(BASS, 35, vol=84, pan=64, rev=30)    # fretless bass
    s.program(VIB, 11, vol=58, pan=40, rev=95)     # vibraphone, just a few notes
    prog = [(36, [52, 55, 59, 62]), (33, [52, 55, 57, 60]), (29, [53, 57, 60, 64]), (31, [50, 53, 55, 59]),   # Cmaj9 Am9 Fmaj7 G7sus-ish
            (36, [52, 55, 59, 62]), (33, [52, 55, 57, 60]), (29, [53, 57, 60, 64]), (31, [50, 55, 57, 59]),
            (28, [50, 55, 59, 62]), (33, [52, 55, 57, 60]), (26, [53, 57, 60, 64]), (31, [50, 53, 55, 59]),   # Em7 Am9 Dm9 G
            (29, [52, 55, 57, 60]), (28, [50, 55, 59, 62]), (26, [53, 57, 60, 64]), (31, [50, 53, 57, 59])]
    tune = {0: [(2, 71, 2)], 2: [(2, 69, 1.5)], 4: [(1, 74, 2)], 6: [(2, 72, 2)], 9: [(2, 71, 2)], 11: [(1, 67, 1), (2.5, 69, 1.5)], 13: [(2, 71, 2)], 15: [(1.5, 72, 2.5)]}
    for b, (root, v) in enumerate(prog):
        t = b * 4
        s.note(BASS, root, t, 3.6, 62); s.note(BASS, root + 7, t + 3, .9, 40)
        for k, n in enumerate(v): s.note(STR, n, t, 4, 34 + 3 * k)
        # rolled chord on beat 1, then a soft broken pattern
        for k, n in enumerate(v): s.note(EP, n, t + k * .06, 2.2, 44 + 4 * k)
        for off, idx in ((1.5, 3), (2, 1), (2.5, 2), (3.25, 3)):
            if b % 4 == 3 and off > 2: continue
            s.note(EP, v[idx] + 12, t + off, 1.2, 30 + s.rnd.randint(0, 8))
        for off, n, d in tune.get(b, []): s.note(VIB, n, t + off, d, 40)
    render(s, len(prog) * 4, out, -21)

def game_song(out):
    s = Song(104, 23); MAR, GTR, PIZ, BASS, DR, GLK = 0, 1, 2, 3, 9, 4
    s.program(MAR, 12, vol=100, pan=46, rev=55)    # marimba
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
            for i, n in phrase: s.note(MAR, n + (12 if b >= 16 and b < 24 else 0), e8(b, i), .45, 70 if i == 0 else 58)
        if b % 4 == 3: s.note(GLK, ch[-1] + 24, t + 3, 1, 36)
    render(s, len(prog) * 4, out, -19)

if __name__ == '__main__':
    od = sys.argv[1] if len(sys.argv) > 1 else '.'
    deck_song(os.path.join(od, 'deck-song.mp3')); game_song(os.path.join(od, 'game-song.mp3'))
