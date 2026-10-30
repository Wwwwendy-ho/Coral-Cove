  /* ---------- Hangul Blend ----------
     A Korean word blends letter by letter (jamo), the way Hangul is taught: ㄱ + ㅏ = 가, then ㅂ + ㅏ + ㅇ
     = 방. The consonant alone has no sound of its own to say, so it just lights up; the vowel speaks
     the syllable built so far (가, 바), a final consonant speaks the finished syllable (방), and the
     whole word is said at the end. The block being built shows above the letters as it grows. Used
     automatically for any Hangul card with no hand-typed sound chunks. */
  var HANGUL_L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
  var HANGUL_V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'.split('');
  var HANGUL_T = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  function isHangulSyllable(ch){ var c = ch.charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3; }
  function isHangulWord(word){
    var s = String(word||'').replace(/\s+/g,'');
    return !!s && Array.from(s).every(isHangulSyllable);
  }
  function hangulCompose(l, v, t){ return String.fromCharCode(0xAC00 + (l*21 + v)*28 + (t||0)); }
  // -> { chunks:[jamo], say:[text|null], syl:[syllable index], parts:[{l,v,t}] }
  function hangulBlendPlan(word){
    var plan = { chunks: [], say: [], syl: [], parts: [] };
    Array.from(String(word||'')).forEach(function(ch){
      if(!isHangulSyllable(ch)) return;
      var code = ch.charCodeAt(0) - 0xAC00, l = Math.floor(code/588), v = Math.floor((code%588)/28), t = code % 28;
      var si = plan.parts.length;
      plan.parts.push({ l:l, v:v, t:t, ch:ch });
      plan.chunks.push(HANGUL_L[l]); plan.say.push(null); plan.syl.push(si);
      plan.chunks.push(HANGUL_V[v]); plan.say.push(hangulCompose(l, v, 0)); plan.syl.push(si);
      if(t){ plan.chunks.push(HANGUL_T[t]); plan.say.push(ch); plan.syl.push(si); }
    });
    return plan;
  }
  // What the word looks like with the first `n` letters placed: whole blocks so far, plus the block
  // being built (a lone consonant shows as itself, consonant+vowel as the open syllable).
  function hangulBuiltHTML(bd, n){
    if(!bd.hangul) return '';
    var out = '', parts = bd.hangul.parts;
    for(var si = 0; si < parts.length; si++){
      var idx = [];
      for(var i = 0; i < bd.chunks.length; i++){ if(bd.hangul.syl[i] === si) idx.push(i); }
      var got = idx.filter(function(i){ return i < n; }).length;
      if(!got) break;
      var p = parts[si];
      if(got === idx.length){ out += esc(p.ch); continue; }
      out += '<span class="partial">' + esc(got === 1 ? HANGUL_L[p.l] : hangulCompose(p.l, p.v, 0)) + '</span>';
      break;
    }
    return out;
  }

  function blendChunksFor(card){
    return (card.blendChunks && card.blendChunks.length) ? card.blendChunks.slice() : autoBlendChunks(card.front);
  }

  // Scales the word's chunk font-size and the slider's draggable width together so a short word
  // (e.g. "at", 2 chunks) gets a short slider and big letters, and a longer word (e.g. "shed",
  // 3-4 chunks, or a multi-word phrase) gets a longer slider and smaller letters -- rather than
  // every word sharing one fixed 340px track regardless of length. Stepped rather than a smooth
  // formula so it stays predictable at the handful of chunk-counts real cards actually have.
  function blendSizingFor(chunkCount){
    var n = Math.max(1, chunkCount || 1);
    var steps = [
      { max: 2, trackPx: 140, fontRem: 2.4 },
      { max: 3, trackPx: 180, fontRem: 2.0 },
      { max: 4, trackPx: 225, fontRem: 1.7 },
      { max: 5, trackPx: 270, fontRem: 1.45 },
      { max: 6, trackPx: 310, fontRem: 1.25 }
    ];
    var st = steps.find(function(x){ return n <= x.max; }) || { trackPx: 340, fontRem: 1.1 };
    // a tall iPad has a much bigger card (see studyFill), so the letters and the slider grow with it
    var k = window.innerWidth >= 700 && window.innerHeight >= 900 ? 1.6 : 1;
    return { trackPx: Math.round(st.trackPx * k), fontRem: +(st.fontRem * k).toFixed(2) };
  }

  function blendSliderHTML(bd, bsz){
    bsz = bsz || blendSizingFor(bd.chunks.length);
    return '' +
      '<div class="blend-slider-row" style="position:relative;z-index:1;">' +
        '<div class="blend-slider-track'+(bd.done?' blend-done':'')+'" id="blendTrack" style="max-width:'+bsz.trackPx+'px;">' +
          '<div class="blend-slider-fill" id="blendFill" style="width:'+bd.pct+'%"></div>' +
          '<div class="blend-slider-handle'+(bd.done?' blend-handle-done':'')+'" id="blendHandle" style="left:'+bd.pct+'%">🐚</div>' +
        '</div>' +
      '</div>';
  }

  // Direct DOM updates while dragging (not render()) for the same smoothness reasons as the timed-
  // choice countdown bar -- a render() per pointermove would be both wasteful and janky. render() is
  // only called once, after the drag finishes at the far right, to swap in the outcome row.
  function wireBlendSlider(card){
    var bd = S.blendState;
    if(!bd || bd.cardId !== card.id) return;
    var track = app.querySelector('#blendTrack');
    var fill = app.querySelector('#blendFill');
    var handle = app.querySelector('#blendHandle');
    var hintEl = app.querySelector('#blendHint');
    if(!track || !fill || !handle) return;
    var activePid = null;

    // Swaps the hint/feedback line's text in place (not via render()) so a full card mode isn't
    // rebuilt mid-drag -- rebuilding would tear down and recreate #blendTrack, silently dropping
    // the pointer capture set on it and breaking the gesture already in progress.
    function setDoneUI(isDone){
      if(!hintEl) return;
      hintEl.className = isDone ? 'choice-feedback ok' : 'flip-hint';
      hintEl.textContent = isDone ? ('Nice blending! 🎉' + (bd.hangul && card.back ? ' — ' + card.back : '')) : 'Drag the shell all the way to the right 🐚';
    }

    function pctFromClientX(clientX){
      var rect = track.getBoundingClientRect();
      if(rect.width <= 0) return bd.pct;
      return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    }
    function applyPct(pct){
      bd.pct = pct;
      fill.style.width = pct + '%';
      handle.style.left = pct + '%';
      var newRevealed = pct >= 100 ? bd.chunks.length : Math.floor((pct/100) * bd.chunks.length);
      if(newRevealed > bd.revealedCount){
        for(var i = bd.revealedCount; i < newRevealed; i++){
          var span = app.querySelector('[data-blend-chunk="'+i+'"]');
          if(span) span.classList.add('lit');
          // The very last chunk's sound is deliberately skipped here when the drag has already
          // reached the end -- it's spoken once, cleanly, by the speakThen-chained pair below
          // instead of twice back-to-back (Speech.speak() cancels any speech already in flight,
          // so a second, immediate call here would just cut the first one off anyway).
          var isFinalAtEnd = (pct >= 100 && i === bd.chunks.length - 1);
          if(!isFinalAtEnd){
            if(bd.hangul){ if(bd.hangul.say[i]) Speech.speak(bd.hangul.say[i]); else Sound.tap(); } // a lone consonant has no sound to say -- it just lights up
            else Speech.speak(bd.chunks[i]);
          }
        }
      } else if(newRevealed < bd.revealedCount){
        // Dragging back left un-lights the chunks past the new position, same as they'd never
        // been revealed -- dragging forward through them again re-lights and re-speaks them.
        for(var j = newRevealed; j < bd.revealedCount; j++){
          var span2 = app.querySelector('[data-blend-chunk="'+j+'"]');
          if(span2) span2.classList.remove('lit');
        }
      }
      bd.revealedCount = newRevealed;
      if(bd.hangul){ var builtEl = app.querySelector('#blendBuilt'); if(builtEl) builtEl.innerHTML = hangulBuiltHTML(bd, newRevealed); }

      if(pct >= 100 && !bd.done){
        bd.done = true;
        track.classList.add('blend-done');
        handle.classList.add('blend-handle-done');
        setDoneUI(true);
        Sound.correct();
        var elapsed = Date.now() - (S.cardShownAt || Date.now());
        bd.elapsedAtDone = elapsed;
        // No outcome buttons for Blend mode -- it grades and auto-advances itself once the whole
        // word has actually been heard, chaining speakThen calls so the grade doesn't fire until
        // playback truly finishes (not just once the drag hits 100%). A card mode is always
        // "correct" here -- there's no wrong answer to a sound-out slide, so autoRating just times
        // how long the drag took, same as it would for a self-reported right answer elsewhere.
        // doneGen guards this chain: if the child drags back left before it resolves, the cancel
        // branch below bumps doneGen and every stale callback here bails out instead of grading.
        var doneGen = (bd.doneGen = (bd.doneGen || 0) + 1);
        // Safety net on top of speakThen's own watchdog: whatever happens with the audio, the card
        // moves on a few seconds after the slide finishes, so a round can never get stuck here.
        bd.fallbackTimer = setTimeout(function(){
          if(bd.doneGen !== doneGen) return;
          if(S.view === 'study' && S.blendState === bd && S.studyQueue[0] && S.studyQueue[0].id === card.id){
            grade(autoRating('blend', true, elapsed));
          }
        }, 5000);
        var lastSay = bd.hangul ? (bd.hangul.parts.length ? bd.hangul.parts[bd.hangul.parts.length-1].ch : card.front) : bd.chunks[bd.chunks.length - 1];
        Speech.speakThen(lastSay || card.front, function(){
          if(bd.doneGen !== doneGen) return;
          Speech.speakThen(card.front, function(){
            if(bd.doneGen !== doneGen) return;
            bd.autoGradeTimer = setTimeout(function(){
              if(bd.doneGen !== doneGen) return;
              if(S.view === 'study' && S.blendState === bd && S.studyQueue[0] && S.studyQueue[0].id === card.id){
                grade(autoRating('blend', true, elapsed));
              }
            }, 450);
          });
        });
      } else if(pct < 100 && bd.done){
        // Dragged back left after finishing -- cancel the pending auto-grade/advance and let the
        // child slide through it again (e.g. to re-hear a tricky chunk) instead of locking them out.
        bd.done = false;
        bd.doneGen = (bd.doneGen || 0) + 1;
        track.classList.remove('blend-done');
        handle.classList.remove('blend-handle-done');
        setDoneUI(false);
        if(bd.autoGradeTimer){ clearTimeout(bd.autoGradeTimer); bd.autoGradeTimer = null; }
        if(bd.fallbackTimer){ clearTimeout(bd.fallbackTimer); bd.fallbackTimer = null; }
      }
    }
    // Every listener here stops the pointer event from bubbling up to the study stage's own
    // swipe-to-peek-back gesture (wireSwipe listens for pointerdown on the stage itself, and a
    // pointerdown on this track is still, structurally, a pointerdown on the stage since it
    // bubbles). Without this, starting to drag the slider also kicked off a vertical card-swipe
    // underneath it -- the "scrolling" glitch reported on Sound Blend cards.
    track.addEventListener('pointerdown', function(e){
      e.stopPropagation();
      activePid = e.pointerId;
      try { track.setPointerCapture(activePid); } catch(err){}
      applyPct(pctFromClientX(e.clientX));
    });
    track.addEventListener('pointermove', function(e){
      if(activePid == null || e.pointerId !== activePid) return;
      e.stopPropagation();
      applyPct(pctFromClientX(e.clientX));
    });
    function endDrag(e){
      if(activePid == null || (e && e.pointerId !== activePid)) return;
      e.stopPropagation();
      activePid = null;
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
  }

  /* ---------- Listen & Pick ("listen" card mode) ----------
     The card's front is spoken and NOT shown; the learner picks what they heard. Answers are the card's
     meaning (back) by default, or the written word itself (front) when the card says so or has no
     meaning -- that second kind is a "sound twins" drill when the wrong answers sound alike (달 / 탈 / 딸).
     With no hand-typed wrong answers, they come from other cards in the deck, preferring ones that look
     and sound most like the right one. Graded automatically, like multiple choice. */
  function listenAnswerSide(card){ return (card.listenAnswer === 'front' || !String(card.back||'').trim()) ? 'front' : 'back'; }
  function lookAlikeLetters(str){
    var out = [];
    Array.from(String(str||'').toLowerCase()).forEach(function(ch){
      if(isHangulSyllable(ch)){ var p = hangulBlendPlan(ch); out = out.concat(p.chunks); }
      else if(/\S/.test(ch)) out.push(ch);
    });
    return out;
  }
  function lookAlikeScore(a, b){
    var x = lookAlikeLetters(a), y = lookAlikeLetters(b);
    if(!x.length || !y.length) return 0;
    var pool = y.slice(), same = 0;
    x.forEach(function(ch){ var k = pool.indexOf(ch); if(k !== -1){ same++; pool.splice(k,1); } });
    return same / Math.max(x.length, y.length) - Math.abs(x.length - y.length) * 0.05;
  }
  function buildListenRound(card){
    var side = listenAnswerSide(card);
    var answer = String(card[side]||'').trim();
    var wrong = (card.choices && card.choices.length) ? card.choices.slice(0, 3) : null;
    if(!wrong){
      var seen = {};
      var sibs = (S.timedChoiceAllCards || []).filter(function(c){ return c.id !== card.id; })
        .map(function(c){ return String(c[side]||'').trim(); })
        .filter(function(v){ if(!v || v === answer || seen[v]) return false; seen[v] = true; return true; });
      if(side === 'front'){
        sibs.sort(function(a, b){ return lookAlikeScore(answer, b) - lookAlikeScore(answer, a); });
        wrong = shuffle(sibs.slice(0, 5)).slice(0, 3);
      } else {
        wrong = shuffle(sibs).slice(0, 3);
      }
    }
    return { cardId: card.id, side: side, answer: answer, options: shuffle([answer].concat(wrong)), selected: null, played: false };
  }
  function playListen(card, slow){
    Speech.speak(card.front, slow ? { rate: 0.55, variant: 'slow' } : null);
    var btn = app.querySelector('[data-act="listen-play"]');
    if(btn){ btn.classList.add('playing'); setTimeout(function(){ btn.classList.remove('playing'); }, 1400); }
  }

  /* ---------- Echo ("echo" card mode): listen, say it, compare ----------
     Shadowing practice. The natural voice says the card's front; the learner records themselves
     saying it; the app then plays the voice and the recording one after the other and draws both as
     sound shapes on the same time scale, so length and rhythm can be compared by eye as well as by
     ear. Self-graded ("How close was it?"), since only a person can judge their own accent fairly.
     If the microphone can't be used here (no permission, or the browser blocks it), the card still
     works: listen, say it out loud along with the voice, and grade it. */
  var ECHO_MAX_MS = 9000;
  var echoRec = null; // { stream, recorder, chunks, ctx, analyser, raf, stopTimer, cardId }
  function echoMicAvailable(){
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
  /* ---------- Mic: asks before the microphone is ever touched ----------
     Coral Cove asks in its own words first ("Use the microphone?") and only then lets the browser
     show its permission box. The answer is saved on this device ('yes' / 'no'). On a child profile the
     question is for a grown-up, so it lives in Settings and the card just says so. Errors are sorted
     into plain reasons: the page isn't allowed a microphone where it's open (the Claude app frame),
     the browser's permission was turned down, or there's no microphone. */
  var Mic = (function(){
    var KEY = 'cc-mic';
    function get(){ try { return localStorage.getItem(KEY) || ''; } catch(e){ return ''; } }
    function set(v){ try { if(v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch(e){} }
    // false only when the page is told outright that it may not use a microphone where it's shown.
    function frameAllows(){
      try {
        var pp = document.permissionsPolicy || document.featurePolicy;
        if(pp && typeof pp.allowsFeature === 'function') return pp.allowsFeature('microphone');
      } catch(e){}
      return true;
    }
    function why(err){
      var n = err && err.name;
      if(!echoMicAvailable()) return 'unsupported';
      if(!frameAllows()) return 'blocked'; // browsers differ on the error name here (NotAllowed / NotSupported)
      if(n === 'NotFoundError' || n === 'OverconstrainedError') return 'nomic';
      if(n === 'NotAllowedError' || n === 'SecurityError') return frameAllows() ? 'denied' : 'blocked';
      if(n === 'NotReadableError' || n === 'AbortError') return 'busy';
      return 'denied';
    }
    var MSG = {
      blocked: 'The microphone isn\'t allowed in this window, so recording can\'t work here. Echo still works: say it out loud along with the voice. Recording works in the iPad copy of Coral Cove (opened from the Home Screen).',
      denied: 'The microphone is switched off for this page. To use it, allow the microphone in the browser\'s settings for this site, then tap Try again.',
      nomic: 'No microphone was found on this device.',
      busy: 'Another app is using the microphone. Close it, then tap Try again.',
      unsupported: 'This browser can\'t record sound. Echo still works: say it out loud along with the voice.'
    };
    // Opens the microphone once (shows the browser's box if needed), then closes it straight away.
    function check(){
      if(!echoMicAvailable()) return Promise.resolve({ ok:false, reason:'unsupported' });
      if(!frameAllows()) return Promise.resolve({ ok:false, reason:'blocked' });
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function(s){
        s.getTracks().forEach(function(t){ t.stop(); });
        return { ok:true };
      }, function(err){ return { ok:false, reason: why(err) }; });
    }
    return { get: get, set: set, why: why, msg: function(r){ return MSG[r] || MSG.denied; }, check: check, frameAllows: frameAllows };
  })();
  function micIsChild(){ return !!(S.profile && S.profile.mode !== 'adult' && !S.managingDecks); }
  function echoStartPhase(){
    if(!echoMicAvailable()) return 'nomic';
    var c = Mic.get();
    if(c === 'yes') return 'ready';
    if(c === 'no') return 'off';
    return micIsChild() ? 'askadult' : 'ask';
  }
  function echoStopStream(){
    if(!echoRec) return;
    try { if(echoRec.raf) cancelAnimationFrame(echoRec.raf); } catch(e){}
    try { if(echoRec.stopTimer) clearTimeout(echoRec.stopTimer); } catch(e){}
    try { echoRec.stream.getTracks().forEach(function(t){ t.stop(); }); } catch(e){}
    try { if(echoRec.ctx && echoRec.ctx.close) echoRec.ctx.close(); } catch(e){}
    echoRec = null;
  }
  function echoReset(){
    if(echoRec){ try { if(echoRec.recorder && echoRec.recorder.state !== 'inactive') echoRec.recorder.stop(); } catch(e){} echoStopStream(); }
    if(S.echoState && S.echoState.recUrl){ try { URL.revokeObjectURL(S.echoState.recUrl); } catch(e){} }
    S.echoState = null;
  }
  // 48 bars describing how loud each slice of a clip is -- enough to see syllables and pauses.
  function echoShape(url){
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC || !url || !window.fetch) return Promise.resolve(null);
    return fetch(url).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
      var ctx = new AC();
      return new Promise(function(res, rej){
        var done = false;
        var p = ctx.decodeAudioData(buf, function(b){ if(!done){ done = true; res(b); } }, function(e){ if(!done){ done = true; rej(e); } });
        if(p && p.then) p.then(function(b){ if(!done){ done = true; res(b); } }, function(e){ if(!done){ done = true; rej(e); } });
      }).then(function(ab){
        try { ctx.close(); } catch(e){}
        var d = ab.getChannelData(0), n = 48, step = Math.max(1, Math.floor(d.length / n)), bars = [], max = 0;
        for(var i = 0; i < n; i++){
          var sum = 0, cnt = 0;
          for(var j = i * step; j < Math.min(d.length, (i + 1) * step); j += 4){ sum += d[j] * d[j]; cnt++; }
          var v = cnt ? Math.sqrt(sum / cnt) : 0; bars.push(v); if(v > max) max = v;
        }
        return { bars: bars.map(function(v){ return max ? v / max : 0; }), secs: ab.duration };
      });
    }).catch(function(){ return null; });
  }
  function echoShapeHTML(shape, label, cls, longest){
    if(!shape) return '';
    var widthPct = longest ? Math.max(18, Math.round(shape.secs / longest * 100)) : 100;
    return '<div class="echo-shape '+cls+'"><span class="echo-shape-label">'+label+' <small>'+shape.secs.toFixed(1)+' s</small></span>' +
      '<div class="echo-bars" style="width:'+widthPct+'%">'+shape.bars.map(function(v){ return '<i style="height:'+Math.max(6, Math.round(v * 100))+'%"></i>'; }).join('')+'</div></div>';
  }
  function echoModelUrl(card){
    return VoicePack.find(card.front, null, 4000).then(function(c){ return c ? c.url : null; });
  }
  // Voice first, then the learner, with a short gap -- the comparison that makes shadowing work.
  function echoPlayBoth(card){
    var es = S.echoState; if(!es) return;
    function me(){ if(S.echoState === es && es.recUrl) setTimeout(function(){ if(S.echoState === es) Speech.playUrl(es.recUrl, 1); }, 350); }
    Speech.speakThen(card.front, me);
  }
  function echoStartRecording(card){
    var es = S.echoState;
    if(!es || es.phase === 'recording') return;
    Speech.stop();
    es.phase = 'starting'; render();
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function(stream){
      if(S.echoState !== es || S.view !== 'study'){ stream.getTracks().forEach(function(t){ t.stop(); }); return; }
      var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
      var type = '';
      for(var i = 0; i < types.length; i++){ try { if(MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])){ type = types[i]; break; } } catch(e){} }
      var recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      echoRec = { stream: stream, recorder: recorder, chunks: [], cardId: card.id };
      var rec = echoRec;
      recorder.ondataavailable = function(e){ if(e.data && e.data.size) rec.chunks.push(e.data); };
      recorder.onstop = function(){
        var blob = new Blob(rec.chunks, { type: recorder.mimeType || type || 'audio/webm' });
        echoStopStream();
        if(S.echoState !== es) return;
        if(es.recUrl){ try { URL.revokeObjectURL(es.recUrl); } catch(e){} }
        es.recUrl = blob.size ? URL.createObjectURL(blob) : null;
        es.phase = es.recUrl ? 'compare' : 'ready';
        es.tries += es.recUrl ? 1 : 0;
        es.meShape = null;
        render();
        if(!es.recUrl) return;
        echoShape(es.recUrl).then(function(sh){ if(S.echoState === es){ es.meShape = sh; echoRedrawShapes(); } });
        echoPlayBoth(card);
      };
      // A live level meter, so it's obvious the microphone is hearing something.
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        rec.ctx = new AC(); var src = rec.ctx.createMediaStreamSource(stream);
        rec.analyser = rec.ctx.createAnalyser(); rec.analyser.fftSize = 512; src.connect(rec.analyser);
        var data = new Uint8Array(rec.analyser.fftSize);
        (function tick(){
          if(echoRec !== rec) return;
          rec.analyser.getByteTimeDomainData(data);
          var peak = 0; for(var k = 0; k < data.length; k++){ peak = Math.max(peak, Math.abs(data[k] - 128)); }
          var el = document.getElementById('echoLevel'); if(el) el.style.transform = 'scaleX(' + Math.min(1, peak / 64).toFixed(3) + ')';
          rec.raf = requestAnimationFrame(tick);
        })();
      } catch(e){}
      recorder.start();
      es.phase = 'recording'; es.recStartedAt = Date.now();
      rec.stopTimer = setTimeout(function(){ echoStopRecording(); }, Math.max(4000, Math.min(ECHO_MAX_MS, (es.modelShape ? es.modelShape.secs * 2600 : 4000) + 2000)));
      render();
    }).catch(function(err){
      if(S.echoState !== es) return;
      es.phase = 'nomic'; es.micError = Mic.why(err);
      render();
    });
  }
  // "Yes, use the microphone": save the answer, let the browser ask, then go straight to recording.
  function echoAllowMic(card){
    var es = S.echoState; if(!es) return;
    Mic.set('yes');
    echoStartRecording(card);
  }
  function echoStopRecording(){
    if(!echoRec || !echoRec.recorder) return;
    try { if(echoRec.recorder.state !== 'inactive') echoRec.recorder.stop(); else echoStopStream(); } catch(e){ echoStopStream(); }
  }
  function echoRedrawShapes(){
    var box = document.getElementById('echoShapes'), es = S.echoState;
    if(!box || !es) return;
    var longest = Math.max(es.modelShape ? es.modelShape.secs : 0, es.meShape ? es.meShape.secs : 0);
    box.innerHTML = echoShapeHTML(es.modelShape, '🔊 Voice', 'model', longest) + echoShapeHTML(es.meShape, '🎙️ You', 'me', longest);
  }
  function echoStageHTML(card){
    if(!S.echoState || S.echoState.cardId !== card.id){
      var ph0 = echoStartPhase(), blocked0 = ph0 === 'ready' && !Mic.frameAllows();
      S.echoState = { cardId: card.id, phase: blocked0 ? 'nomic' : ph0, micError: blocked0 ? 'blocked' : null, recUrl: null, tries: 0, played: false, modelShape: null, meShape: null };
    }
    var es = S.echoState, ph = es.phase;
    var mic;
    if(ph === 'recording') mic = '<button type="button" class="echo-rec on" data-act="echo-stop" aria-label="Stop recording"><span class="echo-dot"></span>Stop</button><div class="echo-level"><i id="echoLevel"></i></div>';
    else if(ph === 'starting') mic = '<button type="button" class="echo-rec" disabled><span class="echo-dot"></span>Getting the microphone…</button>';
    else if(ph === 'ask') mic = '<div class="mic-ask" role="group" aria-labelledby="micAskTitle">' +
        '<div class="mic-ask-title" id="micAskTitle">🎙️ Use the microphone?</div>' +
        '<p>Coral Cove can record you saying it, so you can hear yourself next to the voice. The recording stays on this device and is deleted when you move to the next card.</p>' +
        '<div class="mic-ask-btns"><button type="button" class="btn btn-primary" data-act="mic-yes">Yes, use the microphone</button><button type="button" class="btn btn-ghost" data-act="mic-no">Not now</button></div>' +
        '<small>Your browser will ask too. You can change this any time in ⚙️ Settings.</small></div>';
    else if(ph === 'askadult') mic = '<div class="mic-ask"><p>🎙️ A grown-up can turn on the microphone in ⚙️ Settings.</p></div>';
    else if(ph === 'off') mic = '<button type="button" class="btn btn-ghost mic-turnon" data-act="mic-yes">🎙️ Turn on the microphone</button>';
    else if(ph === 'nomic') mic = (es.micError && es.micError !== 'blocked' && es.micError !== 'unsupported' && es.micError !== 'nomic') ? '<button type="button" class="btn btn-ghost mic-turnon" data-act="echo-record">🎙️ Try again</button>' : '';
    else mic = '<button type="button" class="echo-rec" data-act="echo-record"><span class="echo-dot"></span>'+(es.tries ? 'Record again' : 'Record yourself')+'</button>';
    var compare = ph === 'compare'
      ? '<div class="echo-compare"><button type="button" class="btn btn-ghost" data-act="echo-play-both">▶ Voice, then you</button><button type="button" class="btn btn-ghost" data-act="echo-play-me">▶ Just you</button></div>'
      : '';
    var sayIt = 'Say it out loud along with the voice, then tap how it went.';
    var hint = ph === 'nomic'
      ? (es.micError ? Mic.msg(es.micError === true ? 'denied' : es.micError) + (es.micError === 'blocked' || es.micError === 'unsupported' ? '' : ' Or ' + sayIt.charAt(0).toLowerCase() + sayIt.slice(1)) : sayIt)
      : (ph === 'ask' || ph === 'askadult' || ph === 'off') ? sayIt
      : (ph === 'recording' ? 'Say it now — tap Stop when you finish.' : (ph === 'compare' ? 'Listen to both. How close was it?' : 'Listen, then record yourself saying it.'));
    var showGrade = ph !== 'recording' && ph !== 'starting' && ph !== 'ask'; // answer the microphone question first; after that it never blocks
    return '' +
      '<div class="flip-scene" style="position:relative;z-index:1;">' +
        '<div class="face face-front read-face echo-face">' +
          '<div class="read-label">🎙️ Echo it</div>' +
          (card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
          '<div class="card-text" data-echo-text>'+esc(card.front)+'</div>' +
          (card.back ? '<div class="echo-meaning">'+esc(card.back)+'</div>' : '') +
          '<div class="listen-big echo-listen">' +
            '<button type="button" class="listen-play" data-act="echo-listen" aria-label="Hear it">'+ccIcon('sound')+'</button>' +
            '<button type="button" class="btn btn-ghost listen-slow" data-act="echo-slow">🐢 Slower</button>' +
          '</div>' +
          '<div class="echo-mic">'+mic+'</div>' +
          '<div class="echo-shapes" id="echoShapes" aria-hidden="true"></div>' +
          compare +
        '</div>' +
      '</div>' +
      '<div class="flip-hint" style="position:relative;z-index:1;">'+hint+'</div>' +
      (showGrade ? outcomeRowHTML() : '');
  }
  function wireEcho(card){
    var es = S.echoState; if(!es) return;
    function q(a){ return app.querySelector('[data-act="'+a+'"]'); }
    var b;
    if((b = q('echo-listen'))) b.addEventListener('click', function(e){ e.stopPropagation(); Speech.speak(card.front); });
    if((b = q('echo-slow'))) b.addEventListener('click', function(e){ e.stopPropagation(); Speech.speak(card.front, { rate: 0.6, variant: 'slow' }); });
    if((b = q('echo-record'))) b.addEventListener('click', function(e){ e.stopPropagation(); echoStartRecording(card); });
    if((b = q('mic-yes'))) b.addEventListener('click', function(e){ e.stopPropagation(); echoAllowMic(card); });
    if((b = q('mic-no'))) b.addEventListener('click', function(e){ e.stopPropagation(); Mic.set('no'); es.phase = 'off'; render(); });
    if((b = q('echo-stop'))) b.addEventListener('click', function(e){ e.stopPropagation(); echoStopRecording(); });
    if((b = q('echo-play-both'))) b.addEventListener('click', function(e){ e.stopPropagation(); echoPlayBoth(card); });
    if((b = q('echo-play-me'))) b.addEventListener('click', function(e){ e.stopPropagation(); if(es.recUrl) Speech.playUrl(es.recUrl, 1); });
    if(!es.played){
      es.played = true;
      setTimeout(function(){ if(S.view === 'study' && S.echoState === es && es.phase !== 'recording') Speech.speak(card.front); }, 350);
      echoModelUrl(card).then(function(u){ return u ? echoShape(u) : null; }).then(function(sh){ if(S.echoState === es){ es.modelShape = sh; echoRedrawShapes(); } });
    }
    echoRedrawShapes();
  }

  /* ---------- Sentence Builder ("build" card mode) ----------
     The meaning (back) is shown; the sentence (front) is cut into its words, shuffled, and put back in
     order by tapping tiles. Korean splits on spaces, so each tile is a whole word with its particle
     (커피를, 카페에) -- word order and particles get practised together. Tapping a placed tile sends
     it back. On a wrong order the tiles already in the right place stay (green) and the rest go back
     for one more try; a second miss shows the sentence and moves on. 🔊 Hear it is the hint. */
  function buildTokens(front){
    var words = String(front||'').trim().split(/\s+/).filter(Boolean);
    var end = '';
    if(words.length){
      var last = words[words.length-1], m = last.match(/^(.*?)([.!?。]+["”’]?)$/);
      if(m && m[1]){ words[words.length-1] = m[1]; end = m[2]; }
    }
    return { words: words, end: end };
  }
  function buildRound(card){
    var tk = buildTokens(card.front);
    var tiles = tk.words.map(function(w, i){ return { id: 't' + i, t: w }; });
    (card.choices || []).slice(0, 3).forEach(function(w, i){ if(String(w||'').trim()) tiles.push({ id: 'x' + i, t: String(w).trim() }); });
    var order = shuffle(tiles.slice());
    for(var k = 0; k < 6 && tk.words.length > 1 && order.slice(0, tk.words.length).map(function(x){ return x.t; }).join(' ') === tk.words.join(' '); k++) order = shuffle(tiles.slice());
    return { cardId: card.id, words: tk.words, end: tk.end, tiles: order, placed: [], locked: [], attempt: 1, result: null, hint: false };
  }
  function buildStageHTML(card){
    if(!S.buildState || S.buildState.cardId !== card.id) S.buildState = buildRound(card);
    var bs = S.buildState, done = bs.result === 'right' || bs.result === 'shown';
    var byId = {}; bs.tiles.forEach(function(t){ byId[t.id] = t; });
    var slots = bs.placed.map(function(id, i){
      var cls = 'build-tile placed' + (bs.locked.indexOf(i) !== -1 || done ? ' ok' : '');
      return '<button type="button" class="'+cls+'" data-build-placed="'+i+'"'+(done || bs.locked.indexOf(i) !== -1 ? ' disabled' : '')+'>'+esc(byId[id].t)+'</button>';
    }).join('');
    var empties = Math.max(0, bs.words.length - bs.placed.length);
    for(var e = 0; e < empties; e++) slots += '<span class="build-slot" aria-hidden="true"></span>';
    var bank = done ? '' : bs.tiles.filter(function(t){ return bs.placed.indexOf(t.id) === -1; }).map(function(t){
      return '<button type="button" class="build-tile" data-build-tile="'+t.id+'">'+esc(t.t)+'</button>';
    }).join('');
    var fb;
    if(bs.result === 'right') fb = '<div class="choice-feedback ok">'+(bs.attempt > 1 || bs.hint ? 'You built it! 🎉' : 'Nice building! 🎉')+'</div>';
    else if(bs.result === 'shown') fb = '<div class="choice-feedback no">'+gentleMiss('Good try!', bs.words.join(' ') + bs.end)+'</div>';
    else if(bs.result === 'retry') fb = '<div class="choice-feedback no">Almost! The green words are in the right place. Try the rest again.</div>';
    else fb = '<div class="flip-hint" style="position:relative;z-index:1;">Tap the words in order</div>';
    return '' +
      '<div class="flip-scene" style="position:relative;z-index:1;">' +
        '<div class="face face-front read-face build-face">' +
          '<div class="read-label">🧩 Build the sentence</div>' +
          (card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
          '<div class="card-text build-meaning">'+esc(card.back || '…')+'</div>' +
          '<div class="build-tools"><button type="button" class="btn btn-ghost" data-act="build-hear">🔊 Hear it</button>' +
            (!done && bs.placed.length > bs.locked.length ? '<button type="button" class="btn btn-ghost" data-act="build-undo">↩︎ Undo</button>' : '') + '</div>' +
          '<div class="build-line" aria-label="Your sentence">'+slots+(bs.end ? '<span class="build-end">'+esc(bs.end)+'</span>' : '')+'</div>' +
        '</div>' +
      '</div>' +
      (bank ? '<div class="build-bank">'+bank+'</div>' : '') +
      fb;
  }
  function wireBuild(card){
    var bs = S.buildState; if(!bs) return;
    function check(){
      var byId = {}; bs.tiles.forEach(function(t){ byId[t.id] = t; });
      var got = bs.placed.map(function(id){ return byId[id].t; });
      var elapsed = Date.now() - (S.cardShownAt || Date.now());
      if(got.join(' ') === bs.words.join(' ')){
        bs.result = 'right'; Sound.correct(); render();
        Speech.speak(card.front);
        var rating = (bs.attempt > 1 || bs.hint) ? 'hard' : autoRating('build', true, elapsed);
        setTimeout(function(){ if(S.buildState === bs) grade(rating, true); }, 1900);
        return;
      }
      if(bs.attempt === 1){
        bs.attempt = 2; bs.result = 'retry'; Sound.wrong();
        var keep = [], lockedIdx = [];
        got.forEach(function(w, i){ if(w === bs.words[i] && keep.length === i){ keep.push(bs.placed[i]); lockedIdx.push(i); } });
        bs.placed = keep; bs.locked = lockedIdx;
        render();
        return;
      }
      bs.result = 'shown'; Sound.wrong();
      var byText = {}; bs.tiles.forEach(function(t){ (byText[t.t] = byText[t.t] || []).push(t.id); });
      bs.placed = bs.words.map(function(w){ return (byText[w] || []).shift(); }).filter(Boolean);
      render();
      setTimeout(function(){ if(S.buildState === bs) Speech.speak(card.front); }, 250);
      setTimeout(function(){ if(S.buildState === bs) grade('again', true); }, 2600 + WRONG_EXTRA_MS);
    }
    app.querySelectorAll('[data-build-tile]').forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        if(S.transitioning || bs.result === 'right' || bs.result === 'shown') return;
        if(bs.placed.length >= bs.words.length) return;
        var t = bs.tiles.filter(function(x){ return x.id === b.dataset.buildTile; })[0];
        if(!t) return;
        bs.placed.push(t.id); if(bs.result === 'retry') bs.result = null;
        Speech.speak(t.t);
        if(bs.placed.length === bs.words.length) check(); else render();
      });
    });
    app.querySelectorAll('[data-build-placed]').forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        var i = parseInt(b.dataset.buildPlaced, 10);
        if(bs.result === 'right' || bs.result === 'shown' || bs.locked.indexOf(i) !== -1) return;
        bs.placed.splice(i, 1); render();
      });
    });
    var u = app.querySelector('[data-act="build-undo"]');
    if(u) u.addEventListener('click', function(e){ e.stopPropagation(); if(bs.placed.length > bs.locked.length){ bs.placed.pop(); render(); } });
    var h = app.querySelector('[data-act="build-hear"]');
    if(h) h.addEventListener('click', function(e){ e.stopPropagation(); if(bs.result == null || bs.result === 'retry') bs.hint = true; Speech.speak(card.front); });
  }

  /* ---------- Chinese bridge ("hanja" card mode): Korean words built from Chinese characters ----------
     For a learner who reads Chinese (Traditional first). A card carries the Korean word (front), its
     meaning (back), the Hanja as written in Korea (hanja), the Chinese in Traditional (zh, Taiwan
     standard) and Simplified (zhS), pinyin (py, one syllable per character), the Hangul those
     characters spell (sino) and a group: 'same' (Chinese uses the same word), 'helps' (the characters
     point the way, but Chinese says it differently: zhSay) or 'false' (the Chinese word exists but
     means something else). One direction per card, alternating each time the card comes round: see
     and hear the Chinese, pick the Korean; or see and hear the Korean, pick the Chinese. After
     answering, each character lines up with its Korean sound (學 → 학, xué), and each column can be
     tapped to hear the character in Mandarin, then in Korean. Mandarin comes from the voice pack
     (variant 'zh'); "Next" moves on (no timer: the bridge is the part worth reading). */
  var HANJA_GROUPS = {
    same: { icon:'🟢', label:'Same in Chinese' },
    helps: { icon:'🟡', label:'The characters help' },
    'false': { icon:'🔴', label:'False friend' }
  };
  function hanjaZh(card){ return String(card.zh || card.hanja || '').trim(); }
  function hanjaSayZh(text){ Speech.speak(text, { variant:'zh' }); }
  function hanjaRound(card){
    // directions take turns through a round; a card seen before starts from the other side next time
    S.hzTurn = (S.hzTurn || 0) + 1;
    var dir = ((S.hzTurn + (card.timesSeen || 0)) % 2) ? 'zh2ko' : 'ko2zh';
    var answer = dir === 'zh2ko' ? String(card.front || '').trim() : hanjaZh(card);
    var pool = (S.timedChoiceAllCards || []).filter(function(c){ return c.id !== card.id && c.mode === 'hanja'; });
    var seen = {}; seen[answer] = 1;
    var cand = pool.map(function(c){ return dir === 'zh2ko' ? String(c.front || '').trim() : hanjaZh(c); })
      .filter(function(v){ if(!v || seen[v]) return false; seen[v] = 1; return true; });
    // Look-alikes first (a shared character or syllable, a similar length), so the characters have to be read.
    var share = function(v){ var n = 0; Array.from(v).forEach(function(ch){ if(/\S/.test(ch) && answer.indexOf(ch) !== -1) n++; }); return n * 2 - Math.abs(Array.from(v).length - Array.from(answer).length); };
    cand.sort(function(a, b){ return share(b) - share(a); });
    var wrong = shuffle(cand.slice(0, 6)).slice(0, 3);
    return { cardId: card.id, dir: dir, answer: answer, options: shuffle([answer].concat(wrong)), selected: null, played: false };
  }
  // 學 → 학 / xué, one tappable column per character
  function hanjaBridgeHTML(card){
    var tr = Array.from(hanjaZh(card)), sp = Array.from(String(card.zhS || '')), ko = Array.from(String(card.sino || '')), py = String(card.py || '').split(/\s+/);
    if(!tr.length) return '';
    return '<div class="hz-bridge" aria-label="Character by character. Tap a character to hear it.">' + tr.map(function(t, i){
      var s = sp[i];
      return '<button type="button" class="hz-col" data-hz-ch="'+i+'" aria-label="'+esc(t)+', '+esc(py[i] || '')+' in Mandarin, '+esc(ko[i] || '')+' in Korean">' +
        '<span class="hz-ch" lang="zh-Hant">'+esc(t)+(s && s !== t ? '<small lang="zh-Hans">'+esc(s)+'</small>' : '')+'</span>' +
        '<span class="hz-ko" lang="ko">'+esc(ko[i] || '')+'</span><span class="hz-py">'+esc(py[i] || '')+'</span></button>';
    }).join('<span class="hz-plus" aria-hidden="true">+</span>') + '</div>';
  }
  function hanjaKoHTML(card){
    var w = String(card.front || ''), s = String(card.sino || '');
    var i = s ? w.indexOf(s) : -1;
    if(i < 0) return esc(w);
    return esc(w.slice(0, i)) + '<mark class="hz-mark">' + esc(s) + '</mark>' + esc(w.slice(i + s.length));
  }
  function hanjaStageHTML(card){
    if(!S.hanjaState || S.hanjaState.cardId !== card.id) S.hanjaState = hanjaRound(card);
    var hs = S.hanjaState, done = hs.selected != null, right = done && hs.options[hs.selected] === hs.answer;
    var zh = hanjaZh(card), sp = String(card.zhS || ''), kr = String(card.hanja || '');
    var extra = (sp && sp !== zh ? '<span>简 <b lang="zh-Hans">'+esc(sp)+'</b></span>' : '') + (kr && kr !== zh ? '<span>in Korea <b lang="ko">'+esc(kr)+'</b></span>' : '');
    var prompt = hs.dir === 'zh2ko'
      ? '<div class="read-label">🀄 Which Korean word?</div><div class="card-text hz-zh" lang="zh-Hant">'+esc(zh)+'</div>' +
        (card.py ? '<div class="hz-pinyin">'+esc(card.py)+'</div>' : '') + (extra ? '<div class="hz-trad">'+extra+'</div>' : '') +
        '<button type="button" class="btn btn-ghost hz-hear" data-act="hz-hear-zh" aria-label="Hear it in Mandarin">🔊 Mandarin</button>'
      : '<div class="read-label">🀄 Which Chinese characters?</div><div class="card-text" lang="ko">'+esc(card.front)+'</div>' +
        '<button type="button" class="btn btn-ghost hz-hear" data-act="hz-hear-ko" aria-label="Hear the Korean word">🔊 Korean</button>';
    var opts = hs.options.map(function(o, i){
      var cls = 'choice-btn hz-opt' + (hs.dir === 'ko2zh' ? ' hz-opt-zh' : '');
      if(done){ if(o === hs.answer) cls += ' correct'; else if(i === hs.selected) cls += ' wrong'; }
      return '<button type="button" class="'+cls+'" data-hz-idx="'+i+'" lang="'+(hs.dir === 'zh2ko' ? 'ko' : 'zh-Hant')+'"'+(done ? ' disabled' : '')+'>'+esc(o)+'</button>';
    }).join('');
    var g = HANJA_GROUPS[card.hzClass] || HANJA_GROUPS.same;
    var reveal = done ? '' +
      '<div class="hz-reveal">' +
        '<div class="hz-word" lang="ko">'+hanjaKoHTML(card)+'<span class="hz-mean">'+esc(card.back || '')+'</span></div>' +
        hanjaBridgeHTML(card) +
        '<div class="hz-group hz-'+esc(card.hzClass || 'same')+'"><span>'+g.icon+' '+g.label+'</span>' +
          (card.zhSay ? '<button type="button" class="hz-say" data-act="hz-say" aria-label="Chinese says '+esc(card.zhSay)+'. Hear it">Chinese says <b lang="zh-Hant">'+esc(card.zhSay)+'</b>'+(card.zhSayS && card.zhSayS !== card.zhSay ? ' <small lang="zh-Hans">'+esc(card.zhSayS)+'</small>' : '')+' 🔊</button>' : '') + '</div>' +
        (card.note ? '<p class="hz-note">'+esc(card.note)+'</p>' : '') +
      '</div>' : '';
    return '' +
      '<div class="flip-scene" style="position:relative;z-index:1;">' +
        '<div class="face face-front read-face hz-face">' + prompt + reveal + '</div>' +
      '</div>' +
      (done ? '' : '<div class="choice-row">'+opts+'</div>') +
      (done
        ? '<div class="choice-feedback '+(right ? 'ok' : 'no')+'">'+(right ? 'Nice reading! 🎉' : gentleMiss('Good try!', hs.answer))+'</div>' +
          '<div class="form-actions hz-next-row"><button type="button" class="btn btn-primary" data-act="hz-next">Next ▸</button></div>'
        : '<div class="flip-hint" style="position:relative;z-index:1;">'+(hs.dir === 'zh2ko' ? 'Read the characters, then pick the Korean' : 'Pick the Chinese for this Korean word')+'</div>');
  }
  function wireHanja(card){
    var hs = S.hanjaState; if(!hs) return;
    var on = function(sel, fn){ var b = app.querySelector(sel); if(b) b.addEventListener('click', function(e){ e.stopPropagation(); fn(b); }); };
    on('[data-act="hz-hear-zh"]', function(){ hanjaSayZh(hanjaZh(card)); });
    on('[data-act="hz-hear-ko"]', function(){ Speech.speak(card.front); });
    on('[data-act="hz-say"]', function(){ hanjaSayZh(String(card.zhSay || '').split('/')[0].trim()); });
    // the first time a card shows, it speaks its prompt: Mandarin for Chinese, Korean for Korean
    if(!hs.played){ hs.played = true; setTimeout(function(){ if(S.view === 'study' && S.hanjaState === hs && hs.selected == null){ if(hs.dir === 'zh2ko') hanjaSayZh(hanjaZh(card)); else Speech.speak(card.front); } }, 350); }
    var tr = Array.from(hanjaZh(card)), ko = Array.from(String(card.sino || ''));
    app.querySelectorAll('[data-hz-ch]').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation(); var i = parseInt(btn.dataset.hzCh, 10);
        btn.classList.remove('ping'); void btn.offsetWidth; btn.classList.add('ping');
        Speech.speakThen(tr[i], function(){ if(ko[i]) setTimeout(function(){ Speech.speak(ko[i]); }, 180); }, { variant:'zh' });
      });
    });
    app.querySelectorAll('[data-hz-idx]').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(hs.selected != null || S.transitioning || S.hanjaState !== hs) return;
        hs.selected = parseInt(btn.dataset.hzIdx, 10);
        var right = hs.options[hs.selected] === hs.answer;
        hs.elapsed = Date.now() - (S.cardShownAt || Date.now());
        hs.rating = autoRating('hanja', right, hs.elapsed);
        if(right) Sound.correct(); else Sound.wrong();
        render();
        // the Korean word then the Chinese, now that the characters are lined up under it
        setTimeout(function(){ if(S.view === 'study' && S.hanjaState === hs) Speech.speakThen(card.front, function(){ setTimeout(function(){ if(S.view === 'study' && S.hanjaState === hs) hanjaSayZh(hanjaZh(card)); }, 250); }); }, 250);
        var nx = app.querySelector('[data-act="hz-next"]'); if(nx) try { nx.focus({ preventScroll:true }); } catch(err){}
      });
    });
    on('[data-act="hz-next"]', function(){ if(hs.rating) grade(hs.rating, true); });
  }

  /* ---------- Native or Sino? ("numsys" card mode): which set of numbers fits the situation ----------
     Korean has two sets of numbers: native (하나, 둘, 셋 …; 한, 두, 세, 네 before a counter) and
     Sino-Korean (일, 이, 삼 …, from Chinese 一 二 三). A card shows a situation (emoji + English, e.g.
     🕒 Three o'clock) and the learner picks the right Korean (세 시, not 삼 시 or 셋 시). After
     answering: which set it uses, the phrase in pieces (세 = 3 (셋 → 세) + 시 = o'clock), the rule in
     one line, and "All the number rules" (every rule in the deck, grouped by set). Card fields:
     front (Korean answer), back (situation), nsEmoji, choices (wrong answers), nsSys
     (native|sino|both), nsRule (the rule, one line), nsParts ([[piece, gloss], …]). */
  var NUMSYS = {
    native: { icon:'🔤', label:'Native Korean numbers', eg:'하나 둘 셋 · 한 두 세 네' },
    sino: { icon:'🀄', label:'Sino-Korean numbers', eg:'일 이 삼 사 · from 一 二 三 四' },
    both: { icon:'🔤🀄', label:'Both sets together', eg:'' }
  };
  function numsysRound(card){
    var answer = String(card.front || '').trim();
    var wrong = (card.choices || []).map(function(x){ return String(x).trim(); }).filter(function(x){ return x && x !== answer; });
    if(wrong.length < 2){ // a hand-made card with few wrong answers borrows from the deck
      var more = shuffle((S.timedChoiceAllCards || []).filter(function(c){ return c.id !== card.id && c.mode === 'numsys'; }).map(function(c){ return String(c.front || '').trim(); }));
      more.forEach(function(x){ if(wrong.length < 3 && x && x !== answer && wrong.indexOf(x) === -1) wrong.push(x); });
    }
    return { cardId: card.id, answer: answer, options: shuffle([answer].concat(wrong.slice(0, 3))), selected: null };
  }
  function numsysRulesHTML(){
    var seen = {}, by = { native: [], sino: [], both: [] };
    (S.timedChoiceAllCards || []).forEach(function(c){
      if(c.mode !== 'numsys' || !c.nsRule || seen[c.nsRule]) return;
      seen[c.nsRule] = 1; (by[c.nsSys] || by.both).push(c.nsRule);
    });
    return ['native', 'sino', 'both'].filter(function(k){ return by[k].length; }).map(function(k){
      return '<div class="ns-rgroup"><b>'+NUMSYS[k].icon+' '+NUMSYS[k].label+'</b><ul>'+by[k].map(function(r){ return '<li lang="ko">'+esc(r)+'</li>'; }).join('')+'</ul></div>';
    }).join('');
  }
  function numsysStageHTML(card){
    if(!S.numsysState || S.numsysState.cardId !== card.id) S.numsysState = numsysRound(card);
    var ns = S.numsysState, done = ns.selected != null, right = done && ns.options[ns.selected] === ns.answer;
    var sys = NUMSYS[card.nsSys] || NUMSYS.native;
    var opts = ns.options.map(function(o, i){
      var cls = 'choice-btn ns-opt';
      if(done){ if(o === ns.answer) cls += ' correct'; else if(i === ns.selected) cls += ' wrong'; }
      return '<button type="button" class="'+cls+'" data-ns-idx="'+i+'" lang="ko"'+(done ? ' disabled' : '')+'>'+esc(o)+'</button>';
    }).join('');
    var parts = (card.nsParts || []).map(function(p){
      return '<div class="ns-part"><span class="ns-piece" lang="ko">'+esc(p[0])+'</span><span class="ns-gloss">'+esc(p[1] || '')+'</span></div>';
    }).join('<span class="hz-plus" aria-hidden="true">+</span>');
    var reveal = done ? '' +
      '<div class="hz-reveal ns-reveal">' +
        '<div class="hz-word" lang="ko">'+esc(card.front)+'<button type="button" class="btn btn-ghost hz-hear" data-act="ns-hear" aria-label="Hear it again">'+ccIcon('sound')+'</button></div>' +
        '<div class="ns-sys ns-'+esc(card.nsSys || 'native')+'">'+sys.icon+' '+sys.label+(sys.eg ? '<small lang="ko">'+esc(sys.eg)+'</small>' : '')+'</div>' +
        (parts ? '<div class="ns-parts">'+parts+'</div>' : '') +
        (card.nsRule ? '<p class="hz-note ns-rule" lang="ko">'+esc(card.nsRule)+'</p>' : '') +
        '<details class="ns-all"><summary>📋 All the number rules</summary>'+numsysRulesHTML()+'</details>' +
      '</div>' : '';
    return '' +
      '<div class="flip-scene" style="position:relative;z-index:1;">' +
        '<div class="face face-front read-face hz-face">' +
          '<div class="read-label">🔢 Native or Sino?</div>' +
          (card.nsEmoji ? '<div class="ns-emoji" aria-hidden="true">'+esc(card.nsEmoji)+'</div>' : '') +
          '<div class="card-text">'+esc(card.back || '')+'</div>' + reveal +
        '</div>' +
      '</div>' +
      (done ? '' : '<div class="choice-row">'+opts+'</div>') +
      (done
        ? '<div class="choice-feedback '+(right ? 'ok' : 'no')+'">'+(right ? 'Nice counting! 🎉' : gentleMiss('Good try!', ns.answer))+'</div>' +
          '<div class="form-actions hz-next-row"><button type="button" class="btn btn-primary" data-act="ns-next">Next ▸</button></div>'
        : '<div class="flip-hint" style="position:relative;z-index:1;">Which one would a Korean say?</div>');
  }
  function wireNumsys(card){
    var ns = S.numsysState; if(!ns) return;
    var hear = app.querySelector('[data-act="ns-hear"]');
    if(hear) hear.addEventListener('click', function(e){ e.stopPropagation(); Speech.speak(card.front); });
    var det = app.querySelector('.ns-all');
    if(det) det.addEventListener('click', function(e){ e.stopPropagation(); }); // opening the rules isn't a tap on the card
    app.querySelectorAll('[data-ns-idx]').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(ns.selected != null || S.transitioning || S.numsysState !== ns) return;
        ns.selected = parseInt(btn.dataset.nsIdx, 10);
        var right = ns.options[ns.selected] === ns.answer;
        ns.rating = autoRating('numsys', right, Date.now() - (S.cardShownAt || Date.now()));
        if(right) Sound.correct(); else Sound.wrong();
        render();
        setTimeout(function(){ if(S.view === 'study' && S.numsysState === ns) Speech.speak(card.front); }, 250);
        var nx = app.querySelector('[data-act="ns-next"]'); if(nx) try { nx.focus({ preventScroll:true }); } catch(err){}
      });
    });
    var nx = app.querySelector('[data-act="ns-next"]');
    if(nx) nx.addEventListener('click', function(e){ e.stopPropagation(); if(ns.rating) grade(ns.rating, true); });
  }

  function renderStudy(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || {name:'Deck', emoji:'🌊'};
    if(!S.studyQueue.length){
      finishStudy();
      return;
    }
    var card = S.studyQueue[0];
    if(S.currentCardId !== card.id){
      // A new card is on stage — reset per-card UI state and start the response-time clock.
      S.currentCardId = card.id;
      S.cardShownAt = Date.now();
      S.cardFlippedAt = null;
      S.cardFlipped = false;
      S.choiceState = null;
      S.dragState = null;
      S.timedChoiceState = null;
      clearTimedChoiceTimer();
      S.blendState = null;
      S.listenState = null;
      echoReset();
      S.buildState = null;
      S.hanjaState = null;
      S.numsysState = null;
    }
    var mode = (CARD_MODES.indexOf(card.mode) !== -1) ? card.mode : 'flip';
    var peeking = S.peeking && !!S.lastAnsweredCard;
    var doneCount = S.sessionReviewed;
    var labelCount = peeking ? doneCount : (doneCount + 1);
    var progressBase = peeking ? Math.max(0, doneCount - 1) : doneCount;
    var progressPct = S.studyTotal > 0 ? Math.min(100, Math.max(0, Math.round((progressBase / S.studyTotal) * 100))) : 0;
    // The critter bar/fill are recreated from scratch on every render() (this whole screen is one
    // big innerHTML replace), so a plain CSS width/left transition never has a "before" state to
    // animate from — it just snaps. To make it travel smoothly instead, paint the bar at wherever
    // it last visually landed, then nudge it to the real value a frame later so the CSS transition
    // (already defined on .critter-track-fill / .critter-swim) has something to interpolate between.
    var startPct = S.critterPrevPct || 0;
    var critterHTML = '' +
      '<div class="critter-label">'+(peeking ? 'Reviewing question ' : 'Question ')+labelCount+' of '+S.studyTotal+'</div>' +
      '<div class="critter-track" role="progressbar" aria-label="Round progress" aria-valuemin="0" aria-valuemax="'+S.studyTotal+'" aria-valuenow="'+progressBase+'">' +
        '<div class="critter-track-fill" style="width:'+startPct+'%"></div>' +
        (S.studyTotal > 0 && S.studyTotal <= 40 ? '<div class="cove-dots" aria-hidden="true">'+Array.apply(null, Array(S.studyTotal)).map(function(_, i){ var k = i + 1; return '<i class="'+(k <= progressBase ? 'on' : '')+(k === S.studyTotal ? ' goal' : '')+'" style="left:'+(k / S.studyTotal * 100)+'%"></i>'; }).join('')+'</div>' : '') +
        '<div class="critter-swim'+(S.lastOutcomeWrong?' oops':'')+'" style="left:'+startPct+'%">'+critterSVG(S.lastOutcomeWrong)+'</div>' +
      '</div>';

    var stageInner;
    // cove: paint the card in the state it was last SHOWN in, then turn it a frame later, so tapping
    // the card actually plays the flip instead of the whole screen re-appearing already flipped.
    var coveFlipFrom = (S.__coveFlipCard === card.id && !peeking) ? !!S.__coveFlipShown : !!S.cardFlipped;
    var coveKey = card.id + '|' + S.sessionReviewed + '|' + (peeking ? 1 : 0);
    var coveSame = S.__coveStageKey === coveKey;
    if(peeking){
      stageInner = buildPeekInner(S.lastAnsweredCard);
    } else if(mode === 'read'){
      stageInner = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">🗣️ Read it out loud</div>' +
            (card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
            '<div class="card-text">'+esc(card.front)+'</div>' +
            (card.note?'<div class="card-note dim">'+esc(card.note)+'</div>':'') +
          '</div>' +
        '</div>' +
        '<div class="flip-hint" style="position:relative;z-index:1;">'+(currentDifficulty().id === 'hard' ? 'How well did they know it?' : 'Did they read it right?')+'</div>' +
        outcomeRowHTML();
    } else if(mode === 'choice'){
      if(!S.choiceState || S.choiceState.cardId !== card.id){
        S.choiceState = { cardId: card.id, options: shuffle([card.back].concat(card.choices||[])), selected: null };
      }
      var cs = S.choiceState;
      var pickedCorrect = cs.selected != null && cs.options[cs.selected] === card.back;
      var optsHTML = cs.options.map(function(opt, idx){
        var cls = 'choice-btn';
        if(cs.selected != null){
          if(opt === card.back) cls += ' correct';
          else if(idx === cs.selected) cls += ' wrong';
        }
        return '<button type="button" class="'+cls+'" data-choice-idx="'+idx+'" '+(cs.selected!=null?'disabled':'')+'>'+esc(opt)+'</button>';
      }).join('');
      var choiceFeedback = cs.selected == null
        ? '<div class="flip-hint" style="position:relative;z-index:1;">Tap an answer</div>'
        : '<div class="choice-feedback '+(pickedCorrect?'ok':'no')+'">'+(pickedCorrect ? 'Nice job! 🎉' : gentleMiss('Good try!', card.back))+'</div>';
      stageInner = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">🔘 Pick the answer</div>' +
            (card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
            '<div class="card-text">'+esc(card.front)+'</div>' +
          '</div>' +
        '</div>' +
        '<div class="choice-row">'+optsHTML+'</div>' +
        choiceFeedback;
    } else if(mode === 'timedchoice'){
      if(!S.timedChoiceState || S.timedChoiceState.cardId !== card.id){
        S.timedChoiceState = buildTimedChoiceRound(card);
        if(reefKid()){ S.timedChoiceState.deadline = Date.now() + 864e5; S.timedChoiceState.reefCalm = true; }
      }
      var tc = S.timedChoiceState;
      var tcDone = tc.selected != null || tc.expired;
      var tcPickedCorrect = tc.selected != null && tc.options[tc.selected] === tc.answer;
      var tcOptsHTML = tc.options.map(function(opt, idx){
        var cls = 'choice-btn';
        if(tcDone){
          if(opt === tc.answer) cls += ' correct';
          else if(idx === tc.selected) cls += ' wrong';
        }
        return '<button type="button" class="'+cls+'" data-tc-idx="'+idx+'" '+(tcDone?'disabled':'')+'>'+esc(opt)+'</button>';
      }).join('');
      var tcFeedback = !tcDone
        ? '<div class="flip-hint" style="position:relative;z-index:1;">'+(tc.reefCalm ? 'Tap an answer' : 'Tap an answer before time runs out!')+'</div>'
        : '<div class="choice-feedback '+(tc.expired ? 'no' : (tcPickedCorrect?'ok':'no'))+'">'+(tc.expired ? gentleMiss('Time\'s up! ⏰', tc.answer) : (tcPickedCorrect ? 'Nice job! 🎉' : gentleMiss('Good try!', tc.answer)))+'</div>';
      stageInner = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">'+(tc.reefCalm ? '🔘 Pick the answer' : '⏱️ Beat the clock')+'</div>' +
            (card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
            '<div class="card-text">'+esc(tc.prompt)+'</div>' +
          '</div>' +
        '</div>' +
        (!tcDone ? timedChoiceTimerHTML(tc) : '') +
        '<div class="choice-row">'+tcOptsHTML+'</div>' +
        tcFeedback;
    } else if(mode === 'blend'){
      if(!S.blendState || S.blendState.cardId !== card.id){
        var useHangul = !(card.blendChunks && card.blendChunks.length) && isHangulWord(card.front);
        var hplan = useHangul ? hangulBlendPlan(card.front) : null;
        S.blendState = { cardId: card.id, chunks: hplan ? hplan.chunks : blendChunksFor(card), hangul: hplan, pct: 0, revealedCount: 0, done: false };
      }
      var bd = S.blendState;
      var bsz = blendSizingFor(bd.hangul ? Math.min(6, bd.chunks.length) : bd.chunks.length);
      var chunkSpans = bd.chunks.map(function(ch, i){
        var sylStart = bd.hangul && i > 0 && bd.hangul.syl[i] !== bd.hangul.syl[i-1];
        return '<span class="blend-chunk'+(i < bd.revealedCount ? ' lit' : '')+(sylStart ? ' syl-start' : '')+'" data-blend-chunk="'+i+'" style="font-size:'+bsz.fontRem+'rem;">'+esc(ch)+'</span>';
      }).join('');
      var blendDoneText = 'Nice blending! 🎉' + (bd.hangul && card.back ? ' — ' + card.back : '');
      stageInner = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">🐚 Slide to sound it out</div>' +
            (card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
            (bd.hangul ? '<div class="blend-built" id="blendBuilt" aria-live="polite">'+hangulBuiltHTML(bd, bd.revealedCount)+'</div>' : '') +
            '<div class="blend-word" style="max-width:'+(bd.hangul ? 340 : bsz.trackPx)+'px;">'+chunkSpans+'</div>' +
          '</div>' +
        '</div>' +
        blendSliderHTML(bd, bsz) +
        (bd.done ? '<div class="choice-feedback ok" id="blendHint" style="position:relative;z-index:1;">'+esc(blendDoneText)+'</div>' : '<div class="flip-hint" id="blendHint" style="position:relative;z-index:1;">Drag the shell all the way to the right 🐚</div>');
    } else if(mode === 'echo'){
      stageInner = echoStageHTML(card);
    } else if(mode === 'build'){
      stageInner = buildStageHTML(card);
    } else if(mode === 'hanja'){
      stageInner = hanjaStageHTML(card);
    } else if(mode === 'numsys'){
      stageInner = numsysStageHTML(card);
    } else if(mode === 'listen'){
      if(!S.listenState || S.listenState.cardId !== card.id){
        S.listenState = buildListenRound(card);
      }
      var ls = S.listenState;
      var lsDone = ls.selected != null;
      var lsCorrect = lsDone && ls.options[ls.selected] === ls.answer;
      var lsOptsHTML = ls.options.map(function(opt, idx){
        var cls = 'choice-btn listen-opt';
        if(lsDone){
          if(opt === ls.answer) cls += ' correct';
          else if(idx === ls.selected) cls += ' wrong';
        }
        return '<button type="button" class="'+cls+'" data-listen-idx="'+idx+'" '+(lsDone?'disabled':'')+'>'+esc(opt)+'</button>';
      }).join('');
      stageInner = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">👂 Listen &amp; pick</div>' +
            (card.photoUrl && lsDone ?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
            '<div class="listen-big">' +
              '<button type="button" class="listen-play" data-act="listen-play" aria-label="Play the word again">'+ccIcon('sound')+'</button>' +
              '<button type="button" class="btn btn-ghost listen-slow" data-act="listen-slow">🐢 Slower</button>' +
            '</div>' +
            (lsDone ? '<div class="listen-reveal">'+esc(card.front)+(ls.side === 'front' && card.back ? '<small>'+esc(card.back)+'</small>' : (ls.side === 'back' ? '<small>'+esc(card.back)+'</small>' : ''))+'</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="choice-row">'+lsOptsHTML+'</div>' +
        (lsDone
          ? '<div class="choice-feedback '+(lsCorrect?'ok':'no')+'">'+(lsCorrect ? 'Nice listening! 🎉' : gentleMiss('Good try!', ls.answer))+'</div>'
          : '<div class="flip-hint" style="position:relative;z-index:1;">'+(ls.side === 'front' ? 'Which word did you hear?' : 'What does it mean?')+'</div>');
    } else if(mode === 'match' || mode === 'blank'){
      // 'match' and 'blank' share one drag-a-tile-onto-a-target interaction -- the only real
      // difference is how the target is dressed (a standalone drop zone vs. an inline blank in a
      // sentence). Reuses card.back as the correct answer and card.choices as the distractor tiles,
      // exactly like 'choice' mode, just answered by dragging (or tapping) instead of tapping a row.
      if(!S.dragState || S.dragState.cardId !== card.id){
        S.dragState = { cardId: card.id, options: shuffle([card.back].concat(card.choices||[])), dropped: null, correct: null };
      }
      var ds = S.dragState;
      var tilesHTML = ds.options.map(function(opt, idx){
        if(ds.dropped === idx) return ''; // this tile is now sitting in the drop zone -- shown there instead
        if(ds.dropped != null && !ds.correct && opt === card.back) return ''; // a miss: the right word is shown in the slot instead
        return '<button type="button" class="drag-tile" data-drag-idx="'+idx+'">'+esc(opt)+'</button>';
      }).join('');
      var dropMiss = ds.dropped != null && !ds.correct;
      var droppedText = ds.dropped != null ? esc(dropMiss ? card.back : ds.options[ds.dropped]) : '';
      var dropStateCls = ds.dropped != null ? ' correct dropped' : ''; // a miss shows the right word in green, no red shake
      var dragFeedback = ds.dropped == null
        ? '<div class="flip-hint" style="position:relative;z-index:1;">Drag or tap a tile onto the blank</div>'
        : '<div class="choice-feedback '+(ds.correct?'ok':'no')+'">'+(ds.correct ? 'Nice job! 🎉' : gentleMiss('Good try!', card.back))+'</div>';
      var promptHTML;
      if(mode === 'blank'){
        var parts = String(card.front||'').split('___');
        var dropInner = '<span class="drop-zone blank-slot'+dropStateCls+'" data-drop-zone>'+(droppedText || '＿＿＿')+'</span>';
        promptHTML = parts.length > 1
          ? '<div class="card-text blank-sentence">'+esc(parts[0])+dropInner+esc(parts.slice(1).join('___'))+'</div>'
          : '<div class="card-text blank-sentence">'+esc(card.front)+' '+dropInner+'</div>';
      } else {
        promptHTML = '<div class="card-text">'+esc(card.front)+'</div>' +
          '<div class="drop-zone'+dropStateCls+'" data-drop-zone>'+(droppedText || 'Drag the match here')+'</div>';
      }
      stageInner = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">'+(mode==='blank'?'📝 Fill in the blank':'🧲 Drag the match')+'</div>' +
            (card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'') +
            promptHTML +
          '</div>' +
        '</div>' +
        '<div class="drag-tile-row" data-tile-row>'+tilesHTML+'</div>' +
        dragFeedback;
    } else {
      // A "say the word" vocab card (answer side = the word itself) shows just the word on the back,
      // spoken aloud on flip -- no definition or story sentence underneath.
      var backIsWord = String(card.back||'').trim().toLowerCase() === String(card.front||'').trim().toLowerCase();
      stageInner = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="flip-card '+(coveFlipFrom?'flipped':'')+'" id="flipCard">' +
            '<div class="face face-front">'+(card.photoUrl?'<img class="card-photo" src="'+esc(card.photoUrl)+'" alt="">':'')+'<div class="card-text">'+esc(card.front)+'</div></div>' +
            '<div class="face face-back"><div class="card-text">'+esc(card.back)+'</div>'+(card.note && !backIsWord?'<div class="card-note">'+esc(card.note)+'</div>':'')+(Speech.isSupported()?'<button type="button" class="replay-audio-btn" data-act="replay-audio">👂 Hear it again</button>':'')+'</div>' +
          '</div>' +
        '</div>' +
        '<div class="flip-hint" style="position:relative;z-index:1;">'+(S.cardFlipped ? (currentDifficulty().id === 'hard' ? 'How well did you know it?' : 'Be honest — did you get it right?') : '<button type="button" class="cove-flipbtn" data-cove-flip>↻ Tap the card to flip it</button>')+'</div>' +
        (S.cardFlipped ? outcomeRowHTML() : '');
    }

    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="exit-study">⟵ Lagoon</button>' +
        '<span class="nav-title">'+deck.emoji+' '+esc(deck.name)+'</span>' +
        ctrlRowHTML() +
      '</div>' +
      critterHTML +
      '<div class="stage'+(peeking?' stage-peek':'')+(coveSame?' cove-still':'')+'">' +
        bubblesHTML(8) +
        stageInner +
      '</div>';

    // Now that the bar exists in the DOM at startPct, bump it to the real value on the next frame
    // so the CSS transition actually plays instead of the value just appearing already-set. Double
    // rAF (rather than one) makes sure the browser has painted the starting position first — a
    // single rAF can land in the same paint as the innerHTML write and skip straight to the target.
    (function(){
      var fillEl = app.querySelector('.critter-track-fill');
      var swimEl = app.querySelector('.critter-swim');
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          if(fillEl) fillEl.style.width = progressPct + '%';
          if(swimEl) swimEl.style.left = progressPct + '%';
        });
      });
    })();
    S.critterPrevPct = progressPct;
    S.__coveStageKey = coveKey;
    (function(){
      var fc = document.getElementById('flipCard'), want = !!S.cardFlipped;
      S.__coveFlipCard = card.id; S.__coveFlipShown = want;
      if(!fc || peeking || coveFlipFrom === want) return;
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ fc.classList.toggle('flipped', want); coveSyncFlip(fc); }); });
      var gr = app.querySelector('.grade-row'); if(gr && want) gr.classList.add('cove-reveal');
    })();

    app.querySelector('[data-act="exit-study"]').addEventListener('click', function(){
      // In Adult Mode a grown-up is already in (no PIN was needed to get here), so backing out of a
      // deck early just returns to Manage Decks. The PIN guard below is a Child Mode-only protection
      // against a kid quitting a round early without a grown-up's say-so.
      if(S.managingDecks){ goHome(); return; }
      // Leaving a deck before finishing the round needs a grown-up's PIN — finishing normally
      // (via the summary screen's own buttons) does not, so this only guards the early exit.
      S.pinPromptFor = 'exit';
      render();
    });
    wireCtrlRow();
    var stageEl = app.querySelector('.stage');
    wireSwipe(stageEl);
    // A short drag that snaps back (didn't clear the swipe threshold) can still end with
    // mousedown/up landing on the same tappable element — consumed once so it isn't also read
    // as a tap that flips the card or picks an answer.
    function dragJustHappened(){
      if(stageEl.__justDragged){ stageEl.__justDragged = false; return true; }
      return false;
    }
    if(peeking){
      // Reviewing the last card is not interactive — tapping it (same as swiping up) just returns
      // to the live, unanswered card. Ignore the synthetic click that follows a real drag release
      // (mousedown/up on the same element still fires 'click' even after a big pointer move).
      stageEl.addEventListener('click', function(){
        if(dragJustHappened()) return;
        returnFromPeek();
      });
      return;
    }
    var flip = document.getElementById('flipCard');
    if(flip){
      flip.addEventListener('click', function(){
        if(dragJustHappened()) return;
        if(S.transitioning) return;
        // Toggles both ways now — flipping back to the front (to re-read the question, or just to
        // flip it again for fun) is allowed any number of times before grading. Only the very FIRST
        // reveal starts the response-time clock that feeds auto-grading below; flipping back and
        // forth after that doesn't reset it, so mulling it over doesn't get scored as "took forever."
        S.cardFlipped = !S.cardFlipped;
        Sound.flip();
        if(!coveFlipInPlace(flip)) render();
        if(S.cardFlipped){
          if(!S.cardFlippedAt) S.cardFlippedAt = Date.now();
          Speech.speak(card.back); // read the revealed answer aloud automatically
        }
      });
    }
    var replayBtn = app.querySelector('[data-act="replay-audio"]');
    if(replayBtn) replayBtn.addEventListener('click', function(e){ e.stopPropagation(); Speech.speak(card.back); });
    app.querySelectorAll('[data-choice-idx]').forEach(function(b){
      b.addEventListener('click', function(){
        if(dragJustHappened()) return;
        if(S.choiceState.selected != null || S.transitioning) return;
        S.choiceState.selected = parseInt(b.dataset.choiceIdx, 10);
        var chosen = S.choiceState.options[S.choiceState.selected];
        var correct = chosen === card.back;
        var elapsed = Date.now() - (S.cardShownAt || Date.now());
        if(correct) Sound.correct(); else Sound.wrong();
        // Child Mode: read whichever option was just tapped aloud, right or wrong -- reinforces the
        // text/sound link either way. Adult Mode (S.managingDecks) stays quiet, same as everywhere else.
        if(!S.managingDecks) Speech.speak(chosen);
        if(!correct) reefSayAnswer(card.back);
        render();
        // Fully automatic: the app already knows right vs. wrong from the tap, so it grades itself —
        // pause just long enough for the correct/wrong highlight to register, then move on.
        setTimeout(function(){ grade(autoRating('choice', correct, elapsed), true); }, correct ? 650 : 1100 + WRONG_EXTRA_MS);
      });
    });
    if(mode === 'match' || mode === 'blank') wireDragTiles(card, mode);
    if(mode === 'blend') wireBlendSlider(card);
    if(mode === 'echo') wireEcho(card);
    if(mode === 'build') wireBuild(card);
    if(mode === 'hanja') wireHanja(card);
    if(mode === 'numsys') wireNumsys(card);
    if(mode === 'listen'){
      var lsNow0 = S.listenState;
      if(lsNow0 && !lsNow0.played){
        lsNow0.played = true;
        setTimeout(function(){ if(S.view === 'study' && S.listenState === lsNow0 && lsNow0.selected == null) playListen(card, false); }, 350);
      }
      var lp = app.querySelector('[data-act="listen-play"]');
      if(lp) lp.addEventListener('click', function(e){ e.stopPropagation(); playListen(card, false); });
      var lsl = app.querySelector('[data-act="listen-slow"]');
      if(lsl) lsl.addEventListener('click', function(e){ e.stopPropagation(); playListen(card, true); });
      app.querySelectorAll('[data-listen-idx]').forEach(function(b){
        b.addEventListener('click', function(){
          if(dragJustHappened()) return;
          var lsNow = S.listenState;
          if(!lsNow || lsNow.cardId !== card.id || lsNow.selected != null || S.transitioning) return;
          lsNow.selected = parseInt(b.dataset.listenIdx, 10);
          var correct = lsNow.options[lsNow.selected] === lsNow.answer;
          var elapsed = Date.now() - (S.cardShownAt || Date.now());
          if(correct) Sound.correct(); else Sound.wrong();
          render();
          // Say the word once more now that it's on screen, so sound and spelling meet.
          setTimeout(function(){ if(S.view === 'study' && S.listenState === lsNow) Speech.speak(card.front); }, 250);
          setTimeout(function(){ grade(autoRating('listen', correct, elapsed), true); }, correct ? 1200 : 1700 + WRONG_EXTRA_MS);
        });
      });
    }
    if(mode === 'timedchoice'){
      app.querySelectorAll('[data-tc-idx]').forEach(function(b){
        b.addEventListener('click', function(){
          if(dragJustHappened()) return;
          var tcNow = S.timedChoiceState;
          if(!tcNow || tcNow.cardId !== card.id || tcNow.selected != null || tcNow.expired || S.transitioning) return;
          clearTimedChoiceTimer();
          tcNow.selected = parseInt(b.dataset.tcIdx, 10);
          var chosen = tcNow.options[tcNow.selected];
          var correct = chosen === tcNow.answer;
          var elapsed = tcNow.reefCalm ? (Date.now() - (S.cardShownAt || Date.now())) : ((tcNow.totalSeconds + tcNow.secondsAdded) * 1000 - Math.max(0, tcNow.deadline - Date.now()));
          if(correct) Sound.correct(); else Sound.wrong();
          if(!S.managingDecks) Speech.speak(chosen);
          if(!correct) reefSayAnswer(tcNow.answer);
          render();
          setTimeout(function(){ grade(timedChoiceRating(tcNow, correct, elapsed), true); }, correct ? 650 : 1100 + WRONG_EXTRA_MS);
        });
      });
      var addTimeBtn = app.querySelector('[data-act="tc-add-time"]');
      if(addTimeBtn) addTimeBtn.addEventListener('click', function(e){
        e.stopPropagation();
        var tcNow = S.timedChoiceState;
        if(!tcNow || tcNow.cardId !== card.id || tcNow.selected != null || tcNow.expired) return;
        if((tcNow.timesAdded||0) >= TIMED_CHOICE_MAX_ADDS) return;
        var addSecs = tcNow.addSeconds || TIMED_CHOICE_ADD_SECONDS;
        tcNow.deadline += addSecs * 1000;
        tcNow.secondsAdded += addSecs;
        tcNow.timesAdded = (tcNow.timesAdded||0) + 1;
        Sound.tap();
        render();
      });
      var tcLive = S.timedChoiceState;
      if(tcLive && tcLive.cardId === card.id && tcLive.selected == null && !tcLive.expired) wireTimedChoiceTimer(card);
    }
    coveWireGrade(app);
    function coveFlipInPlace(fc){
      var hint = app.querySelector('.flip-hint'), stage = app.querySelector('.stage');
      if(!fc || !hint || !stage || !stage.contains(fc) || S.peeking || !hint.parentNode) return false;
      var want = !!S.cardFlipped;
      var old = hint.nextElementSibling;
      if(old && old.classList.contains('grade-row')) old.remove();
      hint.innerHTML = want ? (currentDifficulty().id === 'hard' ? 'How well did you know it?' : 'Be honest \u2014 did you get it right?') : '<button type="button" class="cove-flipbtn" data-cove-flip>\u21bb Tap the card to flip it</button>';
      if(want){
        hint.insertAdjacentHTML('afterend', outcomeRowHTML());
        var gr = hint.nextElementSibling;
        if(gr){ coveWireGrade(gr); gr.classList.add('cove-reveal'); }
      }
      fc.classList.toggle('flipped', want);
      S.__coveFlipCard = card.id; S.__coveFlipShown = want;
      coveSyncFlip(fc);
      return true;
    }
    function coveWireGrade(root){
    root.querySelectorAll('[data-outcome]').forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        if(dragJustHappened()) return;
        if(S.transitioning) return;
        var correct = b.dataset.outcome === 'right';
        var clock = mode === 'flip' ? (S.cardFlippedAt || S.cardShownAt) : S.cardShownAt;
        var elapsed = Date.now() - (clock || Date.now());
        grade(autoRating(mode, correct, elapsed));
      });
    });
    // Hard-difficulty Anki-style grading buttons (Again/Hard/Good/Easy) — the child's own tap IS
    // the rating, so this skips autoRating()'s response-time guesswork entirely.
    root.querySelectorAll('[data-rating]').forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        if(dragJustHappened()) return;
        if(S.transitioning) return;
        grade(b.dataset.rating);
      });
    });
    }
  }

  // The only entry point that advances a card. Answering (an outcome tap, or a choice pick) is the
  // sole trigger — there is no swipe-to-skip and no tap-anywhere-to-continue, so a card is locked in
  // place until it's actually answered. Once answered, this plays the TikTok-style exit slide on the
  // current card and locks out any further taps for that brief window before the next card lands.
  function grade(rating, skipSound){
    if(S.transitioning) return;
    S.transitioning = true;
    var stageEl = app.querySelector('.stage');
    if(stageEl) stageEl.classList.add('stage-exit');
    setTimeout(function(){
      S.transitioning = false;
      commitGrade(rating, skipSound);
    }, 140);
  }

  function commitGrade(rating, skipSound){
    if(S.view !== 'study' || !S.currentDeckId || !S.studyQueue.length) return; // cove: left mid-answer
    var card = S.studyQueue.shift();
    // 'leitner' uses its own fixed-box engine; the other two options share the SM-2 engine and only
    // differ upstream, in whether autoRating() let response time influence the rating at all. Either
    // way, the parent-set difficulty (round size aside) shapes how far a good answer is spaced out
    // and how hard a struggling card gets reinforced — see DIFFICULTIES up top.
    var algo = S.settings.algorithm || 'sm2_speed';
    var diff = currentDifficulty();
    var updates = card._practice ? {} : ((algo === 'leitner') ? gradeCardLeitner(card, rating !== 'again', Date.now(), diff) : gradeCard(card, rating, Date.now(), diff));
    // Cumulative right/wrong counters, independent of the scheduling algorithm above -- these are
    // what the Progress page's per-deck "topics" breakdown groups by category and sums.
    updates.timesSeen = (card.timesSeen || 0) + 1;
    updates.timesCorrect = (card.timesCorrect || 0) + (rating !== 'again' ? 1 : 0);
    S.store.updateCard(S.currentDeckId, card.id, updates);
    planNoteAnswer(card, rating);
    S.sessionReviewed += 1;
    S.sessionStars += STARS[rating];
    // Snapshot this card as the one swipe-back target — captured before choiceState/cardFlipped
    // reset below, and overwritten on every answer, so there's always exactly one card of "undo peek."
    var gradedMode = (CARD_MODES.indexOf(card.mode) !== -1) ? card.mode : 'flip';
    var isDragGraded = gradedMode === 'match' || gradedMode === 'blank';
    var tcGraded = gradedMode === 'timedchoice' ? S.timedChoiceState : null;
    var lsGraded = gradedMode === 'listen' ? S.listenState : (gradedMode === 'hanja' ? S.hanjaState : (gradedMode === 'numsys' ? S.numsysState : null));
    // 'timedchoice' can ask in either direction (see buildTimedChoiceRound), so the peek-back view
    // needs the actual prompt/answer text that was shown, not always card.front/card.back verbatim.
    S.lastAnsweredCard = {
      front: tcGraded ? tcGraded.prompt : (gradedMode === 'hanja' && lsGraded && lsGraded.dir === 'zh2ko' ? hanjaZh(card) : (gradedMode === 'numsys' ? (card.nsEmoji ? card.nsEmoji + ' ' : '') + card.back : card.front)),
      back: tcGraded ? tcGraded.answer : (lsGraded ? lsGraded.answer : card.back),
      note: card.note || '',
      photoUrl: card.photoUrl || '',
      mode: gradedMode,
      correct: rating !== 'again',
      rating: rating,
      choiceOptions: (gradedMode === 'choice' && S.choiceState) ? S.choiceState.options.slice() : (isDragGraded && S.dragState ? S.dragState.options.slice() : (tcGraded ? tcGraded.options.slice() : (lsGraded ? lsGraded.options.slice() : null))),
      chosenText: (gradedMode === 'choice' && S.choiceState && S.choiceState.selected != null) ? S.choiceState.options[S.choiceState.selected] : (isDragGraded && S.dragState && S.dragState.dropped != null ? S.dragState.options[S.dragState.dropped] : (tcGraded && tcGraded.selected != null ? tcGraded.options[tcGraded.selected] : (lsGraded && lsGraded.selected != null ? lsGraded.options[lsGraded.selected] : null)))
    };
    S.peeking = false;
    // The swim-progress critter frowns for a beat right after a miss, then goes back to smiling —
    // it still swims forward the same step either way, so a wrong answer never looks like no progress.
    S.lastOutcomeWrong = (rating === 'again');
    if(S.lastOutcomeWrong){
      // Swap the critter's face in place rather than re-rendering the whole screen -- a full
      // render() here used to reset whatever the child was doing on the next card (a tile mid-drag,
      // a half-slid Sound Blend shell).
      setTimeout(function(){
        S.lastOutcomeWrong = false;
        if(S.view !== 'study') return;
        var swim = app.querySelector('.critter-swim');
        if(swim){ swim.classList.remove('oops'); swim.innerHTML = critterSVG(false); }
      }, 900);
    }
    if(S.roundTally) S.roundTally[rating] = (S.roundTally[rating] || 0) + 1;
    if(!skipSound){
      if(rating === 'again') Sound.wrong();
      else if(rating === 'hard') Sound.tap();
      else Sound.correct();
    }
    if(S.sessionTally){
      S.sessionTally.reviewedCount += 1;
      S.sessionTally.starsEarned += STARS[rating];
      S.sessionTally[rating] = (S.sessionTally[rating] || 0) + 1;
      if(S.currentDeckId && S.sessionTally.decksStudied.indexOf(S.currentDeckId) === -1){
        S.sessionTally.decksStudied.push(S.currentDeckId);
      }
      S.store.setSessionTally(S.sessionTally);
    }
    // Rounds are meant to be a strict, predictable length (the chosen difficulty's roundSize) — a
    // missed card is NOT requeued into the same round (that used to inflate a round past its size).
    // It's simply due again shortly per the schedule and will resurface on the next round/Play Again.
    var stillLearning = updates.state === 'learning' || updates.state === 'relearning';
    S.cardFlipped = false;
    S.choiceState = null;
    S.dragState = null;
    S.listenState = null;
    echoReset();
    S.buildState = null;
    S.hanjaState = null;
    S.numsysState = null;
    S.currentCardId = null; // forces the next renderStudy() to treat the next card (even a re-queued one) as freshly shown
    if(S.dueCounts[S.currentDeckId] && !card._practice){
      S.dueCounts[S.currentDeckId].due = Math.max(0, S.dueCounts[S.currentDeckId].due - (stillLearning?0:1));
    }
    render();
  }

  function coveBadgeBanner(){
    if(S.view !== 'summary' || !S.justEarnedBadges || !S.justEarnedBadges.length) return;
    var card = app.querySelector('.summary-card');
    if(!card || card.querySelector('.badge-earned-banner')) return;
    var earned = BADGES.filter(function(b){ return S.justEarnedBadges.indexOf(b.id) !== -1; });
    var d = document.createElement('div'); d.className = 'badge-earned-banner';
    d.innerHTML = earned.map(function(b){ return '<div class="badge-earned-item"><span class="badge-earned-icon">'+b.icon+'</span><span>New badge: <strong>'+esc(b.name)+'</strong></span></div>'; }).join('');
    card.insertBefore(d, card.querySelector('.summary-stats'));
  }
  function finishStudy(){
    // renderStudy() calls this whenever the queue is empty, and other timers (the critter's frown,
    // a sound toggle) can re-render the study screen while the saves below are still in flight --
    // without this guard a single round could be counted twice (double stars, double history).
    if(S.finishingRound) return;
    S.finishingRound = true;
    var t = S.roundTally || { again:0, hard:0, good:0, easy:0 };
    var total = S.sessionReviewed;
    var right = Math.max(0, total - t.again);
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; });
    var historyEntry = {
      deckId: S.currentDeckId,
      deckName: deck ? deck.name : 'Deck',
      deckEmoji: deck ? deck.emoji : '🌊',
      total: total,
      right: right,
      accuracy: total > 0 ? Math.round((right / total) * 100) : 0,
      ms: S.roundStartedAt ? Date.now() - S.roundStartedAt : 0
    };
    if(S.planRun) planRecord({ total: total, right: right, accuracy: historyEntry.accuracy });
    var newStatsRef = null, coveShown = false;
    S.store.getStats().then(function(stats){
      var today = todayISO();
      var newStreak = currentStreak(stats);
      if(stats.lastReviewDateISO !== today) newStreak = newStreak + 1; // yesterday's streak grows; a gap restarts at 1 (current is 0)
      if(newStreak < 1) newStreak = 1;
      // Starts from the saved stats so fields this screen doesn't touch survive -- previously the
      // doc was rebuilt from scratch here, which erased every Word Feed sound bought with stars.
      var newStats = Object.assign({}, stats, {
        streak: newStreak,
        stars: (stats.stars||0) + S.sessionStars,
        lastReviewDateISO: today,
        totalReviews: (stats.totalReviews||0) + S.sessionReviewed,
        unlockedSounds: stats.unlockedSounds || (S.stats && S.stats.unlockedSounds) || [],
        board: (S.stats && S.stats.board) || stats.board
      });
      if(!newStats.board) delete newStats.board;   // the store refuses undefined fields
      reefAward(stats, newStats);
      newStatsRef = newStats;
      S.stats = newStats;
      var wp = Promise.resolve(S.store.setStats(newStats)).then(function(){ return S.store.addHistoryEntry(historyEntry); });
      S.justEarnedBadges = [];
      S.view = 'summary';
      coveShown = true;
      render();
      return wp.then(function(){
        return evaluateAndAwardBadges(newStatsRef, historyEntry);
      }).then(function(){
        S.finishingRound = false;
        coveBadgeBanner();
      });
    }).catch(function(err){
      // A failed save used to leave the round stuck on an empty study screen forever.
      console.error('[Coral Cove] saving the round failed', err);
      S.finishingRound = false;
      S.storeError = 'This round\'s results didn\'t save. Check your connection and try again.';
      if(!coveShown) S.view = 'summary';
      if(S.view === 'summary') render();
    });
  }

  function renderSummary(){
    if(reefKid()) return reefSummary();
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || {name:'Deck', emoji:'🌊'};
    var t = S.roundTally || { again:0, hard:0, good:0, easy:0 };
    var total = S.sessionReviewed;
    var right = Math.max(0, total - t.again);
    var accuracy = total > 0 ? Math.round((right / total) * 100) : 0;
    var earnedHTML = '';
    if(S.justEarnedBadges && S.justEarnedBadges.length){
      var earnedBadges = BADGES.filter(function(b){ return S.justEarnedBadges.indexOf(b.id) !== -1; });
      earnedHTML = '<div class="badge-earned-banner">' + earnedBadges.map(function(b){
        return '<div class="badge-earned-item"><span class="badge-earned-icon">'+b.icon+'</span><span>New badge: <strong>'+esc(b.name)+'</strong></span></div>';
      }).join('') + '</div>';
    }
    var coveHead = total === 0 ? 'Nice swim!' : (accuracy >= 90 ? 'Amazing swimming!' : (accuracy >= 60 ? 'Great swimming!' : 'Nice practice!'));
    var coveShells = total > 0 && total <= 40 ? '<div class="cove-shells" role="img" aria-label="'+right+' of '+total+' right">' + Array.apply(null, Array(total)).map(function(_, i){
      return '<span class="cove-shell'+(i < right ? '' : ' practice')+'" style="--d:'+(0.25 + i * 0.07).toFixed(2)+'s">'+COVE_SHELL+'</span>';
    }).join('') + '</div><div class="cove-shell-key">'+(right === total ? '<span class="k">🌟 All gold!</span>' : '')+'</div>' : '';
    var coveRise = '<div class="cove-rise" aria-hidden="true">' + [[8,14,0],[22,10,.6],[38,18,.25],[55,12,.9],[70,16,.4],[84,11,1.1],[93,15,.7],[30,9,1.4],[64,10,1.6]].map(function(b){
      return '<span style="--x:'+b[0]+'%;--s:'+b[1]+'px;--d:'+b[2]+'s"></span>';
    }).join('') + '</div>';
    app.innerHTML = '' +
      '<div class="cove-sum">' + coveRise +
      coveWaterHTML('frame cw-sum', coveSumTip()) +
      '<div class="summary-card">' +
        errorBannerHTML() +
        '<h2>'+coveHead+'</h2>' +
        '<div class="cove-sub">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        coveShells +
        earnedHTML +
        '<div class="summary-stats">' +
          '<div class="summary-stat"><span class="num tabular">'+right+' / '+total+'</span><span class="label">✅ Right</span></div>' +
          '<div class="summary-stat"><span class="num tabular">+'+(S.sessionStars||0)+'</span><span class="label">⭐ Stars</span></div>' +
          '<div class="summary-stat"><span class="num tabular">'+currentStreak()+'</span><span class="label">🔥 Days</span></div>' +
        '</div>' +
        planNextHTML() +
        (S.planRun ? '' : '<div class="form-actions" style="justify-content:center;margin-top:6px;">' +
          '<button class="btn btn-primary" data-act="play-again">🔁 Play Again</button>' +
          '<button class="btn btn-ghost" data-act="back-home">Back to the Lagoon</button>' +
        '</div>') +
      '</div>' +
      '</div>';
    wireErrorBanner();
    wirePlanNext();
    if(S.planRun) return;
    app.querySelector('[data-act="back-home"]').addEventListener('click', goHome);
    app.querySelector('[data-act="play-again"]').addEventListener('click', function(){ startStudy(S.currentDeckId); });
  }

