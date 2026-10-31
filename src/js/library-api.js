  /* ---------- The Library (library.js) sits beside the app, off the board. This is all it can reach. ---------- */
  // A profile's learning goals are deck subjects (SUBJECTS ids, or a custom subject). Until a grown-up picks them in
  // the Library's settings, they are the subjects of the profile's live decks, most decks first.
  function profileGoals(){
    if(!S.profile) return [];
    if(Array.isArray(S.profile.goals) && S.profile.goals.length) return S.profile.goals.slice();
    var n = {};
    (S.decks || []).forEach(function(d){ if(!d.archived && d.subject) n[d.subject] = (n[d.subject] || 0) + 1; });
    return Object.keys(n).sort(function(a, b){ return n[b] - n[a]; });
  }
  window.CoralCove = {
    profile: function(){ return S.profile ? { id: S.profile.id, name: S.profile.name, child: S.profile.mode === 'child', goals: profileGoals(), goalsSet: Array.isArray(S.profile.goals) && S.profile.goals.length > 0 } : null; },
    subjects: function(){ return SUBJECTS.map(function(s){ return { id: s.id, icon: s.icon, label: s.label }; }); },
    setGoals: function(list){
      if(!S.profile || !Array.isArray(list)) return Promise.resolve(false);
      S.profile.goals = list.slice(0, 6);
      return Promise.resolve(S.store.updateProfile(S.profile.id, { goals: S.profile.goals })).then(function(){ return true; }, function(){ return false; });
    },
    decks: function(){ return (S.decks || []).filter(function(d){ return !d.archived; }).map(function(d){ return { id: d.id, name: d.name, emoji: d.emoji || '🌊', subject: d.subject || '' }; }); },
    cards: function(id){ return S.store ? S.store.getCardsOnce(id) : Promise.resolve([]); },
    history: function(){ return S.store && S.store.getHistoryOnce ? S.store.getHistoryOnce() : Promise.resolve([]); },
    stats: function(){ return S.stats || {}; },
    speak: function(t, o){ try { Speech.speak(t, o); } catch(e){} },
    stopSpeaking: function(){ try { if(window.speechSynthesis) speechSynthesis.cancel(); } catch(e){} },
    sound: function(name){ try { if(Sound[name]) Sound[name](); } catch(e){} },
    startDeck: function(id){ reefStartDeck(id); },
    night: function(){ try { return reefNight(); } catch(e){ return false; } },
    calm: function(){ try { return reefCalm(); } catch(e){ return false; } },
    // false in the Claude version and inside a grown-up profile, where the app asks no grown-up questions
    // Coral Classroom (library.js): any profile can have a course; it's saved on the profile. Until a profile says
    // otherwise (courseOn), it's on for Wendy only.
    courseOn: function(){ return reefCourseOn(); },
    course: function(){ return reefCourseOn() && S.profile.course ? S.profile.course : null; },
    setCourse: function(c){ if(!S.profile) return Promise.resolve(false); S.profile.course = c; S.profile.courseOn = true;
      return Promise.resolve(S.store.updateProfile(S.profile.id, { course: c, courseOn: true })).then(function(){ return true; }, function(){ return false; }); },
    setCourseOn: function(on){ if(!S.profile) return Promise.resolve(false); S.profile.courseOn = !!on;
      return Promise.resolve(S.store.updateProfile(S.profile.id, { courseOn: !!on })).then(function(){ return true; }, function(){ return false; }); },
    needsGrownUpCheck: function(){ return !reefNoPin() && !reefInsideAdult('library'); }
  };
  // Runs at the end of renderHome(): outside Edit Mode the deck menu becomes the reef (every profile).
  function reefHome(){
    if(!reefGame() || S.editMode) return;
    var zones = reefZones();
    if(!zones.length){
      // Just opened and the decks (or their card counts) aren't in yet: keep the calm-water cover up instead of
      // flashing the plain screen. A profile that really has no decks gets its normal screen after 2.5 seconds.
      var pid = S.profile && S.profile.id;
      if(reefHome.pid !== pid){ reefHome.pid = pid; reefHome.at = Date.now(); }
      var counting = S.decks.some(function(d){ return !d.archived && !S.dueCounts[d.id]; });
      var fresh = !S.decks.length && Date.now() - reefHome.at < 2500;
      if((counting || fresh) && !R3.failed){
        document.body.classList.add('r3-full', 'r3-loading');
        clearTimeout(reefHome.coverT); reefHome.coverT = setTimeout(function(){ if(!document.querySelector('.r3')) document.body.classList.remove('r3-full', 'r3-loading'); }, counting ? 8000 : 2500 - (Date.now() - reefHome.at));
      }
      return;
    }
    ['.subject-tabs', '.deck-grid', '.empty-filter-note'].forEach(function(sel){ var e = app.querySelector(sel); if(e) e.hidden = true; });
    var holder = document.createElement('div');
    holder.innerHTML = reefWorldHTML(zones);
    var el = holder.firstChild, grid = app.querySelector('.deck-grid');
    if(grid) grid.parentNode.insertBefore(el, grid); else app.appendChild(el);
    el.querySelectorAll('[data-reef-deck]').forEach(function(b){
      b.addEventListener('click', function(){
        Sound.bloop(520);
        S.reefReturnY = window.scrollY;
        var id = b.dataset.reefDeck;
        reefGo('dive', b, function(){ reefStartDeck(id); });
      });
    });
    var chest = el.querySelector('[data-reef-special="treasure"]');
    if(chest) chest.addEventListener('click', function(){ Sound.bloop(600); S.reefReturnY = window.scrollY; reefGo('swim', chest, function(){ S.view = 'collection'; render(); window.scrollTo(0, 0); }); });
    var bottle = el.querySelector('[data-reef-special="story"]');
    if(bottle) bottle.addEventListener('click', function(){ S.reefReturnY = window.scrollY; reefGo('dive', bottle, startStoryMaker); });
    reefWireSay(el);
    reefHeadOnce(el);
    reefParallaxWire();
    reef3dMount(el, zones);
    reefWinLoad(); // get the celebration music ready before the first right answer
    if(S.reefReturnY != null){ var y = S.reefReturnY; S.reefReturnY = null; requestAnimationFrame(function(){ window.scrollTo(0, y); reefParallax(); }); }
    else reefParallax();
  }

  // Coral Classroom, for the app: is it on for this profile, and which unit is she on (the earliest not finished)?
  function reefCourseOn(){ var p = S.profile; if(!p) return false; return p.courseOn != null ? !!p.courseOn : /^wendy$/i.test(p.id || '') || /^wendy$/i.test(p.name || ''); }
  function reefCourseNow(){
    var co = reefCourseOn() && S.profile.course; if(!co || !co.units) return null;
    for(var i = 0; i < co.units.length; i++) if(!co.units[i].done) return { co: co, unit: co.units[i], i: i };
    return { co: co, unit: null, i: co.units.length };
  }
  // The decks the Daily Plan should draw on: this unit's, plus the two units before it (spaced review)
  function reefCourseDecks(){
    var n = reefCourseNow(); if(!n || !n.unit) return null;
    var ids = {}, add = function(u){ (u.decks || []).forEach(function(dk){ ids[dk.id] = 1; if(dk.fluency) ids[dk.fluency] = 1; }); };
    n.co.units.slice(Math.max(0, n.i - 2), n.i + 1).forEach(add);
    var list = Object.keys(ids); return list.length ? list : null;
  }
