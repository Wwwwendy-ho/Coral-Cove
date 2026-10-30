  /* ---------- STATS PAGE ---------- */
  function openStats(){
    S.view = 'stats';
    S.statsData = null; // shows the loading state until the fetch below resolves
    render();
    var deckList = (S.managingDecks || S.editMode) ? S.decks : S.decks.filter(function(d){ return !d.archived; });
    Promise.all([
      S.store.getHistoryOnce(),
      Promise.all(deckList.map(function(d){
        return S.store.getCardsOnce(d.id).then(function(cards){
          var total = cards.length;
          var mastered = cards.filter(function(c){ return (c.reps||0) > 0 && (c.interval||0) >= 4; }).length;
          // Cards are kept on the entry (not just the total/mastered counts) so the per-deck drill-down
          // (renderDeckStats) can build its "topics" breakdown without a second round-trip.
          return { id: d.id, name: d.name, emoji: d.emoji, total: total, mastered: mastered, cards: cards };
        });
      }))
    ]).then(function(results){
      var history = results[0].slice().sort(function(a,b){ return (a.endedAt||0)-(b.endedAt||0); });
      S.statsData = { history: history, perDeck: results[1] };
      if(S.view === 'stats' || S.view === 'deckStats') render();
    });
  }

  // Groups a deck's cards by their optional "Topic" tag and sums each topic's cumulative right/seen
  // counts (tracked on every graded answer in commitGrade). Untagged cards are left out entirely --
  // an "Uncategorized: 100%" row would just be noise, not a useful topic breakdown. Sorted strongest
  // topic first, so a parent can see at a glance what's landed and what still needs practice.
  function categoryBreakdown(cards){
    var buckets = {};
    (cards||[]).forEach(function(c){
      var cat = (c.category||'').trim();
      var seen = c.timesSeen || 0;
      if(!cat || !seen) return;
      if(!buckets[cat]) buckets[cat] = { category: cat, seen: 0, correct: 0 };
      buckets[cat].seen += seen;
      buckets[cat].correct += (c.timesCorrect || 0);
    });
    var rows = Object.keys(buckets).map(function(k){
      var b = buckets[k];
      return { category: b.category, seen: b.seen, correct: b.correct, accuracy: b.seen > 0 ? Math.round((b.correct/b.seen)*100) : 0 };
    });
    rows.sort(function(a,b){ return b.accuracy - a.accuracy; });
    return rows;
  }

  // Aggregates raw per-round history entries into one point per calendar day (summed right/total
  // across every round finished that day), which is what the long-term trend chart plots -- a
  // per-round view gets noisy fast, but a daily view stays readable across weeks or months.
  function aggregateHistoryByDay(history){
    var byDay = {};
    (history||[]).forEach(function(h){
      var d = new Date(h.endedAt || 0);
      var iso = todayISO(d);
      if(!byDay[iso]){
        byDay[iso] = { iso: iso, ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), right:0, total:0, rounds:0 };
      }
      byDay[iso].right += h.right || 0;
      byDay[iso].total += h.total || 0;
      byDay[iso].rounds += 1;
    });
    return Object.keys(byDay).map(function(k){ return byDay[k]; }).sort(function(a,b){ return a.ts - b.ts; });
  }

  // Hand-rolled inline SVG line+area chart (no chart library — this app stays a single dependency-
  // free file) showing accuracy by day across the ENTIRE history, not just the most recent rounds.
  // Capped to the most recent 60 days so the chart stays legible once a family has been using the
  // app for a long stretch; older days are still counted in "days of practice" below the chart.
  function renderLongTermTrend(history){
    if(!history || !history.length){
      return '<div class="trend-wrap"><div class="trend-empty">Finish a few rounds to start seeing a long-term trend! 🌊</div></div>';
    }
    var allDays = aggregateHistoryByDay(history);
    var days = allDays.slice(-60);
    var n = days.length;
    var W = 600, H = 160, padL = 30, padR = 10, padT = 10, padB = 4;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    function xAt(i){ return n > 1 ? padL + (i/(n-1))*plotW : padL + plotW/2; }
    function yAt(pct){ return padT + (1 - pct/100) * plotH; }
    var pts = days.map(function(d, i){
      var pct = d.total > 0 ? Math.round((d.right/d.total)*100) : 0;
      return { x: xAt(i), y: yAt(pct), pct: pct, day: d };
    });
    var pathD = pts.map(function(p,i){ return (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');
    var areaD = pathD + ' L'+pts[pts.length-1].x.toFixed(1)+','+(padT+plotH)+' L'+pts[0].x.toFixed(1)+','+(padT+plotH)+' Z';
    var gridHTML = [0,50,100].map(function(pct){
      var y = yAt(pct);
      return '<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y.toFixed(1)+'" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>' +
        '<text x="2" y="'+(y+3).toFixed(1)+'" font-size="9" fill="var(--ink-soft)">'+pct+'</text>';
    }).join('');
    var ptsHTML = pts.map(function(p){
      var dd = new Date(p.day.ts);
      var label = (dd.getMonth()+1)+'/'+dd.getDate();
      var tip = esc('🗓️ '+label+' — '+p.pct+'% ('+p.day.right+'/'+p.day.total+' across '+p.day.rounds+' round'+(p.day.rounds===1?'':'s')+')');
      return '<circle class="trend-pt" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" tabindex="0" data-tip="'+tip+'"/>';
    }).join('');
    var firstLabel = (function(){ var dd = new Date(days[0].ts); return (dd.getMonth()+1)+'/'+dd.getDate(); })();
    var lastLabel = (function(){ var dd = new Date(days[days.length-1].ts); return (dd.getMonth()+1)+'/'+dd.getDate(); })();
    var noteExtra = allDays.length > days.length ? ' (showing the most recent '+days.length+')' : '';
    return '' +
      '<div class="trend-wrap trend-long">' +
        '<svg class="trend-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Accuracy by day, over time">' +
          gridHTML +
          '<path d="'+areaD+'" fill="var(--lagoon)" fill-opacity="0.14" stroke="none"/>' +
          '<path d="'+pathD+'" fill="none" stroke="var(--lagoon)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
          ptsHTML +
        '</svg>' +
        (n > 1 ? '<div class="trend-axis"><span>'+firstLabel+'</span><span>'+lastLabel+'</span></div>' : '') +
        '<p class="trend-long-note">📅 '+allDays.length+' day'+(allDays.length===1?'':'s')+' of practice so far'+noteExtra+'</p>' +
      '</div>';
  }

  // Shared tooltip wiring for both the short-term bar chart and the long-term SVG points -- both
  // kinds of chart mark tell you what they need with a `data-tip` attribute.
  function wireChartTips(){
    var tip = document.getElementById('chartTip');
    if(!tip) return;
    app.querySelectorAll('.trend-bar, .trend-pt').forEach(function(b){
      function show(){
        tip.textContent = b.dataset.tip;
        var r = b.getBoundingClientRect();
        tip.style.left = (r.left + r.width/2) + 'px';
        tip.style.top = r.top + 'px';
        tip.classList.add('show');
      }
      function hide(){ tip.classList.remove('show'); }
      b.addEventListener('mouseenter', show);
      b.addEventListener('mouseleave', hide);
      b.addEventListener('focus', show);
      b.addEventListener('blur', hide);
      b.addEventListener('touchstart', function(){ show(); setTimeout(hide, 1500); }, {passive:true});
    });
  }

  function coveHistoryHTML(data){
    var h = (data && data.history) || [];
    if(!h.length) return '<div class="trend-empty">No rounds yet.</div>';
    return '<div class="hist-list">' + h.slice(-10).reverse().map(function(r){
      var d = new Date(r.endedAt), pct = r.accuracy || (r.total ? Math.round(r.right/r.total*100) : 0);
      return '<div class="hist-row"><span class="hd">'+(d.getMonth()+1)+'/'+d.getDate()+'</span><span class="hn">'+(r.deckEmoji||'🌊')+' '+esc(r.deckName||'Deck')+'</span><span class="hs">'+(r.right||0)+'/'+(r.total||0)+'</span><span class="hp'+(pct<60?' low':'')+'">'+pct+'%</span></div>';
    }).join('') + '</div><p class="mastery-hint">Newest first, last 10 rounds.</p>';
  }
  function renderStats(){
    var managing = S.managingDecks;
    var data = S.statsData;
    var allRight = 0, allTotal = 0;
    ((data && data.history) || []).forEach(function(h){ allRight += h.right||0; allTotal += h.total||0; });
    var overallAccuracy = allTotal > 0 ? Math.round((allRight/allTotal)*100) : 0;

    var tilesHTML = '' +
      '<div class="stat-tiles">' +
        '<div class="stat-tile"><div class="num tabular">'+(S.stats.totalReviews||0)+'</div><div class="label">Cards reviewed</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+overallAccuracy+'%</div><div class="label">Overall accuracy</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+currentStreak()+'</div><div class="label">Day streak</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+S.stats.stars+'</div><div class="label">Stars earned</div></div>' +
      '</div>';

    if(!managing){
      tilesHTML = '<div class="stat-tiles kid-tiles">' +
        '<div class="stat-tile"><span class="ic" aria-hidden="true">⭐</span><div class="num tabular">'+S.stats.stars+'</div><div class="label">Stars</div></div>' +
        '<div class="stat-tile"><span class="ic" aria-hidden="true">🔥</span><div class="num tabular">'+currentStreak()+'</div><div class="label">Days</div></div>' +
        '<div class="stat-tile"><span class="ic" aria-hidden="true">🃏</span><div class="num tabular">'+(S.stats.totalReviews||0)+'</div><div class="label">Cards</div></div>' +
        '</div>';
    } else {
      var hist0 = (data && data.history) || [];
      var last = hist0.length ? hist0[hist0.length-1] : null;
      var dueAll = 0; S.decks.forEach(function(d){ if(!d.archived && !d.feedMode && !d.storyMode && !d.equationMode && !d.langFeedMode && !d.readAlongMode && !d.flashFeedMode && !d.miniStoryMode) dueAll += (S.dueCounts[d.id]||{due:0}).due; });
      var wk = hist0.filter(function(h){ return Date.now() - h.endedAt < 7*864e5; });
      var wr = 0, wt = 0; wk.forEach(function(h){ wr += h.right||0; wt += h.total||0; });
      tilesHTML = '<div class="stat-tiles">' +
        '<div class="stat-tile"><div class="num tabular">'+(S.stats.totalReviews||0)+'</div><div class="label">Cards reviewed</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+overallAccuracy+'%</div><div class="label">Overall accuracy</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+(wt ? Math.round(wr/wt*100)+'%' : '–')+'</div><div class="label">Accuracy, last 7 days</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+dueAll+'</div><div class="label">Cards due now</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+hist0.length+'</div><div class="label">Rounds played</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+currentStreak()+'</div><div class="label">Day streak</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+S.stats.stars+'</div><div class="label">Stars earned</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+(last ? (new Date(last.endedAt).getMonth()+1)+'/'+new Date(last.endedAt).getDate() : '–')+'</div><div class="label">Last practice</div></div>' +
      '</div>';
    }
    var masteryHTML;
    if(!data){
      masteryHTML = '<div class="trend-empty">Loading…</div>';
    } else if(!data.perDeck.length){
      masteryHTML = '<div class="trend-empty">No decks yet.</div>';
    } else {
      masteryHTML = '<div class="mastery-list">' + data.perDeck.map(function(d){
        var pct = d.total > 0 ? Math.round((d.mastered / d.total) * 100) : 0;
        return '' +
          '<button type="button" class="mastery-row" data-deck="'+d.id+'">' +
            '<div class="mastery-emoji">'+d.emoji+'</div>' +
            '<div class="mastery-mid">' +
              '<div class="mastery-top'+(managing ? ' adult' : '')+'"><span>'+esc(d.name)+'</span>'+(managing ? '<span class="pct">'+d.mastered+' of '+d.total+' mastered · '+((S.dueCounts[d.id]||{due:0}).due)+' due</span>' : '<span class="kid-shells" role="img" aria-label="'+Math.round(pct/20)+' of 5 shells">'+[0,1,2,3,4].map(function(k){ return '<span class="'+(k < Math.round(pct/20) ? '' : 'off')+'">'+COVE_SHELL+'</span>'; }).join('')+'</span>')+'</div>' +
              '<div class="mastery-track"><div class="mastery-fill" style="width:'+pct+'%"></div></div>' +
            '</div>' +
            '<span class="mastery-chevron">›</span>' +
          '</button>';
      }).join('') + '</div>';
    }

    var trendHTML;
    if(!data){
      trendHTML = '<div class="trend-wrap"><div class="trend-empty">Loading…</div></div>';
    } else if(!data.history.length){
      trendHTML = '<div class="trend-wrap"><div class="trend-empty">Finish a round to start tracking progress! 🌊</div></div>';
    } else {
      var recent = data.history.slice(-12);
      var bars = recent.map(function(h){
        var pct = h.accuracy || 0;
        var barCls = 'trend-bar' + (pct < 60 ? ' low' : '');
        var d = new Date(h.endedAt);
        var dateLabel = (d.getMonth()+1)+'/'+d.getDate();
        var tip = esc((h.deckEmoji||'🌊')+' '+(h.deckName||'Deck')+' — '+h.right+'/'+h.total+(managing ? ' ('+pct+'%)' : ' right')+' on '+dateLabel);
        return '<div class="trend-bar-col"><div class="'+barCls+'" style="height:'+Math.max(pct,3)+'%" tabindex="0" data-tip="'+tip+'"></div></div>';
      }).join('');
      var firstLabel = (function(){ var dd=new Date(recent[0].endedAt); return (dd.getMonth()+1)+'/'+dd.getDate(); })();
      var lastLabel = (function(){ var dd=new Date(recent[recent.length-1].endedAt); return (dd.getMonth()+1)+'/'+dd.getDate(); })();
      trendHTML = '' +
        '<div class="trend-wrap">' +
          '<div class="trend-bars">'+bars+'</div>' +
          (recent.length > 1 ? '<div class="trend-axis"><span>'+firstLabel+'</span><span>'+lastLabel+'</span></div>' : '') +
        '</div>';
    }

    var longTermHTML = data ? renderLongTermTrend(data.history) : '<div class="trend-wrap"><div class="trend-empty">Loading…</div></div>';

    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="exit-stats">⟵ Lagoon</button>' +
        '<span class="nav-title">📊 '+(managing ? 'Progress Overview' : 'Your Progress')+'</span>' +
      '</div>' +
      '<div class="stats-page">' +
        '<div class="stats-section">'+tilesHTML+'</div>' +
        '<div class="stats-section">'+badgeGalleryHTML()+'</div>' +
        (managing ? '<div class="stats-section"><h3>📈 Long-term trend</h3>'+longTermHTML+'</div>' : '') +
        '<div class="stats-section"><h3>'+(managing ? '🕒 Recent rounds' : '🕒 My rounds')+'</h3>'+trendHTML+'</div>' +
        (managing ? '<div class="stats-section"><h3>🗓️ Round history</h3>'+coveHistoryHTML(data)+'</div>' : '') +
        '<div class="stats-section"><h3>'+(managing ? '🏅 Deck mastery' : '🏅 My decks')+'</h3>'+masteryHTML+(managing ? '<p class="mastery-hint">Mastered = a card whose next review is 4+ days away. Tap a deck for topics and its own history.</p>' : '<p class="mastery-hint">Tap a deck 👆</p>')+'</div>' +
      '</div>' +
      '<div class="chart-tip" id="chartTip"></div>';

    app.querySelector('[data-act="exit-stats"]').addEventListener('click', goHome);
    app.querySelectorAll('.mastery-row').forEach(function(b){
      b.addEventListener('click', function(){
        S.statsDeckId = b.dataset.deck;
        S.view = 'deckStats';
        render();
      });
    });
    wireChartTips();
  }

  /* ---------- DECK PROGRESS DRILL-DOWN (tap a deck in the mastery list) ---------- */
  function renderDeckStats(){
    var data = S.statsData;
    if(!data){ openStats(); return; } // shouldn't normally happen -- guards against a stale view after e.g. a reload
    var deckEntry = data.perDeck.find(function(d){ return d.id === S.statsDeckId; });
    if(!deckEntry){ S.view = 'stats'; render(); return; } // deck was deleted since the list loaded
    var deckHistory = data.history.filter(function(h){ return h.deckId === S.statsDeckId; });
    var right = 0, total = 0;
    deckHistory.forEach(function(h){ right += h.right||0; total += h.total||0; });
    var accuracy = total > 0 ? Math.round((right/total)*100) : 0;
    var pctMastered = deckEntry.total > 0 ? Math.round((deckEntry.mastered/deckEntry.total)*100) : 0;

    var adultD = !!S.managingDecks;
    var tilesHTML = !adultD ? '<div class="stat-tiles kid-tiles">' +
        '<div class="stat-tile"><span class="ic" aria-hidden="true">🃏</span><div class="num tabular">'+deckEntry.total+'</div><div class="label">Cards</div></div>' +
        '<div class="stat-tile"><span class="ic" aria-hidden="true">🐚</span><div class="num tabular">'+deckEntry.mastered+'</div><div class="label">Known</div></div>' +
        '<div class="stat-tile"><span class="ic" aria-hidden="true">🏁</span><div class="num tabular">'+deckHistory.length+'</div><div class="label">Rounds</div></div>' +
      '</div>' : '' +
      '<div class="stat-tiles">' +
        '<div class="stat-tile"><div class="num tabular">'+(S.dueCounts[deckEntry.id]||{due:0}).due+'</div><div class="label">Due now</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+deckEntry.total+'</div><div class="label">Cards</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+pctMastered+'%</div><div class="label">Mastered</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+accuracy+'%</div><div class="label">Accuracy</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+deckHistory.length+'</div><div class="label">Rounds played</div></div>' +
        '<div class="stat-tile"><div class="num tabular">'+(deckHistory.length ? (new Date(deckHistory[deckHistory.length-1].endedAt).getMonth()+1)+'/'+new Date(deckHistory[deckHistory.length-1].endedAt).getDate() : '–')+'</div><div class="label">Last round</div></div>' +
      '</div>';

    var longTermHTML = renderLongTermTrend(deckHistory);

    var catRows = categoryBreakdown(deckEntry.cards);
    var catHTML;
    if(!catRows.length){
      catHTML = '<div class="trend-empty">Tag this deck\'s cards with a Topic (in the deck editor) to see which topics are strongest here.</div>';
    } else {
      catHTML = '<div class="cat-list">' + catRows.map(function(r, i){
        var barCls = 'cat-fill' + (r.accuracy < 60 ? ' low' : (r.accuracy >= 85 ? ' high' : ''));
        var tag = '';
        if(catRows.length > 1){
          if(i === 0 && r.accuracy >= 70) tag = '<span class="cat-tag strong">💪 Strongest</span>';
          else if(i === catRows.length-1 && r.accuracy < 70) tag = '<span class="cat-tag weak">🛟 Needs practice</span>';
        }
        return '' +
          '<div class="cat-row">' +
            '<div class="cat-top"><span>'+esc(r.category)+'</span>'+tag+'<span class="pct">'+r.accuracy+'%</span></div>' +
            '<div class="cat-track"><div class="'+barCls+'" style="width:'+r.accuracy+'%"></div></div>' +
            '<div class="cat-meta">'+r.correct+' / '+r.seen+' correct answers</div>' +
          '</div>';
      }).join('') + '</div>';
    }

    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="back-to-stats">⟵ Progress</button>' +
        '<span class="nav-title">'+deckEntry.emoji+' '+esc(deckEntry.name)+'</span>' +
      '</div>' +
      '<div class="stats-page">' +
        '<div class="stats-section">'+tilesHTML+'</div>' +
        (adultD ? '<div class="stats-section"><h3>📈 Long-term trend</h3>'+longTermHTML+'</div>' : '') +
        (adultD ? '<div class="stats-section"><h3>🗓️ Round history</h3>'+coveHistoryHTML({history:deckHistory})+'</div>' : '') +
        (adultD ? '<div class="stats-section"><h3>🧩 Topics</h3>'+catHTML+'</div>' : '') +
      '</div>' +
      '<div class="chart-tip" id="chartTip"></div>';

    app.querySelector('[data-act="back-to-stats"]').addEventListener('click', function(){ S.view = 'stats'; render(); });
    wireChartTips();
  }

  /* ---------- SETTINGS (parent-only, app-wide: difficulty + scheduling algorithm) ---------- */
  function voiceSettingsHTML(){
    function sel(lang, label, sample){
      var list = Speech.listVoices(lang), pref = Speech.getPref(Speech.prefKey(lang));
      var auto = Speech.autoVoice(lang);
      var opts = '<option value="">Best available'+(auto ? ' ('+esc(auto.name)+')' : '')+'</option>' +
        list.map(function(v){ return '<option value="'+esc(v.name)+'"'+(v.name===pref?' selected':'')+'>'+esc(v.name)+(v.localService===false?' · online':'')+'</option>'; }).join('');
      return '<div class="voice-row"><label class="field"><span>'+label+'</span><select data-voice-lang="'+lang+'">'+opts+'</select></label>' +
        '<button type="button" class="btn btn-ghost" data-voice-test="'+esc(sample)+'">▶ Test</button></div>';
    }
    var sp = Speech.getPref('cc-voice-speed') || '1';
    var nat = VoicePack.on(), natCount = VoicePack.count();
    return '' +
      '<div class="stats-section">' +
        '<h3>🗣️ Voice</h3>' +
        '<label class="toggle-row natural-voice-row"><input type="checkbox" data-natural-voice'+(nat?' checked':'')+'> <span><b>Natural voices</b> (recommended)<small>'+
          (natCount ? natCount.toLocaleString()+' words and sentences recorded ahead of time in a natural Korean and English voice.' : 'Natural voice clips are loading…')+
          ' Anything without a clip uses the device voice below.</small></span></label>' +
        '<div class="voice-row natural-test-row"><button type="button" class="btn btn-ghost" data-voice-test="The cat sat on the mat.">▶ English</button><button type="button" class="btn btn-ghost" data-voice-test="안녕하세요. 커피 주세요.">▶ Korean</button></div>' +
        '<h4 class="voice-sub">Device voice</h4>' +
        sel('en-US', 'English voice', 'The cat sat on the mat.') +
        sel('ko-KR', 'Korean voice', '안녕하세요. 커피 주세요.') +
        '<label class="field"><span>Speaking speed</span><select data-voice-speed>' +
          [['0.85','Slower'],['1','Normal'],['1.12','Faster']].map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===sp?' selected':'')+'>'+o[1]+'</option>'; }).join('') +
        '</select></label>' +
        '<p class="algo-note">Saved on this device. The device voice reads only what has no natural clip yet, such as new cards and Story Maker stories. For the clearest device voice on an iPad or iPhone, download a better voice once: Settings → Accessibility → Spoken Content → Voices → English → <b>Ava (Premium)</b>, and Korean → <b>Yuna (Premium)</b>.</p>' +
      '</div>';
  }
  function wireVoiceSettings(){
    app.querySelectorAll('[data-voice-lang]').forEach(function(s){
      s.addEventListener('change', function(){ Speech.setPref(Speech.prefKey(s.dataset.voiceLang), s.value); });
    });
    var sp = app.querySelector('[data-voice-speed]');
    if(sp) sp.addEventListener('change', function(){ Speech.setPref('cc-voice-speed', sp.value === '1' ? '' : sp.value); });
    app.querySelectorAll('[data-voice-test]').forEach(function(b){ b.addEventListener('click', function(){ Speech.speak(b.dataset.voiceTest); }); });
    var nv = app.querySelector('[data-natural-voice]');
    if(nv) nv.addEventListener('change', function(){ VoicePack.setOn(nv.checked); if(nv.checked) VoicePack.warm(); Speech.speak(nv.checked ? '안녕하세요. 커피 주세요.' : 'The cat sat on the mat.'); });
  }
  // Settings → 🎙️ Microphone: the same yes/no as the Echo card asks, plus a 3-second level test so a
  // grown-up can see it's really hearing something. Saved on this device only.
  function micSettingsHTML(){
    var c = Mic.get(), st = S.micTest || {};
    var status = !echoMicAvailable() ? Mic.msg('unsupported')
      : (st.reason ? Mic.msg(st.reason)
      : (st.ok ? '✅ The microphone works on this device.'
      : (c === 'yes' ? 'On. 🎙️ Echo cards can record.' : (c === 'no' ? 'Off. 🎙️ Echo cards play the voice and you say it aloud.' : 'Not chosen yet. 🎙️ Echo cards will ask the first time.'))));
    return '<div class="stats-section"><h3>🎙️ Microphone</h3>' +
      '<div class="algo-toggle">' +
        '<button type="button" class="algo-opt'+(c==='yes'?' active':'')+'" data-mic-choice="yes"><span class="algo-name">🎙️ Use the microphone'+(c==='yes'?' <span class="algo-current">— current</span>':'')+'</span><span class="algo-blurb">On 🎙️ Echo cards, record yourself and hear it next to the voice. Recordings stay on this device, are never saved or sent, and are deleted when the card changes.</span></button>' +
        '<button type="button" class="algo-opt'+(c==='no'?' active':'')+'" data-mic-choice="no"><span class="algo-name">🔇 Don\'t use it'+(c==='no'?' <span class="algo-current">— current</span>':'')+'</span><span class="algo-blurb">Echo cards still work: listen, then say it out loud.</span></button>' +
      '</div>' +
      '<div class="voice-row mic-test-row"><button type="button" class="btn btn-ghost" data-act="mic-test"'+(st.running?' disabled':'')+'>'+(st.running ? 'Listening… say something' : '▶ Test the microphone')+'</button><div class="echo-level mic-test-level"><i id="micTestLevel"></i></div></div>' +
      '<p class="algo-note" id="micStatus" aria-live="polite">'+esc(status)+'</p></div>';
  }
  function micTest(){
    if(S.micTest && S.micTest.running) return;
    S.micTest = { running: true }; render();
    function done(r){ S.micTest = r; if(S.view === 'settings') render(); }
    if(!echoMicAvailable()) return done({ reason: 'unsupported' });
    if(!Mic.frameAllows()) return done({ reason: 'blocked' });
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream){
      var ctx = null, an = null, data = null, end = Date.now() + 3000;
      try { var AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an); data = new Uint8Array(an.fftSize); } catch(e){}
      (function tick(){
        if(an){ an.getByteTimeDomainData(data); var pk = 0; for(var k = 0; k < data.length; k++) pk = Math.max(pk, Math.abs(data[k] - 128)); var el = document.getElementById('micTestLevel'); if(el) el.style.transform = 'scaleX(' + Math.min(1, pk / 64).toFixed(3) + ')'; }
        if(Date.now() < end && S.view === 'settings') return requestAnimationFrame(tick);
        stream.getTracks().forEach(function(t){ t.stop(); }); try { if(ctx) ctx.close(); } catch(e){}
        Mic.set('yes');
        done({ ok: true });
      })();
    }, function(err){ done({ reason: Mic.why(err) }); });
  }
  function wireMicSettings(){
    app.querySelectorAll('[data-mic-choice]').forEach(function(b){ b.addEventListener('click', function(){
      var v = b.dataset.micChoice; Mic.set(v); S.micTest = null;
      if(v === 'yes') micTest(); else render(); // "yes" goes straight to the browser's own permission box
    }); });
    var t = app.querySelector('[data-act="mic-test"]'); if(t) t.addEventListener('click', micTest);
  }
  function planSettingsToggleHTML(){
    var p = S.profile;
    if(!p || p.mode !== 'adult') return '';
    var on = !!p.planOn;
    return '<div class="stats-section"><h3>📅 Daily plan</h3>' +
      '<button type="button" class="algo-opt'+(on?' active':'')+'" data-act="toggle-plan">' +
        '<span class="algo-name">'+(on ? '✅ On' : '⬜ Off')+'</span>' +
        '<span class="algo-blurb">Lines up a session from this profile\'s decks every day (warm-up, review, listening, speed round, story), plays them back to back, and keeps daily and monthly summaries automatically.</span>' +
      '</button></div>';
  }
  // Light (Sunlit zone) / dark (Midnight zone) / match the device, saved on the profile so it follows
  // that person to any device. Switching dives down or rises up with a wash of water, like Coral Calendar.
  function applyThemeMode(mode){
    var root = document.documentElement, want = (mode === 'light' || mode === 'dark') ? mode : '';
    if((root.dataset.theme || '') === want) return;
    if(want) root.dataset.theme = want; else delete root.dataset.theme;
  }
  function setThemeMode(mode, instant){
    var root = document.documentElement;
    var dark = function(){ return (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark'; };
    var wasDark = dark();
    var go = function(){
      root.classList.add('theming');
      S.profile = Object.assign({}, S.profile, { themeMode: mode });
      S.store.updateProfile(S.profile.id, { themeMode: mode });
      render();
      setTimeout(function(){ root.classList.remove('theming'); }, 900);
    };
    var willDark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    var reducedMo = false; try { reducedMo = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){}
    if(wasDark === willDark || reducedMo || instant){ go(); return; }
    var w = document.createElement('div'); w.className = 'divewash ' + (willDark ? 'down' : 'up'); document.body.appendChild(w);
    setTimeout(go, 330); setTimeout(function(){ w.remove(); }, 1000);
  }
  function themeModeHTML(){
    var p = S.profile; if(!p) return '';
    var cur = p.themeMode === 'light' || p.themeMode === 'dark' ? p.themeMode : 'auto';
    var opts = [['light','☀️ Sunlit zone','Light mode, near the surface.'],['dark','🌙 Midnight zone','Dark mode, lit by glowing sea life.'],['auto','📱 Match this device','Follows the iPad or phone\'s own light/dark setting.']];
    return '<div class="stats-section"><h3>🌓 Light or dark</h3><div class="algo-toggle">' + opts.map(function(o){
      return '<button type="button" class="algo-opt'+(o[0]===cur?' active':'')+'" data-theme-mode="'+o[0]+'"><span class="algo-name">'+o[1]+(o[0]===cur?' <span class="algo-current">— current</span>':'')+'</span><span class="algo-blurb">'+o[2]+'</span></button>';
    }).join('') + '</div><p class="algo-note">Saved for '+esc(p.name)+', so it\'s the same on every device.</p></div>';
  }
  function oceanToggleHTML(){
    var p = S.profile;
    if(!p || p.mode !== 'adult') return '';
    var on = p.oceanTheme !== false;
    return '<div class="stats-section"><h3>🌊 Ocean look</h3>' +
      '<button type="button" class="algo-opt'+(on?' active':'')+'" data-act="toggle-ocean">' +
        '<span class="algo-name">'+(on ? '✅ On' : '⬜ Off')+'</span>' +
        '<span class="algo-blurb">Coral Calendar\'s colours and animations for this profile: a moving sea behind the page, marine life swimming by, water rings when you tap, bubbles on right answers, and a flurry of bubbles as each Daily Plan activity starts. Light mode is the sunlit zone, dark mode the midnight zone.</span>' +
      '</button></div>';
  }
  function wirePlanToggle(){
    app.querySelectorAll('[data-theme-mode]').forEach(function(b){ b.addEventListener('click', function(){ setThemeMode(b.dataset.themeMode); }); });
    var ot = app.querySelector('[data-act="toggle-ocean"]');
    if(ot) ot.addEventListener('click', function(){
      var on = !!(S.profile && S.profile.oceanTheme === false);
      S.profile = Object.assign({}, S.profile, { oceanTheme: on });
      S.store.updateProfile(S.profile.id, { oceanTheme: on });
      render();
    });
    var b = app.querySelector('[data-act="toggle-plan"]');
    if(b) b.addEventListener('click', function(){
      var on = !(S.profile && S.profile.planOn);
      S.profile = Object.assign({}, S.profile, { planOn: on });
      S.store.updateProfile(S.profile.id, { planOn: on });
      render();
    });
  }

  function renderSettingsPage(){
    var currentDiff = S.settings.difficulty || 'medium';
    var diffOptsHTML = DIFFICULTIES.map(function(d){
      return '' +
        '<button type="button" class="algo-opt'+(d.id===currentDiff?' active':'')+'" data-diff="'+d.id+'">' +
          '<span class="algo-name">'+d.icon+' '+d.name+(d.id===currentDiff?' <span class="algo-current">— current</span>':'')+'</span>' +
          '<span class="algo-blurb">'+d.blurb+'</span>' +
        '</button>';
    }).join('');

    var currentAlgo = S.settings.algorithm || 'sm2_speed';
    var algoOptsHTML = ALGORITHMS.map(function(a){
      return '' +
        '<button type="button" class="algo-opt'+(a.id===currentAlgo?' active':'')+'" data-algo="'+a.id+'">' +
          '<span class="algo-name">'+a.icon+' '+a.name+(a.id===currentAlgo?' <span class="algo-current">— current</span>':'')+'</span>' +
          '<span class="algo-blurb">'+a.blurb+'</span>' +
        '</button>';
    }).join('');

    var profile = S.profile;
    var pmode = profile ? profile.mode : 'child';
    var modeSectionHTML = profile ? ('' +
      '<div class="stats-section">' +
        '<h3>👤 '+esc(profile.name)+'\'s mode</h3>' +
        '<div class="algo-toggle">' +
          '<button type="button" class="algo-opt'+(pmode==='child'?' active':'')+'" data-mode-switch="child">' +
            '<span class="algo-name">🧒 Child Mode'+(pmode==='child'?' <span class="algo-current">— current</span>':'')+'</span>' +
            '<span class="algo-blurb">PIN-protected study sessions; deck editing needs the PIN too.</span>' +
          '</button>' +
          '<button type="button" class="algo-opt'+(pmode==='adult'?' active':'')+'" data-mode-switch="adult">' +
            '<span class="algo-name">🔧 Adult Mode'+(pmode==='adult'?' <span class="algo-current">— current</span>':'')+'</span>' +
            '<span class="algo-blurb">Study and manage decks anytime — no PIN needed.</span>' +
          '</button>' +
        '</div>' +
        (profile.initialMode === 'child' ? '<p class="algo-note">This profile started as Child Mode, so changing its mode always asks for the PIN.</p>' : '') +
      '</div>') : '';

    var readingSupportOn = !!S.settings.readingSupport;
    var readingSupportHTML = '' +
      '<div class="stats-section">' +
        '<h3>🔠 Reading support</h3>' +
        '<button type="button" class="algo-opt'+(readingSupportOn?' active':'')+'" data-act="toggle-reading-support">' +
          '<span class="algo-name">'+(readingSupportOn ? '✅ On' : '⬜ Off')+'</span>' +
          '<span class="algo-blurb">Wider letter and word spacing and a larger base font throughout Coral Cove. (Every option is already read aloud on tap in Child Mode — that\'s not tied to this toggle.) Research doesn\'t back special "dyslexia fonts", so this sticks to what the evidence actually supports.</span>' +
        '</button>' +
      '</div>';

    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="exit-settings">⟵ Lagoon</button>' +
        '<span class="nav-title">⚙️ Settings</span>' +
      '</div>' +
      '<div class="stats-page">' +
        errorBannerHTML() +
        modeSectionHTML +
        themeModeHTML() +
        '<div class="stats-section">' +
          '<h3>🎚️ Study difficulty</h3>' +
          '<div class="algo-toggle">'+diffOptsHTML+'</div>' +
          '<p class="algo-note">Changes round length and how far apart reviews get spaced right away. Applies to every deck.</p>' +
        '</div>' +
        '<div class="stats-section">' +
          '<h3>🗓️ Scheduling algorithm</h3>' +
          '<div class="algo-toggle">'+algoOptsHTML+'</div>' +
          '<p class="algo-note">This applies to every deck too. Switching only changes how future answers are scheduled — cards already due keep their current date.</p>' +
        '</div>' +
        readingSupportHTML +
        reefCalmHTML() +
        voiceSettingsHTML() +
        micSettingsHTML() +
        planSettingsToggleHTML() +
        oceanToggleHTML() +
        '<div class="stats-section">' +
          '<h3>🔒 Privacy and data</h3>' +
          '<p class="algo-note">What Coral Cove keeps, where it lives and who can see it. No ads, no tracking cookies, and practice data is never sent to an AI.</p>' +
          '<div class="cove-data-row">' +
            '<button type="button" class="btn btn-ghost" data-act="cove-privacy">Read privacy and data</button>' +
            (profile ? '<button type="button" class="btn btn-ghost" data-cove-export="'+profile.id+'">⬇️ Download '+esc(profile.name)+'\'s data</button>' : '') +
          '</div>' +
          '<p class="algo-note">To delete a profile and all its data, use 🗂️ Manage Profiles on the profile picker (needs the grown-up PIN).</p>' +
        '</div>' +
      '</div>';

    wireErrorBanner();
    wireVoiceSettings();
    wireMicSettings();
    wirePlanToggle();
    app.querySelector('[data-act="exit-settings"]').addEventListener('click', goHome);
    app.querySelectorAll('[data-diff]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.diff;
        if(id === currentDiff) return;
        var newSettings = Object.assign({}, S.settings, { difficulty: id });
        S.settings = newSettings;
        S.store.setSettings(newSettings);
        render();
      });
    });
    app.querySelectorAll('[data-algo]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.algo;
        if(id === currentAlgo) return;
        var newSettings = Object.assign({}, S.settings, { algorithm: id });
        S.settings = newSettings;
        S.store.setSettings(newSettings);
        render();
      });
    });
    app.querySelectorAll('[data-mode-switch]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.modeSwitch;
        if(!S.profile || id === S.profile.mode) return;
        if(S.profile.initialMode === 'child'){
          S.pendingModeSwitch = id;
          S.pinPromptFor = 'modeSwitch';
          render();
        } else {
          applyModeSwitch(id);
        }
      });
    });
    reefWireCalm();
    var rs = app.querySelector('[data-act="toggle-reading-support"]');
    if(rs) rs.addEventListener('click', function(){
      var newSettings = Object.assign({}, S.settings, { readingSupport: !readingSupportOn });
      S.settings = newSettings;
      S.store.setSettings(newSettings);
      applyReadingSupport();
      render();
    });
  }

  /* ---------- EDITOR ---------- */
  function openEditor(deckId, focusName){
    // Adult Mode never asks for the PIN. Child Mode already cleared the PIN once to reach Edit Mode
    // in the first place, so opening one specific deck from inside it needs no second PIN prompt.
    if(S.managingDecks || S.editMode){ openEditorUnlocked(deckId, focusName); return; }
    // Defensive fallback in case this is ever reached outside Edit Mode.
    S.pendingEdit = { deckId: deckId, focusName: focusName };
    S.pinPromptFor = 'edit';
    render();
  }

  function openEditorUnlocked(deckId, focusName){
    S.currentDeckId = deckId;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() }); // drives the Manage Decks "most recently opened" order
    S.view = 'editor';
    S.emojiPickerOpen = false;
    S.addCardOpen = false;
    S.editingCardId = null;
    S.cardFormDraft = null;
    S.cardFormMode = 'flip';
    if(S.unsubCards) S.unsubCards();
    S.editorCards = [];
    S.unsubCards = S.store.listenCards(deckId, function(cards){
      S.editorCards = cards.sort(function(a,b){ return (a.createdAt||0)-(b.createdAt||0); });
      if(S.view === 'editor') render();
    });
    render();
    if(focusName){ setTimeout(function(){ var el = document.getElementById('deckNameInput'); if(el){ el.focus(); el.select(); } }, 0); }
  }

  function renderEditor(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; });
    if(!deck){ goHome(); return; }
    var cards = S.editorCards || [];

    var rows = cards.length ? cards.map(function(c){
      var isReadRow = c.mode === 'read';
      var isChoiceRow = c.mode === 'choice';
      var isMatchRow = c.mode === 'match';
      var isBlankRow = c.mode === 'blank';
      var isTimedChoiceRow = c.mode === 'timedchoice';
      var isBlendRow = c.mode === 'blend';
      var isListenRow = c.mode === 'listen';
      var modeTag = (isReadRow ? '<span class="mode-tag mode-tag-read">🗣️ Read</span>' :
          (isChoiceRow ? '<span class="mode-tag mode-tag-choice">🔘 Choice</span>' :
          (isMatchRow ? '<span class="mode-tag mode-tag-choice">🧲 Match</span>' :
          (isBlankRow ? '<span class="mode-tag mode-tag-choice">📝 Fill blank</span>' :
          (isTimedChoiceRow ? '<span class="mode-tag mode-tag-choice">⏱️ Timed choice</span>' :
          (isBlendRow ? '<span class="mode-tag mode-tag-read">🐚 Sound blend</span>' : (isListenRow ? '<span class="mode-tag mode-tag-choice">👂 Listen &amp; pick</span>' : (c.mode === 'echo' ? '<span class="mode-tag mode-tag-read">🎙️ Echo</span>' : (c.mode === 'build' ? '<span class="mode-tag mode-tag-choice">🧩 Builder</span>' : (c.mode === 'numsys' ? '<span class="mode-tag mode-tag-choice">🔢 Native or Sino</span>' : c.mode === 'hanja' ? '<span class="mode-tag mode-tag-choice">🀄 Chinese bridge</span>' : '<span class="mode-tag">🔄 Flip</span>')))))))))) +
        (c.category ? ' <span class="mode-tag mode-tag-category">🏷️ '+esc(c.category)+'</span>' : '') +
        (c.isLeech ? ' <span class="mode-tag mode-tag-leech">🛟 Needs practice</span>' : '');
      var backLine = isListenRow ? ('Hear it, then pick '+(listenAnswerSide(c) === 'front' ? 'the written word' : 'the meaning: '+esc(c.back))+' · '+((c.choices||[]).length ? (c.choices||[]).length+' wrong answer'+((c.choices||[]).length===1?'':'s') : 'auto look-alikes')) : isReadRow ? (c.note ? esc(c.note) : 'No answer side — just for reading aloud') :
        (isBlendRow ? ((c.blendChunks||[]).length ? (esc((c.blendChunks||[]).join('-'))+' · custom chunks') : 'No answer side — auto-split into sounds') :
        ((isChoiceRow || isMatchRow || isBlankRow || isTimedChoiceRow) ? (esc(c.back)+' · '+((c.choices||[]).length ? ((c.choices||[]).length+' wrong answer'+((c.choices||[]).length===1?'':'s')) : 'auto distractors')+(isTimedChoiceRow && c.tcSeconds ? ' · '+c.tcSeconds+'s timer' : '')) :
        (c.mode === 'numsys' ? (esc(c.nsEmoji || '')+' '+esc(c.back)+' → <span lang="ko">'+esc(c.front)+'</span> · '+(NUMSYS[c.nsSys] || NUMSYS.native).icon) :
        c.mode === 'hanja' ? (esc(c.back)+' · <span lang="zh-Hant">'+esc(c.zh||c.hanja||'')+'</span> '+esc(c.py||'')+(c.hzClass ? ' · '+(HANJA_GROUPS[c.hzClass]||{}).icon : '')) :
        (esc(c.back)+(c.note?' · '+esc(c.note):'')))));
      return '' +
      '<div class="card-row">' +
        (c.photoUrl ? '<div class="cr-thumb"><img src="'+esc(c.photoUrl)+'" alt=""></div>' : '') +
        '<div class="cr-text">' +
          '<div class="cr-front">'+esc(c.front)+' '+modeTag+'</div>' +
          '<div class="cr-back">'+backLine+'</div>' +
        '</div>' +
        '<div class="cr-actions">' +
          '<button class="icon-btn" data-act="edit-card" data-card="'+c.id+'" aria-label="Edit card">'+ccIcon('edit')+'</button>' +
          '<button class="icon-btn" data-act="del-card" data-card="'+c.id+'" aria-label="Delete card">'+ccIcon('trash')+'</button>' +
        '</div>' +
      '</div>';
    }).join('') : '<div class="empty-state">No cards yet — add the first one below! 🐚</div>';

    var emojiPicker = S.emojiPickerOpen ? ('<div class="emoji-popover">' + DECK_EMOJI.map(function(e){
      return '<button class="emoji-opt" data-emoji="'+e+'">'+e+'</button>';
    }).join('') + '</div>') : '';

    var editingCard = S.editingCardId ? cards.find(function(c){ return c.id === S.editingCardId; }) : null;
    var formTitle = editingCard ? 'Edit card' : 'Add a new card';
    var draft = S.cardFormDraft || { front:'', back:'', note:'', choices:'', blendChunks:'', category:'', photoId:'', photoUrl:'', tcSeconds:'', listenAnswer:'back' };
    var fFront = draft.front; var fBack = draft.back; var fNote = draft.note; var fChoices = draft.choices || ''; var fBlendChunks = draft.blendChunks || ''; var fCategory = draft.category || ''; var fTcSeconds = draft.tcSeconds || '';
    var fPhotoUrl = draft.photoUrl || '';
    var formMode = S.cardFormMode || 'flip';
    var isReadMode = formMode === 'read';
    var isChoiceMode = formMode === 'choice';
    var isMatchMode = formMode === 'match';
    var isBlankMode = formMode === 'blank';
    var isTimedChoiceMode = formMode === 'timedchoice';
    var isBlendMode = formMode === 'blend';
    var isListenMode = formMode === 'listen';
    var isEchoMode = formMode === 'echo', isBuildMode = formMode === 'build';
    var fListenAnswer = draft.listenAnswer === 'front' ? 'front' : 'back';
    var needsChoicesField = isChoiceMode || isMatchMode || isBlankMode || isTimedChoiceMode || isListenMode || isBuildMode || formMode === 'numsys'; // shown for all four; only the first three actually require it (see requiresChoices at save time) -- 'timedchoice' can fall back to auto-picked distractors from sibling cards
    var skipsBackField = isReadMode || isBlendMode; // both are front-only, self-graded-by-outcome-row modes -- no answer side to type in

    var photoFieldHTML;
    if(S.photoUploading){
      photoFieldHTML = '<div class="field"><label>Photo (optional)</label><div class="photo-field-wrap"><span class="photo-uploading-note">⏳ Uploading…</span></div></div>';
    } else if(S.assetsAvailable){
      photoFieldHTML = '' +
        '<div class="field"><label>Photo (optional, shown with the question)</label>' +
          '<div class="photo-field-wrap">' +
            (fPhotoUrl ? '<img class="photo-preview" src="'+esc(fPhotoUrl)+'" alt="">' : '') +
            '<div class="photo-field-actions">' +
              '<button type="button" class="btn btn-ghost" data-act="'+(fPhotoUrl?'replace-photo':'add-photo')+'">'+(fPhotoUrl?'🖼️ Replace photo':'🖼️ Add a photo')+'</button>' +
              (fPhotoUrl ? '<button type="button" class="btn btn-ghost" data-act="remove-photo">Remove</button>' : '') +
            '</div>' +
          '</div>' +
          '<input type="file" id="cardPhotoInput" accept="image/*" style="display:none">' +
        '</div>';
    } else {
      photoFieldHTML = fPhotoUrl
        ? '<div class="field"><label>Photo</label><div class="photo-field-wrap"><img class="photo-preview" src="'+esc(fPhotoUrl)+'" alt=""><span class="photo-uploading-note">Photos can only be added or changed from the live app.</span></div></div>'
        : '<div class="field"><label>Photo</label><p class="algo-note">Photos can be added from the live app (not this offline copy).</p></div>';
    }

    var addForm = (S.addCardOpen || editingCard) ? ('' +
      '<div class="form-card">' +
        '<h3>'+formTitle+'</h3>' +
        '<div class="mode-toggle">' +
          '<button type="button" class="mode-opt '+(formMode==='flip'?'active':'')+'" data-mode="flip">🔄 Flip card<span class="mode-sub">question → answer</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='read'?'active':'')+'" data-mode="read">🗣️ Just read it<span class="mode-sub">no answer side</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='choice'?'active':'')+'" data-mode="choice">🔘 Multiple choice<span class="mode-sub">pick the answer</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='match'?'active':'')+'" data-mode="match">🧲 Matching<span class="mode-sub">drag the answer over</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='blank'?'active':'')+'" data-mode="blank">📝 Fill in the blank<span class="mode-sub">drag a word into ___</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='timedchoice'?'active':'')+'" data-mode="timedchoice">⏱️ Timed choice<span class="mode-sub">beat the clock</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='blend'?'active':'')+'" data-mode="blend">🐚 Sound blend<span class="mode-sub">slide & blend it</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='listen'?'active':'')+'" data-mode="listen">👂 Listen &amp; pick<span class="mode-sub">hear it, pick it</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='echo'?'active':'')+'" data-mode="echo">🎙️ Echo<span class="mode-sub">hear it, say it, compare</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='build'?'active':'')+'" data-mode="build">🧩 Sentence builder<span class="mode-sub">put the words in order</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='hanja'?'active':'')+'" data-mode="hanja">🀄 Chinese bridge<span class="mode-sub">Korean ↔ Chinese characters</span></button>' +
          '<button type="button" class="mode-opt '+(formMode==='numsys'?'active':'')+'" data-mode="numsys">🔢 Native or Sino?<span class="mode-sub">pick the right numbers</span></button>' +
        '</div>' +
        '<div class="field"><label for="cardFront">'+(isEchoMode?'Word or sentence to say':(isBuildMode?'Sentence (each word becomes a tile)':''))+(isEchoMode||isBuildMode?'':(isListenMode?'Word or phrase to hear (spoken, not shown)':(isReadMode||isBlendMode?'Word or phrase to read':(isBlankMode?'Sentence (use ___ for the blank)':'Front (question / word)'))))+'</label><input id="cardFront" type="text" value="'+esc(fFront)+'" placeholder="'+(isReadMode||isBlendMode?'e.g. octopus':(isBlankMode?'e.g. The cat sat on the ___.':'e.g. 6 + 7  or  because'))+'"></div>' +
        photoFieldHTML +
        (skipsBackField ? '' : '<div class="field"><label for="cardBack">'+((isListenMode||isEchoMode)?'Meaning (optional)':isBuildMode?'Meaning (shown as the prompt)':(needsChoicesField?'Correct answer':'Back (answer)'))+'</label><input id="cardBack" type="text" value="'+esc(fBack)+'" placeholder="'+(isListenMode?'e.g. moon':'e.g. 13  or  a sentence')+'"></div>') +
        (isListenMode ? '<div class="field"><label for="cardListenAnswer">The answer buttons show</label><select id="cardListenAnswer"><option value="back"'+(fListenAnswer==='back'?' selected':'')+'>The meaning (hear Korean, pick English)</option><option value="front"'+(fListenAnswer==='front'?' selected':'')+'>The written word (sound twins: 달 / 탈 / 딸)</option></select></div>' : '') +
        (needsChoicesField ? '<div class="field"><label for="cardChoices">'+(isBuildMode?'Extra wrong tiles (comma-separated, optional — e.g. 커피가 next to 커피를)':(isTimedChoiceMode||isListenMode)?'Wrong answers (comma-separated, optional — leave blank to auto-pick '+(isListenMode?'look-alikes ':'')+'from other cards in this deck)':'Wrong answers / other tiles (comma-separated)')+'</label><input id="cardChoices" type="text" value="'+esc(fChoices)+'" placeholder="e.g. 11, 12, 14"></div>' : '') +
        (isTimedChoiceMode ? '<div class="field"><label for="cardTcSeconds">Timer in seconds (optional — leave blank for the automatic 5–15 s vocab timer; e.g. 60 or 120 for a worked problem. The ⏱️ button then adds about a quarter of it.)</label><input id="cardTcSeconds" type="number" min="5" max="600" step="5" value="'+esc(fTcSeconds)+'" placeholder="e.g. 60"></div>' : '') +
        (isBlendMode ? '<div class="field"><label for="cardBlendChunks">Sound chunks (comma-separated, optional — leave blank to auto-split into letters, e.g. c-a-t)</label><input id="cardBlendChunks" type="text" value="'+esc(fBlendChunks)+'" placeholder="e.g. sh, i, p"></div>' : '') +
        (formMode === 'numsys' ? '' +
          '<div class="field"><label for="cardNsEmoji">Picture (an emoji, optional)</label><input id="cardNsEmoji" type="text" value="'+esc(draft.nsEmoji||'')+'"></div>' +
          '<div class="field"><label for="cardNsSys">Which numbers</label><select id="cardNsSys">' + ['native','sino','both'].map(function(k){ return '<option value="'+k+'"'+((draft.nsSys||'native')===k?' selected':'')+'>'+NUMSYS[k].icon+' '+NUMSYS[k].label+'</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="cardNsRule">The rule, in one line</label><input id="cardNsRule" type="text" lang="ko" value="'+esc(draft.nsRule||'')+'"></div>' +
          '<div class="field"><label for="cardNsParts">Pieces (piece = meaning; …), e.g. 세 = 3; 시 = o\'clock</label><input id="cardNsParts" type="text" lang="ko" value="'+esc(draft.nsParts||'')+'"></div>' : '') +
        (formMode === 'hanja' ? '' +
          '<div class="field"><label for="cardHanja">Hanja (as written in Korea, e.g. 學校)</label><input id="cardHanja" type="text" lang="ko" value="'+esc(draft.hanja||'')+'"></div>' +
          '<div class="field"><label for="cardSino">Korean part those characters spell (e.g. 학교, or 감사 in 감사합니다)</label><input id="cardSino" type="text" value="'+esc(draft.sino||'')+'"></div>' +
          '<div class="field"><label for="cardZh">Chinese, Traditional (blank = same as the Hanja; e.g. 到著)</label><input id="cardZh" type="text" lang="zh-Hant" value="'+esc(draft.zh||'')+'"></div>' +
          '<div class="field"><label for="cardZhS">Chinese, Simplified (optional, e.g. 学校)</label><input id="cardZhS" type="text" lang="zh-Hans" value="'+esc(draft.zhS||'')+'"></div>' +
          '<div class="field"><label for="cardPy">Pinyin, one syllable per character (e.g. xué xiào)</label><input id="cardPy" type="text" value="'+esc(draft.py||'')+'"></div>' +
          '<div class="field"><label for="cardHzClass">In Chinese</label><select id="cardHzClass">' + ['same','helps','false'].map(function(k){ return '<option value="'+k+'"'+((draft.hzClass||'same')===k?' selected':'')+'>'+HANJA_GROUPS[k].icon+' '+HANJA_GROUPS[k].label+'</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="cardZhSay">What Chinese says instead (optional, e.g. 機場)</label><input id="cardZhSay" type="text" lang="zh-Hant" value="'+esc(draft.zhSay||'')+'"></div>' : '') +
        '<div class="field"><label for="cardNote">'+(isReadMode||isBlendMode?'Hint (optional, shown small under the word)':'Fun fact / hint (optional)')+'</label><textarea id="cardNote" rows="2" placeholder="'+(isReadMode||isBlendMode?'e.g. sounds like OCK-tuh-puss':'e.g. 6 crabs + 7 crabs = 13 crabs!')+'">'+esc(fNote)+'</textarea></div>' +
        '<div class="field"><label for="cardCategory">Topic (optional — groups cards in Progress, e.g. Addition, Sight words)</label><input id="cardCategory" type="text" maxlength="24" value="'+esc(fCategory)+'" placeholder="e.g. Addition"></div>' +
        '<div class="form-actions">' +
          '<button class="btn btn-primary" data-act="save-card">'+(editingCard?'Save changes':'Add card')+'</button>' +
          '<button class="btn btn-ghost" data-act="cancel-card">Cancel</button>' +
        '</div>' +
      '</div>') : '<button class="btn btn-coral" data-act="open-add-card">＋ Add a card</button>';

    var currentSubject = deck.subject || '';
    var subjectIsCustom = !!(currentSubject && !SUBJECTS.some(function(s){ return s.id === currentSubject; }));
    var subjectChipsHTML = '<button type="button" class="subject-chip'+(!currentSubject?' active':'')+'" data-subject-chip="">🚫 None</button>' +
      SUBJECTS.map(function(s){
        return '<button type="button" class="subject-chip'+(currentSubject===s.id?' active':'')+'" data-subject-chip="'+s.id+'">'+s.icon+' '+s.label+'</button>';
      }).join('');

    // Deck type: a deck-level toggle, not a per-card mode -- six mutually exclusive options.
    // "Word Feed", "Story Mode", "Equation Feed" and "Language Feed" all open the same full-screen
    // TikTok-style swipe browser (see the WORD FEED, STORY MODE, EQUATION FEED and LANGUAGE FEED
    // sections above renderStudy()) instead of a graded study round (startStudy); "Read-Along" opens
    // a different shape of screen (the whole passage at once, see the READ-ALONG section) but is the
    // same kind of deck-level, just-for-fun toggle. Any deck can be flipped into any mode, existing
    // or new. `data-deck-type` keeps the old `on`/`off` values Word Feed shipped with, for one type
    // ('feed'), plus 'story', 'equation', 'lang', 'readalong' and 'regular'.
    var feedOn = !!deck.feedMode;
    var storyOn = !feedOn && !!deck.storyMode;
    var equationOn = !feedOn && !storyOn && !!deck.equationMode;
    var langOn = !feedOn && !storyOn && !equationOn && !!deck.langFeedMode;
    var readAlongOn = !feedOn && !storyOn && !equationOn && !langOn && !!deck.readAlongMode;
    var flashOn = !feedOn && !storyOn && !equationOn && !langOn && !readAlongOn && !!deck.flashFeedMode;
    var miniOn = !feedOn && !storyOn && !equationOn && !langOn && !readAlongOn && !flashOn && !!deck.miniStoryMode;
    var deckTypeHTML = '' +
      '<div class="subject-picker">' +
        '<label class="subject-picker-label">Deck type</label>' +
        '<div class="subject-chip-row">' +
          '<button type="button" class="subject-chip'+(!feedOn && !storyOn && !equationOn && !langOn && !readAlongOn && !flashOn && !miniOn?' active':'')+'" data-deck-type="regular">📚 Regular study deck</button>' +
          '<button type="button" class="subject-chip'+(feedOn?' active':'')+'" data-deck-type="feed">🎬 Word Feed</button>' +
          '<button type="button" class="subject-chip'+(storyOn?' active':'')+'" data-deck-type="story">📜 Story Mode</button>' +
          '<button type="button" class="subject-chip'+(equationOn?' active':'')+'" data-deck-type="equation">🧮 Equation Feed</button>' +
          '<button type="button" class="subject-chip'+(langOn?' active':'')+'" data-deck-type="lang">🌐 Language Feed</button>' +
          '<button type="button" class="subject-chip'+(readAlongOn?' active':'')+'" data-deck-type="readalong">🔤 Read-Along</button>' +
          '<button type="button" class="subject-chip'+(flashOn?' active':'')+'" data-deck-type="flash">🃏 Flash Feed</button>' +
          '<button type="button" class="subject-chip'+(miniOn?' active':'')+'" data-deck-type="mini">🎞️ Mini Story</button>' +
        '</div>' +
        '<p class="subject-picker-hint">' +
          (miniOn
            ? 'Mini Story turns this deck into a short picture story, one card per page, in the order the cards were added. A card\'s hint is the picture (type a few emoji, like ☕🏪), its front is the sentence (read aloud when the page opens; tap any word to hear it) and its back is the translation (tap 🌐 Meaning). Just-for-fun: no grading, no effect on stats or streaks.'
            : flashOn
            ? 'Flash Feed turns this deck into a silent, swipeable TikTok-style stack of flashcards — each card shows its front (and Topic); tap it to flip and see the back and hint, swipe up or down for another. Nothing is read aloud, so it suits formulas. Just-for-fun: no grading, no effect on stats or streaks.'
            : (storyOn
            ? 'Story Mode reads this deck\'s cards as one story, one word at a time, in the same swipeable TikTok-style browser as Word Feed — built automatically from each card\'s hint/note field, in the order the cards were added. Just-for-fun: no grading, no effect on stats or streaks.'
            : (equationOn
              ? 'Equation Feed shows each card\'s front (e.g. "3 + 4") with no answer. The full equation is spoken aloud slowly with the answer right away, and the answer bounces onto the screen a few seconds later. Swipe up or down for another. Just-for-fun: no grading, no effect on stats or streaks.'
              : (langOn
                ? 'Language Feed introduces only a few words at a time (starting with the first '+(deck.langBatchSize||5)+') in the same swipeable browser as Word Feed — the target word is spoken aloud, with the English translation fading in about a second later. Once every word in the current batch has been seen, the next batch unlocks automatically. Just-for-fun: no grading, no effect on stats or streaks.'
                : (readAlongOn
                  ? 'Read-Along shows this deck\'s whole story at once as one passage to read — built the same way as Story Mode, from each card\'s hint/note field, in the order the cards were added. Tap any word to hear it read aloud and see it highlighted. Just-for-fun: no grading, no effect on stats or streaks.'
                  : 'Word Feed turns "Dive In" into a swipeable, TikTok-style word browser — one word per screen, read aloud, swipe up or down for another. It\'s just-for-fun: no grading, no effect on stats or streaks.'))))) +
        '</p>' +
      '</div>';

    var speechOn = !deck.muteSpeech;
    var muteHTML = '' +
      '<div class="subject-picker">' +
        '<label class="subject-picker-label">Read aloud</label>' +
        '<div class="subject-chip-row">' +
          '<button type="button" class="subject-chip'+(speechOn?' active':'')+'" data-mute-speech="off">🔊 On</button>' +
          '<button type="button" class="subject-chip'+(!speechOn?' active':'')+'" data-mute-speech="on">🔇 Off for this deck</button>' +
        '</div>' +
        '<p class="subject-picker-hint">Turn this off for decks a speaking voice can\'t read well, like math formulas. Sound effects still play.</p>' +
      '</div>';

    app.innerHTML = '' +
      errorBannerHTML() +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="exit-editor">⟵ Lagoon</button>' +
        ctrlRowHTML() +
      '</div>' +
      '<div class="editor-head">' +
        '<button class="emoji-btn" data-act="toggle-emoji">'+deck.emoji+'</button>' +
        '<input id="deckNameInput" class="name-input" type="text" value="'+esc(deck.name)+'" maxlength="40">' +
      '</div>' +
      emojiPicker +
      '<div class="subject-picker">' +
        '<label class="subject-picker-label">Subject</label>' +
        '<div class="subject-chip-row">'+subjectChipsHTML+'</div>' +
        '<input id="customSubjectInput" class="subject-custom-input" type="text" maxlength="24" placeholder="Or type your own, e.g. Spanish" value="'+(subjectIsCustom?esc(currentSubject):'')+'">' +
        '<p class="subject-picker-hint">Groups this deck under a tab on the deck screen, like Reading or Math.</p>' +
      '</div>' +
      deckTypeHTML +
      muteHTML +
      '<h3 class="card-tools-title">Cards <span class="filter-count" id="cardCount">'+cards.length+'</span></h3>' +
      addForm +
      (cards.length > 6 ? '<input id="cardSearch" class="card-search" type="search" placeholder="🔍 Search cards…" aria-label="Search cards in this deck" autocomplete="off">' : '') +
      '<div class="card-list">'+rows+'</div>' +
      '<div class="empty-state" id="cardNoMatch" hidden>No cards match.</div>' +
      '<div class="danger-zone"><button class="btn btn-danger" data-act="del-deck">Delete this deck</button></div>';

    app.querySelector('[data-act="exit-editor"]').addEventListener('click', function(){
      S.editingCardId = null;
      S.cardFormDraft = null;
      goHome();
    });
    wireCtrlRow();
    wireErrorBanner();
    var cardSearch = document.getElementById('cardSearch');
    if(cardSearch) cardSearch.addEventListener('input', function(){
      var q = cardSearch.value.trim().toLowerCase(), shown = 0, rowsEl = app.querySelectorAll('.card-list .card-row');
      rowsEl.forEach(function(r){ var m = !q || r.textContent.toLowerCase().indexOf(q) !== -1; r.hidden = !m; if(m) shown++; });
      var cc = document.getElementById('cardCount'); if(cc) cc.textContent = q ? shown+' / '+rowsEl.length : rowsEl.length;
      var nm = document.getElementById('cardNoMatch'); if(nm) nm.hidden = shown > 0 || !q;
    });
    if(S._formScroll){ S._formScroll = false; var fcEl = app.querySelector('.form-card'); if(fcEl) fcEl.scrollIntoView({ block:'start' }); }
    app.querySelector('[data-act="toggle-emoji"]').addEventListener('click', function(){ S.emojiPickerOpen = !S.emojiPickerOpen; render(); });
    app.querySelectorAll('.emoji-opt').forEach(function(b){
      b.addEventListener('click', function(){
        S.store.updateDeck(deck.id, { emoji: b.dataset.emoji });
        S.emojiPickerOpen = false;
        render();
      });
    });
    var nameInput = document.getElementById('deckNameInput');
    nameInput.addEventListener('change', function(){
      var val = nameInput.value.trim() || 'Untitled Deck';
      S.store.updateDeck(deck.id, { name: val });
    });
    app.querySelectorAll('[data-deck-type]').forEach(function(b){
      b.addEventListener('click', function(){
        var type = b.dataset.deckType; // 'regular' | 'feed' | 'story' | 'equation' | 'lang' | 'readalong'
        var current = feedOn ? 'feed' : (storyOn ? 'story' : (equationOn ? 'equation' : (langOn ? 'lang' : (readAlongOn ? 'readalong' : (flashOn ? 'flash' : (miniOn ? 'mini' : 'regular'))))));
        if(type === current) return;
        // The six types are mutually exclusive, so every switch clears all five flags and then sets
        // whichever one applies -- never leaves a stale feedMode/storyMode/equationMode/langFeedMode/
        // readAlongMode true from a prior choice. Switching a deck into Language Feed for the first
        // time seeds its pacing fields (batch size 5, first batch already unlocked) if they aren't set yet.
        var patch = { feedMode: type === 'feed', storyMode: type === 'story', equationMode: type === 'equation', langFeedMode: type === 'lang', readAlongMode: type === 'readalong', flashFeedMode: type === 'flash', miniStoryMode: type === 'mini' };
        if(type === 'lang' && !deck.langBatchSize){ patch.langBatchSize = 5; patch.langUnlockedCount = 5; }
        S.store.updateDeck(deck.id, patch);
        render();
      });
    });
    app.querySelectorAll('[data-mute-speech]').forEach(function(b){
      b.addEventListener('click', function(){
        var mute = b.dataset.muteSpeech === 'on';
        if(mute === !!deck.muteSpeech) return;
        S.store.updateDeck(deck.id, { muteSpeech: mute });
        render();
      });
    });
    app.querySelectorAll('[data-subject-chip]').forEach(function(b){
      b.addEventListener('click', function(){
        var val = b.dataset.subjectChip;
        if(val === currentSubject) return;
        S.store.updateDeck(deck.id, { subject: val ? val : null });
        render();
      });
    });
    var customSubjectInput = document.getElementById('customSubjectInput');
    if(customSubjectInput) customSubjectInput.addEventListener('change', function(){
      var val = customSubjectInput.value.trim();
      S.store.updateDeck(deck.id, { subject: val ? val : null });
      render();
    });
    app.querySelectorAll('[data-act="edit-card"]').forEach(function(b){
      b.addEventListener('click', function(){
        var c = cards.find(function(x){ return x.id === b.dataset.card; });
        S.editingCardId = b.dataset.card;
        S._formScroll = true;
        S.addCardOpen = false;
        S.cardFormMode = (c && (CARD_MODES.indexOf(c.mode) !== -1)) ? c.mode : 'flip';
        S.cardFormDraft = { listenAnswer: (c && c.listenAnswer === 'front') ? 'front' : 'back', front: c ? c.front : '', back: c ? (c.back||'') : '', note: c ? (c.note||'') : '', choices: c ? (c.choices||[]).join(', ') : '', blendChunks: c ? (c.blendChunks||[]).join(', ') : '', category: c ? (c.category||'') : '', photoId: c ? (c.photoId||'') : '', photoUrl: c ? (c.photoUrl||'') : '', tcSeconds: (c && c.tcSeconds) ? String(c.tcSeconds) : '', hanja: c ? (c.hanja||'') : '', sino: c ? (c.sino||'') : '', zh: c ? (c.zh||'') : '', zhS: c ? (c.zhS||'') : '', py: c ? (c.py||'') : '', hzClass: c ? (c.hzClass||'same') : 'same', zhSay: c ? (c.zhSay||'') : '', nsEmoji: c ? (c.nsEmoji||'') : '', nsSys: c ? (c.nsSys||'native') : 'native', nsRule: c ? (c.nsRule||'') : '', nsParts: c ? (c.nsParts||[]).map(function(p){ return p[0] + ' = ' + (p[1]||''); }).join('; ') : '' };
        S.cardFormOriginalPhotoId = c ? (c.photoId||'') : '';
        render();
      });
    });
    app.querySelectorAll('[data-act="del-card"]').forEach(function(b){
      b.addEventListener('click', function(){
        var c = cards.find(function(x){ return x.id === b.dataset.card; });
        var photoId = c && c.photoId;
        var label = c && c.front ? String(c.front).slice(0, 40) : 'this card';
        showDialog({ title: 'Delete this card?', message: '"'+label+'" will be deleted. It can\'t be undone.', confirmLabel: 'Delete card', danger: true }).then(function(yes){
          if(!yes) return;
          S.store.deleteCard(deck.id, b.dataset.card).then(function(){ if(photoId) Assets.remove(photoId); });
        });
      });
    });
    var openAdd = app.querySelector('[data-act="open-add-card"]');
    if(openAdd) openAdd.addEventListener('click', function(){
      S.addCardOpen = true; S._formScroll = true; S.editingCardId = null; S.cardFormMode = 'flip'; S.cardFormDraft = { front:'', back:'', note:'', choices:'', blendChunks:'', category:'', photoId:'', photoUrl:'', tcSeconds:'' };
      S.cardFormOriginalPhotoId = '';
      render();
      setTimeout(function(){ var el=document.getElementById('cardFront'); if(el) el.focus(); },0);
    });
    var cancelBtn = app.querySelector('[data-act="cancel-card"]');
    if(cancelBtn) cancelBtn.addEventListener('click', function(){
      // A photo picked during this add/edit session that was never actually saved onto the card
      // is now an orphan -- clean it up. The card's ORIGINAL photo (if any) is left untouched.
      var draftPhotoId = S.cardFormDraft ? S.cardFormDraft.photoId : '';
      if(draftPhotoId && draftPhotoId !== S.cardFormOriginalPhotoId) Assets.remove(draftPhotoId);
      S.addCardOpen = false; S.editingCardId = null; S.cardFormDraft = null; S.cardFormOriginalPhotoId = ''; render();
    });
    app.querySelectorAll('[data-mode]').forEach(function(b){
      b.addEventListener('click', function(){
        var frontEl = document.getElementById('cardFront');
        var backEl = document.getElementById('cardBack');
        var noteEl = document.getElementById('cardNote');
        var choicesEl = document.getElementById('cardChoices');
        var blendChunksEl = document.getElementById('cardBlendChunks');
        var categoryEl = document.getElementById('cardCategory');
        var tcSecondsEl = document.getElementById('cardTcSeconds');
        var listenAnsEl = document.getElementById('cardListenAnswer');
        S.cardFormDraft = {
          listenAnswer: listenAnsEl ? listenAnsEl.value : (draft.listenAnswer||'back'),
          tcSeconds: tcSecondsEl ? tcSecondsEl.value : (draft.tcSeconds||''),
          front: frontEl ? frontEl.value : (draft.front||''),
          back: backEl ? backEl.value : (draft.back||''),
          note: noteEl ? noteEl.value : (draft.note||''),
          choices: choicesEl ? choicesEl.value : (draft.choices||''),
          blendChunks: blendChunksEl ? blendChunksEl.value : (draft.blendChunks||''),
          category: categoryEl ? categoryEl.value : (draft.category||''),
          photoId: draft.photoId || '',
          photoUrl: draft.photoUrl || ''
        };
        ['hanja','sino','zh','zhS','py','hzClass','zhSay','nsEmoji','nsSys','nsRule','nsParts'].forEach(function(k){ var el = document.getElementById('card' + k.charAt(0).toUpperCase() + k.slice(1)); S.cardFormDraft[k] = el ? el.value : (draft[k] || ''); });
        S.cardFormMode = b.dataset.mode;
        render();
      });
    });
    function pickPhoto(){
      var input = document.getElementById('cardPhotoInput');
      if(input) input.click();
    }
    var addPhotoBtn = app.querySelector('[data-act="add-photo"]');
    if(addPhotoBtn) addPhotoBtn.addEventListener('click', pickPhoto);
    var replacePhotoBtn = app.querySelector('[data-act="replace-photo"]');
    if(replacePhotoBtn) replacePhotoBtn.addEventListener('click', pickPhoto);
    var removePhotoBtn = app.querySelector('[data-act="remove-photo"]');
    if(removePhotoBtn) removePhotoBtn.addEventListener('click', function(){
      var removedId = S.cardFormDraft ? S.cardFormDraft.photoId : '';
      S.cardFormDraft = Object.assign({}, draft, { photoId:'', photoUrl:'' });
      render();
      // Only an unsaved-this-session upload is safe to delete immediately -- if it's the card's
      // original saved photo, it stays valid until Save actually commits the removal.
      if(removedId && removedId !== S.cardFormOriginalPhotoId) Assets.remove(removedId);
    });
    var photoInput = document.getElementById('cardPhotoInput');
    if(photoInput) photoInput.addEventListener('change', function(){
      var file = photoInput.files && photoInput.files[0];
      if(!file) return;
      var priorDraftPhotoId = S.cardFormDraft ? S.cardFormDraft.photoId : '';
      S.photoUploading = true;
      render();
      downscalePhoto(file, 1600).then(function(blob){
        return Assets.upload(blob);
      }).then(function(res){
        S.cardFormDraft = Object.assign({}, draft, { photoId: res.id, photoUrl: res.url });
        S.photoUploading = false;
        render();
        // An earlier unsaved upload from this same form session, now superseded, is a clean orphan.
        if(priorDraftPhotoId && priorDraftPhotoId !== S.cardFormOriginalPhotoId) Assets.remove(priorDraftPhotoId);
      }).catch(function(err){
        console.error('[Coral Cove] photo upload failed', err);
        S.photoUploading = false;
        S.storeError = 'That photo didn\'t upload. Check your connection and try again.';
        render();
      });
    });
    var saveBtn = app.querySelector('[data-act="save-card"]');
    if(saveBtn) saveBtn.addEventListener('click', function(){
      var front = document.getElementById('cardFront').value.trim();
      var backEl = document.getElementById('cardBack');
      var back = backEl ? backEl.value.trim() : '';
      var note = document.getElementById('cardNote').value.trim();
      var choicesEl = document.getElementById('cardChoices');
      var choicesArr = choicesEl ? choicesEl.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
      var blendChunksEl = document.getElementById('cardBlendChunks');
      var blendChunksArr = blendChunksEl ? blendChunksEl.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
      var category = document.getElementById('cardCategory').value.trim();
      var mode = S.cardFormMode || 'flip';
      var requiresChoices = mode === 'choice' || mode === 'match' || mode === 'blank'; // 'timedchoice' can fall back to auto-picked distractors, so it's the one mode that saves fine with zero manual choices
      var savesChoices = requiresChoices || mode === 'timedchoice' || mode === 'listen' || mode === 'build' || mode === 'numsys';
      if(!front) return;
      if(mode !== 'read' && mode !== 'blend' && mode !== 'listen' && mode !== 'echo' && !back) return;
      if(requiresChoices && choicesArr.length < 1) return;
      var photoId = draft.photoId || '';
      var photoUrl = draft.photoUrl || '';
      var tcSecondsEl = document.getElementById('cardTcSeconds');
      var tcSecondsVal = tcSecondsEl ? parseInt(tcSecondsEl.value, 10) : NaN;
      var listenAnsSel = document.getElementById('cardListenAnswer');
      var payload = { listenAnswer: mode === 'listen' && listenAnsSel ? listenAnsSel.value : null, front: front, back: back, note: note, mode: mode, choices: savesChoices ? choicesArr : [], blendChunks: mode === 'blend' ? blendChunksArr : [], category: category, photoId: photoId, photoUrl: photoUrl };
      // Timer override only means anything for Timed Choice; a blank field clears it back to the
      // automatic timing. tcAddSeconds is cleared too so the +time button re-derives from the new timer.
      if(mode === 'timedchoice' && tcSecondsVal > 0){ payload.tcSeconds = Math.max(5, Math.min(600, tcSecondsVal)); }
      else { payload.tcSeconds = null; }
      if(!editingCard || !(editingCard.tcSeconds && payload.tcSeconds === editingCard.tcSeconds)) payload.tcAddSeconds = null;
      if(mode === 'hanja'){ ['hanja','sino','zh','zhS','py','hzClass','zhSay'].forEach(function(k){ var el = document.getElementById('card' + k.charAt(0).toUpperCase() + k.slice(1)); payload[k] = el ? el.value.trim() : ''; }); if(!payload.zh) payload.zh = payload.hanja; }
      if(mode === 'numsys'){ ['nsEmoji','nsSys','nsRule'].forEach(function(k){ var el = document.getElementById('card' + k.charAt(0).toUpperCase() + k.slice(1)); payload[k] = el ? el.value.trim() : ''; }); var pe = document.getElementById('cardNsParts'); payload.nsParts = pe ? pe.value.split(';').map(function(x){ var i = x.indexOf('='); return i < 0 ? [x.trim(), ''] : [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }).filter(function(p){ return p[0]; }) : []; }
      var origPhotoId = S.cardFormOriginalPhotoId;
      var savePromise;
      if(editingCard){
        savePromise = S.store.updateCard(deck.id, editingCard.id, payload);
        S.editingCardId = null;
      } else {
        savePromise = S.store.addCard(deck.id, payload);
        S.addCardOpen = false;
      }
      // Only once the save actually succeeds is the old photo (if replaced or removed) safe to
      // clean up -- if the save failed, the card still points at it and it must stay valid.
      if(origPhotoId && origPhotoId !== photoId){
        savePromise.then(function(){ Assets.remove(origPhotoId); }).catch(function(){});
      }
      S.cardFormDraft = null;
      S.cardFormOriginalPhotoId = '';
      render();
    });
    var delDeckBtn = app.querySelector('[data-act="del-deck"]');
    if(delDeckBtn) delDeckBtn.addEventListener('click', function(){
      showDialog({ title: 'Delete "'+deck.name+'"?', message: 'This deletes the deck and all its cards. It can\'t be undone.', confirmLabel: 'Delete deck', danger: true }).then(function(yes){
        if(!yes) return;
        var photoIds = cards.map(function(c){ return c.photoId; }).filter(Boolean);
        S.store.deleteDeck(deck.id).then(function(){
          photoIds.forEach(function(id){ Assets.remove(id); });
          goHome();
        });
      });
    });
  }

  // After every screen draw, move the one swimmer into whichever water is on screen (or let her rest).
  // At the end of a round she does one happy loop-the-loop; anywhere else she keeps a calm face.
  function coveSumTip(){ return 'Give ' + coveSwimName() + ' a treat: tap the water'; }
  // The little Shelly / Lumi on a round's progress bar answers a tap with a hop and a few bubbles.
  document.addEventListener('click', function(e){
    var c = e.target && e.target.closest && e.target.closest('.critter-swim');
    if(!c) return;
    var svgs = c.querySelectorAll('svg'), v = null;
    for(var i = 0; i < svgs.length; i++){ if(getComputedStyle(svgs[i]).display !== 'none'){ v = svgs[i]; break; } }
    try { Sound.bubbles(3); } catch(err){}
    try { Ocean.bubbles(5); } catch(err){}
    var rm = false; try { rm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(err){}
    if(v && !rm && v.animate) v.animate([{ transform:'none' }, { transform:'translateY(-12px) rotate(-12deg) scale(1.12)' }, { transform:'translateY(0) rotate(4deg)' }, { transform:'none' }], { duration:620, easing:'cubic-bezier(.3,1.4,.5,1)' });
  });
  // the swimmer joins in when a round's results are on screen, and calms down when they leave
  afterRender('swimmer', function(){
    coveWaterMount();
    if(S.view === 'summary' || S.view === 'sessionResults'){
      var key = S.view + '|' + (S.roundStartedAt || '') + '|' + S.sessionReviewed;
      if(S.__swJoyKey !== key){ S.__swJoyKey = key; coveSwimJoy(true); }
    } else if(S.__swJoyKey){ S.__swJoyKey = null; coveSwimCalm(); }
  });

