  /* ============ scheduler (Anki-style SM-2) ============ */
  var LEARN_STEPS_MIN = [1, 10];      // new cards step through these (minutes) before graduating
  var RELEARN_STEPS_MIN = [10];       // a lapsed review card steps through these before returning to review
  var GRADUATING_DAYS = 1;            // interval a card gets when it finishes the learn steps on "Good"
  var EASY_GRADUATE_DAYS = 4;         // interval a card gets when "Easy" skips the remaining learn steps
  var EASE_START = 2.5;
  var EASE_MIN = 1.3;
  var HARD_INTERVAL_MULT = 1.2;
  var EASY_BONUS = 1.3;
  var LAPSE_MIN_DAYS = 1;             // interval a card gets after relearning from a lapse — deliberately NOT scaled
                                       // by difficulty's intervalMult (see DIFFICULTIES below), so a just-recovered
                                       // card always gets rechecked promptly no matter how hard the deck is set to.
  var LEECH_THRESHOLD = 8;            // lapses at which a card is flagged as a "leech" (needs extra practice)

  // Parents can pick one of these in Manage Decks → ⚙️ Settings. App-wide, not per-deck. Three
  // dimensions per level, all pulling in the same direction as the level gets harder:
  //  - roundSize: more questions per sitting.
  //  - intervalMult: how far out a card gets pushed once it's answered well — a bigger multiplier
  //    means a longer gap before it's tested again, which is a truer test of real retention rather
  //    than short-term memorization. (Deliberately NOT applied to the post-lapse recovery interval
  //    above, or to the struggle-shrink below, so this only stretches cards that are going well.)
  //  - struggleShrink: when a card is missed several times in a row, each consecutive miss shrinks
  //    its relearn delay by this factor (struggleShrink^consecutiveMisses) and cuts deeper into its
  //    ease, so it comes back sooner and more often relative to cards that aren't a struggle — the
  //    "if it seems like they're struggling, reinforce it more" behavior, strongest on Hard.
  var DIFFICULTIES = [
    {
      id: 'easy',
      icon: '🟢',
      name: 'Easy',
      roundSize: 4,
      intervalMult: 0.7,
      strugglePenalty: 0.08,
      struggleShrink: 0.8,
      blurb: '4 questions a round, and reviews come back a bit sooner across the board — gentle repetition rather than a real stretch on memory.'
    },
    {
      id: 'medium',
      icon: '🟡',
      name: 'Medium',
      roundSize: 6,
      intervalMult: 1.0,
      strugglePenalty: 0.20,
      struggleShrink: 0.55,
      blurb: 'The default — 6 questions a round with standard spacing.'
    },
    {
      id: 'hard',
      icon: '🟠',
      name: 'Hard',
      roundSize: 10,
      intervalMult: 1.4,
      strugglePenalty: 0.35,
      struggleShrink: 0.3,
      blurb: '10 questions a round, and cards you know well get spaced out further — a real test of long-term memory. Cards you keep missing get drilled far more often than the rest.'
    }
  ];

  // Badge gallery milestones -- each badge is earned once and stays earned forever (S.badges maps
  // badgeId -> earnedAt ms, persisted per-profile via store.getBadges/setBadges). check(ctx) is only
  // ever called with ctx built fresh right after a round finishes (see evaluateAndAwardBadges), never
  // during render, so it can lean on a couple of small async lookups the caller already made.
  var BADGES = [
    { id:'first-steps', icon:'🐣', name:'First Steps', desc:'Answer your very first flashcard.', check: function(ctx){ return ctx.stats.totalReviews >= 1; } },
    { id:'century', icon:'💯', name:'Century Club', desc:'Review 100 cards in all.', check: function(ctx){ return ctx.stats.totalReviews >= 100; } },
    { id:'streak-3', icon:'🔥', name:'On a Roll', desc:'Study 3 days in a row.', check: function(ctx){ return currentStreak(ctx.stats) >= 3; } },
    { id:'streak-7', icon:'🌟', name:'Week Streak', desc:'Study 7 days in a row.', check: function(ctx){ return currentStreak(ctx.stats) >= 7; } },
    { id:'perfect-round', icon:'🎯', name:'Perfect Round', desc:'Finish a round with every card right.', check: function(ctx){ return ctx.perfectRound; } },
    { id:'deck-master', icon:'🏆', name:'Deck Master', desc:'Master every card in a deck.', check: function(ctx){ return ctx.deckMastered; } },
    { id:'star-collector', icon:'⭐', name:'Star Collector', desc:'Earn 50 stars.', check: function(ctx){ return ctx.stats.stars >= 50; } },
    { id:'explorer', icon:'🗺️', name:'Explorer', desc:'Study 3 different decks.', check: function(ctx){ return ctx.decksStudiedCount >= 3; } }
  ];

  // An ocean-themed "Hall of Fame" -- every badge sits on its own trophy pedestal from the very
  // start (nothing is hidden until earned), earned ones gold and glowing, the rest dim, grey, and
  // padlocked. bubblesHTML() (defined further down, but function declarations are hoisted so the
  // call site here doesn't care about source order) supplies the same rising-bubble backdrop used
  // on the study stage, for the "standing in an aquarium" feel.
  function badgeGalleryHTML(){
    var earnedCount = BADGES.filter(function(b){ return !!S.badges[b.id]; }).length;
    var stands = BADGES.map(function(b){
      var earned = !!S.badges[b.id];
      return '' +
        '<div class="trophy-stand'+(earned?' earned':' locked')+'" title="'+esc(b.desc)+'">' +
          '<div class="trophy-cup"><span class="trophy-cup-icon">'+(earned?b.icon:'🔒')+'</span></div>' +
          '<div class="trophy-pedestal">' +
            '<div class="pedestal-top"></div>' +
            '<div class="pedestal-body">'+(earned?'<span class="pedestal-star">★</span>':'')+'</div>' +
          '</div>' +
          '<div class="trophy-plaque">' +
            '<div class="plaque-name">'+esc(b.name)+'</div>' +
            '<div class="plaque-desc">'+esc(b.desc)+'</div>' +
          '</div>' +
        '</div>';
    }).join('');
    return '' +
      '<div class="hof-wrap">' +
        bubblesHTML(16) +
        '<div class="hof-header">' +
          '<div class="hof-title">🏛️ Hall of Fame</div>' +
          '<div class="hof-sub">'+earnedCount+' of '+BADGES.length+' trophies earned</div>' +
        '</div>' +
        '<div class="trophy-grid">'+stands+'</div>' +
      '</div>';
  }

  // Runs right after a round's stats/history are saved -- checks every not-yet-earned badge against
  // freshly-loaded context, persists any newly earned ones, and leaves S.justEarnedBadges populated
  // so renderSummary can show a quick "new badge!" celebration for this specific round.
  function evaluateAndAwardBadges(newStats, historyEntry){
    var perfectRound = historyEntry.total > 0 && historyEntry.right === historyEntry.total;
    return Promise.all([
      S.store.getCardsOnce(S.currentDeckId),
      S.store.getHistoryOnce()
    ]).then(function(results){
      var deckCards = results[0] || [];
      var history = results[1] || [];
      var deckMastered = deckCards.length > 0 && deckCards.every(function(c){ return (c.reps||0) > 0 && (c.interval||0) >= 4; });
      var deckIds = {};
      history.forEach(function(h){ if(h.deckId) deckIds[h.deckId] = true; });
      var ctx = { stats: newStats, perfectRound: perfectRound, deckMastered: deckMastered, decksStudiedCount: Object.keys(deckIds).length };
      var updated = Object.assign({}, S.badges);
      var newlyEarned = [];
      BADGES.forEach(function(b){
        if(!updated[b.id] && b.check(ctx)){
          updated[b.id] = Date.now();
          newlyEarned.push(b.id);
        }
      });
      S.justEarnedBadges = newlyEarned;
      if(!newlyEarned.length) return Promise.resolve();
      S.badges = updated;
      return S.store.setBadges(updated);
    });
  }

  function currentDifficulty(){
    // Adults studying (Dive In from Adult Mode) always get the Hard tier -- a runtime override only,
    // so it never touches the persisted S.settings.difficulty value that governs the child's own
    // sessions (and that the child-facing Settings page still edits).
    if(S.managingDecks){
      for(var j=0;j<DIFFICULTIES.length;j++){ if(DIFFICULTIES[j].id === 'hard') return DIFFICULTIES[j]; }
    }
    var id = S.settings.difficulty || 'medium';
    for(var i=0;i<DIFFICULTIES.length;i++){ if(DIFFICULTIES[i].id === id) return DIFFICULTIES[i]; }
    return DIFFICULTIES[1];
  }

  // ---------- gradual new-card introduction ----------
  // A deck with only a handful of cards (the built-in decks) should behave exactly like before:
  // every card available right away. A big deck (like a 300-word vocabulary set) should NOT dump
  // every unseen card into the pool at once — that's overwhelming and defeats spaced repetition,
  // which relies on a card being reviewed a few times while it's still fresh. Instead, only a
  // limited number of cards are ever "in flight" (introduced but not yet solidly known) for a
  // given deck at once; a brand-new card is unlocked only once an earlier one graduates out of
  // that window by becoming well-established.
  var NEW_CARD_WINDOW = 15;      // max cards "in flight" (being learned/reviewed, not yet mastered)
                                  // per deck at any one time. Every built-in deck has well under
                                  // this many cards total, so this never engages for them — it only
                                  // kicks in once a deck is bigger than its own natural window.
  var MASTERY_INTERVAL_DAYS = 7; // a review-state card frees its window slot once its interval
                                  // reaches this many days — "known well enough" to stop blocking
                                  // the next unseen card, even though it's still scheduled to come
                                  // back for review later.

  function cardState(c){ return c.state || ((c.interval||0) > 0 ? 'review' : 'new'); }

  // Builds the pool startStudy() draws a round from: cards already due for review, plus as many
  // not-yet-seen cards as the deck's new-card window currently allows. Replaces the older "every
  // card with a due timestamp in the past" pool, which — for a huge deck — meant literally every
  // unseen card (due defaults to "now") was fair game from the very first round.
  function buildStudyPool(cards){
    var now = Date.now();
    var reviewDue = cards.filter(function(c){
      var st = cardState(c);
      return st !== 'new' && (c.due||0) <= now;
    });
    var newCards = cards.filter(function(c){ return cardState(c) === 'new'; })
      .sort(function(a,b){ return (a.createdAt||0) - (b.createdAt||0); }); // deck's own curriculum order
    var activeUnmastered = cards.filter(function(c){
      var st = cardState(c);
      if(st === 'new') return false;
      if(st === 'review' && (c.interval||0) >= MASTERY_INTERVAL_DAYS) return false;
      return true;
    }).length;
    var slots = Math.max(0, NEW_CARD_WINDOW - activeUnmastered);
    var pool = reviewDue.concat(newCards.slice(0, slots));
    if(!pool.length){
      // Nothing due and no window slot open (rare — everything currently "in flight" is mid-step
      // between due timestamps). Rather than leave the round empty, let one new card through so
      // studying never dead-ends; still just one at a time, so the gradual-introduction spirit holds.
      pool = newCards.length ? newCards.slice(0, 1) : cards;
    }
    return pool;
  }

  // Parents can pick which of these runs in Manage Decks → ⚙️ Scheduling. The choice is stored as
  // S.settings.algorithm and is app-wide (not per-deck). Two axes differ on purpose: how the
  // scheduling math works (adaptive SM-2 vs. fixed Leitner boxes), and whether answer speed factors
  // into grading at all (only 'sm2_speed' looks at elapsed time).
  var ALGORITHMS = [
    {
      id: 'sm2_speed',
      icon: '⚡',
      name: 'Standard + Speed',
      blurb: 'Adaptive scheduling (like Anki) that also factors in how fast an answer came — quick, confident answers get spaced out further than slow, hesitant ones. This is the default.'
    },
    {
      id: 'sm2_plain',
      icon: '✔️',
      name: 'Standard (Accuracy Only)',
      blurb: 'The same adaptive scheduling engine, but only right vs. wrong matters — how long it took to answer has no effect on when a card comes back.'
    },
    {
      id: 'leitner',
      icon: '🗃️',
      name: 'Simple Boxes',
      blurb: 'A simpler, more predictable system — a card moves up one box after a correct answer and back to box 1 after a miss. Easier to see why a card is showing up again.'
    }
  ];

  function fuzzedDays(days){
    if(days < 2) return days;
    var pct = days < 7 ? 0.25 : (days < 30 ? 0.15 : 0.05);
    var delta = days * pct;
    return Math.max(1, Math.round(days + (Math.random()*2 - 1) * delta));
  }

  function gradeCard(card, rating, now, diff){
    now = now || Date.now();
    diff = diff || currentDifficulty();
    var ease = card.ease || EASE_START;
    var interval = card.interval || 0;
    var reps = card.reps || 0;
    var lapses = card.lapses || 0;
    var state = card.state || (interval > 0 ? 'review' : 'new');
    var step = card.learningStep || 0;
    var isLeech = !!card.isLeech;
    var priorStreak = card.strugglingStreak || 0; // consecutive misses BEFORE this answer
    var streak = (rating === 'again') ? priorStreak + 1 : 0; // returned/persisted streak, after this answer
    var due;

    function minutesFromNow(m){ return now + m*60000; }
    function daysFromNow(d){ return now + d*86400000; }
    // Each consecutive miss on this card shrinks its relearn delay further — struggleShrink^priorStreak,
    // capped so it never collapses to near-zero. A single miss (priorStreak 0 going in) is unaffected —
    // this only kicks in once a card is already being missed repeatedly, which is the "seems like
    // they're struggling" signal, not a one-off wrong answer.
    function struggleMinutes(baseMin){
      return baseMin * Math.pow(diff.struggleShrink, Math.min(priorStreak, 3));
    }

    if(state === 'new' || state === 'learning'){
      if(rating === 'again'){
        step = 0; state = 'learning';
        due = minutesFromNow(struggleMinutes(LEARN_STEPS_MIN[0]));
      } else if(rating === 'hard'){
        state = 'learning';
        due = minutesFromNow(LEARN_STEPS_MIN[step] || LEARN_STEPS_MIN[LEARN_STEPS_MIN.length-1]);
      } else if(rating === 'good'){
        step += 1;
        if(step >= LEARN_STEPS_MIN.length){
          state = 'review'; interval = Math.max(1, Math.round(GRADUATING_DAYS * diff.intervalMult)); reps += 1; step = 0;
          due = daysFromNow(interval);
        } else {
          state = 'learning';
          due = minutesFromNow(LEARN_STEPS_MIN[step]);
        }
      } else { // easy — skip remaining steps, graduate now
        state = 'review'; interval = Math.max(1, Math.round(EASY_GRADUATE_DAYS * diff.intervalMult)); reps += 1; step = 0;
        due = daysFromNow(interval);
      }
    } else if(state === 'relearning'){
      if(rating === 'again'){
        step = 0; state = 'relearning';
        due = minutesFromNow(struggleMinutes(RELEARN_STEPS_MIN[0]));
      } else if(rating === 'hard'){
        state = 'relearning';
        due = minutesFromNow(RELEARN_STEPS_MIN[step] || RELEARN_STEPS_MIN[RELEARN_STEPS_MIN.length-1]);
      } else {
        step += 1;
        if(step >= RELEARN_STEPS_MIN.length || rating === 'easy'){
          // Deliberately NOT scaled by intervalMult (see the note by LAPSE_MIN_DAYS above) — a card
          // that just recovered from a lapse gets rechecked promptly regardless of difficulty.
          state = 'review'; interval = LAPSE_MIN_DAYS; step = 0;
          due = daysFromNow(interval);
        } else {
          state = 'relearning';
          due = minutesFromNow(RELEARN_STEPS_MIN[step]);
        }
      }
    } else { // review
      if(rating === 'again'){
        lapses += 1;
        ease = Math.max(EASE_MIN, ease - diff.strugglePenalty);
        state = 'relearning'; step = 0;
        due = minutesFromNow(struggleMinutes(RELEARN_STEPS_MIN[0]));
        if(lapses >= LEECH_THRESHOLD) isLeech = true;
      } else if(rating === 'hard'){
        ease = Math.max(EASE_MIN, ease - 0.15);
        interval = fuzzedDays(Math.max(interval + 1, Math.round(interval * HARD_INTERVAL_MULT * diff.intervalMult)));
        reps += 1;
        due = daysFromNow(interval);
      } else if(rating === 'good'){
        interval = fuzzedDays(Math.max(interval + 1, Math.round(interval * ease * diff.intervalMult)));
        reps += 1;
        due = daysFromNow(interval);
      } else { // easy
        ease = ease + 0.15;
        interval = fuzzedDays(Math.max(interval + 1, Math.round(interval * ease * EASY_BONUS * diff.intervalMult)));
        reps += 1;
        due = daysFromNow(interval);
      }
    }

    return { ease: ease, interval: interval, reps: reps, lapses: lapses, due: due, state: state, learningStep: step, isLeech: isLeech, strugglingStreak: streak };
  }

  /* ============ scheduler (Simple Boxes / Leitner) ============ */
  // A card starts in box 1. A correct answer moves it up one box (capped at the last box); a miss
  // sends it straight back to box 1 and becomes due again right away (so it can resurface the same
  // sitting via "Play Again", the same spirit as SM-2's short relearning steps). No ease factor, no
  // per-mode timing — just right/wrong and a fixed interval per box, which is the whole appeal of
  // this option: it's easy for a parent (or a kid) to predict when a card comes back.
  var LEITNER_BOX_DAYS = [1, 2, 4, 7, 14, 30]; // index 0 = box 1

  function gradeCardLeitner(card, correct, now, diff){
    now = now || Date.now();
    diff = diff || currentDifficulty();
    var box = card.box || 1;
    var reps = card.reps || 0;
    var lapses = card.lapses || 0;
    var streak = card.strugglingStreak || 0;
    var due;
    if(correct){
      streak = 0;
      box = Math.min(box + 1, LEITNER_BOX_DAYS.length);
      reps += 1;
      due = now + Math.max(1, Math.round(LEITNER_BOX_DAYS[box - 1] * diff.intervalMult)) * 86400000;
    } else {
      // Already as immediate as reinforcement gets (due right away) — no more room for struggleShrink
      // to tighten further, so a repeated miss here just keeps the streak counter climbing.
      streak += 1;
      box = 1;
      lapses += 1;
      due = now; // back in the pool right away, not banished for a full day
    }
    return {
      box: box, interval: LEITNER_BOX_DAYS[box - 1], reps: reps, lapses: lapses, due: due,
      state: 'review', ease: card.ease || EASE_START, learningStep: 0,
      isLeech: lapses >= LEECH_THRESHOLD, strugglingStreak: streak
    };
  }

  var STARS = { again: 0, hard: 1, good: 2, easy: 3 };
  // Every per-card mode other than plain 'flip' (the fallback for anything unrecognised).
  var CARD_MODES = ['read', 'choice', 'match', 'blank', 'timedchoice', 'blend', 'listen', 'echo', 'build', 'hanja', 'numsys'];

  /* ============ automatic grading: derive the SM-2 rating from correct/incorrect + time taken ============ */
  /* No more asking the kid to self-judge "was that easy or hard" — we just need right vs. wrong (still
     self-reported for flip/read cards, since there's no way to grade an open-ended answer automatically;
     fully automatic for multiple-choice, since the app already knows). Response time then decides how
     confidently "right" counts: quick + correct graduates further out than slow + correct, and any wrong
     answer is always "again" regardless of how long it took. */
  var TIME_THRESHOLDS = {
    choice: { fastMs: 3000,  slowMs: 9000  },  // time from seeing the question to tapping an option
    flip:   { fastMs: 4000,  slowMs: 12000 },  // time from seeing the front to flipping (recall latency)
    read:   { fastMs: 5000,  slowMs: 15000 },  // time from seeing the word/phrase to marking it read
    match:  { fastMs: 4000,  slowMs: 11000 },  // time from seeing the card to dropping a tile on the target
    blank:  { fastMs: 4000,  slowMs: 11000 },  // time from seeing the sentence to dropping a tile in the blank
    timedchoice: { fastMs: 2500, slowMs: 6000 }, // a correct answer under real time pressure counts as "fast" sooner than plain choice mode's thresholds -- the countdown itself already does most of the pressuring
    listen: { fastMs: 4000, slowMs: 12000 }, // time from first hearing the word to tapping an option
    echo: { fastMs: 20000, slowMs: 60000 }, // self-graded after listening, recording and comparing -- time says little, so only very long waits count as slow
    build: { fastMs: 9000, slowMs: 30000 },
    hanja: { fastMs: 5000, slowMs: 14000 },
    numsys: { fastMs: 5000, slowMs: 14000 }, // reading the situation and three look-alike answers // time from seeing the word to tapping an option (reading characters takes a moment) // time from seeing the meaning to placing the last tile
    blend: { fastMs: 7000, slowMs: 20000 } // time from seeing the word to the slider reaching the end -- generous, since a careful, slow drag through every sound chunk is the whole point, not something to penalize
  };
  function autoRating(mode, correct, elapsedMs){
    if(!correct) return 'again';
    // Only the 'sm2_speed' algorithm (the default) weighs response time; the other two options
    // treat every correct answer the same regardless of how long it took.
    var algo = S.settings.algorithm || 'sm2_speed';
    if(algo !== 'sm2_speed') return 'good';
    var t = TIME_THRESHOLDS[mode] || TIME_THRESHOLDS.flip;
    if(elapsedMs <= t.fastMs) return 'easy';
    if(elapsedMs <= t.slowMs) return 'good';
    return 'hard';
  }

  /* ============ sound + haptics (synthesized, no external files) ============ */
  var Sound = (function(){
    var ctx = null;
    var enabled = true;
    try {
      var saved = localStorage.getItem('coralCoveSound');
      if(saved !== null) enabled = saved === '1';
    } catch(e){}

    function ensureCtx(){
      if(!ctx){
        var AC = window.AudioContext || window.webkitAudioContext;
        if(AC){ try { ctx = new AC(); } catch(e){ ctx = null; } }
      }
      if(ctx && ctx.state === 'suspended'){ ctx.resume().catch(function(){}); }
      return ctx;
    }

    function tone(freq, start, dur, type, peak){
      var c = ensureCtx();
      if(!c || !enabled) return;
      try {
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        var t0 = c.currentTime + start;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(peak || 0.16, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t0); osc.stop(t0 + dur + 0.03);
      } catch(e){}
    }

    function slideTone(freqStart, freqEnd, start, dur, type, peak){
      var c = ensureCtx();
      if(!c || !enabled) return;
      try {
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = type || 'sine';
        var t0 = c.currentTime + start;
        osc.frequency.setValueAtTime(freqStart, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(peak || 0.14, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t0); osc.stop(t0 + dur + 0.03);
      } catch(e){}
    }

    function vibrate(pattern){
      if(!enabled) return;
      try { if(navigator.vibrate) navigator.vibrate(pattern); } catch(e){}
    }

    // iOS Safari silences Web Audio API tones whenever the physical mute/ring switch is
    // flipped to silent — this is a long-standing platform quirk, not a bug in this app.
    // The known workaround: get a real HTML5 <audio> element playing (even near-silent,
    // looped audio) from the very first tap. That switches the page's audio session into
    // the "playback" category, which iOS does NOT silence for the mute switch, and Web
    // Audio tones started afterward inherit that same session. Best-effort — not guaranteed
    // on every iOS version, but harmless if it doesn't help.
    var silentUnlockAudio = null;
    var SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
    function startSilentUnlock(){
      if(silentUnlockAudio) return;
      try {
        silentUnlockAudio = new Audio(SILENT_WAV);
        silentUnlockAudio.loop = true;
        silentUnlockAudio.volume = 0.01;
        var p = silentUnlockAudio.play();
        if(p && p.catch) p.catch(function(){});
      } catch(e){}
    }

    return {
      isEnabled: function(){ return enabled; },
      setEnabled: function(v){
        enabled = v;
        try { localStorage.setItem('coralCoveSound', v ? '1' : '0'); } catch(e){}
      },
      unlock: function(){ ensureCtx(); startSilentUnlock(); }, // call on first user gesture so mobile browsers allow audio later
      // Shares this one AudioContext with the Ambience module below, rather than each spinning up
      // its own -- browsers cap how many contexts can run at once, and there's no reason for a sound
      // effect and a looping background track to fight over separate audio graphs.
      getCtx: function(){ return ensureCtx(); },
      tap: function(){ tone(520, 0, 0.06, 'sine', 0.10); vibrate(8); },
      // Soft water sounds for Shelly and Lumi: one rising "bloop", and a few bubbles in a row.
      bloop: function(f, start, peak){ slideTone(f, f * 1.7, start || 0, 0.11, 'sine', peak || 0.07); },
      bubbles: function(n){ n = Math.min(5, n || 3); for(var i = 0; i < n; i++) slideTone(480 + Math.random() * 420, 900 + Math.random() * 500, i * 0.075, 0.09, 'sine', 0.045); },
      // A short, dry clock-tick -- used to underline a waiting period (Equation Feed's answer
      // reveal) rather than any right/wrong outcome. Quieter and shorter than tap() so a run of
      // them over several seconds doesn't get grating.
      tick: function(){ tone(1500, 0, 0.03, 'square', 0.05); },
      flip: function(){ tone(420, 0, 0.08, 'sine', 0.10); tone(640, 0.05, 0.09, 'sine', 0.09); vibrate(10); },
      // Playful "ta-da!" — a quick bouncing major arpeggio with a sparkly high glimmer on top.
      correct: function(){
        tone(523, 0,    0.08, 'triangle', 0.15);   // C5
        tone(659, 0.06, 0.08, 'triangle', 0.15);   // E5
        tone(784, 0.12, 0.10, 'triangle', 0.16);   // G5
        tone(1047, 0.19, 0.16, 'triangle', 0.15);  // C6 — the "ta-da"
        tone(1568, 0.20, 0.12, 'sine', 0.05);      // tiny sparkle overlay
        vibrate([10, 15, 10]);
        try { Ocean.bubbles(6); } catch(e){}       // and a few bubbles rise from where the answer was tapped (ocean theme only)
      },
      // Playful cartoon "womp womp" — a comic downward slide instead of a harsh buzzer, so it stays fun, not discouraging.
      wrong: function(){
        // Child profiles get a soft, neutral two-note "hmm" -- aversive or funny error sounds can make a
        // miss feel like a big event (or a game to trigger) for an autistic learner. Errorless learning
        // keeps the focus on the right answer, which is now shown on every miss.
        if(typeof S !== 'undefined' && S && S.profile && S.profile.mode === 'child'){
          tone(392, 0, 0.14, 'sine', 0.07); tone(330, 0.12, 0.18, 'sine', 0.06); vibrate(12); return;
        }
        slideTone(420, 180, 0,    0.24, 'sawtooth', 0.09);
        slideTone(320, 140, 0.20, 0.22, 'sawtooth', 0.07);
        vibrate([20, 30, 20]);
      },
      sessionStart: function(){ tone(523, 0, 0.10, 'triangle', 0.15); tone(659, 0.09, 0.10, 'triangle', 0.15); tone(784, 0.18, 0.18, 'triangle', 0.16); vibrate([20, 50, 20]); },
      sessionEnd: function(){ tone(784, 0, 0.12, 'triangle', 0.16); tone(659, 0.11, 0.10, 'triangle', 0.14); tone(523, 0.20, 0.18, 'triangle', 0.15); vibrate([30, 60, 30, 60, 30]); }
    };
  })();

  /* ============ spoken answers (Web Speech API — no audio files to host, works offline) ============ */
  /* ============ real pronunciation clips (db-backed) ============ */
  // A small, growing library of real recorded word audio -- not synthesized -- lives in the
  // artifact's database as one document per word (collection "audio-clips", doc id = the word
  // lowercased with spaces turned into hyphens, e.g. "field trip" -> "field-trip"). Speech.speak()
  // below checks here first and only falls back to the synthesized voice when a word has no real
  // clip yet. Most words still don't -- this covers whatever's been supplied so far.
  /* ============ natural voice packs (pre-made neural speech, shipped with the page) ============ */
  // Every word and sentence in the decks has a clip made ahead of time with a neural voice (Korean
  // and English), checked by a speech recogniser, cleaned and levelled, then packed into a few MP3
  // "pack" files next to this page (voice/*.mp3) with an index (voice/index.json) of where each clip
  // sits. A clip is a self-contained MP3 slice, so playing one is: fetch its pack once, slice the
  // bytes, play. Text with no clip (a brand-new card, a Story Maker sentence) falls back to the
  // device's own voice, exactly as before. Keys must match key() in the generator (tts/inventory.py).
  var VoicePack = (function(){
    var BASE = 'voice/';
    var index = null, indexLoad = null, packs = {}, packLoads = {}, urls = {}, urlOrder = [];
    function on(){ try { return localStorage.getItem('cc-natural-voice') !== 'off'; } catch(e){ return true; } }
    function setOn(v){ try { if(v) localStorage.removeItem('cc-natural-voice'); else localStorage.setItem('cc-natural-voice', 'off'); } catch(e){} }
    function key(text){
      return String(text == null ? '' : text).normalize('NFC').trim().toLowerCase()
        .replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, '').replace(/\s+/g, ' ');
    }
    function loadIndex(){
      if(index) return Promise.resolve(index);
      if(indexLoad) return indexLoad;
      if(!window.fetch) return Promise.resolve(null);
      indexLoad = fetch(BASE + 'index.json', { cache: 'no-cache' }).then(function(r){
        if(!r.ok) throw new Error('no voice index');
        return r.json();
      }).then(function(j){
        if(!j || !j.clips || !j.packs) throw new Error('bad voice index');
        index = j; return j;
      }).catch(function(){ indexLoad = null; return null; });
      return indexLoad;
    }
    function loadPack(p){
      if(packs[p]) return Promise.resolve(packs[p]);
      if(packLoads[p]) return packLoads[p];
      packLoads[p] = fetch(BASE + index.packs[p] + '?v=' + (index.v || 1)).then(function(r){
        if(!r.ok) throw new Error('pack ' + p);
        return r.arrayBuffer();
      }).then(function(buf){ packs[p] = buf; delete packLoads[p]; return buf; })
        .catch(function(){ delete packLoads[p]; return null; });
      return packLoads[p];
    }
    function entry(text, variant){
      if(!index) return null;
      var k = key(text);
      if(!k) return null;
      return (variant && index.clips[variant + '|' + k]) || index.clips['n|' + k] || null;
    }
    function urlFor(id, buf, e){
      if(urls[id]) return urls[id];
      var blob = new Blob([buf.slice(e[1], e[1] + e[2])], { type: 'audio/mpeg' });
      var u = URL.createObjectURL(blob);
      urls[id] = u; urlOrder.push(id);
      if(urlOrder.length > 300){ var old = urlOrder.shift(); try { URL.revokeObjectURL(urls[old]); } catch(err){} delete urls[old]; }
      return u;
    }
    // -> Promise<{url, variant}|null>. Waits at most `waitMs` for the index/pack to arrive, so a slow
    // first download never leaves a tap silent -- the device voice answers instead.
    function find(text, variant, waitMs){
      if(!on()) return Promise.resolve(null);
      var work = loadIndex().then(function(ix){
        if(!ix) return null;
        var e = entry(text, variant);
        if(!e) return null;
        return loadPack(e[0]).then(function(buf){
          if(!buf) return null;
          var id = e[0] + ':' + e[1];
          return { url: urlFor(id, buf, e), variant: (variant && index.clips[variant + '|' + key(text)]) ? variant : 'n' };
        });
      }).catch(function(){ return null; });
      var limit = new Promise(function(res){ setTimeout(function(){ res(null); }, waitMs || 2500); });
      return Promise.race([work, limit]);
    }
    function has(text, variant){ var e = entry(text, variant); return !!e; }
    // Fetch every pack in the background once the page is idle, so the first tap on a card is instant.
    function warm(){
      return loadIndex().then(function(ix){
        if(!ix) return;
        var i = 0;
        (function next(){ if(i >= ix.packs.length) return; loadPack(i++).then(function(){ setTimeout(next, 200); }); })();
      });
    }
    function count(){ return index ? Object.keys(index.clips).length : 0; }
    return { find: find, has: has, warm: warm, key: key, on: on, setOn: setOn, count: count, loadIndex: loadIndex };
  })();

  var AudioClips = (function(){
    var db = null;
    var cache = {};   // slug -> HTMLAudioElement, or null once confirmed there's no clip for it
    var pending = {}; // slug -> in-flight lookup promise, so a fast double-tap doesn't double-fetch
    function slugify(text){
      var base = String(text).trim().toLowerCase().replace(/\s+/g, '-');
      // Doc ids in this artifact's database only allow plain ASCII (letters, digits, and a handful
      // of punctuation marks) -- any other character (accented letters, Hangul, emoji, ...) has to
      // be encoded into something ASCII-safe rather than passed through as-is. Passing an invalid
      // character straight to db.doc() throws synchronously, which used to break the ENTIRE speak()
      // call for that word (Korean vocabulary especially) -- not just the real-clip lookup, but the
      // synthesized-voice fallback too, since the exception happened before that fallback ever ran.
      // No real clip is keyed this way today (all 43 are plain English words), so this is mostly a
      // forward-compatible safety net, but it's what makes Korean cards speak at all.
      return base.replace(/[^a-z0-9_\-.~:@+]/g, function(ch){
        return '_u' + ch.charCodeAt(0).toString(16);
      });
    }
    var index = null; // slug -> true for every recorded clip, once audio-clips-index/main has loaded
    function get(text){
      if(!db) return Promise.resolve(null);
      var slug = slugify(text);
      if(!slug) return Promise.resolve(null);
      if(Object.prototype.hasOwnProperty.call(cache, slug)) return Promise.resolve(cache[slug]);
      if(index && !index[slug]) return Promise.resolve(null);
      if(pending[slug]) return pending[slug];
      var lookup;
      try {
        lookup = db.doc('audio-clips/' + slug).get();
      } catch(e){
        // Belt-and-suspenders: even with slugify() sanitizing every character above, don't let a
        // future edge case (an empty slug, a doc-id length limit, ...) take down Speech.speak()
        // entirely -- fall straight through to the synthesized-voice fallback instead.
        cache[slug] = null;
        return Promise.resolve(null);
      }
      pending[slug] = lookup.then(function(snap){
        var audio = null;
        if(snap && snap.exists){
          var data = snap.data();
          if(data && data.audio) audio = data.audio; // a data: URL -- played through Speech's shared player
        }
        cache[slug] = audio;
        delete pending[slug];
        return audio;
      }).catch(function(){
        cache[slug] = null;
        delete pending[slug];
        return null;
      });
      return pending[slug];
    }
    return {
      init: function(){
        if(!(window.claude && window.claude.use)) return Promise.resolve(null);
        return window.claude.use('db').then(function(handle){
          db = handle;
          if(db) db.doc('audio-clips-index/main').get().then(function(snap){
            var d = snap && snap.exists ? snap.data() : null;
            if(d && d.slugs && d.slugs.length){ index = {}; d.slugs.forEach(function(x){ index[x] = true; }); }
          }).catch(function(){});
          return db;
        }).catch(function(){ db = null; return null; });
      },
      get: get
    };
  })();

  var Speech = (function(){
    var supported = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
    var voices = [];
    var lastUtter = null; // keep a live reference while speaking -- Chrome has a long-documented bug
                           // where an utterance with no other reference gets garbage-collected mid-speech,
                           // silently cutting off audio with no error at all

    function refreshVoices(){
      if(!supported) return;
      try { voices = window.speechSynthesis.getVoices() || []; } catch(e){ voices = []; }
    }
    if(supported){
      refreshVoices();
      // Voices load asynchronously in most browsers -- on first page load getVoices() often comes
      // back empty even though voices arrive a moment later.
      try { window.speechSynthesis.onvoiceschanged = refreshVoices; } catch(e){}
    }

    // Card text with no lang hint stored, so detect it from the actual characters: Hangul -> Korean,
    // otherwise assume English. Without this, the browser's default voice (almost always English)
    // tries to read Hangul and many engines produce nothing at all rather than a mispronunciation.
    function detectLang(text){
      if(/[가-힣ᄀ-ᇿ㄰-㆏]/.test(text)) return 'ko-KR';
      return /[\u3400-\u9fff]/.test(text) ? 'zh-TW' : 'en-US'; // Chinese characters with no Hangul: Mandarin (Traditional)
    }

    // Rank same-language voice candidates by likely audio quality rather than just taking whichever
    // one the browser happened to list first -- on most devices that's an arbitrary/alphabetical
    // order, and the first entry is often a low-quality local/offline synthesizer even when a much
    // better cloud-backed voice is sitting right next to it in the list.
    function voiceQualityScore(v){
      var name = (v.name || '') + ' ' + (v.voiceURI || '');
      var score = 0;
      if(v.localService === false) score += 10; // network/cloud voices are near-universally the nicer-sounding ones
      if(/premium/i.test(name)) score += 14;     // Apple's best downloadable voices
      if(/enhanced/i.test(name)) score += 10;
      if(/neural|natural|wavenet|online/i.test(name)) score += 10;
      if(/siri/i.test(name)) score += 8;
      if(/google/i.test(name)) score += 4;
      if(/\b(samantha|ava|allison|zoe|evan|nathan|joelle|aria|jenny|guy|yuna|sora|sunhi|injoon|jian|suhyun|minsu)\b/i.test(name)) score += 3;
      if(/espeak|compact|robot/i.test(name)) score -= 6; // known low-quality engines some platforms ship
      // Apple's novelty and "Eloquence" voices are hard to understand -- never pick them by default.
      if(/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i.test(name)) score -= 25;
      return score;
    }
    function pickBest(list){
      if(!list.length) return null;
      var best = list[0], bestScore = voiceQualityScore(list[0]);
      for(var i=1;i<list.length;i++){
        var s = voiceQualityScore(list[i]);
        if(s > bestScore){ best = list[i]; bestScore = s; }
      }
      return best;
    }
    // A voice chosen in Settings (saved on this device, since every device has its own voices) wins.
    function prefKey(lang){ return 'cc-voice-' + lang.split('-')[0]; }
    function getPref(k){ try { return localStorage.getItem(k) || ''; } catch(e){ return ''; } }
    function setPref(k, v){ try { if(v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch(e){} }
    function pickVoice(lang){
      if(!voices.length) refreshVoices();
      if(!voices.length) return null;
      var want = getPref(prefKey(lang));
      if(want){ var chosen = voices.filter(function(v){ return v.name === want; })[0]; if(chosen) return chosen; }
      var exact = voices.filter(function(v){ return v.lang === lang; });
      if(exact.length) return pickBest(exact);
      var prefix = lang.split('-')[0];
      var loose = voices.filter(function(v){ return v.lang && v.lang.indexOf(prefix) === 0; });
      return loose.length ? pickBest(loose) : null;
    }

    function doSpeak(text, lang, rate){
      try {
        playerGen++; if(player) player.pause();
        var synth = window.speechSynthesis;
        var busy = synth.speaking || synth.pending;
        synth.cancel(); // stop anything already talking before starting the new line
        var utter = new SpeechSynthesisUtterance(String(text));
        utter.lang = lang;
        var v = pickVoice(lang);
        if(v) utter.voice = v;
        var speed = parseFloat(getPref('cc-voice-speed')) || 1;
        utter.rate = Math.max(0.2, Math.min(1.4, (rate || 0.88) * speed)); // a touch slower by default
        utter.pitch = 1;  // natural pitch: raising it made voices sound thinner and less clear
        utter.volume = 1;
        lastUtter = utter;
        utter.onend = utter.onerror = function(){ if(lastUtter === utter) lastUtter = null; };
        // iOS Safari can drop a line spoken in the same instant as cancel(); give it a beat only then.
        if(busy) setTimeout(function(){ if(lastUtter === utter) synth.speak(utter); }, 60);
        else synth.speak(utter);
      } catch(e){}
    }

    function speakSynth(str, rate){
      if(!supported) return;
      var lang = detectLang(str);
      if(!voices.length){
        refreshVoices();
        if(!voices.length){
          // Give voices a brief moment to finish loading rather than speaking with whatever the
          // browser's un-loaded default happens to be (or silently failing if it has none yet).
          var tries = 0;
          var wait = setInterval(function(){
            refreshVoices();
            tries++;
            if(voices.length || tries > 10){
              clearInterval(wait);
              doSpeak(str, lang, rate);
            }
          }, 150);
          return;
        }
      }
      doSpeak(str, lang, rate);
    }

    function listVoices(lang){
      if(!voices.length) refreshVoices();
      var prefix = lang.split('-')[0];
      return voices.filter(function(v){ return v.lang && v.lang.indexOf(prefix) === 0; })
        .sort(function(a, b){ return voiceQualityScore(b) - voiceQualityScore(a); });
    }
    // One shared <audio> element plays every clip (natural-voice packs and real recordings). iPad and
    // iPhone only let a page start sound from a tap, but an element that has played once inside a tap
    // may play again later -- so the first touch anywhere plays a silent blip on it, and the automatic
    // read-alouds (a card settling, a story page turning) keep working after that.
    var SILENT_MP3 = 'data:audio/mpeg;base64,//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    var player = null, playerGen = 0, speakToken = 0, unlocked = false;
    function getPlayer(){
      if(!player){
        player = new Audio();
        player.preload = 'auto';
        try { player.preservesPitch = true; player.webkitPreservesPitch = true; } catch(e){}
      }
      return player;
    }
    function unlockAudio(){
      if(unlocked) return;
      unlocked = true;
      try { var a = getPlayer(); a.src = SILENT_MP3; var p = a.play(); if(p && p.catch) p.catch(function(){ unlocked = false; }); } catch(e){ unlocked = false; }
    }
    ['pointerdown', 'touchend', 'keydown'].forEach(function(ev){ document.addEventListener(ev, unlockAudio, true); });
    function stop(){
      speakToken++; playerGen++;
      try { if(player) player.pause(); } catch(e){}
      try { if(supported) window.speechSynthesis.cancel(); } catch(e){}
    }
    function playUrl(url, rate, onEnd){
      var a = getPlayer(), gen = ++playerGen;
      try { if(supported) window.speechSynthesis.cancel(); } catch(e){}
      a.onended = function(){ if(gen === playerGen && onEnd) onEnd(); };
      a.onerror = function(){ if(gen === playerGen && onEnd) onEnd(); };
      try { a.pause(); } catch(e){}
      a.src = url;
      var speed = parseFloat(getPref('cc-voice-speed')) || 1;
      var r = Math.max(0.5, Math.min(1.5, (rate || 1) * speed));
      try { a.defaultPlaybackRate = r; a.playbackRate = r; } catch(e){}
      var p;
      try { p = a.play(); } catch(e){ return Promise.reject(e); }
      return (p && p.then) ? p : Promise.resolve();
    }
    // Real recording first (the 43 phonics words), then the natural-voice pack, else null.
    function resolveClip(str, variant){
      return AudioClips.get(str).then(function(url){
        if(url) return { url: url, variant: null };
        return VoicePack.find(str, variant);
      }).catch(function(){ return null; });
    }
    // A clip made at the requested pace (a 'slow' or 'eq' variant) plays as is; otherwise a slower
    // reading is asked of the clip itself, pitch kept, never below 0.6x.
    function clipRate(clip, rate, variant){
      if(!rate || (variant && clip.variant === variant)) return 1;
      return Math.max(0.6, Math.min(1, rate / 0.88));
    }
    // `opts.rate` lets a caller ask for a slower-than-default reading speed (e.g. Equation Feed reading
    // a whole equation aloud) without touching the speed everything else speaks at; `opts.variant`
    // names a clip made for that pace ('slow' for Listen & Pick's turtle, 'eq' for equations).
    // A line with no clip of its own may be made of sentences that each have one ("Shelly says:", "Let's dive
    // into Soccer Practice!"): those play one after another in the natural voice, and only a sentence with no
    // clip at all is read by the device's voice.
    function sentences(str){
      return String(str).replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/gu, '').replace(/([.!?:])\s+/g, '$1\n').split('\n')
        .map(function(x){ return x.trim(); }).filter(function(x){ return /[\p{L}\p{N}]/u.test(x); });
    }
    function speakParts(str, rate, variant, token, onEnd){
      var parts = sentences(str);
      if(parts.length < 2){ if(onEnd) speakSynthCb(str, onEnd); else speakSynth(str, rate); return; }
      Promise.all(parts.map(function(pt){ return resolveClip(pt, variant).catch(function(){ return null; }); })).then(function(clips){
        if(token !== speakToken){ if(onEnd) onEnd(); return; }
        if(!clips.some(Boolean)){ if(onEnd) speakSynthCb(str, onEnd); else speakSynth(str, rate); return; }   // nothing to stitch: one smooth device reading
        var i = 0;
        (function next(){
          if(token !== speakToken || i >= parts.length){ if(onEnd) onEnd(); return; }
          var pt = parts[i], c = clips[i]; i++;
          if(c) playUrl(c.url, clipRate(c, rate, variant), next).catch(function(){ speakSynthCb(pt, next); });
          else speakSynthCb(pt, next);
        })();
      });
    }
    function speak(text, opts){
      if(!Sound.isEnabled() || !text || deckSpeechMuted()) return;
      var str = String(text);
      var rate = opts && opts.rate, variant = opts && opts.variant;
      var token = ++speakToken;
      resolveClip(str, variant).then(function(clip){
        if(token !== speakToken) return; // a newer line was asked for while this one was loading
        if(clip){
          playUrl(clip.url, clipRate(clip, rate, variant)).catch(function(){ if(token === speakToken) speakSynth(str, rate); });
          return;
        }
        speakParts(str, rate, variant, token);
      });
    }
    // Equation Feed needs to know exactly when a spoken line actually finishes (real clip or
    // synthesized fallback) so the bounced-in answer can land right after it, not before or during.
    // Deliberately a separate function from speak() above rather than adding a callback parameter
    // there -- speak() is called everywhere else in the app and this keeps that path completely
    // unchanged. onEnd always fires exactly once, even on error, even when nothing plays at all
    // (sound off, or speech unsupported) -- so a caller can safely wait on it instead of guessing a
    // fixed delay.
    function doSpeakCb(text, lang, onEnd){
      try {
        playerGen++; if(player) player.pause();
        window.speechSynthesis.cancel();
        var utter = new SpeechSynthesisUtterance(String(text));
        utter.lang = lang;
        var v = pickVoice(lang);
        if(v) utter.voice = v;
        utter.rate = Math.max(0.2, Math.min(1.4, 0.88 * (parseFloat(getPref('cc-voice-speed')) || 1)));
        utter.pitch = 1;
        lastUtter = utter;
        var fired = false;
        function done(){ if(fired) return; fired = true; if(lastUtter === utter) lastUtter = null; if(onEnd) onEnd(); }
        utter.onend = done;
        utter.onerror = done;
        window.speechSynthesis.speak(utter);
      } catch(e){ if(onEnd) onEnd(); }
    }
    function speakSynthCb(str, onEnd){
      if(!supported){ if(onEnd) onEnd(); return; }
      var lang = detectLang(str);
      if(!voices.length){
        refreshVoices();
        if(!voices.length){
          var tries = 0;
          var wait = setInterval(function(){
            refreshVoices();
            tries++;
            if(voices.length || tries > 10){
              clearInterval(wait);
              doSpeakCb(str, lang, onEnd);
            }
          }, 150);
          return;
        }
      }
      doSpeakCb(str, lang, onEnd);
    }
    // Speaks `text` exactly like speak() above (real clip first, synthesized fallback), but calls
    // onEnd() once playback actually finishes.
    function speakThen(text, onEnd, opts){
      if(!Sound.isEnabled() || !text || deckSpeechMuted()){ if(onEnd) onEnd(); return; }
      var str = String(text), variant = opts && opts.variant;
      // Watchdog: some phones (iOS Safari especially) silently drop an utterance or never fire its
      // 'end' event, which used to leave anything waiting on onEnd -- like a Sound Blend card's
      // auto-advance -- stuck forever. onEnd now fires once, either when playback really ends or
      // after a generous length-based timeout, whichever comes first.
      var origEnd = onEnd, endFired = false;
      var watchdog = setTimeout(function(){ onEnd(); }, Math.min(9000, 2600 + str.length * 110));
      onEnd = function(){ if(endFired) return; endFired = true; clearTimeout(watchdog); if(origEnd) origEnd(); };
      var token = ++speakToken;
      resolveClip(str, variant).then(function(clip){
        if(token !== speakToken){ onEnd(); return; }
        if(clip){
          playUrl(clip.url, 1, onEnd).catch(function(){ speakSynthCb(str, onEnd); });
          return;
        }
        speakParts(str, null, variant, token, onEnd);
      }).catch(function(){ speakSynthCb(str, onEnd); });
    }
    return { speak: speak, speakThen: speakThen, stop: stop, playUrl: playUrl, isSupported: function(){ return supported; },
      listVoices: listVoices, getPref: getPref, setPref: setPref, prefKey: prefKey,
      autoVoice: function(lang){ var p = getPref(prefKey(lang)); setPref(prefKey(lang), ''); var v = pickVoice(lang); setPref(prefKey(lang), p); return v; } };
  })();

  // A deck can switch off read-aloud entirely (deck.muteSpeech, the "Read aloud" toggle in the deck
  // editor) -- meant for decks whose text doesn't make sense spoken by a text-to-speech voice, like
  // math formulas. Checked centrally inside Speech.speak/speakThen, so every call site (flip auto-speak,
  // tap-to-speak on choices, feeds, Hear it again) goes quiet for that deck with no per-site changes.
  // Sound effects (Sound.*) are unaffected -- only spoken words are muted.
  function deckSpeechMuted(){
    try {
      if(!S || !S.currentDeckId || !S.decks) return false;
      var d = S.decks.find(function(x){ return x.id === S.currentDeckId; });
      return !!(d && d.muteSpeech);
    } catch(e){ return false; }
  }

  /* ============ Word Feed ambience -- looping background sound/music ============ */
  // Six looping ambient tracks, procedurally generated with the Web Audio API -- same "no audio
  // files to host, works offline" reasoning as the Sound module above, and it shares that module's
  // one AudioContext (Sound.getCtx()) rather than opening a second. Three are free forever; the
  // other three cost SOUND_PRICE stars each to unlock, once, per profile (tracked in
  // S.stats.unlockedSounds -- see the WORD FEED section further down for the shop UI).
  var SOUND_PRICE = 5;
  var SOUND_TRACKS = [
    { id:'waves',   icon:'🌊', name:'Ocean Waves',     free:true,  kind:'noise-waves' },
    { id:'tune',    icon:'🎵', name:'Bouncy Tune',     free:true,  kind:'music-bouncy' },
    { id:'rain',    icon:'🌧️', name:'Rainy Day',       free:true,  kind:'noise-rain' },
    { id:'chimes',  icon:'🐚', name:'Seashell Chimes', free:false, kind:'music-chimes' },
    { id:'dolphin', icon:'🐬', name:'Dolphin Pop',     free:false, kind:'music-pop' },
    { id:'deepsea', icon:'🫧', name:'Deep Sea Hum',    free:false, kind:'noise-hum' }
  ];

  var Ambience = (function(){
    var master = null;   // this track's own fade-in/out gain, sitting in front of everything else
    var nodes = [];       // every node this track created, so stop() can tear them all down
    var timers = [];       // pending setTimeout ids (note-loop scheduling, random blips) to cancel on stop
    var currentId = null;

    function makeNoiseBuffer(c, seconds){
      var len = Math.max(1, Math.floor(c.sampleRate * seconds));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var data = buf.getChannelData(0);
      for(var i=0;i<len;i++) data[i] = Math.random()*2 - 1;
      return buf;
    }

    // One short, decaying tone burst into a given destination node -- the same shape as Sound's own
    // tone() helper above, just parameterized on where it connects instead of always going straight
    // to the speakers, so melody loops can route through this track's fade-able master gain.
    function burst(c, dest, freq, dur, type, peak){
      try {
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = type || 'triangle';
        osc.frequency.value = freq;
        var t0 = c.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak || 0.5, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.05, dur * 0.92));
        osc.connect(g); g.connect(dest);
        osc.start(t0); osc.stop(t0 + dur + 0.03);
      } catch(e){}
    }

    // Repeats `notes` (each { freq, dur, type, gain }, freq falsy = a rest) forever into `dest`,
    // scheduling one note at a time with setTimeout -- fine-grained sample-accurate scheduling isn't
    // needed for a background loop a kid is swiping words over, not conducting.
    function loopNotes(c, dest, notes){
      var i = 0;
      function playNext(){
        var n = notes[i % notes.length];
        i++;
        if(n.freq) burst(c, dest, n.freq, n.dur, n.type, n.gain);
        timers.push(setTimeout(playNext, n.dur * 1000));
      }
      playNext();
    }

    function playWaves(c, dest){
      var noise = c.createBufferSource();
      noise.buffer = makeNoiseBuffer(c, 4);
      noise.loop = true;
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450; // swept by lfo1 below, between roughly 100-800Hz
      var gain = c.createGain();
      gain.gain.value = 0.35; // swept by lfo2 below, between roughly 0.10-0.60 -- the "swell"
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      var lfo1 = c.createOscillator(); lfo1.frequency.value = 0.11; // ~9s wash-in/wash-out cycle
      var lfoGain1 = c.createGain(); lfoGain1.gain.value = 350;
      lfo1.connect(lfoGain1); lfoGain1.connect(filter.frequency);
      var lfo2 = c.createOscillator(); lfo2.frequency.value = 0.11;
      var lfoGain2 = c.createGain(); lfoGain2.gain.value = 0.25;
      lfo2.connect(lfoGain2); lfoGain2.connect(gain.gain);
      noise.start(); lfo1.start(); lfo2.start();
      nodes.push(noise, filter, gain, lfo1, lfoGain1, lfo2, lfoGain2);
    }

    function playRain(c, dest){
      var noise = c.createBufferSource();
      noise.buffer = makeNoiseBuffer(c, 4);
      noise.loop = true;
      var filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800; // a steady hiss-y patter, no swell -- rain doesn't breathe like waves do
      var gain = c.createGain();
      gain.gain.value = 0.22;
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      noise.start();
      nodes.push(noise, filter, gain);
    }

    function playHum(c, dest){
      var o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 68;
      var o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 71; // slightly detuned -> a slow warm "beat"
      var gain = c.createGain(); gain.gain.value = 0.22;
      var lfo = c.createOscillator(); lfo.frequency.value = 0.08;
      var lfoGain = c.createGain(); lfoGain.gain.value = 0.10;
      lfo.connect(lfoGain); lfoGain.connect(gain.gain);
      o1.connect(gain); o2.connect(gain); gain.connect(dest);
      o1.start(); o2.start(); lfo.start();
      nodes.push(o1, o2, gain, lfo, lfoGain);
      // Occasional random "bubble" blips rising up through the deep hum.
      function bubble(){
        burst(c, dest, 260 + Math.random()*160, 0.18, 'sine', 0.10);
        timers.push(setTimeout(bubble, 900 + Math.random()*1600));
      }
      timers.push(setTimeout(bubble, 700));
    }

    function playBouncyTune(c, dest){
      // A short, catchy, very repetitive 4-note loop -- the "children's-song" feel the tune is for.
      loopNotes(c, dest, [
        { freq:523, dur:0.26, type:'triangle', gain:0.5 },
        { freq:659, dur:0.26, type:'triangle', gain:0.5 },
        { freq:784, dur:0.26, type:'triangle', gain:0.5 },
        { freq:659, dur:0.26, type:'triangle', gain:0.5 }
      ]);
    }

    function playChimes(c, dest){
      // Sparser, higher, bell-like -- sine tones with rests, so it reads as chimes rather than a tune.
      loopNotes(c, dest, [
        { freq:1568, dur:0.55, type:'sine', gain:0.28 },
        { freq:0,    dur:0.30 },
        { freq:1047, dur:0.55, type:'sine', gain:0.26 },
        { freq:0,    dur:0.30 },
        { freq:1319, dur:0.55, type:'sine', gain:0.27 },
        { freq:0,    dur:0.45 }
      ]);
    }

    function playPop(c, dest){
      // Bouncy, syncopated "pop" blips -- square-ish and playful, a bit bubblier than the chimes.
      loopNotes(c, dest, [
        { freq:392, dur:0.18, type:'square', gain:0.22 },
        { freq:0,   dur:0.10 },
        { freq:587, dur:0.16, type:'square', gain:0.22 },
        { freq:784, dur:0.20, type:'square', gain:0.24 },
        { freq:0,   dur:0.14 },
        { freq:523, dur:0.18, type:'square', gain:0.22 }
      ]);
    }

    function clearTimers(){
      timers.forEach(function(id){ clearTimeout(id); });
      timers = [];
    }

    function stop(){
      clearTimers();
      var oldMaster = master, oldNodes = nodes;
      master = null; nodes = []; currentId = null;
      if(!oldMaster) return;
      try {
        var c = Sound.getCtx();
        var now = c ? c.currentTime : 0;
        oldMaster.gain.cancelScheduledValues(now);
        oldMaster.gain.setValueAtTime(oldMaster.gain.value, now);
        oldMaster.gain.linearRampToValueAtTime(0.0001, now + 0.15); // quick fade -- avoids a click on stop
      } catch(e){}
      setTimeout(function(){
        oldNodes.forEach(function(n){ try{ n.stop && n.stop(); }catch(e){} try{ n.disconnect && n.disconnect(); }catch(e){} });
        try { oldMaster.disconnect(); } catch(e){}
      }, 200);
    }

    function play(id){
      var track = SOUND_TRACKS.filter(function(t){ return t.id === id; })[0];
      if(!track) return;
      stop();
      var c = Sound.getCtx();
      if(!c) return;
      master = c.createGain();
      master.gain.value = 0.0001;
      master.connect(c.destination);
      master.gain.linearRampToValueAtTime(1, c.currentTime + 0.5);
      nodes = [];
      currentId = id;
      if(track.kind === 'noise-waves') playWaves(c, master);
      else if(track.kind === 'noise-rain') playRain(c, master);
      else if(track.kind === 'noise-hum') playHum(c, master);
      else if(track.kind === 'music-bouncy') playBouncyTune(c, master);
      else if(track.kind === 'music-chimes') playChimes(c, master);
      else if(track.kind === 'music-pop') playPop(c, master);
    }

    return { play: play, stop: stop, current: function(){ return currentId; } };
  })();

