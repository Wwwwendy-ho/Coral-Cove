  /* ============ store adapter (db capability, with in-memory fallback) ============ */
  // A save/delete that fails against the live db capability used to fail SILENTLY -- the edit/trash
  // buttons in the deck editor looked like they "just didn't work" because nothing told the grown-up
  // anything went wrong. Every live write below is now wrapped with reportStoreError() so a failure
  // surfaces as a small dismissible banner instead of doing nothing.
  function reportStoreError(action){
    return function(err){
      console.error('[Coral Cove] '+action+' failed', err);
      S.storeError = (action.charAt(0).toUpperCase()+action.slice(1)) + ' didn\'t save. Check your connection and try again.';
      render();
      throw err;
    };
  }

  var store = (function(){
    // Profiles are top-level; everything else (decks/cards/stats/settings/session/history/badges) is
    // scoped under 'profiles/<id>/...' so each profile has its own fully separate deck library and
    // progress. `pid` is the currently active profile -- set once via setActiveProfile() whenever a
    // profile is entered, then read by every scoped method below at call time (not bound in a closure),
    // so switching profiles mid-session (after a full sign-out through the picker) just works.
    var mem = { profiles: [], profileListeners: [], pinHash: null, byProfile: {}, nextId: 1 };
    var db = null;
    var live = false;
    var pid = null;

    function memId(){ return 'local-' + (mem.nextId++); }
    function notifyProfiles(){ mem.profileListeners.forEach(function(cb){ cb(mem.profiles.slice()); }); }
    function ensureProfileMem(id){
      if(!mem.byProfile[id]) mem.byProfile[id] = {
        decks: [], cards: {}, deckListeners: [], cardListeners: {},
        stats: { streak:0, stars:0, lastReviewDateISO:null, totalReviews:0, unlockedSounds:[] },
        settings: { sessionActive:false, sessionStartedAt:null, algorithm:'sm2_speed', difficulty:'medium' },
        sessionTally: null, history: [], badges: {}
      };
      return mem.byProfile[id];
    }
    function notifyDecks(m){ m.deckListeners.forEach(function(cb){ cb(m.decks.slice()); }); }
    function notifyCards(m, deckId){ (m.cardListeners[deckId]||[]).forEach(function(cb){ cb((m.cards[deckId]||[]).slice()); }); }

    function api(){
      return {
        live: live,
        setActiveProfile: function(id){ pid = id; },
        /* ---------- profiles (top-level, never profile-scoped) ---------- */
        listenProfiles: function(cb){
          if(live){
            return db.collection('profiles').orderBy('order','asc').onSnapshot(function(snap){
              cb(snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }));
            }, function(err){
              console.error('[Coral Cove] profile sync lost', err);
              S.storeError = 'Lost connection while syncing profiles — please reload the page.';
              render();
            });
          }
          mem.profileListeners.push(cb);
          cb(mem.profiles.slice());
          return function(){ mem.profileListeners = mem.profileListeners.filter(function(x){ return x!==cb; }); };
        },
        addProfile: function(data){
          data = Object.assign({ createdAt: Date.now() }, data);
          if(live) return db.collection('profiles').add(data).then(function(ref){ return ref.id; }).catch(reportStoreError('create profile'));
          var id = memId();
          mem.profiles.push(Object.assign({id:id}, data));
          notifyProfiles();
          return Promise.resolve(id);
        },
        updateProfile: function(id, data){
          if(live) return db.collection('profiles').doc(id).update(data).catch(reportStoreError('save profile'));
          var p = mem.profiles.find(function(x){ return x.id===id; });
          if(p) Object.assign(p, data);
          notifyProfiles();
          return Promise.resolve();
        },
        // Cascades through every scoped collection/doc a profile owns before removing the profile
        // doc itself -- there's no server-side recursive delete here, so each piece is enumerated
        // and removed by hand. Best-effort on the scoped docs (a doc that was never created is fine
        // to "fail" deleting); the deck/card sweep and the final profile-doc delete report errors.
        deleteProfile: function(id){
          if(live){
            var base = 'profiles/'+id;
            function safeDoc(path){ return db.doc(path).delete().catch(function(){}); }
            return db.collection(base+'/decks').get().then(function(snap){
              return Promise.all(snap.docs.map(function(d){
                var deckId = d.id;
                var cardsPath = base+'/decks/'+deckId+'/cards';
                return db.collection(cardsPath).get().then(function(cardSnap){
                  return Promise.all(cardSnap.docs.map(function(c){ return db.collection(cardsPath).doc(c.id).delete(); }));
                }).then(function(){ return db.collection(base+'/decks').doc(deckId).delete(); });
              }));
            }).then(function(){
              return db.collection(base+'/history').get().then(function(snap){
                return Promise.all(snap.docs.map(function(d){ return db.collection(base+'/history').doc(d.id).delete(); }));
              });
            }).then(function(){
              return Promise.all([ safeDoc(base+'/stats/summary'), safeDoc(base+'/settings/study'), safeDoc(base+'/session/current'), safeDoc(base+'/badges/summary'), safeDoc(base+'/settings/plan'), safeDoc(base+'/settings/wordbank') ]);
            }).then(function(){
              return db.collection(base+'/plan').get().then(function(snap){ return Promise.all(snap.docs.map(function(d){ return db.collection(base+'/plan').doc(d.id).delete().catch(function(){}); })); }).catch(function(){});
            }).then(function(){
              return db.collection('profiles').doc(id).delete();
            }).catch(reportStoreError('delete profile'));
          }
          mem.profiles = mem.profiles.filter(function(x){ return x.id!==id; });
          delete mem.byProfile[id];
          notifyProfiles();
          return Promise.resolve();
        },
        // cove: read-only export of everything stored for one profile ("Download my data").
        exportProfile: function(id){
          var strip = function(o){ if(o && typeof o === 'object'){ o = JSON.parse(JSON.stringify(o)); if(!Array.isArray(o)) delete o.pinHash; } return o; };
          if(live){
            var base = 'profiles/'+id;
            var docData = function(path){ return db.doc(path).get().then(function(sn){ return sn.exists ? strip(sn.data()) : null; }).catch(function(){ return null; }); };
            var colData = function(path){ return db.collection(path).get().then(function(sn){ return sn.docs.map(function(d){ return Object.assign({ id:d.id }, strip(d.data())); }); }).catch(function(){ return []; }); };
            return Promise.all([ docData('profiles/'+id), colData(base+'/decks'), colData(base+'/history'), docData(base+'/stats/summary'), docData(base+'/settings/study'), docData(base+'/settings/plan'), docData(base+'/session/current'), docData(base+'/badges/summary'), colData(base+'/plan'), docData(base+'/settings/wordbank') ]).then(function(r){
              return Promise.all(r[1].map(function(deck){ return colData(base+'/decks/'+deck.id+'/cards').then(function(cards){ return Object.assign({}, deck, { cards: cards }); }); })).then(function(decks){
                return { profile: r[0], decks: decks, history: r[2], stats: r[3], studySettings: r[4], planSettings: r[5], session: r[6], badges: r[7], dailyPlans: r[8], wordBank: r[9] };
              });
            });
          }
          var m = mem.byProfile[id] || {};
          var prof = mem.profiles.find(function(x){ return x.id === id; }) || null;
          return Promise.resolve({ profile: strip(prof), decks: (m.decks||[]).map(function(d){ return Object.assign({}, strip(d), { cards: strip((m.cards||{})[d.id]||[]) }); }), history: strip(m.history||[]), stats: strip(m.stats||null), studySettings: strip(m.settings||null), badges: strip(m.badges||null) });
        },
        /* ---------- app-wide grown-up check setting (not per-profile). It used to hold the PIN's hash; it now
           holds the placeholder 'maths-question' (BAKED_PIN_HASH), kept so saved data stays compatible. ---------- */
        getPin: function(){
          if(live) return db.doc('settings/pin').get().then(function(snap){ return snap.exists ? (snap.data().pinHash||null) : null; });
          return Promise.resolve(mem.pinHash);
        },
        setPin: function(hash){
          if(live) return db.doc('settings/pin').set({ pinHash: hash });
          mem.pinHash = hash;
          return Promise.resolve();
        },
        /* ---------- everything below is scoped to the active profile (pid) ---------- */
        listenDecks: function(cb){
          var scope = pid;
          if(live){
            return db.collection('profiles/'+scope+'/decks').orderBy('order','asc').onSnapshot(function(snap){
              cb(snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }));
            }, function(err){
              // onSnapshot errors are terminal -- this listener is now dead and will never fire again.
              // Falling back to the (always-empty, in live mode) in-memory store used to silently wipe
              // every deck from the screen. Keep whatever was last shown instead, and tell the grown-up.
              console.error('[Coral Cove] deck sync lost', err);
              S.storeError = 'Lost connection while syncing your decks — please reload the page.';
              render();
            });
          }
          var m = ensureProfileMem(scope);
          m.deckListeners.push(cb);
          cb(m.decks.slice());
          return function(){ m.deckListeners = m.deckListeners.filter(function(x){ return x!==cb; }); };
        },
        addDeck: function(data){
          data = Object.assign({ createdAt: Date.now() }, data);
          if(live) return db.collection('profiles/'+pid+'/decks').add(data).then(function(ref){ return ref.id; }).catch(reportStoreError('create deck'));
          var m = ensureProfileMem(pid);
          var id = memId();
          m.decks.push(Object.assign({id:id}, data));
          m.cards[id] = [];
          notifyDecks(m);
          return Promise.resolve(id);
        },
        updateDeck: function(id, data){
          if(live) return db.collection('profiles/'+pid+'/decks').doc(id).update(data).catch(reportStoreError('save deck'));
          var m = ensureProfileMem(pid);
          var d = m.decks.find(function(x){ return x.id===id; });
          if(d) Object.assign(d, data);
          notifyDecks(m);
          return Promise.resolve();
        },
        deleteDeck: function(id){
          if(live){
            var cardsPath = 'profiles/'+pid+'/decks/'+id+'/cards';
            return db.collection(cardsPath).get().then(function(snap){
              return Promise.all(snap.docs.map(function(d){ return d.ref ? d.ref.delete() : db.collection(cardsPath).doc(d.id).delete(); }));
            }).then(function(){ return db.collection('profiles/'+pid+'/decks').doc(id).delete(); }).catch(reportStoreError('delete deck'));
          }
          var m = ensureProfileMem(pid);
          m.decks = m.decks.filter(function(x){ return x.id!==id; });
          delete m.cards[id];
          notifyDecks(m);
          return Promise.resolve();
        },
        getCardsOnce: function(deckId){
          if(live){
            return db.collection('profiles/'+pid+'/decks/'+deckId+'/cards').get().then(function(snap){
              return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
            });
          }
          return Promise.resolve((ensureProfileMem(pid).cards[deckId]||[]).slice());
        },
        listenCards: function(deckId, cb){
          var scope = pid;
          if(live){
            return db.collection('profiles/'+scope+'/decks/'+deckId+'/cards').onSnapshot(function(snap){
              cb(snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }));
            }, function(err){
              // Same terminal-error issue as listenDecks above: don't blank the real card list with
              // an always-empty in-memory fallback -- keep showing the last-known cards and surface it.
              console.error('[Coral Cove] card sync lost', err);
              S.storeError = 'Lost connection while syncing this deck\'s cards — please reload the page.';
              render();
            });
          }
          var m = ensureProfileMem(scope);
          if(!m.cardListeners[deckId]) m.cardListeners[deckId] = [];
          m.cardListeners[deckId].push(cb);
          cb((m.cards[deckId]||[]).slice());
          return function(){ m.cardListeners[deckId] = (m.cardListeners[deckId]||[]).filter(function(x){ return x!==cb; }); };
        },
        addCard: function(deckId, data){
          data = Object.assign({ due: Date.now(), interval:0, ease:2.5, reps:0, lapses:0, state:'new', learningStep:0, createdAt: Date.now() }, data);
          if(live) return db.collection('profiles/'+pid+'/decks/'+deckId+'/cards').add(data).catch(reportStoreError('save card'));
          var m = ensureProfileMem(pid);
          var id = memId();
          if(!m.cards[deckId]) m.cards[deckId] = [];
          m.cards[deckId].push(Object.assign({id:id}, data));
          notifyCards(m, deckId);
          return Promise.resolve();
        },
        updateCard: function(deckId, cardId, data){
          if(live) return db.collection('profiles/'+pid+'/decks/'+deckId+'/cards').doc(cardId).update(data).catch(reportStoreError('save card'));
          var m = ensureProfileMem(pid);
          var arr = m.cards[deckId]||[];
          var c = arr.find(function(x){ return x.id===cardId; });
          if(c) Object.assign(c, data);
          notifyCards(m, deckId);
          return Promise.resolve();
        },
        deleteCard: function(deckId, cardId){
          if(live) return db.collection('profiles/'+pid+'/decks/'+deckId+'/cards').doc(cardId).delete().catch(reportStoreError('delete card'));
          var m = ensureProfileMem(pid);
          m.cards[deckId] = (m.cards[deckId]||[]).filter(function(x){ return x.id!==cardId; });
          notifyCards(m, deckId);
          return Promise.resolve();
        },
        getStats: function(){
          if(live) return db.doc('profiles/'+pid+'/stats/summary').get().then(function(snap){
            return snap.exists ? snap.data() : { streak:0, stars:0, lastReviewDateISO:null, totalReviews:0, unlockedSounds:[] };
          });
          return Promise.resolve(Object.assign({}, ensureProfileMem(pid).stats));
        },
        setStats: function(data){
          if(live) return db.doc('profiles/'+pid+'/stats/summary').set(data);
          ensureProfileMem(pid).stats = Object.assign({}, data);
          return Promise.resolve();
        },
        getSettings: function(){
          if(live) return db.doc('profiles/'+pid+'/settings/study').get().then(function(snap){
            return snap.exists ? snap.data() : { sessionActive:false, sessionStartedAt:null, algorithm:'sm2_speed', difficulty:'medium' };
          });
          return Promise.resolve(Object.assign({}, ensureProfileMem(pid).settings));
        },
        setSettings: function(data){
          if(live) return db.doc('profiles/'+pid+'/settings/study').set(data);
          ensureProfileMem(pid).settings = Object.assign({}, data);
          return Promise.resolve();
        },
        getSessionTally: function(){
          if(live) return db.doc('profiles/'+pid+'/session/current').get().then(function(snap){
            return snap.exists ? snap.data() : null;
          });
          var t = ensureProfileMem(pid).sessionTally;
          return Promise.resolve(t ? Object.assign({}, t) : null);
        },
        setSessionTally: function(data){
          if(live) return db.doc('profiles/'+pid+'/session/current').set(data);
          ensureProfileMem(pid).sessionTally = Object.assign({}, data);
          return Promise.resolve();
        },
        // A permanent, append-only log of finished study rounds — this is what powers the
        // overall Stats page's trend chart. Never overwritten, unlike sessionTally above.
        addHistoryEntry: function(data){
          data = Object.assign({ endedAt: Date.now() }, data);
          if(live) return db.collection('profiles/'+pid+'/history').add(data);
          var m = ensureProfileMem(pid);
          var id = memId();
          m.history.push(Object.assign({id:id}, data));
          return Promise.resolve();
        },
        getHistoryOnce: function(){
          if(live) return db.collection('profiles/'+pid+'/history').get().then(function(snap){
            return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
          });
          return Promise.resolve(ensureProfileMem(pid).history.slice());
        },
        // Badge gallery -- a single doc per profile mapping badgeId -> earnedAt (ms timestamp).
        // Absent/false-y entries just mean "not earned yet", so the doc only ever grows.
        getBadges: function(){
          if(live) return db.doc('profiles/'+pid+'/badges/summary').get().then(function(snap){
            return snap.exists ? snap.data() : {};
          });
          return Promise.resolve(Object.assign({}, ensureProfileMem(pid).badges));
        },
        getPlanSettings: function(){
          if(live) return db.doc('profiles/'+pid+'/settings/plan').get().then(function(snap){ return snap.exists ? snap.data() : null; });
          return Promise.resolve(ensureProfileMem(pid).planSettings || null);
        },
        setPlanSettings: function(data){
          if(live) return db.doc('profiles/'+pid+'/settings/plan').set(data).catch(reportStoreError('save the schedule'));
          ensureProfileMem(pid).planSettings = Object.assign({}, data);
          return Promise.resolve();
        },
        getPlanDay: function(date){
          if(live) return db.doc('profiles/'+pid+'/plan/'+date).get().then(function(snap){ return snap.exists ? snap.data() : null; });
          var m = ensureProfileMem(pid); return Promise.resolve(m.planDays && m.planDays[date] ? JSON.parse(JSON.stringify(m.planDays[date])) : null);
        },
        setPlanDay: function(date, data){
          var clean = JSON.parse(JSON.stringify(data));
          if(live) return db.doc('profiles/'+pid+'/plan/'+date).set(clean).catch(reportStoreError('save today\'s plan'));
          var m = ensureProfileMem(pid); m.planDays = m.planDays || {}; m.planDays[date] = clean;
          return Promise.resolve();
        },
        listPlanDays: function(){
          if(live) return db.collection('profiles/'+pid+'/plan').get().then(function(snap){
            return snap.docs.map(function(d){ return Object.assign({ date: d.id }, d.data()); });
          });
          var m = ensureProfileMem(pid); return Promise.resolve(Object.keys(m.planDays || {}).map(function(k){ return m.planDays[k]; }));
        },
        // Word Bank: the learner's own "I know this" / "start over" choices per word, on top of what
        // the cards' review history says. { marks: { <word key>: 'known' | 'new' } }
        getWordBank: function(){
          if(live) return db.doc('profiles/'+pid+'/settings/wordbank').get().then(function(snap){ return snap.exists ? snap.data() : null; });
          return Promise.resolve(ensureProfileMem(pid).wordBank || null);
        },
        setWordBank: function(data){
          var clean = JSON.parse(JSON.stringify(data));
          if(live) return db.doc('profiles/'+pid+'/settings/wordbank').set(clean).catch(reportStoreError('save the Word Bank'));
          ensureProfileMem(pid).wordBank = clean;
          return Promise.resolve();
        },
        setBadges: function(data){
          if(live) return db.doc('profiles/'+pid+'/badges/summary').set(data);
          ensureProfileMem(pid).badges = Object.assign({}, data);
          return Promise.resolve();
        }
      };
    }

    return {
      init: function(){
        if(!(window.claude && window.claude.use)) return Promise.resolve(api());
        return window.claude.use('db').then(function(handle){
          if(handle){ db = handle; live = true; }
          return api();
        }).catch(function(){ return api(); });
      }
    };
  })();

  /* ============ photo uploads (assets capability) ============ */
  // Only available inside the live published app (claude.ai) -- the offline export and any old
  // in-memory "try it out" preview never get a handle here, so photo upload is hidden there and
  // existing photos still just display fine (they're plain https image URLs once uploaded).
  var Assets = (function(){
    var handle = null;
    return {
      init: function(){
        if(!(window.claude && window.claude.use)) return Promise.resolve(null);
        return window.claude.use('assets').then(function(h){ handle = h; return h; }).catch(function(){ handle = null; return null; });
      },
      available: function(){ return !!handle; },
      upload: function(blob){ return handle ? handle.upload(blob) : Promise.reject(new Error('Photo uploads are only available in the live app.')); },
      remove: function(id){
        if(!handle || !id) return Promise.resolve();
        // Best-effort: an old/abandoned photo failing to delete just leaves a harmless orphan in
        // the artifact's asset storage -- never worth surfacing an error banner for.
        return handle.delete(id).catch(function(err){ console.warn('[Coral Cove] could not delete photo asset', err); });
      }
    };
  })();

  // Shrinks a photo to a reasonable size before upload (most phone photos are far larger than a
  // flashcard ever needs to display). Images already smaller than the cap are uploaded untouched.
  // PNG stays PNG (keeps transparency); anything else becomes a JPEG to keep storage/light.
  function downscalePhoto(file, maxDim){
    return new Promise(function(resolve){
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function(){
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if(!w || !h || Math.max(w, h) <= maxDim){ resolve(file); return; }
        var scale = maxDim / Math.max(w, h);
        var outW = Math.max(1, Math.round(w*scale)), outH = Math.max(1, Math.round(h*scale));
        var canvas = document.createElement('canvas');
        canvas.width = outW; canvas.height = outH;
        var ctx = canvas.getContext('2d');
        if(!ctx){ resolve(file); return; }
        ctx.drawImage(img, 0, 0, outW, outH);
        var outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(function(blob){ resolve(blob || file); }, outType, 0.85);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* ============ app state ============ */
  var S = {
    store: null,
    view: 'home',
    decks: [],
    dueCounts: {},
    currentDeckId: null,
    stats: { streak:0, stars:0, lastReviewDateISO:null, totalReviews:0, unlockedSounds:[] },
    studyQueue: [],
    studyTotal: 0,
    sessionReviewed: 0,
    sessionStars: 0,
    roundTally: null,
    unsubDecks: null,
    unsubCards: null,
    emojiPickerOpen: false,
    addCardOpen: false,
    choiceState: null,
    dragState: null,        // { cardId, options, dropped, correct } -- 'match'/'blank' mode's drag-to-answer state, parallel to choiceState above
    timedChoiceState: null, // { cardId, direction, prompt, answer, options, selected, totalSeconds, deadline, secondsAdded, expired } -- 'timedchoice' mode's per-card round state
    timedChoiceAllCards: [], // every card in the deck currently being studied, used to source cross-card distractor options for 'timedchoice' mode when a card has no manual `choices` of its own
    timedChoiceDirection: null, // 'fwd' (front shown as the question, back-side text as the answer/options) | 'rev' (back shown as the question, front-side text as the answer/options) -- re-rolled every TIMED_CHOICE_GROUP_SIZE cards
    timedChoiceGroupLeft: 0, // cards left in the current direction "streak" before the next reroll
    timedChoiceTimerHandle: null, // setInterval id driving the on-screen countdown bar for 'timedchoice' mode
    equationTickHandle: null, // setInterval id driving the clock-tick sound during Equation Feed's answer-reveal wait
    listenState: null, // { cardId, answer, options, selected, slow } -- 'listen' (Listen & Pick) mode's per-card state
    msPanels: [],            // ordered cards for the current Mini Story (S.view === 'miniStory')
    msGen: null,
    planDay: null, planRun: null, planSettings: null, planLoading: false, planViewDate: null, planViewDay: null, planSettingsOpen: false, planMonth: null, planMonthData: null,             // set while showing a Story Maker story (not a saved deck): {title, lang, words, used, saved}
    msIndex: 0,              // unbounded, wrapped at render time; one extra "The end" page follows the last card
    msShowTr: false,         // true while the current Mini Story page is showing its translation
    msSpokenKey: null,       // the page last read aloud on arrival, so a re-render doesn't read it twice
    blendState: null, // { cardId, chunks, pct, revealedCount, done } -- 'blend' mode's per-card sound-out-slider state
    feedQueue: [],           // shuffled card list for the current Word Feed session (S.view === 'feed')
    feedIndex: 0,            // unbounded, wrapped with modulo at render time so swiping loops forever
    feedLastSpokenId: null,  // the card id last spoken aloud, so a re-render doesn't repeat the same word
    storyQueue: [],          // ordered { id, front } word tokens for the current Story Mode session (S.view === 'story')
    storyIndex: 0,           // unbounded, wrapped with modulo at render time so swiping loops back to the start
    storyLastSpokenId: null, // the token id last spoken aloud, so a re-render doesn't repeat the same word
    equationQueue: [],       // shuffled card list for the current Equation Feed session (S.view === 'equationFeed')
    equationIndex: 0,        // unbounded, wrapped with modulo at render time, same as feedIndex/storyIndex above
    equationSettledId: null, // the card id the reveal timer is currently scheduled/fired for, so a re-render doesn't restart it
    equationRevealed: false, // true once the current card's answer has been spoken + bounced onto the screen
    langQueue: [],           // shuffled queue of the currently-unlocked cards for Language Feed (S.view === 'langFeed')
    langIndex: 0,            // unbounded, wrapped with modulo at render time, same as feedIndex/equationIndex above
    langSettledId: null,     // the card id the reveal timer is currently scheduled/fired for, so a re-render doesn't restart it
    langRevealed: false,     // true once the current card's translation has faded in
    langSeenIds: null,       // Set of card ids seen at least once THIS SESSION, used only to decide when to unlock the next batch -- reset every startLangFeed(), never persisted
    langSorted: [],          // every card in the deck, sorted by its `order` field, oldest/introduced-first -- the full pool batches are drawn from
    langUnlockedCount: 0,    // mirrors deck.langUnlockedCount for the active session; bumped (and persisted back) as batches unlock
    langBatchSize: 5,        // mirrors deck.langBatchSize for the active session
    langTotalCards: 0,       // langSorted.length, cached for convenience
    langJustUnlocked: false, // true for one render right after a new batch unlocks, to show the little toast
    flashQueue: [],          // card list for the current Flash Feed session (S.view === 'flashFeed')
    flashIndex: 0,           // unbounded, wrapped with modulo at render time so swiping loops forever
    flashFlipped: false,     // true while the current Flash Feed card is showing its back (formula) side
    flashOrdered: false,     // false = shuffled (default), true = the deck's own creation order -- session-only
    flashCards: [],          // the deck's cards as loaded, so the shuffle/in-order toggle can rebuild the queue
    passageSentences: [],    // ordered sentence strings reconstructed for the current Read-Along session (S.view === 'readAlong')
    passageHighlightId: null,// the currently lit passage-word span's id, or null -- session-only, never persisted
    feedSoundId: null,       // the ambient sound/music track currently playing over Word Feed, or null for none -- session-only, never persisted (so the feed always opens quiet, not autoplaying whatever was picked last time)
    soundPickerOpen: false,  // true while the Word Feed sound-shop panel is showing
    soundBuyError: null,     // a locked track's id, briefly, right after tapping it without enough stars -- drives that one tile's shake
    currentCardId: null,
    cardShownAt: null,
    cardFlippedAt: null,
    settings: { sessionActive:false, sessionStartedAt:null, algorithm:'sm2_speed', difficulty:'medium', readingSupport:false },
    profiles: [],           // every profile's top-level metadata (name/mode/photo/order), loaded once at boot
    unsubProfiles: null,
    activeProfileId: null,  // null = showing the profile picker; otherwise the id of the profile in use
    profile: null,          // the active profile's own record (kept in sync with S.profiles)
    profileLoading: false,  // true for the brief window between choosing a profile and its data arriving
    managingProfiles: false,// true while the PIN-unlocked "add/remove profiles" screen is showing
    creatingProfile: false, // true while the new-profile form is showing
    newProfileDraft: null,  // { name, mode, photoId, photoUrl } while creatingProfile is true
    profilePhotoUploading: false, // true while a picked profile photo is being downscaled + uploaded
    pendingModeSwitch: null,// the mode a child-initial profile is about to switch to, once its PIN clears
    badges: {},             // { badgeId: earnedAtMs } for the active profile, loaded on enterProfile
    justEarnedBadges: [],   // badge ids earned by the round just finished, so the summary screen can celebrate them
    sessionActive: false,
    sessionTally: null,
    finishedTally: null,
    managingDecks: false,   // true only while a grown-up has unlocked deck management from the resting screen
    editMode: false,        // true while the Live/Archived + deck-editing controls are showing -- Adult
                             // Mode can flip this on freely; Child Mode has to clear the PIN first
    deckFilter: 'all',      // 'all' | 'live' | 'archived' -- which decks the Manage Decks grid shows
    subjectFilter: 'all',   // 'all' | a subject id/custom string -- which subject tab is selected on the deck grid
    statsData: null,        // lazily loaded { perDeck, history } for the Stats page
    statsDeckId: null,      // set while viewing the per-deck drill-down (S.view === 'deckStats')
    lastOutcomeWrong: false, // briefly true right after a wrong answer, so the swim-progress critter can frown
    transitioning: false,   // true for the brief window a card is sliding out — locks input until the next card lands
    peeking: false,         // true while showing the read-only "last answered card" view (swiped back to review it)
    lastAnsweredCard: null, // { front, back, note, mode, correct, rating, choiceOptions, chosenText } for the ONE card behind the current one — replaced every time a new card is answered
    critterPrevPct: 0,      // progress % the critter bar last visually landed on — renderStudy() starts the bar there and animates to the new %, since a fresh app.innerHTML render can't transition on its own
    pinPromptFor: null,     // which grown-up check is on screen: null | 'enterAdult' | 'start' | 'end' | 'edit' | 'exit' | 'switch' | 'manageProfiles' | 'modeSwitch'
    pendingEdit: null,
    booted: false,
    storeError: null,      // set when a live save/sync fails, so the grown-up sees WHY a button seemed to do nothing
    assetsAvailable: false, // true once the `assets` capability resolves -- gates the photo-upload UI
    photoUploading: false,  // true while a picked photo is being downscaled + uploaded
    cardFormOriginalPhotoId: '' // the photoId the card had (or '') when the current add/edit form opened --
                                 // lets Save/Cancel know which photo, if any, is now an orphan to clean up
    // No "PIN setup" and no "unlock once per visit" flag anymore -- a grown-up times question (reefGrownUpGate) stands in for a PIN, and
    // Adult Mode (Manage Decks / Settings / Progress) never asks for it at all. Only Child Mode --
    // starting a session, ending one, and the mid-round "leave this deck?" guard -- ever prompts,
    // and it prompts every single time on purpose, since that's the one thing the PIN is for now.
  };

  function defaultTally(){
    return { startedAt: Date.now(), endedAt: null, reviewedCount: 0, starsEarned: 0, again: 0, hard: 0, good: 0, easy: 0, decksStudied: [] };
  }

  var DECK_EMOJI = ['🐢','🐬','🐳','🦀','🐠','🦈','🦞','🐙','🌊','🐚','🦑','⭐'];

  // Preset subjects a deck can be tagged with, shown as chips in the deck editor and as tabs on the
  // deck grid. A deck can also carry a custom subject (any typed text) instead of one of these ids --
  // subjectMeta() below resolves either kind to a display icon+label.
  var SUBJECTS = [
    { id:'reading', icon:'📖', label:'Reading' },
    { id:'math', icon:'➗', label:'Math' },
    { id:'korean', icon:'🇰🇷', label:'Korean' },
    { id:'science', icon:'🔬', label:'Science' },
    { id:'life', icon:'🌱', label:'Life Skills' },
    { id:'other', icon:'✨', label:'Other' }
  ];
  function subjectMeta(subject){
    if(!subject) return null;
    var preset = SUBJECTS.find(function(s){ return s.id === subject; });
    if(preset) return preset;
    return { id: subject, icon:'🏷️', label: subject }; // a parent-typed custom subject: the text IS the id
  }
  // Builds the tab list for whichever deck set is currently in view (kid home or Manage Decks, and
  // already narrowed by the Live/Archived filter there). Returns null when nothing is tagged yet, so
  // the tab row stays hidden until a parent actually starts using subjects -- no empty-looking UI.
  function buildSubjectTabs(decks){
    var present = {}, anyTagged = false;
    decks.forEach(function(d){
      var meta = d.subject ? subjectMeta(d.subject) : subjectMeta('other'); // untagged decks live under "Other"
      if(d.subject) anyTagged = true;
      if(!present[meta.id]) present[meta.id] = { id: meta.id, icon: meta.icon, label: meta.label, count: 0 };
      present[meta.id].count += 1;
    });
    var ids = Object.keys(present);
    if(!ids.length || !anyTagged) return null;
    var presetOrder = SUBJECTS.map(function(s){ return s.id; });
    ids.sort(function(a,b){
      var ai = presetOrder.indexOf(a), bi = presetOrder.indexOf(b);
      if(ai !== -1 && bi !== -1) return ai - bi;
      if(ai !== -1) return -1;
      if(bi !== -1) return 1;
      return present[a].label.localeCompare(present[b].label);
    });
    return ids.map(function(id){ return present[id]; });
  }

  // Reading-support accommodation (Settings toggle): wider letter/word spacing and a larger base
  // font, driven entirely by CSS via this one class -- deliberately NOT a dyslexia-specific font
  // swap (OpenDyslexic/Dyslexie aren't backed by controlled research; plain legible fonts plus
  // generous spacing and text-to-speech are). Called once on boot/profile-enter and again any time
  // S.settings.readingSupport changes.
  function applyReadingSupport(){
    document.body.classList.toggle('reading-support', !!(S.settings && S.settings.readingSupport));
  }

  // The streak shown anywhere: the stored streak only counts if she last studied today or yesterday;
  // after a longer gap the current streak is 0 until she studies again (stored history is untouched).
  function currentStreak(st){
    st = st || S.stats || {};
    var last = st.lastReviewDateISO;
    if(!last) return 0;
    var y = new Date(); y.setDate(y.getDate()-1);
    return (last === todayISO() || last === todayISO(y)) ? (st.streak || 0) : 0;
  }
  var WRONG_EXTRA_MS = 1600; // extra time to read the right answer before auto-advancing after a miss
  function gentleMiss(lead, answer){ return gentleMissBase(lead, answer) + (reefGame() ? reefTip(answer) : ''); }
  function gentleMissBase(lead, answer){ return lead + ' It\'s <b class="its-answer">' + esc(answer) + '</b>' + (/[.!?。]\s*$/.test(String(answer||'')) ? '' : '.'); } // no doubled full stop when the answer is already a sentence
  function todayISO(d){ d = d || new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

  // Coral Cove's button icons: rounded line drawings with a soft fill in the button's own colour, so each one reads
  // the same in day and night. ccIcon('sound') -> an <svg> to put inside a button (the button keeps its aria-label).
  var CC_ICONS = {"close": "<path d=\"M6.5 6.5l11 11M17.5 6.5l-11 11\"/>", "check": "<path class=\"f\" d=\"M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 0 0 0-19z\"/><path d=\"M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 0 0 0-19z\"/><path d=\"M7.5 12.3l3 3L16.8 9\"/>", "sound": "<path class=\"f\" d=\"M4 9.5h3.5L12 5v14l-4.5-4.5H4z\"/><path d=\"M4 9.5h3.5L12 5v14l-4.5-4.5H4z\"/><path d=\"M15.5 9a4 4 0 0 1 0 6M18.2 6.4a7.6 7.6 0 0 1 0 11.2\"/>", "sound-off": "<path class=\"f\" d=\"M4 9.5h3.5L12 5v14l-4.5-4.5H4z\"/><path d=\"M4 9.5h3.5L12 5v14l-4.5-4.5H4z\"/><path d=\"M16 9.5l5 5M21 9.5l-5 5\"/>", "profiles": "<circle class=\"f\" cx=\"9\" cy=\"8\" r=\"3.3\"/><circle cx=\"9\" cy=\"8\" r=\"3.3\"/><path d=\"M3 19.5c.7-3.3 3-5.2 6-5.2s5.3 1.9 6 5.2\"/><path d=\"M15.2 4.9a3.3 3.3 0 0 1 0 6.3M17.4 14.6c1.8.8 3.1 2.5 3.6 4.9\"/>", "flag": "<path d=\"M5 21.5V3.5\"/><path class=\"f\" d=\"M5 4h14l-2.8 4.5L19 13H5z\"/><path d=\"M5 4h14l-2.8 4.5L19 13H5z\"/><path class=\"d\" d=\"M8.5 4h3.5v4.5H8.5zM12 8.5h3.5V13H12z\"/>", "download": "<path d=\"M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5\"/><path d=\"M4.5 15.5v3A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-3\"/>", "trash": "<path d=\"M4 7h16M9.5 7V4.5h5V7\"/><path class=\"f\" d=\"M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7\"/><path d=\"M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7\"/><path d=\"M10 11v6M14 11v6\"/>", "backspace": "<path class=\"f\" d=\"M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z\"/><path d=\"M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z\"/><path d=\"M11.5 9.5l5 5M16.5 9.5l-5 5\"/>", "edit": "<path class=\"f\" d=\"M15.5 4.5l4 4L9 19l-5 1 1-5z\"/><path d=\"M15.5 4.5l4 4L9 19l-5 1 1-5z\"/><path d=\"M13.5 6.5l4 4\"/>", "settings": "<path class=\"f\" d=\"M12 2.8l1.6 2.3 2.7-.6.9 2.6 2.6.9-.6 2.7L21.2 12l-2.3 1.6.6 2.7-2.6.9-.9 2.6-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.9-2.6-2.6-.9.6-2.7L2.8 12l2.3-1.6-.6-2.7 2.6-.9.9-2.6 2.7.6z\"/><path d=\"M12 2.8l1.6 2.3 2.7-.6.9 2.6 2.6.9-.6 2.7L21.2 12l-2.3 1.6.6 2.7-2.6.9-.9 2.6-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.9-2.6-2.6-.9.6-2.7L2.8 12l2.3-1.6-.6-2.7 2.6-.9.9-2.6 2.7.6z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>", "library": "<path class=\"f\" d=\"M4 4h4v16H4zM9 4h4v16H9z\"/><path d=\"M4 4h4v16H4zM9 4h4v16H9z\"/><path class=\"f\" d=\"M14.2 5.3l3.8-1 4 15.4-3.8 1z\"/><path d=\"M14.2 5.3l3.8-1 4 15.4-3.8 1z\"/><path d=\"M4 8h4M9 8h4M4 16h4M9 16h4\"/>", "progress": "<path d=\"M3.5 20.5h17\"/><path class=\"f\" d=\"M5.5 13h3.2v7H5.5zM10.4 9h3.2v11h-3.2zM15.3 5h3.2v15h-3.2z\"/><path d=\"M5.5 13h3.2v7H5.5zM10.4 9h3.2v11h-3.2zM15.3 5h3.2v15h-3.2z\"/>", "hangul": "<rect class=\"f\" x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"4\"/><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"4\"/><path d=\"M7 7.5h5v5M15.5 6.5v8M15.5 10.5h2.5M7.5 16.5h9\"/>", "ear": "<path class=\"f\" d=\"M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.5Z\"/><path d=\"M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.5M10 9.5a2 2 0 0 1 4 0c0 1.2-1 1.6-1.6 2.4\"/>", "sentence": "<rect class=\"f\" x=\"2.5\" y=\"6\" width=\"6\" height=\"8\" rx=\"2\"/><rect x=\"2.5\" y=\"6\" width=\"6\" height=\"8\" rx=\"2\"/><rect x=\"10\" y=\"6\" width=\"5\" height=\"8\" rx=\"2\"/><rect x=\"16.5\" y=\"6\" width=\"5\" height=\"8\" rx=\"2\"/><path d=\"M4 19h16m-3-2.5 3 2.5-3 2.5\"/>", "counting": "<rect class=\"f\" x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\"/><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\"/><path d=\"M3 9.5h18M3 14.5h18\"/><circle class=\"d\" cx=\"8\" cy=\"9.5\" r=\"1.8\"/><circle class=\"d\" cx=\"12\" cy=\"9.5\" r=\"1.8\"/><circle class=\"d\" cx=\"10\" cy=\"14.5\" r=\"1.8\"/>", "pairs": "<rect class=\"f\" x=\"2.5\" y=\"5\" width=\"7.5\" height=\"14\" rx=\"2\"/><rect x=\"2.5\" y=\"5\" width=\"7.5\" height=\"14\" rx=\"2\"/><rect x=\"14\" y=\"5\" width=\"7.5\" height=\"14\" rx=\"2\"/><circle class=\"d\" cx=\"6.25\" cy=\"12\" r=\"1.6\"/><circle class=\"d\" cx=\"17.75\" cy=\"12\" r=\"1.6\"/><path d=\"M8 12h8\"/>", "bubbles": "<circle class=\"f\" cx=\"10\" cy=\"14\" r=\"6\"/><circle cx=\"10\" cy=\"14\" r=\"6\"/><circle cx=\"17.5\" cy=\"6.5\" r=\"3\"/><circle cx=\"19.5\" cy=\"14.5\" r=\"1.5\"/><path d=\"M7.5 12a3 3 0 0 1 2.5-2\"/>", "school": "<path class=\"f\" d=\"M4 10h16v10H4z\"/><path d=\"M2.5 10.5 12 4l9.5 6.5M4 10v10h16V10M10 20v-5h4v5M12 4V2l3 1-3 1\"/>", "talk": "<path class=\"f\" d=\"M3 5h11v8H8l-3 3v-3H3z\"/><path d=\"M3 5h11v8H8l-3 3v-3H3zM14 9h7v7h-2v3l-3-3h-2v-3\"/>", "puzzle": "<path class=\"f\" d=\"M5 9h3.5a2.5 2.5 0 0 1 5 0H17v3.5a2.5 2.5 0 0 1 0 5V21H5z\"/><path d=\"M5 9h3.5a2.5 2.5 0 0 1 5 0H17v3.5a2.5 2.5 0 0 1 0 5V21H5z\"/>", "trophy": "<path class=\"f\" d=\"M7 4h10v5a5 5 0 0 1-10 0z\"/><path d=\"M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6\"/>", "search": "<circle class=\"f\" cx=\"10.5\" cy=\"10.5\" r=\"6\"/><circle cx=\"10.5\" cy=\"10.5\" r=\"6\"/><path d=\"m15 15 5.5 5.5\"/>", "clock": "<circle class=\"f\" cx=\"12\" cy=\"13\" r=\"8\"/><circle cx=\"12\" cy=\"13\" r=\"8\"/><path d=\"M12 9v4l3 2M9 2.5h6\"/>", "island": "<path class=\"f\" d=\"M3 19c3-3 15-3 18 0z\"/><path d=\"M3 19c3-3 15-3 18 0M12 17V9M12 9c-2-3-6-3-7-1M12 9c2-3 6-3 7-1M12 9c-1-2-1-5 1-6\"/>", "cup": "<path class=\"f\" d=\"M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z\"/><path d=\"M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4\"/>", "bowl": "<path class=\"f\" d=\"M3 12h18a9 9 0 0 1-18 0z\"/><path d=\"M3 12h18a9 9 0 0 1-18 0zM15 3l-4 9M19 4l-5 8\"/>", "bag": "<path class=\"f\" d=\"M5 8h14l-1 13H6z\"/><path d=\"M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2\"/>", "train": "<rect class=\"f\" x=\"5\" y=\"3\" width=\"14\" height=\"14\" rx=\"3\"/><rect x=\"5\" y=\"3\" width=\"14\" height=\"14\" rx=\"3\"/><path d=\"M5 10h14M9 13.5h.01M15 13.5h.01M8 21l2-4M16 21l-2-4\"/>", "car": "<path class=\"f\" d=\"M3 14l2-6h14l2 6v4H3z\"/><path d=\"M3 14l2-6h14l2 6v4H3zM3 14h18M7 18v2M17 18v2M10 5h4v3h-4z\"/>", "bed": "<path class=\"f\" d=\"M3 12h18v5H3z\"/><path d=\"M3 7v12M21 12v7M3 12h18v5H3M6 12V9.5A1.5 1.5 0 0 1 7.5 8h3A1.5 1.5 0 0 1 12 9.5V12\"/>", "wave": "<circle class=\"f\" cx=\"10\" cy=\"7\" r=\"3.5\"/><circle cx=\"10\" cy=\"7\" r=\"3.5\"/><path d=\"M3.5 20a6.5 6.5 0 0 1 13 0M17 4.5c1.5.5 2.5 1.5 3 3M18 2c2 .7 3.5 2.2 4 4\"/>", "lifebuoy": "<circle class=\"f\" cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6\"/>", "apple": "<path class=\"f\" d=\"M12 8c-3-2-8-1-8 5 0 4 3 8 5 8 1.5 0 2-.7 3-.7s1.5.7 3 .7c2 0 5-4 5-8 0-6-5-7-8-5z\"/><path d=\"M12 8c-3-2-8-1-8 5 0 4 3 8 5 8 1.5 0 2-.7 3-.7s1.5.7 3 .7c2 0 5-4 5-8 0-6-5-7-8-5zM12 8c0-2 1-4 3-5\"/>", "flask": "<path class=\"f\" d=\"M7 14h10l3 6H4z\"/><path d=\"M9 3h6M10 3v6L4 20h16L14 9V3\"/>", "lock": "<rect class=\"f\" x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11M12 15v2\"/>", "unlock": "<rect class=\"f\" x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2M12 15v2\"/>", "games": "<path class=\"f\" d=\"M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.4a2.3 2.3 0 0 1-4 1L15 16H9l-1.7 1.8a2.3 2.3 0 0 1-4-1l-.7-3.4A4.5 4.5 0 0 1 7 8z\"/><path d=\"M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.4a2.3 2.3 0 0 1-4 1L15 16H9l-1.7 1.8a2.3 2.3 0 0 1-4-1l-.7-3.4A4.5 4.5 0 0 1 7 8z\"/><path d=\"M7.6 10.8v3.4M5.9 12.5h3.4\"/><circle class=\"d\" cx=\"15.8\" cy=\"11.3\" r=\"1.05\"/><circle class=\"d\" cx=\"17.8\" cy=\"13.5\" r=\"1.05\"/>", "music": "<path d=\"M9 17.5V5.5l10-2v12\"/><circle class=\"f\" cx=\"6.8\" cy=\"17.5\" r=\"2.4\"/><circle cx=\"6.8\" cy=\"17.5\" r=\"2.4\"/><circle class=\"f\" cx=\"16.8\" cy=\"15.5\" r=\"2.4\"/><circle cx=\"16.8\" cy=\"15.5\" r=\"2.4\"/>", "map": "<path class=\"f\" d=\"M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z\"/><path d=\"M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z\"/><path d=\"M9 4.5v13M15 6.5v13\"/><path d=\"M16.4 10l2.6 2.6M19 10l-2.6 2.6\" stroke-width=\"2.2\"/>", "sun": "<circle class=\"f\" cx=\"12\" cy=\"12\" r=\"4.3\"/><circle cx=\"12\" cy=\"12\" r=\"4.3\"/><path d=\"M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6\"/>", "moon": "<path class=\"f\" d=\"M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z\"/><path d=\"M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z\"/><path d=\"M17 4.5v3M15.5 6h3\"/>", "story": "<path class=\"f\" d=\"M3.5 5.5c3-1 6-1 8.5 1v13c-2.5-2-5.5-2-8.5-1zM20.5 5.5c-3-1-6-1-8.5 1v13c2.5-2 5.5-2 8.5-1z\"/><path d=\"M3.5 5.5c3-1 6-1 8.5 1v13c-2.5-2-5.5-2-8.5-1zM20.5 5.5c-3-1-6-1-8.5 1v13c2.5-2 5.5-2 8.5-1z\"/>", "dice": "<rect class=\"f\" x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3.6\"/><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3.6\"/><circle class=\"d\" cx=\"8.6\" cy=\"8.6\" r=\"1.3\"/><circle class=\"d\" cx=\"12\" cy=\"12\" r=\"1.3\"/><circle class=\"d\" cx=\"15.4\" cy=\"15.4\" r=\"1.3\"/>", "flame": "<path class=\"f\" d=\"M12 2.8c1.1 3.6 5.2 5.6 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2.3 1.2-3.8 2.5-4.8.2 1.7.9 2.7 1.9 3.2-.3-3.4.2-6.4.8-8.8z\"/><path d=\"M12 2.8c1.1 3.6 5.2 5.6 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2.3 1.2-3.8 2.5-4.8.2 1.7.9 2.7 1.9 3.2-.3-3.4.2-6.4.8-8.8z\"/>", "star": "<path class=\"f\" d=\"M12 3.2l2.7 5.5 6 .9-4.4 4.3 1.1 6L12 17.1l-5.4 2.8 1.1-6-4.4-4.3 6-.9z\"/><path d=\"M12 3.2l2.7 5.5 6 .9-4.4 4.3 1.1 6L12 17.1l-5.4 2.8 1.1-6-4.4-4.3 6-.9z\"/>", "ask": "<path class=\"f\" d=\"M12 3a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.8-1.1A8.5 8.5 0 1 0 12 3z\"/><path d=\"M12 3a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.8-1.1A8.5 8.5 0 1 0 12 3z\"/><path d=\"M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4\"/><circle class=\"d\" cx=\"12\" cy=\"16.4\" r=\"1.05\"/>", "music-off": "<path d=\"M9 17.5V5.5l10-2v12\"/><circle class=\"f\" cx=\"6.8\" cy=\"17.5\" r=\"2.4\"/><circle cx=\"6.8\" cy=\"17.5\" r=\"2.4\"/><circle class=\"f\" cx=\"16.8\" cy=\"15.5\" r=\"2.4\"/><circle cx=\"16.8\" cy=\"15.5\" r=\"2.4\"/><path d=\"M3.5 3.5l17 17\"/>", "back": "<path d=\"M14.5 5.5L8 12l6.5 6.5\"/>", "tutor": "<path class=\"f\" d=\"M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z\"/><path d=\"M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z\"/><circle class=\"d\" cx=\"8\" cy=\"11.5\" r=\"1.2\"/><circle class=\"d\" cx=\"12\" cy=\"11.5\" r=\"1.2\"/><circle class=\"d\" cx=\"16\" cy=\"11.5\" r=\"1.2\"/>", "worksheet": "<path class=\"f\" d=\"M6 3h9l4 4v13.5A1.5 1.5 0 0 1 17.5 22h-11.5A1.5 1.5 0 0 1 4.5 20.5v-16A1.5 1.5 0 0 1 6 3z\"/><path d=\"M6 3h9l4 4v13.5A1.5 1.5 0 0 1 17.5 22h-11.5A1.5 1.5 0 0 1 4.5 20.5v-16A1.5 1.5 0 0 1 6 3z\"/><path d=\"M15 3v4h4M8 11h8M8 14.5h8M8 18h5\"/>", "maths": "<rect class=\"f\" x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"3.5\"/><rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"3.5\"/><path d=\"M12 3.5v17M3.5 12h17M7.8 6.3v3.4M6.1 8h3.4M14.5 8h3.4M6.3 14.6l3 3M9.3 14.6l-3 3M14.5 15h3.4M14.5 17h3.4\"/>", "checkwork": "<path class=\"f\" d=\"M6 3h12a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 18 22H6a1.5 1.5 0 0 1-1.5-1.5v-16A1.5 1.5 0 0 1 6 3z\"/><path d=\"M6 3h12a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 18 22H6a1.5 1.5 0 0 1-1.5-1.5v-16A1.5 1.5 0 0 1 6 3z\"/><path d=\"M8 12.3l2.8 2.8L16.5 9.4\"/>", "cards": "<path class=\"f\" d=\"M8.5 3.5h10A1.5 1.5 0 0 1 20 5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 7 17V5a1.5 1.5 0 0 1 1.5-1.5z\"/><path d=\"M8.5 3.5h10A1.5 1.5 0 0 1 20 5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 7 17V5a1.5 1.5 0 0 1 1.5-1.5z\"/><path d=\"M4.5 7v12A1.5 1.5 0 0 0 6 20.5h9.5\"/>", "mic": "<rect class=\"f\" x=\"9\" y=\"3\" width=\"6\" height=\"11.5\" rx=\"3\"/><rect x=\"9\" y=\"3\" width=\"6\" height=\"11.5\" rx=\"3\"/><path d=\"M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7\"/>"};
  function ccIcon(n, cls){ return '<svg class="cc-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (CC_ICONS[n] || '') + '</svg>'; }
  window.ccIcon = ccIcon;   // the Library uses them too
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function shuffle(arr){ var a = arr.slice(); for(var i=a.length-1;i>0;i--){ var j = Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

  // In-app replacement for window.confirm / window.prompt. Those are silently blocked inside an
  // embedded artifact page (they just return false/null), which made "Delete deck", "Delete profile"
  // and "Import Anki deck" do nothing at all there. Lives on document.body, outside #app, so a
  // render() underneath can't wipe it. Resolves true/false, or the typed text/null with opts.input.
  function showDialog(opts){
    return new Promise(function(resolve){
      var wrap = document.createElement('div');
      wrap.className = 'cc-dialog-backdrop';
      wrap.innerHTML = '' +
        '<div class="cc-dialog" role="dialog" aria-modal="true" aria-labelledby="ccDialogTitle">' +
          '<h3 id="ccDialogTitle">'+esc(opts.title || '')+'</h3>' +
          (opts.message ? '<p>'+esc(opts.message)+'</p>' : '') +
          (opts.input ? '<input type="text" maxlength="40" value="'+esc(opts.input.value || '')+'" placeholder="'+esc(opts.input.placeholder || '')+'" aria-label="'+esc(opts.input.placeholder || opts.title || 'Name')+'">' : '') +
          (opts.requireText ? '<label class="cove-confirm-label" for="ccConfirmInput">Type <b>'+esc(opts.requireText)+'</b> to confirm</label><input id="ccConfirmInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">' : '') +
          '<div class="cc-dialog-actions">' +
            '<button type="button" class="btn btn-ghost" data-dlg="cancel">'+esc(opts.cancelLabel || 'Cancel')+'</button>' +
            '<button type="button" class="btn '+(opts.danger ? 'btn-danger-solid' : 'btn-primary')+'" data-dlg="ok">'+esc(opts.confirmLabel || 'OK')+'</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap);
      var input = wrap.querySelector('input');
      function close(result){
        document.removeEventListener('keydown', onKey, true);
        if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
        resolve(result);
      }
      var coveOk = wrap.querySelector('[data-dlg="ok"]');
      var coveMatch = function(){ return !opts.requireText || (input && input.value.trim().toLowerCase() === String(opts.requireText).trim().toLowerCase()); };
      if(opts.requireText){ coveOk.disabled = true; input.addEventListener('input', function(){ coveOk.disabled = !coveMatch(); }); }
      function ok(){ if(!coveMatch()) return; close(opts.input ? input.value : true); }
      function cancel(){ close(opts.input ? null : false); }
      function onKey(e){
        if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); cancel(); }
        else if(e.key === 'Enter' && (opts.input || opts.requireText)){ e.preventDefault(); e.stopPropagation(); ok(); }
      }
      document.addEventListener('keydown', onKey, true);
      wrap.querySelector('[data-dlg="ok"]').addEventListener('click', ok);
      wrap.querySelector('[data-dlg="cancel"]').addEventListener('click', cancel);
      wrap.addEventListener('click', function(e){ if(e.target === wrap) cancel(); });
      setTimeout(function(){ if(input){ input.focus(); input.select(); } else { var b = wrap.querySelector('[data-dlg="ok"]'); if(b) b.focus(); } }, 0);
    });
  }

