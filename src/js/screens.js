  /* ============ rendering ============ */
  var app = document.getElementById('app');

  /* ============ cove: accessibility helpers, privacy screen, data download ============ */
  try { if(!document.documentElement.lang) document.documentElement.lang = 'en'; } catch(e){}
  function coveToast(msg){
    var old = document.querySelector('.cove-toast'); if(old) old.remove();
    var t = document.createElement('div'); t.className = 'cove-toast'; t.setAttribute('role','status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function(){ if(t.parentNode) t.remove(); }, 3600);
  }
  // Small post-render pass so every screen gets the same accessibility basics without touching each
  // render function: pressed state on toggle chips, a keyboard-operable flip card, names for unlabeled
  // fields, and a page-level heading when the screen has none of its own.
  // Only the visible face of the flip card is exposed to screen readers / keyboard focus.
  function coveSyncFlip(fc){
    var flipped = fc.classList.contains('flipped');
    var fr = fc.querySelector('.face-front'), bk = fc.querySelector('.face-back');
    [[fr, flipped], [bk, !flipped]].forEach(function(pair){
      if(!pair[0]) return;
      pair[0].setAttribute('aria-hidden', String(pair[1]));
      pair[0].querySelectorAll('button,[href],input,[tabindex]').forEach(function(el){ if(pair[1]) el.setAttribute('tabindex','-1'); else el.removeAttribute('tabindex'); });
    });
  }
  var coveEnhanceQueued = false;
  function coveEnhance(){
    coveEnhanceQueued = false;
    var h1 = document.getElementById('coveH1');
    if(h1) h1.hidden = !!app.querySelector('h1');
    app.querySelectorAll('.subject-tab,.filter-tab,.subject-chip,.algo-opt').forEach(function(b){
      var on = String(b.classList.contains('active'));
      if(b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
    });
    var fc = document.getElementById('flipCard');
    if(fc) coveSyncFlip(fc);
    app.querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select').forEach(function(el){
      if(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
      if(el.id && app.querySelector('label[for="'+el.id+'"]')) return;
      if(el.closest('label')) return;
      var name = el.id === 'deckNameInput' ? 'Deck name' : (el.getAttribute('placeholder') || el.getAttribute('title') || el.name || 'Text field');
      el.setAttribute('aria-label', name);
    });
    app.querySelectorAll('.face .card-text').forEach(function(el){ var n = el.textContent.length; el.classList.toggle('cove-long', n > 60); el.classList.toggle('cove-mid', n > 28 && n <= 60); });
    app.querySelectorAll('img:not([alt])').forEach(function(im){ im.setAttribute('alt',''); });
    (function(){
      var prev = 1;
      app.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h){
        var lv = +h.tagName.charAt(1);
        if(lv > prev + 1){ h.setAttribute('aria-level', String(prev + 1)); lv = prev + 1; }
        else if(h.getAttribute('aria-level')) h.removeAttribute('aria-level');
        prev = lv;
      });
    })();
    app.querySelectorAll('button:not([aria-label])').forEach(function(b){
      if(!b.textContent.trim() && b.title) b.setAttribute('aria-label', b.title);
    });
  }
  try {
    new MutationObserver(function(){
      if(coveEnhanceQueued) return; coveEnhanceQueued = true;
      (window.queueMicrotask || function(f){ Promise.resolve().then(f); })(coveEnhance);
    }).observe(app, { childList:true, subtree:true });
  } catch(e){}

  function coveAdultStrip(visible){
    var due = 0, decks = 0, cards = 0;
    (visible || []).forEach(function(d){
      if(d.archived || d.feedMode || d.storyMode || d.equationMode || d.langFeedMode || d.readAlongMode || d.flashFeedMode || d.miniStoryMode) return;
      var dc = S.dueCounts[d.id] || { due:0, total:0 };
      cards += dc.total; if(dc.due > 0){ due += dc.due; decks++; }
    });
    function box(n, l, c){ return '<div class="as'+(c||'')+'"><b class="tabular">'+n+'</b><span>'+l+'</span></div>'; }
    return '<div class="adult-strip" aria-label="Summary for adults">' +
      box(due, 'Cards due now'+(decks ? ' in '+decks+' deck'+(decks===1?'':'s') : ''), ' due') +
      box(cards, 'Study cards in view') +
      box(currentStreak()+' day'+(currentStreak()===1?'':'s'), 'Practice streak') +
      box(S.stats.totalReviews||0, 'Cards reviewed, all time') + '</div>';
  }
  function coveDate(){ var d = new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function coveSafeName(n){ return String(n||'profile').trim().replace(/[^A-Za-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase() || 'profile'; }
  // "Download my data": everything Coral Cove keeps for one profile, as one readable JSON file.
  function coveDownloadProfile(id){
    var p = (S.profiles || []).find(function(x){ return x.id === id; }) || (S.profile && S.profile.id === id ? S.profile : null);
    if(!p){ coveToast('Could not find that profile.'); return; }
    coveToast('Gathering '+p.name+'\'s data…');
    S.store.exportProfile(id).then(function(data){
      var payload = Object.assign({ app:'Coral Cove', exportedAt:new Date().toISOString(),
        note:'Everything Coral Cove stores for this profile. The grown-up PIN is never included.' }, data);
      var text = JSON.stringify(payload, null, 2);
      var filename = 'coral-cove-'+coveSafeName(p.name)+'-data-'+coveDate()+'.json';
      var fallback = function(){
        try {
          var blob = new Blob([text], { type:'application/json' });
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
          document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          coveToast('Download started.');
        } catch(e){ coveToast('Downloads aren\'t available here.'); }
      };
      var use = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
      Promise.resolve(use).catch(function(){ return null; }).then(function(dl){
        if(!dl || typeof dl.save !== 'function') return fallback();
        return dl.save({ filename: filename, data: text }).then(function(){ coveToast('Saved '+filename); }, function(err){
          var code = err && err.code;
          if(code === 'declined') return;
          if(code === 'rate_limited') { coveToast('A save is already waiting for an answer.'); return; }
          fallback();
        });
      });
    }).catch(function(err){
      console.error('[Coral Cove] export failed', err);
      coveToast('Couldn\'t gather the data. Check your connection and try again.');
    });
  }

  // Plain-language privacy and data notes, reachable from Settings, Manage Profiles and the profile picker.
  function coveOpenPrivacy(){
    var opener = document.activeElement;
    var wrap = document.createElement('div');
    wrap.className = 'cc-dialog-backdrop';
    wrap.innerHTML = '' +
      '<div class="cc-dialog cove-privacy" role="dialog" aria-modal="true" aria-labelledby="covePvTitle">' +
        '<header><h3 id="covePvTitle">🔒 Privacy and data</h3><button type="button" class="icon-btn" data-pv-close aria-label="Close privacy and data">✕</button></header>' +
        '<div class="cove-pv-body" tabindex="0" aria-label="Privacy and data details">' +
          '<h4>What Coral Cove keeps</h4><ul>' +
            '<li>Profile names (a first name is all it needs) and a profile photo if you add one.</li>' +
            '<li>Decks and cards you make, including any pictures added to cards.</li>' +
            '<li>Practice results: answers marked right or not yet, how long an answer took, when each card is due next, stars, streaks, badges and round history.</li>' +
            '<li>Settings such as difficulty, light or dark, voices and the daily plan, and words a grown-up marks "I know it" in the Word Bank.</li>' +
            '<li>A scrambled (hashed) form of the grown-up PIN, never the PIN itself.</li>' +
          '</ul>' +
          '<h4>Where it lives</h4>' +
          '<p>In this page\'s own storage on claude.ai (run by Anthropic). Photos go to the page\'s file storage. The natural voices are recordings that come with the page, made ahead of time; when a word has none, your device\'s own voice reads it. Sound effects are made on the device. 🎙️ Echo recordings stay on this device, are never saved or sent anywhere, and are gone when the card changes.</p>' +
          '<h4>Who can see it</h4>' +
          '<p>Only people the page\'s owner has shared Coral Cove with, such as the tutor and parents. They can see every profile\'s decks and progress. The PIN keeps grown-up screens away from a child; it is a household lock, not a password.</p>' +
          '<h4>Claude, AI and other companies</h4>' +
          '<p>Coral Cove does not send anyone\'s practice data to Claude or any AI model. There are no ads, no analytics, no tracking cookies, and nothing is sold or shared. Fonts come from Google Fonts, which sees an ordinary web request. The page runs on claude.ai under Anthropic\'s privacy policy.</p>' +
          '<h4>Children</h4>' +
          '<p>A parent or guardian (or a tutor with their OK) sets up a child profile. Only add a child with a parent or guardian\'s consent, and use a first name only.</p>' +
          '<h4>Your choices</h4>' +
          '<p><b>Download</b> a profile\'s data as a file, or <b>delete</b> a profile and everything in it, from <b>Manage Profiles</b> (needs the grown-up PIN). Deleting is permanent.</p>' +
          '<h4>Credits and licenses</h4>' +
          '<p>Fonts: Fredoka, Nunito Sans, Nunito and Baloo 2, all under the SIL Open Font License 1.1, served by Google Fonts. Emoji are drawn by your device. The turtle (and Lumi the lanternfish in dark mode), sea life and shells are drawn for Coral Cove. No other code libraries are used. Natural voices: made with Supertonic 3 by Supertone Inc. (model under the OpenRAIL-M license) and, for Mandarin, Kokoro v1.1 by hexgrad (Apache 2.0), run through the open-source sherpa-onnx toolkit (Apache 2.0). Chinese pinyin and meanings were checked against CC-CEDICT (CC BY-SA 4.0).</p>' +
          '<h4>Questions</h4>' +
          '<p>Ask Wendy.</p>' +
        '</div>' +
        '<div class="cove-pv-actions"><button type="button" class="btn btn-primary" data-pv-close>Done</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    function close(){
      document.removeEventListener('keydown', onKey, true);
      if(wrap.parentNode) wrap.remove();
      if(opener && opener.focus && document.contains(opener)) try { opener.focus(); } catch(e){}
    }
    function onKey(e){
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); return; }
      if(e.key === 'Tab'){
        var f = [].slice.call(wrap.querySelectorAll('button,[tabindex="0"]'));
        if(!f.length) return;
        var first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    wrap.querySelectorAll('[data-pv-close]').forEach(function(b){ b.addEventListener('click', close); });
    wrap.addEventListener('click', function(e){ if(e.target === wrap) close(); });
    setTimeout(function(){ var b = wrap.querySelector('[data-pv-close]'); if(b) b.focus(); }, 0);
  }
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('[data-act="cove-privacy"],[data-cove-export],[data-cove-flip]') : null;
    if(!t) return;
    if(t.hasAttribute('data-cove-flip')){ var f = document.getElementById('flipCard'); if(f) f.click(); return; }
    e.preventDefault(); e.stopPropagation();
    if(t.hasAttribute('data-cove-export')) coveDownloadProfile(t.getAttribute('data-cove-export'));
    else coveOpenPrivacy();
  });
  var COVE_SHELL = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4C9 4 4 10 4 17c0 3 1 5 2.4 6.2L10 26h12l3.6-2.8C27 22 28 20 28 17c0-7-5-13-12-13z" fill="currentColor"/><path d="M16 6.5V25M11.5 8 13.2 25M20.5 8 18.8 25M7.5 12.5 11 25M24.5 12.5 21 25" stroke="rgba(255,255,255,.6)" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="11.5" y="25" width="9" height="3.2" rx="1.6" fill="currentColor"/></svg>';
  app.innerHTML = '<div class="lock-screen"><h2>🌊 Loading Coral Cove…</h2></div>';

  // Small dismissible banner for S.storeError, dropped into any Adult Mode screen where a save/sync
  // failure would otherwise look like a button silently doing nothing (deck editor, deck grid, ...).
  function errorBannerHTML(){
    if(!S.storeError) return '';
    return '<div class="banner-error"><span>⚠️ '+esc(S.storeError)+'</span><button type="button" data-act="dismiss-store-error" aria-label="Dismiss">✕</button></div>';
  }
  function wireErrorBanner(){
    var b = app.querySelector('[data-act="dismiss-store-error"]');
    if(b) b.addEventListener('click', function(){ S.storeError = null; render(); });
  }

  /* ---------- Drawing the screen ----------
     render() redraws the current screen from the state S, then runs the after-render hooks: features that
     have to react to whatever is now on screen (the swimming mascot, the study buddy, music, the Ask Shelly
     button) register with afterRender(name, fn) instead of wrapping render(). They run in the order they were
     registered, and one that fails is logged without stopping the others. */
  var afterRenderHooks = [];
  function afterRender(name, fn){ afterRenderHooks.push({ name: name, fn: fn }); }
  function render(){
    var out = renderScreen.apply(this, arguments);
    afterRenderHooks.forEach(function(h){ try { h.fn(); } catch(e){ console.warn('[Coral Cove] ' + h.name, e); } });
    return out;
  }
  function renderScreen(){
    try { Ocean.apply(!(S.activeProfileId && S.profile && S.profile.oceanTheme === false)); } catch(e){} // on for everyone unless a profile turned it off
    applyThemeMode(reefThemeFor(S.activeProfileId && S.profile ? S.profile : null));
    if(!S.booted) return; // wait for settings to load before showing anything (avoids a lock-screen flash)
    if(!S.splashDone) renderSplash();   // the title screen floats over the profiles (built underneath meanwhile); its tap starts the music
    reefSyncBody();
    /* coveqa: opening a deck from a scrolled home list left the new screen scrolled (header cut off) */
    try {
      var vk = (S.pinPromptFor ? 'pin' : S.creatingProfile ? 'new' : S.managingProfiles ? 'mp' : !S.activeProfileId ? 'pick' : S.view) + '';
      if(vk !== S._coveqaVK){ var pv = S._coveqaVK; S._coveqaVK = vk; if(pv && vk !== 'home') window.scrollTo(0, 0); }
    } catch(e){}
    if(S.pinPromptFor) return renderPinPad(S.pinPromptFor);
    // Profile gate: nothing profile-scoped renders until a profile is chosen. Manage/new-profile
    // screens sit outside any profile (they touch S.profiles, the top-level list) so they're checked
    // first, ahead of even the "which profile is active" check.
    if(S.creatingProfile) return renderNewProfileForm();
    if(S.managingProfiles) return renderManageProfiles();
    if(!S.activeProfileId) return renderProfilePicker();
    if(S.profileLoading) return renderProfileLoading();
    if(S.view === 'sessionResults') return renderSessionResults();
    // 'study'/'summary' are checked before the managingDecks branch below so that "Dive In" from
    // within Adult Mode (Manage Decks) actually opens the deck instead of silently falling through
    // to renderHome() -- previously the managingDecks branch had no case for these two views at all.
    if(S.view !== 'study' && (echoRec || S.echoState)) echoReset(); // left a card mid-recording: free the microphone
    if(S.view === 'study') return renderStudy();
    if(S.view === 'summary') return renderSummary();
    if(S.view === 'collection') return reefCollection();
    if(S.view === 'feed') return renderFeed();   // Word Feed -- same "works from either Manage Decks or
                                                   // Child Mode home" reasoning as study/summary above
    if(S.view === 'story') return renderStory();  // Story Mode -- same reasoning, see the STORY MODE
                                                   // section below WORD FEED
    if(S.view === 'equationFeed') return renderEquationFeed(); // Equation Feed -- same reasoning again,
                                                                 // see the EQUATION FEED section below STORY MODE
    if(S.view === 'langFeed') return renderLangFeed();          // Language Feed -- same reasoning again,
                                                                  // see the LANGUAGE FEED section below EQUATION FEED
    if(S.view === 'readAlong') return renderReadAlong();
    if(S.view === 'miniStory') return renderMiniStory();
    if(S.view === 'wordBank') return renderWordBank();
    if(S.view === 'plan') return renderPlan();
    if(S.view === 'planMonth') return renderPlanMonth();
    if(S.view === 'flashFeed') return renderFlashFeed();         // Flash Feed -- same reasoning again,
                                                                   // see the FLASH FEED section below READ-ALONG         // Read-Along -- same reasoning again,
                                                                   // see the READ-ALONG section below LANGUAGE FEED
    if(S.managingDecks){
      if(S.view === 'editor') return renderEditor();
      if(S.view === 'stats') return renderStats();
      if(S.view === 'deckStats') return renderDeckStats();
      if(S.view === 'settings') return renderSettingsPage();
      return renderHome();
    }
    if(!S.sessionActive) return renderLocked();
    if(S.view === 'editor') return renderEditor();
    if(S.view === 'stats') return renderStats();
    if(S.view === 'deckStats') return renderDeckStats();
    if(S.view === 'settings') return renderSettingsPage();
    return renderHome();
  }

  function renderProfileLoading(){
    app.innerHTML = '<div class="lock-screen"><h2>🌊 Loading…</h2></div>';
  }

  function ctrlRowHTML(){
    var soundIcon = Sound.isEnabled() ? '🔊' : '🔇';
    return '' +
      '<div class="ctrl-row">' +
        '<button type="button" class="icon-btn" data-act="toggle-sound" aria-label="Turn sound '+(Sound.isEnabled()?'off':'on')+'" title="Sound">'+soundIcon+'</button>' +
        '<button type="button" class="icon-btn" data-act="switch-profile" aria-label="Switch profile" title="Switch profile">👥</button>' +
        '<button type="button" class="icon-btn" data-act="end-session" aria-label="End session" title="End session">🏁</button>' +
      '</div>';
  }
  function wireCtrlRow(){
    var s = app.querySelector('[data-act="toggle-sound"]');
    if(s) s.addEventListener('click', function(){ Sound.setEnabled(!Sound.isEnabled()); render(); });
    var p = app.querySelector('[data-act="switch-profile"]');
    if(p) p.addEventListener('click', exitToPicker);
    var e = app.querySelector('[data-act="end-session"]');
    if(e) e.addEventListener('click', function(){
      // In Adult Mode there's no child "session" to lock/end -- a grown-up playing a deck to try it
      // out just heads back to Manage Decks, no PIN needed (they were never asked for one to get here).
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor='end'; render();
    });
  }

  /* ---------- LOCK SCREEN and grown-up checks ----------
     The per-profile "resting" screen for a Child Mode profile (Adult Mode profiles skip it: enterProfile
     drops them straight into their decks). Starting Child Mode, ending a session, switching profile and
     other grown-up actions ask the grown-up maths question (renderPinPad -> reefGrownUpGate, which replaced
     the PIN). A profile's mode isn't chosen here; it is a property of the profile, changed only from
     Settings -> requestModeSwitch. */
  function renderLocked(){
    if(reefSkipResting()) return;
    var name = S.profile ? S.profile.name : '';
    app.innerHTML = '' +
      coveWaterHTML('frame') +
      '<div class="lock-screen">' +
        '<h2>🌊 '+esc(name)+' is resting</h2>' +
        '<p>Tap Start Session when you\'re ready to dive in.</p>' +
        '<button type="button" class="btn btn-primary" data-act="choose-child">🧒 Start Session</button>' +
        '<button type="button" class="btn btn-ghost" data-act="switch-profile" style="margin-top:10px;">👥 Switch Profile</button>' +
      '</div>';
    app.querySelector('[data-act="choose-child"]').addEventListener('click', function(){
      Sound.unlock();
      /* iPad copy: starting a session doesn't need the PIN; ending one still does. */
      beginSession();
    });
    app.querySelector('[data-act="switch-profile"]').addEventListener('click', function(){
      Sound.unlock();
      goToPicker();
    });
  }

  /* ---------- PROFILES ---------- */
  function profileAvatarHTML(p, size){
    size = size || 'lg';
    if(p && p.photoUrl) return '<img class="profile-avatar avatar-'+size+'" src="'+esc(p.photoUrl)+'" alt="">';
    var initial = (p && p.name) ? esc(p.name.trim().charAt(0).toUpperCase()) : '🐬';
    return '<div class="profile-avatar avatar-'+size+' avatar-fallback">'+initial+'</div>';
  }

  function subscribeProfiles(){
    if(S.unsubProfiles) S.unsubProfiles();
    S.unsubProfiles = S.store.listenProfiles(function(profiles){
      S.profiles = profiles;
      if(S.activeProfileId){
        var updated = profiles.find(function(p){ return p.id === S.activeProfileId; });
        if(updated) S.profile = updated;
      }
      if(!S.booted) return;
      if(isPlayingView()) return;
      render();
    });
  }

  // Enters a chosen profile: points the store at it, resets every piece of transient per-profile
  // state left over from whoever was active before, then loads that profile's own stats/settings/
  // session/badges and subscribes to its decks before letting render() show anything real (the brief
  // gap is covered by renderProfileLoading so the old profile's screen never flashes stale data).
  function enterProfile(profile){
    S.activeProfileId = profile.id;
    S.planDay = null; S.planRun = null; S.planSettings = null; S.planLoading = false;
    S.profile = profile;
    S.store.setActiveProfile(profile.id);
    S.profileLoading = true;
    S.decks = []; S.dueCounts = {}; S.currentDeckId = null;
    S.statsData = null; S.statsDeckId = null; S.deckFilter = 'all'; S.subjectFilter = 'all'; S.reefPlace = null;
    S.view = 'home';
    S.managingDecks = profile.mode === 'adult';
    S.editMode = false;
    S.sessionActive = false;
    S.finishedTally = null;
    S.pendingEdit = null;
    S.justEarnedBadges = [];
    render();
    Promise.all([S.store.getStats(), S.store.getSettings(), S.store.getSessionTally(), S.store.getBadges()]).then(function(results){
      // unlockedSounds defaults to [] for any stats doc saved before the Word Feed sound shop existed.
      S.stats = Object.assign({ unlockedSounds: [] }, results[0]);
      S.settings = Object.assign({ algorithm:'sm2_speed', difficulty:'medium', readingSupport:false }, results[1] || {});
      S.sessionTally = results[2] || null;
      S.badges = results[3] || {};
      applyReadingSupport();
      // A session never resumes automatically across a profile switch or page reload -- Child Mode
      // always comes back to the resting screen and has to be started again on purpose.
      S.sessionActive = false;
      S.profileLoading = false;
      subscribeDecks();
      refreshDueCounts().then(render);
    });
  }

  // Actually flips the active profile's mode (called either straight from Settings, for a profile
  // that didn't start as Child, or after the 'modeSwitch' PIN clears for one that did). Drops the
  // profile right into whichever home screen the new mode implies.
  function applyModeSwitch(newMode){
    var p = S.profile;
    if(!p || p.mode === newMode) return;
    S.store.updateProfile(p.id, { mode: newMode }).catch(function(){});
    S.profile = Object.assign({}, p, { mode: newMode });
    S.profiles = S.profiles.map(function(x){ return x.id === p.id ? S.profile : x; });
    S.managingDecks = newMode === 'adult';
    S.editMode = false;
    S.view = 'home';
    render();
  }

  // Tears down the active profile's subscriptions/state and drops back to the profile picker.
  function goToPicker(){
    if(S.unsubDecks){ S.unsubDecks(); S.unsubDecks = null; }
    if(S.unsubCards){ S.unsubCards(); S.unsubCards = null; }
    S.activeProfileId = null;
    S.profile = null;
    S.managingDecks = false;
    S.editMode = false;
    S.sessionActive = false;
    S.view = 'home';
    S.decks = []; S.dueCounts = {};
    render();
  }

  // The "Switch Profile" control shown during an active Child Mode session -- ending a session is
  // already PIN-gated (kind 'end'), so leaving one early to switch profiles is gated the same way.
  // Adult Mode and a not-yet-started Child Mode profile have nothing to protect, so those go straight
  // through goToPicker().
  function exitToPicker(){
    if(S.sessionActive){
      S.pinPromptFor = 'switch';
      render();
      return;
    }
    goToPicker();
  }

  // The title screen, once each time the app opens. Browsers won't play sound until the first tap, so this
  // tap is it: the music starts as she dives in. It sits over the profile screen, which is built (3D sea and
  // all) underneath while the title shows, so the dive doesn't stutter: at its middle the title is just removed.
  function renderSplash(){
    if(document.querySelector('.cc-splash')) return;
    var night = reefNight(), i, h = '';
    var wave = function(cls){ return '<svg class="ccs-wave ' + cls + '" viewBox="0 0 1200 80" preserveAspectRatio="none"><path d="M0 40 C100 14 200 14 300 40 S500 66 600 40 S800 14 900 40 S1100 66 1200 40 V80 H0 Z"/></svg>'; };
    var cloud = '<svg viewBox="0 0 200 80"><path d="M30 70 C5 70 5 42 30 42 C32 22 62 14 78 30 C90 8 132 8 140 34 C168 26 192 44 182 64 C180 70 172 70 168 70 Z"/></svg>';
    var fish = '<svg viewBox="0 0 60 30"><path d="M52 15 C42 2 20 2 12 15 C20 28 42 28 52 15 Z M12 15 L0 5 L2 15 L0 25 Z"/><circle class="ccs-eye" cx="43" cy="12" r="2.6"/></svg>';   // facing right, the way they swim
    var jelly = '<svg viewBox="0 0 40 60"><path d="M4 22 C4 6 36 6 36 22 Z"/><path d="M10 22 q-3 12 2 26 M18 22 q3 14 -1 32 M26 22 q-3 12 2 28 M33 22 q3 10 -1 22" fill="none" stroke-width="2.4" stroke-linecap="round"/></svg>';
    var sky = night ? '<span class="ccs-stars">' + (function(){ var t = ''; for(i = 0; i < 26; i++) t += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 80).toFixed(1) + '%;animation-delay:' + (Math.random() * 3).toFixed(2) + 's"></i>'; return t; })() + '</span>' : '';
    for(i = 0; i < 9; i++) h += '<i style="left:' + (8 + Math.random() * 84).toFixed(1) + '%;top:' + (4 + Math.random() * 22).toFixed(1) + '%;animation-delay:' + (Math.random() * 2.4).toFixed(2) + 's"></i>';
    var el = document.createElement('div');
    el.className = 'cc-splash' + (night ? ' night' : '');
    el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-label', 'Coral Cove. Tap to dive in.');
    el.innerHTML = '<div class="ccs-sky" aria-hidden="true">' + sky + '<span class="ccs-sun"><span class="ccs-rays"></span></span>' +
        '<span class="ccs-cloud c1">' + cloud + '</span><span class="ccs-cloud c2">' + cloud + '</span><span class="ccs-cloud c3">' + cloud + '</span>' +
        (night ? '' : '<span class="ccs-gull g1">︶︶</span><span class="ccs-gull g2">︶︶</span>') +
        '<svg class="ccs-island" viewBox="0 0 220 120"><path class="ccs-sand" d="M0 120 C30 92 80 84 120 88 C160 92 196 104 220 120 Z"/><path class="ccs-trunk" d="M118 92 C116 70 120 50 132 30" fill="none" stroke-width="7" stroke-linecap="round"/>' +
          '<path class="ccs-leaf" d="M132 30 C110 18 92 24 84 36 C102 30 118 30 132 30 Z M132 30 C126 10 140 2 156 4 C144 12 138 20 132 30 Z M132 30 C150 18 170 22 178 36 C162 30 146 30 132 30 Z M132 30 C116 32 106 46 108 58 C116 44 124 36 132 30 Z M132 30 C150 34 160 48 156 60 C150 46 142 38 132 30 Z"/></svg>' +
      '</div>' +
      '<div class="ccs-title" aria-hidden="true"><span class="ccs-name">Coral Cove</span><span class="ccs-sub">' + (night ? 'A night on the shipwreck' : 'A sea of things to learn') + '</span></div>' +
      '<div class="ccs-sea" aria-hidden="true">' + wave('w3') + wave('w2') + wave('w1') +
        '<span class="ccs-glints">' + h + '</span><span class="ccs-shafts"></span>' +
        '<span class="ccs-shelly"><span class="ccs-ripple"></span>' + mascotTurtleSVG('ccs-shelly-svg') + '</span>' +
        (night ? '<span class="ccs-jelly j1">' + jelly + '</span><span class="ccs-jelly j2">' + jelly + '</span>'
               : '<span class="ccs-fish f1">' + fish + '</span><span class="ccs-fish f2">' + fish + '</span><span class="ccs-fish f3">' + fish + '</span>') +
        '<span class="ccs-bub b1"></span><span class="ccs-bub b2"></span><span class="ccs-bub b3"></span><span class="ccs-bub b4"></span>' +
        '<svg class="ccs-reef" viewBox="0 0 1200 200" preserveAspectRatio="none"><path class="r2" d="M0 200 V120 C60 96 90 130 140 110 S230 70 280 100 S380 140 440 104 S560 60 620 96 S740 138 800 108 S900 70 960 100 S1080 132 1200 96 V200 Z"/>' +
          '<path class="r1" d="M0 200 V160 C40 150 70 120 90 150 C100 120 130 110 140 150 C170 140 200 152 230 160 C260 130 290 128 300 158 C340 150 380 166 420 160 C440 120 470 118 480 156 C520 150 560 170 600 162 C630 140 650 136 660 160 C700 156 760 170 800 160 C820 126 850 122 860 158 C900 152 950 168 1000 160 C1030 132 1060 130 1070 158 C1110 152 1160 166 1200 158 V200 Z"/></svg>' +
      '</div>' +
      '<div class="ccs-tap" aria-hidden="true"><span class="ccs-tap-e">🐚</span> Tap to dive in</div>';
    document.body.appendChild(el);
    var go = function(e){
      if(e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if(S.splashDone) return;
      S.splashDone = true;   // (the music itself starts from this same tap: see reefMusicStart)
      el.classList.add('ccs-out');
      reefGo('dive', null, function(){ el.remove(); }, true);
      if(reefCalm()) el.remove();
    };
    el.addEventListener('click', go); el.addEventListener('keydown', go);
    try { el.focus({ preventScroll: true }); } catch(e){}
  }
  function renderProfilePicker(){
    var tiles = S.profiles.map(function(p){
      return '<button type="button" class="profile-tile" data-profile="'+p.id+'">' +
          profileAvatarHTML(p) +
          '<span class="profile-name">'+esc(p.name)+'</span>' +
        '</button>';
    }).join('');
    app.innerHTML = '' +
      coveWaterHTML('frame') +
      '<div class="lock-screen">' +
        '<h2>🌊 Who\'s diving in?</h2>' +
        '<p>Pick a profile to get started.</p>' +
        '<div class="profile-grid">'+tiles+'</div>' +
        '<button type="button" class="btn btn-ghost" data-act="manage-profiles" style="margin-top:14px;">🗂️ Manage Profiles</button>' +
        '<div class="cove-foot"><button type="button" class="cove-linkbtn" data-act="cove-privacy">🔒 Privacy and data</button></div>' +
      '</div>';
    app.querySelectorAll('[data-profile]').forEach(function(b){
      b.addEventListener('click', function(){
        var p = S.profiles.find(function(x){ return x.id === b.dataset.profile; });
        if(!p) return;
        Sound.unlock();
        /* iPad copy: grown-up profiles need the PIN to open; child profiles open freely. */
        if(p.mode === 'adult'){
          S.pendingEnterProfile = p;
          S.pinPromptFor = 'enterAdult';
          render();
          return;
        }
        enterProfile(p);
      });
    });
    app.querySelector('[data-act="manage-profiles"]').addEventListener('click', function(){
      Sound.unlock();
      S.pinPromptFor = 'manageProfiles';
      render();
    });
    reefLobby();
  }

  function renderManageProfiles(){
    var tiles = S.profiles.map(function(p){
      return '' +
        '<div class="profile-tile profile-tile-manage">' +
          profileAvatarHTML(p) +
          '<span class="profile-name">'+esc(p.name)+'</span>' +
          '<span class="profile-mode-badge">'+(p.mode==='adult'?'🔧 Adult':'🧒 Child')+'</span>' +
          '<div class="cove-tile-acts">' +
            '<button type="button" class="icon-btn" data-cove-export="'+p.id+'" aria-label="Download '+esc(p.name)+'\'s data" title="Download data">⬇️</button>' +
            '<button type="button" class="icon-btn" data-del="'+p.id+'" aria-label="Delete '+esc(p.name)+'\'s profile and data" title="Delete profile and data">🗑️</button>' +
          '</div>' +
        '</div>';
    }).join('');
    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="exit-manage-profiles">⟵ Lagoon</button>' +
        '<span class="nav-title">🗂️ Manage Profiles</span>' +
      '</div>' +
      '<div class="stats-page">' +
        errorBannerHTML() +
        '<div class="profile-grid">' + tiles +
          '<button type="button" class="profile-tile profile-tile-add" data-act="new-profile"><span class="profile-add-icon">➕</span><span class="profile-name">Add Profile</span></button>' +
        '</div>' +
        '<p class="algo-note" style="text-align:center;margin-top:14px;">⬇️ downloads a profile\'s decks and progress as a file. 🗑️ deletes the profile and all of its data for good.</p>' +
        '<div class="cove-foot"><button type="button" class="cove-linkbtn" data-act="cove-privacy">🔒 Privacy and data</button></div>' +
      '</div>';
    wireErrorBanner();
    app.querySelector('[data-act="exit-manage-profiles"]').addEventListener('click', function(){ S.managingProfiles = false; render(); });
    app.querySelector('[data-act="new-profile"]').addEventListener('click', function(){
      S.newProfileDraft = { name:'', mode:'child', photoId:'', photoUrl:'' };
      S.managingProfiles = false;
      S.creatingProfile = true;
      render();
    });
    app.querySelectorAll('[data-del]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.del;
        var p = S.profiles.find(function(x){ return x.id === id; });
        if(!p) return;
        if(S.profiles.length <= 1){ S.storeError = 'You need at least one profile.'; render(); return; }
        showDialog({ title: 'Delete '+p.name+'\'s profile?', message: 'This permanently deletes '+p.name+'\'s profile, decks, cards, pictures, practice history, stars and settings. It can\'t be undone. You can download their data first with ⬇️.', requireText: p.name, confirmLabel: 'Delete forever', danger: true }).then(function(yes){
          if(!yes) return;
          S.store.deleteProfile(id).then(function(){
            if(p.photoId) Assets.remove(p.photoId);
            render();
          });
        });
      });
    });
  }

  function handleProfilePhotoFile(file){
    if(!file || !S.newProfileDraft) return;
    var draft = S.newProfileDraft;
    S.profilePhotoUploading = true;
    render();
    var uploaded = null;
    downscalePhoto(file, 480).then(function(blob){
      return Assets.upload(blob);
    }).then(function(res){
      uploaded = res;
      // Browsers generally can't decode HEIC/HEIF via <img>, so confirm the uploaded photo actually
      // renders before keeping it -- otherwise a "successful" upload would silently show as a broken
      // image everywhere the avatar appears.
      return new Promise(function(resolve, reject){
        var img = new Image();
        img.onload = function(){ resolve(); };
        img.onerror = function(){ reject(new Error('decode-failed')); };
        img.src = res.url;
      });
    }).then(function(){
      draft.photoId = uploaded.id;
      draft.photoUrl = uploaded.url;
      S.profilePhotoUploading = false;
      render();
    }).catch(function(){
      if(uploaded) Assets.remove(uploaded.id);
      S.profilePhotoUploading = false;
      S.storeError = 'That photo couldn\'t be used here — try a JPG or PNG instead.';
      render();
    });
  }

  function renderNewProfileForm(){
    var d = S.newProfileDraft || (S.newProfileDraft = { name:'', mode:'child', photoId:'', photoUrl:'' });
    var photoBlock = d.photoUrl
      ? '<img class="profile-avatar avatar-lg" src="'+esc(d.photoUrl)+'" alt="">'
      : '<div class="profile-avatar avatar-lg avatar-fallback">'+(d.name.trim() ? esc(d.name.trim().charAt(0).toUpperCase()) : '🐬')+'</div>';
    var modeBtn = function(m, label, blurb){
      return '<button type="button" class="algo-opt'+(d.mode===m?' active':'')+'" data-new-mode="'+m+'">' +
          '<span class="algo-name">'+label+(d.mode===m?' <span class="algo-current">— selected</span>':'')+'</span>' +
          '<span class="algo-blurb">'+blurb+'</span>' +
        '</button>';
    };
    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="cancel-new-profile">⟵ Cancel</button>' +
        '<span class="nav-title">➕ New Profile</span>' +
      '</div>' +
      '<div class="stats-page">' +
        errorBannerHTML() +
        '<div class="new-profile-form">' +
          '<div class="profile-photo-picker">' +
            photoBlock +
            (S.assetsAvailable ?
              '<label class="btn btn-ghost profile-photo-label">'+(S.profilePhotoUploading?'Uploading…':'📷 Choose Photo')+
                '<input type="file" accept="image/png,image/jpeg,image/heic,image/heif,.heic,.heif" data-inp="profile-photo" style="display:none;" '+(S.profilePhotoUploading?'disabled':'')+'>' +
              '</label>'
              : '<p class="algo-note">Photo uploads are only available in the live app.</p>') +
          '</div>' +
          '<div class="field"><label for="profileNameInput">Name</label><input type="text" id="profileNameInput" placeholder="Profile name" value="'+esc(d.name)+'" maxlength="24"></div>' +
          '<label class="field-label" style="margin-top:14px;">Mode</label>' +
          '<div class="algo-toggle">' +
            modeBtn('child', '🧒 Child Mode', 'PIN-protected study sessions; deck editing needs the PIN too.') +
            modeBtn('adult', '🔧 Adult Mode', 'Study and manage decks anytime — no PIN needed.') +
          '</div>' +
          (d.mode === 'child' ? '<label class="cove-consent"><input type="checkbox" data-cove-consent '+(d.consent?'checked':'')+'><span>I\'m this child\'s parent or guardian, or I have their permission. Coral Cove will keep their first name, any photo, their decks and practice results. <button type="button" class="cove-linkbtn" data-act="cove-privacy">What\'s kept?</button></span></label>' : '') +
          '<button type="button" class="btn btn-primary" data-act="save-new-profile" style="margin-top:18px;" '+((!d.name.trim() || (d.mode==='child' && !d.consent))?'disabled':'')+'>Create Profile</button>' +
        '</div>' +
      '</div>';
    wireErrorBanner();
    app.querySelector('[data-act="cancel-new-profile"]').addEventListener('click', function(){
      if(d.photoId) Assets.remove(d.photoId);
      S.newProfileDraft = null;
      S.creatingProfile = false;
      S.managingProfiles = true;
      render();
    });
    var nameInp = app.querySelector('#profileNameInput');
    var saveBtn = app.querySelector('[data-act="save-new-profile"]');
    nameInp.addEventListener('input', function(){ d.name = nameInp.value; saveBtn.disabled = !d.name.trim() || (d.mode==='child' && !d.consent); });
    var coveConsent = app.querySelector('[data-cove-consent]');
    if(coveConsent) coveConsent.addEventListener('change', function(){ d.consent = coveConsent.checked; saveBtn.disabled = !d.name.trim() || (d.mode==='child' && !d.consent); });
    app.querySelectorAll('[data-new-mode]').forEach(function(b){
      b.addEventListener('click', function(){ d.mode = b.dataset.newMode; render(); });
    });
    var fileInp = app.querySelector('[data-inp="profile-photo"]');
    if(fileInp) fileInp.addEventListener('change', function(){
      var f = fileInp.files && fileInp.files[0];
      if(f) handleProfilePhotoFile(f);
    });
    saveBtn.addEventListener('click', function(){
      var name = d.name.trim();
      if(!name || (d.mode==='child' && !d.consent)) return;
      S.store.addProfile({ name: name, mode: d.mode, initialMode: d.mode, photoId: d.photoId||'', photoUrl: d.photoUrl||'', order: S.profiles.length }).then(function(){
        S.newProfileDraft = null;
        S.creatingProfile = false;
        render();
      });
    });
  }




  function pinPadTitles(kind){
    if(kind === 'enterAdult') return ['🔐 Grown-up Profile', 'Enter the PIN to open this profile.'];
    if(kind === 'start') return ['🔐 Start Child Mode', 'Ask a grown-up to enter the PIN to begin today\'s session.'];
    if(kind === 'end') return ['🔐 End Session', 'Enter the PIN to finish and lock Coral Cove.'];
    if(kind === 'exit') return ['🔐 Leave This Deck?', 'Ask a grown-up to enter the PIN to head back before finishing.'];
    if(kind === 'switch') return ['🔐 Switch Profile', 'Enter the PIN to end this session and switch profiles.'];
    if(kind === 'manageProfiles') return ['🔐 Manage Profiles', 'Enter the PIN to add or remove profiles.'];
    if(kind === 'modeSwitch') return ['🔐 Change Mode', 'Enter the PIN to switch this profile\'s mode.'];
    return ['🔐 Parent PIN', 'Enter the PIN to open Edit Mode.'];
  }

  function renderPinPad(kind){
    if(kind === 'exit' && reefKid()) return reefMathGate();
    if(reefNoPin() || reefInsideAdult(kind)) return reefSkipPin(kind);
    return reefGrownUpGate(kind);   // a grown-up maths question instead of a PIN; pinPadTitles still names each case
  }

  function beginSession(){
    S.sessionTally = defaultTally();
    S.sessionActive = true;
    S.editMode = false;
    var startSettings = Object.assign({}, S.settings, { sessionActive: true, sessionStartedAt: S.sessionTally.startedAt });
    S.settings = startSettings;
    Promise.all([S.store.setSettings(startSettings), S.store.setSessionTally(S.sessionTally)]).then(function(){
      Sound.sessionStart();
      S.pinPromptFor = null;
      S.view = 'home';
      render();
    });
  }
  function endSessionNow(){
    var tally = S.sessionTally || defaultTally();
    S.finishedTally = Object.assign({}, tally, { endedAt: Date.now() });
    S.sessionActive = false;
    var endSettings = Object.assign({}, S.settings, { sessionActive: false });
    S.settings = endSettings;
    Promise.all([S.store.setSettings(endSettings), S.store.setSessionTally(S.finishedTally)]).then(function(){
      Sound.sessionEnd();
      S.pinPromptFor = null;
      S.view = 'sessionResults';
      render();
    });
  }

  // Turns Edit Mode on/off for the Live/Archived tabs + deck editing/archiving controls, which now
  // live behind this flag in BOTH Adult Mode and Child Mode. Adult Mode is already unlocked, so this
  // flips on with no PIN; Child Mode has to clear the PIN first (see requestEditMode below).
  function toggleEditMode(){
    if(S.editMode){ S.editMode = false; render(); return; }
    requestEditMode();
  }

  function requestEditMode(){
    if(S.managingDecks){ S.editMode = true; render(); return; }
    S.pendingEdit = null;
    S.pinPromptFor = 'edit';
    render();
  }

  // A grown-up check passed (the maths question, or none in the Claude version): carry on with what it guarded.
  // Every kind asks again each time it comes up; there's no "unlock once per visit".
  function grownUpPassed(kind){
    if(kind === 'enterAdult'){
      S.pinPromptFor = null;
      var ep = S.pendingEnterProfile;
      S.pendingEnterProfile = null;
      if(ep) enterProfile(ep); else render();
    } else if(kind === 'start'){
      beginSession();
    } else if(kind === 'end'){
      endSessionNow();
    } else if(kind === 'edit'){
      S.pinPromptFor = null;
      var pe = S.pendingEdit || {};
      S.pendingEdit = null;
      S.editMode = true;
      if(pe.deckId){ openEditorUnlocked(pe.deckId, pe.focusName); } else { render(); }
    } else if(kind === 'exit'){
      S.pinPromptFor = null;
      goHome();
    } else if(kind === 'switch'){
      S.pinPromptFor = null;
      var endSettings = Object.assign({}, S.settings, { sessionActive:false });
      S.settings = endSettings;
      S.store.setSettings(endSettings).catch(function(){});
      goToPicker();
    } else if(kind === 'manageProfiles'){
      S.pinPromptFor = null;
      S.managingProfiles = true;
      render();
    } else if(kind === 'modeSwitch'){
      S.pinPromptFor = null;
      var nm = S.pendingModeSwitch;
      S.pendingModeSwitch = null;
      if(nm) applyModeSwitch(nm); else render();
    }
  }

  function cancelPinPrompt(kind){
    if(kind === 'edit') S.pendingEdit = null;
    if(kind === 'modeSwitch') S.pendingModeSwitch = null;
    if(kind === 'enterAdult') S.pendingEnterProfile = null;
    S.pinPromptFor = null;
    render();
  }

  function goLocked(){
    S.view = 'home';
    S.currentDeckId = null;
    S.finishedTally = null;
    S.editMode = false;
    if(S.unsubCards){ S.unsubCards(); S.unsubCards = null; }
    render();
  }

  function renderSessionResults(){
    var t = S.finishedTally || defaultTally();
    var mins = t.endedAt ? Math.max(1, Math.round((t.endedAt - t.startedAt) / 60000)) : 0;
    var total = t.reviewedCount || 0;
    var right = Math.max(0, total - (t.again || 0));
    var accuracy = total > 0 ? Math.round((right / total) * 100) : 0;
    var deckNames = (t.decksStudied || []).map(function(id){
      var d = S.decks.find(function(x){ return x.id === id; });
      return d ? (d.emoji + ' ' + esc(d.name)) : null;
    }).filter(Boolean);
    app.innerHTML = '' +
      coveWaterHTML('frame cw-sum', coveSumTip()) +
      '<div class="summary-card">' +
        '<h2>🎉 Session complete!</h2>' +
        '<div class="summary-stats">' +
          '<div class="summary-stat"><span class="num tabular">'+right+' / '+total+'</span><span class="label">Right</span></div>' +
          '<div class="summary-stat"><span class="num tabular">'+accuracy+'%</span><span class="label">Accuracy</span></div>' +
          '<div class="summary-stat"><span class="num tabular">'+mins+'</span><span class="label">Minutes</span></div>' +
        '</div>' +
        (deckNames.length ? '<div class="session-decklist">Decks studied: '+deckNames.join(', ')+'</div>' : '') +
        '<button type="button" class="btn btn-primary" data-act="done">Done</button>' +
      '</div>';
    app.querySelector('[data-act="done"]').addEventListener('click', function(){ reefEnded = true; goLocked(); });
  }

  function bubblesHTML(n){
    var out = '<div class="bubbles" aria-hidden="true">';
    for(var i=0;i<n;i++){
      var size = 8 + Math.round(Math.random()*22);
      var left = Math.round(Math.random()*96);
      var dur = (6 + Math.random()*8).toFixed(1);
      var delay = (Math.random()*8).toFixed(1);
      out += '<span class="bubble" style="width:'+size+'px;height:'+size+'px;left:'+left+'%;animation-duration:'+dur+'s;animation-delay:-'+delay+'s;"></span>';
    }
    out += '</div>';
    return out;
  }

  // Lumi, a little deep-sea anglerfish: the dark-mode twin of the turtle (the styles show one or the other: see "Lumi, the night guide").
  // Same drawing as Coral Calendar's Lumi (angler); a wrong answer gives her worried brows and a small frown.
  var LUMI_ART = {n: "<circle cx=\"98\" cy=\"3.4\" r=\"11.5\" fill=\"#43D3D4\" opacity=\".09\"/><g><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M66.6 41.4C60.6 40.8 53.6 43.2 49.8 48.2q2.4.3 3.2 2.7q2.6-.7 4.1 1.3q2.4-1.3 4.6.3C63.8 50.6 66.8 46.2 67.6 43Z\" transform=\"translate(-6 -3) rotate(-14 66 42)\"/></g><g class=\"lu-tail\"><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M32.5 33.2C27.5 28.6 21.5 23.4 15 20.2q-2.8 3.2-1.1 6.6q-3.5 3-1.3 6.7q-3.5 3.4-1 6.8q-2.4 3.8 1.1 6.6q-1 3.4 2.7 5.3C21.6 49 27.6 44 32.5 39.6Z\"/><path fill=\"none\" stroke=\"#A0E6EC\" stroke-opacity=\".42\" stroke-width=\".55\" stroke-linecap=\"round\" d=\"M31.4 34.6L16.4 23.6M31.4 35.6L13.8 30.4M31.4 36.6L13.6 37.6M31.4 37.6L14.8 44.6M31.4 38.6L17.4 50.6\"/></g><g><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M40.5 22.6C39.4 17 41.6 11.6 46.4 9q.2 2.6 2.4 3.1q-.6 2.5 1.6 3.5q-1 2.1.6 3.4C47 19.4 43.6 20.8 40.5 22.6Z\"/><path fill=\"none\" stroke=\"#A0E6EC\" stroke-opacity=\".42\" stroke-width=\".55\" stroke-linecap=\"round\" d=\"M41.6 21.4L45.6 11.2M43.2 20.6L48.4 14M45 19.8L50.2 17.6\"/></g><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M39.6 49.2C37.6 53.4 38.4 57.6 41.8 59.8q.7-2.2 2.7-2.3q.1-2 2-2.9C45.2 53 42.6 51.2 39.6 49.2Z\"/><path fill=\"#1E557A\" stroke=\"#7EDEE2\" stroke-opacity=\".6\" stroke-width=\".9\" d=\"M31 36C33 22 46 11.5 63 11.5C80 11.5 93 22 94.5 34.5C95.6 46 86.5 56.5 69 57.5C51 58.5 34 51 31 36Z\"/><path fill=\"#15345C\" opacity=\".85\" d=\"M32.4 32C37 21 49 13.4 63 13.4C77.5 13.4 88.6 20.2 92.4 29.6C84 23.4 73 20.8 62 21.2C50 21.8 40 25.8 32.4 32Z\"/><path fill=\"#62AEBC\" opacity=\".55\" d=\"M36 44.5C46 53 61 56.4 74 55.6C84 55 90.6 50 93.4 43C87.6 50.6 78 53.6 66 53.6C54 53.6 44 50.6 36 44.5Z\"/><ellipse fill=\"#43D3D4\" opacity=\".16\" cx=\"84\" cy=\"22.5\" rx=\"8.5\" ry=\"5.5\"/><path fill=\"none\" stroke=\"#CFF6F8\" stroke-opacity=\".34\" stroke-width=\"1.7\" stroke-linecap=\"round\" d=\"M43 20.4C50 15 59 12.9 68 13.7\"/><path fill=\"none\" stroke=\"#BFF0F5\" stroke-opacity=\".26\" stroke-width=\"1\" stroke-linecap=\"round\" d=\"M70.4 24.6C67 32 67.2 41 71.4 48\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"50\" cy=\"18.6\" r=\"1.1\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"58.6\" cy=\"15.9\" r=\"0.8\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"44.2\" cy=\"25.2\" r=\"0.9\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"55.2\" cy=\"23.6\" r=\"0.7\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"66.2\" cy=\"18.6\" r=\"0.8\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"39.6\" cy=\"31.2\" r=\"0.7\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"48.2\" cy=\"30.2\" r=\"0.6\"/><g class=\"ph\"><circle cx=\"43.4\" cy=\"45.8\" r=\"2.34\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"43.4\" cy=\"45.8\" r=\"0.85\" fill=\"#D8FFFB\"/><circle cx=\"50.8\" cy=\"49.6\" r=\"2.6\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"50.8\" cy=\"49.6\" r=\"0.95\" fill=\"#D8FFFB\"/><circle cx=\"59.2\" cy=\"51.8\" r=\"2.6\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"59.2\" cy=\"51.8\" r=\"0.95\" fill=\"#D8FFFB\"/><circle cx=\"67.6\" cy=\"52\" r=\"2.6\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"67.6\" cy=\"52\" r=\"0.95\" fill=\"#D8FFFB\"/><circle cx=\"75.6\" cy=\"50.2\" r=\"2.34\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"75.6\" cy=\"50.2\" r=\"0.85\" fill=\"#D8FFFB\"/><circle cx=\"82.2\" cy=\"46.8\" r=\"2.08\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"82.2\" cy=\"46.8\" r=\"0.76\" fill=\"#D8FFFB\"/><circle cx=\"49.4\" cy=\"39.8\" r=\"1.56\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"49.4\" cy=\"39.8\" r=\"0.57\" fill=\"#D8FFFB\"/><circle cx=\"60.2\" cy=\"43\" r=\"1.56\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"60.2\" cy=\"43\" r=\"0.57\" fill=\"#D8FFFB\"/></g><path display=\"none\" d=\"M31 36C33 22 46 11.5 63 11.5C80 11.5 93 22 94.5 34.5C95.6 46 86.5 56.5 69 57.5C51 58.5 34 51 31 36Z\"/><g class=\"lu-lure\"><path fill=\"none\" stroke=\"#4C97AC\" stroke-width=\"1.5\" stroke-linecap=\"round\" d=\"M77 13.2C76.6 3.6 92 -5 98 3.4\"/><g transform=\"translate(98 3.4)\"><circle class=\"lu-bulb\" r=\"7.5\" fill=\"#43D3D4\" opacity=\".3\"/><circle fill=\"#F0C76A\" r=\"3.5\"/><circle fill=\"#43D3D4\" r=\"2.6\"/><circle fill=\"#F2FFFE\" cx=\"-.9\" cy=\"-.9\" r=\"1\"/></g></g><ellipse fill=\"#F2A08A\" opacity=\".55\" cx=\"77.6\" cy=\"37.4\" rx=\"3.9\" ry=\"2.5\"/><g class=\"lu-eye\"><circle fill=\"#CDEEF3\" cx=\"80\" cy=\"27\" r=\"6.8\"/><g><circle fill=\"#06131D\" cx=\"80.5\" cy=\"27.4\" r=\"5.44\"/><path fill=\"none\" stroke=\"#2A8CA3\" stroke-width=\".9\" stroke-linecap=\"round\" d=\"M76.74 29.45Q80.5 33.53 84.08 29.04\"/><circle fill=\"#fff\" cx=\"82.04\" cy=\"25.1\" r=\"2.04\"/><circle fill=\"#fff\" cx=\"77.96\" cy=\"29.18\" r=\"0.88\"/></g></g><g><path fill=\"none\" stroke=\"#06131D\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M94.6 38.6Q90.5 46.6 79.6 43.4\"/><path fill=\"#EAFBFB\" d=\"M90.67 41.8Q91.77 44.9 92.87 41.8Z\"/><path fill=\"#EAFBFB\" d=\"M87.7 43.4Q88.8 46.5 89.9 43.4Z\"/></g><g class=\"lu-fin\"><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M66.6 41.4C60.6 40.8 53.6 43.2 49.8 48.2q2.4.3 3.2 2.7q2.6-.7 4.1 1.3q2.4-1.3 4.6.3C63.8 50.6 66.8 46.2 67.6 43Z\"/><path fill=\"none\" stroke=\"#A0E6EC\" stroke-opacity=\".42\" stroke-width=\".55\" stroke-linecap=\"round\" d=\"M66 42.2L51.6 48.4M66.2 43L56.2 51.4M66.6 43.8L61.6 52.4\"/></g>", sad: "<circle cx=\"98\" cy=\"3.4\" r=\"11.5\" fill=\"#43D3D4\" opacity=\".09\"/><g><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M66.6 41.4C60.6 40.8 53.6 43.2 49.8 48.2q2.4.3 3.2 2.7q2.6-.7 4.1 1.3q2.4-1.3 4.6.3C63.8 50.6 66.8 46.2 67.6 43Z\" transform=\"translate(-6 -3) rotate(-14 66 42)\"/></g><g class=\"lu-tail\"><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M32.5 33.2C27.5 28.6 21.5 23.4 15 20.2q-2.8 3.2-1.1 6.6q-3.5 3-1.3 6.7q-3.5 3.4-1 6.8q-2.4 3.8 1.1 6.6q-1 3.4 2.7 5.3C21.6 49 27.6 44 32.5 39.6Z\"/><path fill=\"none\" stroke=\"#A0E6EC\" stroke-opacity=\".42\" stroke-width=\".55\" stroke-linecap=\"round\" d=\"M31.4 34.6L16.4 23.6M31.4 35.6L13.8 30.4M31.4 36.6L13.6 37.6M31.4 37.6L14.8 44.6M31.4 38.6L17.4 50.6\"/></g><g><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M40.5 22.6C39.4 17 41.6 11.6 46.4 9q.2 2.6 2.4 3.1q-.6 2.5 1.6 3.5q-1 2.1.6 3.4C47 19.4 43.6 20.8 40.5 22.6Z\"/><path fill=\"none\" stroke=\"#A0E6EC\" stroke-opacity=\".42\" stroke-width=\".55\" stroke-linecap=\"round\" d=\"M41.6 21.4L45.6 11.2M43.2 20.6L48.4 14M45 19.8L50.2 17.6\"/></g><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M39.6 49.2C37.6 53.4 38.4 57.6 41.8 59.8q.7-2.2 2.7-2.3q.1-2 2-2.9C45.2 53 42.6 51.2 39.6 49.2Z\"/><path fill=\"#1E557A\" stroke=\"#7EDEE2\" stroke-opacity=\".6\" stroke-width=\".9\" d=\"M31 36C33 22 46 11.5 63 11.5C80 11.5 93 22 94.5 34.5C95.6 46 86.5 56.5 69 57.5C51 58.5 34 51 31 36Z\"/><path fill=\"#15345C\" opacity=\".85\" d=\"M32.4 32C37 21 49 13.4 63 13.4C77.5 13.4 88.6 20.2 92.4 29.6C84 23.4 73 20.8 62 21.2C50 21.8 40 25.8 32.4 32Z\"/><path fill=\"#62AEBC\" opacity=\".55\" d=\"M36 44.5C46 53 61 56.4 74 55.6C84 55 90.6 50 93.4 43C87.6 50.6 78 53.6 66 53.6C54 53.6 44 50.6 36 44.5Z\"/><ellipse fill=\"#43D3D4\" opacity=\".16\" cx=\"84\" cy=\"22.5\" rx=\"8.5\" ry=\"5.5\"/><path fill=\"none\" stroke=\"#CFF6F8\" stroke-opacity=\".34\" stroke-width=\"1.7\" stroke-linecap=\"round\" d=\"M43 20.4C50 15 59 12.9 68 13.7\"/><path fill=\"none\" stroke=\"#BFF0F5\" stroke-opacity=\".26\" stroke-width=\"1\" stroke-linecap=\"round\" d=\"M70.4 24.6C67 32 67.2 41 71.4 48\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"50\" cy=\"18.6\" r=\"1.1\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"58.6\" cy=\"15.9\" r=\"0.8\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"44.2\" cy=\"25.2\" r=\"0.9\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"55.2\" cy=\"23.6\" r=\"0.7\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"66.2\" cy=\"18.6\" r=\"0.8\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"39.6\" cy=\"31.2\" r=\"0.7\"/><circle fill=\"#0A2645\" opacity=\".55\" cx=\"48.2\" cy=\"30.2\" r=\"0.6\"/><g class=\"ph\"><circle cx=\"43.4\" cy=\"45.8\" r=\"2.34\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"43.4\" cy=\"45.8\" r=\"0.85\" fill=\"#D8FFFB\"/><circle cx=\"50.8\" cy=\"49.6\" r=\"2.6\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"50.8\" cy=\"49.6\" r=\"0.95\" fill=\"#D8FFFB\"/><circle cx=\"59.2\" cy=\"51.8\" r=\"2.6\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"59.2\" cy=\"51.8\" r=\"0.95\" fill=\"#D8FFFB\"/><circle cx=\"67.6\" cy=\"52\" r=\"2.6\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"67.6\" cy=\"52\" r=\"0.95\" fill=\"#D8FFFB\"/><circle cx=\"75.6\" cy=\"50.2\" r=\"2.34\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"75.6\" cy=\"50.2\" r=\"0.85\" fill=\"#D8FFFB\"/><circle cx=\"82.2\" cy=\"46.8\" r=\"2.08\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"82.2\" cy=\"46.8\" r=\"0.76\" fill=\"#D8FFFB\"/><circle cx=\"49.4\" cy=\"39.8\" r=\"1.56\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"49.4\" cy=\"39.8\" r=\"0.57\" fill=\"#D8FFFB\"/><circle cx=\"60.2\" cy=\"43\" r=\"1.56\" fill=\"#43D3D4\" opacity=\".22\"/><circle cx=\"60.2\" cy=\"43\" r=\"0.57\" fill=\"#D8FFFB\"/></g><path display=\"none\" d=\"M31 36C33 22 46 11.5 63 11.5C80 11.5 93 22 94.5 34.5C95.6 46 86.5 56.5 69 57.5C51 58.5 34 51 31 36Z\"/><g class=\"lu-lure\"><path fill=\"none\" stroke=\"#4C97AC\" stroke-width=\"1.5\" stroke-linecap=\"round\" d=\"M77 13.2C76.6 3.6 92 -5 98 3.4\"/><g transform=\"translate(98 3.4)\"><circle class=\"lu-bulb\" r=\"7.5\" fill=\"#43D3D4\" opacity=\".3\"/><circle fill=\"#F0C76A\" r=\"3.5\"/><circle fill=\"#43D3D4\" r=\"2.6\"/><circle fill=\"#F2FFFE\" cx=\"-.9\" cy=\"-.9\" r=\"1\"/></g></g><ellipse fill=\"#F2A08A\" opacity=\".55\" cx=\"77.6\" cy=\"37.4\" rx=\"3.9\" ry=\"2.5\"/><g class=\"lu-eye\"><circle fill=\"#CDEEF3\" cx=\"80\" cy=\"27\" r=\"6.8\"/><g><circle fill=\"#06131D\" cx=\"80.5\" cy=\"27.4\" r=\"5.44\"/><path fill=\"none\" stroke=\"#2A8CA3\" stroke-width=\".9\" stroke-linecap=\"round\" d=\"M76.74 29.45Q80.5 33.53 84.08 29.04\"/><circle fill=\"#fff\" cx=\"82.04\" cy=\"25.1\" r=\"2.04\"/><circle fill=\"#fff\" cx=\"77.96\" cy=\"29.18\" r=\"0.88\"/></g><path fill=\"#1D4C70\" d=\"M75.5 21.74A6.92 6.92 0 0 1 84.5 21.74Q80 23.84 75.5 21.74Z\"/><path fill=\"none\" stroke=\"#0A1F33\" stroke-width=\".85\" stroke-linecap=\"round\" d=\"M75.5 21.74Q80 23.84 84.5 21.74\"/></g><path fill=\"none\" stroke=\"#C4F0F3\" stroke-width=\"1.35\" stroke-linecap=\"round\" d=\"M74.22 18.8Q79.32 15.6 85.44 17.4\"/><g><path fill=\"none\" stroke=\"#06131D\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M94.2 43.4Q89.4 38.6 83.2 43.8\"/></g><g class=\"lu-fin\"><path fill=\"#43D3D4\" fill-opacity=\".17\" stroke=\"#96E0E8\" stroke-opacity=\".62\" stroke-width=\".75\" stroke-linejoin=\"round\" d=\"M66.6 41.4C60.6 40.8 53.6 43.2 49.8 48.2q2.4.3 3.2 2.7q2.6-.7 4.1 1.3q2.4-1.3 4.6.3C63.8 50.6 66.8 46.2 67.6 43Z\"/><path fill=\"none\" stroke=\"#A0E6EC\" stroke-opacity=\".42\" stroke-width=\".55\" stroke-linecap=\"round\" d=\"M66 42.2L51.6 48.4M66.2 43L56.2 51.4M66.6 43.8L61.6 52.4\"/></g>"};
  function lumiSVG(cls, sad){
    return '<svg class="'+cls+'" viewBox="0 -26 112 112" '+(cls.indexOf('mascot')>=0?'role="img" aria-label="Lumi, the Coral Cove anglerfish mascot"':'aria-hidden="true"')+'>'+(sad?LUMI_ART.sad:LUMI_ART.n)+'</svg>';
  }

  function mascotTurtleSVG(cls){
    return '' +
    '<svg class="'+cls+'" viewBox="0 0 140 140" role="img" aria-label="Coral Cove turtle mascot">' +
      '<ellipse cx="70" cy="86" rx="16" ry="10" fill="var(--seaweed)" opacity="0.55"/>' +
      '<ellipse cx="24" cy="70" rx="15" ry="10" fill="var(--lagoon)" transform="rotate(-24 24 70)"/>' +
      '<ellipse cx="116" cy="70" rx="15" ry="10" fill="var(--lagoon)" transform="rotate(24 116 70)"/>' +
      '<ellipse cx="34" cy="108" rx="13" ry="9" fill="var(--lagoon)" transform="rotate(20 34 108)"/>' +
      '<ellipse cx="106" cy="108" rx="13" ry="9" fill="var(--lagoon)" transform="rotate(-20 106 108)"/>' +
      '<ellipse cx="70" cy="82" rx="44" ry="36" fill="var(--seaweed)"/>' +
      '<ellipse cx="70" cy="80" rx="37" ry="30" fill="var(--lagoon-light)"/>' +
      '<path d="M70 54 L92 72 L84 100 L56 100 L48 72 Z" fill="var(--seaweed)" opacity="0.55"/>' +
      '<circle cx="70" cy="40" r="22" fill="var(--lagoon)"/>' +
      '<circle cx="61" cy="35" r="4.2" fill="#0b2b33"/>' +
      '<circle cx="79" cy="35" r="4.2" fill="#0b2b33"/>' +
      '<circle cx="62.4" cy="33.6" r="1.3" fill="#fff"/>' +
      '<circle cx="80.4" cy="33.6" r="1.3" fill="#fff"/>' +
      '<path d="M62 48 Q70 54 78 48" stroke="#0b2b33" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '</svg>';
  }

  // Small swimming-turtle avatar for the round progress bar — same face/color language as
  // mascotSVG above, just simplified to fit a 44px badge, with a frown for a wrong answer.
  function critterSVG(sad){
    return critterTurtleSVG(sad).replace('<svg ','<svg class="cl-turtle" ') + lumiSVG('cl-lumi', sad);
  }
  function critterTurtleSVG(sad){
    var mouth = sad
      ? '<path d="M61 51 Q70 43 79 51" stroke="#0b2b33" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<path d="M61 46 Q70 54 79 46" stroke="#0b2b33" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    var brows = sad
      ? '<path d="M55 27 Q60 22 66 26" stroke="#0b2b33" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M85 27 Q80 22 74 26" stroke="#0b2b33" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      : '';
    return '' +
    '<svg viewBox="0 0 140 140" role="img" aria-hidden="true">' +
      '<ellipse cx="22" cy="78" rx="16" ry="9" fill="var(--lagoon)" transform="rotate(-18 22 78)"/>' +
      '<ellipse cx="118" cy="78" rx="16" ry="9" fill="var(--lagoon)" transform="rotate(18 118 78)"/>' +
      '<ellipse cx="70" cy="94" rx="40" ry="32" fill="var(--seaweed)"/>' +
      '<ellipse cx="70" cy="92" rx="33" ry="26" fill="var(--lagoon-light)"/>' +
      '<circle cx="70" cy="42" r="25" fill="var(--lagoon)"/>' +
      brows +
      '<circle cx="61" cy="38" r="4.6" fill="#0b2b33"/>' +
      '<circle cx="79" cy="38" r="4.6" fill="#0b2b33"/>' +
      '<circle cx="62.6" cy="36.4" r="1.4" fill="#fff"/>' +
      '<circle cx="80.6" cy="36.4" r="1.4" fill="#fff"/>' +
      mouth +
    '</svg>';
  }

  function isPlayingView(){
    return ['study','feed','story','equationFeed','langFeed','readAlong','miniStory','flashFeed'].indexOf(S.view) >= 0;
  }

  function subscribeDecks(){
    if(S.unsubDecks) S.unsubDecks();
    S.unsubDecks = S.store.listenDecks(function(decks){
      S.decks = decks;
      if(!S.booted) return;
      if(isPlayingView()) return;
      if(S.view === 'home'){ refreshDueCounts().then(render); } else { render(); }
    });
  }

  function refreshDueCounts(){
    var now = Date.now();
    return Promise.all(S.decks.map(function(d){
      return S.store.getCardsOnce(d.id).then(function(cards){
        // Counts what a round can actually offer right now -- cards due for review plus the new
        // cards the deck's new-card window lets in (see buildStudyPool). Counting every unseen
        // card made big decks say "300 to review" when only a handful were really available.
        var reviewDue = cards.filter(function(c){ return cardState(c) !== 'new' && (c.due||0) <= now; }).length;
        var newCount = cards.filter(function(c){ return cardState(c) === 'new'; }).length;
        var inFlight = cards.filter(function(c){
          var st = cardState(c);
          return st !== 'new' && !(st === 'review' && (c.interval||0) >= MASTERY_INTERVAL_DAYS);
        }).length;
        var due = reviewDue + Math.min(newCount, Math.max(0, NEW_CARD_WINDOW - inFlight));
        S.dueCounts[d.id] = { due: due, total: cards.length };
      });
    }));
  }

  function coveDueSig(){ return JSON.stringify(S.decks.map(function(d){ var c = S.dueCounts[d.id]; return c ? c.due + '/' + c.total : '-'; })); }
  function coveRefreshHome(){
    var have = S.decks.length && S.decks.every(function(d){ return S.dueCounts[d.id]; });
    if(!have) return refreshDueCounts().then(render);
    var before = coveDueSig();
    render();
    return refreshDueCounts().then(function(){ if(S.view === 'home' && coveDueSig() !== before) render(); });
  }
  function goHomeNow(){
    // A single choke point for leaving ANY screen back to the deck grid -- covers Word Feed's sound
    // player too, so it always stops here no matter which path led out (the exit button, a PIN
    // clearing, Adult Mode's no-PIN early exit, ...) rather than needing its own cleanup on each one.
    Ambience.stop();
    try { Speech.stop(); } catch(e){}
    clearPlanTimer();
    S.planRun = null;
    S.feedSoundId = null;
    S.soundPickerOpen = false;
    S.view = 'home';
    S.currentDeckId = null;
    if(S.unsubCards){ S.unsubCards(); S.unsubCards = null; }
    coveRefreshHome();
  }

  // Adult Mode's "✅ Done" button -- there's no "choose child/adult" screen to fall back to anymore
  // (mode lives on the profile, not chosen per visit), so leaving Manage Decks now means leaving the
  // profile entirely, back to the picker. Adult Mode was always PIN-free, so this asks for nothing.
  function exitManager(){
    S.currentDeckId = null;
    if(S.unsubCards){ S.unsubCards(); S.unsubCards = null; }
    goToPicker();
  }

  /* ---------- HOME ---------- */
  var DECK_FILTERS = [
    { id: 'all', label: 'All decks' },
    { id: 'live', label: 'Live' },
    { id: 'archived', label: 'Archived' }
  ];

  function renderHome(){
    var managing = S.managingDecks;
    if(reefGame() && !S.editMode) S.subjectFilter = S.reefPlace || 'all';
    // Edit Mode -- not the same as Adult Mode -- is what now shows archived decks and the
    // Live/Archived tabs, per-deck editing/archiving, and deck creation/import. Adult Mode flips it
    // on for free; Child Mode has to clear the PIN first (see requestEditMode/toggleEditMode).
    var editMode = S.editMode;
    var banner = (S.store.live ? '' : '<div class="banner">ℹ️ Try-it-out mode — your decks won\'t be saved after you close this page.</div>') + errorBannerHTML();
    // Archived decks are only ever shown inside Edit Mode -- everywhere else (including the normal
    // Adult Mode deck grid now) they're filtered out before the deck grid is built.
    var visibleDecks = editMode ? S.decks : S.decks.filter(function(d){ return !d.archived; });
    var filterTabsHTML = '';
    if(editMode){
      var filter = S.deckFilter || 'all';
      visibleDecks = visibleDecks.filter(function(d){
        if(filter === 'live') return !d.archived;
        if(filter === 'archived') return !!d.archived;
        return true;
      });
      var tabsHTML = DECK_FILTERS.map(function(f){
        var count = S.decks.filter(function(d){
          if(f.id === 'live') return !d.archived;
          if(f.id === 'archived') return !!d.archived;
          return true;
        }).length;
        return '<button type="button" class="filter-tab'+(filter===f.id?' active':'')+'" data-filter="'+f.id+'">'+f.label+' <span class="filter-count">'+count+'</span></button>';
      }).join('');
      filterTabsHTML = '<div class="filter-tabs" role="group" aria-label="Filter decks">'+tabsHTML+'</div>';
    }
    // Subject tabs (Reading / Math / Korean / ...) sit below the archive filter and apply to both
    // the kid home screen and Manage Decks -- built from whatever's actually tagged in the current
    // scope (already narrowed by the Live/Archived filter above), so they only ever show subjects
    // that have at least one deck behind them right now.
    var subjectTabsHTML = '';
    var subjectTabs = buildSubjectTabs(visibleDecks);
    if(subjectTabs){
      if(S.subjectFilter !== 'all' && !subjectTabs.some(function(t){ return t.id === S.subjectFilter; })){
        S.subjectFilter = 'all'; // the tagged deck we were filtered to is gone (archived/edited/deleted)
      }
      var subjFilter = S.subjectFilter || 'all';
      var subjChips = '<button type="button" class="subject-tab'+(subjFilter==='all'?' active':'')+'" data-subject-filter="all">🌈 All <span class="filter-count">'+visibleDecks.length+'</span></button>' +
        subjectTabs.map(function(t){
          return '<button type="button" class="subject-tab'+(subjFilter===t.id?' active':'')+'" data-subject-filter="'+esc(t.id)+'">'+t.icon+' '+esc(t.label)+' <span class="filter-count">'+t.count+'</span></button>';
        }).join('');
      subjectTabsHTML = '<div class="subject-tabs" role="group" aria-label="Filter by subject">'+subjChips+'</div>';
      if(subjFilter !== 'all'){
        visibleDecks = visibleDecks.filter(function(d){ return (d.subject ? subjectMeta(d.subject).id : 'other') === subjFilter; });
      }
    } else {
      S.subjectFilter = 'all';
    }
    if(managing){
      // Adult Mode's grid is a "most recent decks" format now that the Live/Archived tabs aren't
      // shown by default (they moved into Edit Mode): most recently studied or edited first, with
      // never-opened decks falling to the back in their original creation order. Child Mode keeps
      // its own stable, creation-order grid -- re-sorting a kid's decks after every study session
      // would just be confusing.
      visibleDecks = visibleDecks.slice().sort(function(a, b){
        var diff = (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0);
        return diff !== 0 ? diff : ((a.order || 0) - (b.order || 0));
      });
    }
    var deckTiles = visibleDecks.map(function(d){
      var dc = S.dueCounts[d.id] || { due:0, total:0 };
      var archived = !!d.archived;
      var isFeed = !!d.feedMode;
      var isStory = !isFeed && !!d.storyMode;
      var isEquation = !isFeed && !isStory && !!d.equationMode;
      var isLang = !isFeed && !isStory && !isEquation && !!d.langFeedMode;
      var isReadAlong = !isFeed && !isStory && !isEquation && !isLang && !!d.readAlongMode;
      var isFlash = !isFeed && !isStory && !isEquation && !isLang && !isReadAlong && !!d.flashFeedMode;
      var isMini = !isFeed && !isStory && !isEquation && !isLang && !isReadAlong && !isFlash && !!d.miniStoryMode;
      // Word Feed, Story Mode, Equation Feed, Language Feed and Read-Along decks are pure browsing,
      // not spaced-repetition -- "due" is meaningless for them, so they get their own simple badge
      // instead of the due/all-caught-up language.
      var badge = isFeed
        ? '<span class="deck-badge feed">🎬 Word Feed</span>'
        : (isStory
          ? '<span class="deck-badge feed">📜 Story Mode</span>'
          : (isEquation
            ? '<span class="deck-badge feed">🧮 Equation Feed</span>'
            : (isLang
              ? '<span class="deck-badge feed">🌐 Language Feed</span>'
              : (isReadAlong
                ? '<span class="deck-badge feed">🔤 Read-Along</span>'
                : (isFlash ? '<span class="deck-badge feed">🃏 Flash Feed</span>' : (isMini ? '<span class="deck-badge feed">🎞️ Mini Story</span>' : (dc.total === 0
                  ? '<span class="deck-badge">No cards yet</span>'
                  : (dc.due > 0
                    ? (S.managingDecks || S.editMode ? '<span class="deck-badge due">'+dc.due+' due for review</span>' : '<span class="deck-badge due">🐚 Ready</span>')
                    : (S.managingDecks || S.editMode ? '<span class="deck-badge">Nothing due 🎉</span>' : '<span class="deck-badge">All done! 🎉</span>')))))))));
      var diveLabel = isFeed ? '▶️ Watch & Listen' : (isStory ? '📜 Read the Story' : (isEquation ? '🧮 Solve & Listen' : (isLang ? '🌐 Learn Words' : (isReadAlong ? '🔤 Tap & Read' : (isFlash ? '🃏 Swipe & Flip' : (isMini ? '🎞️ Read the Pictures' : 'Dive In'))))));
      return '' +
      '<div class="deck-card'+(editMode && archived ? ' archived' : '')+(S.managingDecks || S.editMode ? '' : ' kid')+'" data-subj="'+esc(d.subject ? subjectMeta(d.subject).id : 'other')+'">' +
        (editMode && archived ? '<span class="archived-tag">📦 Archived</span>' : '') +
        '<div class="deck-emoji">'+d.emoji+'</div>' +
        '<h3 class="deck-name">'+esc(d.name)+'</h3>' +
        '<div class="deck-meta">'+(S.managingDecks || S.editMode ? dc.total+' card'+(dc.total===1?'':'s') : '🃏 '+dc.total)+'</div>' +
        badge +
        '<div class="deck-actions">' +
          '<button class="btn btn-primary" data-act="study" data-deck="'+d.id+'" '+(dc.total===0?'disabled':'')+'>'+diveLabel+'</button>' +
          (editMode ? '<button class="icon-btn" data-act="edit-deck" data-deck="'+d.id+'" title="Edit deck" aria-label="Edit '+esc(d.name)+'">✏️</button>' : '') +
          (editMode ? '<button class="icon-btn" data-act="toggle-archive" data-deck="'+d.id+'" title="'+(archived?'Unarchive':'Archive')+' deck" aria-label="'+(archived?'Unarchive':'Archive')+' '+esc(d.name)+'">'+(archived?'📤':'📦')+'</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    app.innerHTML = '' +
      '<div class="cv3-hero'+(managing ? ' adult' : '')+(editMode ? ' edit' : '')+'">' +
      '<div class="topbar">' +
        '<div class="brand">' +
          '<div class="brand-block">' +
            '<h1 class="brand-title">Coral Cove</h1>' +
            '<p class="brand-tag">'+(editMode ? '✏️ Edit Mode — arrange and archive decks' : (managing ? '🔧 Adult Mode — kids can\'t see this screen' : 'Dive in and practice!'))+'</p>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
          (managing ? '' :
          '<div class="stats-row">' +
            '<div class="pill streak"><span class="icon">🔥</span><span class="tabular">'+currentStreak()+'</span></div>' +
            '<div class="pill stars"><span class="icon">⭐</span><span class="tabular">'+S.stats.stars+'</span></div>' +
          '</div>') +
          ((managing || editMode) ? '<button type="button" class="icon-btn" data-act="open-settings" title="Settings" aria-label="Study settings">⚙️</button>' : '') +
          '<button type="button" class="icon-btn" data-act="open-library" title="Library" aria-label="Open the Library">📚</button>' +
          '<button type="button" class="icon-btn" data-act="open-stats" title="Progress" aria-label="View progress">📊</button>' +
          '<button type="button" class="icon-btn" data-act="toggle-edit-mode" title="'+(editMode?'Exit Edit Mode':'Edit Mode')+'" aria-label="'+(editMode?'Exit Edit Mode':'Enter Edit Mode')+'">'+(editMode?'🔓':'✏️')+'</button>' +
          (managing ? '<button type="button" class="btn btn-ghost" data-act="exit-manager">✅ Done</button>' : ctrlRowHTML()) +
        '</div>' +
      '</div>' +
      coveWaterHTML('home') +
      '</div>' +
      banner +
      planHomeCardHTML() +
      (S.managingDecks ? coveAdultStrip(visibleDecks) : '') +
      filterTabsHTML +
      subjectTabsHTML +
      (!visibleDecks.length ? '<div class="empty-filter-note">'+(editMode && S.deckFilter==='archived' ? 'No archived decks.' : (subjectTabs && S.subjectFilter!=='all' ? 'No decks tagged with this subject yet.' : 'No decks here.'))+'</div>' : '') +
      '<div class="deck-grid">' +
        deckTiles +
        ((S.subjectFilter || 'all') === 'all' ? '<div class="deck-card story-maker-card'+(S.managingDecks || S.editMode ? '' : ' kid')+'">' +
          '<div class="deck-emoji">✨</div>' +
          '<h3 class="deck-name">Story Maker</h3>' +
          (S.managingDecks || S.editMode ? '<div class="deck-meta">Builds a new short story from this profile\'s words</div>' : '') +
          '<span class="deck-badge feed">'+(S.managingDecks || S.editMode ? '🎞️ New every time' : '🎞️ New') +'</span>' +
          '<div class="deck-actions"><button class="btn btn-primary" data-act="story-maker">✨ Make a Story</button></div>' +
        '</div>' : '') +
        // Word Bank sits on adult profiles' home screens (and in Edit Mode); a child's home screen keeps
        // its familiar layout unless a grown-up turns it on (profile.wordBankOn).
        ((S.subjectFilter || 'all') === 'all' && (S.managingDecks || S.editMode || (S.profile && (S.profile.mode === 'adult' || S.profile.wordBankOn))) ? '<div class="deck-card story-maker-card word-bank-card'+(S.managingDecks || S.editMode ? '' : ' kid')+'">' +
          '<div class="deck-emoji">📒</div>' +
          '<h3 class="deck-name">Word Bank</h3>' +
          (S.managingDecks || S.editMode ? '<div class="deck-meta">Every word in these decks: new, learning or known</div>' : '') +
          '<span class="deck-badge feed">✅ My words</span>' +
          '<div class="deck-actions"><button class="btn btn-primary" data-act="word-bank">📒 Open</button></div>' +
        '</div>' : '') +
        (editMode ? '<button type="button" class="add-deck-card" data-act="new-deck"><span class="plus">＋</span><span>New Deck</span></button>' : '') +
        (editMode ? '<button type="button" class="add-deck-card" data-act="import-anki"><span class="plus">📥</span><span>Import Anki deck</span></button>' : '') +
      '</div>' +
      (editMode ? '<input type="file" id="ankiImportInput" accept=".txt,.csv,.tsv" style="display:none">' : '');

    app.querySelectorAll('[data-act="study"]').forEach(function(b){
      b.addEventListener('click', function(){ reefGo('dive', b, function(){
        var d = S.decks.find(function(x){ return x.id === b.dataset.deck; });
        if(d && d.feedMode) startFeed(b.dataset.deck);
        else if(d && d.storyMode) startStory(b.dataset.deck);
        else if(d && d.equationMode) startEquationFeed(b.dataset.deck);
        else if(d && d.langFeedMode) startLangFeed(b.dataset.deck);
        else if(d && d.readAlongMode) startReadAlong(b.dataset.deck);
        else if(d && d.flashFeedMode) startFlashFeed(b.dataset.deck);
        else if(d && d.miniStoryMode) startMiniStory(b.dataset.deck);
        else startStudy(b.dataset.deck);
      }); });
    });
    app.querySelector('[data-act="open-stats"]').addEventListener('click', openStats);
    var libBtn = app.querySelector('[data-act="open-library"]'); if(libBtn) libBtn.addEventListener('click', function(){ if(window.CoralLibrary) window.CoralLibrary.open(); });
    wirePlanHome();
    var smBtn = app.querySelector('[data-act="story-maker"]');
    if(smBtn) smBtn.addEventListener('click', startStoryMaker);
    var wbBtn = app.querySelector('[data-act="word-bank"]');
    if(wbBtn) wbBtn.addEventListener('click', openWordBank);
    app.querySelectorAll('[data-subject-filter]').forEach(function(b){
      b.addEventListener('click', function(){
        if(S.subjectFilter === b.dataset.subjectFilter) return;
        S.subjectFilter = b.dataset.subjectFilter;
        render();
      });
    });
    var editModeBtn = app.querySelector('[data-act="toggle-edit-mode"]');
    if(editModeBtn) editModeBtn.addEventListener('click', toggleEditMode);
    if(editMode){
      app.querySelectorAll('[data-act="edit-deck"]').forEach(function(b){ b.addEventListener('click', function(){ openEditor(b.dataset.deck); }); });
      app.querySelectorAll('[data-act="toggle-archive"]').forEach(function(b){
        b.addEventListener('click', function(){
          var d = S.decks.find(function(x){ return x.id === b.dataset.deck; });
          S.store.updateDeck(b.dataset.deck, { archived: !(d && d.archived) });
        });
      });
      app.querySelectorAll('[data-filter]').forEach(function(b){
        b.addEventListener('click', function(){
          if(S.deckFilter === b.dataset.filter) return;
          S.deckFilter = b.dataset.filter;
          render();
        });
      });
      var kidSettingsBtn = managing ? null : app.querySelector('[data-act="open-settings"]');
      if(kidSettingsBtn) kidSettingsBtn.addEventListener('click', function(){ S.view = 'settings'; render(); });
      var newBtn = app.querySelector('[data-act="new-deck"]');
      if(newBtn) newBtn.addEventListener('click', createDeck);
      var ankiInput = app.querySelector('#ankiImportInput');
      var importBtn = app.querySelector('[data-act="import-anki"]');
      if(importBtn && ankiInput){
        importBtn.addEventListener('click', function(){ ankiInput.click(); });
        ankiInput.addEventListener('change', function(){
          var file = ankiInput.files && ankiInput.files[0];
          ankiInput.value = '';
          if(file) handleAnkiImportFile(file);
        });
      }
    }
    if(managing){
      var settingsBtn = app.querySelector('[data-act="open-settings"]');
      if(settingsBtn) settingsBtn.addEventListener('click', function(){ S.view = 'settings'; render(); });
      var doneBtn = app.querySelector('[data-act="exit-manager"]');
      if(doneBtn) doneBtn.addEventListener('click', exitManager);
    } else {
      wireCtrlRow();
    }
    wireErrorBanner();
    reefHome();
  }

  function createDeck(){
    var emoji = DECK_EMOJI[Math.floor(Math.random()*DECK_EMOJI.length)];
    S.store.addDeck({ name: 'New Deck', emoji: emoji, order: S.decks.length }).then(function(id){
      openEditor(id, true);
    });
  }

  /* ---------- ANKI IMPORT ----------
     Scoped deliberately to Anki's plain-text export (File -> Export -> "Notes in Plain Text"),
     which is tab- or comma-separated with optional "#"-prefixed header lines -- NOT the zipped
     .apkg format, which would need a SQLite reader Coral Cove has no way to load. */
  function stripAnkiHtml(s){
    s = String(s == null ? '' : s);
    s = s.replace(/\[sound:[^\]]*\]/gi, '');
    s = s.replace(/<[^>]+>/g, ' ');
    var ta = document.createElement('textarea');
    ta.innerHTML = s;
    s = ta.value;
    return s.replace(/\s+/g, ' ').trim();
  }

  function parseAnkiPlainText(text){
    var lines = String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    // "#"-prefixed lines are Anki's own export metadata (#separator:tab, #html:true, ...) -- not data.
    var dataLines = lines.filter(function(l){ return l.trim() && l.trim().charAt(0) !== '#'; });
    if(!dataLines.length) return [];
    var delim = dataLines.some(function(l){ return l.indexOf('\t') !== -1; }) ? '\t' : ',';
    var cards = [];
    dataLines.forEach(function(l){
      var fields = l.split(delim);
      var front = stripAnkiHtml(fields[0]);
      var back = stripAnkiHtml(fields[1]);
      if(front && back) cards.push({ front: front, back: back });
    });
    return cards;
  }

  function handleAnkiImportFile(file){
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = parseAnkiPlainText(String(reader.result || ''));
      if(!parsed.length){
        S.storeError = 'Couldn’t find any cards in that file. Coral Cove reads Anki’s plain-text export (File → Export → "Notes in Plain Text") with a Front and Back column — not the .apkg format.';
        render();
        return;
      }
      var suggested = file.name.replace(/\.(txt|csv|tsv)$/i, '') || 'Imported Deck';
      showDialog({ title: 'Name this new deck', message: parsed.length+' card'+(parsed.length===1?'':'s')+' found.', input: { value: suggested, placeholder: 'Deck name' }, confirmLabel: 'Import' }).then(function(name){
      if(name == null) return;
      var emoji = DECK_EMOJI[Math.floor(Math.random()*DECK_EMOJI.length)];
      S.store.addDeck({ name: name.trim() || 'Imported Deck', emoji: emoji, order: S.decks.length }).then(function(deckId){
        return Promise.all(parsed.map(function(c){
          return S.store.addCard(deckId, { front: c.front, back: c.back, note: '', mode: 'flip', choices: [], category: '', photoId: '', photoUrl: '' });
        }));
      }).then(function(){
        render();
      }).catch(function(err){
        console.error('[Coral Cove] Anki import failed', err);
        S.storeError = 'That import didn’t finish saving. Check your connection and try again.';
        render();
      });
      });
    };
    reader.onerror = function(){
      S.storeError = 'Couldn’t read that file — please try again.';
      render();
    };
    reader.readAsText(file);
  }

