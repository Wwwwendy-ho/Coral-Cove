  /* ---------- DAILY PLAN (Coral Calendar, inside Coral Cove) ----------
     For profiles with planOn (Wendy). Each day gets a schedule built automatically from the profile's own
     Coral Cove decks: a warm-up (Sound Blend / Hangul Blend), review of the decks with the most cards
     due, listening, a speed round and a story, sized to the profile's daily minutes. "Start" plays the
     activities back to back; each one's results (cards, right, time, missed words) are saved to
     profiles/<id>/plan/<YYYY-MM-DD> as soon as it ends, and the daily and monthly summaries are built
     from those records plus the round history, so they're always current. The day's lineup is saved
     the first time it's shown, so it stays put for the rest of the day. */
  var PLAN_DEFAULT = { start: '19:00', minutes: 20, days: [0,1,2,3,4,5,6] };
  var PLAN_KINDS = {
    warmup:    { label: 'Warm-up',     icon: '🔥', order: 0 },
    review:    { label: 'Review',      icon: '🔁', order: 1 },
    listening: { label: 'Listening',   icon: '👂', order: 2 },
    speaking:  { label: 'Speaking',    icon: '🎙️', order: 3 },
    building:  { label: 'Sentences',   icon: '🧩', order: 4 },
    speed:     { label: 'Speed round', icon: '⏱️', order: 5 },
    story:     { label: 'Story time',  icon: '🎞️', order: 6 }
  };
  var PLAN_SEC_PER_CARD = { flip: 12, read: 12, choice: 8, match: 10, blank: 10, timedchoice: 9, blend: 12, listen: 9, echo: 25, build: 18, hanja: 14, numsys: 14 };
  var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var planCountdownTimer = null;

  function planOn(){ return !!(S.profile && S.profile.planOn); }
  function planSettings(){ return Object.assign({}, PLAN_DEFAULT, S.planSettings || {}); }
  function clearPlanTimer(){ if(planCountdownTimer){ clearInterval(planCountdownTimer); planCountdownTimer = null; } }
  function isoToDate(iso){ var p = iso.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function fmtClock(mins){ var h = Math.floor(mins/60) % 24, m = mins % 60; var ap = h >= 12 ? 'PM' : 'AM'; var h12 = h % 12 || 12; return h12 + ':' + String(m).padStart(2,'0') + ' ' + ap; }
  function startMinutes(){ var p = String(planSettings().start || '19:00').split(':'); return (+p[0]||0)*60 + (+p[1]||0); }
  function fmtDateLong(iso){ return isoToDate(iso).toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' }); }
  function fmtMins(ms){ var m = Math.round((ms||0)/60000); return m < 1 && ms > 0 ? '<1' : String(m); }

  function dominantMode(cards){
    var c = {}; cards.forEach(function(x){ var m = x.mode || 'flip'; c[m] = (c[m]||0) + 1; });
    var best = 'flip', n = -1; Object.keys(c).forEach(function(k){ if(c[k] > n){ best = k; n = c[k]; } });
    return best;
  }
  function planDeckKind(d, cards){
    if(d.miniStoryMode) return 'story';
    if(d.feedMode || d.storyMode || d.equationMode || d.langFeedMode || d.readAlongMode || d.flashFeedMode) return null; // open-ended feeds have no "done"
    if(!cards.length) return null;
    var m = dominantMode(cards);
    if(m === 'blend') return 'warmup';
    if(m === 'listen') return 'listening';
    if(m === 'echo') return 'speaking';
    if(m === 'build') return 'building';
    if(m === 'timedchoice') return 'speed';
    return 'review';
  }
  function planGenerate(date){
    var st = planSettings();
    if(!S.decks.length) return Promise.reject(new Error('decks not loaded yet'));
    var decks = S.decks.filter(function(d){ return !d.archived; });
    return Promise.all([
      Promise.all(decks.map(function(d){ return S.store.getCardsOnce(d.id).catch(function(){ return []; }); })),
      S.store.listPlanDays().catch(function(){ return []; })
    ]).then(function(res){
      var lists = res[0], past = res[1];
      var last = {};   // deckId -> most recent date it was planned
      past.forEach(function(day){ (day.blocks||[]).forEach(function(b){ var k = b.deckId || 'maker'; if(!last[k] || last[k] < day.date) last[k] = day.date; }); });
      var now = Date.now(), byKind = {};
      decks.forEach(function(d, i){
        var cards = lists[i] || [];
        var kind = planDeckKind(d, cards);
        if(!kind) return;
        var due = cards.filter(function(c){ return cardState(c) !== 'new' && (c.due||0) <= now; }).length;
        var mode = dominantMode(cards);
        var n = kind === 'story' ? 0 : Math.min(currentDifficulty().roundSize, buildStudyPool(cards).length);
        var minutes = kind === 'story' ? 3 : Math.max(2, Math.round(n * (PLAN_SEC_PER_CARD[mode] || 10) / 60));
        (byKind[kind] = byKind[kind] || []).push({ deck: d, due: due, minutes: minutes, last: last[d.id] || '' });
      });
      function pick(kind, n, byDue){
        var list = (byKind[kind] || []).slice().sort(function(a, b){
          if(byDue && b.due !== a.due) return b.due - a.due;
          if(a.last !== b.last) return a.last < b.last ? -1 : 1; // least recently planned first
          return (a.deck.order||0) - (b.deck.order||0);
        });
        return list.slice(0, n);
      }
      var review = pick('review', 2, true);
      var stories = pick('story', 1);
      var storyBlock = stories.length && (!stories[0].last || stories[0].last < todayISO(new Date(Date.now() - 3*864e5)))
        ? stories[0] : { deck: null, maker: true, minutes: 3 };
      // Priority order for fitting into the day's minutes; displayed in lesson order afterwards.
      var cand = [];
      if(review[0]) cand.push(['review', review[0]]);
      pick('warmup', 1).forEach(function(x){ cand.push(['warmup', x]); });
      pick('listening', 1).forEach(function(x){ cand.push(['listening', x]); });
      pick('speaking', 1).forEach(function(x){ cand.push(['speaking', x]); });
      pick('building', 1).forEach(function(x){ cand.push(['building', x]); });
      cand.push(['story', storyBlock]);
      if(review[1]) cand.push(['review', review[1]]);
      pick('speed', 1).forEach(function(x){ cand.push(['speed', x]); });
      var total = 0, chosen = [];
      cand.forEach(function(c){ if(!chosen.length || total + c[1].minutes <= st.minutes + 2){ chosen.push(c); total += c[1].minutes; } });
      // Short on time with few decks? Add another round of review / listening / speed (each round
      // draws fresh cards), so the session fills the minutes chosen in the schedule.
      var extra = cand.filter(function(c){ return c[0] !== 'story' && c[0] !== 'warmup'; });
      for(var round = 0; extra.length && round < 6 && total < st.minutes - 2; round++){
        var c2 = extra[round % extra.length];
        if(total + c2[1].minutes > st.minutes + 2) break;
        chosen.push([c2[0], c2[1], Math.floor(round / extra.length) + 2]); total += c2[1].minutes;
      }
      // Lesson order: warm-up, then each pass of review → listening → speed, story always last.
      chosen.sort(function(a, b){
        var sa = a[0] === 'story' ? 1 : 0, sb = b[0] === 'story' ? 1 : 0;
        if(sa !== sb) return sa - sb;
        var pa = a[0] === 'warmup' ? 0 : (a[2] || 1), pb = b[0] === 'warmup' ? 0 : (b[2] || 1);
        if(pa !== pb) return pa - pb;
        return PLAN_KINDS[a[0]].order - PLAN_KINDS[b[0]].order;
      });
      return {
        date: date,
        createdAt: Date.now(),
        blocks: chosen.map(function(c, i){
          var x = c[1];
          return x.maker
            ? { id: 'b'+i, kind: 'story', maker: true, deckId: null, name: 'Story Maker', emoji: '✨', minutes: x.minutes, done: false }
            : { id: 'b'+i, kind: c[0], deckId: x.deck.id, name: x.deck.name, emoji: x.deck.emoji || '🌊', minutes: x.minutes, done: false, pass: c[2] || 1 };
        })
      };
    });
  }
  function planLoad(date, force){
    date = date || todayISO();
    S.planLoading = true;
    return S.store.getPlanSettings().then(function(ps){
      S.planSettings = ps || null;
      return S.store.getPlanDay(date);
    }).then(function(day){
      var off = planSettings().days.indexOf(isoToDate(date).getDay()) < 0;
      if(day && !force) return day;
      if(date !== todayISO()) return day || null;      // past days are only ever read, never invented
      if(off && !force) return { date: date, off: true, blocks: [] };
      return planGenerate(date).then(function(d){ return S.store.setPlanDay(date, d).then(function(){ return d; }); });
    }).then(function(day){
      S.planLoading = false;
      if(date === todayISO()) S.planDay = day;
      return day;
    }).catch(function(e){ S.planLoading = false; console.error('[Coral Cove] plan load failed', e); return null; });
  }
  function planSave(){ if(S.planDay && !S.planDay.off) return S.store.setPlanDay(S.planDay.date, S.planDay); return Promise.resolve(); }
  function planNextIndex(day){ day = day || S.planDay; if(!day || !day.blocks) return -1; for(var i = 0; i < day.blocks.length; i++){ if(!day.blocks[i].done) return i; } return -1; }

  function planStartNext(){
    clearPlanTimer();
    var day = S.planDay;
    if(!day || day.date !== todayISO()){ planLoad().then(function(){ planStartNext(); }); return; }
    var i = planNextIndex(day);
    if(i < 0){ S.planRun = null; S.view = 'plan'; render(); return; }
    var b = day.blocks[i];
    if(!day.startedAt){ day.startedAt = Date.now(); planSave(); }
    S.planRun = { date: day.date, index: i, startedAt: Date.now(), missed: [], recorded: false };
    // The fish flurry marks the start of an activity, except when the dive into a deck is already on screen:
    // two full-screen animations at once made the dive stutter on the iPad.
    if(!window.__reefTx){ try { Ocean.flurry(); } catch(e){} }
    if(b.maker){ startStoryMaker(); return; }
    var d = S.decks.find(function(x){ return x.id === b.deckId; });
    if(!d){ b.done = true; b.skipped = true; planSave(); planStartNext(); return; } // deck was deleted since
    if(d.miniStoryMode) startMiniStory(d.id); else startStudy(d.id);
  }
  // Saves the finished activity into today's record (called by finishStudy and the Mini Story end page).
  function planRecord(result){
    var r = S.planRun;
    if(!r || r.recorded) return;
    var day = S.planDay;
    if(!day || day.date !== r.date || !day.blocks[r.index]) return;
    var b = day.blocks[r.index];
    var seen = {};
    Object.assign(b, { done: true, ms: Date.now() - r.startedAt, endedAt: Date.now(),
      missed: r.missed.filter(function(m){ var k = m.f+'|'+m.b; if(seen[k]) return false; seen[k] = 1; return true; }).slice(0, 30) }, result || {});
    r.recorded = true;
    if(planNextIndex(day) < 0) day.finishedAt = Date.now();
    planSave();
  }
  function planNoteAnswer(card, rating){
    if(S.planRun && !S.planRun.recorded && rating === 'again') S.planRun.missed.push({ f: String(card.front||'').slice(0,60), b: String(card.back||'').slice(0,60) });
  }
  // "Next up" strip shown on the round summary and the Mini Story end page while a plan is running.
  function planNextHTML(){
    var r = S.planRun, day = S.planDay;
    if(!r || !r.recorded || !day) return '';
    var i = planNextIndex(day), doneN = day.blocks.filter(function(b){ return b.done; }).length;
    var head = '<div class="plan-next-head">📅 Today\'s plan · '+doneN+' of '+day.blocks.length+' done</div>';
    if(i < 0) return '<div class="plan-next">'+head+'<div class="plan-next-line">🎉 That was the last activity for today!</div>' +
      '<div class="plan-next-btns"><button type="button" class="btn btn-primary" data-act="plan-open">📅 See today\'s summary</button></div></div>';
    var b = day.blocks[i], k = PLAN_KINDS[b.kind] || PLAN_KINDS.review;
    return '<div class="plan-next">'+head+'<div class="plan-next-line">Next: '+k.icon+' '+k.label+' — '+esc(b.emoji)+' '+esc(b.name)+'</div>' +
      '<div class="plan-next-btns"><button type="button" class="btn btn-primary" data-act="plan-next">▶ Start now <span id="planCountdown" class="plan-count">5</span></button>' +
      '<button type="button" class="btn btn-ghost" data-act="plan-pause">⏸ Pause</button></div></div>';
  }
  function wirePlanNext(root){
    root = root || app;
    var nb = root.querySelector('[data-act="plan-next"]'), pb = root.querySelector('[data-act="plan-pause"]'), ob = root.querySelector('[data-act="plan-open"]');
    function own(el){ el.addEventListener('pointerdown', function(e){ e.stopPropagation(); }); }
    if(ob){ own(ob); ob.addEventListener('click', function(){ S.planRun = null; openPlan(); }); }
    if(pb){ own(pb); pb.addEventListener('click', function(){ clearPlanTimer(); S.planRun = null; openPlan(); }); }
    if(nb){
      own(nb);
      nb.addEventListener('click', planStartNext);
      clearPlanTimer();
      var left = 5, run = S.planRun, view = S.view;
      planCountdownTimer = setInterval(function(){
        if(S.planRun !== run || S.view !== view){ clearPlanTimer(); return; }
        left -= 1;
        var el = document.getElementById('planCountdown');
        if(el) el.textContent = left > 0 ? String(left) : '';
        if(left <= 0){ clearPlanTimer(); planStartNext(); }
      }, 1000);
    }
  }

  function openPlan(date){
    clearPlanTimer();
    S.view = 'plan';
    S.planViewDate = date || todayISO();
    S.planViewDay = null;
    render();
    planLoad(S.planViewDate).then(function(day){ S.planViewDay = day; if(S.view === 'plan') render(); });
  }
  function planDayStats(day){
    var t = { cards: 0, right: 0, ms: 0, done: 0, missed: [] };
    (day && day.blocks || []).forEach(function(b){
      if(!b.done) return;
      t.done++; t.ms += b.ms || 0; t.cards += b.total || 0; t.right += b.right || 0;
      (b.missed || []).forEach(function(m){ if(!t.missed.some(function(x){ return x.f === m.f; })) t.missed.push(m); });
    });
    t.acc = t.cards ? Math.round(t.right / t.cards * 100) : null;
    return t;
  }
  function renderPlan(){
    var date = S.planViewDate || todayISO(), isToday = date === todayISO();
    var day = isToday ? (S.planViewDay || S.planDay) : S.planViewDay;
    var st = planSettings();
    var body;
    if(!day && S.planLoading) body = '<div class="stats-section"><p>Loading the plan…</p></div>';
    else if(!day) body = '<div class="stats-section"><p>No plan was made for this day.</p></div>';
    else if(day.off) body = '<div class="stats-section"><h3>😌 No session scheduled today</h3><p class="algo-note">Today is a day off in the schedule.</p>' +
      '<button type="button" class="btn btn-primary" data-act="plan-anyway">📅 Make a plan for today anyway</button></div>';
    else {
      var t = planDayStats(day), clock = startMinutes(), nextI = planNextIndex(day);
      var rows = day.blocks.map(function(b, i){
        var k = PLAN_KINDS[b.kind] || PLAN_KINDS.review;
        var time = fmtClock(clock); clock += b.minutes || 0;
        var status = b.done
          ? (b.skipped ? '<span class="plan-status skip">skipped</span>' : '<span class="plan-status done">✅ '+(b.total ? (b.right+'/'+b.total+(S.managingDecks ? ' · '+Math.round(b.right/b.total*100)+'%' : '')) : 'done')+' · '+fmtMins(b.ms)+' min</span>')
          : (i === nextI && isToday ? '<span class="plan-status next">Up next</span>' : '<span class="plan-status"></span>');
        return '<div class="plan-row'+(b.done?' is-done':'')+(i===nextI&&isToday?' is-next':'')+'">' +
          '<div class="plan-time">'+time+'</div>' +
          '<div class="plan-what"><div class="plan-kind">'+k.label+(b.pass > 1 ? ' · round '+b.pass : '')+'</div><div class="plan-deck">'+esc(b.emoji)+' '+esc(b.name)+'</div></div>' +
          status + '</div>';
      }).join('');
      var pct = Math.round(t.done / Math.max(1, day.blocks.length) * 100);
      body = '' +
        '<div class="stats-section">' +
          '<h3>'+(isToday ? '📅 Today — ' : '📅 ')+esc(fmtDateLong(date))+'</h3>' +
          '<p class="algo-note">Starts '+fmtClock(startMinutes())+' · about '+day.blocks.reduce(function(s,b){ return s+(b.minutes||0); },0)+' min</p>' +
          '<div class="plan-bar"><span style="width:'+pct+'%"></span></div>' +
          '<div class="summary-stats plan-stats">' +
            '<div class="summary-stat"><span class="num tabular">'+t.done+'/'+day.blocks.length+'</span><span class="label">Done</span></div>' +
            '<div class="summary-stat"><span class="num tabular">'+fmtMins(t.ms)+'</span><span class="label">Minutes</span></div>' +
            '<div class="summary-stat"><span class="num tabular">'+t.cards+'</span><span class="label">Cards</span></div>' +
            (S.managingDecks ? '<div class="summary-stat"><span class="num tabular">'+(t.acc == null ? '—' : t.acc+'%')+'</span><span class="label">Right</span></div>' : '') +
          '</div>' +
          '<div class="plan-list">'+rows+'</div>' +
          (isToday ? (nextI >= 0
            ? '<button type="button" class="btn btn-primary plan-go" data-act="plan-start">▶ '+(t.done ? 'Continue' : 'Start today\'s session')+'</button>'
            : '<div class="plan-alldone">🎉 All done for today!</div>') : '') +
          (isToday && !t.done && S.managingDecks ? '<button type="button" class="btn btn-ghost" data-act="plan-redo">↻ Make a new lineup</button>' : '') +
        '</div>' +
        (t.missed.length ? '<div class="stats-section"><h3>'+(S.managingDecks ? '📝 Words to review' : '📝 Words to practice')+'</h3><div class="plan-missed">' +
          t.missed.slice(0, 24).map(function(m){ return '<span class="plan-chip"><b>'+esc(m.f)+'</b>'+(m.b ? ' · '+esc(m.b) : '')+'</span>'; }).join('') + '</div></div>' : '');
    }
    var days = st.days;
    var settingsHTML = S.planSettingsOpen ? ('' +
      '<div class="stats-section plan-settings">' +
        '<h3>⚙️ Schedule</h3>' +
        '<label class="field"><span>Start time</span><input type="time" id="planStart" value="'+esc(st.start)+'"></label>' +
        '<label class="field"><span>Minutes per day</span><select id="planMinutes">'+[10,15,20,25,30,40].map(function(m){ return '<option value="'+m+'"'+(m===+st.minutes?' selected':'')+'>'+m+' minutes</option>'; }).join('')+'</select></label>' +
        '<div class="plan-days">'+DAY_NAMES.map(function(n, i){ return '<button type="button" class="subject-chip'+(days.indexOf(i)>=0?' active':'')+'" data-plan-day="'+i+'">'+n+'</button>'; }).join('')+'</div>' +
        '<button type="button" class="btn btn-primary" data-act="plan-save-settings">Save schedule</button>' +
      '</div>') : '';
    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="plan-home">⟵ Lagoon</button>' +
        '<span class="nav-title">📅 Daily Plan</span>' +
      '</div>' +
      '<div class="stats-page">' +
        errorBannerHTML() +
        '<div class="plan-tabs">' +
          '<button type="button" class="subject-tab active">Day</button>' +
          (S.managingDecks ? '<button type="button" class="subject-tab" data-act="plan-month">🗓️ Month</button>' : '') +
          (S.managingDecks ? '<button type="button" class="subject-tab'+(S.planSettingsOpen?' active':'')+'" data-act="plan-settings">⚙️ Schedule</button>' : '') +
          (!isToday ? '<button type="button" class="subject-tab" data-act="plan-today">Today</button>' : '') +
        '</div>' +
        settingsHTML + body +
      '</div>';
    wireErrorBanner();
    function on(sel, fn){ var el = app.querySelector(sel); if(el) el.addEventListener('click', fn); }
    on('[data-act="plan-home"]', function(){ S.planRun = null; goHome(); });
    on('[data-act="plan-start"]', planStartNext);
    on('[data-act="plan-month"]', function(){ openPlanMonth(date.slice(0,7)); });
    on('[data-act="plan-today"]', function(){ openPlan(); });
    on('[data-act="plan-settings"]', function(){ S.planSettingsOpen = !S.planSettingsOpen; render(); });
    on('[data-act="plan-anyway"]', function(){ planLoad(todayISO(), true).then(function(d){ S.planViewDay = d; render(); }); });
    on('[data-act="plan-redo"]', function(){ planLoad(todayISO(), true).then(function(d){ S.planViewDay = d; render(); }); });
    app.querySelectorAll('[data-plan-day]').forEach(function(b){ b.addEventListener('click', function(){ b.classList.toggle('active'); }); });
    on('[data-act="plan-save-settings"]', function(){
      var ds = []; app.querySelectorAll('[data-plan-day].active').forEach(function(b){ ds.push(+b.dataset.planDay); });
      var next = { start: (document.getElementById('planStart')||{}).value || PLAN_DEFAULT.start, minutes: +((document.getElementById('planMinutes')||{}).value || 20), days: ds.sort() };
      S.planSettings = next;
      S.planSettingsOpen = false;
      S.store.setPlanSettings(next).then(function(){ render(); });
    });
  }

  function openPlanMonth(ym){
    clearPlanTimer();
    S.view = 'planMonth';
    S.planMonth = ym || todayISO().slice(0,7);
    S.planMonthData = null;
    render();
    Promise.all([S.store.listPlanDays().catch(function(){ return []; }), S.store.getHistoryOnce().catch(function(){ return []; })]).then(function(res){
      S.planMonthData = { days: res[0], history: res[1] };
      if(S.view === 'planMonth') render();
    });
  }
  function renderPlanMonth(){
    var ym = S.planMonth, data = S.planMonthData;
    var y = +ym.slice(0,4), mo = +ym.slice(5,7) - 1;
    var first = new Date(y, mo, 1), nDays = new Date(y, mo+1, 0).getDate();
    var prev = todayISO(new Date(y, mo-1, 1)).slice(0,7), next = todayISO(new Date(y, mo+1, 1)).slice(0,7);
    var body = '<div class="stats-section"><p>Loading…</p></div>';
    if(data){
      var byDate = {}; data.days.forEach(function(d){ if(d.date && d.date.slice(0,7) === ym) byDate[d.date] = d; });
      var st = planSettings(), today = todayISO();
      var cells = '';
      for(var i = 0; i < first.getDay(); i++) cells += '<div class="pm-cell empty"></div>';
      var planned = 0, complete = 0;
      var firstPlan = data.days.reduce(function(m, d){ return d.date && d.blocks && d.blocks.length && (!m || d.date < m) ? d.date : m; }, '');
      for(var dn = 1; dn <= nDays; dn++){
        var iso = ym + '-' + String(dn).padStart(2,'0'), d = byDate[iso], cls = 'none', label = '';
        if(iso > today) cls = 'future';
        else if(!firstPlan || iso < firstPlan) cls = 'pre';
        else if(d && d.blocks && d.blocks.length){
          planned++;
          var t = planDayStats(d);
          if(t.done >= d.blocks.length){ cls = 'full'; complete++; } else if(t.done){ cls = 'part'; } else if(iso === today) cls = 'todo';
          label = t.done + '/' + d.blocks.length;
        } else if(st.days.indexOf(isoToDate(iso).getDay()) < 0) cls = 'off';
        cells += '<button type="button" class="pm-cell '+cls+(iso===today?' today':'')+'" data-pm-date="'+iso+'"'+(cls==='future'?' disabled':'')+'><span class="pm-n">'+dn+'</span><span class="pm-l">'+label+'</span></button>';
      }
      // Totals come from every round played this month (in or out of the plan), plus plan time.
      var hist = data.history.filter(function(h){ return h.endedAt && todayISO(new Date(h.endedAt)).slice(0,7) === ym; });
      var cards = 0, right = 0, perDeck = {};
      hist.forEach(function(h){
        cards += h.total || 0; right += h.right || 0;
        var k = h.deckName || 'Deck';
        var p = perDeck[k] = perDeck[k] || { emoji: h.deckEmoji || '🌊', rounds: 0, cards: 0, right: 0 };
        p.rounds++; p.cards += h.total || 0; p.right += h.right || 0;
      });
      var ms = 0, missCount = {};
      Object.keys(byDate).forEach(function(k){ var t = planDayStats(byDate[k]); ms += t.ms;
        (byDate[k].blocks||[]).forEach(function(b){ (b.missed||[]).forEach(function(m){ var key = m.f + (m.b ? ' · ' + m.b : ''); missCount[key] = (missCount[key]||0) + 1; }); }); });
      // Streak: consecutive scheduled days (back from today) whose plan was fully done; days off don't break it.
      var streak = 0, all = {}; data.days.forEach(function(d){ all[d.date] = d; });
      for(var back = 0; back < 400; back++){
        var dd = new Date(); dd.setDate(dd.getDate() - back); var iso2 = todayISO(dd), rec = all[iso2];
        if(rec && rec.blocks && rec.blocks.length && planDayStats(rec).done >= rec.blocks.length){ streak++; continue; }
        if(back === 0) continue; // today not finished yet doesn't break the streak
        if(st.days.indexOf(dd.getDay()) < 0 && !rec) continue;
        break;
      }
      var deckRows = Object.keys(perDeck).sort(function(a,b){ return perDeck[b].cards - perDeck[a].cards; }).map(function(k){
        var p = perDeck[k], acc = p.cards ? Math.round(p.right/p.cards*100) : 0;
        return '<div class="pm-deck"><span>'+esc(p.emoji)+' '+esc(k)+'</span><span class="tabular">'+p.rounds+' round'+(p.rounds===1?'':'s')+' · '+acc+'%</span><span class="plan-bar small"><span style="width:'+acc+'%"></span></span></div>';
      }).join('');
      var topMissed = Object.keys(missCount).sort(function(a,b){ return missCount[b]-missCount[a]; }).slice(0, 15);
      body = '' +
        '<div class="stats-section">' +
          '<div class="pm-head"><button type="button" class="icon-btn" data-pm-go="'+prev+'" aria-label="Previous month">‹</button>' +
            '<h3>'+first.toLocaleDateString(undefined, { month:'long', year:'numeric' })+'</h3>' +
            '<button type="button" class="icon-btn" data-pm-go="'+next+'" aria-label="Next month">›</button></div>' +
          '<div class="pm-grid">'+DAY_NAMES.map(function(n){ return '<div class="pm-dow">'+n.charAt(0)+'</div>'; }).join('')+cells+'</div>' +
          '<div class="pm-legend"><span class="pm-key full"></span>All done <span class="pm-key part"></span>Started <span class="pm-key none"></span>Missed <span class="pm-key off"></span>Day off</div>' +
        '</div>' +
        '<div class="stats-section">' +
          '<h3>📈 This month</h3>' +
          '<div class="summary-stats plan-stats">' +
            '<div class="summary-stat"><span class="num tabular">'+complete+'/'+planned+'</span><span class="label">Days done</span></div>' +
            '<div class="summary-stat"><span class="num tabular">'+streak+'</span><span class="label">Day streak</span></div>' +
            '<div class="summary-stat"><span class="num tabular">'+fmtMins(ms)+'</span><span class="label">Plan minutes</span></div>' +
            '<div class="summary-stat"><span class="num tabular">'+cards+'</span><span class="label">Cards</span></div>' +
            '<div class="summary-stat"><span class="num tabular">'+(cards ? Math.round(right/cards*100)+'%' : '—')+'</span><span class="label">Right</span></div>' +
          '</div>' +
          (deckRows ? '<div class="pm-decks">'+deckRows+'</div>' : '<p class="algo-note">No rounds played this month yet.</p>') +
        '</div>' +
        (topMissed.length ? '<div class="stats-section"><h3>📝 Most-missed words</h3><div class="plan-missed">'+topMissed.map(function(k){ return '<span class="plan-chip">'+esc(k)+(missCount[k] > 1 ? ' <b>×'+missCount[k]+'</b>' : '')+'</span>'; }).join('')+'</div></div>' : '');
    }
    app.innerHTML = '' +
      '<div class="nav-row"><button class="back-btn" data-act="plan-home">⟵ Lagoon</button><span class="nav-title">🗓️ Monthly Summary</span></div>' +
      '<div class="stats-page">' +
        '<div class="plan-tabs"><button type="button" class="subject-tab" data-act="plan-day">Day</button><button type="button" class="subject-tab active">🗓️ Month</button></div>' +
        body +
      '</div>';
    app.querySelector('[data-act="plan-home"]').addEventListener('click', goHome);
    app.querySelector('[data-act="plan-day"]').addEventListener('click', function(){ openPlan(); });
    app.querySelectorAll('[data-pm-go]').forEach(function(b){ b.addEventListener('click', function(){ S.planMonth = b.dataset.pmGo; render(); }); });
    app.querySelectorAll('[data-pm-date]').forEach(function(b){ b.addEventListener('click', function(){ openPlan(b.dataset.pmDate); }); });
  }
  function planHomeCardHTML(){
    if(!planOn()) return '';
    var day = S.planDay;
    var line;
    if(!day || day.date !== todayISO()) line = 'Getting today\'s lineup ready…';
    else if(day.off) line = 'Day off today · tap to plan one anyway';
    else {
      var t = planDayStats(day), i = planNextIndex(day);
      line = i < 0 ? '🎉 All '+day.blocks.length+' done today' :
        (t.done ? t.done+' of '+day.blocks.length+' done · next: '+esc(day.blocks[i].emoji)+' '+esc(day.blocks[i].name)
                : day.blocks.length+' activities · ~'+day.blocks.reduce(function(s,b){ return s+(b.minutes||0); },0)+' min · '+fmtClock(startMinutes()));
    }
    var canGo = day && day.date === todayISO() && !day.off && planNextIndex(day) >= 0;
    return '<div class="plan-home">' +
      '<div class="plan-home-text"><b>📅 Today\'s plan</b><span>'+line+'</span></div>' +
      '<div class="plan-home-btns"><button type="button" class="btn btn-ghost" data-act="open-plan">Open</button>' +
      (canGo ? '<button type="button" class="btn btn-primary" data-act="plan-go">▶ '+(planDayStats(day).done ? 'Continue' : 'Start')+'</button>' : '') + '</div>' +
    '</div>';
  }
  function wirePlanHome(){
    var o = app.querySelector('[data-act="open-plan"]'); if(o) o.addEventListener('click', function(){ openPlan(); });
    var g = app.querySelector('[data-act="plan-go"]'); if(g) g.addEventListener('click', planStartNext);
    if(planOn() && S.decks.length && (!S.planDay || S.planDay.date !== todayISO()) && !S.planLoading){
      planLoad().then(function(){ if(S.view === 'home') render(); });
    }
  }

