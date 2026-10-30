  /* ---------- STUDY ---------- */
  // Round length now comes from the parent-set difficulty (Easy 4 / Medium 6 / Hard 10) rather than
  // a fixed constant — see DIFFICULTIES up top.

  function startStudy(deckId){
    if(!deckId) return;
    S.finishingRound = false;
    S.storeError = null;
    S.currentDeckId = deckId;
    S.editMode = false; // Edit Mode is a deck-management concept -- Dive In always leaves it behind
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // drives the Manage Decks "most recently opened" order
    S.store.getCardsOnce(deckId).then(function(cards){
      var pool = buildStudyPool(cards);
      S.studyQueue = interspersedRound(cards, pool, currentDifficulty().roundSize);
      S.studyTotal = S.studyQueue.length;
      S.sessionReviewed = 0;
      S.sessionStars = 0;
      S.roundTally = { again: 0, hard: 0, good: 0, easy: 0 };
      S.roundStartedAt = Date.now();
      S.view = 'study';
      S.cardFlipped = false;
      S.choiceState = null;
      S.dragState = null;
      S.timedChoiceState = null;
      S.timedChoiceAllCards = cards; // full deck pool (not just this round's queue) -- gives 'timedchoice' mode enough sibling cards to draw distractors from even on a short round
      S.timedChoiceDirection = null;
      S.timedChoiceGroupLeft = 0;
      clearTimedChoiceTimer();
      S.currentCardId = null;
      S.cardShownAt = null;
      S.cardFlippedAt = null;
      S.transitioning = false;
      S.peeking = false;
      S.lastAnsweredCard = null;
      S.critterPrevPct = 0;
      render();
    });
  }

  // Builds a round. For a child profile, cards she already knows well are mixed in between new or shaky
  // ones (about two known for every one being learned), so every round starts with easy wins and keeps
  // momentum -- task interspersal / behavioral momentum. Known cards pulled in only for practice are
  // flagged _practice: answering them updates her right/seen counts but never their review schedule.
  function interspersedRound(cards, pool, size){
    var plain = shuffle(pool).slice(0, size);
    if(!(S.profile && S.profile.mode === 'child') || S.managingDecks) return plain;
    function shaky(c){ var st = cardState(c); return st === 'new' || st === 'learning' || st === 'relearning' || (c.lapses||0) > 0 && (c.interval||0) < 4; }
    var hard = shuffle(pool.filter(shaky)), easyDue = shuffle(pool.filter(function(c){ return !shaky(c); }));
    var inPool = {}; pool.forEach(function(c){ inPool[c.id] = 1; });
    var known = shuffle(cards.filter(function(c){ return !inPool[c.id] && cardState(c) === 'review' && (c.interval||0) >= 2 && !c.isLeech; }))
      .map(function(c){ return Object.assign({}, c, { _practice: true }); });
    var maxHard = Math.max(1, Math.round(size / 3));
    var takeHard = hard.slice(0, maxHard);
    var easy = easyDue.concat(known);
    if(easy.length < 2) return plain; // not enough known cards yet to mix -- keep the normal round
    var out = [], hi = 0, ei = 0;
    while(out.length < size && (hi < takeHard.length || ei < easy.length)){
      // pattern: known, known, new/shaky ... so the round opens with two easy wins
      var slot = out.length % 3;
      if(slot === 2 && hi < takeHard.length) out.push(takeHard[hi++]);
      else if(ei < easy.length) out.push(easy[ei++]);
      else if(hi < takeHard.length) out.push(takeHard[hi++]);
    }
    return out.length ? out : plain;
  }

  /* ---------- WORD FEED ---------- */
  // A deck-level mode (deck.feedMode === true, toggled in the deck editor), not a per-card mode like
  // flip/read/choice/match/blank. A "Dive In" on a Word Feed deck skips renderStudy() entirely for a
  // full-screen, TikTok-style vertical swipe browser: one word centered per screen, spoken aloud as it
  // settles, swipe up/down to move through the deck with no fixed direction and no end -- it loops.
  // Deliberately fun-only: no grading, no SRS fields touched, no stats/history/streak writes, no
  // summary screen. See startStudy() just above for the equivalent entry point into a graded round.
  function startFeed(deckId){
    S.currentDeckId = deckId;
    S.editMode = false;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // same "recently opened" bookkeeping as every other deck entry point
    S.store.getCardsOnce(deckId).then(function(cards){
      if(!cards.length) return; // the Dive In button is disabled at 0 cards already; this is just a guard
      S.feedQueue = shuffle(cards);
      S.feedIndex = 0;
      S.feedLastSpokenId = null;
      Ambience.stop();          // always opens quiet -- see feedSoundId's comment up in the S state object
      S.feedSoundId = null;
      S.soundPickerOpen = false;
      S.view = 'feed';
      render();
    });
  }

  function renderFeed(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Word Feed', emoji:'🎬' };
    var queue = S.feedQueue;
    if(!queue.length){ goHome(); return; }
    var n = queue.length;
    var idx = ((S.feedIndex % n) + n) % n;
    var curCard = queue[idx];
    var nextCard = queue[(idx + 1) % n];
    var prevCard = queue[(idx - 1 + n) % n];

    // Speak exactly once per settled card, including the very first one -- guarded so a re-render for
    // an unrelated reason (there shouldn't be many, but it's cheap insurance) never repeats a word.
    // Deliberately NOT gated behind "Child Mode only" the way choice/match/blank's tap-to-speak is --
    // this mirrors flip mode's auto-speak-on-reveal instead, which plays for a grown-up too, since the
    // entire point of Word Feed is the word-plus-sound pairing regardless of who's browsing it.
    if(S.feedLastSpokenId !== curCard.id){
      S.feedLastSpokenId = curCard.id;
      Speech.speak(curCard.front);
    }

    function feedCardHTML(c, pos){
      return '<div class="feed-card feed-card-'+pos+'" data-feed-pos="'+pos+'"><div class="feed-word">'+esc(c.front)+'</div></div>';
    }

    app.innerHTML = '' +
      '<div class="feed-topbar">' +
        '<button type="button" class="icon-btn" data-act="exit-feed" aria-label="Close Word Feed" title="Close">'+ccIcon('close')+'</button>' +
        '<div class="feed-deck-label">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        '<button type="button" class="icon-btn" data-act="feed-sounds" aria-label="Feed sounds" title="Sounds">'+(S.feedSoundId?'🎧':'🔈')+'</button>' +
      '</div>' +
      '<div class="feed-stage" id="feedStage">' +
        feedCardHTML(prevCard, 'prev') +
        feedCardHTML(curCard, 'current') +
        feedCardHTML(nextCard, 'next') +
      '</div>' +
      '<div class="feed-hint">↕ Swipe for another word</div>' +
      (S.soundPickerOpen ? soundPanelHTML() : '');

    app.querySelector('[data-act="exit-feed"]').addEventListener('click', function(){
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){}
      Ambience.stop();
      // In Adult Mode a grown-up is already in (no PIN was needed to get here), so backing out of
      // Word Feed just returns to Manage Decks -- same rule as exit-study just above. In Child Mode,
      // a kid backing out of Word Feed on their own needs a grown-up's PIN, same as leaving a study
      // round early (this used to skip the PIN entirely, which meant a kid could freely wander out
      // of a session mid-swipe with no grown-up involved).
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor = 'exit';
      render();
    });

    app.querySelector('[data-act="feed-sounds"]').addEventListener('click', function(){
      S.soundPickerOpen = !S.soundPickerOpen;
      render();
    });

    if(S.soundPickerOpen) wireSoundPanel(); else wireFeedSwipe(curCard.front);
  }

  // The Word Feed sound shop -- six looping ambient tracks (see the Ambience module up top), three
  // free and three bought once with stars. Rendered as a bottom-sheet over the feed stage rather than
  // navigating away, so picking a sound (or closing the panel) never interrupts the swipe session.
  function soundPanelHTML(){
    var stats = S.stats || {};
    var unlocked = stats.unlockedSounds || [];
    var tiles = SOUND_TRACKS.map(function(t){
      var isUnlocked = t.free || unlocked.indexOf(t.id) !== -1;
      var active = S.feedSoundId === t.id;
      var shaking = S.soundBuyError === t.id;
      var sub = !isUnlocked ? ('🔒 '+SOUND_PRICE+'⭐') : (active ? '▶ Playing' : 'Tap to play');
      return '' +
        '<button type="button" class="sound-tile'+(active?' active':'')+(isUnlocked?'':' locked')+(shaking?' shake':'')+'" data-sound-id="'+t.id+'">' +
          '<span class="sound-tile-icon">'+t.icon+'</span>' +
          '<span class="sound-tile-name">'+esc(t.name)+'</span>' +
          '<span class="sound-tile-sub">'+sub+'</span>' +
        '</button>';
    }).join('');
    return '' +
      '<div class="sound-panel-backdrop">' +
        '<div class="sound-panel">' +
          '<div class="sound-panel-head">' +
            '<span class="sound-panel-title">🎧 Feed Sounds</span>' +
            '<span class="pill stars"><span class="icon">⭐</span><span class="tabular">'+(stats.stars||0)+'</span></span>' +
          '</div>' +
          '<div class="sound-list">' +
            '<button type="button" class="sound-tile off-tile'+(!S.feedSoundId?' active':'')+'" data-sound-off>' +
              '<span class="sound-tile-icon">🔇</span><span class="sound-tile-name">No Sound</span>' +
              '<span class="sound-tile-sub">'+(!S.feedSoundId?'▶ Selected':'Tap to mute')+'</span>' +
            '</button>' +
            tiles +
          '</div>' +
          '<div class="sound-panel-hint">Unlock more sounds for '+SOUND_PRICE+'⭐ each — earn stars by studying decks!</div>' +
          '<button type="button" class="btn btn-ghost sound-panel-close" data-act="close-sound-panel">Done</button>' +
        '</div>' +
      '</div>';
  }

  function wireSoundPanel(){
    var backdrop = app.querySelector('.sound-panel-backdrop');
    if(backdrop) backdrop.addEventListener('click', function(e){
      if(e.target === backdrop){ S.soundPickerOpen = false; render(); }
    });
    app.querySelectorAll('[data-act="close-sound-panel"]').forEach(function(b){
      b.addEventListener('click', function(){ S.soundPickerOpen = false; render(); });
    });
    var offBtn = app.querySelector('[data-sound-off]');
    if(offBtn) offBtn.addEventListener('click', function(){
      Ambience.stop();
      S.feedSoundId = null;
      render();
    });
    app.querySelectorAll('[data-sound-id]').forEach(function(btn){
      btn.addEventListener('click', function(){ handleSoundTileTap(btn.dataset.soundId); });
    });
  }

  // Tapping an unlocked (or free) tile toggles it on/off; tapping a locked one spends
  // SOUND_PRICE stars to unlock it forever for this profile (once bought, always available from
  // then on) and immediately starts playing it -- or, without enough stars, gives that one tile a
  // brief shake instead of silently doing nothing.
  function handleSoundTileTap(id){
    var track = SOUND_TRACKS.filter(function(t){ return t.id === id; })[0];
    if(!track) return;
    var unlocked = track.free || (S.stats.unlockedSounds || []).indexOf(id) !== -1;
    if(unlocked){
      if(S.feedSoundId === id){
        Ambience.stop();
        S.feedSoundId = null;
      } else {
        Ambience.play(id);
        S.feedSoundId = id;
      }
      render();
      return;
    }
    if((S.stats.stars || 0) < SOUND_PRICE){
      S.soundBuyError = id;
      render();
      setTimeout(function(){ if(S.soundBuyError === id){ S.soundBuyError = null; render(); } }, 650);
      return;
    }
    var newStats = Object.assign({}, S.stats, {
      stars: (S.stats.stars || 0) - SOUND_PRICE,
      unlockedSounds: (S.stats.unlockedSounds || []).concat([id])
    });
    S.store.setStats(newStats).then(function(){
      S.stats = newStats;
      Ambience.play(id);
      S.feedSoundId = id;
      render();
    }).catch(function(){});
  }

  /* ---------- shared swipe engine for every TikTok-style feed ----------
     Word Feed, Story Mode, Equation Feed, Language Feed and Flash Feed all run on
     wireVerticalSwipeFeed() below. It aims to feel like TikTok:
       - A short, quick flick is enough. Release speed matters as much as distance, so a small fast
         swipe moves on. A slow drag or drag-and-hold has to pull the card about a quarter of
         its height; anything shorter springs back with a small rubber-band bounce.
       - The card resists more the farther it's pulled, so dragging feels elastic.
       - Letting go finishes the move from wherever the card is, at about the finger's speed.
         There is no fixed-length animation restarting from the middle.
       - A card that is still springing back can be grabbed again mid-bounce.
       - Trackpad and mouse-wheel scrolling move exactly one card per gesture, even with
         momentum scrolling (see wheelStep). The up/down arrow and Page Up/Down keys work too.
       - A feed's own timers (Equation Feed's answer reveal, Language Feed's translation) never
         redraw the screen under a finger that's mid-drag (see feedRender).
     Everything that has to outlive one card lives in these module-level objects, because every
     committed swipe re-renders the screen and re-wires a brand-new stage. */
  var FeedGesture = { gen: 0, busy: false, busySince: 0, deferredRender: false };
  var activeFeedSwipe = null; // { stage, go(dir) } for the feed stage on screen -- used by the arrow-key handler
  var WheelGate = { accum: 0, locked: false, lockedAt: 0, lastAt: 0, lastMag: 0 };

  function nowMs(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }

  // Use this instead of render() from a feed's own timers. When a drag or settle is in flight, the
  // redraw waits until the card comes to rest. Redrawing immediately would rebuild the stage under the
  // finger, and the card would jump back to center mid-drag. The 5 s escape hatch stops a
  // lost pointerup from blocking the reveal forever.
  function feedRender(){
    if(FeedGesture.busy && nowMs() - FeedGesture.busySince < 5000){ FeedGesture.deferredRender = true; return; }
    FeedGesture.busy = false;
    FeedGesture.deferredRender = false;
    render();
  }

  // Turns a stream of wheel events into single "one card up/down" steps. A trackpad flick fires dozens
  // of events, including a long momentum tail. Once a step fires, the gate locks until either the
  // events go quiet (the gesture really ended) or a clearly harder push starts a new flick. Without
  // this, one flick would skip several cards. `canGo(dir)` says whether the surface can move that way
  // right now. If it can't, the events are left alone so the page scrolls normally.
  // Returns { dir: -1 | 0 | 1, consumed }, where consumed means call preventDefault.
  function wheelStep(e, canGo){
    var d = e.deltaY;
    if(e.deltaMode === 1) d *= 16; else if(e.deltaMode === 2) d *= 400;
    if(Math.abs(d) < Math.abs(e.deltaX || 0)) return { dir: 0, consumed: false }; // sideways scroll -- not ours
    var t = nowMs();
    var mag = Math.abs(d);
    var quiet = t - WheelGate.lastAt > 180;
    if(WheelGate.locked){
      if(quiet || (t - WheelGate.lockedAt > 450 && mag > 12 && mag > WheelGate.lastMag * 1.6)){
        WheelGate.locked = false;
        WheelGate.accum = 0;
      }
    } else if(quiet){
      WheelGate.accum = 0;
    }
    WheelGate.lastAt = t;
    WheelGate.lastMag = mag;
    if(WheelGate.locked) return { dir: 0, consumed: true };
    WheelGate.accum += d;
    var dir = WheelGate.accum > 0 ? 1 : -1;
    if(Math.abs(WheelGate.accum) < 56) return { dir: 0, consumed: !!canGo(dir) };
    WheelGate.accum = 0;
    if(!canGo(dir)) return { dir: 0, consumed: false };
    WheelGate.locked = true;
    WheelGate.lockedAt = t;
    return { dir: dir, consumed: true };
  }

  // Tracks recent pointer positions and reports release speed in px/ms (negative = moving up),
  // measured over the last ~100 ms of movement. A finger that stopped and held before letting go
  // reports 0, since a pause means the flick has ended.
  function makeVelocityTracker(){
    var samples = [];
    return {
      reset: function(y){ samples = [{ y: y, t: nowMs() }]; },
      push: function(y){ samples.push({ y: y, t: nowMs() }); if(samples.length > 16) samples.shift(); },
      velocity: function(){
        if(samples.length < 2) return 0;
        var last = samples[samples.length - 1];
        if(nowMs() - last.t > 90) return 0;
        var first = last;
        for(var i = samples.length - 1; i >= 0; i--){
          if(last.t - samples[i].t > 100) break;
          first = samples[i];
        }
        var dt = last.t - first.t;
        return dt > 0 ? (last.y - first.y) / dt : 0;
      }
    };
  }

  function wireVerticalSwipeFeed(stageId, onCommitNext, onCommitPrev, onTap){
    var stage = document.getElementById(stageId);
    if(!stage) return;
    var cur = stage.querySelector('.feed-card-current');
    var nxt = stage.querySelector('.feed-card-next');
    var prv = stage.querySelector('.feed-card-prev');
    if(!cur || !nxt || !prv) return;

    // Two ways to move on. A quick flick commits on speed alone. A drag-and-hold, or any slow drag,
    // has no speed behind it, so it only moves on once the card has been pulled past DIST_COMMIT of
    // its height. Anything short of that springs back to center like a rubber band.
    var DIST_COMMIT = 0.25; // fraction of the card height a held/slow drag must visibly reach
    var FLICK_V = 0.34;     // px/ms release speed that commits even a short swipe...
    var FLICK_MIN = 24;     // ...as long as the finger moved at least this far that way
    var TAP_SLOP = 8;       // px of finger drift that still counts as a tap
    var TAP_MS = 500;       // a press held longer than this isn't a tap
    // Elastic resistance while dragging. The card tracks the finger 1:1 at first and then lags more
    // the farther it's pulled, like stretching a rubber band. ELASTIC is the stretch limit as a
    // fraction of the card height; the card eases toward it but never quite reaches it under the finger.
    var ELASTIC = 0.9;
    var reduceMotion = false;
    try { reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){}

    var myGen = ++FeedGesture.gen;        // this stage's wiring; stale callbacks from an old stage check it
    FeedGesture.busy = false;             // a fresh stage has nothing in flight
    FeedGesture.deferredRender = false;

    var dy = 0;                           // how far the FINGER has moved since the drag began (px)
    var shown = 0;                        // where the card is actually drawn -- dy after elastic resistance
    var startY = 0, downY = 0, downT = 0, maxMove = 0;
    var dragging = false, activePid = null;
    var settling = null;                  // null | 'snap' (grab-able mid-bounce) | 'commit' (locked until the next card lands)
    var finishTok = 0, finishTimer = null;
    var raf = 0;
    var vel = makeVelocityTracker();

    function isMine(){ return FeedGesture.gen === myGen; }
    function markBusy(on){ if(!isMine()) return; FeedGesture.busy = on; if(on) FeedGesture.busySince = nowMs(); }
    function cardH(){ return cur.offsetHeight || stage.clientHeight || 1; }
    // finger travel -> drawn offset (1:1 near zero, flattening out toward ELASTIC * height)
    function elastic(d){
      var L = cardH() * ELASTIC;
      var s = d < 0 ? -1 : 1;
      return s * L * (1 - Math.exp(-Math.abs(d) / L));
    }
    // drawn offset -> the finger travel that produces it (used to pick a card up mid-bounce)
    function unelastic(o){
      var L = cardH() * ELASTIC;
      var s = o < 0 ? -1 : 1;
      var a = Math.min(Math.abs(o), L * 0.98);
      return s * -L * Math.log(1 - a / L);
    }

    function place(delta){
      cur.style.transform = 'translate3d(0,'+delta+'px,0)';
      nxt.style.transform = 'translate3d(0,calc(100% + '+delta+'px),0)';
      prv.style.transform = 'translate3d(0,calc(-100% + '+delta+'px),0)';
    }
    function placePct(curPct){ // final resting spots, in % so the landing matches the CSS rest positions exactly
      cur.style.transform = 'translate3d(0,'+curPct+'%,0)';
      nxt.style.transform = 'translate3d(0,'+(curPct + 100)+'%,0)';
      prv.style.transform = 'translate3d(0,'+(curPct - 100)+'%,0)';
    }
    function setTransition(ms, ease){
      var t = ms > 0 ? 'transform '+ms+'ms '+ease : 'none';
      cur.style.transition = t; nxt.style.transition = t; prv.style.transition = t;
    }
    // Where the current card visibly is right now, mid-animation included.
    function liveOffset(){
      try {
        var m = window.getComputedStyle(cur).transform;
        var p = m && m.match(/matrix(3d)?\(([^)]+)\)/);
        if(p){ var v = p[2].split(','); return parseFloat(p[1] ? v[13] : v[5]) || 0; }
      } catch(e){}
      return 0;
    }
    function finishAfter(ms, fn){
      var tok = ++finishTok;
      clearTimeout(finishTimer);
      function run(){
        if(tok !== finishTok) return;
        finishTok++;
        cur.removeEventListener('transitionend', onEnd);
        fn();
      }
      function onEnd(e){ if(e.target === cur && e.propertyName === 'transform') run(); }
      cur.addEventListener('transitionend', onEnd);
      finishTimer = setTimeout(run, ms + 80);
    }
    function cancelFinish(){ finishTok++; clearTimeout(finishTimer); }

    function commit(dir, v){
      settling = 'commit';
      markBusy(true);
      var H = cardH();
      var remaining = Math.max(0, H - Math.abs(shown));
      var speed = Math.max(Math.abs(v || 0), 1.8);
      var ms = reduceMotion ? 90 : Math.round(Math.max(130, Math.min(280, remaining / speed)));
      setTransition(ms, 'cubic-bezier(.22,.9,.3,1)');
      placePct(dir > 0 ? -100 : 100);
      finishAfter(ms, function(){
        settling = null;
        if(!isMine()) return;
        FeedGesture.busy = false;
        FeedGesture.deferredRender = false; // the commit's own render below covers anything that was waiting
        if(dir > 0) onCommitNext(); else onCommitPrev();
      });
    }
    // The rubber-band return: a quick pull back to center that overshoots a little and settles. It
    // bounces further the farther the card was stretched, and a tiny nudge barely wobbles.
    function snapBack(){
      settling = 'snap';
      markBusy(true);
      var a = Math.abs(shown);
      var ms = reduceMotion ? 60 : Math.round(Math.max(240, Math.min(440, 200 + a * 1.4)));
      setTransition(ms, reduceMotion ? 'ease-out' : 'cubic-bezier(.3,1.5,.55,1)');
      place(0);
      dy = 0; shown = 0;
      finishAfter(ms, function(){
        settling = null;
        if(!isMine()) return;
        markBusy(false);
        if(FeedGesture.deferredRender){ FeedGesture.deferredRender = false; render(); }
      });
    }

    // Programmatic one-card move, used by the wheel and the arrow keys.
    function go(dir){
      if(dragging || settling === 'commit' || !isMine()) return;
      if(settling === 'snap'){ cancelFinish(); settling = null; shown = liveOffset(); } else { shown = 0; }
      dy = unelastic(shown);
      setTransition(0);
      place(shown);
      void cur.offsetHeight; // commit the start position so the transition below animates from it
      commit(dir, 0);
    }

    stage.addEventListener('pointerdown', function(e){
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      if(settling === 'commit') return;
      var off = 0;
      if(settling === 'snap'){ cancelFinish(); settling = null; off = liveOffset(); } // caught mid-bounce
      activePid = e.pointerId;
      dragging = true;
      downY = e.clientY; downT = nowMs(); maxMove = 0;
      shown = off;
      dy = unelastic(off);
      startY = e.clientY - dy;
      vel.reset(e.clientY);
      setTransition(0);
      place(shown);
      markBusy(true);
      try { stage.setPointerCapture(activePid); } catch(err){}
    });
    stage.addEventListener('pointermove', function(e){
      if(!dragging || e.pointerId !== activePid) return;
      dy = e.clientY - startY;
      shown = elastic(dy);
      maxMove = Math.max(maxMove, Math.abs(e.clientY - downY));
      vel.push(e.clientY);
      if(!raf) raf = requestAnimationFrame(function(){ raf = 0; if(dragging) place(shown); });
    });
    function endDrag(e){
      if(!dragging || (e && e.pointerId !== activePid)) return;
      dragging = false; activePid = null;
      if(raf){ cancelAnimationFrame(raf); raf = 0; }
      place(shown);
      var cancelled = e && e.type === 'pointercancel';
      var v = cancelled ? 0 : vel.velocity();
      var farEnough = Math.abs(shown) >= cardH() * DIST_COMMIT;
      // A drag that's far enough still doesn't commit if the finger was flicking back the other way.
      var goNext = dy < 0 && ((v <= -FLICK_V && dy <= -FLICK_MIN) || (farEnough && v < FLICK_V * 0.8));
      var goPrev = dy > 0 && ((v >= FLICK_V && dy >= FLICK_MIN) || (farEnough && v > -FLICK_V * 0.8));
      if(goNext){ commit(1, v); return; }
      if(goPrev){ commit(-1, v); return; }
      var isTap = !cancelled && maxMove < TAP_SLOP && (nowMs() - downT) < TAP_MS;
      if(isTap){
        setTransition(0); place(0); dy = 0; shown = 0;
        markBusy(false);
        var hadDeferred = FeedGesture.deferredRender;
        FeedGesture.deferredRender = false;
        if(onTap) onTap();
        if(hadDeferred && isMine() && document.body.contains(stage)) render();
        return;
      }
      snapBack();
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', function(e){ if(dragging) endDrag(e); });

    // Trackpad / mouse wheel: one card per gesture. Scrolling down (two fingers pushed up on a
    // trackpad) is the same motion as swiping up on a phone, so it goes to the next card.
    stage.addEventListener('wheel', function(e){
      var r = wheelStep(e, function(){ return !dragging && settling !== 'commit'; });
      if(r.consumed) e.preventDefault();
      if(r.dir) go(r.dir);
    }, { passive: false });

    activeFeedSwipe = { stage: stage, go: go };
  }

  function wireFeedSwipe(word){
    wireVerticalSwipeFeed('feedStage',
      function(){ S.feedIndex = S.feedIndex + 1; if(S.view === 'feed') render(); },
      function(){ S.feedIndex = S.feedIndex - 1; if(S.view === 'feed') render(); },
      // Tapping the card replays its word on demand -- deliberately calling Speech.speak directly
      // (bypassing the settle-once-per-card guard up in renderFeed) so it repeats every tap, same as
      // the "Hear it again" replay button on a flipped study card.
      function(){ Speech.speak(word); });
  }

  /* ---------- STORY MODE ---------- */
  // A deck-level mode (deck.storyMode === true, toggled in the deck editor -- mutually exclusive with
  // Word Feed's deck.feedMode above), sharing Word Feed's exact swipe UI and .feed-* markup/CSS, just
  // with different content and ordering: instead of the deck's cards shuffled into a word soup, Story
  // Mode reconstructs a single passage from the deck's own cards (their "note"/hint field, which for
  // the built-in reading decks already carries one story sentence per card) and reads it one word at a
  // time, IN ORDER, swiping forward through the story and looping back to the first word at the end --
  // same wraparound as Word Feed. Rebuilt fresh from the deck's current cards every time it's opened
  // (nothing extra is stored), so editing a card's note updates the story the next time it's read.
  // Deliberately fun-only, same as Word Feed: no grading, no SRS fields touched, no stats/history
  // writes.
  function buildStoryWords(cards){
    var ordered = cards.slice().sort(function(a,b){ return (a.createdAt||0) - (b.createdAt||0); });
    var sentences = [];
    ordered.forEach(function(c){
      var note = String(c.note||'').trim();
      // Skip blanks and immediate repeats -- several of the built-in decks have two cards drawn from
      // the same sentence (one for each of two vocab words in it), which would otherwise double up
      // that whole sentence back-to-back in the reconstructed passage.
      if(note && sentences[sentences.length-1] !== note) sentences.push(note);
    });
    return sentences.join(' ').split(/\s+/).filter(Boolean);
  }

  function startStory(deckId){
    S.currentDeckId = deckId;
    S.editMode = false;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // same "recently opened" bookkeeping as every other deck entry point
    S.store.getCardsOnce(deckId).then(function(cards){
      var words = buildStoryWords(cards);
      if(!words.length){
        // No note/hint text to build a story from yet -- rather than open onto a blank swipe screen,
        // stay put and explain why, the same way a failed save surfaces (see errorBannerHTML).
        S.storeError = 'This deck doesn\'t have a story to read yet — add a sentence to each card\'s hint/note field in the editor to build one.';
        render();
        return;
      }
      S.storyQueue = words.map(function(w, i){ return { id: 'story-'+i, front: w }; });
      S.storyIndex = 0;
      S.storyLastSpokenId = null;
      S.view = 'story';
      render();
    });
  }

  function renderStory(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Story', emoji:'📜' };
    var queue = S.storyQueue;
    if(!queue.length){ goHome(); return; }
    var n = queue.length;
    var idx = ((S.storyIndex % n) + n) % n;
    var curWord = queue[idx];
    var nextWord = queue[(idx + 1) % n];
    var prevWord = queue[(idx - 1 + n) % n];

    // Same speak-exactly-once-per-settled-word guard as Word Feed's renderFeed().
    if(S.storyLastSpokenId !== curWord.id){
      S.storyLastSpokenId = curWord.id;
      Speech.speak(curWord.front);
    }

    function storyCardHTML(w, pos){
      return '<div class="feed-card feed-card-'+pos+'" data-feed-pos="'+pos+'"><div class="feed-word">'+esc(w.front)+'</div></div>';
    }

    app.innerHTML = '' +
      '<div class="feed-topbar">' +
        '<button type="button" class="icon-btn" data-act="exit-story" aria-label="Close Story Mode" title="Close">'+ccIcon('close')+'</button>' +
        '<div class="feed-deck-label">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        '<span class="feed-topbar-spacer" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="feed-stage" id="storyStage">' +
        storyCardHTML(prevWord, 'prev') +
        storyCardHTML(curWord, 'current') +
        storyCardHTML(nextWord, 'next') +
      '</div>' +
      '<div class="feed-hint">↕ Word '+(idx+1)+' of '+n+'</div>';

    app.querySelector('[data-act="exit-story"]').addEventListener('click', function(){
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){}
      // Same Child Mode PIN guard as exit-feed above -- see that comment for why.
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor = 'exit';
      render();
    });

    wireVerticalSwipeFeed('storyStage',
      function(){ S.storyIndex = S.storyIndex + 1; if(S.view === 'story') render(); },
      function(){ S.storyIndex = S.storyIndex - 1; if(S.view === 'story') render(); });
  }

  /* ---------- EQUATION FEED ---------- */
  // A deck-level mode (deck.equationMode === true, toggled in the deck editor -- mutually exclusive
  // with Word Feed's feedMode and Story Mode's storyMode above), sharing their exact swipe UI and
  // .feed-* markup/CSS. The content and timing are different though: each card is an addition
  // equation ("3 + 4") with NO answer shown at first. The card settles, the full equation is spoken
  // aloud right away WITH the answer ("3 plus 4 equals 7", read slower than the app's normal speaking
  // rate) and the answer itself bounces onto the screen in place of the "?" a flat delay later.
  // Deliberately fun-only, same as Word Feed/Story Mode: no grading, no SRS fields touched, no
  // stats/history writes.
  var EQUATION_SPEECH_RATE = 0.22;    // much slower than the app-wide default (0.88) -- roughly a
                                       // third of the already-slowed 0.7 rate this used to be, so the
                                       // numbers are easy to catch even for a slow reader following along
  var EQUATION_REVEAL_DELAY_MS = 5000; // flat delay from settle to the answer bouncing in
  function equationSpeech(front, back){
    var m = String(front||'').match(/^\s*(-?\d+)\s*\+\s*(-?\d+)\s*$/);
    if(m) return m[1]+' plus '+m[2]+' equals '+back;
    return front+' equals '+back; // fallback for any oddly-formatted card
  }

  function startEquationFeed(deckId){
    S.currentDeckId = deckId;
    S.editMode = false;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // same "recently opened" bookkeeping as every other deck entry point
    S.store.getCardsOnce(deckId).then(function(cards){
      if(!cards.length) return; // the Dive In button is disabled at 0 cards already; this is just a guard
      S.equationQueue = shuffle(cards);
      S.equationIndex = 0;
      S.equationSettledId = null;
      S.equationRevealed = false;
      S.view = 'equationFeed';
      render();
    });
  }

  function renderEquationFeed(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Equation Feed', emoji:'🧮' };
    var queue = S.equationQueue;
    if(!queue.length){ goHome(); return; }
    var n = queue.length;
    var idx = ((S.equationIndex % n) + n) % n;
    var curCard = queue[idx];
    var nextCard = queue[(idx + 1) % n];
    var prevCard = queue[(idx - 1 + n) % n];

    // Settle-once-per-card guard, same spirit as Word Feed/Story Mode's: the equation shows with no
    // answer the instant it settles, the full equation-plus-answer is spoken right away (slower than
    // the app's normal speaking rate -- easier to follow along with while doing the math), and the
    // answer bounces onto the screen on a flat timer -- deliberately NOT synced to when the speech
    // finishes (that used to be the case; a flat delay is more predictable regardless of how long a
    // given equation takes to say out loud), same flat-timer approach as Language Feed's translation
    // reveal below.
    if(S.equationSettledId !== curCard.id){
      S.equationSettledId = curCard.id;
      S.equationRevealed = false;
      var settledId = curCard.id;
      if(S.equationTickHandle){ clearInterval(S.equationTickHandle); S.equationTickHandle = null; }
      Speech.speak(equationSpeech(curCard.front, curCard.back), { rate: EQUATION_SPEECH_RATE, variant: 'eq' });
      // A soft clock-tick underlines the now-longer wait before the answer shows -- without it, 5
      // seconds of silence after a very slow reading felt like the app had stalled.
      S.equationTickHandle = setInterval(function(){
        if(S.view !== 'equationFeed' || S.equationSettledId !== settledId){
          clearInterval(S.equationTickHandle); S.equationTickHandle = null; return;
        }
        Sound.tick();
      }, 700);
      setTimeout(function(){
        // The child may have already swiped away before this timer fired -- only reveal if this is
        // still the card actually on screen.
        if(S.view !== 'equationFeed' || S.equationSettledId !== settledId) return;
        if(S.equationTickHandle){ clearInterval(S.equationTickHandle); S.equationTickHandle = null; }
        S.equationRevealed = true;
        feedRender(); // waits if a swipe is mid-drag, rather than yanking the card back to center
      }, EQUATION_REVEAL_DELAY_MS);
    }

    function eqCardHTML(c, pos){
      var showAnswer = pos === 'current' && S.equationRevealed;
      return '<div class="feed-card feed-card-'+pos+'" data-feed-pos="'+pos+'">' +
        '<div class="feed-word eq-prompt">' +
          '<span>'+esc(c.front)+' =</span>' +
          (showAnswer
            ? '<span class="eq-answer eq-bounce">'+esc(c.back)+'</span>'
            : '<span class="eq-answer eq-blank">?</span>') +
        '</div></div>';
    }

    app.innerHTML = '' +
      '<div class="feed-topbar">' +
        '<button type="button" class="icon-btn" data-act="exit-equation" aria-label="Close Equation Feed" title="Close">'+ccIcon('close')+'</button>' +
        '<div class="feed-deck-label">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        '<span class="feed-topbar-spacer" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="feed-stage" id="equationStage">' +
        eqCardHTML(prevCard, 'prev') +
        eqCardHTML(curCard, 'current') +
        eqCardHTML(nextCard, 'next') +
      '</div>' +
      '<div class="feed-hint">↕ Swipe for another equation</div>';

    app.querySelector('[data-act="exit-equation"]').addEventListener('click', function(){
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){}
      // Same Child Mode PIN guard as exit-feed/exit-story above -- see that comment for why.
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor = 'exit';
      render();
    });

    wireVerticalSwipeFeed('equationStage',
      function(){ S.equationIndex = S.equationIndex + 1; if(S.view === 'equationFeed') render(); },
      function(){ S.equationIndex = S.equationIndex - 1; if(S.view === 'equationFeed') render(); },
      // Tapping the settled card replays the equation-plus-answer on demand, same "Hear it again"
      // spirit as Word Feed's tap-to-replay -- only once the answer has actually been revealed once,
      // so an early tap can't spoil the surprise ahead of the timer.
      function(){ if(S.equationRevealed) Speech.speak(equationSpeech(curCard.front, curCard.back), { rate: EQUATION_SPEECH_RATE, variant: 'eq' }); });
  }

  /* ---------- LANGUAGE FEED ---------- */
  // A deck-level mode (deck.langFeedMode === true, toggled in the deck editor -- mutually exclusive
  // with Word Feed/Story Mode/Equation Feed above), sharing their exact swipe UI and .feed-* markup/
  // CSS. Built for vocabulary decks (e.g. Korean Word Feed): instead of dumping the whole deck into
  // the swipe queue at once like Word Feed does, only a few words are "unlocked" at a time
  // (deck.langBatchSize, default 5) -- deck.langUnlockedCount tracks how many of the deck's cards
  // (sorted by their `order` field, oldest-first) are in play. Once every currently-unlocked card has
  // been swiped to at least once THIS SESSION, the next batch unlocks automatically and its cards join
  // the swipe rotation, persisted back to the deck doc so the next visit picks up where this one left
  // off. Each card shows its target-language word (spoken aloud as it settles, same as Word Feed) with
  // the English translation hidden; about a second later the translation fades in under it. Same
  // fun-only rules as Word Feed/Story Mode/Equation Feed: no grading, no SRS fields touched, no
  // stats/history writes.
  function startLangFeed(deckId){
    S.currentDeckId = deckId;
    S.editMode = false;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // same "recently opened" bookkeeping as every other deck entry point
    S.store.getCardsOnce(deckId).then(function(cards){
      if(!cards.length) return; // the Dive In button is disabled at 0 cards already; this is just a guard
      var deck = S.decks.find(function(d){ return d.id === deckId; }) || {};
      var sorted = cards.slice().sort(function(a, b){ return (a.order||0) - (b.order||0); });
      var batchSize = deck.langBatchSize || 5;
      var unlockedCount = Math.min(deck.langUnlockedCount || batchSize, sorted.length);
      S.langSorted = sorted;
      S.langBatchSize = batchSize;
      S.langUnlockedCount = unlockedCount;
      S.langTotalCards = sorted.length;
      S.langQueue = shuffle(sorted.slice(0, unlockedCount));
      S.langIndex = 0;
      S.langSettledId = null;
      S.langRevealed = false;
      S.langSeenIds = new Set();
      S.langJustUnlocked = false;
      S.view = 'langFeed';
      render();
    });
  }

  // Called once a card has settled on screen -- marks it seen this session, and unlocks the next
  // batch (if any remain, and every card in the current rotation has now been seen at least once)
  // by appending the newly-unlocked cards to the live queue rather than rebuilding it, so a batch
  // unlocking mid-swipe never disturbs the card already on screen.
  function unlockNextLangBatchIfNeeded(deckId){
    if(S.langUnlockedCount >= S.langTotalCards) return;
    if(S.langSeenIds.size < S.langQueue.length) return;
    var newCount = Math.min(S.langUnlockedCount + S.langBatchSize, S.langTotalCards);
    if(newCount === S.langUnlockedCount) return;
    var newlyAdded = S.langSorted.slice(S.langUnlockedCount, newCount);
    S.langUnlockedCount = newCount;
    S.langQueue = S.langQueue.concat(shuffle(newlyAdded));
    S.langJustUnlocked = true;
    S.store.updateDeck(deckId, { langUnlockedCount: newCount });
  }

  function renderLangFeed(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Language Feed', emoji:'🌐' };
    var queue = S.langQueue;
    if(!queue.length){ goHome(); return; }
    var n = queue.length;
    var idx = ((S.langIndex % n) + n) % n;
    var curCard = queue[idx];
    var nextCard = queue[(idx + 1) % n];
    var prevCard = queue[(idx - 1 + n) % n];

    // Settle-once-per-card guard, same spirit as Equation Feed's: the target word shows (and is
    // spoken) the instant it settles, with the translation hidden; about a second later the
    // translation fades in. Speech.speak auto-detects Hangul vs. Latin script (detectLang), so no
    // extra plumbing is needed for Korean vs. English target words here.
    if(S.langSettledId !== curCard.id){
      S.langSettledId = curCard.id;
      S.langRevealed = false;
      S.langSeenIds.add(curCard.id);
      S.langJustUnlocked = false;
      unlockNextLangBatchIfNeeded(S.currentDeckId);
      var settledId = curCard.id;
      Speech.speak(curCard.front);
      setTimeout(function(){
        // The child may have already swiped away before this timer fired -- only reveal if this is
        // still the card actually on screen.
        if(S.view !== 'langFeed' || S.langSettledId !== settledId) return;
        S.langRevealed = true;
        feedRender(); // waits if a swipe is mid-drag, rather than yanking the card back to center
      }, 1000);
    }

    function langCardHTML(c, pos){
      if(pos !== 'current'){
        return '<div class="feed-card feed-card-'+pos+'" data-feed-pos="'+pos+'">' +
          '<div class="lang-word-wrap"><div class="feed-word">'+esc(c.front)+'</div></div>' +
        '</div>';
      }
      var showTranslation = S.langRevealed;
      return '<div class="feed-card feed-card-'+pos+'" data-feed-pos="'+pos+'">' +
        '<div class="lang-word-wrap">' +
          '<div class="feed-word">'+esc(c.front)+'</div>' +
          '<div class="lang-translation'+(showTranslation?' lang-fade-in':'')+'"'+(showTranslation?'':' style="visibility:hidden"')+'>'+esc(c.back)+'</div>' +
        '</div>' +
      '</div>';
    }

    app.innerHTML = '' +
      '<div class="feed-topbar">' +
        '<button type="button" class="icon-btn" data-act="exit-lang" aria-label="Close Language Feed" title="Close">'+ccIcon('close')+'</button>' +
        '<div class="feed-deck-label">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        '<span class="feed-topbar-spacer" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="feed-stage" id="langStage">' +
        langCardHTML(prevCard, 'prev') +
        langCardHTML(curCard, 'current') +
        langCardHTML(nextCard, 'next') +
        (S.langJustUnlocked ? '<div class="lang-unlock-toast">🎉 New words unlocked!</div>' : '') +
      '</div>' +
      '<div class="feed-hint">↕ Swipe for another word'+(S.langUnlockedCount < S.langTotalCards ? ' · '+S.langUnlockedCount+' of '+S.langTotalCards+' words so far' : '')+'</div>';

    app.querySelector('[data-act="exit-lang"]').addEventListener('click', function(){
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){}
      // Same Child Mode PIN guard as exit-feed/exit-story/exit-equation above -- see that comment for why.
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor = 'exit';
      render();
    });

    wireVerticalSwipeFeed('langStage',
      function(){ S.langIndex = S.langIndex + 1; if(S.view === 'langFeed') render(); },
      function(){ S.langIndex = S.langIndex - 1; if(S.view === 'langFeed') render(); },
      // Tapping the settled card replays the target word on demand, same "Hear it again" spirit as
      // Word Feed/Equation Feed's tap-to-replay.
      function(){ Speech.speak(curCard.front); });
  }

  /* ---------- READ-ALONG ---------- */
  // A deck-level mode (deck.readAlongMode === true, toggled in the deck editor -- mutually exclusive
  // with Word Feed/Story Mode/Equation Feed/Language Feed above), but a different shape of screen from
  // all four of those: instead of a one-word-at-a-time swipe feed, the WHOLE reconstructed passage is
  // shown at once as flowing, wrapped text -- a real page to read, not a card stack. Reuses the exact
  // same story-reconstruction data as Story Mode (each card's note/hint field, in the order cards were
  // added, one sentence per card) so any deck already set up for Story Mode works here immediately with
  // zero extra data entry -- the two modes are just two different ways of reading the same passage.
  // Tapping any word in the passage speaks just that word and highlights it in a different color while
  // it's playing; the highlight clears itself the moment the word finishes (Speech.speakThen's onEnd),
  // so at most one word is ever lit at a time. Deliberately fun-only, same as the other feed modes: no
  // grading, no SRS fields touched, no stats/history writes.
  function buildPassageSentences(cards){
    var ordered = cards.slice().sort(function(a,b){ return (a.createdAt||0) - (b.createdAt||0); });
    var sentences = [];
    ordered.forEach(function(c){
      var note = String(c.note||'').trim();
      // Same skip-blanks/skip-immediate-repeats rule as Story Mode's buildStoryWords -- several of the
      // built-in decks have two cards drawn from the same sentence (one per vocab word in it).
      if(note && sentences[sentences.length-1] !== note) sentences.push(note);
    });
    return sentences;
  }

  // Splits one sentence into HTML, wrapping each word (but not the whitespace/punctuation between
  // words) in a tappable <span>. A word's displayed text keeps its attached punctuation ("cookies!"
  // stays "cookies!" on screen) but the `data-speak` value strips leading/trailing punctuation so
  // Speech.speak() reads back the clean word, not "cookies exclamation point". `\p{L}`/`\p{N}` (not
  // plain a-z) so this works correctly on Korean/Hangul passages too, not just English ones.
  function tokenizePassageLine(sentence, sentenceIdx){
    var parts = sentence.split(/(\s+)/);
    var wordIdx = 0;
    return parts.map(function(part){
      if(!part) return '';
      if(/^\s+$/.test(part)) return part;
      if(!/[\p{L}\p{N}]/u.test(part)) return esc(part);
      var core = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || part;
      var id = 's'+sentenceIdx+'w'+(wordIdx++);
      return '<span class="passage-word" data-passage-word="'+id+'" data-speak="'+esc(core)+'">'+esc(part)+'</span>';
    }).join('');
  }

  function startReadAlong(deckId){
    S.currentDeckId = deckId;
    S.editMode = false;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // same "recently opened" bookkeeping as every other deck entry point
    S.store.getCardsOnce(deckId).then(function(cards){
      var sentences = buildPassageSentences(cards);
      if(!sentences.length){
        // Same "explain, don't open onto a blank screen" handling as Story Mode's equivalent guard.
        S.storeError = 'This deck doesn\'t have a passage to read yet — add a sentence to each card\'s hint/note field in the editor to build one.';
        render();
        return;
      }
      S.passageSentences = sentences;
      S.passageHighlightId = null;
      S.view = 'readAlong';
      render();
    });
  }

  function renderReadAlong(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Read-Along', emoji:'🔤' };
    var linesHTML = S.passageSentences.map(function(sentence, si){
      return '<p class="passage-line">'+tokenizePassageLine(sentence, si)+'</p>';
    }).join('');

    app.innerHTML = '' +
      '<div class="feed-topbar">' +
        '<button type="button" class="icon-btn" data-act="exit-readalong" aria-label="Close Read-Along" title="Close">'+ccIcon('close')+'</button>' +
        '<div class="feed-deck-label">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        '<span class="feed-topbar-spacer" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="passage-card">' +
        '<div class="passage-hint">👆 Tap any word to hear it</div>' +
        linesHTML +
      '</div>';

    app.querySelector('[data-act="exit-readalong"]').addEventListener('click', function(){
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){}
      // Same Child Mode PIN guard as exit-feed/exit-story/exit-equation/exit-lang above -- see that
      // comment for why.
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor = 'exit';
      render();
    });

    // Direct DOM manipulation rather than a render() per tap -- same reasoning as the timed-choice
    // countdown bar elsewhere in this file: a tap doesn't change any state renderReadAlong() itself
    // needs to redraw around, so re-running the whole innerHTML replace on every word tap would just
    // be wasted work (and would restart the CSS entry animation on the whole passage each time).
    app.querySelectorAll('.passage-word').forEach(function(el){
      el.addEventListener('click', function(){
        var id = el.dataset.passageWord;
        var word = el.dataset.speak;
        if(!word) return;
        if(S.passageHighlightId && S.passageHighlightId !== id){
          var prev = app.querySelector('[data-passage-word="'+S.passageHighlightId+'"]');
          if(prev) prev.classList.remove('lit');
        }
        el.classList.add('lit');
        S.passageHighlightId = id;
        Speech.speakThen(word, function(){
          if(S.view === 'readAlong' && S.passageHighlightId === id){
            el.classList.remove('lit');
            S.passageHighlightId = null;
          }
        });
      });
    });
  }

  /* ---------- FLASH FEED ---------- */
  // A deck-level mode (deck.flashFeedMode === true, toggled in the deck editor -- mutually exclusive
  // with the other feed types above), sharing Word Feed's exact swipe UI (wireVerticalSwipeFeed) and
  // .feed-* markup. Built for formula/fact flashcards rather than single spoken words: each card shows
  // its front (e.g. "Quadratic formula", with its Topic as a small chip), and TAPPING the card flips it
  // to reveal the back (the formula) plus its note (when to use it) -- tap again to hide. Swipe up/down
  // for the next/previous card, looping forever. Silent by design: nothing is spoken automatically, so
  // it works for text a speech voice can't read sensibly (math notation). A 🔀/🔢 button switches
  // between a shuffled order and the deck's own order, session-only. Same fun-only rules as the other
  // feed modes: no grading, no SRS fields touched, no stats/history writes.
  function buildFlashQueue(){
    var ordered = S.flashCards.slice().sort(function(a,b){ return (a.createdAt||0) - (b.createdAt||0); });
    S.flashQueue = S.flashOrdered ? ordered : shuffle(ordered);
    S.flashIndex = 0;
    S.flashFlipped = false;
  }

  function startFlashFeed(deckId){
    S.currentDeckId = deckId;
    S.editMode = false;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // same "recently opened" bookkeeping as every other deck entry point
    S.store.getCardsOnce(deckId).then(function(cards){
      if(!cards.length) return; // the Dive In button is disabled at 0 cards already; this is just a guard
      S.flashCards = cards;
      S.flashOrdered = false;
      buildFlashQueue();
      S.view = 'flashFeed';
      render();
    });
  }

  function renderFlashFeed(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Flash Feed', emoji:'🃏' };
    var queue = S.flashQueue;
    if(!queue.length){ goHome(); return; }
    var n = queue.length;
    var idx = ((S.flashIndex % n) + n) % n;
    var curCard = queue[idx];
    var nextCard = queue[(idx + 1) % n];
    var prevCard = queue[(idx - 1 + n) % n];

    function flashCardHTML(c, pos){
      var flipped = pos === 'current' && S.flashFlipped;
      var topic = c.category ? '<div class="flash-topic">'+esc(c.category)+'</div>' : '';
      var inner = flipped
        ? topic +
          '<div class="flash-front flash-small">'+esc(c.front)+'</div>' +
          '<div class="flash-back flash-reveal">'+esc(c.back)+'</div>' +
          (c.note ? '<div class="flash-note flash-reveal">'+esc(c.note)+'</div>' : '') +
          '<div class="flash-tap">Tap to hide</div>'
        : topic +
          '<div class="flash-front">'+esc(c.front)+'</div>' +
          '<div class="flash-tap">👆 Tap to flip</div>';
      return '<div class="feed-card feed-card-'+pos+'" data-feed-pos="'+pos+'"><div class="flash-card-inner">'+inner+'</div></div>';
    }

    app.innerHTML = '' +
      '<div class="feed-topbar">' +
        '<button type="button" class="icon-btn" data-act="exit-flash" aria-label="Close Flash Feed" title="Close">'+ccIcon('close')+'</button>' +
        '<div class="feed-deck-label">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        '<button type="button" class="icon-btn" data-act="flash-order" aria-label="'+(S.flashOrdered?'Switch to shuffled order':'Switch to deck order')+'" title="'+(S.flashOrdered?'In order — tap to shuffle':'Shuffled — tap for deck order')+'">'+(S.flashOrdered?'🔢':'🔀')+'</button>' +
      '</div>' +
      '<div class="feed-stage" id="flashStage">' +
        flashCardHTML(prevCard, 'prev') +
        flashCardHTML(curCard, 'current') +
        flashCardHTML(nextCard, 'next') +
      '</div>' +
      '<div class="feed-hint">↕ Swipe for another card · '+(idx+1)+' of '+n+'</div>';

    app.querySelector('[data-act="exit-flash"]').addEventListener('click', function(){
      // Same Child Mode PIN guard as every other feed's exit button -- see exit-feed's comment.
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor = 'exit';
      render();
    });
    app.querySelector('[data-act="flash-order"]').addEventListener('click', function(){
      S.flashOrdered = !S.flashOrdered;
      buildFlashQueue();
      render();
    });

    wireVerticalSwipeFeed('flashStage',
      function(){ S.flashIndex = S.flashIndex + 1; S.flashFlipped = false; if(S.view === 'flashFeed') render(); },
      function(){ S.flashIndex = S.flashIndex - 1; S.flashFlipped = false; if(S.view === 'flashFeed') render(); },
      function(){ S.flashFlipped = !S.flashFlipped; Sound.flip(); if(S.view === 'flashFeed') render(); });
  }

