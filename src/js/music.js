  /* ---------- Background music: day-song.mp3 on the sunlit reef, night-song.mp3 on the shipwreck,
     lobby-song.mp3 (easy jazz) on the profile screen, deck-song.mp3 (calm, quiet) inside decks, timer-song.mp3
     (a kalimba ticking every second, in step with the countdown) on Timed Choice cards, and game-song.mp3
     (bouncy) in minigames. All but the day and night songs are original loops made for Coral Cove
     (tools/compose_music.py). Plays in the lobby and in every profile's game,
     dips under the celebration clip, and follows a 🎵 switch saved on this device. ---------- */
  var RM = { el: {}, cur: null, duck: 1, started: false };
  var RM_KEY = 'cc-music';
  function reefMusicOn(){ try { return localStorage.getItem(RM_KEY) !== 'off'; } catch(e){ return true; } }
  function reefMusicSet(on){ try { localStorage.setItem(RM_KEY, on ? 'on' : 'off'); } catch(e){} reefMusicUpdate(); reefMusicButtons(); }
  function reefMusicCtx(){ try { return Sound.getCtx(); } catch(e){ return null; } }
  // Each song streams from an audio element (decoded bit by bit as it plays) instead of being unpacked whole
  // into memory first (about 60 MB a song), which an iPad can quietly refuse while the 3D board is running.
  // The volume goes through Web Audio because iPads ignore an audio element's own volume setting.
  // Inside Claude the song files may come from a different web address than the page. An iPad then lets a
  // song "play" but silences it, and won't let the page download it either. Script files are exempt (that's how
  // the 3D models arrive), so each song is loaded packed in a script file first, then played from a copy made
  // inside the page, which counts as the page's own. Plain download is the backup (GitHub has no script copies),
  // and if the copy won't stream, the song is unpacked whole into memory. Hold 🎵 to see what happened.
  RM.log = [];
  function reefMusicNote(name, msg){ RM.log.push(name.replace('-song', '') + ': ' + msg); if(RM.log.length > 12) RM.log.shift(); }
  function reefMusicInline(name){
    var t = document.getElementById('reef-song-' + name); if(!t) return null;
    var bin = atob(t.textContent.trim()), u = new Uint8Array(bin.length); for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return { bytes: u.buffer, type: t.getAttribute('data-type') || 'audio/mpeg' };
  }
  function reefMusicScript(name){
    var inl = reefMusicInline(name); if(inl){ RM.types = RM.types || {}; RM.types[name] = inl.type; return Promise.resolve(inl.bytes); }   // carried inside the page
    return new Promise(function(res, rej){
      var s = document.createElement('script'); s.src = name + '.js'; s.async = true;
      s.onload = function(){
        var b64 = window.REEF_SONGS && window.REEF_SONGS[name]; if(!b64) return rej(new Error('script was empty'));
        var bin = atob(b64), u = new Uint8Array(bin.length); for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        delete window.REEF_SONGS[name]; s.remove(); res(u.buffer);
      };
      s.onerror = function(){ rej(new Error('script blocked')); };
      document.head.appendChild(s);
    });
  }
  function reefMusicBytes(name){
    return reefMusicScript(name).then(function(b){ reefMusicNote(name, RM.types && RM.types[name] ? 'loaded from the page' : 'loaded from script'); return b; }, function(e){
      reefMusicNote(name, 'script failed (' + (e && e.message || e) + ')');
      if(!window.fetch) throw e;
      return fetch(name + '.mp3').then(function(r){ if(!r.ok) throw new Error('status ' + r.status); reefMusicNote(name, 'downloaded'); return r.arrayBuffer(); });
    });
  }
  function reefMusicEl(name){
    if(RM.el[name]) return RM.el[name];
    var ctx = reefMusicCtx(); if(!ctx) return null;
    var a = new Audio(); a.loop = true; a.preload = 'auto'; a.setAttribute('playsinline', '');
    var m = { a: a, g: null, level: -1, name: name, stage: 1, buf: null, src: null };
    try { var me = ctx.createMediaElementSource(a); m.g = ctx.createGain(); m.g.gain.value = 0; me.connect(m.g); m.g.connect(ctx.destination); }
    catch(e){ m.g = null; a.volume = 0; reefMusicNote(name, 'no volume control (' + e.message + ')'); }
    a.addEventListener('playing', function(){ reefMusicNote(name, 'playing'); });
    a.addEventListener('error', function(){
      if(m.direct){ m.direct = false; m.stage = 1; reefMusicNote(name, 'streaming failed, downloading instead'); reefMusicFetch(m); return; }
      if(m.stage !== 2) return;
      reefMusicNote(name, 'copy would not stream (media error ' + (a.error ? a.error.code : '?') + ')');
      reefMusicDecode(m);
    });
    reefMusicNote(name, 'loading');
    // The GitHub copy serves the songs from its own address, so they can stream straight away (no script copy
    // to try first, and no waiting for the whole file). If streaming fails, the download below is the backup.
    if(window.CORAL_COVE_SEED && !document.getElementById('reef-song-' + name)){
      m.stage = 2; m.direct = true; a.src = name + '.mp3'; a.load();
      return RM.el[name] = m;
    }
    reefMusicFetch(m);
    return RM.el[name] = m;
  }
  function reefMusicFetch(m){
    var name = m.name, a = m.a;
    reefMusicBytes(name).then(function(bytes){
      m.bytes = bytes; m.stage = 2;
      a.src = URL.createObjectURL(new Blob([bytes], { type: (RM.types && RM.types[name]) || 'audio/mpeg' })); a.load();
      if(m.level > 0){ m.level = -1; reefMusicUpdate(); }
    }, function(e){ m.stage = 0; reefMusicNote(name, 'could not load the song (' + (e && e.message || e) + ')'); });
  }
  // Last resort: unpack the whole song into memory and loop it through Web Audio.
  function reefMusicDecode(m){
    var ctx = reefMusicCtx(); if(!ctx || !m.bytes || m.stage === 4) return;
    m.stage = 4;
    var pr = ctx.decodeAudioData(m.bytes.slice(0), function(buf){ m.buf = buf; m.bytes = null; reefMusicNote(m.name, 'unpacked into memory'); if(m.level > 0){ m.level = -1; reefMusicUpdate(); } },
      function(e){ m.stage = 0; reefMusicNote(m.name, 'could not unpack (' + (e && e.message || e) + ')'); });
    if(pr && pr.catch) pr.catch(function(){});   // already reported by the callback above
  }
  function reefMusicPaused(m){ return m.buf ? !m.src : m.a.paused; }
  function reefMusicPlay(m){
    if(m.buf){ if(m.src || !m.g) return; var ctx = reefMusicCtx(), s = ctx.createBufferSource(); s.buffer = m.buf; s.loop = true; s.connect(m.g);
      s.start(0, m.name === 'timer-song' && RM.timerStart ? Math.max(0, (Date.now() - RM.timerStart) / 1000) % m.buf.duration : 0); m.src = s; return; }
    if(m.stage !== 2) return;   // still loading, or nothing worked
    var pr = m.a.play();
    if(pr && pr.catch) pr.catch(function(e){ m.level = -1; reefMusicNote(m.name, 'play refused (' + (e && e.name || e) + '), next tap tries again'); });
  }
  function reefMusicPause(m){ if(m.src){ try { m.src.stop(); } catch(e){} m.src = null; } if(!m.a.paused) m.a.pause(); }
  function reefMusicLevel(m, level, secs){
    if(Math.abs(m.level - level) < .001 && (level === 0 || !reefMusicPaused(m))) return;
    m.level = level; clearTimeout(m.stopT);
    if(m.g){ var now = reefMusicCtx().currentTime; m.g.gain.cancelScheduledValues(now); m.g.gain.setValueAtTime(m.g.gain.value, now); m.g.gain.linearRampToValueAtTime(level, now + secs); }
    else m.a.volume = Math.min(1, level);
    if(level === 0){ m.stopT = setTimeout(function(){ if(m.level === 0) reefMusicPause(m); }, secs * 1000 + 200); return; }
    if(reefMusicPaused(m)) reefMusicPlay(m);
  }
  // What should be playing right now, and how loud (1 = full, small = tucked under a deck).
  function reefMusicTarget(){
    if(!reefMusicOn() || document.hidden) return null;
    try { if(!Sound.isEnabled()) return null; } catch(e){}
    var name = reefNight() ? 'night-song' : 'day-song';
    if(!S.profile) return { name: 'lobby-song', vol: 1 };       // the profile screen
    if(!reefGame()) return null;
    if(S.view === 'study' && S.timedChoiceTimerHandle && S.timedChoiceState && !S.timedChoiceState.reefCalm) return { name: 'timer-song', vol: RM_DECK };
    if(reefInDeck() || S.view === 'summary') return { name: 'deck-song', vol: RM_DECK };   // kept low so speech stays clear
    if(document.querySelector('.r3-mini')) return { name: 'game-song', vol: RM_GAME };    // under the minigame's sound effects
    return { name: name, vol: 1 };
  }
  var RM_SONGS = ['day-song', 'night-song', 'lobby-song', 'deck-song', 'timer-song', 'game-song'];
  // Lines the timer song up with a countdown that started at startMs, so its firm kalimba notes land on the seconds.
  function reefMusicTimerSync(startMs){
    RM.timerStart = startMs; reefMusicUpdate();
    var m = RM.el['timer-song']; if(!m) return;
    var at = function(d){ return Math.max(0, (Date.now() - RM.timerStart) / 1000) % (d || 32); };
    if(m.buf){ if(m.src){ reefMusicPause(m); reefMusicPlay(m); } return; }   // reefMusicPlay starts the buffer at the right point
    var seek = function(){ try { if(Math.abs(m.a.currentTime - at(m.a.duration)) > .06) m.a.currentTime = at(m.a.duration); } catch(e){} };
    if(!m.a.paused) seek(); else m.a.addEventListener('playing', seek, { once: true });
  }
  var RM_DECK = .5, RM_GAME = .7;   // the deck song is mastered at about -21 LUFS, the game song -18, the reef songs -15 to -17
  var RM_BASE = .5;   // the songs' overall level under Coral Cove's own sounds and voice
  function reefMusicUpdate(){
    if(!RM.started) return;
    var tg = reefMusicTarget();
    RM_SONGS.forEach(function(name){
      var on = !!tg && tg.name === name;
      if(!on && !RM.el[name]) return;
      var m = reefMusicEl(name); if(!m) return;
      var fade = !RM.cur || name === 'timer-song' || RM.cur === 'timer-song' ? .25 : on && RM.cur === name ? .8 : 1.2;   // the very first song comes straight in   // switching songs crossfades; the timer comes in quickly
      reefMusicLevel(m, on ? tg.vol * RM_BASE * RM.duck : 0, fade);
    });
    RM.cur = tg ? tg.name : null;
  }
  // Under a celebration the music dips, then comes back.
  function reefMusicDuck(seconds){
    RM.duck = .35; reefMusicUpdate();
    clearTimeout(reefMusicDuck.t); reefMusicDuck.t = setTimeout(function(){ RM.duck = 1; reefMusicUpdate(); }, seconds * 1000);
  }
  // Browsers only allow sound after a tap, so the music starts on the first one. iPads only count the
  // end of a touch (not its start) as permission, so every kind of tap tries until sound is really running.
  // 'playback' tells iPads to keep playing when the side switch or Control Center is set to silent,
  // the same way Shelly's voice clips already do.
  function reefMusicStart(){
    try { if(navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch(e){}
    var ctx = reefMusicCtx(); if(!ctx) return;
    RM.started = true;
    if(ctx.state !== 'running' && ctx.resume) ctx.resume().then(reefMusicUpdate, function(){});
    reefMusicUpdate();   // inside the tap, where the iPad allows a song to start (cheap when nothing changed)
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function(t){ document.addEventListener(t, reefMusicStart, true); });
  // Music can't play before the first tap, but it can download: fetch the profile screen's song straight away
  // and the others a little later, so each one starts the moment it's needed instead of after a download.
  // (The offline helper, sw.js, keeps each whole song once fetched, and plays later requests from that copy.)
  if(window.CORAL_COVE_SEED && window.fetch){
    var warm = function(name){ return fetch(name + '.mp3').then(function(r){ return r.ok ? r.blob() : null; }).catch(function(){}); };
    warm('lobby-song');
    setTimeout(function(){
      var rest = [reefNight() ? 'night-song' : 'day-song', 'deck-song', reefNight() ? 'day-song' : 'night-song', 'game-song', 'timer-song'];
      rest.reduce(function(p, n){ return p.then(function(){ return warm(n); }); }, Promise.resolve());   // one at a time, so the board loads first
    }, 6000);
  }
  // Leaving the app or locking the device stops the music straight away (no fade: timers stop in the background);
  // coming back picks it up again.
  function reefMusicAway(){
    Object.keys(RM.el).forEach(function(k){ var m = RM.el[k]; clearTimeout(m.stopT); reefMusicPause(m); m.level = 0; if(m.g) try { m.g.gain.cancelScheduledValues(0); m.g.gain.value = 0; } catch(e){} });
    if(reefWinNode){ try { reefWinNode.stop(); } catch(e){} reefWinNode = null; }
    try { if(window.speechSynthesis) speechSynthesis.cancel(); } catch(e){}
    var ctx = reefMusicCtx(); if(ctx && ctx.state === 'running' && ctx.suspend) ctx.suspend().catch(function(){});
  }
  function reefMusicBack(){
    var ctx = reefMusicCtx(); if(ctx && ctx.state !== 'running' && ctx.resume) ctx.resume().then(reefMusicUpdate, function(){});
    Object.keys(RM.el).forEach(function(k){ RM.el[k].level = -1; });
    reefMusicUpdate();
  }
  document.addEventListener('visibilitychange', function(){ if(document.hidden) reefMusicAway(); else reefMusicBack(); });
  addEventListener('pagehide', reefMusicAway);
  addEventListener('pageshow', function(e){ if(e.persisted && !document.hidden) reefMusicBack(); });
  function reefMusicButtonHTML(cls){
    var on = reefMusicOn();
    return '<button type="button" class="' + cls + (on ? '' : ' off') + '" data-music-toggle aria-pressed="' + on + '" aria-label="' + (on ? 'Turn the music off' : 'Turn the music on') + '">' + ccIcon(on ? 'music' : 'music-off') + '</button>';
  }
  function reefMusicButtons(){
    document.querySelectorAll('[data-music-toggle]').forEach(function(b){
      var on = reefMusicOn(); b.classList.toggle('off', !on); b.innerHTML = ccIcon(on ? 'music' : 'music-off'); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Turn the music off' : 'Turn the music on');
    });
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-music-toggle]'); if(!b) return;
    e.preventDefault();
    if(RM.held){ RM.held = false; return; }   // a long hold shows the music check instead of switching
    reefMusicStart(); reefMusicSet(!reefMusicOn());
  });
  // Hold 🎵 for a second: a small note says what the music did, for a grown-up to pass on.
  document.addEventListener('pointerdown', function(e){
    var b = e.target.closest && e.target.closest('[data-music-toggle]'); if(!b) return;
    clearTimeout(RM.holdT); RM.held = false;
    RM.holdT = setTimeout(function(){ RM.held = true; reefMusicShowLog(); }, 900);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(t){ document.addEventListener(t, function(){ clearTimeout(RM.holdT); }); });
  function reefMusicShowLog(){
    var old = document.querySelector('.rm-log'); if(old) old.remove();
    var ctx = reefMusicCtx(), d = document.createElement('div');
    d.className = 'rm-log'; d.setAttribute('role', 'status');
    d.textContent = 'Music check — sound: ' + (ctx ? ctx.state : 'none') + ' · music ' + (reefMusicOn() ? 'on' : 'off') + ' · ' + (RM.log.length ? RM.log.join(' · ') : 'not started yet (tap anywhere first)');
    d.addEventListener('click', function(){ d.remove(); });
    document.body.appendChild(d);
    setTimeout(function(){ d.remove(); }, 15000);
  }

  /* The day ⇄ night switch's own short tune (after Coral Calendar's sun/moon music), made on the spot:
     a warm pad that swells with the rise and a harp run that lands as the sun or moon reaches the top.
     Sunrise is bright and climbs (C major, added 9th); moonrise is softer and lower (A minor 9th) with a slow
     low glide like a whale call and two high twinkles. Follows the sound setting; the background music dips under it. */
  function reefThemeSting(dark){
    try { if(!Sound.isEnabled()) return; } catch(e){ return; }
    var c = reefMusicCtx(); if(!c) return;
    if(c.state === 'suspended' && c.resume) c.resume();
    try { reefMusicDuck(4.2); } catch(e){}
    var t0 = c.currentTime + .02, out = c.createGain(), lp = c.createBiquadFilter(), dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = dark ? 2600 : 4200; lp.Q.value = .3; dl.delayTime.value = dark ? .31 : .24; fb.gain.value = .38; wet.gain.value = .32;
    out.gain.setValueAtTime(.0001, t0); out.gain.exponentialRampToValueAtTime(.2, t0 + .25); out.gain.setValueAtTime(.2, t0 + 2.7); out.gain.exponentialRampToValueAtTime(.0001, t0 + 4.4);
    lp.connect(out); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(out); out.connect(c.destination);
    function tone(f, at, dur, g, type, att, f2){
      var o = c.createOscillator(), gn = c.createGain(), t = t0 + at; o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * .8);
      gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + (att || .012)); gn.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(gn); gn.connect(lp); o.start(t); o.stop(t + dur + .05);
    }
    function pad(fs, dur, g){ fs.forEach(function(f, i){ [-4, 4].forEach(function(dt){
      var o = c.createOscillator(), gn = c.createGain(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = dt;
      gn.gain.setValueAtTime(.0001, t0); gn.gain.exponentialRampToValueAtTime(g / fs.length, t0 + .9); gn.gain.setValueAtTime(g / fs.length, t0 + dur - 1.2); gn.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(gn); gn.connect(lp); o.start(t0); o.stop(t0 + dur + .05); }); }); }
    function harp(fs, at, step, g, len){ fs.forEach(function(f, i){ tone(f, at + i * step, len, g, 'triangle', .008); tone(f * 2, at + i * step, len * .5, g * .18, 'sine', .006); }); }
    if(dark){
      pad([110, 220, 329.6, 493.9, 523.3], 4.1, .55);
      tone(98, .15, 2.6, .12, 'sine', .6, 147);                              // a low glide, like a whale call
      harp([329.6, 440, 493.9, 523.3, 659.3, 784], .35, .27, .34, 1.6);      // the moon climbs
      tone(1760, 2.1, 1.4, .07, 'sine', .01); tone(2093, 2.45, 1.6, .06, 'sine', .01);   // twinkles at the top
    } else {
      pad([130.8, 261.6, 392, 587.3, 659.3], 4.1, .55);
      harp([523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7], .3, .2, .32, 1.4);   // the sun climbs
      [1318.5, 1568, 2093].forEach(function(f, i){ tone(f, 1.95 + i * .12, 1.6, .07, 'sine', .01); });   // a bright chime at the top
    }
  }
  store.init().then(function(s){
    try { coveWrapStore(s); } catch(e){}
    S.store = s;
    // A PIN saved by an older version is replaced with the placeholder, so no real PIN stays on the device.
    // Then the profile list is loaded; nothing profile-scoped (decks, stats, settings…) loads until a
    // profile is chosen, and render() shows the profile picker meanwhile.
    S.store.getPin().then(function(hash){
      if(hash !== BAKED_PIN_HASH) S.store.setPin(BAKED_PIN_HASH);
      S.view = 'home';
      S.booted = true;
      subscribeProfiles();
      render();
    });
  });
  // Independent of the main boot chain above -- photo upload should light up whenever it resolves
  // rather than holding up the rest of the app, and it's fine for it to arrive a beat later.
  var coveIdle = window.requestIdleCallback ? function(f){ requestIdleCallback(f, { timeout: 1500 }); } : function(f){ setTimeout(f, 300); };
  coveIdle(function(){ Assets.init().then(function(){
    S.assetsAvailable = Assets.available();
    if(S.booted && S.view === 'editor') render();
  }); });
  // Also independent of the main boot chain -- real pronunciation clips just light up whenever
  // the db handle resolves; nothing needs to wait on it, since Speech.speak() falls back to the
  // synthesized voice until then anyway.
  coveIdle(function(){ AudioClips.init(); VoicePack.warm(); });
