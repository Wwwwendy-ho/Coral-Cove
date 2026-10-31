/*
 * Coral Cove Library: learning modes and decks that live beside the reef board (not on it).
 *   Home         built around the profile's learning goals (deck subjects, set in Settings): one tab per goal,
 *                a "Next up" activity from today's four, and the rest of that goal's activities to pick from
 *   Tutor        ask anything, Socratic help, big-question talks, role-play, debate, explain it 3 ways,
 *                teach-back, question of the day, voice
 *   Worksheets   from a deck, maths, a topic, spiral review, word problems, cloze, handwriting,
 *                ordering, label-a-diagram, from a photo; three levels; print or save as PDF
 *   Check my work  writing feedback with rubrics, photo marking
 *   Progress     mastery per deck and skill, confidence, misconceptions, placement check, weekly letter
 *   Maths lab    facts practice, visual models, manipulatives, mental strategies, geometry, clocks
 *                and money, puzzles
 *
 * Everything works offline with built-in algorithms. When the device is online and a grown-up has set up the
 * Claude helper (tools/claude-proxy-worker.js), the tutor, worksheet maker and feedback use Claude instead,
 * and fall back to the offline version if Claude can't be reached.
 *
 * The app hands the Library what it may use through window.CoralCove (see index.html).
 */
(function(){
  'use strict';
  var CC = function(){ return window.CoralCove || null; };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root){ return (root || document).querySelector(sel); }
  function $$(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function rnd(n){ return Math.floor(Math.random() * n); }
  function pick(a){ return a[rnd(a.length)]; }
  function shuffle(a){ a = a.slice(); for(var i = a.length - 1; i > 0; i--){ var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function plain(h){ var d = document.createElement('div'); d.innerHTML = String(h || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function speak(t){ var c = CC(); if(c && LIB.settings().voice !== false) c.speak(t); }
  function sound(n){ var c = CC(); if(c) c.sound(n); }
  // The app's drawn icons (window.ccIcon in index.html); an emoji stands in if they aren't there
  function icon(n, fallback){ return window.ccIcon ? window.ccIcon(n) : (fallback || ''); }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ---------- per-device settings, and per-profile Library records (kept on this device) ---------- */
  var SKEY = 'coral-lib-settings';
  function settings(){ try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch(e){ return {}; } }
  function saveSettings(s){ try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch(e){} }
  function pkey(){ var p = CC() && CC().profile(); return 'coral-lib:' + (p ? p.id : 'guest'); }
  function rec(){ try { return JSON.parse(localStorage.getItem(pkey())) || {}; } catch(e){ return {}; } }
  function saveRec(r){ try { localStorage.setItem(pkey(), JSON.stringify(r)); } catch(e){} }
  // An event in the Library's log (maths answers, worksheets done, chats), for progress and the weekly letter.
  function log(kind, data){
    var r = rec(); r.log = r.log || [];
    r.log.push(Object.assign({ k: kind, t: Date.now() }, data || {}));
    if(r.log.length > 3000) r.log = r.log.slice(-3000);
    saveRec(r);
  }

  /* ---------- Claude when online (through the grown-up's helper), otherwise the offline version ---------- */
  function claudeReady(){ var s = settings(); return !!(s.proxyUrl && s.proxyCode && navigator.onLine !== false); }
  // ask(task, messages, system) -> Promise of text, or null when Claude isn't available (callers then use offline).
  function ask(task, messages, system){
    if(!claudeReady()) return Promise.resolve(null);
    var s = settings(), ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function(){ if(ctl) ctl.abort(); }, task === 'worksheet' || task === 'photo' ? 60000 : 25000);
    return fetch(s.proxyUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-coral-code': s.proxyCode },
      body: JSON.stringify({ task: task, system: system || '', messages: messages }), signal: ctl ? ctl.signal : undefined })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j && j.error || ('status ' + r.status)); return j; }); })
      .then(function(j){ clearTimeout(timer); LIB.lastSource = 'claude'; return (j && j.text) || null; })
      .catch(function(e){ clearTimeout(timer); LIB.lastSource = 'offline'; LIB.lastError = String(e && e.message || e); return null; });
  }
  // Pulls the first {...} or [...] out of a reply, for tasks that ask Claude for JSON.
  function jsonFrom(text){
    if(!text) return null;
    var m = text.match(/```(?:json)?\s*([\s\S]*?)```/); var t = m ? m[1] : text;
    var a = t.indexOf('{'), b = t.indexOf('['), s = a < 0 ? b : b < 0 ? a : Math.min(a, b); if(s < 0) return null;
    try { return JSON.parse(t.slice(s, Math.max(t.lastIndexOf('}'), t.lastIndexOf(']')) + 1)); } catch(e){ return null; }
  }

  /* ---------- her decks and cards ---------- */
  var cardCache = {};
  function decks(){ var c = CC(); return c ? c.decks() : []; }
  function cards(id){
    if(cardCache[id] && Date.now() - cardCache[id].t < 60000) return Promise.resolve(cardCache[id].v);
    var c = CC(); if(!c) return Promise.resolve([]);
    return Promise.resolve(c.cards(id)).then(function(v){ v = (v || []).filter(function(x){ return !x.suspended; }); cardCache[id] = { t: Date.now(), v: v }; return v; }, function(){ return []; });
  }
  function allCards(){
    var ds = decks();
    return Promise.all(ds.map(function(d){ return cards(d.id).then(function(cs){ return cs.map(function(c){ return { deck: d, card: c, front: plain(c.front), back: plain(c.back), note: plain(c.note) }; }); }); }))
      .then(function(lists){ return [].concat.apply([], lists); });
  }
  function cardStateOf(c){ if((c.interval || 0) >= 21) return 'mastered'; if((c.interval || 0) > 0 || c.state === 'review' || c.state === 'learning') return 'learning'; return 'new'; }

  /* ---------- the screen ---------- */
  var root = null, stack = [];
  var LIB = window.CoralLibrary = {
    open: function(){ build(); root.hidden = false; document.body.classList.add('clib-open'); stack = []; go('home'); },
    close: close, go: go, back: back, ask: ask, jsonFrom: jsonFrom, settings: settings, rec: rec, saveRec: saveRec, log: log,
    claudeReady: claudeReady, decks: decks, cards: cards, allCards: allCards, cardStateOf: cardStateOf,
    esc: esc, $: $, $$: $$, rnd: rnd, pick: pick, shuffle: shuffle, plain: plain, speak: speak, sound: sound, today: today,
    views: {}, lastSource: 'offline'
  };
  function close(){ if(root){ root.hidden = true; root.querySelector('.clib-body').innerHTML = ''; } document.body.classList.remove('clib-open'); var c = CC(); if(c) c.stopSpeaking(); }
  function go(name, arg, replace){
    var v = LIB.views[name]; if(!v) return;
    if(!replace && stack.length && stack[stack.length - 1].name === name && !arg) return;
    if(replace) stack.pop();
    stack.push({ name: name, arg: arg });
    var body = root.querySelector('.clib-body'), head = root.querySelector('.clib-title');
    body.innerHTML = ''; body.scrollTop = 0;
    head.textContent = v.title || 'Library';
    root.querySelector('.clib-back').innerHTML = icon(stack.length > 1 ? 'back' : 'close') + '<span>' + (stack.length > 1 ? 'Back' : 'Close') + '</span>';
    root.querySelector('.clib-source').textContent = claudeReady() ? '✨ Claude on' : '📴 Offline mode';
    try { v.render(body, arg); } catch(e){ body.innerHTML = '<p class="clib-note">Something went wrong opening this page. ' + esc(e.message) + '</p>'; console.error('[Library]', e); }
    head.textContent = v.title || 'Library';   // some pages set their title while rendering
  }
  function back(){ var c = CC(); if(c) c.stopSpeaking(); if(stack.length <= 1) return close(); stack.pop(); var top = stack.pop(); go(top.name, top.arg); }
  function build(){
    if(root) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.className = 'clib'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Library');
    root.innerHTML = '<header class="clib-head"><button type="button" class="clib-back">' + icon('close') + '<span>Close</span></button><h1 class="clib-title">Library</h1><span class="clib-source"></span></header><main class="clib-body"></main>';
    root.querySelector('.clib-back').addEventListener('click', back);
    root.addEventListener('keydown', function(e){ if(e.key === 'Escape') back(); });
    document.body.appendChild(root);
  }
  // A grid of big buttons: [{ id, e, name, note, view, arg }]
  function tiles(list){
    return '<div class="clib-tiles">' + list.map(function(t){
      return '<button type="button" class="clib-tile" data-view="' + esc(t.view) + '"' + (t.arg != null ? ' data-arg="' + esc(t.arg) + '"' : '') + '>' +
        '<span class="clib-tile-e" aria-hidden="true">' + (t.icon && window.ccIcon ? window.ccIcon(t.icon) : t.e) + '</span><b>' + esc(t.name) + '</b>' + (t.note ? '<small>' + esc(t.note) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function wireTiles(el){ $$('[data-view]', el).forEach(function(b){ b.addEventListener('click', function(){ sound('tap'); go(b.dataset.view, b.dataset.arg); }); }); }
  LIB.tiles = tiles; LIB.wireTiles = wireTiles; LIB.icon = icon;

  /* ---------- HOME: built around the profile's learning goals (Wendy chose this layout) ----------
     One tab per goal. Each goal has a list of activities; its first four are today's plan. "Next up" is the first
     of those not done today, and the rest can be picked any time. An activity counts as done when she comes back
     to this page from it (a deck: when it starts). Goals come from the app (CoralCove.profile().goals). */
  var GOAL_LOOK = { math: 'math', reading: 'read', korean: 'ko', science: 'sci', life: 'life' };   // colour class per goal
  function lookOf(g){ return 'clib-g-' + (GOAL_LOOK[g] || 'other'); }
  function goalMeta(id){
    if(id === 'explore') return { id: id, icon: '🌊', label: 'Explore' };
    var s = (CC() && CC().subjects ? CC().subjects() : []).find(function(x){ return x.id === id; });
    return s || { id: id, icon: '🏷️', label: id };
  }
  function myGoals(){ var p = CC() && CC().profile(), g = p && p.goals || []; return g.length ? g : ['explore']; }
  function goalDecks(subject){ return decks().filter(function(d){ return d.subject === subject; }); }
  var ACT_ICON = { deck: 'cards', 'play-cafe': 'cup', 'play-library': 'library', 'play-sci': 'flask', 'ws-cloze': 'puzzle', 'ws-trace': 'edit', ask: 'ask', mastery: 'trophy', tricky: 'search',
    teach: 'tutor', writing: 'edit', talks: 'talk', facts: 'maths', geometry: 'maths', manip: 'counting', measure: 'clock', mental: 'tutor', placement: 'progress', puzzles: 'puzzle', visual: 'search' };
  function actIcon(a){ var n = ACT_ICON[a.id] || (/^ws-/.test(a.id || '') ? 'worksheet' : null); return n ? icon(n, a.e) : a.e; }
  var PLAY_ICON = { cafe: 'cup', restaurant: 'bowl', shop: 'bag', subway: 'train', taxi: 'car', hotel: 'bed', intro: 'wave', help: 'lifebuoy', market: 'apple', library: 'library', scientist: 'flask' };
  function act(id, e, name, note, view, arg){ return { id: id, e: e, name: name, note: note, view: view, arg: arg }; }
  function wsAct(id, e, name, note, o){ return act(id, e, name, note, 'wsMake', JSON.stringify(o)); }
  function goalPlan(subject){
    var gd = goalDecks(subject), d0 = gd[0];
    var deck = gd.length ? { id: 'deck', e: '🗂️', name: 'Practise your decks', note: gd.length === 1 ? d0.name : gd.length + ' decks', deck: true } : null;
    var plans = {
      math: [deck, act('facts', '⚡', 'Facts practice', 'The facts you are learning', 'facts'), act('visual', '📏', 'See it', 'Number lines and ten frames', 'visual'),
        act('manip', '🧱', 'Blocks and counters', 'Build the numbers', 'manip'), act('mental', '🧠', 'Brain tricks', 'Count on, make ten', 'mental'),
        wsAct('ws-math', '📝', 'Maths worksheet', 'Sums at your level', { src: 'math' }), act('measure', '🕒', 'Clocks and money', 'Tell the time, pay the shop', 'measure'),
        act('geometry', '🔷', 'Shapes', 'Sides, corners, symmetry', 'geometry'), act('puzzles', '🧩', 'Puzzles', 'Sudoku and patterns', 'puzzles'),
        act('placement', '🧭', 'Where am I?', 'Maths placement check', 'placement')],
      reading: [deck, d0 ? wsAct('ws-cloze', '🧩', 'Fill the gaps', 'Words from ' + d0.name, { src: 'cloze', deck: d0.id }) : null,
        wsAct('ws-trace', '✏️', 'Handwriting', 'Letters a to z', { src: 'trace', script: 'abc' }), wsAct('ws-order', '🔢', 'Put it in order', 'Story steps', { src: 'order' }),
        act('teach', '🎓', 'Teach Shelly', 'Explain a word to her', 'teachback'), act('writing', '✍️', 'My writing', 'Write, then get kind feedback', 'writing'),
        act('play-library', '📚', 'Role-play', 'Ask for a book at the library', 'play', 'library'), act('talks', '💭', 'Big questions', 'Talk about ideas', 'talks')],
      korean: [deck, act('play-cafe', '☕', 'Role-play', 'Order at a Korean café', 'play', 'cafe'),
        d0 ? wsAct('ws-cloze', '🧩', 'Fill the gaps', 'Words from ' + d0.name, { src: 'cloze', deck: d0.id }) : null,
        wsAct('ws-trace', '✏️', 'Hangul handwriting', 'Trace the letters', { src: 'trace', script: 'hangul' }), act('ask', '🐢', 'Ask about a word', 'Its parts and meaning', 'chat', 'ask'),
        d0 ? wsAct('ws-deck', '📝', 'Worksheet', 'Match and answer, from ' + d0.name, { src: 'deck', deck: d0.id }) : null,
        act('mastery', '🏆', 'Mastery', 'What you know well', 'mastery'), act('tricky', '🔎', 'Tricky spots', 'Mistakes to fix', 'misconceptions')],
      science: [deck, wsAct('ws-label', '🐠', 'Label a diagram', 'Fish, turtle, plant', { src: 'label' }), act('play-sci', '🔬', 'Role-play', 'Interview a marine biologist', 'play', 'scientist'),
        wsAct('ws-order', '🔢', 'Put it in order', 'Life cycles', { src: 'order' }), act('ask', '🐢', 'Ask Shelly', 'Any question', 'chat', 'ask'), act('talks', '💭', 'Big questions', 'Talk about ideas', 'talks')]
    };
    return (plans[subject] || [deck, d0 ? wsAct('ws-deck', '📝', 'Worksheet', 'From ' + d0.name, { src: 'deck', deck: d0.id }) : null,
      act('ask', '🐢', 'Ask Shelly', 'Any question', 'chat', 'ask'), act('teach', '🎓', 'Teach Shelly', 'Explain it to her', 'teachback'),
      act('facts', '⚡', 'Facts practice', 'Maths facts', 'facts')]).filter(Boolean);
  }
  function dayRec(){ var r = rec(); if(!r.day || r.day.date !== today()) r.day = { date: today(), done: {} }; return r; }
  function markDone(goal, id){ var r = dayRec(), l = r.day.done[goal] = r.day.done[goal] || []; if(l.indexOf(id) < 0) l.push(id); saveRec(r); }
  var pendingAct = null;   // the activity opened from the home page: done when she comes back to it
  // The goal deck with the most cards ready.
  function bestDeck(ds){
    var now = Date.now();
    return Promise.all(ds.map(function(d){ return cards(d.id).then(function(cs){ return { d: d, due: cs.filter(function(c){ return !c.due || c.due <= now; }).length }; }); }))
      .then(function(l){ l.sort(function(a, b){ return b.due - a.due; }); return l[0] || null; });
  }
  function startAct(goal, a){
    sound('tap');
    if(a.deck) return bestDeck(goalDecks(goal)).then(function(best){ if(!best) return; markDone(goal, a.id); close(); CC().startDeck(best.d.id); });
    pendingAct = { goal: goal, id: a.id }; go(a.view, a.arg);
  }
  /* ---------- Coral Classroom: a course for a profile, planned the way a good teacher plans one ----------
     Backward design: the course starts from what the learner wants to be able to DO ("be conversational when I
     visit Korea"), turns that into "I can…" goals for each unit, and only then picks the decks and activities
     that get there. Every unit:
       - has a real-life focus and 2–4 "I can…" statements she can tick off,
       - balances listening, speaking, reading and writing,
       - follows a weekly rhythm: learn → listen and repeat → use it → mix old and new → quick check,
       - brings back earlier units' words (spaced, mixed review), and
       - ends with an optional check. The result adjusts the course: a strong result speeds the next unit up, a
         middling one adds the missed items as fix-up practice, a weak one adds a week at a gentler pace.
     Review weeks pull units together, and an optional placement check at the start lets her skip ahead. New words
     per study day come from her minutes a day and starting level; with a trip or target date, the pace is fitted to
     it. Pure rules on her own decks: works offline. The course is saved on the profile (CoralCove.setCourse), and
     the app reads it for the Daily Plan and the treasure map. Any profile can have one; for now it's on for Wendy
     (see courseOn in library-api.js). */
  function course(){ var c = CC(); return c && c.course ? c.course() : null; }
  function courseOn(){ var c = CC(); return !!(c && c.courseOn && c.courseOn()); }
  function saveCourse(co){ var c = CC(); return c && c.setCourse ? Promise.resolve(c.setCourse(co)) : Promise.resolve(false); }
  function isoOf(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dateOf(iso){ var p = String(iso || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : new Date(); }
  function addDays(iso, n){ var d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); }
  function nextMonday(){ var d = new Date(); var add = (8 - d.getDay()) % 7; if(add === 0 && d.getHours() >= 12) add = 7; d.setDate(d.getDate() + add); return isoOf(d); }
  function niceDate(iso){ try { return dateOf(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch(e){ return iso; } }
  function cardKey(c){ return (c.order != null ? String(c.order).padStart(6, '0') : '') + '|' + String(c.createdAt || 0).padStart(15, '0') + '|' + (c.id || ''); }
  function sortedCards(cs){ return cs.slice().sort(function(a, b){ return cardKey(a) < cardKey(b) ? -1 : 1; }); }
  function knownCard(c){ return (c.interval || 0) >= 3 || cardStateOf(c) === 'mastered'; }
  function hasHangul(t){ return /[가-힣]/.test(t || ''); }

  // What each deck is for, from its cards: script and sounds, listening, speaking, words, numbers, sentences,
  // little stories, or word roots. Near-copies of another deck (the same words) become its fluency partner.
  function courseDecks(){
    var ds = decks();
    return Promise.all(ds.map(function(d){ return cards(d.id); })).then(function(lists){
      var out = [];
      ds.forEach(function(d, i){
        var cs = sortedCards(lists[i] || []); if(!cs.length) return;
        var modes = {}; cs.forEach(function(c){ modes[c.mode || 'flip'] = (modes[c.mode || 'flip'] || 0) + 1; });
        var mode = Object.keys(modes).sort(function(a, b){ return modes[b] - modes[a]; })[0];
        var eq = cs.filter(function(c){ return /^\s*\d+\s*\+\s*(\d+|_+)\s*$/.test(plain(c.front)); }).length > cs.length / 2;
        var choices = cs.some(function(c){ return c.choices && c.choices.length; });
        var stage = mode === 'blend' ? 'script' : mode === 'listen' && choices ? 'script' : mode === 'listen' ? 'listening' : mode === 'echo' ? 'speaking'
          : mode === 'numsys' || eq ? 'numbers' : mode === 'build' ? 'sentences' : mode === 'hanja' ? 'roots'
          : /mini story|story/i.test(d.name) || (cs.length <= 12 && cs.filter(function(c){ return /\s/.test(plain(c.front).trim()); }).length > cs.length / 2) ? 'stories' : 'words';
        var pairs = {}; cs.forEach(function(c){ var a = plain(c.front).toLowerCase(), b = plain(c.back).toLowerCase(); pairs[a < b ? a + '|' + b : b + '|' + a] = 1; });
        var dupOf = null;
        out.forEach(function(o){ if(dupOf || o.stage !== 'words' || stage !== 'words') return; var hit = 0, n = 0; for(var k in pairs){ n++; if(o.pairs[k]) hit++; } if(n && hit / n > .7) dupOf = o; });
        var item = { d: d, cards: cs, n: cs.length, mode: mode, stage: stage, pairs: pairs, dupOf: dupOf ? dupOf.d.id : null };
        if(dupOf && mode === 'timedchoice') dupOf.fluency = d.id;   // the same words against the clock: fluency practice
        if(dupOf && mode !== 'timedchoice'){ item.dupOf = null; if(dupOf.mode === 'timedchoice'){ dupOf.dupOf = d.id; item.fluency = dupOf.d.id; } }
        out.push(item);
      });
      return out;
    });
  }

  // Tools from the Library each unit can use, by skill
  var TOOL = {
    handwriting: { name: 'Hangul handwriting', ic: 'edit', skill: 'write', view: 'wsMake', arg: JSON.stringify({ src: 'trace', script: 'hangul' }) },
    ask: { name: 'Ask about a word', ic: 'ask', skill: 'read', view: 'chat', arg: 'ask' },
    cloze: function(id){ return { name: 'Fill the gaps', ic: 'puzzle', skill: 'read', view: 'wsMake', arg: JSON.stringify({ src: 'cloze', deck: id }) }; },
    worksheet: function(id){ return { name: 'Worksheet', ic: 'worksheet', skill: 'write', view: 'wsMake', arg: JSON.stringify({ src: 'deck', deck: id }) }; },
    play: function(id, name){ return { name: 'Role-play: ' + name, ic: PLAY_ICON[id] || 'talk', skill: 'speak', view: 'play', arg: id }; },
    writing: { name: 'My writing', ic: 'edit', skill: 'write', view: 'writing' },
    teach: { name: 'Teach Shelly', ic: 'tutor', skill: 'speak', view: 'teachback' },
    tricky: { name: 'Tricky spots', ic: 'search', skill: 'read', view: 'misconceptions' },
    mastery: { name: 'Mastery', ic: 'trophy', skill: 'read', view: 'mastery' },
    game: function(name){ return { name: 'Minigame on the board: ' + name, ic: 'games', skill: 'listen', game: true }; }
  };

  // The course plan itself
  function courseDesign(ans, info){
    var korean = (ans.subjects || []).indexOf('korean') >= 0 || /korea/i.test(ans.goal || '');
    var talk = /conversation|talk|speak|chat|travel|trip|visit/i.test(ans.goal || '') || korean;
    var by = function(st){ return info.filter(function(x){ return x.stage === st && !x.dupOf; }); };
    var words = by('words').sort(function(a, b){ return b.n - a.n; }), main = words[0], extraWords = words.slice(1);
    var level = ans.level === 'comfortable' ? 1.5 : ans.level === 'some' ? 1.2 : 1;
    var perDay = Math.max(4, Math.min(22, Math.round((+ans.minutes || 20) * .45 * level)));
    var units = [];
    function U(o){ o.decks = (o.decks || []).filter(Boolean); o.tools = (o.tools || []).filter(Boolean); units.push(o); return o; }
    function deckRef(x, role, from, to){ if(!x) return null; from = from || 0; to = Math.min(x.n, to == null ? x.n : to); if(to <= from) return null; return { id: x.d.id, name: x.d.name, role: role || 'learn', from: from, to: to, n: to - from, part: from > 0 || to < x.n, fluency: x.fluency || null }; }
    // the main word deck is shared out over the units that need words, in its own order
    var chunkAt = 0, wordUnits = korean ? 5 : 3;
    var chunk = main ? Math.ceil(main.n / wordUnits) : 0;
    function nextWords(){ if(!main || chunkAt >= main.n) return null; var r = deckRef(main, 'learn', chunkAt, chunkAt + chunk); if(r) chunkAt = r.to; return r; }
    if(korean && talk){
      var script = by('script'), listen = by('listening')[0], speak = by('speaking')[0], nums = by('numbers'), sent = by('sentences')[0], stories = by('stories'), roots = by('roots')[0];
      var story = function(re){ return stories.find(function(s){ return re.test(s.d.name); }) || null; };
      U({ key: 'hangul', title: 'Hangul: reading the signs', focus: 'Signs, menus and names', why: 'Every conversation starts with hearing and reading the sounds right. Hangul is a logical alphabet: about a week of steady practice and you can sound out any word you see.',
        cando: ['I can read any Hangul syllable block aloud, slowly', 'I can hear the difference between 달, 탈 and 딸', 'I can write my name in Hangul'],
        decks: script.map(function(x){ return deckRef(x, 'learn'); }).concat([deckRef(listen, 'practice', 0, Math.min(listen ? listen.n : 0, 10))]),
        tools: [TOOL.handwriting, TOOL.game('Hangul Blocks'), TOOL.game('Echo Shell'), TOOL.ask],
        check: 'Read 10 new syllables and pick words you hear' });
      U({ key: 'hello', title: 'Hello, thank you, sorry', focus: 'Meeting people', why: 'The first minute of any conversation is the same few phrases. Knowing them cold makes every later one easier.',
        cando: ['I can greet people politely and say goodbye the right way (안녕히 가세요 / 계세요)', 'I can say thank you, sorry and excuse me', 'I can introduce myself: my name and where I am from'],
        decks: [deckRef(speak, 'learn'), nextWords(), deckRef(listen, 'practice')],
        tools: [TOOL.play('intro', 'Introduce yourself'), TOOL.teach, TOOL.game('Tide Pairs')],
        check: 'Phrases from listening, and replying in the right way' });
      U({ key: 'food', title: 'At the café and restaurant', focus: 'Ordering food and drinks', why: 'Food is where you will talk most on a trip. One pattern, 주세요 ("please give me"), does most of the work.',
        cando: ['I can order food and drinks with 주세요', 'I can ask for water, the menu or the bill', 'I can answer "hot or cold?" and "for here or to go?"'],
        decks: [deckRef(story(/커피|coffee|café/i), 'learn'), nextWords()],
        tools: [TOOL.play('cafe', 'Order at a café'), TOOL.play('restaurant', 'At a restaurant'), TOOL.cloze(main && main.d.id), TOOL.game('Bubble Catch')],
        check: 'Ordering phrases and food words' });
      U({ key: 'numbers', title: 'Numbers, prices and time', focus: 'Shopping and paying', why: 'Korean has two number systems; prices use one and counting things the other. Learning when to use each turns prices and times from a puzzle into a habit.',
        cando: ['I can understand prices said aloud and ask 얼마예요?', 'I can count things with native numbers and the right counter (두 개, 세 명)', 'I can pay by card or cash'],
        decks: nums.map(function(x){ return deckRef(x, 'learn'); }),
        tools: [TOOL.game('Counting Cove'), TOOL.play('shop', 'Buy something at a shop'), TOOL.worksheet(nums[0] && nums[0].d.id)],
        check: 'Native or Sino numbers, prices and counters' });
      U({ key: 'review1', review: true, title: 'Review week: a day out', focus: 'Putting it together', why: 'Mixing everything from the first units, and using it in a role-play without hints, is what moves words from "I know it" to "I can say it".',
        cando: ['I can get through a café order and a shop purchase without hints', 'I can still read and say the words from earlier units'],
        decks: [], tools: [TOOL.play('cafe', 'Café, no hints'), TOOL.play('shop', 'Shop, no hints'), TOOL.tricky, TOOL.mastery], check: 'Mixed check on units 1–4' });
      U({ key: 'around', title: 'Getting around', focus: 'Directions, subway and taxis', why: 'Asking the way and telling a driver where to go uses the 가요 / 가 주세요 patterns and a few direction words.',
        cando: ['I can ask where a place is (…어디예요?)', 'I can understand left, right and straight on', 'I can tell a taxi where to go'],
        decks: [deckRef(sent, 'learn'), nextWords()],
        tools: [TOOL.play('subway', 'Ask the way'), TOOL.play('taxi', 'Take a taxi'), TOOL.game('Sentence Current')],
        check: 'Direction phrases and building sentences' });
      U({ key: 'you', title: 'Talking about you', focus: 'Small talk', why: 'Conversation means questions coming back at you. This unit is about answering about family, weather and what she likes, then asking back.',
        cando: ['I can talk about my family and what I like', 'I can say what the weather is like', 'I can ask someone a simple question back'],
        decks: [deckRef(story(/가족|family/i), 'learn'), deckRef(story(/비|rain/i), 'learn'), nextWords()],
        tools: [TOOL.play('intro', 'Small talk'), TOOL.writing, TOOL.teach],
        check: 'Small-talk questions and answers' });
      U({ key: 'stay', title: 'Hotels and helping hands', focus: 'Staying and solving problems', why: 'The phrases that matter most when something goes wrong: checking in, finding the restroom, asking for help.',
        cando: ['I can check in at a hotel with my name and reservation', 'I can ask where the restroom is', 'I can ask for help and say what is wrong'],
        decks: [nextWords(), deckRef(roots, 'practice', 0, roots ? Math.min(roots.n, 30) : 0)].concat(extraWords.map(function(x){ return deckRef(x, 'practice'); })),
        tools: [TOOL.play('hotel', 'Check in at a hotel'), TOOL.play('help', 'Ask for help'), TOOL.ask],
        check: 'Hotel and help phrases' });
      U({ key: 'final', review: true, title: 'Conversation week: a day in Seoul', focus: 'Showing what you can do', why: 'The final week strings every situation into one "day in Seoul": no new material, all speaking and listening, then a final check.',
        cando: ['I can get through a whole day of travel situations in Korean', 'I can introduce myself in five sentences, out loud and in writing'],
        decks: [], tools: [TOOL.play('intro', 'Meet someone'), TOOL.play('subway', 'Find the station'), TOOL.play('restaurant', 'Lunch'), TOOL.play('shop', 'Shopping'), TOOL.play('hotel', 'Back at the hotel'), TOOL.writing],
        check: 'Final mixed check on the whole course' });
      if(main && chunkAt < main.n){ var tail = units.find(function(u){ return u.key === 'stay'; }); tail.decks.unshift(deckRef(main, 'learn', chunkAt, main.n)); chunkAt = main.n; }
    } else {
      // Any other subject: the same shape, from whatever decks she has, in a sensible order
      var order = ['script', 'listening', 'speaking', 'words', 'numbers', 'sentences', 'stories', 'roots'], made = 0;
      order.forEach(function(st){
        var xs = by(st); if(!xs.length) return;
        if(st === 'words'){
          for(var k = 0; k < wordUnits && main && chunkAt < main.n; k++){ var w = nextWords(); U({ key: 'words' + k, title: (main.d.name) + ', part ' + (k + 1), focus: 'New words', why: 'A steady handful of new words a day, mixed with the ones before, is how vocabulary sticks.',
            cando: ['I can remember the meanings of words ' + (w.from + 1) + '–' + w.to + ' of ' + main.d.name, 'I can use them in a sentence'], decks: [w], tools: [TOOL.cloze(main.d.id), TOOL.worksheet(main.d.id), TOOL.teach], check: 'Words from this part' }); made++; }
          extraWords.forEach(function(x){ U({ key: 'w-' + x.d.id, title: x.d.name, focus: 'New words', why: 'More words, linked to the ones she knows.', cando: ['I can remember the words in ' + x.d.name], decks: [deckRef(x, 'learn')], tools: [TOOL.worksheet(x.d.id)], check: 'Words from ' + x.d.name }); made++; });
        } else {
          var label = { script: 'Sounds and letters', listening: 'Listening', speaking: 'Saying it out loud', numbers: 'Numbers', sentences: 'Building sentences', stories: 'Little stories', roots: 'Word families' }[st];
          U({ key: st, title: label, focus: label, why: 'Each skill gets its own focused time before it is mixed with the rest.', cando: xs.map(function(x){ return 'I can do ' + x.d.name + ' with 8 out of 10 right'; }).slice(0, 3),
            decks: xs.map(function(x){ return deckRef(x, 'learn'); }), tools: [TOOL.mastery], check: label + ' check' }); made++;
        }
        if(made && made % 3 === 0) U({ key: 'review' + made, review: true, title: 'Review week', focus: 'Putting it together', why: 'Mixed review of the last few units, so nothing fades.', cando: ['I can still do everything from the last units'], decks: [], tools: [TOOL.tricky, TOOL.mastery], check: 'Mixed check' });
      });
      U({ key: 'final', review: true, title: 'Final review', focus: 'Showing what you can do', why: 'No new material: everything mixed, then a final check.', cando: ['I can do everything from this course'], decks: [], tools: [TOOL.mastery, TOOL.tricky], check: 'Final mixed check' });
    }
    // how long each unit takes: new cards at her pace, plus time to use them and review
    units.forEach(function(u, i){
      var newN = u.decks.filter(function(dk){ return dk.role === 'learn'; }).reduce(function(s, dk){ return s + dk.n; }, 0);
      u.newN = newN; u.i = i; u.id = 'u' + i;
      u.review = !!u.review;
      u.reviewOf = units.slice(Math.max(0, i - 2), i).map(function(p){ return p.id; });   // spaced review: the two units before come back
    });
    return { units: units, perDay: perDay };
  }
  // Dates for every unit, from the start date, her days a week and the pace, fitted to a target date if there is one
  function courseSchedule(co){
    var days = Math.max(2, Math.min(7, +co.days || 5));
    function weeksFor(u){ if(u.testedOut) return 1; if(u.review) return 1; var studyDays = Math.ceil((u.newN || 0) / co.perDay) + 2; return Math.max(1, Math.min(4, Math.ceil(studyDays / days))) + (u.extraWeeks || 0) - (u.lessWeeks || 0); }
    if(co.target && !co.fitted){
      var avail = Math.floor((dateOf(co.target) - dateOf(co.start)) / (7 * 864e5));
      for(var tries = 0; tries < 12; tries++){
        var tot = co.units.reduce(function(s, u){ return s + Math.max(1, weeksFor(u)); }, 0);
        if(tot <= avail || co.perDay >= 25) break;
        co.perDay = Math.min(25, Math.round(co.perDay * 1.15) + 1);
      }
      co.fitNote = (function(){ var tot = co.units.reduce(function(s, u){ return s + Math.max(1, weeksFor(u)); }, 0);
        return tot <= avail ? 'Fits before ' + niceDate(co.target) + ' at about ' + co.perDay + ' new words a study day.' : 'The full course needs ' + tot + ' weeks; your date is ' + avail + ' weeks away. More minutes a day, or the review weeks done faster, will close the gap.'; })();
    }
    var at = co.start;
    co.units.forEach(function(u){ u.weeks = Math.max(1, weeksFor(u)); u.start = at; u.end = addDays(at, u.weeks * 7 - 3); at = addDays(at, u.weeks * 7); });
    co.end = co.units.length ? co.units[co.units.length - 1].end : co.start;
    return co;
  }
  function courseBuild(ans){
    return courseDecks().then(function(info){
      var plan = courseDesign(ans, info);
      var co = { v: 1, goal: ans.goal, subjects: ans.subjects, level: ans.level, minutes: +ans.minutes, days: +ans.days, start: ans.start, target: ans.target || '',
        perDay: plan.perDay, units: plan.units, evals: [], log: [{ date: today(), text: 'Course planned: ' + plan.units.length + ' units, about ' + plan.perDay + ' new words a study day.' }], built: Date.now() };
      return courseSchedule(co);
    });
  }
  // Which unit is "now"
  function courseNow(co){
    return co.units.filter(function(u){ return !u.done; })[0] || null;   // like a class, the earliest unit not yet finished
  }
  // How far along a unit is: the share of its new cards she knows now
  function unitProgress(u){
    var learn = u.decks.filter(function(dk){ return dk.role === 'learn'; });
    if(!learn.length) return Promise.resolve(u.done ? 1 : null);
    return Promise.all(learn.map(function(dk){ return cards(dk.id).then(function(cs){ cs = sortedCards(cs).slice(dk.from, dk.to); return [cs.filter(knownCard).length, cs.length]; }); }))
      .then(function(rs){ var k = 0, n = 0; rs.forEach(function(r){ k += r[0]; n += r[1]; }); return n ? k / n : null; });
  }

  /* ---- Checks (all optional). A unit check is 10 quick questions from that unit's cards (about a third from the
     two units before it). Placement samples every unit. The result changes the course, and the change is logged. ---- */
  function checkItems(co, kind, idx){
    var units = kind === 'placement' ? co.units.filter(function(u){ return !u.review; }) : kind === 'unit' ? [co.units[idx]] : co.units.slice(0, idx + 1);
    var spaced = kind === 'unit' ? co.units.slice(Math.max(0, idx - 2), idx).filter(function(u){ return !u.review; }) : [];
    function from(us, n){
      var refs = []; us.forEach(function(u){ u.decks.forEach(function(dk){ refs.push({ dk: dk, unit: u.id }); }); });
      if(!refs.length) return Promise.resolve([]);
      return Promise.all(refs.map(function(r){ return cards(r.dk.id).then(function(cs){ return sortedCards(cs).slice(r.dk.from, r.dk.to).map(function(c){ return { c: c, unit: r.unit, deck: r.dk.id }; }); }); }))
        .then(function(ls){ var all = [].concat.apply([], ls).filter(function(x){ return plain(x.c.front) && plain(x.c.back) && plain(x.c.front) !== plain(x.c.back); }); return shuffle(all).slice(0, n); });
    }
    var n = kind === 'placement' ? 3 * units.length : 10;
    var mainP = kind === 'placement' ? Promise.all(units.map(function(u){ return from([u], 3); })).then(function(ls){ return [].concat.apply([], ls); }) : from(units, spaced.length ? 7 : n);
    return Promise.all([mainP, from(spaced, 3)]).then(function(r){ var items = r[0].concat(r[1]);
      // wrong answers come from the same decks
      return Promise.all(items.map(function(x){ return cards(x.deck); })).then(function(pools){
        return items.map(function(x, i){
          var c = x.c, f = plain(c.front), b = plain(c.back), ko = hasHangul(f) ? f : hasHangul(b) ? b : null, en = ko === f ? b : f;
          if(c.choices && c.choices.length) return { unit: x.unit, card: c.id, deck: x.deck, q: b, opts: shuffle([f].concat(c.choices.map(plain)).slice(0, 4)), ok: f, say: null };
          var type = ko ? ['read', 'recall', 'listen'][i % 3] : 'read';
          var others = shuffle(pools[i].filter(function(o){ return o.id !== c.id; })).map(function(o){ var of = plain(o.front), ob = plain(o.back), oko = hasHangul(of) ? of : ob, oen = oko === of ? ob : of;
            return !ko ? ob : type === 'recall' ? oko : oen; }).filter(function(v, k, a){ return v && a.indexOf(v) === k; });
          var right = type === 'recall' ? ko : (ko ? en : b), q = type === 'recall' ? en : type === 'listen' ? '🔊' : (ko || f);
          return { unit: x.unit, card: c.id, deck: x.deck, type: type, q: q, say: type === 'listen' ? ko : null, ok: right, opts: shuffle([right].concat(others.filter(function(o){ return o !== right; }).slice(0, 3))) };
        });
      });
    });
  }
  // What a result does to the course
  function courseAdjust(co, kind, idx, score, missed, byUnit){
    var u = co.units[idx], next = co.units[idx + 1], pct = Math.round(score * 100), msg;
    if(kind === 'placement'){
      var skipped = [];
      co.units.forEach(function(x){ var r = byUnit[x.id]; if(!x.review && r && r[1] && r[0] / r[1] >= .85){ x.testedOut = true; skipped.push(x.title); } });
      msg = skipped.length ? 'Placement check: ' + pct + '%. Already strong in ' + skipped.join(', ') + ', so those become one-week quick reviews.' : 'Placement check: ' + pct + '%. Starting from the beginning at the planned pace.';
    } else if(score >= .9){
      u.done = true; u.doneOn = today();
      if(next && !next.review && next.weeks > 1) next.lessWeeks = (next.lessWeeks || 0) + 1;
      co.perDay = Math.min(25, Math.round(co.perDay * 1.15));
      msg = u.title + ' check: ' + pct + '%. Excellent: the next unit is a week shorter and new words come a little faster (' + co.perDay + ' a day).';
    } else if(score >= .75){
      u.done = true; u.doneOn = today();
      co.fixups = (co.fixups || []).concat(missed).slice(-40);
      msg = u.title + ' check: ' + pct + '%. Unit done. The ' + missed.length + ' item' + (missed.length === 1 ? '' : 's') + ' missed come back as fix-up practice in the next unit.';
    } else if(score >= .55){
      u.extraWeeks = (u.extraWeeks || 0) + 1; co.perDay = Math.max(4, Math.round(co.perDay * .9));
      co.fixups = (co.fixups || []).concat(missed).slice(-40);
      msg = u.title + ' check: ' + pct + '%. One more week on this unit, with the missed items as fix-ups and a gentler pace (' + co.perDay + ' new words a day). Try the check again at the end of the week.';
    } else {
      u.extraWeeks = (u.extraWeeks || 0) + 1; co.perDay = Math.max(4, Math.round(co.perDay * .8));
      co.fixups = (co.fixups || []).concat(missed).slice(-40);
      if(next && !next.review) co.units.splice(idx + 1, 0, { id: 'r' + Date.now(), key: 'catchup', review: true, title: 'Catch-up week: ' + u.title, focus: 'Going over it again', why: 'Added after the check: the same material again, more slowly, mixed with what came before.', cando: u.cando, decks: [], tools: [TOOL.tricky, TOOL.mastery], check: 'The ' + u.title + ' check again', reviewOf: [u.id], newN: 0 });
      msg = u.title + ' check: ' + pct + '%. That was hard, which is useful to know. An extra week on this unit and a catch-up week after it, at a gentler pace (' + co.perDay + ' new words a day).';
    }
    if(kind === 'review' && score < .7) msg = u.title + ': ' + pct + '%. Some earlier units have faded, so their words are mixed into the coming weeks as extra review.';
    co.evals.push({ date: today(), kind: kind, unit: u ? u.id : null, score: score });
    co.log.push({ date: today(), text: msg });
    co.fitted = true;   // a target date's pace isn't recalculated over the check's adjustment
    courseSchedule(co);   // the dates follow the change
    return msg;
  }

  // Wendy's (and any profile's) answers: the questionnaire
  function defaultAnswers(){
    var p = CC() && CC().profile(), co = course();
    if(co) return { goal: co.goal, subjects: co.subjects, level: co.level, minutes: co.minutes, days: co.days, start: co.start, target: co.target };
    var g = myGoals().filter(function(x){ return x !== 'explore'; });
    return { goal: (p && p.learnGoal) || (g.indexOf('korean') >= 0 ? 'Be conversational when I visit Korea' : ''), subjects: g, level: 'new', minutes: 20, days: 5, start: nextMonday(), target: '' };
  }
  LIB.views.courseSetup = { title: 'Coral Classroom', render: function(el){
    var a = defaultAnswers(), p = CC() && CC().profile();
    var opt = function(v, cur, l){ return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + l + '</option>'; };
    el.innerHTML = '<section class="clib-card"><h2>' + icon('school', '🏫') + ' What do you want to learn?</h2><p>A few questions, and Coral Classroom plans a course for ' + esc(p ? p.name : 'you') + ': units with clear goals, dates, and checks that adjust it as you go. You can change any answer later.</p>' +
      '<label class="clib-label" for="coGoal">Your goal, in your own words</label><textarea id="coGoal" class="clib-input co-goal" placeholder="For example: be conversational when I visit Korea">' + esc(a.goal || '') + '</textarea>' +
      '<label class="clib-label">Subjects</label><div class="clib-row" role="group" aria-label="Subjects">' + goalChoices().map(function(g){ return '<button type="button" class="clib-btn" data-cosub="' + esc(g.id) + '" aria-pressed="' + ((a.subjects || []).indexOf(g.id) >= 0) + '">' + g.icon + ' ' + esc(g.label) + '</button>'; }).join('') + '</div>' +
      '<label class="clib-label" for="coLevel">Where are you starting?</label><select id="coLevel" class="clib-input">' + opt('new', a.level, 'Brand new') + opt('some', a.level, 'I know a little') + opt('comfortable', a.level, 'I know quite a lot') + '</select>' +
      '<div class="co-two"><div><label class="clib-label" for="coMin">Minutes a day</label><select id="coMin" class="clib-input">' + [10, 15, 20, 30, 45, 60].map(function(m){ return opt(m, a.minutes, m + ' minutes'); }).join('') + '</select></div>' +
      '<div><label class="clib-label" for="coDays">Days a week</label><select id="coDays" class="clib-input">' + [3, 4, 5, 6, 7].map(function(d){ return opt(d, a.days, d + ' days'); }).join('') + '</select></div></div>' +
      '<div class="co-two"><div><label class="clib-label" for="coStart">Start on</label><input id="coStart" type="date" class="clib-input" value="' + esc(a.start) + '"></div>' +
      '<div><label class="clib-label" for="coTarget">Trip or target date (optional)</label><input id="coTarget" type="date" class="clib-input" value="' + esc(a.target || '') + '"></div></div>' +
      '<label class="co-check"><input type="checkbox" id="coPlace"> Start with a short placement check, to skip what I already know</label>' +
      '<div class="clib-row"><button type="button" class="clib-btn main" data-co-make>' + (course() ? 'Re-plan my course' : 'Plan my course') + '</button></div><p class="clib-msg" aria-live="polite"></p></section>';
    $$('[data-cosub]', el).forEach(function(b){ b.addEventListener('click', function(){ b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); }); });
    $('[data-co-make]', el).addEventListener('click', function(){
      var ans = { goal: $('#coGoal', el).value.trim(), subjects: $$('[data-cosub][aria-pressed="true"]', el).map(function(b){ return b.dataset.cosub; }), level: $('#coLevel', el).value,
        minutes: +$('#coMin', el).value, days: +$('#coDays', el).value, start: $('#coStart', el).value || nextMonday(), target: $('#coTarget', el).value || '' };
      var msg = $('.clib-msg', el);
      if(!ans.goal){ msg.textContent = 'Write your goal first: it shapes the whole course.'; return; }
      msg.textContent = 'Planning…';
      var old = course();
      courseBuild(ans).then(function(co){
        if(old){ co.evals = old.evals || []; co.log = (old.log || []).concat([{ date: today(), text: 'Re-planned from new answers.' }]); }
        return saveCourse(co).then(function(){ sound('correct'); if($('#coPlace', el).checked) go('courseCheck', 'placement', true); else go('classroom', null, true); });
      }, function(){ msg.textContent = 'Couldn\'t plan the course. Try again.'; });
    });
  } };

  LIB.views.classroom = { title: 'Coral Classroom', render: function(el){
    var co = course();
    if(!co){
      var a = defaultAnswers();   // first visit: plan straight away from what we know, then she can adjust the answers
      el.innerHTML = '<section class="clib-card"><p>Planning your course…</p></section>';
      courseBuild(a).then(function(c){ return saveCourse(c); }).then(function(){ go('classroom', null, true); });
      return;
    }
    var now = courseNow(co), ni = now ? co.units.indexOf(now) : -1, t = today();
    var weekOf = now ? Math.min(now.weeks, Math.max(1, Math.floor((dateOf(t) - dateOf(now.start)) / (7 * 864e5)) + 1)) : 0;
    var late = now && now.end < t ? Math.round((dateOf(t) - dateOf(now.end)) / 864e5) : 0;
    var html = '';
    if(now){
      html += '<section class="clib-card co-now"><span class="co-tag">Now · Unit ' + (ni + 1) + ' of ' + co.units.length + (now.start <= t ? ' · week ' + weekOf + ' of ' + now.weeks : ' · starts ' + niceDate(now.start)) + '</span>' +
        '<h2>' + esc(now.title) + '</h2><p class="co-focus">' + esc(now.focus) + ' · ' + niceDate(now.start) + ' – ' + niceDate(now.end) + '</p>' +
        (late ? '<p class="co-late">' + late + ' day' + (late === 1 ? '' : 's') + ' past this unit\'s end date. No problem: take the check when you\'re ready, and the dates after it will move.</p>' : '') +
        '<p>' + esc(now.why) + '</p><h3>By the end I can…</h3><ul class="co-cando">' + now.cando.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
        '<div class="co-bar" aria-hidden="true"><i data-co-prog style="width:0"></i></div><p class="co-meta" data-co-progt></p>' +
        '<h3>This week</h3><ol class="co-week">' + rhythm(co, now).map(function(r, k){ return '<li><b>' + esc(r[0]) + '</b> ' + r[1].map(function(x, j){ return '<button type="button" class="clib-btn co-go" data-co-go="' + k + ':' + j + '">' + icon(x.ic, '') + ' ' + esc(x.name) + '</button>'; }).join(' ') + '</li>'; }).join('') + '</ol>' +
        ((co.fixups || []).length ? '<p class="co-meta">' + icon('check', '') + ' ' + co.fixups.length + ' fix-up item' + (co.fixups.length === 1 ? '' : 's') + ' from earlier checks are mixed into your practice.</p>' : '') +
        '<div class="clib-row"><button type="button" class="clib-btn main" data-co-check="' + (now.review ? 'review' : 'unit') + ':' + ni + '">Take the ' + (now.review ? 'review' : 'unit') + ' check (optional)</button><button type="button" class="clib-btn" data-co-skip="' + ni + '">Mark this unit done</button></div></section>';
    } else html += '<section class="clib-card co-now"><h2>🎉 Course complete!</h2><p>Every unit is done. Change your answers to plan the next course.</p></section>';
    var headHtml = '<section class="clib-card co-head"><h2>' + icon('school', '🏫') + ' Coral Classroom</h2>' +
      '<label class="clib-label" for="coGoalEdit">My goal</label><div class="co-goalrow"><textarea id="coGoalEdit" class="clib-input co-goal" rows="2">' + esc(co.goal) + '</textarea></div>' +
      '<div class="clib-row"><button type="button" class="clib-btn" data-co-goalsave>Save goal</button><button type="button" class="clib-btn" data-view="courseSetup">Change my answers</button>' +
      (!co.evals.length ? '<button type="button" class="clib-btn" data-co-check="placement">Placement check (optional)</button>' : '') + '</div><p class="clib-msg" data-co-goalmsg aria-live="polite"></p>' +
      '<p class="co-meta">' + co.minutes + ' minutes a day, ' + co.days + ' days a week · about ' + co.perDay + ' new words a study day · ' + niceDate(co.start) + ' to ' + niceDate(co.end) + (co.target ? ' · trip ' + niceDate(co.target) : '') + '</p>' +
      (co.fitNote ? '<p class="co-meta">' + esc(co.fitNote) + '</p>' : '') + '</section>';
    html += headHtml;
    html += '<h3 class="clib-more-h">The course</h3><ol class="co-line">' + co.units.map(function(u, i){
      var st = u.done ? 'done' : u === now ? 'now' : u.start > t ? 'later' : 'open';
      return '<li class="co-u ' + st + (u.review ? ' review' : '') + '"><details' + (u === now ? ' open' : '') + '><summary><span class="co-dot" aria-hidden="true">' + (u.done ? '✓' : i + 1) + '</span><span class="co-ut"><b>' + esc(u.title) + '</b><small>' + niceDate(u.start) + ' – ' + niceDate(u.end) + ' · ' + u.weeks + ' week' + (u.weeks === 1 ? '' : 's') + (u.testedOut ? ' · quick review' : '') + (u.done ? ' · done' : '') + '</small></span></summary>' +
        '<div class="co-ud"><p>' + esc(u.why) + '</p><ul class="co-cando">' + u.cando.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
        (u.decks.length ? '<p class="co-meta"><b>Decks:</b> ' + u.decks.map(function(dk){ return esc(dk.name) + (dk.part ? ' (cards ' + (dk.from + 1) + '–' + dk.to + ')' : '') + (dk.role !== 'learn' ? ' (practice)' : ''); }).join(', ') + '</p>' : '') +
        '<p class="co-meta"><b>Also:</b> ' + u.tools.map(function(x){ return esc(x.name); }).join(', ') + '</p><p class="co-meta"><b>Check:</b> ' + esc(u.check) + '</p></div></details></li>'; }).join('') + '</ol>';
    html += '<h3 class="clib-more-h">What changed and why</h3><ul class="co-log">' + co.log.slice().reverse().map(function(l){ return '<li><small>' + niceDate(l.date) + '</small> ' + esc(l.text) + '</li>'; }).join('') + '</ul>';
    html += '<div class="clib-row"><button type="button" class="clib-btn" data-co-off>Turn Coral Classroom off</button></div>';
    el.innerHTML = html;
    wireTiles(el);
    if(now) unitProgress(now).then(function(p){ var b = $('[data-co-prog]', el), tx = $('[data-co-progt]', el); if(p == null || !b) return; b.style.width = Math.round(p * 100) + '%';
      var exp = now.start > t ? 0 : Math.min(1, (dateOf(t) - dateOf(now.start)) / Math.max(1, dateOf(now.end) - dateOf(now.start)));
      tx.textContent = Math.round(p * 100) + '% of this unit\'s new cards known' + (now.start <= t ? (p + .15 >= exp ? ' · on track' : ' · a little behind: the Daily Plan will lean on this unit') : ''); });
    var wk = now ? rhythm(co, now) : [];
    $$('[data-co-go]', el).forEach(function(b){ b.addEventListener('click', function(){ var p = b.dataset.coGo.split(':'), x = wk[+p[0]][1][+p[1]]; courseStart(x); }); });
    $('[data-co-goalsave]', el).addEventListener('click', function(){ co.goal = $('#coGoalEdit', el).value.trim() || co.goal; co.log.push({ date: today(), text: 'Goal changed to "' + co.goal + '".' }); saveCourse(co).then(function(){ $('[data-co-goalmsg]', el).textContent = 'Saved. To re-plan around the new goal, use Change my answers.'; }); });
    $$('[data-co-check]', el).forEach(function(b){ b.addEventListener('click', function(){ go('courseCheck', b.dataset.coCheck); }); });
    $$('[data-co-skip]', el).forEach(function(b){ b.addEventListener('click', function(){ var u = co.units[+b.dataset.coSkip]; u.done = true; u.doneOn = today(); co.log.push({ date: today(), text: u.title + ' marked done without a check.' }); courseSchedule(co); saveCourse(co).then(function(){ go('classroom', null, true); }); }); });
    $('[data-co-off]', el).addEventListener('click', function(){ var c = CC(); if(c && c.setCourseOn) Promise.resolve(c.setCourseOn(false)).then(function(){ go('home', null, true); }); });
  } };
  // The week's rhythm for a unit, as days with activities
  function rhythm(co, u){
    var learn = u.decks.filter(function(d){ return d.role === 'learn'; }), prac = u.decks.filter(function(d){ return d.role !== 'learn'; });
    var deckAct = function(dk, tag){ return { name: (tag || '') + dk.name, ic: 'cards', deck: dk.id }; };
    var speakT = u.tools.filter(function(x){ return x.skill === 'speak'; }), otherT = u.tools.filter(function(x){ return x.skill !== 'speak'; });
    var earlier = co.units.filter(function(p){ return (u.reviewOf || []).indexOf(p.id) >= 0; }).map(function(p){ return p.decks.filter(function(d){ return d.role === 'learn'; })[0]; }).filter(Boolean);
    var rows = [
      ['Learn', learn.slice(0, 2).map(function(d){ return deckAct(d); }).concat(u.review ? [TOOL.mastery] : [])],
      ['Listen and repeat', prac.map(function(d){ return deckAct(d); }).concat(otherT.filter(function(x){ return x.skill === 'listen'; })).slice(0, 2)],
      ['Use it', speakT.slice(0, 2).concat(otherT.filter(function(x){ return x.skill === 'write'; }).slice(0, 1))],
      ['Mix old and new', earlier.map(function(d){ return deckAct(d, 'Review: '); }).concat(learn.filter(function(d){ return d.fluency; }).map(function(d){ return { name: 'Against the clock', ic: 'clock', deck: d.fluency }; })).slice(0, 2)],
      ['Check in', [TOOL.tricky].concat(otherT.filter(function(x){ return x.skill === 'read'; }).slice(0, 1))]
    ].filter(function(r){ return r[1].length; });
    if((+co.days || 5) <= 3) rows = [rows[0], rows[2] || rows[1], rows[rows.length - 1]].filter(Boolean);
    return rows;
  }
  function courseStart(x){
    sound('tap');
    if(x.deck){ close(); CC().startDeck(x.deck); return; }
    if(x.game){ close(); return; }   // minigames live on the board: closing the Library goes back to it
    go(x.view, x.arg);
  }

  // A check: quick questions; the result adjusts the course
  LIB.views.courseCheck = { title: 'Check', render: function(el, arg){
    var co = course(); if(!co){ go('classroom', null, true); return; }
    var parts = String(arg || 'placement').split(':'), kind = parts[0], idx = +parts[1] || 0, u = co.units[idx];
    el.innerHTML = '<section class="clib-card"><p>Getting the questions ready…</p></section>';
    checkItems(co, kind, idx).then(function(items){
      if(!items.length){ el.innerHTML = '<section class="clib-card"><p>There\'s nothing to check here yet.</p><div class="clib-row"><button type="button" class="clib-btn" data-view="classroom">Back</button></div></section>'; wireTiles(el); return; }
      var qi = 0, right = 0, missed = [], byUnit = {};
      function show(){
        if(qi === items.length) return finish();
        var it = items[qi];
        el.innerHTML = '<section class="clib-card co-q"><span class="co-tag">' + (kind === 'placement' ? 'Placement check' : kind === 'review' ? 'Review check' : 'Unit check: ' + esc(u.title)) + ' · ' + (qi + 1) + ' of ' + items.length + '</span>' +
          (it.say ? '<button type="button" class="clib-btn co-hear" data-co-hear>' + icon('sound', '🔊') + ' Hear it again</button><p class="co-meta">What does it mean?</p>' : '<p class="clib-big co-qt">' + esc(it.q) + '</p><p class="co-meta">' + (it.type === 'recall' ? 'How do you say this in Korean?' : 'Pick the right one.') + '</p>') +
          '<div class="co-opts">' + it.opts.map(function(o){ return '<button type="button" class="clib-btn co-opt" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
          '<div class="clib-row"><button type="button" class="clib-btn" data-co-dunno>I don\'t know yet</button><button type="button" class="clib-btn" data-co-quit>Stop the check</button></div></section>';
        if(it.say) setTimeout(function(){ speak(it.say); }, 200);
        var h = $('[data-co-hear]', el); if(h) h.addEventListener('click', function(){ speak(it.say); });
        function answer(ok, b){
          byUnit[it.unit] = byUnit[it.unit] || [0, 0]; byUnit[it.unit][1]++;
          if(ok){ right++; byUnit[it.unit][0]++; sound('correct'); if(b) b.classList.add('ok'); } else { missed.push({ deck: it.deck, card: it.card }); sound('wrong'); if(b) b.classList.add('no'); var good = $$('.co-opt', el).find(function(x){ return x.dataset.o === it.ok; }); if(good) good.classList.add('ok'); }
          $$('.co-opt', el).forEach(function(x){ x.disabled = true; });
          qi++; setTimeout(show, ok ? 650 : 1500);
        }
        $$('.co-opt', el).forEach(function(b){ b.addEventListener('click', function(){ answer(b.dataset.o === it.ok, b); }); });
        $('[data-co-dunno]', el).addEventListener('click', function(){ answer(false, null); });
        $('[data-co-quit]', el).addEventListener('click', function(){ go('classroom', null, true); });
      }
      function finish(){
        var score = right / items.length, msg = courseAdjust(co, kind, idx, score, missed, byUnit);
        saveCourse(co).then(function(){
          el.innerHTML = '<section class="clib-card"><h2>' + (score >= .75 ? '🎉 ' : '🌱 ') + right + ' of ' + items.length + '</h2><p class="clib-big">' + esc(msg) + '</p><div class="clib-row"><button type="button" class="clib-btn main" data-view="classroom">See my course</button></div></section>';
          wireTiles(el);
        });
      }
      show();
    });
  } };

  // the Classroom's own look
  (function(){
    var css = [
      'textarea.clib-input.co-goal{ min-height:0; height:auto; }', '.co-two{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }', '.co-check{ display:flex; gap:8px; align-items:center; margin:14px 0 4px; font-weight:700; }',
      '.co-meta{ color:var(--clib-soft); font-weight:700; font-size:.9rem; margin:6px 0; }', '.co-tag{ display:inline-block; font-weight:800; font-size:.8rem; letter-spacing:.04em; text-transform:uppercase; color:var(--clib-accent); }',
      '.co-now h2{ margin:4px 0 2px; }', '.co-focus{ font-weight:800; color:var(--clib-soft); margin:0 0 8px; }', '.co-late{ background:var(--clib-read-bg); color:var(--clib-read); padding:8px 12px; border-radius:12px; font-weight:700; }',
      '.co-cando{ margin:6px 0 10px; padding-left:0; list-style:none; } .co-cando li{ padding:3px 0 3px 26px; position:relative; font-weight:700; } .co-cando li::before{ content:"✓"; position:absolute; left:4px; color:var(--clib-good); font-weight:900; }',
      '.co-bar{ height:12px; border-radius:999px; background:var(--clib-line); overflow:hidden; margin-top:8px; } .co-bar i{ display:block; height:100%; background:var(--clib-accent); border-radius:999px; transition:width .6s; }',
      '.co-week{ padding-left:20px; } .co-week li{ margin:8px 0; } .co-week b{ display:block; margin-bottom:4px; } .co-go{ margin:2px 4px 2px 0; }',
      '.co-line{ list-style:none; padding:0; margin:0; display:grid; gap:8px; }', '.co-u details{ background:var(--clib-card); border:1px solid var(--clib-line); border-radius:16px; padding:10px 14px; }',
      '.co-u summary{ display:flex; gap:12px; align-items:center; cursor:pointer; list-style:none; } .co-u summary::-webkit-details-marker{ display:none; }',
      '.co-dot{ flex:none; width:34px; height:34px; border-radius:50%; display:grid; place-items:center; font-weight:900; background:var(--clib-bg); border:2px solid var(--clib-line); }',
      '.co-u.done .co-dot{ background:var(--clib-good); color:#fff; border-color:var(--clib-good); } .co-u.now .co-dot{ background:var(--clib-accent); color:var(--clib-accent-ink); border-color:var(--clib-accent); }',
      '.co-u.now details{ border-color:var(--clib-accent); box-shadow:0 0 0 2px var(--clib-accent) inset; } .co-u.review .co-ut b::after{ content:" · review"; color:var(--clib-soft); font-weight:700; }',
      '.co-ut{ display:flex; flex-direction:column; } .co-ut small{ color:var(--clib-soft); font-weight:700; }', '.co-ud{ padding:8px 0 0 46px; }',
      '.co-log{ padding-left:18px; } .co-log li{ margin:6px 0; font-weight:700; } .co-log small{ color:var(--clib-soft); margin-right:6px; }',
      '.co-q .co-qt{ font-size:2rem; margin:10px 0 4px; }', '.co-opts{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0; } .co-opt{ min-height:56px; font-size:1.05rem; }',
      '.co-opt.ok{ background:var(--clib-good); color:#fff; border-color:var(--clib-good); } .co-opt.no{ background:var(--clib-bad); color:#fff; border-color:var(--clib-bad); }',
      '.co-hear{ font-size:1.2rem; padding:14px 22px; margin:10px 0; }',
      '.clib-classroom{ display:flex; gap:14px; align-items:center; width:100%; text-align:left; border:2px solid var(--clib-accent); background:var(--clib-card); border-radius:20px; padding:14px 16px; margin:0 0 14px; cursor:pointer; font:inherit; color:var(--clib-ink); }',
      '.clib-classroom .co-cr-e .cc-ic{ width:2.4rem; height:2.4rem; color:var(--clib-accent); } .co-go .cc-ic, .co-hear .cc-ic{ width:1.2em; height:1.2em; vertical-align:-.25em; color:var(--clib-accent); } .co-head h2 .cc-ic{ color:var(--clib-accent); vertical-align:-.2em; } .clib-classroom b{ display:block; font-size:1.1rem; } .clib-classroom small{ color:var(--clib-soft); font-weight:700; }',
      '@media (max-width:520px){ .co-two, .co-opts{ grid-template-columns:1fr; } .co-ud{ padding-left:0; } }'
    ];
    var s = document.createElement('style'); s.textContent = css.join('\n'); (document.head || document.documentElement).appendChild(s);
  })();
  // The Classroom's banner at the top of the Library's home, for a profile with it on
  function classroomBanner(){
    if(!courseOn()) return '';
    var co = course(), now = co && courseNow(co);
    return '<button type="button" class="clib-classroom" data-view="classroom"><span class="co-cr-e" aria-hidden="true">' + icon('school', '🏫') + '</span><span><b>Coral Classroom</b><small>' +
      (!co ? 'Plan your course: a few questions, then units with goals, dates and checks.' : now ? 'Unit ' + (co.units.indexOf(now) + 1) + ' of ' + co.units.length + ': ' + esc(now.title) + ' · until ' + niceDate(now.end) : 'Course complete! 🎉') + '</small></span></button>';
  }
  LIB.views.home = { title: 'Library', render: function(el){
    if(pendingAct){ markDone(pendingAct.goal, pendingAct.id); pendingAct = null; }
    var p = CC() && CC().profile(), goals = myGoals(), r = dayRec();
    var tab = goals.indexOf(r.tab) >= 0 ? r.tab : goals[0], plan = goalPlan(tab), today4 = plan.slice(0, 4), done = r.day.done[tab] || [];
    var isDone = function(a){ return done.indexOf(a.id) >= 0; }, next = today4.find(function(a){ return !isDone(a); }), nDone = today4.filter(isDone).length;
    var html = '<div class="clib-hello"><span class="clib-av" aria-hidden="true">' + esc(p ? p.name.charAt(0) : '🐢') + '</span><div><h2>Hi' + (p ? ' ' + esc(p.name) : '') + '!</h2><p>' +
      (goals[0] === 'explore' ? 'Pick something to learn.' : 'Your goal' + (goals.length > 1 ? 's' : '') + ': ' + goals.map(function(g){ var m = goalMeta(g); return '<span class="clib-chip ' + lookOf(g) + '">' + m.icon + ' ' + esc(m.label) + '</span>'; }).join(' ')) + '</p></div></div>';
    html += classroomBanner();
    html += '<div class="clib-tabs" role="tablist" aria-label="Your goals">' + goals.map(function(g){ var m = goalMeta(g);
      return '<button type="button" role="tab" class="clib-tab ' + lookOf(g) + '" aria-selected="' + (g === tab) + '" data-tab="' + esc(g) + '">' + m.icon + ' ' + esc(m.label) + '</button>'; }).join('') + '</div>';
    html += '<div class="clib-path ' + lookOf(tab) + '"><section class="clib-next" aria-label="Next up">' + (next
      ? '<span class="clib-next-lbl">Next up</span><span class="clib-next-e" aria-hidden="true">' + actIcon(next) + '</span><b>' + esc(next.name) + '</b><p data-note="' + next.id + '">' + esc(next.note) + '</p>' +
        '<button type="button" class="clib-go" data-act="' + next.id + '">Start ▶</button>'
      : '<span class="clib-next-lbl">Today</span><span class="clib-next-e" aria-hidden="true">🎉</span><b>All ' + today4.length + ' done for today!</b><p>You worked hard. You can pick another one to keep going.</p>') +
      '<div class="clib-daybar" aria-hidden="true">' + today4.map(function(a){ return '<i class="' + (isDone(a) ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<p class="clib-daybar-t">' + nDone + ' of ' + today4.length + ' done today</p></section>';
    html += '<section class="clib-side"><h3>' + (next ? 'Or pick one' : 'Keep going') + '</h3>' + plan.filter(function(a){ return a !== next; }).map(function(a){
      return '<button type="button" class="clib-pick" data-act="' + a.id + '"><span class="clib-pick-e" aria-hidden="true">' + actIcon(a) + '</span><span class="clib-pick-t"><b>' + esc(a.name) +
        (isDone(a) ? ' <span class="clib-tick">✓ done</span>' : '') + '</b><small data-note="' + a.id + '">' + esc(a.note) + '</small></span></button>'; }).join('') + '</section></div>';
    html += '<h3 class="clib-more-h">Everything else</h3><div class="clib-more">' + [['🐢', 'Tutor', 'tutorHome', 'tutor'], ['📝', 'Worksheets', 'wsHome', 'worksheet'], ['🔢', 'Maths lab', 'mathHome', 'maths'],
      ['✍️', 'Check my work', 'checkHome', 'checkwork'], ['📈', 'My progress', 'progressHome', 'progress'], ['🗂️', 'All decks', 'decks', 'cards'], ['⚙️', 'Settings', 'settings', 'settings']].map(function(x){
      return '<button type="button" class="clib-more-b" data-view="' + x[2] + '"><span aria-hidden="true">' + icon(x[3], x[0]) + '</span> ' + x[1] + '</button>'; }).join('') + '</div>';
    el.innerHTML = html;
    wireTiles(el);
    $$('[data-tab]', el).forEach(function(b){ b.addEventListener('click', function(){ var r2 = dayRec(); r2.tab = b.dataset.tab; saveRec(r2); sound('tap'); go('home', null, true); }); });
    $$('[data-act]', el).forEach(function(b){ b.addEventListener('click', function(){ var a = plan.find(function(x){ return x.id === b.dataset.act; }); if(a) startAct(tab, a); }); });
    var gd = goalDecks(tab);   // the deck activity names the deck it will open
    if(gd.length) bestDeck(gd).then(function(best){ if(best) $$('[data-note="deck"]', el).forEach(function(n){ n.textContent = best.d.name + (best.due ? ' · ' + best.due + ' card' + (best.due === 1 ? '' : 's') + ' ready' : ''); }); });
  } };
  // Decks in the goal subjects first, for every deck list and picker in the Library.
  function goalFirst(ds){ var g = myGoals(); return ds.slice().sort(function(a, b){ var x = g.indexOf(a.subject), y = g.indexOf(b.subject); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); }); }
  LIB.goalFirst = goalFirst;

  LIB.views.decks = { title: 'Decks', render: function(el){
    var ds = goalFirst(decks());
    if(!ds.length){ el.innerHTML = '<p class="clib-note">No decks yet. A grown-up can add some in Edit Mode.</p>'; return; }
    el.innerHTML = '<p class="clib-lede">Open a deck to practise it, or make a worksheet from it.</p><ul class="clib-list">' + ds.map(function(d){
      return '<li><span class="clib-li-e" aria-hidden="true">' + esc(d.emoji) + '</span><span class="clib-li-t">' + esc(d.name) + '<small data-count="' + esc(d.id) + '"></small></span>' +
        '<button type="button" class="clib-btn" data-ws="' + esc(d.id) + '">📝 Worksheet</button><button type="button" class="clib-btn main" data-open="' + esc(d.id) + '">Practise</button></li>'; }).join('') + '</ul>';
    $$('[data-open]', el).forEach(function(b){ b.addEventListener('click', function(){ close(); CC().startDeck(b.dataset.open); }); });
    $$('[data-ws]', el).forEach(function(b){ b.addEventListener('click', function(){ go('wsMake', JSON.stringify({ src: 'deck', deck: b.dataset.ws })); }); });
    ds.forEach(function(d){ cards(d.id).then(function(cs){ var m = cs.filter(function(c){ return cardStateOf(c) === 'mastered'; }).length; var s = el.querySelector('[data-count="' + d.id + '"]'); if(s) s.textContent = cs.length + ' cards · ' + m + ' mastered'; }); });
  } };

  // Settings: the Claude helper and a few preferences. Behind a grown-up maths question.
  LIB.views.settings = { title: 'Settings', render: function(el){
    var ask = !CC() || !CC().needsGrownUpCheck || CC().needsGrownUpCheck();
    if(ask && !LIB.pinOK){   // a grown-up times question (the same kind the app uses instead of a PIN)
      var q = (window.CoralCoveGrownUpQuestion || function(){ var a = 13 + rnd(75), b = 6 + rnd(4); return { a: a, b: b, ans: a * b }; })();
      el.innerHTML = '<section class="clib-card"><h2>🧮 Grown-ups only</h2><p>Solve this to change Library settings.</p><p class="clib-big">' + q.a + ' × ' + q.b + ' =</p><input id="clibPin" class="clib-input" inputmode="numeric" autocomplete="off" maxlength="3" aria-label="Your answer to ' + q.a + ' times ' + q.b + '"><div class="clib-row"><button type="button" class="clib-btn main" data-go>OK</button></div><p class="clib-msg" aria-live="polite"></p></section>';
      var inp = $('#clibPin', el), go2 = function(){ if(+inp.value.replace(/\D/g, '') === q.ans){ LIB.pinOK = true; go('settings', null, true); } else { go('settings', null, true); setTimeout(function(){ var m = $('.clib-msg'); if(m) m.textContent = 'Not quite. Here\'s a new one.'; }, 0); } };
      $('[data-go]', el).addEventListener('click', go2); inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') go2(); }); inp.focus(); return;
    }
    var s = settings();
    el.innerHTML = goalsCard() + '<section class="clib-card"><h2>✨ Claude helper</h2>' +
      '<p>When the device is online, the tutor, worksheet maker and feedback can use Claude through your own small helper server. Without it everything works offline. Setup steps are in README.md under "Claude helper".</p>' +
      '<label class="clib-label" for="clibUrl">Helper address</label><input id="clibUrl" class="clib-input" placeholder="https://coral-helper.example.workers.dev" value="' + esc(s.proxyUrl || '') + '">' +
      '<label class="clib-label" for="clibCode">Passphrase</label><input id="clibCode" class="clib-input" type="password" autocomplete="off" value="' + esc(s.proxyCode || '') + '">' +
      '<div class="clib-row"><button type="button" class="clib-btn main" data-save>Save</button><button type="button" class="clib-btn" data-test>Test it</button><button type="button" class="clib-btn" data-off>Turn off</button></div><p class="clib-msg" aria-live="polite"></p></section>' +
      '<section class="clib-card"><h2>🔊 Voice</h2><label class="clib-check"><input type="checkbox" id="clibVoice"' + (s.voice !== false ? ' checked' : '') + '> Read tutor replies aloud</label></section>' +
      '<section class="clib-card"><h2>💛 Her interests</h2><p>Used in maths word problems.</p><input id="clibInt" class="clib-input" value="' + esc((s.interests || ['sea turtles', 'crabs', 'cookies', 'soccer']).join(', ')) + '"></section>' +
      '<section class="clib-card"><h2>💬 Tutor topics</h2><label class="clib-check"><input type="checkbox" id="clibBig"' + (s.noBig ? '' : ' checked') + '> Allow big-question discussions</label>' +
      '<label class="clib-check"><input type="checkbox" id="clibLog"' + (s.noLog ? '' : ' checked') + '> Keep a log of tutor chats for grown-ups</label>' +
      '<div class="clib-row"><button type="button" class="clib-btn" data-chatlog>Read the chat log</button></div></section>';
    var msg = $('.clib-msg', el);
    function save(){ s.proxyUrl = $('#clibUrl', el).value.trim(); s.proxyCode = $('#clibCode', el).value.trim(); s.voice = $('#clibVoice', el).checked;
      s.interests = $('#clibInt', el).value.split(',').map(function(x){ return x.trim(); }).filter(Boolean).slice(0, 8);
      s.noBig = !$('#clibBig', el).checked; s.noLog = !$('#clibLog', el).checked; saveSettings(s); root.querySelector('.clib-source').textContent = claudeReady() ? '✨ Claude on' : '📴 Offline mode'; }
    $('[data-save]', el).addEventListener('click', function(){ save(); msg.textContent = 'Saved.'; });
    $('[data-off]', el).addEventListener('click', function(){ $('#clibUrl', el).value = ''; $('#clibCode', el).value = ''; save(); msg.textContent = 'Claude is off. Everything uses the offline versions.'; });
    $('[data-test]', el).addEventListener('click', function(){ save(); msg.textContent = 'Asking Claude…';
      ask('chat', [{ role: 'user', content: 'Say hello to a young learner in one short sentence.' }]).then(function(t){ msg.textContent = t ? 'It works! Claude says: ' + t : 'It didn\'t work: ' + (LIB.lastError || 'no reply') + '. Check the address and passphrase.'; }); });
    $('[data-chatlog]', el).addEventListener('click', function(){ go('chatLog'); });
    wireGoals(el);
    ['#clibVoice', '#clibBig', '#clibLog', '#clibInt'].forEach(function(id){ $(id, el).addEventListener('change', save); });
  } };
  // The profile's learning goals: the Library's home has one tab for each. Saved with the profile.
  function goalChoices(){
    var list = (CC() && CC().subjects ? CC().subjects() : []).slice();
    decks().forEach(function(d){ if(d.subject && !list.some(function(x){ return x.id === d.subject; })) list.push({ id: d.subject, icon: '🏷️', label: d.subject }); });
    return list;
  }
  function goalsCard(){
    var p = CC() && CC().profile(); if(!p || !CC().setGoals) return '';
    var on = p.goals || [];
    return '<section class="clib-card"><h2>🎯 Learning goals for ' + esc(p.name) + '</h2><p>The Library\'s home has a tab for each goal, with activities for it.' +
      (p.goalsSet ? '' : ' These were picked from ' + esc(p.name) + '\'s decks; tap to change them.') + '</p><div class="clib-row" role="group" aria-label="Learning goals">' +
      goalChoices().map(function(g){ return '<button type="button" class="clib-btn" data-goal="' + esc(g.id) + '" aria-pressed="' + (on.indexOf(g.id) >= 0) + '">' + g.icon + ' ' + esc(g.label) + '</button>'; }).join('') +
      '</div><p class="clib-msg" data-goalmsg aria-live="polite"></p></section>';
  }
  function wireGoals(el){
    $$('[data-goal]', el).forEach(function(b){ b.addEventListener('click', function(){
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      var on = $$('[data-goal][aria-pressed="true"]', el).map(function(x){ return x.dataset.goal; }), msg = $('[data-goalmsg]', el);
      var cur = (CC().profile() || {}).goals || [];   // goals keep their order (it is the order of the tabs); new ones go last
      var list = cur.filter(function(g){ return on.indexOf(g) >= 0; }).concat(on.filter(function(g){ return cur.indexOf(g) < 0; }));
      if(!list.length){ b.setAttribute('aria-pressed', 'true'); msg.textContent = 'Keep at least one goal.'; return; }
      CC().setGoals(list).then(function(ok){ msg.textContent = ok ? 'Saved.' : 'Couldn\'t save. Try again.'; });
    }); });
  }
  LIB.views.chatLog = { title: 'Tutor chat log', render: function(el){
    var l = (rec().log || []).filter(function(x){ return x.k === 'chat'; }).slice(-80).reverse();
    el.innerHTML = l.length ? '<ul class="clib-log">' + l.map(function(x){ return '<li><small>' + new Date(x.t).toLocaleString() + ' · ' + esc(x.mode || '') + (x.src === 'claude' ? ' · Claude' : ' · offline') + '</small><p><b>She:</b> ' + esc(x.q) + '</p><p><b>Shelly:</b> ' + esc(x.a) + '</p></li>'; }).join('') + '</ul>'
      : '<p class="clib-note">No chats yet.</p>';
  } };

  var CSS = [
    'body.clib-open{ overflow:hidden; }',
    /* the app's fonts and sea colours; one colour per learning goal (light first, dark below) */
    '.clib{ position:fixed; inset:0; z-index:9600; display:flex; flex-direction:column; background:var(--clib-bg); color:var(--clib-ink); font-family:var(--font-body, "Nunito Sans", "Nunito", system-ui, sans-serif); line-height:1.4;',
    '  --clib-display:var(--font-display, "Fredoka", "Baloo 2", ui-rounded, system-ui, sans-serif);',
    '  --clib-bg:#eaf6f6; --clib-card:#ffffff; --clib-ink:#0b3a44; --clib-soft:#4d6d73; --clib-line:#cfe6e4; --clib-accent:#157a80; --clib-accent-ink:#ffffff; --clib-good:#2f7a52; --clib-bad:#b5452f; --clib-warm:#f2b544;',
    '  --clib-math:#157a80; --clib-math-bg:#dff3f1; --clib-read:#a8620a; --clib-read-bg:#fff0d6; --clib-ko:#b8364f; --clib-ko-bg:#fde6ea; --clib-sci:#5b4bc4; --clib-sci-bg:#ece9fb; --clib-life:#357a43; --clib-life-bg:#e3f4e6; --clib-other:#3d6470; --clib-other-bg:#e4eef1; }',
    '@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .clib{ --clib-bg:#071f25; --clib-card:#10313a; --clib-ink:#e4f4f2; --clib-soft:#a2c3c1; --clib-line:#22505a; --clib-accent:#4fc7cf; --clib-accent-ink:#04252b; --clib-good:#8fd9ae; --clib-bad:#f2a08f;',
    '  --clib-math:#4fc7cf; --clib-math-bg:#0f3a40; --clib-read:#f2b553; --clib-read-bg:#3a2a0e; --clib-ko:#f28aa0; --clib-ko-bg:#3e1822; --clib-sci:#b3a8ff; --clib-sci-bg:#262046; --clib-life:#8fd99d; --clib-life-bg:#163821; --clib-other:#9cc4cf; --clib-other-bg:#1a3640; } }',
    ':root[data-theme="dark"] .clib{ --clib-bg:#071f25; --clib-card:#10313a; --clib-ink:#e4f4f2; --clib-soft:#a2c3c1; --clib-line:#22505a; --clib-accent:#4fc7cf; --clib-accent-ink:#04252b; --clib-good:#8fd9ae; --clib-bad:#f2a08f;',
    '  --clib-math:#4fc7cf; --clib-math-bg:#0f3a40; --clib-read:#f2b553; --clib-read-bg:#3a2a0e; --clib-ko:#f28aa0; --clib-ko-bg:#3e1822; --clib-sci:#b3a8ff; --clib-sci-bg:#262046; --clib-life:#8fd99d; --clib-life-bg:#163821; --clib-other:#9cc4cf; --clib-other-bg:#1a3640; }',
    '.clib-g-math{ --g:var(--clib-math); --gb:var(--clib-math-bg); } .clib-g-read{ --g:var(--clib-read); --gb:var(--clib-read-bg); } .clib-g-ko{ --g:var(--clib-ko); --gb:var(--clib-ko-bg); }',
    '.clib-g-sci{ --g:var(--clib-sci); --gb:var(--clib-sci-bg); } .clib-g-life{ --g:var(--clib-life); --gb:var(--clib-life-bg); } .clib-g-other{ --g:var(--clib-other); --gb:var(--clib-other-bg); }',
    '.clib[hidden]{ display:none; }',
    '.clib-head{ display:flex; align-items:center; gap:12px; padding:max(12px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) 12px max(18px, env(safe-area-inset-left)); border-bottom:1px solid var(--clib-line); background:var(--clib-card); }',
    '.clib-title{ flex:1; margin:0; font:600 1.5rem var(--clib-display); }',
    '.clib-source{ font-size:.82rem; font-weight:700; color:var(--clib-soft); white-space:nowrap; }',
    '.clib-back{ border:none; background:var(--clib-bg); color:var(--clib-ink); font-weight:800; font-size:.95rem; font-family:inherit; min-height:44px; padding:0 16px; border-radius:999px; cursor:pointer; }',
    '.clib-body{ flex:1; overflow:auto; -webkit-overflow-scrolling:touch; padding:20px max(18px, env(safe-area-inset-right)) max(28px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); }',
    '.clib-body > *{ max-width:1040px; margin-left:auto; margin-right:auto; }',
    '.clib-lede{ color:var(--clib-soft); font-weight:600; font-size:1.02rem; margin:0 auto 16px; }',
    '.clib-note{ color:var(--clib-soft); }',
    /* home: greeting, goal tabs, Next up, Or pick one, Everything else */
    '.clib-hello{ display:flex; align-items:center; gap:14px; margin-bottom:16px; }',
    '.clib-av{ flex:none; width:52px; height:52px; border-radius:50%; display:grid; place-items:center; font:600 1.4rem var(--clib-display); color:var(--clib-accent-ink); background:var(--clib-accent); }',
    '.clib-hello h2{ margin:0; font:600 1.6rem/1.1 var(--clib-display); } .clib-hello p{ margin:3px 0 0; color:var(--clib-soft); font-weight:600; }',
    '.clib-chip{ display:inline-flex; align-items:center; gap:4px; font-weight:800; font-size:.85rem; padding:3px 11px; border-radius:999px; background:var(--gb); color:var(--g); }',
    '.clib-tabs{ display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; }',
    '.clib-tab{ font:600 1.15rem var(--clib-display); min-height:48px; padding:0 22px; border-radius:999px; border:2px solid var(--clib-line); background:var(--clib-card); color:var(--clib-soft); cursor:pointer; }',
    '.clib-tab[aria-selected="true"]{ background:var(--g); border-color:var(--g); color:var(--clib-card); }',
    '.clib-path{ display:grid; grid-template-columns:minmax(0, 1.25fr) minmax(0, 1fr); gap:16px; align-items:start; }',
    '@media (max-width:720px){ .clib-path{ grid-template-columns:1fr; } }',
    '.clib-next{ background:var(--g); color:var(--clib-card); border-radius:26px; padding:24px; display:grid; gap:8px; align-content:start; box-shadow:0 6px 0 color-mix(in srgb, var(--g) 70%, #000); }',
    '.clib-next-lbl{ font-weight:800; font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; opacity:.85; }',
    '.clib-next-e{ font-size:3.2rem; line-height:1; } .clib-next b{ font:600 2rem/1.1 var(--clib-display); } .clib-next p{ margin:0; font-weight:600; opacity:.92; }',
    '.clib-go{ justify-self:start; margin-top:8px; font:600 1.2rem var(--clib-display); min-height:52px; padding:0 30px; border:none; border-radius:16px; background:var(--clib-card); color:var(--g); cursor:pointer; box-shadow:0 4px 0 rgba(0,0,0,.18); }',
    '.clib-go:active{ transform:translateY(3px); box-shadow:0 1px 0 rgba(0,0,0,.18); }',
    '.clib-daybar{ display:flex; gap:6px; margin-top:10px; } .clib-daybar i{ width:34px; height:9px; border-radius:99px; background:color-mix(in srgb, var(--clib-card) 35%, transparent); } .clib-daybar i.on{ background:var(--clib-card); }',
    '.clib-daybar-t{ font-size:.88rem; }',
    '.clib-side{ display:grid; gap:10px; } .clib-side h3{ margin:0 0 2px; font:600 1.1rem var(--clib-display); color:var(--clib-soft); }',
    '.clib-pick{ display:flex; align-items:center; gap:12px; text-align:left; width:100%; padding:10px 14px; min-height:60px; border-radius:16px; border:1px solid var(--clib-line); background:var(--clib-card); color:var(--clib-ink); font:inherit; cursor:pointer; }',
    '.clib-pick:hover{ border-color:var(--g); }',
    '.clib-pick-e{ flex:none; width:42px; height:42px; display:grid; place-items:center; font-size:1.5rem; border-radius:12px; background:var(--gb); }',
    '.clib-pick-t{ min-width:0; } .clib-pick b{ display:block; font:600 1.02rem var(--clib-display); } .clib-pick small{ color:var(--clib-soft); font-weight:600; font-size:.82rem; }',
    '.clib-tick{ font:800 .75rem var(--font-body, sans-serif); color:var(--clib-good); margin-left:4px; }',
    '.clib-more-h{ margin:24px auto 8px; font:600 1.05rem var(--clib-display); color:var(--clib-soft); }',
    '.clib-more{ display:flex; flex-wrap:wrap; gap:10px; }',
    '.clib-more-b{ min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--clib-line); background:var(--clib-card); color:var(--clib-ink); font:inherit; font-weight:800; font-size:.92rem; cursor:pointer; }',
    /* section pages */
    '.clib-tiles{ display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:14px; }',
    '.clib-tile{ display:flex; flex-direction:column; align-items:flex-start; gap:4px; text-align:left; padding:16px; border-radius:20px; border:1px solid var(--clib-line); background:var(--clib-card); color:var(--clib-ink); cursor:pointer; font:inherit; min-height:118px; box-shadow:0 3px 0 var(--clib-line); }',
    '.clib-tile:hover{ border-color:var(--clib-accent); } .clib-tile:active{ transform:translateY(2px); box-shadow:0 1px 0 var(--clib-line); }',
    '.clib-tile-e{ font-size:2rem; line-height:1.1; } .clib-tile b{ font:600 1.1rem/1.15 var(--clib-display); } .clib-tile small{ color:var(--clib-soft); font-weight:600; }',
    '.clib-card{ background:var(--clib-card); border:1px solid var(--clib-line); border-radius:22px; padding:18px; margin:16px auto; }',
    '.clib-card h2{ margin:0 0 8px; font:600 1.25rem var(--clib-display); }',
    '.clib-big{ font-size:1.15rem; font-weight:800; }',
    '.clib-row{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; align-items:center; }',
    '.clib-btn{ border:1px solid var(--clib-line); background:var(--clib-bg); color:var(--clib-ink); font-weight:800; font-size:.95rem; font-family:inherit; min-height:44px; padding:0 16px; border-radius:999px; cursor:pointer; }',
    '.clib-btn.main{ background:var(--clib-accent); color:var(--clib-accent-ink); border-color:var(--clib-accent); }',
    '.clib-btn[aria-pressed="true"]{ background:var(--clib-accent); color:var(--clib-accent-ink); border-color:var(--clib-accent); }',
    '.clib-btn:disabled{ opacity:.5; cursor:default; }',
    '.clib-btn:focus-visible, .clib-tile:focus-visible, .clib-input:focus-visible, .clib-back:focus-visible, .clib-tab:focus-visible, .clib-go:focus-visible, .clib-pick:focus-visible, .clib-more-b:focus-visible{ outline:3px solid var(--clib-warm); outline-offset:2px; }',
    '.clib-input{ width:100%; box-sizing:border-box; font-weight:700; font-size:1rem; font-family:inherit; color:var(--clib-ink); background:var(--clib-bg); border:1px solid var(--clib-line); border-radius:14px; padding:11px 13px; }',
    'textarea.clib-input{ min-height:120px; resize:vertical; }',
    '.clib-label{ display:block; font-weight:800; margin:12px 0 4px; }',
    '.clib-check{ display:flex; gap:8px; align-items:center; font-weight:700; margin:6px 0; }',
    '.clib-msg{ min-height:1.3em; font-weight:800; color:var(--clib-soft); }',
    '.clib-list{ list-style:none; padding:0; margin:0; display:grid; gap:10px; }',
    '.clib-list li{ display:flex; align-items:center; gap:10px; background:var(--clib-card); border:1px solid var(--clib-line); border-radius:16px; padding:12px 14px; flex-wrap:wrap; }',
    '.clib-li-e{ font-size:1.5rem; } .clib-li-t{ flex:1; min-width:140px; font-weight:800; display:flex; flex-direction:column; } .clib-li-t small{ color:var(--clib-soft); font-weight:600; }',
    '.clib-qa{ background:var(--clib-bg); border-radius:14px; padding:12px; font-weight:700; }',
    '.clib-log{ list-style:none; padding:0; } .clib-log li{ border-bottom:1px solid var(--clib-line); padding:8px 0; } .clib-log p{ margin:2px 0; }',
    '.clib-good{ color:var(--clib-good); font-weight:800; } .clib-bad{ color:var(--clib-bad); font-weight:800; }',
    '.clib-pill{ display:inline-block; padding:2px 10px; border-radius:999px; background:var(--clib-bg); border:1px solid var(--clib-line); font-weight:800; font-size:.85rem; }',
    '.clib-bar{ height:12px; border-radius:6px; background:var(--clib-line); overflow:hidden; display:flex; } .clib-bar i{ display:block; height:100%; } .clib-bar .m{ background:var(--clib-good); } .clib-bar .l{ background:var(--clib-warm); }',
    '@media (prefers-reduced-motion: reduce){ .clib *{ transition:none !important; animation:none !important; } }'
  ].join('\n');

  /* =====================================================================================================
     TUTOR. Offline it's a rule-based helper: it reads maths questions and explains them step by step, looks
     words up in her own decks, knows a small set of child-friendly facts, and runs scripted talks, role-plays
     and debates. With Claude on, each mode sends Claude its own instructions plus what she's been practising.
     ===================================================================================================== */

  /* ---- maths: read a question and explain it (also used by the maths lab and worksheets) ---- */
  var OPS = { '+': '+', 'plus': '+', 'add': '+', 'and': '+', '-': '−', '−': '−', 'minus': '−', 'take away': '−', 'subtract': '−', 'less': '−',
    'x': '×', '×': '×', '*': '×', 'times': '×', 'multiplied by': '×', 'lots of': '×', 'groups of': '×', '/': '÷', '÷': '÷', 'divided by': '÷', 'shared between': '÷', 'shared by': '÷' };
  var WORDNUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
  function mathParse(text){
    var t = ' ' + String(text).toLowerCase().replace(/[?!.,]/g, ' ') + ' ';
    Object.keys(WORDNUM).forEach(function(w){ t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), String(WORDNUM[w])); });
    var keys = Object.keys(OPS).sort(function(a, b){ return b.length - a.length; }).map(function(k){ return k.replace(/[*+?^$()|[\]\\/-]/g, '\\$&'); });
    var m = t.match(new RegExp('(\\d+)\\s*(' + keys.join('|') + ')\\s*(\\d+)'));
    if(!m) return null;
    var a = +m[1], b = +m[3], op = OPS[m[2].trim()] || OPS[m[2]];
    if(op === '÷' && (b === 0)) return null;
    return { a: a, b: b, op: op, ans: mathCalc(a, op, b) };
  }
  function mathCalc(a, op, b){ return op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : Math.round(a / b * 100) / 100; }
  // Steps a child can follow, choosing a strategy that fits the numbers.
  function mathSteps(a, op, b){
    var s = [], ans = mathCalc(a, op, b);
    if(op === '+'){
      if(a === b) s.push('This is a double! ' + a + ' and ' + a + ' more makes ' + ans + '.');
      else if(Math.abs(a - b) === 1){ var lo = Math.min(a, b); s.push('These are next-door numbers: use a double. ' + lo + ' + ' + lo + ' = ' + (2 * lo) + '.', 'Then add 1 more: ' + (2 * lo) + ' + 1 = ' + ans + '.'); }
      else if(a < 10 && b < 10 && a + b > 10){ var big = Math.max(a, b), sm = Math.min(a, b), need = 10 - big; s.push('Make a ten! ' + big + ' needs ' + need + ' more to make 10.', 'Take ' + need + ' from ' + sm + '. That leaves ' + (sm - need) + '.', '10 + ' + (sm - need) + ' = ' + ans + '.'); }
      else if(a >= 10 && b >= 10){ var ta = Math.floor(a / 10) * 10, oa = a % 10, tb = Math.floor(b / 10) * 10, ob = b % 10;
        s.push('Split into tens and ones: ' + a + ' = ' + ta + ' + ' + oa + ', and ' + b + ' = ' + tb + ' + ' + ob + '.', 'Tens: ' + ta + ' + ' + tb + ' = ' + (ta + tb) + '. Ones: ' + oa + ' + ' + ob + ' = ' + (oa + ob) + '.', 'Put them together: ' + (ta + tb) + ' + ' + (oa + ob) + ' = ' + ans + '.'); }
      else s.push('Start at the bigger number, ' + Math.max(a, b) + ', and count on ' + Math.min(a, b) + ': ' + range(Math.max(a, b) + 1, ans).join(', ') + '.', 'You land on ' + ans + '.');
    } else if(op === '−'){
      if(b > a) s.push('We take ' + b + ' away from ' + a + ', but ' + b + ' is bigger, so the answer goes below zero: ' + ans + '.');
      else if(b <= 5 && a <= 20) s.push('Start at ' + a + ' and count back ' + b + ': ' + range(a - 1, ans, -1).join(', ') + '.', 'You land on ' + ans + '.');
      else if(a % 10 < b % 10 && a >= 10){ var up = 10 - b % 10; s.push('Count up from ' + b + ' to ' + a + ' instead (that\'s the difference).', b + ' + ' + up + ' = ' + (b + up) + ' (a tidy ten).', 'From ' + (b + up) + ' to ' + a + ' is ' + (a - b - up) + ' more.', up + ' + ' + (a - b - up) + ' = ' + ans + '.'); }
      else { var tb2 = Math.floor(b / 10) * 10, ob2 = b % 10; s.push('Take away the tens first: ' + a + ' − ' + tb2 + ' = ' + (a - tb2) + '.', 'Then the ones: ' + (a - tb2) + ' − ' + ob2 + ' = ' + ans + '.'); }
    } else if(op === '×'){
      if(a === 0 || b === 0) s.push('Anything times zero is zero: no groups means nothing at all.');
      else if(a === 1 || b === 1) s.push('One group of ' + Math.max(a, b) + ' is just ' + Math.max(a, b) + '.');
      else if(b === 10 || a === 10) s.push('Times 10: the digits move one place bigger, so ' + (a === 10 ? b : a) + ' becomes ' + ans + '.');
      else if(b === 2 || a === 2) s.push('Times 2 is a double: ' + (a === 2 ? b : a) + ' + ' + (a === 2 ? b : a) + ' = ' + ans + '.');
      else if(Math.min(a, b) <= 5){ var g = Math.min(a, b), n = Math.max(a, b); s.push(g + ' groups of ' + n + '. Skip count by ' + n + ': ' + range(1, g).map(function(i){ return i * n; }).join(', ') + '.', 'That\'s ' + ans + '.'); }
      else { var n2 = Math.max(a, b), g2 = Math.min(a, b); s.push('Split ' + g2 + ' into 5 + ' + (g2 - 5) + '.', '5 × ' + n2 + ' = ' + (5 * n2) + ' and ' + (g2 - 5) + ' × ' + n2 + ' = ' + ((g2 - 5) * n2) + '.', (5 * n2) + ' + ' + ((g2 - 5) * n2) + ' = ' + ans + '.'); }
    } else {
      if(a % b === 0) s.push('Share ' + a + ' into ' + b + ' equal groups.', 'Think: what times ' + b + ' makes ' + a + '? ' + b + ' × ' + ans + ' = ' + a + '.', 'So each group has ' + ans + '.');
      else { var q = Math.floor(a / b), rmd = a % b; s.push('Share ' + a + ' into ' + b + ' groups: each gets ' + q + ' (' + b + ' × ' + q + ' = ' + (b * q) + ').', 'There are ' + rmd + ' left over, so the answer is ' + q + ' remainder ' + rmd + '.'); }
    }
    return s;
  }
  function range(from, to, step){ step = step || 1; var r = []; for(var i = from; step > 0 ? i <= to : i >= to; i += step){ r.push(i); if(r.length > 30) break; } return r; }
  LIB.math = { parse: mathParse, calc: mathCalc, steps: mathSteps };

  /* ---- a small set of facts the offline tutor knows ---- */
  var FACTS = [
    [/turtle/, 'Sea turtles can hold their breath for a long time, and some travel thousands of kilometres across the ocean. Mother turtles come back to beaches to lay their eggs.'],
    [/octop/, 'An octopus has eight arms, three hearts and blue blood. It can change colour to hide.'],
    [/shark/, 'Sharks have been around since before the dinosaurs. They grow new teeth all their lives.'],
    [/whale/, 'The blue whale is the biggest animal that has ever lived. Whales breathe air through a blowhole on top of their heads.'],
    [/dolphin/, 'Dolphins are mammals, not fish. They talk to each other with clicks and whistles.'],
    [/jelly/, 'Jellyfish have no brain, no heart and no bones. Some glow in the dark.'],
    [/coral/, 'Coral looks like a plant or a rock, but it is made of tiny animals called polyps. Coral reefs are home to lots of fish.'],
    [/crab/, 'Crabs walk sideways and have a hard shell called an exoskeleton. Hermit crabs live in empty shells and move to a bigger one as they grow.'],
    [/fish/, 'Fish breathe with gills that take oxygen from the water. Most fish have fins to swim and scales to protect them.'],
    [/ocean|sea\b/, 'The ocean covers most of the Earth. It is salty, and the deepest part is deeper than the tallest mountain is tall.'],
    [/tide/, 'Tides are the sea moving in and out, mostly because the Moon pulls on the water.'],
    [/moon/, 'The Moon goes around the Earth about once a month. It doesn\'t make its own light; it shines with light from the Sun.'],
    [/sun\b|the sun/, 'The Sun is a star. It is so big that about a million Earths could fit inside it.'],
    [/star\b|stars/, 'Stars are giant balls of hot gas, very far away. Our Sun is the closest star.'],
    [/planet/, 'There are eight planets that go around our Sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.'],
    [/rain|cloud/, 'Water from the sea warms up and rises into the sky, makes clouds, then falls back as rain. That is the water cycle.'],
    [/rainbow/, 'A rainbow happens when sunlight shines through raindrops and splits into colours: red, orange, yellow, green, blue, indigo and violet.'],
    [/dinosaur/, 'Dinosaurs lived millions of years ago. Birds are the dinosaurs\' living relatives.'],
    [/plant|tree|leaf|leaves/, 'Plants make their own food from sunlight, water and air. Their leaves give out the oxygen we breathe.'],
    [/heart/, 'Your heart is a muscle about the size of your fist. It pumps blood around your body all day and night.'],
    [/brain/, 'Your brain helps you think, remember, move and feel. It keeps working even while you sleep.'],
    [/bone|skeleton/, 'Your bones hold your body up and protect parts inside. Grown-ups have 206 bones.'],
    [/korea|korean|hangul/, 'Korean is written in Hangul, an alphabet made over 500 years ago. Letters stack into syllable blocks, like 한 and 글.'],
    [/chinese|hanzi|mandarin/, 'Chinese is written with characters. Many characters started as little pictures, like 山 for mountain.'],
    [/fraction|half|quarter/, 'A fraction is a part of a whole. One half (1/2) means one of two equal parts; one quarter (1/4) means one of four equal parts.'],
    [/even|odd/, 'Even numbers can be split into two equal groups (2, 4, 6…). Odd numbers have one left over (1, 3, 5…).'],
    [/zero/, 'Zero means nothing at all. It also holds a place in numbers, like the 0 in 10.'],
    [/shape|triangle|square|circle/, 'A triangle has 3 sides, a square has 4 equal sides, and a circle has no corners at all.'],
    [/time|clock|hour|minute/, 'There are 60 minutes in an hour and 24 hours in a day. On a clock, the short hand shows the hour and the long hand shows the minutes.'],
    [/money|coin|dollar|cent/, 'Coins have different values. Counting money is adding: start with the biggest coins first.']
  ];
  function factFor(q){ var l = q.toLowerCase(); for(var i = 0; i < FACTS.length; i++) if(FACTS[i][0].test(l)) return FACTS[i][1]; return null; }

  /* ---- question of the day ---- */
  var QOTD = [
    ['Why is the sea salty?', 'Rain washes tiny bits of salt out of rocks into rivers, and rivers carry it to the sea. The water evaporates, but the salt stays behind.'],
    ['Do fish sleep?', 'Yes! Fish rest, but most can\'t close their eyes because they have no eyelids. Some hide in coral or sand to rest.'],
    ['Why do we have to sleep?', 'Sleep helps your body grow and fix itself, and helps your brain store what you learned today.'],
    ['How do birds know where to fly in winter?', 'Many birds use the Sun, the stars and even Earth\'s magnetism like a built-in compass.'],
    ['Why is the sky blue?', 'Sunlight has all the colours. The air scatters blue light the most, so blue comes at us from every direction.'],
    ['Could a person live on the Moon?', 'Not without help. There\'s no air to breathe, so astronauts bring air, water and food with them.'],
    ['What makes a good friend?', 'Lots of people say kindness, listening, sharing and being fair. What do you think matters most?'],
    ['Why do leaves change colour?', 'In autumn trees stop making green chlorophyll, so the yellow and orange that were hiding underneath show through.'],
    ['How deep is the ocean?', 'The deepest place, the Mariana Trench, is about 11 kilometres down. That\'s deeper than Mount Everest is tall.'],
    ['Is a tomato a fruit?', 'Yes! Scientists call it a fruit because it grows from a flower and has seeds inside.'],
    ['Why do cats purr?', 'Cats often purr when they\'re happy, and sometimes to calm themselves down.'],
    ['How do magnets work?', 'Magnets pull on some metals, like iron, with an invisible force. Two magnets can pull together or push apart.'],
    ['Why do we have different languages?', 'Groups of people lived far apart for a long time, and their ways of talking slowly changed in different directions.'],
    ['What is the biggest number?', 'There isn\'t one! You can always add 1 to any number to get a bigger one.'],
    ['Why can\'t we breathe underwater?', 'Our lungs take oxygen from air. Fish have gills that can take oxygen from water, but our lungs can\'t.'],
    ['Where does the wind come from?', 'The Sun warms some places more than others. Warm air rises and cooler air rushes in to take its place: that\'s wind.'],
    ['Do plants feel?', 'Plants don\'t have brains or nerves, but they do react: they turn toward light and some close up when touched.'],
    ['Why is it fair to take turns?', 'Taking turns means everyone gets a chance. What would happen if nobody took turns?'],
    ['How do sea turtles find their way home?', 'Scientists think turtles can sense Earth\'s magnetism and remember the magnetic "map" of the beach where they hatched.'],
    ['What are numbers for?', 'Numbers help us count, measure, share fairly, tell time and even build bridges.'],
    ['Why does the Moon change shape?', 'It doesn\'t really! We see different amounts of its sunny side as it travels around the Earth.'],
    ['What would happen if there were no bees?', 'Bees carry pollen between flowers so plants can make fruit and seeds. Without bees we\'d have far fewer fruits and vegetables.'],
    ['Why do we dream?', 'Nobody knows for sure! Many scientists think dreams help our brains sort through memories and feelings.'],
    ['Is it ever OK to break a rule?', 'Some people think it\'s OK if following the rule would hurt someone. What do you think?'],
    ['How do octopuses change colour?', 'Their skin has tiny colour sacs they can stretch or squeeze in a flash, to hide or to show how they feel.'],
    ['Why is the ocean blue?', 'Water soaks up red light and lets blue light bounce around, and it also reflects the blue sky.'],
    ['What makes thunder?', 'Lightning heats the air so fast that it bursts outward with a giant BOOM. That boom is thunder.'],
    ['How many stars are there?', 'More than anyone can count: there are more stars in the universe than grains of sand on all of Earth\'s beaches.'],
    ['Why do people say "please" and "thank you"?', 'They show we respect and appreciate each other. How do you feel when someone thanks you?'],
    ['Can animals talk?', 'Animals communicate with sounds, smells and movements. Dolphins whistle names, and bees dance to show where flowers are.'],
    ['What is a shadow?', 'A shadow is a dark shape where something blocks the light.'],
    ['Why do we have seasons?', 'The Earth is tilted. As it travels around the Sun, each half gets more direct sunlight for part of the year.'],
    ['What is the smallest thing?', 'Everything is made of tiny atoms, and atoms are made of even tinier bits. They\'re far too small to see.'],
    ['Why is kindness important?', 'Kindness helps people feel safe and happy, and it often spreads: one kind act can lead to another.'],
    ['How do fish breathe?', 'Water flows over their gills, which take in the oxygen dissolved in it.'],
    ['Why do we need water?', 'Most of your body is water. You need it to keep cool, digest food and keep everything working.'],
    ['What is a volcano?', 'A volcano is a place where hot melted rock from deep inside the Earth comes up to the surface.'],
    ['Why do some animals glow?', 'Some sea creatures make their own light to find food, to hide or to talk to each other. It\'s called bioluminescence.'],
    ['What makes something alive?', 'Living things grow, need food and water, and make more of their kind. Is a fire alive? Why or why not?'],
    ['Why is practice important?', 'Each time you practise, your brain builds stronger paths, so it gets easier and faster next time.']
  ];
  LIB.questionOfDay = function(){ var d = new Date(), n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); var q = QOTD[n % QOTD.length]; return { q: q[0], a: q[1] }; };

  /* ---- big questions to talk through ---- */
  var TALKS = [
    { id: 'friends', e: '🤝', title: 'What makes a good friend?', qs: ['What is one thing a good friend does?', 'Why does that matter to you?', 'Can a friend still be a good friend if you disagree?', 'What could you do to be a good friend tomorrow?'] },
    { id: 'fair', e: '⚖️', title: 'What is fair?', qs: ['If there are 7 cookies and 2 children, what would be fair?', 'Is fair always the same as equal? Why or why not?', 'What if one child is much hungrier?', 'Can you think of a rule that is fair to everyone?'] },
    { id: 'honest', e: '💬', title: 'Is it always best to tell the truth?', qs: ['Why do people tell the truth?', 'Have you ever been scared to tell the truth? What happened?', 'What if the truth might hurt someone\'s feelings?', 'How can we be honest and kind at the same time?'] },
    { id: 'brave', e: '🦁', title: 'What is courage?', qs: ['What does being brave mean to you?', 'Can you be brave and scared at the same time?', 'Is it brave to say sorry?', 'When have you been brave?'] },
    { id: 'alive', e: '🌱', title: 'What makes something alive?', qs: ['Is a fish alive? How do you know?', 'Is a fire alive? It grows and needs air…', 'Is a seed alive before it grows?', 'What is your own rule for "alive"?'] },
    { id: 'ocean', e: '🌊', title: 'How should we look after the ocean?', qs: ['Why does the ocean matter to us?', 'What happens to plastic that ends up in the sea?', 'What could one person do to help?', 'What would you tell a grown-up to do?'] },
    { id: 'rules', e: '📜', title: 'Why do we have rules?', qs: ['What is a rule you follow every day?', 'What would happen without that rule?', 'Who should make the rules?', 'Is there a rule you would change? Why?'] },
    { id: 'happy', e: '😊', title: 'What makes you happy?', qs: ['What is something that always makes you smile?', 'Can money make people happy?', 'Can you make someone else happy? How?', 'Is it OK to feel sad sometimes?'] }
  ];
  /* ---- role-plays ---- */
  var PLAYS = [
    { id: 'cafe', e: '☕', title: 'Order at a Korean café', lang: 'ko', turns: [
      { bot: '어서 오세요! (Welcome!) 뭐 드릴까요? (What would you like?)', want: [/주세요|please|juseyo/i], hint: 'Name a drink and add 주세요 (juseyo, "please"). Try: 우유 주세요 (milk, please).' },
      { bot: '네! 따뜻한 거요, 차가운 거요? (Hot or cold?)', want: [/따뜻|차가|hot|cold/i], hint: 'Say 따뜻한 거요 (hot one) or 차가운 거요 (cold one).' },
      { bot: '네, 사천 원이에요. (That\'s 4,000 won.)', want: [/여기|감사|here|thank|gamsa/i], hint: 'Say 여기요 (here you go) and 감사합니다 (thank you).' },
      { bot: '감사합니다! 좋은 하루 보내세요! (Have a nice day!)', end: true } ] },
    // Korean travel situations, for Coral Classroom's units (each line: what she hears, then what she might say)
    { id: 'restaurant', e: '🍲', title: 'Eat at a Korean restaurant', lang: 'ko', turns: [
      { bot: '어서 오세요! 몇 분이세요? (Welcome! How many people?)', want: [/명|한|두|세|one|two|three|myeong/i], hint: 'Say how many: 한 명이요 (one person) or 두 명이요 (two people).' },
      { bot: '여기 앉으세요. 뭐 드시겠어요? (Please sit here. What will you have?)', want: [/주세요|비빔밥|불고기|김치찌개|냉면|please|juseyo/i], hint: 'Pick a dish and add 주세요: 비빔밥 주세요 (bibimbap, please).' },
      { bot: '네, 알겠습니다. 물은 셀프예요. (OK. Water is self-service.)', want: [/네|감사|thank|ok|yes/i], hint: 'Say 네, 감사합니다 (OK, thank you).' },
      { bot: '맛있게 드세요! (Enjoy your meal!)', end: true } ] },
    { id: 'shop', e: '🛍️', title: 'Buy something at a shop', lang: 'ko', turns: [
      { bot: '어서 오세요! 찾으시는 거 있어요? (Welcome! Looking for anything?)', want: [/이거|얼마|있어요|this|how much|eolma/i], hint: 'Point and ask: 이거 얼마예요? (How much is this?)' },
      { bot: '만 오천 원이에요. (It\'s 15,000 won.)', want: [/주세요|비싸|깎|살게요|please|expensive|take/i], hint: 'Say 이거 주세요 (I\'ll take this) or 조금 비싸요 (it\'s a bit expensive).' },
      { bot: '카드로 하시겠어요? (Paying by card?)', want: [/네|카드|현금|yes|card|cash/i], hint: 'Say 네, 카드로 할게요 (yes, by card) or 현금이요 (cash).' },
      { bot: '감사합니다! 안녕히 가세요! (Thank you! Goodbye!)', end: true } ] },
    { id: 'subway', e: '🚇', title: 'Ask the way to the subway', lang: 'ko', turns: [
      { bot: '네, 무엇을 도와드릴까요? (Yes, how can I help you?)', want: [/어디|역|where|station|eodi/i], hint: 'Ask: 명동역 어디예요? (Where is Myeongdong Station?)' },
      { bot: '이 길로 쭉 가세요. 그리고 오른쪽으로 가세요. (Go straight along this road, then turn right.)', want: [/네|감사|오른쪽|thank|right|ok/i], hint: 'Check: 오른쪽이요? (Right?) or say 네, 감사합니다!' },
      { bot: '네, 맞아요. 걸어서 오 분 걸려요. (That\'s right. It\'s a five-minute walk.)', want: [/감사|thank|gamsa/i], hint: 'Say 감사합니다! (Thank you!)' },
      { bot: '조심히 가세요! (Take care!)', end: true } ] },
    { id: 'taxi', e: '🚕', title: 'Take a taxi', lang: 'ko', turns: [
      { bot: '어디로 가세요? (Where are you going?)', want: [/가 주세요|주세요|호텔|역|please|hotel|station/i], hint: 'Say the place and 가 주세요: 서울역 가 주세요 (Seoul Station, please).' },
      { bot: '네. 안전벨트 매세요. (OK. Please wear your seatbelt.)', want: [/네|감사|yes|thank|ok/i], hint: 'Say 네! (OK!)' },
      { bot: '도착했어요. 만 이천 원입니다. (We\'re here. That\'s 12,000 won.)', want: [/카드|여기|감사|card|here|thank/i], hint: 'Say 카드로 할게요 (by card) or 여기요 (here you go).' },
      { bot: '감사합니다! 좋은 하루 보내세요! (Thank you! Have a nice day!)', end: true } ] },
    { id: 'hotel', e: '🏨', title: 'Check in at a hotel', lang: 'ko', turns: [
      { bot: '안녕하세요! 체크인하시겠어요? (Hello! Are you checking in?)', want: [/네|예약|yes|reservation/i], hint: 'Say 네, 예약했어요 (Yes, I have a reservation).' },
      { bot: '성함이 어떻게 되세요? (May I have your name?)', want: [/예요|이에요|입니다|저는|name|I\'m/i], hint: 'Say your name with 예요 or 이에요: 웬디예요 (I\'m Wendy).' },
      { bot: '네, 확인됐습니다. 아침은 일곱 시부터예요. (You\'re confirmed. Breakfast is from seven.)', want: [/네|감사|thank|ok/i], hint: 'Say 네, 감사합니다!' },
      { bot: '좋은 시간 보내세요! (Have a lovely stay!)', end: true } ] },
    { id: 'intro', e: '👋', title: 'Introduce yourself', lang: 'ko', turns: [
      { bot: '안녕하세요! 이름이 뭐예요? (Hello! What\'s your name?)', want: [/예요|이에요|입니다|저는|name|I\'m/i], hint: 'Say 저는 웬디예요 (I\'m Wendy), with your name.' },
      { bot: '어디에서 왔어요? (Where are you from?)', want: [/왔어요|에서|from|미국|캐나다|영국|호주/i], hint: 'Say your country and 에서 왔어요: 미국에서 왔어요 (I\'m from the US).' },
      { bot: '한국어 잘하시네요! 왜 한국어를 공부해요? (Your Korean is good! Why are you learning it?)', want: [/여행|좋아|때문|travel|trip|like|because/i], hint: 'Say 한국 여행을 해요 (I\'m travelling in Korea) or 한국 문화를 좋아해요 (I like Korean culture).' },
      { bot: '반가워요! 즐거운 여행 되세요! (Nice to meet you! Have a great trip!)', end: true } ] },
    { id: 'help', e: '🆘', title: 'Ask for help', lang: 'ko', turns: [
      { bot: '무슨 일이에요? (What\'s the matter?)', want: [/화장실|도와|잃어|아파|toilet|restroom|help|lost|sick/i], hint: 'Say 화장실이 어디예요? (Where is the restroom?) or 도와주세요 (Please help me).' },
      { bot: '저기 있어요. 왼쪽이에요. (It\'s over there, on the left.)', want: [/감사|네|thank|ok/i], hint: 'Say 감사합니다!' },
      { bot: '괜찮아요! (You\'re welcome!)', end: true } ] },
    { id: 'market', e: '🍎', title: 'Buy fruit at a Chinese market', lang: 'zh', turns: [
      { bot: '你好！你要什么？(Nǐ hǎo! What would you like?)', want: [/要|苹果|香蕉|yào|want|apple|banana/i], hint: 'Say 我要苹果 (wǒ yào píngguǒ, "I want apples").' },
      { bot: '要几个？(How many?)', want: [/\d|一|二|两|三|四|五|个|one|two|three/i], hint: 'Say a number and 个: 三个 (sān gè, three).' },
      { bot: '十块钱。(Ten yuan.)', want: [/谢谢|给|xièxie|thank|here/i], hint: 'Say 谢谢 (xièxie, thank you).' },
      { bot: '不客气！再见！(You\'re welcome! Bye!)', end: true } ] },
    { id: 'library', e: '📚', title: 'Ask for a book at the library', lang: 'en', turns: [
      { bot: 'Hello! Welcome to the library. How can I help you?', want: [/book|looking|find|want|please/i], hint: 'Say what kind of book you want, like "I\'m looking for a book about sharks, please."' },
      { bot: 'Great choice! Do you want a picture book or a chapter book?', want: [/picture|chapter|both/i], hint: 'Say "a picture book, please" or "a chapter book, please."' },
      { bot: 'Here you go! You can keep it for two weeks. Do you have a library card?', want: [/yes|no|here|card/i], hint: 'Say "Yes, here it is" or "No, can I get one?"' },
      { bot: 'All done. Enjoy your book! Come back soon.', end: true } ] },
    { id: 'scientist', e: '🔬', title: 'Interview a marine biologist', lang: 'en', turns: [
      { bot: 'Hi! I\'m Dr. Reef, a marine biologist. I study ocean animals. What would you like to ask me?', want: [/\?|what|why|how|where|who|when/i], hint: 'Ask a question starting with what, why, how or where. Like "What is your favourite sea animal?"' },
      { bot: 'Great question! I love octopuses: they are so clever they can open jars. What else would you like to know?', want: [/\?|what|why|how|where|who|when/i], hint: 'Ask another question! Maybe about where you work or what you discovered.' },
      { bot: 'I work on a boat and dive near coral reefs. Coral is made of tiny animals! Would you like to be a scientist one day? Why?', want: [/yes|no|because|maybe/i], hint: 'Answer yes, no or maybe, and say "because…"' },
      { bot: 'That\'s wonderful. Thanks for the interview! Keep asking questions: that\'s what scientists do.', end: true } ] }
  ];
  /* ---- debates ---- */
  var DEBATES = [
    { id: 'homework', e: '🎒', q: 'Should children have homework?', yes: ['practice helps you remember', 'it teaches you to work on your own'], no: ['children need time to play and rest', 'families can learn together in other ways'] },
    { id: 'pets', e: '🐶', q: 'Should every family have a pet?', yes: ['pets teach you to be responsible', 'pets are good company'], no: ['pets need lots of time and money', 'some people are allergic'] },
    { id: 'zoo', e: '🦒', q: 'Are aquariums and zoos good for animals?', yes: ['they protect animals in danger', 'they teach people to care about animals'], no: ['animals have less space than in the wild', 'some animals get bored or stressed'] },
    { id: 'screens', e: '📱', q: 'Is screen time good for learning?', yes: ['apps and videos can teach new things', 'you can learn at your own speed'], no: ['too much screen time is bad for sleep', 'playing outside teaches things too'] },
    { id: 'uniform', e: '👕', q: 'Should schools have uniforms?', yes: ['everyone looks equal', 'mornings are easier'], no: ['clothes let you show who you are', 'uniforms can be uncomfortable'] },
    { id: 'sweets', e: '🍬', q: 'Should dessert come before dinner sometimes?', yes: ['it makes special days fun', 'small treats are fine'], no: ['you might not eat your healthy food', 'it could become a habit'] }
  ];

  LIB.views.tutorHome = { title: 'Tutor', render: function(el){
    var s = settings(), list = [
      { e: '🐢', name: 'Ask Shelly', note: 'Any question', view: 'chat', arg: 'ask' },
      { e: '🧭', name: 'Help me think', note: 'Shelly asks the questions', view: 'chat', arg: 'socratic' },
      { e: '🎭', name: 'Role-play', note: 'Café, market, library…', view: 'plays' },
      { e: '🗣️', name: 'Debate', note: 'Pick a side, give reasons', view: 'debates' },
      { e: '🌈', name: 'Explain it 3 ways', note: 'Picture, story, steps', view: 'explain3' },
      { e: '🎓', name: 'Teach Shelly', note: 'You explain, she checks', view: 'teachback' }
    ];
    if(!s.noBig) list.splice(2, 0, { e: '💭', name: 'Big questions', note: 'Talk about ideas', view: 'talks' });
    el.innerHTML = '<p class="clib-lede">' + esc(memoryLine()) + '</p>' + tiles(list); wireTiles(el);
    var q = LIB.questionOfDay && LIB.questionOfDay();
    if(q){ var box = document.createElement('section'); box.className = 'clib-card clib-qotd';
      box.innerHTML = '<h2>💭 Question of the day</h2><p class="clib-big">' + esc(q.q) + '</p><button type="button" class="clib-btn" data-a>See what Shelly thinks</button><p class="clib-qa" hidden>' + esc(q.a) + '</p>';
      box.querySelector('[data-a]').addEventListener('click', function(){ var a = box.querySelector('.clib-qa'); a.hidden = false; speak(q.a); });
      el.appendChild(box); }
  } };
  // What the tutor remembers: her decks and what she did lately.
  function memoryLine(){
    var l = (rec().log || []).slice(-40).reverse(), ds = decks();
    var lastMath = l.find(function(x){ return x.k === 'math'; }), lastWs = l.find(function(x){ return x.k === 'ws'; });
    if(lastMath) return 'Welcome back! Last time you practised ' + (lastMath.skill || 'maths') + '. What would you like to do today?';
    if(lastWs) return 'Welcome back! You finished a worksheet on ' + (lastWs.title || 'a deck') + '. What next?';
    if(ds.length) return 'You have ' + ds.length + ' decks, like ' + ds.slice(0, 2).map(function(d){ return d.name; }).join(' and ') + '. Ask me about any of them!';
    return 'Ask me anything, or pick a way to learn together.';
  }
  function deckContext(){ return decks().slice(0, 20).map(function(d){ return d.name; }).join(', '); }

  /* ---- the chat screen, used by Ask, Socratic, talks, role-plays and debates ---- */
  // A role-play line is said without its English translation in brackets ("어서 오세요! (Welcome!)" says only the
  // Korean): the translation is on the screen, and the natural voice reads the language being practised.
  // A hint like "Say 이거 얼마예요? (How much is this?)" is read as just the Korean to copy: 이거 얼마예요?
  function koPhrases(t){ var m = String(t || '').replace(/\([^)]*\)/g, '').match(/[가-힣][가-힣\s,.?!~]*/g); return m ? m.map(function(x){ return x.trim(); }).join(' ') : ''; }
  function sayable(t){ var s2 = String(t || '').replace(/\s*\([^)]*\)/g, '').trim(); return s2 || t; }
  function chatScreen(el, opts){
    el.innerHTML = '<div class="clib-chat"><div class="clib-msgs" aria-live="polite"></div>' +
      '<form class="clib-send"><input class="clib-input" autocomplete="off" placeholder="' + esc(opts.placeholder || 'Type here…') + '" aria-label="Your message">' +
      (hasMic() ? '<button type="button" class="clib-btn" data-mic aria-label="Talk instead of typing">' + LIB.icon('mic', '🎤') + '</button>' : '') +
      '<button type="submit" class="clib-btn main">Send</button></form>' + (opts.extra || '') + '</div>';
    var msgs = $('.clib-msgs', el), form = $('.clib-send', el), inp = $('input', form), history = [];
    function add(who, text, cls){ var d = document.createElement('div'); d.className = 'clib-m ' + who + (cls ? ' ' + cls : ''); d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
    function say(text){ add('bot', text); history.push({ role: 'assistant', content: text }); speak(/^play:/.test(opts.mode || '') ? sayable(text) : text); }
    form.addEventListener('submit', function(e){
      e.preventDefault(); var q = inp.value.trim(); if(!q) return; inp.value = '';
      add('me', q); history.push({ role: 'user', content: q });
      var wait = add('bot', '…', 'wait');
      var off = function(){ return opts.offline(q, history); };
      var done = function(a, src){ wait.remove(); say(a); if(!settings().noLog) log('chat', { mode: opts.mode, q: q, a: a, src: src }); if(opts.after) opts.after(q, a); };
      if(opts.system && claudeReady()) ask('chat', history.slice(-16), opts.system()).then(function(t){ if(t) done(t, 'claude'); else done(off(), 'offline'); });
      else setTimeout(function(){ done(off(), 'offline'); }, 350);
    });
    var mic = $('[data-mic]', el); if(mic) mic.addEventListener('click', function(){ listen(function(t){ inp.value = t; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }, mic); });
    if(opts.greet) say(opts.greet);
    setTimeout(function(){ try { inp.focus({ preventScroll: true }); } catch(e){} }, 60);
    return { say: say, add: add, history: history, input: inp };
  }
  function hasMic(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function listen(cb, btn){
    var R = window.SpeechRecognition || window.webkitSpeechRecognition; if(!R) return;
    var r = new R(); r.lang = navigator.language || 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    btn.classList.add('listening'); r.onresult = function(e){ cb(e.results[0][0].transcript); }; r.onend = function(){ btn.classList.remove('listening'); }; r.onerror = function(){ btn.classList.remove('listening'); };
    try { r.start(); } catch(e){ btn.classList.remove('listening'); }
  }

  // Offline "Ask": maths, her decks, facts, then a friendly not-sure.
  var deckIndex = null;
  function loadIndex(){ if(!deckIndex) allCards().then(function(a){ deckIndex = a; }); }
  function lookUp(q){
    if(!deckIndex) return null;
    var l = q.toLowerCase().replace(/^(what('s| is| does)|how do (you|i) say|what means|meaning of|define|tell me about)\s+/, '').replace(/\s+(mean|means|in (korean|chinese|english))\??$/, '').replace(/[?"'.]/g, '').trim();
    if(!l) return null;
    var hit = deckIndex.find(function(x){ return x.front.toLowerCase() === l || x.back.toLowerCase() === l; }) ||
      deckIndex.find(function(x){ return l.length > 2 && (x.front.toLowerCase().indexOf(l) >= 0 || x.back.toLowerCase().indexOf(l) >= 0); });
    return hit;
  }
  function offlineAsk(q){
    var m = mathParse(q); if(m) return m.a + ' ' + m.op + ' ' + m.b + ' = ' + m.ans + '. Here\'s how: ' + mathSteps(m.a, m.op, m.b).join(' ');
    var hit = lookUp(q);
    if(hit) return '"' + hit.front + '" means "' + hit.back + '".' + (hit.note ? ' ' + hit.note : '') + ' It\'s in your ' + hit.deck.name + ' deck.';
    var f = factFor(q); if(f) return f;
    if(/^(hi|hello|hey|안녕|你好)/i.test(q)) return 'Hello! What would you like to learn about?';
    if(/thank/i.test(q)) return 'You\'re welcome! I love learning with you.';
    return 'Great question! I don\'t know that one yet without the internet. You could ask a grown-up, look it up together in a book, or ask me again when we\'re online. Want to try a maths question or a word from your decks?';
  }
  // Offline "Help me think": answers with a guiding question instead of the answer.
  function offlineSocratic(q, hist){
    var m = mathParse(q);
    if(m){ var first = mathSteps(m.a, m.op, m.b)[0]; return 'Let\'s work it out together. ' + first.replace(/\.[^.]*$/, '.') + ' What do you think comes next?'; }
    var lastBot = hist.filter(function(h){ return h.role === 'assistant'; }).slice(-1)[0];
    var n = Number(q.replace(/[^\d.-]/g, '')); if(lastBot && /what do you think comes next|what number/i.test(lastBot.content) && !isNaN(n) && /\d/.test(q)) return 'Good thinking! How could you check that answer? Try counting it another way.';
    var hit = lookUp(q); if(hit) return 'What do you already know about "' + hit.front + '"? Here\'s a clue: it\'s in your ' + hit.deck.name + ' deck. Can you use it in a sentence?';
    if(/because/i.test(q)) return 'That\'s a good reason. Is there another way to look at it?';
    return pick(['What do you already know about that?', 'Why do you think that is?', 'How could we find out if that\'s true?', 'Can you give me an example?', 'What would happen if it were the other way round?']);
  }
  var ASK_SYS = function(){ return 'Answer the child\'s question in 2 to 4 short sentences. If it is maths, show the steps simply. Her decks are: ' + deckContext() + '.'; };
  var SOC_SYS = function(){ return 'Socratic mode: never give the final answer straight away. Ask one short guiding question at a time that helps her get there herself. Praise effort. Her decks are: ' + deckContext() + '.'; };

  LIB.views.chat = { title: 'Ask Shelly', render: function(el, mode){
    loadIndex();
    var soc = mode === 'socratic';
    this.title = soc ? 'Help me think' : 'Ask Shelly';
    chatScreen(el, { mode: mode, placeholder: soc ? 'What are you stuck on?' : 'Ask anything, like "what is 7 + 8?"',
      greet: soc ? 'Tell me what you\'re working on, and I\'ll ask questions to help you figure it out.' : 'Hi! Ask me a maths question, a word from your decks, or anything you wonder about.',
      offline: function(q, h){ return soc ? offlineSocratic(q, h) : offlineAsk(q); }, system: soc ? SOC_SYS : ASK_SYS });
  } };

  LIB.views.talks = { title: 'Big questions', render: function(el){
    el.innerHTML = '<p class="clib-lede">There are no wrong answers. Shelly asks, you think and explain.</p>' + tiles(TALKS.map(function(t){ return { e: t.e, name: t.title, view: 'talk', arg: t.id }; })); wireTiles(el);
  } };
  LIB.views.talk = { title: 'Big question', render: function(el, id){
    var t = TALKS.find(function(x){ return x.id === id; }) || TALKS[0], step = 0, answers = [];
    chatScreen(el, { mode: 'talk:' + t.id, greet: t.title + ' ' + t.qs[0], placeholder: 'What do you think?',
      offline: function(q){
        answers.push(q); step++;
        var react = /because|so that|since/i.test(q) ? 'I like that you gave a reason.' : q.split(/\s+/).length > 6 ? 'You thought about that carefully.' : 'Interesting! Can you tell me a bit more next time?';
        if(step < t.qs.length) return react + ' ' + t.qs[step];
        return react + ' Thank you for thinking with me! Here\'s what you said: ' + answers.map(function(a, i){ return (i + 1) + ') ' + a; }).join(' ') + ' What a thinker!';
      },
      system: function(){ return 'Big-question discussion about: "' + t.title + '". Ask one open question at a time (these are good ones: ' + t.qs.join(' | ') + '). Respond warmly to her ideas, ask her for reasons, and gently offer another point of view. No lectures.'; } });
  } };

  LIB.views.plays = { title: 'Role-play', render: function(el){
    var lang = { korean: 'ko', reading: 'en', science: 'en' }, g = myGoals().map(function(x){ return lang[x]; }), rank = function(p){ var i = g.indexOf(p.lang); return i < 0 ? 99 : i; };
    el.innerHTML = '<p class="clib-lede">Practise real conversations. Shelly plays the other person.</p>' + tiles(PLAYS.slice().sort(function(a, b){ return rank(a) - rank(b); }).map(function(p){ return { e: p.e, icon: PLAY_ICON[p.id], name: p.title, view: 'play', arg: p.id }; })); wireTiles(el);
  } };
  LIB.views.play = { title: 'Role-play', render: function(el, id){
    var p = PLAYS.find(function(x){ return x.id === id; }) || PLAYS[0], i = 0, tries = 0;
    chatScreen(el, { mode: 'play:' + p.id, greet: p.turns[0].bot, placeholder: 'Your turn to talk…',
      extra: '<div class="clib-row"><button type="button" class="clib-btn" data-hint>💡 Hint</button></div>',
      offline: function(q){
        var t = p.turns[i];
        if(t.end) return 'That was the end! Want to play again? Go back and pick it.';
        if(t.want.some(function(r){ return r.test(q); })){ i++; tries = 0; return (p.lang === 'en' ? '' : 'Great! ') + p.turns[i].bot; }
        tries++; return tries >= 2 ? 'Here\'s a hint: ' + t.hint : 'Hmm, try again! ' + t.bot;
      },
      system: function(){ return 'Role-play: you are the other person in "' + p.title + '". Stay in character, use simple ' + (p.lang === 'ko' ? 'Korean with English in brackets' : p.lang === 'zh' ? 'Chinese with pinyin and English in brackets' : 'English') + ', one short line at a time. If she makes a mistake, model the right phrase gently and keep going.'; } });
    $('[data-hint]', el).addEventListener('click', function(){ var t = p.turns[i]; var m = document.createElement('div'); m.className = 'clib-m bot'; m.textContent = t.end ? 'All done!' : '💡 ' + t.hint; $('.clib-msgs', el).appendChild(m); speak(koPhrases(t.hint) || t.hint || ''); });
  } };

  LIB.views.debates = { title: 'Debate', render: function(el){
    el.innerHTML = '<p class="clib-lede">Pick a side and give your reasons. Shelly takes the other side, kindly.</p>' + tiles(DEBATES.map(function(d){ return { e: d.e, name: d.q, view: 'debate', arg: d.id }; })); wireTiles(el);
  } };
  LIB.views.debate = { title: 'Debate', render: function(el, id){
    var d = DEBATES.find(function(x){ return x.id === id; }) || DEBATES[0], side = null, round = 0;
    chatScreen(el, { mode: 'debate:' + d.id, greet: d.q + ' Do you say yes or no?', placeholder: 'Yes or no, and why?',
      offline: function(q){
        if(!side){ side = /\bno\b|disagree|shouldn/i.test(q) ? 'no' : 'yes'; }
        var mine = side === 'yes' ? d.no : d.yes, reason = /because|so|since/i.test(q);
        round++;
        if(round === 1) return (reason ? 'Good reason! ' : 'Can you say "because…"? ') + 'I\'ll take the other side: ' + (side === 'yes' ? 'no' : 'yes') + ', because ' + mine[0] + '. What do you say to that?';
        if(round === 2) return (reason ? 'That\'s a strong point. ' : 'Tell me why! ') + 'Here\'s another thought: ' + mine[1] + '. Can you answer that one?';
        return 'Great debating! You listened and gave reasons. Some people think ' + (side === 'yes' ? d.yes : d.no).join(' and ') + '; others think ' + mine.join(' and ') + '. Did you change your mind at all?';
      },
      system: function(){ return 'Friendly debate on "' + d.q + '". Let her choose a side, then kindly argue the other side with one simple reason at a time, ask for her reasons, and after 3 rounds praise good reasoning and sum up both sides.'; } });
  } };

  // Explain it 3 ways: a picture, a story, and steps.
  LIB.views.explain3 = { title: 'Explain it 3 ways', render: function(el){
    loadIndex();
    el.innerHTML = '<section class="clib-card"><label class="clib-label" for="clibE3">What should Shelly explain?</label><input id="clibE3" class="clib-input" placeholder="Like 8 + 5, 3 × 4, or a word from your decks">' +
      '<div class="clib-row"><button type="button" class="clib-btn main" data-go>Explain</button></div></section><div class="clib-e3"></div>';
    var out = $('.clib-e3', el), inp = $('#clibE3', el);
    function show(parts){ out.innerHTML = parts.map(function(p){ return '<section class="clib-card"><h2>' + p[0] + '</h2><div class="clib-big">' + p[1] + '</div></section>'; }).join(''); }
    function go2(){
      var q = inp.value.trim(); if(!q) return;
      var m = mathParse(q);
      if(m){
        var pic = m.op === '+' && m.a + m.b <= 30 ? '<span class="clib-dots">' + '🔵'.repeat(m.a) + ' ' + '🟠'.repeat(m.b) + '</span><p>' + m.a + ' blue and ' + m.b + ' orange make ' + m.ans + '.</p>'
          : m.op === '×' && m.a * m.b <= 60 ? '<div class="clib-arr">' + range(1, m.a).map(function(){ return '<div>' + '🐚'.repeat(m.b) + '</div>'; }).join('') + '</div><p>' + m.a + ' rows of ' + m.b + ' = ' + m.ans + '.</p>'
          : m.op === '−' && m.a <= 30 ? '<span class="clib-dots">' + '🔵'.repeat(m.a - m.b) + '<s>' + '🔵'.repeat(Math.max(0, m.b)) + '</s></span><p>Cross out ' + m.b + ', and ' + m.ans + ' are left.</p>'
          : '<p>Draw ' + m.a + ' and ' + m.b + ' as groups of ten and ones to see it.</p>';
        var who = pick(['Kiko the crab', 'Shelly', 'Lumi']), thing = pick(['shells', 'pearls', 'starfish', 'cookies']);
        var story = m.op === '+' ? who + ' found ' + m.a + ' ' + thing + ', then ' + m.b + ' more. Now there are ' + m.ans + '.' :
          m.op === '−' ? who + ' had ' + m.a + ' ' + thing + ' and gave ' + m.b + ' to a friend. ' + m.ans + ' are left.' :
          m.op === '×' ? who + ' put ' + m.b + ' ' + thing + ' in each of ' + m.a + ' buckets. That\'s ' + m.ans + ' altogether.' :
          who + ' shared ' + m.a + ' ' + thing + ' between ' + m.b + ' friends. Each got ' + m.ans + '.';
        show([['🖼️ As a picture', pic], ['📖 As a story', esc(story)], ['🪜 Step by step', '<ol>' + mathSteps(m.a, m.op, m.b).map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>']]);
        speak(story); return;
      }
      var hit = lookUp(q);
      var offline = function(){
        if(!hit){ out.innerHTML = '<p class="clib-note">I can explain maths like 8 + 5 or a word from your decks without the internet. For other things, try again when Claude is on.</p>'; return; }
        var letters = hit.front.split('').join(' · ');
        show([['🖼️ As a picture', '<p class="clib-huge">' + esc(hit.front) + '</p><p>' + esc(hit.back) + '</p>'],
              ['📖 As a story', esc(hit.note || ('One day, Shelly saw "' + hit.front + '". She asked what it meant. "It means ' + hit.back + '," said Kiko.'))],
              ['🪜 Step by step', '<ol><li>Look at it: ' + esc(letters) + '</li><li>Say it out loud.</li><li>It means: ' + esc(hit.back) + '</li><li>Use it in a sentence of your own!</li></ol>']]);
        speak(hit.front + '. ' + hit.back);
      };
      if(claudeReady()){
        out.innerHTML = '<p class="clib-note">Asking Claude…</p>';
        ask('explain', [{ role: 'user', content: 'Explain "' + q + '" to a young child in three ways. Reply as JSON: {"picture": "a short description of a picture or an emoji drawing", "story": "a 2-3 sentence story", "steps": ["step 1", "step 2", "step 3"]}' }])
          .then(function(t){ var j = jsonFrom(t); if(!j || !j.steps) return offline();
            show([['🖼️ As a picture', esc(j.picture)], ['📖 As a story', esc(j.story)], ['🪜 Step by step', '<ol>' + j.steps.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>']]); speak(j.story); });
      } else offline();
    }
    $('[data-go]', el).addEventListener('click', go2); inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') go2(); });
  } };

  // Teach-back: she explains a card or idea; Shelly checks which key ideas she covered.
  var STOP = /^(the|a|an|and|or|of|to|in|on|is|are|it|that|this|with|for|as|at|by|be|you|your|was|were|from|can|has|have|its|their|they|we|i)$/i;
  function keywords(s){ return (s.toLowerCase().match(/[a-zÀ-ɏ]{3,}|[ㄱ-힝一-鿿]+/g) || []).filter(function(w){ return !STOP.test(w); }); }
  LIB.views.teachback = { title: 'Teach Shelly', render: function(el){
    el.innerHTML = '<p class="clib-lede">Pick something you know, then explain it to Shelly like you\'re the teacher.</p><div class="clib-tb"></div>';
    var box = $('.clib-tb', el);
    allCards().then(function(all){
      var pool = all.filter(function(x){ return x.back.split(' ').length >= 2 || x.note; });
      if(!pool.length) pool = all;
      function next(){
        var c = pick(pool) || { front: 'adding', back: 'putting groups together to find how many altogether', note: '' };
        box.innerHTML = '<section class="clib-card"><h2>Teach Shelly about:</h2><p class="clib-huge">' + esc(c.front) + '</p><textarea class="clib-input" placeholder="Explain it in your own words…"></textarea>' +
          '<div class="clib-row"><button type="button" class="clib-btn main" data-check>Check my teaching</button><button type="button" class="clib-btn" data-skip>Something else</button></div><div class="clib-fb"></div></section>';
        $('[data-skip]', box).addEventListener('click', next);
        $('[data-check]', box).addEventListener('click', function(){
          var said = $('textarea', box).value.trim(), fb = $('.clib-fb', box); if(!said) return;
          var key = keywords(c.back + ' ' + c.note), saidK = keywords(said), got = key.filter(function(k){ return saidK.some(function(s){ return s.indexOf(k.slice(0, 5)) === 0 || k.indexOf(s.slice(0, 5)) === 0; }); });
          var cover = key.length ? got.length / key.length : 0;
          var offline = function(){
            var missing = key.filter(function(k){ return got.indexOf(k) < 0; }).slice(0, 3);
            fb.innerHTML = '<p class="' + (cover >= .5 ? 'clib-good' : '') + '">' + (cover >= .7 ? '🌟 Brilliant teaching! You covered the big ideas.' : cover >= .4 ? '👍 Good start! You got some of it.' : '🤔 Nice try! Let\'s add more.') + '</p>' +
              (missing.length ? '<p>You could also mention: ' + missing.map(esc).join(', ') + '.</p>' : '') + '<p class="clib-note">The card says: ' + esc(c.back) + '</p>';
            speak(fb.textContent);
          };
          log('teach', { item: c.front, cover: Math.round(cover * 100) });
          if(claudeReady()){
            fb.textContent = 'Shelly is listening…';
            ask('feedback', [{ role: 'user', content: 'A child is teaching you about "' + c.front + '" (the correct meaning is: "' + c.back + (c.note ? '; ' + c.note : '') + '"). Here is her explanation: "' + said + '". In 2-3 short, kind sentences: say what she got right, then ask one question about a gap.' }])
              .then(function(t){ if(t){ fb.innerHTML = '<p>' + esc(t) + '</p>'; speak(t); } else offline(); });
          } else offline();
        });
      }
      next();
    });
  } };

  /* =====================================================================================================
     WORKSHEETS. A worksheet is { title, level, sections: [{ kind, title, items }] }. Kinds: short (question and
     answer), mc (choose one), match (pairs), cloze (fill the gap), math (sums with worked steps), order (put in
     order), label (label a diagram), trace (handwriting). Built offline from her decks and built-in material;
     with Claude on, "a topic" and "a photo" are written by Claude in the same shape. Answer on screen and check,
     or print / save as PDF with an answer key.
     ===================================================================================================== */
  var LEVELS = { easy: { n: 6, label: 'Easy' }, medium: { n: 10, label: 'Medium' }, stretch: { n: 14, label: 'Stretch' } };
  var KINDS_HOME = [
    { e: '🗂️', name: 'From a deck', note: 'Match, fill in, answer', src: 'deck' },
    { e: '➕', name: 'Maths', note: 'Sums at her level', src: 'math' },
    { e: '🔎', name: 'A topic', note: 'Any subject', src: 'topic' },
    { e: '🔁', name: 'Spiral review', note: 'Mix of older things', src: 'spiral' },
    { e: '🐢', name: 'Word problems', note: 'About things she loves', src: 'word' },
    { e: '✏️', name: 'Fill the gaps', note: 'Sentences with blanks', src: 'cloze' },
    { e: '✍️', name: 'Handwriting', note: 'Trace and copy', src: 'trace' },
    { e: '🔢', name: 'Put in order', note: 'Life cycles, steps', src: 'order' },
    { e: '🐠', name: 'Label a diagram', note: 'Fish, turtle, plant', src: 'label' },
    { e: '📷', name: 'From a photo', note: 'A textbook page (needs Claude)', src: 'photo' }
  ];
  LIB.views.wsHome = { title: 'Worksheets', render: function(el){
    el.innerHTML = '<p class="clib-lede">Make a worksheet, do it here, or print it.</p>' + tiles(KINDS_HOME.map(function(k){ return { e: k.e, name: k.name, note: k.note, view: 'wsMake', arg: JSON.stringify({ src: k.src }) }; })) +
      '<section class="clib-card"><h2>📂 Recent worksheets</h2><div class="clib-recent"></div></section>';
    wireTiles(el);
    var r = rec(), list = (r.worksheets || []).slice(-8).reverse(), box = $('.clib-recent', el);
    box.innerHTML = list.length ? '<ul class="clib-list">' + list.map(function(w, i){ return '<li><span class="clib-li-t">' + esc(w.title) + '<small>' + esc(LEVELS[w.level] ? LEVELS[w.level].label : '') + (w.score != null ? ' · ' + w.score + '%' : '') + '</small></span><button type="button" class="clib-btn" data-open="' + (list.length - 1 - i) + '">Open</button></li>'; }).join('') + '</ul>' : '<p class="clib-note">None yet.</p>';
    $$('[data-open]', box).forEach(function(b){ b.addEventListener('click', function(){ var all = rec().worksheets || []; go('wsShow', JSON.stringify(all[all.length - 8 + +b.dataset.open] || all[+b.dataset.open])); }); });
  } };

  LIB.views.wsMake = { title: 'Make a worksheet', render: function(el, arg){
    var o = arg ? JSON.parse(arg) : { src: 'deck' }, ds = goalFirst(decks());
    var k = KINDS_HOME.find(function(x){ return x.src === o.src; }) || KINDS_HOME[0];
    this.title = k.e + ' ' + k.name;
    var html = '<section class="clib-card">';
    if(o.src === 'deck' || o.src === 'cloze' || (o.src === 'trace')){
      html += '<label class="clib-label" for="wsDeck">' + (o.src === 'trace' ? 'What to write' : 'Deck') + '</label><select id="wsDeck" class="clib-input">' +
        (o.src === 'trace' ? '<option value="abc">Lowercase letters a–z</option><option value="ABC">Capital letters A–Z</option><option value="123">Numbers 0–20</option><option value="hangul">Hangul letters</option><option value="hanzi">Simple Chinese characters</option>' : '') +
        ds.map(function(d){ return '<option value="deck:' + esc(d.id) + '"' + (o.deck === d.id ? ' selected' : '') + '>' + esc(d.emoji + ' ' + d.name) + '</option>'; }).join('') + '</select>';
    }
    if(o.src === 'math'){
      html += '<label class="clib-label" for="wsTopic">Kind of sums</label><select id="wsTopic" class="clib-input">' +
        [['add', 'Adding'], ['sub', 'Taking away'], ['mul', 'Times tables'], ['div', 'Sharing (dividing)'], ['missing', 'Missing numbers'], ['mixed', 'A mix'], ['place', 'Tens and ones'], ['money', 'Money'], ['time', 'Telling the time']].map(function(t){ return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select>';
    }
    if(o.src === 'topic') html += '<label class="clib-label" for="wsText">Topic</label><input id="wsText" class="clib-input" placeholder="Like: ocean animals, fractions, Korean family words">';
    if(o.src === 'order') html += '<label class="clib-label" for="wsTopic">Sequence</label><select id="wsTopic" class="clib-input">' + Object.keys(SEQUENCES).map(function(k2){ return '<option value="' + k2 + '">' + esc(SEQUENCES[k2].title) + '</option>'; }).join('') + '<option value="numbers">Numbers in order</option></select>';
    if(o.src === 'label') html += '<label class="clib-label" for="wsTopic">Diagram</label><select id="wsTopic" class="clib-input">' + Object.keys(DIAGRAMS).map(function(k2){ return '<option value="' + k2 + '">' + esc(DIAGRAMS[k2].title) + '</option>'; }).join('') + '</select>';
    if(o.src === 'photo') html += claudeReady() ? '<label class="clib-label" for="wsPhoto">Photo of a page</label><input id="wsPhoto" class="clib-input" type="file" accept="image/*" capture="environment">' : '<p class="clib-note">Making a worksheet from a photo needs Claude, which needs the internet and the Claude helper (Settings). Every other kind works offline.</p>';
    if(o.src !== 'photo' || claudeReady()) html += '<label class="clib-label">Level</label><div class="clib-row" role="group" aria-label="Level">' + Object.keys(LEVELS).map(function(l, i){ return '<button type="button" class="clib-btn" data-level="' + l + '" aria-pressed="' + (i === 1) + '">' + LEVELS[l].label + '</button>'; }).join('') + '</div>' +
      '<div class="clib-row"><button type="button" class="clib-btn main" data-make>Make it</button></div><p class="clib-msg" aria-live="polite"></p>';
    el.innerHTML = html + '</section>';
    if(o.script && $('#wsDeck', el)) $('#wsDeck', el).value = o.script;   // handwriting: the letters the home page picked
    var level = 'medium';
    $$('[data-level]', el).forEach(function(b){ b.addEventListener('click', function(){ level = b.dataset.level; $$('[data-level]', el).forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); }); });
    var mk = $('[data-make]', el); if(!mk) return;
    mk.addEventListener('click', function(){
      var msg = $('.clib-msg', el); msg.textContent = 'Making it…'; mk.disabled = true;
      var sel = $('#wsDeck', el), top = $('#wsTopic', el), txt = $('#wsText', el), ph = $('#wsPhoto', el);
      var deckId = sel && /^deck:/.test(sel.value) ? sel.value.slice(5) : null;
      makeWorksheet({ src: o.src, level: level, deck: deckId, script: sel && !deckId ? sel.value : null, topic: top ? top.value : txt ? txt.value.trim() : '', file: ph && ph.files[0] })
        .then(function(ws){ mk.disabled = false; if(!ws){ msg.textContent = LIB.wsError || 'Couldn\'t make that one. Try another choice.'; return; } go('wsShow', JSON.stringify(ws)); })
        .catch(function(e){ mk.disabled = false; msg.textContent = 'Something went wrong: ' + e.message; });
    });
  } };

  function makeWorksheet(o){
    LIB.wsError = null;
    var n = LEVELS[o.level].n, deckName = function(id){ var d = decks().find(function(x){ return x.id === id; }); return d ? d.name : 'Deck'; };
    if(o.src === 'math') return Promise.resolve(wsMath(o.topic || 'mixed', o.level, n));
    if(o.src === 'word') return Promise.resolve(wsWord(o.level, Math.round(n * .7)));
    if(o.src === 'order') return Promise.resolve(wsOrder(o.topic, o.level));
    if(o.src === 'label') return Promise.resolve(wsLabel(o.topic, o.level));
    if(o.src === 'trace'){
      if(o.deck) return cards(o.deck).then(function(cs){ return wsTrace(cs.map(function(c){ return plain(c.front); }).filter(function(f){ return f && f.length <= 8; }), deckName(o.deck), o.level); });
      return Promise.resolve(wsTrace(SCRIPTS[o.script] || SCRIPTS.abc, ({ abc: 'Lowercase letters', ABC: 'Capital letters', '123': 'Numbers', hangul: 'Hangul letters', hanzi: 'Chinese characters' })[o.script] || 'Letters', o.level));
    }
    if(o.src === 'deck' || o.src === 'cloze'){
      if(!o.deck){ LIB.wsError = 'Pick a deck first.'; return Promise.resolve(null); }
      return cards(o.deck).then(function(cs){ return o.src === 'cloze' ? wsCloze(cs, deckName(o.deck), o.level, n) : wsDeck(cs, deckName(o.deck), o.level, n); });
    }
    if(o.src === 'spiral') return wsSpiral(o.level, n);
    if(o.src === 'topic') return wsTopic(o.topic, o.level, n);
    if(o.src === 'photo') return wsPhoto(o.file, o.level);
    return Promise.resolve(null);
  }

  // From a deck: match some pairs, then answer some fronts, with a word bank at the easy level.
  function wsDeck(cs, name, level, n){
    var items = cs.map(function(c){ return { f: plain(c.front), b: plain(c.back), st: cardStateOf(c), lapses: c.lapses || 0 }; }).filter(function(x){ return x.f && x.b && x.f.length < 60 && x.b.length < 80; });
    if(items.length < 3){ LIB.wsError = 'That deck needs at least 3 cards with short fronts and backs.'; return null; }
    var order = level === 'easy' ? items.sort(function(a, b){ return (b.st !== 'new') - (a.st !== 'new'); }) : level === 'stretch' ? items.sort(function(a, b){ return (b.lapses - a.lapses) || ((a.st === 'new') - (b.st === 'new')) * -1; }) : shuffle(items);
    order = level === 'medium' ? order : shuffle(order.slice(0, Math.max(n * 2, 12)));
    var pairs = order.slice(0, Math.min(level === 'easy' ? 4 : 5, order.length)), rest = order.slice(pairs.length, pairs.length + n - pairs.length);
    var secs = [{ kind: 'match', title: 'Draw a line to match', items: [{ pairs: pairs.map(function(p){ return [p.f, p.b]; }) }] }];
    if(rest.length){
      if(level === 'easy') secs.push({ kind: 'mc', title: 'Circle the right answer', items: rest.map(function(r){ var opts = shuffle([r.b].concat(shuffle(items.filter(function(x){ return x.b !== r.b; })).slice(0, 2).map(function(x){ return x.b; }))); return { q: r.f, options: opts, a: r.b }; }) });
      else secs.push({ kind: 'short', title: 'Write what it means', bank: level === 'medium' ? shuffle(rest.map(function(r){ return r.b; })) : null, items: rest.map(function(r){ return { q: r.f, a: r.b }; }) });
    }
    return { title: name, level: level, sections: secs };
  }
  // Fill the gaps: sentences from a deck's notes and backs, with the card's word (or a key word) blanked out.
  function wsCloze(cs, name, level, n){
    var out = [];
    cs.forEach(function(c){
      var f = plain(c.front), sentences = (plain(c.note) + ' ' + plain(c.back)).replace(/([.!?。])\s+/g, '$1\n').split('\n').filter(function(s){ return s.split(/\s+/).length >= 4; });
      sentences.forEach(function(s){
        var target = f && s.toLowerCase().indexOf(f.toLowerCase()) >= 0 ? f : null;
        if(!target){ var ws = s.split(/\s+/).map(function(w){ return w.replace(/[^\wÀ-ɏㄱ-힝一-鿿'-]/g, ''); }).filter(function(w){ return w.length >= 5 && !STOP.test(w); }); target = ws.length ? pick(ws) : null; }
        if(target) out.push({ text: s.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____'), a: target });
      });
    });
    out = shuffle(out).slice(0, n);
    if(out.length < 2){ LIB.wsError = 'That deck doesn\'t have enough sentences to blank out. Try a story or vocabulary deck with notes.'; return null; }
    return { title: name + ': fill the gaps', level: level, sections: [{ kind: 'cloze', title: 'Fill in the missing word', bank: level !== 'stretch' ? shuffle(out.map(function(x){ return x.a; })) : null, items: out }] };
  }
  // Maths sums at three levels; every answer keeps its worked steps for checking.
  function wsMath(topic, level, n){
    var L = { easy: 0, medium: 1, stretch: 2 }[level], items = [], title = ({ add: 'Adding', sub: 'Taking away', mul: 'Times tables', div: 'Sharing', missing: 'Missing numbers', mixed: 'Maths mix', place: 'Tens and ones', money: 'Money', time: 'Telling the time' })[topic] || 'Maths';
    function sum(op){
      var a, b;
      if(op === '+'){ var max = [10, 20, 100][L]; a = 1 + rnd(max - 1); b = 1 + rnd(Math.max(1, max - a)); }
      if(op === '−'){ var mx = [10, 20, 100][L]; a = 2 + rnd(mx - 1); b = 1 + rnd(a - 1); }
      if(op === '×'){ var tab = [[2, 5, 10], [2, 3, 4, 5, 10], [3, 4, 6, 7, 8, 9]][L]; a = pick(tab); b = 1 + rnd([10, 10, 12][L]); }
      if(op === '÷'){ var tb = [[2, 5, 10], [2, 3, 4, 5], [3, 4, 6, 7, 8, 9]][L]; b = pick(tb); var q = 1 + rnd(10); a = b * q; }
      return { q: a + ' ' + op + ' ' + b + ' =', a: String(mathCalc(a, op, b)), steps: mathSteps(a, op, b), m: { a: a, op: op, b: b } };
    }
    var seen = {}, tries = 0;
    while(items.length < n){   // no repeated questions on one sheet (gives up after a few tries on tiny ranges)
      var before = items.length;
      if(topic === 'add') items.push(sum('+'));
      else if(topic === 'sub') items.push(sum('−'));
      else if(topic === 'mul') items.push(sum('×'));
      else if(topic === 'div') items.push(sum('÷'));
      else if(topic === 'mixed') items.push(sum(pick(L === 0 ? ['+', '−'] : ['+', '−', '×', '÷'])));
      else if(topic === 'missing'){ var s2 = sum(pick(L === 2 ? ['+', '−', '×'] : ['+', '−'])); var p = s2.q.split(' '); var hideA = Math.random() < .5;
        items.push({ q: (hideA ? '☐' : p[0]) + ' ' + p[1] + ' ' + (hideA ? p[2] : '☐') + ' = ' + s2.a, a: hideA ? p[0] : p[2], steps: ['Think: what number makes this true?', 'Check: ' + p[0] + ' ' + p[1] + ' ' + p[2] + ' = ' + s2.a + '.'] }); }
      else if(topic === 'place'){ var v = [10 + rnd(90), 10 + rnd(90), 100 + rnd(900)][L], t = Math.floor(v / 10) % 10, o = v % 10, h = Math.floor(v / 100);
        items.push(L === 2 ? { q: v + ' = ☐ hundreds, ☐ tens, ☐ ones', a: h + ', ' + t + ', ' + o, steps: [v + ' has ' + h + ' hundreds, ' + t + ' tens and ' + o + ' ones.'] } : { q: v + ' = ☐ tens and ☐ ones', a: t + ', ' + o, steps: [v + ' is ' + t + ' tens (' + (t * 10) + ') and ' + o + ' ones.'] }); }
      else if(topic === 'money'){ var coins = shuffle([[1, 5, 10], [1, 5, 10, 25], [5, 10, 25, 50, 100]][L]).concat([1, 5, 10]); var take = coins.slice(0, 2 + rnd(L + 2)), tot = take.reduce(function(x, y){ return x + y; }, 0);
        items.push({ q: take.map(function(c){ return c >= 100 ? '$' + (c / 100) : c + '¢'; }).join(' + ') + ' = ☐¢', a: String(tot), steps: ['Start with the biggest coin and add on: ' + take.slice().sort(function(x, y){ return y - x; }).join(' + ') + ' = ' + tot + '¢.'] }); }
      else if(topic === 'time'){ var hr = 1 + rnd(12), mn = [[0], [0, 30], [0, 15, 30, 45, 5, 10, 20, 25, 35, 40, 50, 55]][L]; var mm = pick(mn);
        items.push({ q: 'clock:' + hr + ':' + mm, a: hr + ':' + String(mm).padStart(2, '0'), steps: ['The short hand points to the hour (' + hr + ').', 'The long hand shows the minutes: ' + mm + ' minutes.'] }); }
      if(items.length === before) break;
      var last = items[items.length - 1];
      if(seen[last.q] && tries++ < 80) items.pop(); else seen[last.q] = 1;
    }
    return { title: title, level: level, sections: [{ kind: 'math', title: topic === 'time' ? 'What time is it?' : 'Work it out', items: items }] };
  }
  // Word problems about the things she likes (from Settings), with names she knows.
  function wsWord(level, n){
    var likes = settings().interests && settings().interests.length ? settings().interests : ['sea turtles', 'crabs', 'cookies', 'soccer balls'];
    var names = ['Shelly', 'Kiko', 'Lumi', 'Mochi', 'Grandma', 'a friend'], L = { easy: 0, medium: 1, stretch: 2 }[level], items = [];
    for(var i = 0; i < n; i++){
      var t = pick(likes), who = pick(names), op = pick(L === 0 ? ['+', '−'] : L === 1 ? ['+', '−', '×'] : ['+', '−', '×', '÷']), a, b, q;
      if(op === '+'){ a = 2 + rnd([8, 30, 80][L]); b = 1 + rnd([8, 20, 60][L]); q = who + ' has ' + a + ' ' + t + '. Then ' + who + ' gets ' + b + ' more. How many ' + t + ' now?'; }
      if(op === '−'){ a = 5 + rnd([8, 30, 90][L]); b = 1 + rnd(a - 2); q = 'There are ' + a + ' ' + t + '. ' + b + ' go away. How many ' + t + ' are left?'; }
      if(op === '×'){ a = 2 + rnd([3, 5, 8][L]); b = 2 + rnd([4, 5, 10][L]); q = who + ' has ' + a + ' bags with ' + b + ' ' + t + ' in each. How many ' + t + ' altogether?'; }
      if(op === '÷'){ b = 2 + rnd(5); var qq = 2 + rnd(8); a = b * qq; q = a + ' ' + t + ' are shared equally between ' + b + ' friends. How many does each friend get?'; }
      items.push({ q: q, a: String(mathCalc(a, op, b)), steps: ['Write it as a sum: ' + a + ' ' + op + ' ' + b + '.'].concat(mathSteps(a, op, b)), m: { a: a, op: op, b: b } });
    }
    return { title: 'Word problems', level: level, sections: [{ kind: 'math', title: 'Read, think, solve', items: items }] };
  }
  // Spiral review: cards she learned a while ago (soonest due first) from several decks, plus a few sums.
  function wsSpiral(level, n){
    return allCards().then(function(all){
      var learned = all.filter(function(x){ return x.card.interval > 0 && x.front && x.back && x.front.length < 60 && x.back.length < 80; })
        .sort(function(a, b){ return (a.card.due || 0) - (b.card.due || 0); });
      var byDeck = {}, picked = [];
      learned.forEach(function(x){ (byDeck[x.deck.id] = byDeck[x.deck.id] || []).push(x); });
      var keys = Object.keys(byDeck); for(var r = 0; picked.length < Math.ceil(n * .7) && r < 20; r++) keys.forEach(function(k){ if(byDeck[k][r] && picked.length < Math.ceil(n * .7)) picked.push(byDeck[k][r]); });
      if(!picked.length){ LIB.wsError = 'Spiral review needs cards she has already practised. Try again after a few rounds.'; return null; }
      var math = wsMath('mixed', level, Math.max(2, n - picked.length)).sections[0];
      return { title: 'Spiral review', level: level, sections: [
        { kind: 'short', title: 'Remember these?', bank: level === 'easy' ? shuffle(picked.map(function(x){ return x.back; })) : null, items: picked.map(function(x){ return { q: x.front, a: x.back, from: x.deck.name }; }) },
        { kind: 'math', title: 'And some maths', items: math.items } ] };
    });
  }
  // A topic: her decks first (deck names, subjects and card text), then built-in facts and maths; Claude when on.
  function wsTopic(topic, level, n){
    if(!topic){ LIB.wsError = 'Type a topic first.'; return Promise.resolve(null); }
    var t = topic.toLowerCase(), mathT = /add|plus|sum/.test(t) ? 'add' : /take|subtract|minus/.test(t) ? 'sub' : /times|multipl/.test(t) ? 'mul' : /divid|shar/.test(t) ? 'div' : /money|coin/.test(t) ? 'money' : /time|clock/.test(t) ? 'time' : /place|tens/.test(t) ? 'place' : /math/.test(t) ? 'mixed' : null;
    var offline = function(){
      if(mathT) return wsMath(mathT, level, n);
      return allCards().then(function(all){
        var words = keywords(topic);
        var hits = all.filter(function(x){ var hay = (x.deck.name + ' ' + x.deck.subject + ' ' + x.front + ' ' + x.back + ' ' + x.note).toLowerCase(); return words.some(function(w){ return hay.indexOf(w) >= 0; }); });
        if(hits.length >= 3){ var ws = wsDeck(hits.map(function(h){ return h.card; }), topic, level, n); if(ws) ws.title = 'Topic: ' + topic; return ws; }
        var seq = Object.keys(SEQUENCES).find(function(k){ return words.some(function(w){ return (SEQUENCES[k].title + ' ' + k).toLowerCase().indexOf(w) >= 0; }); });
        if(seq) return wsOrder(seq, level);
        var dia = Object.keys(DIAGRAMS).find(function(k){ return words.some(function(w){ return k.indexOf(w) >= 0 || DIAGRAMS[k].title.toLowerCase().indexOf(w) >= 0; }); });
        if(dia) return wsLabel(dia, level);
        LIB.wsError = 'Nothing about "' + topic + '" in her decks yet. With the internet and the Claude helper, Claude can write one about any topic.'; return null;
      });
    };
    if(!claudeReady() || mathT) return Promise.resolve(offline());
    return ask('worksheet', [{ role: 'user', content: WS_PROMPT(level, n) + '\nTopic: ' + topic }]).then(function(txt){ var ws = validWs(jsonFrom(txt), level); return ws || offline(); });
  }
  function wsPhoto(file, level){
    if(!file){ LIB.wsError = 'Take or choose a photo first.'; return Promise.resolve(null); }
    return shrinkImage(file, 1400).then(function(img){
      return ask('photo', [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } }, { type: 'text', text: WS_PROMPT(level, LEVELS[level].n) + '\nBase the worksheet on the page in this photo.' }] }]);
    }).then(function(txt){ var ws = validWs(jsonFrom(txt), level); if(!ws) LIB.wsError = txt === null ? 'Claude couldn\'t be reached. Check the internet and the Claude helper in Settings.' : 'Claude\'s worksheet didn\'t come back in a shape I can use. Try another photo.'; return ws; });
  }
  function WS_PROMPT(level, n){
    return 'Write a ' + level + ' level worksheet for a young learner with about ' + n + ' items. Reply with JSON only, in this shape: ' +
      '{"title": "...", "sections": [{"kind": "short" | "mc" | "cloze" | "match", "title": "instruction", "items": [...]}]}. ' +
      'Items: short {"q": "...", "a": "..."}; mc {"q": "...", "options": ["...", "...", "..."], "a": "one of the options"}; cloze {"text": "sentence with _____", "a": "missing word"}; match {"pairs": [["left", "right"], ...]}. Keep answers short.';
  }
  function validWs(j, level){
    if(!j || !Array.isArray(j.sections)) return null;
    var ok = j.sections.filter(function(s){ return s && ['short', 'mc', 'cloze', 'match'].indexOf(s.kind) >= 0 && Array.isArray(s.items) && s.items.length; }).map(function(s){
      return { kind: s.kind, title: String(s.title || ''), items: s.items.slice(0, 20).map(function(it){
        if(s.kind === 'match') return { pairs: (it.pairs || []).slice(0, 8).map(function(p){ return [String(p[0]), String(p[1])]; }) };
        if(s.kind === 'mc') return { q: String(it.q), options: (it.options || []).map(String).slice(0, 5), a: String(it.a) };
        if(s.kind === 'cloze') return { text: String(it.text), a: String(it.a) };
        return { q: String(it.q), a: String(it.a) };
      }) };
    });
    return ok.length ? { title: String(j.title || 'Worksheet'), level: level, sections: ok, by: 'claude' } : null;
  }
  function shrinkImage(file, max){
    return new Promise(function(res, rej){
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){ var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res({ type: 'image/jpeg', data: c.toDataURL('image/jpeg', .85).split(',')[1] }); };
      img.onerror = function(){ rej(new Error('That file isn\'t a picture I can read.')); }; img.src = url;
    });
  }
  // Handwriting: model, faint copies to trace, then space to write it alone.
  var SCRIPTS = { abc: 'abcdefghijklmnopqrstuvwxyz'.split(''), ABC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '123': '0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20'.split(' '),
    hangul: 'ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ'.split(' '), hanzi: '一 二 三 人 大 小 口 日 月 山 水 火 木 中 上 下'.split(' ') };
  function wsTrace(list, name, level){
    var n = { easy: 6, medium: 10, stretch: 14 }[level], chosen = list.length > n ? list.slice(0, n) : list;
    if(!chosen.length){ LIB.wsError = 'Nothing short enough to trace in that deck. Try letters or numbers.'; return null; }
    return { title: 'Handwriting: ' + name, level: level, sections: [{ kind: 'trace', title: 'Trace the grey ones, then write your own', items: chosen.map(function(c){ return { c: c, copies: level === 'easy' ? 4 : level === 'medium' ? 3 : 1 }; }) }] };
  }
  // Put in order: life cycles, routines and number sequences.
  var SEQUENCES = {
    turtle: { title: 'Life of a sea turtle', steps: ['A mother turtle lays eggs in the sand', 'The eggs hatch', 'The babies race to the sea', 'The young turtle grows in the ocean', 'It grows into an adult', 'It comes back to the beach to lay eggs'] },
    frog: { title: 'Life of a frog', steps: ['Frogspawn (eggs) in the pond', 'A tadpole hatches', 'The tadpole grows back legs', 'It grows front legs', 'The tail gets shorter', 'An adult frog'] },
    butterfly: { title: 'Life of a butterfly', steps: ['An egg on a leaf', 'A caterpillar hatches', 'The caterpillar eats and grows', 'It makes a chrysalis', 'A butterfly comes out'] },
    plant: { title: 'How a plant grows', steps: ['Plant a seed', 'Water it', 'Roots grow down', 'A shoot pokes up', 'Leaves grow', 'A flower opens'] },
    water: { title: 'The water cycle', steps: ['The sun warms the sea', 'Water rises as vapour', 'Clouds form', 'Rain falls', 'Rivers carry water back to the sea'] },
    cookies: { title: 'Baking cookies', steps: ['Wash your hands', 'Mix the butter and sugar', 'Add the flour', 'Roll into balls', 'Bake in the oven', 'Let them cool and eat'] },
    morning: { title: 'A morning routine', steps: ['Wake up', 'Brush your teeth', 'Get dressed', 'Eat breakfast', 'Put on your shoes', 'Go to school'] },
    days: { title: 'Days of the week', steps: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    months: { title: 'Months of the year', steps: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] }
  };
  function wsOrder(id, level){
    var items = [];
    if(id === 'numbers'){ var L = { easy: 0, medium: 1, stretch: 2 }[level]; for(var i = 0; i < 3; i++){ var start = rnd([10, 50, 500][L]), step = [1, 2, 10][L] * (1 + rnd(L + 1)); items.push({ steps: range(0, 5).map(function(k){ return String(start + k * step); }) }); } return { title: 'Numbers in order', level: level, sections: [{ kind: 'order', title: 'Number them from smallest to biggest', items: items }] }; }
    var s = SEQUENCES[id] || SEQUENCES.turtle, steps = level === 'easy' ? s.steps.slice(0, Math.min(4, s.steps.length)) : s.steps;
    return { title: s.title, level: level, sections: [{ kind: 'order', title: 'Number the steps in order', items: [{ steps: steps }] }] };
  }
  // Label a diagram: a simple drawing with numbered pointers and a word bank.
  var DIAGRAMS = {
    fish: { title: 'Parts of a fish', svg: '<ellipse cx="150" cy="100" rx="90" ry="50" fill="#ffb25c" stroke="#8a4b12" stroke-width="3"/><path d="M60 100 L10 60 L20 100 L10 140 Z" fill="#ff8a3d" stroke="#8a4b12" stroke-width="3"/><path d="M140 52 Q160 15 190 55" fill="#ff8a3d" stroke="#8a4b12" stroke-width="3"/><path d="M150 140 Q165 170 185 140" fill="#ff8a3d" stroke="#8a4b12" stroke-width="3"/><circle cx="205" cy="88" r="9" fill="#fff" stroke="#333" stroke-width="2"/><circle cx="207" cy="88" r="4" fill="#222"/><path d="M178 75 Q170 100 178 125" fill="none" stroke="#8a4b12" stroke-width="3"/><path d="M232 100 Q240 104 232 110" fill="none" stroke="#8a4b12" stroke-width="3"/>',
      parts: [['tail', 18, 100], ['fin', 165, 30], ['eye', 207, 88], ['gills', 175, 100], ['mouth', 238, 104], ['scales', 120, 105]] },
    turtle: { title: 'Parts of a sea turtle', svg: '<ellipse cx="150" cy="100" rx="80" ry="55" fill="#4fa36a" stroke="#2c5a3a" stroke-width="3"/><path d="M110 70 L150 55 L190 70 L190 130 L150 145 L110 130 Z" fill="none" stroke="#2c5a3a" stroke-width="2"/><ellipse cx="248" cy="100" rx="28" ry="20" fill="#9ad38f" stroke="#2c5a3a" stroke-width="3"/><circle cx="258" cy="94" r="4" fill="#222"/><ellipse cx="200" cy="45" rx="35" ry="12" fill="#9ad38f" stroke="#2c5a3a" stroke-width="3" transform="rotate(-25 200 45)"/><ellipse cx="200" cy="155" rx="35" ry="12" fill="#9ad38f" stroke="#2c5a3a" stroke-width="3" transform="rotate(25 200 155)"/><path d="M70 100 L45 95 L50 108 Z" fill="#9ad38f" stroke="#2c5a3a" stroke-width="3"/>',
      parts: [['shell', 150, 100], ['head', 248, 104], ['flipper', 205, 40], ['eye', 258, 94], ['tail', 50, 100]] },
    plant: { title: 'Parts of a plant', svg: '<line x1="150" y1="60" x2="150" y2="160" stroke="#3f8a3a" stroke-width="6"/><circle cx="150" cy="50" r="18" fill="#ffd23f" stroke="#a87d10" stroke-width="3"/><g fill="#ff7aa8" stroke="#a83a5a" stroke-width="2"><circle cx="150" cy="22" r="12"/><circle cx="178" cy="50" r="12"/><circle cx="150" cy="78" r="12"/><circle cx="122" cy="50" r="12"/></g><circle cx="150" cy="50" r="12" fill="#ffd23f"/><path d="M150 120 Q190 95 205 120 Q180 135 150 120" fill="#5cbf5a" stroke="#2c6a2c" stroke-width="2"/><path d="M150 140 Q110 115 95 140 Q120 155 150 140" fill="#5cbf5a" stroke="#2c6a2c" stroke-width="2"/><rect x="60" y="160" width="180" height="10" fill="#8a5a3a"/><path d="M150 170 L130 195 M150 170 L170 198 M150 170 L150 200 M140 182 L120 188" stroke="#a87650" stroke-width="3" fill="none"/>',
      parts: [['flower', 150, 22], ['petal', 178, 50], ['stem', 150, 100], ['leaf', 190, 115], ['roots', 150, 195]] },
    body: { title: 'Parts of the body', svg: '<circle cx="150" cy="40" r="25" fill="#f7d1b5" stroke="#8a5a3a" stroke-width="3"/><rect x="125" y="68" width="50" height="70" rx="12" fill="#7fb0ff" stroke="#3a5a9a" stroke-width="3"/><line x1="125" y1="80" x2="90" y2="125" stroke="#f7d1b5" stroke-width="10" stroke-linecap="round"/><line x1="175" y1="80" x2="210" y2="125" stroke="#f7d1b5" stroke-width="10" stroke-linecap="round"/><line x1="140" y1="138" x2="135" y2="190" stroke="#3a5a9a" stroke-width="12" stroke-linecap="round"/><line x1="160" y1="138" x2="165" y2="190" stroke="#3a5a9a" stroke-width="12" stroke-linecap="round"/>',
      parts: [['head', 150, 40], ['arm', 95, 118], ['hand', 210, 128], ['leg', 135, 175], ['foot', 167, 195], ['tummy', 150, 110]] }
  };
  function wsLabel(id, level){
    var d = DIAGRAMS[id] || DIAGRAMS.fish, parts = level === 'easy' ? d.parts.slice(0, 4) : d.parts;
    return { title: d.title, level: level, sections: [{ kind: 'label', title: 'Write the name of each numbered part', bank: level !== 'stretch' ? shuffle(parts.map(function(p){ return p[0]; })) : null, items: [{ diagram: id, parts: parts }] }] };
  }

  /* ---- showing a worksheet: answer here, check, explain, print ---- */
  function norm(s){ return String(s).toLowerCase().replace(/[\s.,!?'"()]/g, '').replace(/^(a|an|the)(?=\w)/, ''); }
  function answerClose(a, b){ a = norm(a); b = norm(b); if(!a) return false; if(a === b) return true; if(b.length > 4 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) && a.length >= b.length * .6) return true; return lev(a, b) <= (b.length > 6 ? 2 : b.length > 3 ? 1 : 0); }
  function lev(a, b){ var m = [], i, j; for(i = 0; i <= b.length; i++) m[i] = [i]; for(j = 0; j <= a.length; j++) m[0][j] = j; for(i = 1; i <= b.length; i++) for(j = 1; j <= a.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)); return m[b.length][a.length]; }
  function clockSVG(h, m){ var ha = ((h % 12) + m / 60) * 30 * Math.PI / 180, ma = m * 6 * Math.PI / 180;
    return '<svg class="clib-clock" viewBox="-50 -50 100 100" width="96" height="96" aria-label="A clock"><circle r="46" fill="#fff" stroke="#21363a" stroke-width="3"/>' + range(1, 12).map(function(k){ var a = k * 30 * Math.PI / 180; return '<text x="' + (Math.sin(a) * 36).toFixed(1) + '" y="' + (-Math.cos(a) * 36 + 4).toFixed(1) + '" font-size="10" text-anchor="middle" fill="#21363a">' + k + '</text>'; }).join('') +
      '<line x2="' + (Math.sin(ha) * 22).toFixed(1) + '" y2="' + (-Math.cos(ha) * 22).toFixed(1) + '" stroke="#21363a" stroke-width="4" stroke-linecap="round"/><line x2="' + (Math.sin(ma) * 34).toFixed(1) + '" y2="' + (-Math.cos(ma) * 34).toFixed(1) + '" stroke="#1c8c93" stroke-width="3" stroke-linecap="round"/><circle r="3" fill="#21363a"/></svg>'; }
  function qHTML(q){ var m = /^clock:(\d+):(\d+)$/.exec(q); return m ? clockSVG(+m[1], +m[2]) : esc(q); }
  function sectionHTML(s, si, key){
    var h = '<section class="clib-ws-sec"><h2>' + (si + 1) + '. ' + esc(s.title) + '</h2>' + (s.bank ? '<p class="clib-bank">Word bank: ' + s.bank.map(esc).join(' · ') + '</p>' : '');
    if(s.kind === 'match') s.items.forEach(function(it, ii){ var rights = shuffle(it.pairs.map(function(p){ return p[1]; }));
      h += '<div class="clib-match">' + it.pairs.map(function(p, pi){ return '<div class="clib-mrow"><span>' + esc(p[0]) + '</span><select class="clib-input" data-a="' + esc(p[1]) + '" aria-label="Match for ' + esc(p[0]) + '"><option value="">Choose…</option>' + rights.map(function(r){ return '<option>' + esc(r) + '</option>'; }).join('') + '</select>' + (key ? '<b class="clib-key">' + esc(p[1]) + '</b>' : '') + '</div>'; }).join('') + '</div>'; });
    else if(s.kind === 'mc') h += '<ol class="clib-qs">' + s.items.map(function(it, ii){ return '<li data-a="' + esc(it.a) + '"><span>' + esc(it.q) + '</span><div class="clib-opts">' + it.options.map(function(o){ return '<label><input type="radio" name="mc' + si + '_' + ii + '" value="' + esc(o) + '"> ' + esc(o) + '</label>'; }).join('') + '</div>' + (key ? '<b class="clib-key">' + esc(it.a) + '</b>' : '') + '</li>'; }).join('') + '</ol>';
    else if(s.kind === 'short' || s.kind === 'math' || s.kind === 'cloze') h += '<ol class="clib-qs">' + s.items.map(function(it, ii){ return '<li data-a="' + esc(it.a) + '"' + (it.m ? ' data-m="' + esc(JSON.stringify(it.m)) + '"' : '') + ' data-steps="' + esc(JSON.stringify(it.steps || [])) + '"><span>' + (s.kind === 'cloze' ? esc(it.text) : qHTML(it.q)) + '</span><input class="clib-input clib-ans" aria-label="Answer ' + (ii + 1) + '" autocomplete="off">' + (key ? '<b class="clib-key">' + esc(it.a) + '</b>' : '') + '<div class="clib-why"></div></li>'; }).join('') + '</ol>';
    else if(s.kind === 'order') s.items.forEach(function(it){ var sh = shuffle(it.steps.map(function(t, k){ return { t: t, k: k + 1 }; }));
      h += '<ol class="clib-qs clib-order">' + sh.map(function(x){ return '<li data-a="' + x.k + '"><input class="clib-input clib-ans clib-num" inputmode="numeric" maxlength="2" aria-label="Position of ' + esc(x.t) + '"><span>' + esc(x.t) + '</span>' + (key ? '<b class="clib-key">' + x.k + '</b>' : '') + '<div class="clib-why"></div></li>'; }).join('') + '</ol>'; });
    else if(s.kind === 'label') s.items.forEach(function(it){ var d = DIAGRAMS[it.diagram];
      h += '<svg class="clib-diagram" viewBox="0 0 300 210" role="img" aria-label="' + esc(d.title) + '">' + d.svg + it.parts.map(function(p, k){ return '<g><circle cx="' + p[1] + '" cy="' + p[2] + '" r="10" fill="#1c8c93"/><text x="' + p[1] + '" y="' + (p[2] + 4) + '" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">' + (k + 1) + '</text></g>'; }).join('') + '</svg>' +
        '<ol class="clib-qs">' + it.parts.map(function(p, k){ return '<li data-a="' + esc(p[0]) + '"><span>Part ' + (k + 1) + '</span><input class="clib-input clib-ans" autocomplete="off" aria-label="Name of part ' + (k + 1) + '">' + (key ? '<b class="clib-key">' + esc(p[0]) + '</b>' : '') + '<div class="clib-why"></div></li>'; }).join('') + '</ol>'; });
    else if(s.kind === 'trace') h += '<div class="clib-trace">' + s.items.map(function(it){ return '<div class="clib-trow"><span class="clib-tmodel">' + esc(it.c) + '</span>' + range(1, it.copies).map(function(){ return '<span class="clib-tfaint">' + esc(it.c) + '</span>'; }).join('') + '<span class="clib-tblank"></span><span class="clib-tblank"></span></div>'; }).join('') + '</div>';
    return h + '</section>';
  }
  LIB.views.wsShow = { title: 'Worksheet', render: function(el, arg){
    var ws = JSON.parse(arg); this.title = ws.title;
    var r = rec(); r.worksheets = r.worksheets || []; if(!r.worksheets.some(function(w){ return w.title === ws.title && w.made === ws.made; })){ ws.made = ws.made || Date.now(); r.worksheets.push(ws); r.worksheets = r.worksheets.slice(-20); saveRec(r); }
    var checkable = ws.sections.some(function(s){ return s.kind !== 'trace'; });
    el.innerHTML = '<div class="clib-print-area"><header class="clib-ws-head"><h1>' + esc(ws.title) + '</h1><p>' + esc(LEVELS[ws.level] ? LEVELS[ws.level].label : '') + ' · Name: ____________ · Date: ' + today() + (ws.by === 'claude' ? ' · written with Claude' : '') + '</p></header>' +
      ws.sections.map(function(s, i){ return sectionHTML(s, i, false); }).join('') +
      '<div class="clib-keypage"><h1>Answer key: ' + esc(ws.title) + '</h1>' + ws.sections.map(function(s, i){ return sectionHTML(s, i, true); }).join('') + '</div></div>' +
      '<div class="clib-row clib-noprint">' + (checkable ? '<button type="button" class="clib-btn main" data-check>✅ Check my answers</button>' : '') + '<button type="button" class="clib-btn" data-print>🖨️ Print or save as PDF</button><button type="button" class="clib-btn" data-new>🔄 Make another</button></div><p class="clib-msg clib-noprint" aria-live="polite"></p>';
    $('[data-print]', el).addEventListener('click', function(){ document.body.classList.add('clib-printing'); setTimeout(function(){ try { window.print(); } catch(e){} setTimeout(function(){ document.body.classList.remove('clib-printing'); }, 500); }, 50); });
    $('[data-new]', el).addEventListener('click', back);
    var ck = $('[data-check]', el); if(ck) ck.addEventListener('click', function(){
      var area = $('.clib-print-area', el), right = 0, total = 0, wrongs = [];
      $$('.clib-ws-sec li[data-a]', area).forEach(function(li){
        if(li.closest('.clib-keypage')) return;
        var a = li.dataset.a, inp = li.querySelector('.clib-ans'), radio = li.querySelector('input[type=radio]:checked'), given = inp ? inp.value : radio ? radio.value : '', ok = answerClose(given, a);
        total++; if(ok) right++; li.classList.toggle('ok', ok); li.classList.toggle('no', !ok);
        var why = li.querySelector('.clib-why'); if(!why) return;
        if(ok){ why.innerHTML = ''; return; }
        var steps = JSON.parse(li.dataset.steps || '[]'), m = li.dataset.m ? JSON.parse(li.dataset.m) : null, mis = m && LIB.misconception ? LIB.misconception(m.a, m.op, m.b, given) : null;
        why.innerHTML = '<p class="clib-bad">The answer is ' + esc(a) + '.</p>' + (mis ? '<p>🔎 ' + esc(mis.tip) + '</p>' : '') + (steps.length ? '<ol>' + steps.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '');
        if(m) wrongs.push({ m: m, given: given, mis: mis && mis.id });
      });
      $$('.clib-mrow select', area).forEach(function(sel){ if(sel.closest('.clib-keypage')) return; var ok = answerClose(sel.value, sel.dataset.a); total++; if(ok) right++; sel.parentNode.classList.toggle('ok', ok); sel.parentNode.classList.toggle('no', !ok); });
      var pct = total ? Math.round(right / total * 100) : 0;
      $('.clib-msg', el).textContent = (pct === 100 ? '🌟 All right! ' : pct >= 70 ? '👏 Great work! ' : '💪 Good try! ') + right + ' out of ' + total + '.';
      speak($('.clib-msg', el).textContent);
      log('ws', { title: ws.title, score: pct, n: total });
      wrongs.forEach(function(w){ log('math', { skill: opSkill(w.m.op), ok: false, mis: w.mis, q: w.m.a + w.m.op + w.m.b, given: w.given }); });
      var rr = rec(); var last = (rr.worksheets || []).filter(function(w){ return w.made === ws.made; })[0]; if(last){ last.score = pct; saveRec(rr); }
    });
  } };
  function opSkill(op){ return op === '+' ? 'adding' : op === '−' ? 'taking away' : op === '×' ? 'times tables' : 'sharing'; }
  LIB.opSkill = opSkill; LIB.wsMath = wsMath; LIB.clockSVG = clockSVG; LIB.answerClose = answerClose;

  /* =====================================================================================================
     CHECK MY WORK and MY PROGRESS. Writing feedback uses rubric checks a computer can do (sentences, capitals,
     joining words, describing words, common spellings); with Claude on, Claude reads it against the same
     rubric. Photo marking needs Claude. Progress, mastery, misconceptions, confidence, the placement check
     and the weekly letter are all worked out on the device from her decks and the Library's log.
     ===================================================================================================== */

  /* ---- misconceptions: the usual wrong turns in a sum, worked out from the wrong answer ---- */
  var MIS = {
    'add-sub': 'Look at the sign: + means put together, so the answer gets bigger.',
    'add-mul': 'That\'s times. For + we just put the two numbers together.',
    'add-one': 'So close! Counting on starts with the next number, not the one you\'re on.',
    'add-carry': 'When the ones make 10 or more, a ten moves over to the tens. Don\'t forget it!',
    'sub-add': 'Look at the sign: − means take away, so the answer gets smaller.',
    'sub-flip': 'Careful: in each column we take the bottom digit from the top one. If the top is smaller, swap a ten for ten ones first.',
    'sub-one': 'So close! When you count back, don\'t count the number you start on.',
    'mul-add': 'That\'s adding. × means groups of: ' + 'count the same number again and again.',
    'mul-group': 'One group too many or too few. Count how many groups again.',
    'div-mul': 'That\'s times. ÷ means sharing into equal groups, so the answer gets smaller.',
    'div-sub': 'That\'s taking away. ÷ means sharing into equal groups.',
    'any-swap': 'You swapped the digits around. Read the number slowly: tens first, then ones.'
  };
  var MIS_NAME = { 'add-sub': 'Takes away instead of adding', 'add-mul': 'Times instead of adding', 'add-one': 'Off by one when counting on', 'add-carry': 'Forgets to carry the ten',
    'sub-add': 'Adds instead of taking away', 'sub-flip': 'Takes the smaller digit from the bigger', 'sub-one': 'Off by one when counting back', 'mul-add': 'Adds instead of times',
    'mul-group': 'One group too many or too few', 'div-mul': 'Times instead of sharing', 'div-sub': 'Takes away instead of sharing', 'any-swap': 'Swaps the digits' };
  function digitsNoCarry(a, b){ var r = 0, p = 1; while(a > 0 || b > 0){ r += ((a % 10 + b % 10) % 10) * p; a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10; } return r; }
  function digitsFlip(a, b){ var r = 0, p = 1; while(a > 0 || b > 0){ r += Math.abs(a % 10 - b % 10) * p; a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10; } return r; }
  LIB.misconception = function(a, op, b, given){
    var g = parseFloat(String(given).replace(/[^\d.\-]/g, '')); if(isNaN(g)) return null;
    a = +a; b = +b; var ans = mathCalc(a, op, b); if(g === ans) return null;
    var id = null;
    if(op === '+'){ if(g === Math.abs(a - b)) id = 'add-sub'; else if(g === a * b) id = 'add-mul'; else if(a + b >= 10 && a % 10 + b % 10 >= 10 && g === digitsNoCarry(a, b)) id = 'add-carry'; else if(Math.abs(g - ans) === 1) id = 'add-one'; }
    else if(op === '−'){ if(g === a + b) id = 'sub-add'; else if(a >= 10 && a % 10 < b % 10 && g === digitsFlip(a, b)) id = 'sub-flip'; else if(Math.abs(g - ans) === 1) id = 'sub-one'; }
    else if(op === '×'){ if(g === a + b) id = 'mul-add'; else if(g === ans + a || g === ans - a || g === ans + b || g === ans - b) id = 'mul-group'; }
    else if(op === '÷'){ if(g === a * b) id = 'div-mul'; else if(g === a - b) id = 'div-sub'; }
    if(!id && ans >= 10 && ans < 100 && g === (ans % 10) * 10 + Math.floor(ans / 10)) id = 'any-swap';
    return id ? { id: id, tip: MIS[id], name: MIS_NAME[id] } : null;
  };

  LIB.views.checkHome = { title: 'Check my work', render: function(el){
    el.innerHTML = '<p class="clib-lede">Show Shelly something you made and get two stars and a wish: two things you did well and one thing to try next.</p>' + tiles([
      { e: '✍️', name: 'My writing', note: 'Stories, facts, letters', view: 'writing' },
      { e: '📷', name: 'Photo of my work', note: claudeReady() ? 'Claude marks it' : 'Needs internet + Claude', view: 'photoCheck' },
      { e: '📝', name: 'A worksheet', note: 'Check answers on screen', view: 'wsHome' },
      { e: '🧑‍🏫', name: 'Teach it back', note: 'Explain it to Shelly', view: 'teachback' }
    ]);
    wireTiles(el);
  } };

  /* ---- writing feedback ---- */
  var RUBRICS = {
    story: { name: 'A story', e: '📖', criteria: [
      ['Beginning, middle and end', function(t){ var n = sentences(t).length; return n >= 5 ? 3 : n >= 3 ? 2 : 1; }, 'Tell what happens first, next and at the end.'],
      ['Joining words', function(t){ var j = count(t, /\b(then|next|after|before|when|because|but|so|suddenly|finally|later|while)\b/g); return j >= 4 ? 3 : j >= 2 ? 2 : 1; }, 'Use words like then, suddenly and finally to join your ideas.'],
      ['Describing words', function(t){ var d = count(t, DESCRIBE); return d >= 4 ? 3 : d >= 2 ? 2 : 1; }, 'Add describing words: what did it look, sound or feel like?'],
      ['Feelings', function(t){ return count(t, /\b(happy|sad|scared|excited|angry|worried|surprised|proud|lonely|brave|felt|feel|glad|nervous)\b/g) ? 3 : 1; }, 'Say how someone in your story felt.']
    ] },
    facts: { name: 'A fact report', e: '🔬', criteria: [
      ['Says what it\'s about', function(t){ var f = sentences(t)[0] || ''; return /\b(is|are|about|live|lives|have|has)\b/i.test(f) ? 3 : 2; }, 'Start with a sentence that says what your report is about.'],
      ['Lots of facts', function(t){ var n = sentences(t).length; return n >= 5 ? 3 : n >= 3 ? 2 : 1; }, 'Add more facts. Each fact can be its own sentence.'],
      ['Number facts', function(t){ return /\d/.test(t) || count(t, /\b(one|two|three|four|five|ten|hundred|thousand|many|most)\b/g) ? 3 : 1; }, 'Add a number fact, like how big, how many or how old.'],
      ['An ending', function(t){ var s = sentences(t); return s.length > 2 && /\b(so|that is why|amazing|interesting|i think|in the end|cool|love)\b/i.test(s[s.length - 1]) ? 3 : 2; }, 'Finish with a sentence that wraps it up, like "That is why turtles are amazing."']
    ] },
    opinion: { name: 'What I think', e: '💭', criteria: [
      ['Says what you think', function(t){ return /\b(i think|i believe|i like|i love|i don'?t like|my favou?rite|should|best|worst)\b/i.test(t) ? 3 : 1; }, 'Start by saying what you think: "I think…"'],
      ['Reasons', function(t){ var r = count(t, /\b(because|so|since)\b/g); return r >= 2 ? 3 : r ? 2 : 1; }, 'Give reasons with "because".'],
      ['Example', function(t){ return /\b(for example|like when|one time|once)\b/i.test(t) ? 3 : 1; }, 'Add an example: "For example…"'],
      ['Ending', function(t){ return /\b(that is why|that'?s why|so i think|in the end)\b/i.test(t) ? 3 : 1; }, 'Finish by saying your opinion again: "That is why…"']
    ] },
    letter: { name: 'A letter', e: '💌', criteria: [
      ['Greeting', function(t){ return /^\s*(dear|hi|hello|to)\b/i.test(t) ? 3 : 1; }, 'Start with a greeting, like "Dear Grandma,"'],
      ['Tells news or asks', function(t){ var n = sentences(t).length; return n >= 4 ? 3 : n >= 2 ? 2 : 1; }, 'Tell some news, and ask a question too.'],
      ['A question', function(t){ return /\?/.test(t) ? 3 : 1; }, 'Ask them a question, ending with a question mark.'],
      ['Sign-off', function(t){ return /\b(love|from|bye|see you|yours)\b[\s\S]{0,30}$/i.test(t) ? 3 : 1; }, 'Finish with "Love from" and your name.']
    ] }
  };
  var DESCRIBE = /\b(big|small|tiny|huge|giant|little|red|blue|green|yellow|pink|purple|orange|black|white|bright|dark|shiny|soft|hard|loud|quiet|fast|slow|happy|sad|beautiful|pretty|scary|funny|cold|hot|warm|wet|sparkly|smooth|bumpy|spiky|fluffy|gentle|brave|kind|deep|long|short|round|colourful|colorful|strange|enormous|delicious)\b/g;
  var SPELL = { becuase: 'because', becaus: 'because', beacuse: 'because', becos: 'because', wuz: 'was', woz: 'was', thay: 'they', tha: 'the', teh: 'the', wen: 'when', wich: 'which', freind: 'friend', frend: 'friend', sed: 'said', siad: 'said', thier: 'their', wont: "won't", dont: "don't", cant: "can't", didnt: "didn't", im: "I'm", alot: 'a lot', realy: 'really', reely: 'really', allways: 'always', untill: 'until', tomorow: 'tomorrow', togeather: 'together', diffrent: 'different', favrite: 'favourite', favorit: 'favorite', beautifull: 'beautiful', wanna: 'want to', gonna: 'going to', sum: 'some', whent: 'went', wnet: 'went', ther: 'there', wer: 'were', whith: 'with', wiht: 'with', becuz: 'because', peple: 'people', pepole: 'people', animuls: 'animals', anmals: 'animals', turtel: 'turtle', ocaen: 'ocean', oshun: 'ocean', skool: 'school', scool: 'school', litle: 'little', bigest: 'biggest', hapy: 'happy', happyer: 'happier', swiming: 'swimming', runing: 'running', stoped: 'stopped', jumpt: 'jumped', lookt: 'looked', nite: 'night', rite: 'right', ritten: 'written', evry: 'every', evryone: 'everyone', somthing: 'something', becom: 'become', agian: 'again', agenst: 'against', wated: 'waited', wached: 'watched' };
  function sentences(t){ return String(t).replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map(function(s){ return s.trim(); }).filter(function(s){ return s.split(/\s+/).length >= 2; }); }
  function count(t, re){ return (String(t).toLowerCase().match(re) || []).length; }
  function writingOffline(text, rubric){
    var R = RUBRICS[rubric] || RUBRICS.story, t = text.trim(), words = t.split(/\s+/).filter(Boolean), ss = sentences(t);
    var crit = R.criteria.map(function(c){ var st = c[1](t); return { name: c[0], stars: st, note: st < 3 ? c[2] : 'Yes!' }; });
    // Mechanics: capitals, full stops, "i" on its own, spellings, sentences that run on.
    var noCap = ss.filter(function(s){ return /^[a-z]/.test(s); }).length, noEnd = /[.!?]["')]?\s*$/.test(t) ? 0 : 1, lowI = (t.match(/(^|\s)i(?=[\s',.!?])/g) || []).length;
    var spells = []; words.forEach(function(w){ var k = w.toLowerCase().replace(/[^a-z]/g, ''); if(SPELL[k] && spells.indexOf(k) < 0) spells.push(k); });
    var runOn = ss.filter(function(s){ return s.split(/\s+/).length > 28 || count(s, /\band\b/g) >= 4; }).length;
    var mech = [];
    if(noCap) mech.push(noCap === 1 ? 'One sentence starts with a small letter. Sentences start with a capital.' : noCap + ' sentences start with a small letter. Sentences start with a capital.');
    if(noEnd || ss.length <= 1 && words.length > 15) mech.push('Put a full stop (.) at the end of each sentence.');
    if(lowI) mech.push('When you write about yourself, "I" is always a capital.');
    if(runOn) mech.push('One sentence is very long. Try breaking it into two with a full stop instead of "and".');
    spells.slice(0, 5).forEach(function(k){ mech.push('Spelling: "' + k + '" is spelled "' + SPELL[k] + '".'); });
    var good = crit.filter(function(c){ return c.stars === 3; }).map(function(c){ return c.name; });
    var glows = [];
    if(good.length) glows.push('Great ' + good[0].toLowerCase() + '!');
    if(good.length > 1) glows.push('I liked your ' + good[1].toLowerCase() + ' too.');
    var desc = (t.toLowerCase().match(DESCRIBE) || []); if(glows.length < 2 && desc.length) glows.push('Nice describing word: "' + desc[0] + '".');
    if(glows.length < 2 && words.length >= 30) glows.push('You wrote ' + words.length + ' words. That\'s a lot!');
    if(glows.length < 2 && !noCap && ss.length) glows.push('Every sentence starts with a capital letter.');
    if(glows.length < 2) glows.push('You put your ideas into words. Well done!');
    var weak = crit.filter(function(c){ return c.stars < 3; }).sort(function(a, b){ return a.stars - b.stars; })[0];
    var wish = weak ? weak.note : mech[0] || 'Try adding one more sentence with a describing word.';
    return { glows: glows.slice(0, 2), wish: wish, criteria: crit, mechanics: mech, words: words.length, sentences: ss.length, src: 'offline' };
  }
  function writingClaude(text, rubric){
    var R = RUBRICS[rubric] || RUBRICS.story;
    var sys = 'You give kind, specific writing feedback to a young child, as "two stars and a wish". Rubric for "' + R.name + '": ' + R.criteria.map(function(c){ return c[0]; }).join('; ') + '. ' +
      'Reply with JSON only: {"glows":[two short specific praises quoting her words],"wish":"one next step, short and concrete","criteria":[{"name":"<rubric item>","stars":1-3,"note":"short"}],"mechanics":["up to 4 notes on capitals, full stops or spelling, quoting the word"]}. Never rewrite her piece for her.';
    return ask('feedback', [{ role: 'user', content: 'Here is my writing:\n\n' + text }], sys).then(function(t){
      var j = jsonFrom(t); if(!j || !Array.isArray(j.glows) || !j.wish) return null;
      return { glows: j.glows.slice(0, 2).map(String), wish: String(j.wish), criteria: (j.criteria || []).slice(0, 6).map(function(c){ return { name: String(c.name || ''), stars: Math.max(1, Math.min(3, +c.stars || 1)), note: String(c.note || '') }; }), mechanics: (j.mechanics || []).slice(0, 5).map(String), src: 'claude' };
    });
  }
  function stars(n){ return '⭐'.repeat(n) + '<span class="clib-dim">' + '☆'.repeat(3 - n) + '</span>'; }
  LIB.views.writing = { title: 'My writing', render: function(el){
    var draft = rec().draft || '';
    el.innerHTML = '<section class="clib-card"><label class="clib-label">What kind of writing?</label><div class="clib-row" role="radiogroup">' +
      Object.keys(RUBRICS).map(function(k, i){ return '<button type="button" class="clib-btn" role="radio" data-r="' + k + '" aria-pressed="' + (i === 0) + '">' + RUBRICS[k].e + ' ' + RUBRICS[k].name + '</button>'; }).join('') + '</div>' +
      '<label class="clib-label" for="clibW">Type or paste your writing</label><textarea id="clibW" class="clib-input" rows="8" placeholder="Once upon a time…">' + esc(draft) + '</textarea>' +
      '<div class="clib-row"><button type="button" class="clib-btn main" data-go>⭐ Get feedback</button><small class="clib-note" data-wc></small></div></section><div class="clib-out"></div>';
    var rubric = 'story', ta = $('#clibW', el), out = $('.clib-out', el), wc = $('[data-wc]', el);
    $$('[data-r]', el).forEach(function(b){ b.addEventListener('click', function(){ rubric = b.dataset.r; $$('[data-r]', el).forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); }); });
    function upd(){ var n = ta.value.trim().split(/\s+/).filter(Boolean).length; wc.textContent = n + ' word' + (n === 1 ? '' : 's'); var r = rec(); r.draft = ta.value; saveRec(r); }
    ta.addEventListener('input', upd); upd();
    $('[data-go]', el).addEventListener('click', function(){
      var text = ta.value.trim(); if(text.split(/\s+/).length < 3){ out.innerHTML = '<p class="clib-msg">Write a little more first (at least one sentence).</p>'; return; }
      out.innerHTML = '<p class="clib-msg">Shelly is reading…</p>';
      (claudeReady() ? writingClaude(text, rubric) : Promise.resolve(null)).then(function(fb){
        fb = fb || writingOffline(text, rubric);
        out.innerHTML = '<section class="clib-card"><h2>⭐ ⭐ Two stars</h2><ul>' + fb.glows.map(function(g){ return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
          '<h2>🪄 A wish</h2><p class="clib-big">' + esc(fb.wish) + '</p>' +
          (fb.criteria.length ? '<h2>' + esc((RUBRICS[rubric] || RUBRICS.story).name) + ' checklist</h2><ul class="clib-rubric">' + fb.criteria.map(function(c){ return '<li><span>' + esc(c.name) + '</span><span aria-label="' + c.stars + ' of 3 stars">' + stars(c.stars) + '</span>' + (c.stars < 3 ? '<small>' + esc(c.note) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '') +
          (fb.mechanics.length ? '<h2>🔤 Capitals, full stops and spelling</h2><ul>' + fb.mechanics.map(function(m){ return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
          '<p class="clib-note">' + (fb.src === 'claude' ? 'Feedback by Claude.' : 'Shelly\'s offline checker looks at sentences, capitals, joining words, describing words and common spellings. It can\'t understand your story the way a person can, so ask a grown-up to read it too!') + '</p></section>';
        speak(fb.glows.join(' ') + ' Here is a wish: ' + fb.wish);
        log('writing', { rubric: rubric, words: text.split(/\s+/).length, stars: fb.criteria.reduce(function(s, c){ return s + c.stars; }, 0), max: fb.criteria.length * 3, src: fb.src });
      });
    });
  } };

  /* ---- photo marking (Claude only) ---- */
  LIB.views.photoCheck = { title: 'Photo of my work', render: function(el){
    if(!claudeReady()){ el.innerHTML = '<section class="clib-card"><h2>📴 This one needs Claude</h2><p>Reading handwriting from a photo needs the internet and the Claude helper (a grown-up can set it up in Settings).</p><p>Offline, try <b>Check my answers</b> on a Library worksheet, or type your writing into <b>My writing</b>.</p><div class="clib-row"><button type="button" class="clib-btn main" data-v="writing">✍️ My writing</button><button type="button" class="clib-btn" data-v="wsHome">📝 Worksheets</button></div></section>';
      $$('[data-v]', el).forEach(function(b){ b.addEventListener('click', function(){ go(b.dataset.v); }); }); return; }
    el.innerHTML = '<section class="clib-card"><p>Take a photo of a page of sums, a worksheet or some writing. Claude marks it and explains anything to fix.</p>' +
      '<input type="file" accept="image/*" capture="environment" id="clibPh" class="clib-input"><label class="clib-label" for="clibPhN">Anything Claude should know? (optional)</label><input id="clibPhN" class="clib-input" placeholder="e.g. Page 4 of her maths book, adding to 20">' +
      '<div class="clib-row"><button type="button" class="clib-btn main" data-go>📷 Mark it</button></div><p class="clib-note">Please make sure there are no faces or names in the photo.</p></section><div class="clib-out"></div>';
    var out = $('.clib-out', el);
    $('[data-go]', el).addEventListener('click', function(){
      var f = $('#clibPh', el).files[0]; if(!f){ out.innerHTML = '<p class="clib-msg">Choose a photo first.</p>'; return; }
      out.innerHTML = '<p class="clib-msg">Claude is looking…</p>';
      shrinkImage(f, 1400).then(function(img){
        var sys = 'A child has photographed her own schoolwork. Mark it kindly. Reply with JSON only: {"items":[{"q":"the question or line, short","given":"what she wrote","ok":true|false,"fix":"if wrong: the right answer and one short why"}],"glows":["two specific praises"],"wish":"one next step"}. If you cannot read it, return {"unreadable":true}.';
        return ask('photo', [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } }, { type: 'text', text: 'Please mark my work.' + ($('#clibPhN', el).value.trim() ? ' Note: ' + $('#clibPhN', el).value.trim() : '') }] }], sys);
      }).then(function(t){
        var j = jsonFrom(t);
        if(!t){ out.innerHTML = '<p class="clib-msg">Claude couldn\'t be reached (' + esc(LIB.lastError || 'no reply') + '). Try again when the internet is back.</p>'; return; }
        if(!j || j.unreadable || !Array.isArray(j.items)){ out.innerHTML = '<p class="clib-msg">Claude couldn\'t read that photo. Try again with more light, straight above the page.</p>'; return; }
        var right = j.items.filter(function(x){ return x.ok; }).length;
        out.innerHTML = '<section class="clib-card"><h2>' + right + ' out of ' + j.items.length + ' right</h2><ol class="clib-qs">' + j.items.map(function(x){ return '<li class="' + (x.ok ? 'ok' : 'no') + '"><span>' + esc(x.q) + ' → <b>' + esc(x.given) + '</b></span>' + (x.ok ? '' : '<div class="clib-why"><p>' + esc(x.fix) + '</p></div>') + '</li>'; }).join('') + '</ol>' +
          (j.glows ? '<h2>⭐ ⭐ Two stars</h2><ul>' + j.glows.slice(0, 2).map(function(g){ return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' : '') + (j.wish ? '<h2>🪄 A wish</h2><p class="clib-big">' + esc(j.wish) + '</p>' : '') + '</section>';
        speak(right + ' out of ' + j.items.length + ' right. ' + (j.wish || ''));
        log('photo', { score: j.items.length ? Math.round(right / j.items.length * 100) : 0, n: j.items.length });
      }).catch(function(e){ out.innerHTML = '<p class="clib-msg">' + esc(e.message) + '</p>'; });
    });
  } };

  /* ---- progress ---- */
  LIB.views.progressHome = { title: 'My progress', render: function(el){
    el.innerHTML = tiles([
      { e: '🏆', name: 'Mastery', note: 'Decks and maths skills', view: 'mastery' },
      { e: '🔎', name: 'Tricky spots', note: 'Mistakes to fix', view: 'misconceptions' },
      { e: '🎯', name: 'Sure or guessing?', note: 'How well she knows', view: 'confidence' },
      { e: '🧭', name: 'Where am I?', note: 'Maths placement check', view: 'placement' },
      { e: '💌', name: 'Weekly letter', note: 'For grown-ups', view: 'weekly' }
    ]);
    wireTiles(el);
    var r = rec(); if(r.placement){ var p = document.createElement('p'); p.className = 'clib-note'; p.textContent = 'Last placement check (' + r.placement.date + '): ready for ' + r.placement.label + '.'; el.appendChild(p); }
  } };
  // Maths answers from the log, grouped by skill: { skill: { n, ok, recent:[bool] } }
  function mathSkills(days){
    var since = days ? Date.now() - days * 864e5 : 0, out = {};
    (rec().log || []).forEach(function(e){ if(e.k !== 'math' || e.t < since) return; var s = out[e.skill] = out[e.skill] || { n: 0, ok: 0, recent: [] }; s.n++; if(e.ok) s.ok++; s.recent.push(!!e.ok); if(s.recent.length > 20) s.recent.shift(); });
    return out;
  }
  function skillLevel(s){ var n = s.recent.length, ok = s.recent.filter(Boolean).length, p = n ? ok / n : 0;
    return n >= 10 && p >= .9 ? ['Mastered', 'm'] : n >= 6 && p >= .75 ? ['Strong', 'm'] : n >= 3 && p >= .5 ? ['Growing', 'l'] : ['Starting', 'l']; }
  LIB.views.mastery = { title: 'Mastery', render: function(el){
    var ds = decks(), sk = mathSkills(0), keys = Object.keys(sk);
    el.innerHTML = '<section class="clib-card"><h2>🔢 Maths skills</h2>' + (keys.length ? '<ul class="clib-list">' + keys.map(function(k){ var s = sk[k], lv = skillLevel(s), p = Math.round(s.recent.filter(Boolean).length / s.recent.length * 100);
      return '<li><span class="clib-li-t">' + esc(k) + '<small>' + p + '% of the last ' + s.recent.length + ' · ' + s.n + ' answered</small></span><span class="clib-pill">' + lv[0] + '</span><div class="clib-bar" style="width:100%"><i class="' + lv[1] + '" style="width:' + p + '%"></i></div></li>'; }).join('') + '</ul>'
      : '<p class="clib-note">No maths answers yet. Try Facts practice in the Maths lab or a maths worksheet.</p>') + '<p class="clib-note">Mastered = 90% or more of the last 10+ answers.</p></section>' +
      '<section class="clib-card"><h2>🗂️ Decks</h2>' + (ds.length ? '<ul class="clib-list" data-decks></ul><p class="clib-note">Green: mastered (she remembers it for 3 weeks or more). Yellow: learning. Grey: not started.</p>' : '<p class="clib-note">No decks yet.</p>') + '</section>';
    var ul = $('[data-decks]', el); if(!ul) return;
    ds.forEach(function(d){ var li = document.createElement('li'); ul.appendChild(li); li.innerHTML = '<span class="clib-li-e">' + esc(d.emoji) + '</span><span class="clib-li-t">' + esc(d.name) + '<small>…</small></span>';
      cards(d.id).then(function(cs){ var m = 0, l = 0; cs.forEach(function(c){ var s = cardStateOf(c); if(s === 'mastered') m++; else if(s === 'learning') l++; }); var n = cs.length || 1;
        li.innerHTML = '<span class="clib-li-e">' + esc(d.emoji) + '</span><span class="clib-li-t">' + esc(d.name) + '<small>' + m + ' mastered · ' + l + ' learning · ' + (cs.length - m - l) + ' new</small></span><div class="clib-bar" style="width:100%"><i class="m" style="width:' + (m / n * 100) + '%"></i><i class="l" style="width:' + (l / n * 100) + '%"></i></div>'; }); });
  } };
  LIB.views.misconceptions = { title: 'Tricky spots', render: function(el){
    var since = Date.now() - 30 * 864e5, by = {};
    (rec().log || []).forEach(function(e){ if(e.k === 'math' && e.mis && e.t >= since){ var b = by[e.mis] = by[e.mis] || { n: 0, ex: [], skill: e.skill }; b.n++; if(b.ex.length < 3) b.ex.push(e.q + ' → ' + e.given); } });
    var ids = Object.keys(by).sort(function(a, b){ return by[b].n - by[a].n; });
    if(!ids.length){ el.innerHTML = '<section class="clib-card"><h2>🔎 No tricky spots yet</h2><p>When a maths answer is wrong in a way that shows a common mix-up (like adding instead of taking away), Shelly notes it here with a tip.</p></section>'; return; }
    el.innerHTML = '<p class="clib-lede">Mix-ups from the last 30 days, most common first.</p>' + ids.map(function(id){ var b = by[id];
      return '<section class="clib-card"><h2>' + esc(MIS_NAME[id] || id) + ' <span class="clib-pill">' + b.n + '×</span></h2><p>💡 ' + esc(MIS[id] || '') + '</p><p class="clib-note">For example: ' + b.ex.map(esc).join(' · ') + '</p>' +
        '<div class="clib-row"><button type="button" class="clib-btn main" data-skill="' + esc(b.skill || '') + '">Practise ' + esc(b.skill || 'this') + '</button></div></section>'; }).join('');
    $$('[data-skill]', el).forEach(function(b){ b.addEventListener('click', function(){ go('facts', b.dataset.skill); }); });
  } };
  LIB.views.confidence = { title: 'Sure or guessing?', render: function(el){
    var g = { sure: [0, 0], think: [0, 0], guess: [0, 0] };
    (rec().log || []).forEach(function(e){ if(e.k === 'math' && g[e.conf]){ g[e.conf][0]++; if(e.ok) g[e.conf][1]++; } });
    var total = g.sure[0] + g.think[0] + g.guess[0];
    if(!total){ el.innerHTML = '<section class="clib-card"><h2>🎯 Nothing yet</h2><p>In Facts practice she picks "I\'m sure", "I think so" or "Guessing" with each answer. This page shows how often each is right, so you can see what she really knows.</p><div class="clib-row"><button type="button" class="clib-btn main" data-f>Try Facts practice</button></div></section>'; $('[data-f]', el).addEventListener('click', function(){ go('facts'); }); return; }
    var row = function(k, label){ var n = g[k][0], p = n ? Math.round(g[k][1] / n * 100) : 0; return '<li><span class="clib-li-t">' + label + '<small>' + n + ' answers</small></span><b>' + (n ? p + '% right' : '–') + '</b><div class="clib-bar" style="width:100%"><i class="m" style="width:' + p + '%"></i></div></li>'; };
    var sp = g.sure[0] ? g.sure[1] / g.sure[0] : null, gp = g.guess[0] ? g.guess[1] / g.guess[0] : null, note;
    if(sp !== null && sp < .7) note = 'When she\'s sure she is often still wrong, so these facts need slowing down and checking, not just speed.';
    else if(gp !== null && gp > .7) note = 'Her guesses are mostly right: she knows more than she thinks! Encourage her to trust herself.';
    else if(sp !== null && sp >= .9) note = 'When she says she\'s sure, she\'s right. That\'s a good sign she knows those facts by heart.';
    else note = 'Keep going: the more answers, the clearer this picture gets.';
    el.innerHTML = '<section class="clib-card"><h2>🎯 How sure she was, and how often she was right</h2><ul class="clib-list">' + row('sure', '✅ I\'m sure') + row('think', '🤔 I think so') + row('guess', '🎲 Guessing') + '</ul><p>' + esc(note) + '</p></section>';
  } };

  /* ---- placement check: an adaptive ladder of maths skills ---- */
  var LADDER = [
    { label: 'counting on within 10', skill: 'adding', gen: function(){ var a = 1 + rnd(6), b = 1 + rnd(9 - a); return [a, '+', b]; } },
    { label: 'taking away within 10', skill: 'taking away', gen: function(){ var a = 3 + rnd(7), b = 1 + rnd(a - 1); return [a, '−', b]; } },
    { label: 'adding to 20', skill: 'adding', gen: function(){ var a = 5 + rnd(5), b = 11 - a + rnd(9); return [a, '+', Math.min(b, 20 - a)]; } },
    { label: 'taking away within 20', skill: 'taking away', gen: function(){ var a = 11 + rnd(9), b = 2 + rnd(8); return [a, '−', b]; } },
    { label: 'adding tens and ones', skill: 'adding', gen: function(){ var a = 10 + rnd(40), b = 10 + rnd(40); if(a % 10 + b % 10 >= 10) b -= b % 10; return [a, '+', b]; } },
    { label: 'times tables 2, 5 and 10', skill: 'times tables', gen: function(){ return [pick([2, 5, 10]), '×', 1 + rnd(10)]; } },
    { label: 'adding with carrying', skill: 'adding', gen: function(){ var a = 15 + rnd(60), b = 15 + rnd(20); if(a % 10 + b % 10 < 10) b += 9 - b % 10; return [a, '+', b]; } },
    { label: 'taking away with exchanging', skill: 'taking away', gen: function(){ var a = 30 + rnd(60), b = 11 + rnd(a - 20); if(a % 10 >= b % 10) b = b - b % 10 + Math.min(9, a % 10 + 1 + rnd(9 - a % 10)); return [a, '−', Math.min(b, a - 1)]; } },
    { label: 'times tables 3, 4 and 8', skill: 'times tables', gen: function(){ return [pick([3, 4, 8]), '×', 2 + rnd(9)]; } },
    { label: 'sharing (dividing)', skill: 'sharing', gen: function(){ var b = pick([2, 3, 4, 5, 10]), q = 2 + rnd(8); return [b * q, '÷', b]; } },
    { label: 'times tables 6, 7 and 9', skill: 'times tables', gen: function(){ return [pick([6, 7, 9]), '×', 2 + rnd(11)]; } },
    { label: 'dividing by 6, 7, 8 and 9', skill: 'sharing', gen: function(){ var b = pick([6, 7, 8, 9]), q = 2 + rnd(10); return [b * q, '÷', b]; } }
  ];
  LIB.views.placement = { title: 'Where am I?', render: function(el){
    el.innerHTML = '<section class="clib-card"><h2>🧭 Maths placement check</h2><p>About 12 questions. They get harder when you\'re right and easier when you\'re not, to find just the right level. No rush, and it\'s fine not to know!</p><div class="clib-row"><button type="button" class="clib-btn main" data-go>Start</button></div></section>';
    $('[data-go]', el).addEventListener('click', function(){
      var rung = 2, asked = 0, streak = 0, best = -1, misses = {}, q;
      function next(){
        if(asked >= 12 || (rung >= LADDER.length)){ return finish(); }
        var g = LADDER[rung].gen(); q = { a: g[0], op: g[1], b: g[2], ans: mathCalc(g[0], g[1], g[2]) }; asked++;
        el.innerHTML = '<section class="clib-card clib-center"><p class="clib-note">Question ' + asked + ' of 12</p><p class="clib-huge">' + q.a + ' ' + q.op + ' ' + q.b + ' = ?</p><input class="clib-input clib-num-big" inputmode="numeric" autocomplete="off" aria-label="Your answer"><div class="clib-row"><button type="button" class="clib-btn main" data-ok>OK</button><button type="button" class="clib-btn" data-skip>I don\'t know yet</button></div></section>';
        var inp = $('input', el); inp.focus();
        var submit = function(skip){ var ok = !skip && +inp.value.trim() === q.ans && inp.value.trim() !== '';
          log('math', { skill: LADDER[rung].skill, ok: ok, q: q.a + q.op + q.b, given: skip ? '' : inp.value, mis: ok || skip ? null : (LIB.misconception(q.a, q.op, q.b, inp.value) || {}).id, src: 'placement' });
          if(ok){ streak++; if(streak >= 2){ best = Math.max(best, rung); rung++; streak = 0; } }
          else { misses[rung] = (misses[rung] || 0) + 1; if(misses[rung] >= 2 && best >= rung - 1) return finish(); rung = Math.max(0, rung - 1); streak = 0; }
          next(); };
        $('[data-ok]', el).addEventListener('click', function(){ submit(false); }); $('[data-skip]', el).addEventListener('click', function(){ submit(true); });
        inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') submit(false); });
      }
      function finish(){
        var ready = Math.min(LADDER.length - 1, best + 1), r = rec(); var lv = ready <= 3 ? 'easy' : ready <= 7 ? 'medium' : 'stretch';
        r.placement = { date: today(), rung: ready, label: LADDER[ready].label, secure: best >= 0 ? LADDER[best].label : null, level: lv }; saveRec(r);
        el.innerHTML = '<section class="clib-card"><h2>🧭 Done! Here\'s where you are</h2>' + (best >= 0 ? '<p>✅ Secure: <b>' + esc(LADDER[best].label) + '</b> and everything before it.</p>' : '<p>We\'re at the very start, and that\'s a great place to begin.</p>') +
          '<p>🌱 Ready to learn next: <b>' + esc(LADDER[ready].label) + '</b>.</p><p class="clib-note">Worksheet level to pick: <b>' + lv + '</b>. This is a quick check from ' + asked + ' questions, not a test score; a teacher\'s view counts more.</p>' +
          '<div class="clib-row"><button type="button" class="clib-btn main" data-p>Practise ' + esc(LADDER[ready].skill) + '</button><button type="button" class="clib-btn" data-w>📝 Make a worksheet</button></div></section>';
        sound('sessionEnd'); speak('All done! You\'re ready to learn ' + LADDER[ready].label + '.');
        $('[data-p]', el).addEventListener('click', function(){ go('facts', LADDER[ready].skill); });
        $('[data-w]', el).addEventListener('click', function(){ go('wsMake', JSON.stringify({ src: 'math' })); });
      }
      next();
    });
  } };

  /* ---- weekly letter for grown-ups ---- */
  LIB.views.weekly = { title: 'Weekly letter', render: function(el){
    el.innerHTML = '<p class="clib-msg">Writing the letter…</p>';
    var since = Date.now() - 7 * 864e5, p = CC() && CC().profile(), name = p ? p.name : 'Your learner';
    Promise.resolve(CC() ? CC().history() : []).catch(function(){ return []; }).then(function(hist){
      var week = (hist || []).filter(function(h){ return (h.endedAt || 0) >= since; }), by = {};
      week.forEach(function(h){ var d = by[h.deckId] = by[h.deckId] || { name: h.deckName || 'Deck', e: h.deckEmoji || '🌊', rounds: 0, total: 0, right: 0, ms: 0 }; d.rounds++; d.total += h.total || 0; d.right += h.right || 0; d.ms += h.ms || 0; });
      var deckRows = Object.keys(by).map(function(k){ return by[k]; }).sort(function(a, b){ return b.total - a.total; });
      var days = {}; week.forEach(function(h){ days[new Date(h.endedAt).toDateString()] = 1; });
      var lg = (rec().log || []).filter(function(e){ return e.t >= since; });
      lg.forEach(function(e){ days[new Date(e.t).toDateString()] = 1; });
      var ws = lg.filter(function(e){ return e.k === 'ws'; }), wr = lg.filter(function(e){ return e.k === 'writing'; }), ch = lg.filter(function(e){ return e.k === 'chat'; });
      var sk = mathSkills(7), skKeys = Object.keys(sk), mins = Math.round(week.reduce(function(s, h){ return s + (h.ms || 0); }, 0) / 60000);
      var cards = week.reduce(function(s, h){ return s + (h.total || 0); }, 0), right = week.reduce(function(s, h){ return s + (h.right || 0); }, 0);
      var strengths = [], next = [];
      deckRows.forEach(function(d){ var p2 = d.total ? d.right / d.total : 0; if(d.total >= 8 && p2 >= .85) strengths.push(d.e + ' ' + d.name + ' (' + Math.round(p2 * 100) + '% right)'); else if(d.total >= 5 && p2 < .65) next.push(d.e + ' ' + d.name + ' (' + Math.round(p2 * 100) + '% right): a few more short rounds will help'); });
      skKeys.forEach(function(k){ var s = sk[k], p2 = s.ok / s.n; if(s.n >= 5 && p2 >= .85) strengths.push(k + ' (' + Math.round(p2 * 100) + '%)'); else if(s.n >= 4 && p2 < .65) next.push(k + ' (' + Math.round(p2 * 100) + '%)'); });
      var mis = {}; lg.forEach(function(e){ if(e.k === 'math' && e.mis) mis[e.mis] = (mis[e.mis] || 0) + 1; });
      var topMis = Object.keys(mis).sort(function(a, b){ return mis[b] - mis[a]; })[0];
      var r = rec(), nDays = Object.keys(days).length;
      var html = '<div class="clib-print-area clib-letter"><p>' + new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</p><p>Dear grown-ups,</p>';
      if(!week.length && !lg.length) html += '<p>' + esc(name) + ' hasn\'t practised in Coral Cove this week. A five-minute round together is a lovely way to start again.</p>';
      else {
        html += '<p>Here is ' + esc(name) + '\'s week in Coral Cove. ' + esc(name) + ' learned on <b>' + nDays + ' day' + (nDays === 1 ? '' : 's') + '</b>' + (cards ? ', practised <b>' + cards + ' cards</b> in ' + week.length + ' round' + (week.length === 1 ? '' : 's') + (cards ? ' (' + Math.round(right / cards * 100) + '% right first time)' : '') : '') + (mins ? ', for about <b>' + mins + ' minutes</b>' : '') + '.</p>';
        if(deckRows.length) html += '<h2>Decks</h2><ul>' + deckRows.slice(0, 8).map(function(d){ return '<li>' + esc(d.e + ' ' + d.name) + ': ' + d.rounds + ' round' + (d.rounds === 1 ? '' : 's') + ', ' + d.total + ' cards, ' + (d.total ? Math.round(d.right / d.total * 100) : 0) + '% right</li>'; }).join('') + '</ul>';
        var extra = []; if(ws.length) extra.push(ws.length + ' worksheet' + (ws.length === 1 ? '' : 's') + ' (average ' + Math.round(ws.reduce(function(s, w){ return s + (w.score || 0); }, 0) / ws.length) + '%)');
        if(skKeys.length) extra.push(skKeys.reduce(function(s, k){ return s + sk[k].n; }, 0) + ' maths answers');
        if(wr.length) extra.push(wr.length + ' piece' + (wr.length === 1 ? '' : 's') + ' of writing');
        if(ch.length) extra.push(ch.length + ' question' + (ch.length === 1 ? '' : 's') + ' for the tutor');
        if(extra.length) html += '<h2>In the Library</h2><p>' + esc(extra.join(', ')) + '.</p>';
        html += '<h2>Going well</h2><p>' + (strengths.length ? esc(strengths.slice(0, 4).join('; ')) + '.' : 'Showing up and trying is the big win this week.') + '</p>';
        html += '<h2>To work on next</h2><p>' + (next.length ? esc(next.slice(0, 3).join('; ')) + '.' : 'Nothing stands out as tricky. Keep the short daily rounds going.') + (topMis ? ' One mix-up came up ' + mis[topMis] + ' time' + (mis[topMis] === 1 ? '' : 's') + ': <i>' + esc(MIS_NAME[topMis]) + '</i>. ' + esc(MIS[topMis]) : '') + '</p>';
        if(r.placement) html += '<p>Last maths placement check (' + esc(r.placement.date) + '): ready for <b>' + esc(r.placement.label) + '</b>.</p>';
        html += '<h2>An idea for this week</h2><p>' + esc(next.length ? 'Ask ' + name + ' to teach you one thing from ' + (deckRows[deckRows.length - 1] || { name: 'a deck' }).name + '. Explaining it out loud is one of the best ways to remember.' : 'Try a "Teach it back" in the Library together: ' + name + ' explains a card to Shelly, and you listen.') + '</p>';
      }
      html += '<p>From Shelly 🐢 and the Coral Cove reef</p><p class="clib-note">Worked out on this device from Coral Cove\'s practice history and the Library log. Percentages from a handful of answers can swing a lot, so treat them as a rough guide.</p></div>' +
        '<div class="clib-row clib-noprint"><button type="button" class="clib-btn main" data-print>🖨️ Print or save as PDF</button></div>';
      el.innerHTML = html;
      $('[data-print]', el).addEventListener('click', function(){ document.body.classList.add('clib-printing'); setTimeout(function(){ try { window.print(); } catch(e){} setTimeout(function(){ document.body.classList.remove('clib-printing'); }, 500); }, 50); });
    });
  } };

  /* =====================================================================================================
     MATHS LAB. All offline: facts practice with confidence and mix-up tips, visual models, manipulatives,
     mental strategies, shapes, clocks and money, and puzzles.
     ===================================================================================================== */
  var SKILL_TOPIC = { 'adding': 'add', 'taking away': 'sub', 'times tables': 'mul', 'sharing': 'div' };
  function levelGuess(){ var p = rec().placement; return p && p.level || 'easy'; }

  LIB.views.mathHome = { title: 'Maths lab', render: function(el){
    el.innerHTML = tiles([
      { e: '⚡', name: 'Facts practice', note: 'Sure, think so or guess?', view: 'facts' },
      { e: '📏', name: 'See it', note: 'Number lines, ten frames, fractions', view: 'visual' },
      { e: '🧱', name: 'Blocks and counters', note: 'Build and share numbers', view: 'manip' },
      { e: '🧠', name: 'Brain tricks', note: 'Mental maths strategies', view: 'mental' },
      { e: '🔷', name: 'Shapes', note: 'Sides, corners, symmetry', view: 'geometry' },
      { e: '🕒', name: 'Clocks and money', note: 'Tell the time, pay the shop', view: 'measure' },
      { e: '🧩', name: 'Puzzles', note: 'Sudoku and patterns', view: 'puzzles' }
    ]);
    wireTiles(el);
  } };

  /* ---- facts practice ---- */
  LIB.views.facts = { title: 'Facts practice', render: function(el, arg){
    var topic = SKILL_TOPIC[arg] || 'add', level = levelGuess();
    el.innerHTML = '<section class="clib-card"><label class="clib-label">What to practise</label><div class="clib-row" data-t>' +
      [['add', '➕ Adding'], ['sub', '➖ Taking away'], ['mul', '✖️ Times'], ['div', '➗ Sharing'], ['mixed', '🔀 Mix']].map(function(t){ return '<button type="button" class="clib-btn" data-v="' + t[0] + '" aria-pressed="' + (t[0] === topic) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<label class="clib-label">How hard</label><div class="clib-row" data-l>' + [['easy', 'Easy'], ['medium', 'Medium'], ['stretch', 'Stretch']].map(function(t){ return '<button type="button" class="clib-btn" data-v="' + t[0] + '" aria-pressed="' + (t[0] === level) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="clib-row"><button type="button" class="clib-btn main" data-go>Start 10 questions</button></div></section>';
    function seg(sel, set){ $$(sel + ' [data-v]', el).forEach(function(b){ b.addEventListener('click', function(){ set(b.dataset.v); $$(sel + ' [data-v]', el).forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); }); }); }
    seg('[data-t]', function(v){ topic = v; }); seg('[data-l]', function(v){ level = v; });
    $('[data-go]', el).addEventListener('click', function(){ run(LIB.wsMath(topic, level, 10).sections[0].items); });
    function run(items){
      var i = 0, right = 0;
      function show(){
        if(i >= items.length) return end();
        var it = items[i];
        el.innerHTML = '<section class="clib-card clib-center"><p class="clib-note">' + (i + 1) + ' of ' + items.length + '</p><p class="clib-huge">' + esc(it.q) + '</p>' +
          '<input class="clib-input clib-num-big" inputmode="numeric" autocomplete="off" aria-label="Your answer"><p class="clib-note">How sure are you?</p>' +
          '<div class="clib-row clib-conf"><button type="button" class="clib-btn" data-c="sure">✅ I\'m sure</button><button type="button" class="clib-btn" data-c="think">🤔 I think so</button><button type="button" class="clib-btn" data-c="guess">🎲 Guessing</button></div><div class="clib-fb" aria-live="polite"></div></section>';
        var inp = $('input', el); inp.focus();
        function answer(conf){
          if(inp.value.trim() === '' || inp.disabled) return;
          inp.disabled = true; $$('[data-c]', el).forEach(function(b){ b.disabled = true; });
          var ok = /^-?\d+(\.\d+)?$/.test(it.a) ? +inp.value.trim() === +it.a : answerClose(inp.value, it.a), m = it.m, mis = !ok && m ? LIB.misconception(m.a, m.op, m.b, inp.value) : null, fb = $('.clib-fb', el);
          if(ok){ right++; sound('correct'); fb.innerHTML = '<p class="clib-good">' + pick(['Yes!', 'Right!', 'Brilliant!', 'Spot on!']) + (conf === 'guess' ? ' Good guess. You know more than you think!' : '') + '</p>'; }
          else { sound('wrong'); fb.innerHTML = '<p class="clib-bad">It\'s ' + esc(it.a) + '.</p>' + (mis ? '<p>🔎 ' + esc(mis.tip) + '</p>' : '') + (it.steps && it.steps.length ? '<ol class="clib-steps">' + it.steps.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '') + (conf === 'sure' ? '<p class="clib-note">You were sure, so this one is worth slowing down for next time.</p>' : ''); }
          fb.innerHTML += '<div class="clib-row"><button type="button" class="clib-btn main" data-n>' + (i + 1 < items.length ? 'Next' : 'Finish') + '</button></div>';
          $('[data-n]', fb).addEventListener('click', function(){ i++; show(); }); $('[data-n]', fb).focus();
          if(m) log('math', { skill: opSkill(m.op), ok: ok, conf: conf, mis: mis && mis.id, q: m.a + m.op + m.b, given: inp.value, src: 'facts' });
        }
        $$('[data-c]', el).forEach(function(b){ b.addEventListener('click', function(){ answer(b.dataset.c); }); });
        inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') answer('think'); });
      }
      function end(){
        el.innerHTML = '<section class="clib-card clib-center"><p class="clib-huge">' + (right === items.length ? '🌟' : right >= items.length * .7 ? '👏' : '💪') + '</p><h2>' + right + ' out of ' + items.length + '</h2>' +
          '<div class="clib-row"><button type="button" class="clib-btn main" data-again>Again</button><button type="button" class="clib-btn" data-conf>Sure or guessing?</button></div></section>';
        sound('sessionEnd'); speak(right + ' out of ' + items.length + '!');
        $('[data-again]', el).addEventListener('click', function(){ run(LIB.wsMath(topic, level, 10).sections[0].items); });
        $('[data-conf]', el).addEventListener('click', function(){ go('confidence'); });
      }
      show();
    }
  } };

  /* small helper: a row of toggle buttons */
  function tabs(el, list, onPick){
    var bar = document.createElement('div'); bar.className = 'clib-row clib-tabs'; bar.setAttribute('role', 'tablist');
    bar.innerHTML = list.map(function(t, i){ return '<button type="button" class="clib-btn" role="tab" data-v="' + t[0] + '" aria-pressed="' + (i === 0) + '">' + t[1] + '</button>'; }).join('');
    var box = document.createElement('div'); el.appendChild(bar); el.appendChild(box);
    $$('[data-v]', bar).forEach(function(b){ b.addEventListener('click', function(){ $$('[data-v]', bar).forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); box.innerHTML = ''; onPick(b.dataset.v, box); }); });
    onPick(list[0][0], box);
  }
  function numInput(id, val, min, max, label){ return '<label class="clib-inline">' + label + ' <input id="' + id + '" class="clib-input clib-num" type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + val + '"></label>'; }
  function clampVal(inp, min, max){ var v = Math.round(+inp.value); if(isNaN(v)) v = min; v = Math.max(min, Math.min(max, v)); inp.value = v; return v; }

  /* ---- visual models ---- */
  function numberLineSVG(a, op, b){
    var end = op === '+' ? a + b : a - b, lo = Math.min(a, end, 0), hi = Math.max(a, end), span = Math.max(10, hi - lo), W = 600, pad = 24, x = function(v){ return pad + (v - lo) / span * (W - pad * 2); };
    var step = span > 50 ? 10 : span > 20 ? 5 : 1, h = '<svg class="clib-vis" viewBox="0 0 ' + W + ' 120" role="img" aria-label="Number line from ' + a + ' ' + (op === '+' ? 'up' : 'down') + ' ' + b + ' to ' + end + '"><line x1="' + pad + '" y1="90" x2="' + (W - pad) + '" y2="90" stroke="currentColor" stroke-width="2"/>';
    for(var v = Math.ceil(lo / step) * step; v <= lo + span; v += step) h += '<line x1="' + x(v) + '" y1="84" x2="' + x(v) + '" y2="96" stroke="currentColor"/><text x="' + x(v) + '" y="112" font-size="12" text-anchor="middle" fill="currentColor">' + v + '</text>';
    var jumps = b <= 10 ? range(1, b).map(function(){ return 1; }) : (function(){ var j = [], left = b; while(left >= 10){ j.push(10); left -= 10; } if(left) j.push(left); return j; })();
    var at = a, col = op === '+' ? '#1c8c93' : '#d0653f';
    jumps.forEach(function(j){ var to = op === '+' ? at + j : at - j, x1 = x(at), x2 = x(to), mid = (x1 + x2) / 2, ht = 24 + Math.min(40, Math.abs(x2 - x1) * .35);
      h += '<path d="M' + x1 + ' 88 Q' + mid + ' ' + (88 - ht) + ' ' + x2 + ' 88" fill="none" stroke="' + col + '" stroke-width="2.5"/>' + (j > 1 ? '<text x="' + mid + '" y="' + (84 - ht / 2 - 4) + '" font-size="12" text-anchor="middle" fill="' + col + '">' + (op === '+' ? '+' : '−') + j + '</text>' : ''); at = to; });
    return h + '<circle cx="' + x(a) + '" cy="90" r="6" fill="#f2b544"/><circle cx="' + x(end) + '" cy="90" r="6" fill="' + col + '"/></svg>';
  }
  function tenFrameSVG(n){
    var frames = Math.max(1, Math.ceil(n / 10)), h = '<svg class="clib-vis" viewBox="0 0 ' + (frames * 180 + 10) + ' 90" role="img" aria-label="' + n + ' dots in ten frames">';
    for(var f = 0; f < frames; f++) for(var k = 0; k < 10; k++){ var cx = 10 + f * 180 + (k % 5) * 32, cy = 10 + Math.floor(k / 5) * 34, filled = f * 10 + k < n;
      h += '<rect x="' + cx + '" y="' + cy + '" width="32" height="34" fill="none" stroke="currentColor"/>' + (filled ? '<circle cx="' + (cx + 16) + '" cy="' + (cy + 17) + '" r="11" fill="' + (f === 0 ? '#d0653f' : '#1c8c93') + '"/>' : ''); }
    return h + '</svg>';
  }
  function fractionBarSVG(n, d, col){
    var W = 600, h = '<svg class="clib-vis" viewBox="0 0 ' + W + ' 54" role="img" aria-label="' + n + ' out of ' + d + ' parts shaded">';
    for(var k = 0; k < d; k++) h += '<rect x="' + (2 + k * (W - 4) / d) + '" y="2" width="' + ((W - 4) / d) + '" height="50" fill="' + (k < n ? col : 'none') + '" stroke="currentColor" stroke-width="2"/>';
    return h + '</svg>';
  }
  function gcd(a, b){ return b ? gcd(b, a % b) : a; }
  LIB.views.visual = { title: 'See it', render: function(el){
    tabs(el, [['line', '📏 Number line'], ['ten', '🔟 Ten frames'], ['frac', '🍕 Fractions']], function(v, box){
      if(v === 'line'){
        box.innerHTML = '<section class="clib-card"><div class="clib-row">' + numInput('nlA', 8, 0, 100, 'Start at') + '<select id="nlOp" class="clib-input clib-op" aria-label="Add or take away"><option>+</option><option>−</option></select>' + numInput('nlB', 5, 0, 100, 'jump') + '</div><div data-out></div></section>';
        var upd = function(){ var a = clampVal($('#nlA', box), 0, 100), b = clampVal($('#nlB', box), 0, 100), op = $('#nlOp', box).value;
          $('[data-out]', box).innerHTML = numberLineSVG(a, op, b) + '<p class="clib-big">' + a + ' ' + op + ' ' + b + ' = ' + (op === '+' ? a + b : a - b) + '</p>' + (b > 10 ? '<p class="clib-note">Big jumps of 10 first, then the ones.</p>' : ''); };
        $$('input, select', box).forEach(function(i){ i.addEventListener('input', upd); }); upd();
      } else if(v === 'ten'){
        box.innerHTML = '<section class="clib-card"><div class="clib-row"><button type="button" class="clib-btn" data-d="-1" aria-label="One less">−</button><span class="clib-huge" data-n></span><button type="button" class="clib-btn" data-d="1" aria-label="One more">+</button></div><div data-out></div></section>';
        var n = 7, draw = function(){ $('[data-n]', box).textContent = n; $('[data-out]', box).innerHTML = tenFrameSVG(n) + '<p class="clib-big">' + (n >= 10 ? n + ' = 10 + ' + (n - 10) : n + ' and ' + (10 - n) + ' more make 10') + '</p>'; };
        $$('[data-d]', box).forEach(function(b){ b.addEventListener('click', function(){ n = Math.max(0, Math.min(20, n + +b.dataset.d)); sound('tap'); draw(); }); }); draw();
      } else {
        box.innerHTML = '<section class="clib-card"><div class="clib-row">' + numInput('fn1', 1, 0, 12, 'Shade') + numInput('fd1', 2, 1, 12, 'out of') + '</div><div data-o1></div><div class="clib-row">' + numInput('fn2', 2, 0, 12, 'Shade') + numInput('fd2', 4, 1, 12, 'out of') + '</div><div data-o2></div><p class="clib-big" data-cmp></p></section>';
        var updf = function(){ var d1 = clampVal($('#fd1', box), 1, 12), n1 = clampVal($('#fn1', box), 0, d1), d2 = clampVal($('#fd2', box), 1, 12), n2 = clampVal($('#fn2', box), 0, d2);
          $('[data-o1]', box).innerHTML = fractionBarSVG(n1, d1, '#f2b544'); $('[data-o2]', box).innerHTML = fractionBarSVG(n2, d2, '#1c8c93');
          var c = n1 * d2 - n2 * d1, g1 = gcd(n1, d1) || 1;
          $('[data-cmp]', box).textContent = n1 + '/' + d1 + (c === 0 ? ' = ' : c > 0 ? ' > ' : ' < ') + n2 + '/' + d2 + (c === 0 && (n1 !== n2) ? '  (the same amount, cut into different pieces)' : '') + (g1 > 1 && n1 ? '  ·  ' + n1 + '/' + d1 + ' is the same as ' + n1 / g1 + '/' + d1 / g1 : ''); };
        $$('input', box).forEach(function(i){ i.addEventListener('change', updf); }); updf();
      }
    });
  } };

  /* ---- manipulatives ---- */
  LIB.views.manip = { title: 'Blocks and counters', render: function(el){
    tabs(el, [['blocks', '🧱 Base-ten blocks'], ['counters', '🔵 Counters']], function(v, box){
      if(v === 'blocks'){
        var st = { h: 0, t: 2, o: 4 }, target = null;
        box.innerHTML = '<section class="clib-card"><div class="clib-row">' + [['h', 'Hundred'], ['t', 'Ten'], ['o', 'One']].map(function(p){ return '<span class="clib-pill">' + p[1] + 's <button type="button" class="clib-btn" data-k="' + p[0] + '" data-d="-1" aria-label="Take away a ' + p[1].toLowerCase() + '">−</button> <button type="button" class="clib-btn" data-k="' + p[0] + '" data-d="1" aria-label="Add a ' + p[1].toLowerCase() + '">+</button></span>'; }).join('') + '</div>' +
          '<div class="clib-blocks" data-out aria-live="polite"></div><p class="clib-big" data-n></p><div class="clib-row"><button type="button" class="clib-btn" data-swap="up">Swap 10 ones for a ten</button><button type="button" class="clib-btn" data-swap="down">Break a ten into ones</button><button type="button" class="clib-btn main" data-ch>🎯 Challenge</button></div><p class="clib-msg" data-msg></p></section>';
        var draw = function(){ var n = st.h * 100 + st.t * 10 + st.o, b = '';
          for(var i = 0; i < st.h; i++) b += '<span class="clib-b100" aria-hidden="true"></span>'; for(i = 0; i < st.t; i++) b += '<span class="clib-b10" aria-hidden="true"></span>'; for(i = 0; i < st.o; i++) b += '<span class="clib-b1" aria-hidden="true"></span>';
          $('[data-out]', box).innerHTML = b || '<span class="clib-note">Empty</span>'; $('[data-n]', box).textContent = st.h + ' hundreds, ' + st.t + ' tens, ' + st.o + ' ones = ' + n;
          if(target !== null && n === target){ $('[data-msg]', box).textContent = '🌟 Yes! That\'s ' + target + '.'; sound('correct'); log('math', { skill: 'place value', ok: true, q: 'show ' + target, given: String(n), src: 'blocks' }); target = null; } };
        $$('[data-k]', box).forEach(function(b){ b.addEventListener('click', function(){ var k = b.dataset.k; st[k] = Math.max(0, Math.min(k === 'h' ? 9 : 19, st[k] + +b.dataset.d)); sound('tap'); draw(); }); });
        $('[data-swap="up"]', box).addEventListener('click', function(){ if(st.o >= 10){ st.o -= 10; st.t++; draw(); } else $('[data-msg]', box).textContent = 'You need 10 ones to make a ten.'; });
        $('[data-swap="down"]', box).addEventListener('click', function(){ if(st.t > 0 && st.o <= 9){ st.t--; st.o += 10; draw(); } else $('[data-msg]', box).textContent = st.t ? 'Too many ones already!' : 'No tens to break.'; });
        $('[data-ch]', box).addEventListener('click', function(){ target = 11 + rnd(levelGuess() === 'easy' ? 89 : 400); st = { h: 0, t: 0, o: 0 }; $('[data-msg]', box).textContent = 'Show ' + target + ' with the blocks.'; speak('Show ' + target); draw(); });
        draw();
      } else {
        box.innerHTML = '<section class="clib-card"><div class="clib-row">' + numInput('ctN', 12, 0, 60, 'Counters') + numInput('ctG', 3, 1, 10, 'Share into groups:') + '</div><div data-out></div><p class="clib-big" data-n></p></section>';
        var updc = function(){ var n = clampVal($('#ctN', box), 0, 60), g = clampVal($('#ctG', box), 1, 10), q = Math.floor(n / g), r = n % g, h = '<div class="clib-groups">';
          for(var i = 0; i < g; i++) h += '<div class="clib-group">' + '🔵'.repeat(q) + '</div>';
          $('[data-out]', box).innerHTML = h + '</div>' + (r ? '<p>Left over: ' + '🟠'.repeat(r) + '</p>' : '');
          $('[data-n]', box).textContent = n + ' shared into ' + g + ' groups = ' + q + ' each' + (r ? ', with ' + r + ' left over' : '') + '.  So ' + g + ' × ' + q + (r ? ' + ' + r : '') + ' = ' + n + '.'; };
        $$('input', box).forEach(function(i){ i.addEventListener('change', updc); }); updc();
      }
    });
  } };

  /* ---- mental strategies ---- */
  var STRATS = [
    { id: 'ten', e: '🔟', name: 'Make a ten', skill: 'adding', how: ['When adding to 8 or 9, borrow from the other number to make 10.', '8 + 5: 8 needs 2 to make 10. Take 2 from 5, which leaves 3.', '10 + 3 = 13.'], gen: function(){ var a = 7 + rnd(3), b = 11 - a + rnd(a - 1); return [a, '+', Math.min(9, b)]; } },
    { id: 'dbl', e: '👯', name: 'Doubles', skill: 'adding', how: ['A double is a number added to itself.', '6 + 6 = 12, 7 + 7 = 14. Learn these by heart: they help with everything else.'], gen: function(){ var a = 2 + rnd(levelGuess() === 'easy' ? 9 : 19); return [a, '+', a]; } },
    { id: 'near', e: '🤝', name: 'Near doubles', skill: 'adding', how: ['When two numbers are next-door neighbours, use the double and add 1.', '7 + 8: 7 + 7 = 14, then 1 more is 15.'], gen: function(){ var a = 2 + rnd(9); return [a, '+', a + 1]; } },
    { id: 'nine', e: '9️⃣', name: 'Add 9: add 10, take 1', skill: 'adding', how: ['Adding 9 is nearly adding 10.', '26 + 9: 26 + 10 = 36, then take 1 away: 35.'], hint: function(a){ return [a + ' + 10 = ' + (a + 10) + '.', 'Take 1 away: ' + (a + 9) + '.']; }, gen: function(){ return [10 + rnd(80), '+', 9]; } },
    { id: 'split', e: '✂️', name: 'Split tens and ones', skill: 'adding', how: ['Add the tens, then the ones, then put them together.', '34 + 25: 30 + 20 = 50, 4 + 5 = 9, so 59.'], gen: function(){ var a = 11 + rnd(40), b = 11 + rnd(40); if(a % 10 + b % 10 > 9) b -= b % 10; return [a, '+', b]; } },
    { id: 'up', e: '🪜', name: 'Count up to take away', skill: 'taking away', how: ['When the numbers are close, count up from the smaller one.', '42 − 38: from 38, 2 more is 40, 2 more is 42. That\'s 4.'], hint: function(a, b){ var t = Math.ceil(b / 10) * 10; return t > b && t < a ? ['From ' + b + ' up to ' + t + ' is ' + (t - b) + '.', 'From ' + t + ' up to ' + a + ' is ' + (a - t) + '.', (t - b) + ' + ' + (a - t) + ' = ' + (a - b) + '.'] : ['Count up from ' + b + ' to ' + a + ': that\'s ' + (a - b) + '.']; }, gen: function(){ var b = 15 + rnd(70); return [b + 2 + rnd(10), '−', b]; } },
    { id: 'five', e: '✋', name: '× 5 is half of × 10', skill: 'times tables', how: ['Times 10 is easy, and times 5 is half of that.', '5 × 8: 10 × 8 = 80, half of 80 is 40.'], hint: function(a, b){ var n = a === 5 ? b : a; return ['10 × ' + n + ' = ' + (10 * n) + '.', 'Half of ' + (10 * n) + ' is ' + (5 * n) + '.']; }, gen: function(){ return [5, '×', 2 + rnd(11)]; } },
    { id: 'four', e: '🔁', name: '× 4 is double double', skill: 'times tables', how: ['To times by 4, double the number, then double again.', '4 × 7: double 7 is 14, double 14 is 28.'], hint: function(a, b){ var n = a === 4 ? b : a; return ['Double ' + n + ' is ' + (2 * n) + '.', 'Double ' + (2 * n) + ' is ' + (4 * n) + '.']; }, gen: function(){ return [4, '×', 2 + rnd(11)]; } }
  ];
  LIB.views.mental = { title: 'Brain tricks', render: function(el){
    el.innerHTML = '<p class="clib-lede">Quick tricks for working sums out in your head.</p>' + tiles(STRATS.map(function(s){ return { e: s.e, name: s.name, note: s.skill, view: 'strategy', arg: s.id }; }));
    wireTiles(el);
  } };
  LIB.views.strategy = { title: 'Brain trick', render: function(el, arg){
    var s = STRATS.filter(function(x){ return x.id === arg; })[0] || STRATS[0]; this.title = s.e + ' ' + s.name;
    var qs = range(1, 5).map(function(){ var g = s.gen(); return { a: g[0], op: g[1], b: g[2], ans: mathCalc(g[0], g[1], g[2]) }; });
    el.innerHTML = '<section class="clib-card"><h2>How it works</h2>' + s.how.map(function(h){ return '<p>' + esc(h) + '</p>'; }).join('') + '<button type="button" class="clib-btn" data-say>🔊 Read it to me</button></section>' +
      '<section class="clib-card"><h2>Try it</h2><ol class="clib-qs">' + qs.map(function(q, i){ return '<li><span>' + q.a + ' ' + q.op + ' ' + q.b + ' =</span><input class="clib-input clib-ans" inputmode="numeric" autocomplete="off" aria-label="Answer ' + (i + 1) + '"><div class="clib-why"></div></li>'; }).join('') + '</ol><div class="clib-row"><button type="button" class="clib-btn main" data-check>Check</button><button type="button" class="clib-btn" data-more>New ones</button></div><p class="clib-msg" aria-live="polite"></p></section>';
    $('[data-say]', el).addEventListener('click', function(){ speak(s.how.join(' ')); });
    $('[data-more]', el).addEventListener('click', function(){ go('strategy', arg, true); });
    $('[data-check]', el).addEventListener('click', function(){
      var right = 0;
      $$('.clib-qs li', el).forEach(function(li, i){ var q = qs[i], inp = $('input', li), ok = inp.value.trim() !== '' && +inp.value === q.ans, why = $('.clib-why', li);
        li.classList.toggle('ok', ok); li.classList.toggle('no', !ok); if(ok) right++;
        why.innerHTML = ok ? '' : '<p class="clib-bad">It\'s ' + q.ans + '.</p><ol class="clib-steps">' + (s.hint ? s.hint(q.a, q.b) : mathSteps(q.a, q.op, q.b)).map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
        if(inp.value.trim() !== '') log('math', { skill: s.skill, ok: ok, q: q.a + q.op + q.b, given: inp.value, mis: ok ? null : (LIB.misconception(q.a, q.op, q.b, inp.value) || {}).id, src: 'strategy' }); });
      var msg = $('.clib-msg', el); msg.textContent = right + ' out of 5' + (right === 5 ? '. You\'ve got this trick! 🌟' : '.'); speak(msg.textContent); sound(right === 5 ? 'sessionEnd' : 'tap');
    });
  } };

  /* ---- shapes ---- */
  var SHAPE_NAMES = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon' };
  function polygonSVG(n, sym, size){
    size = size || 220; var r = size * .42, c = size / 2, pts = [], rot = -Math.PI / 2 + (n % 2 ? 0 : Math.PI / n);
    if(n === 4) rot = -Math.PI / 4;
    for(var i = 0; i < n; i++){ var a = rot + i * 2 * Math.PI / n; pts.push([c + r * Math.cos(a), c + r * Math.sin(a)]); }
    var h = '<svg class="clib-shape" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="A ' + (SHAPE_NAMES[n] || n + '-sided shape') + '"><polygon points="' + pts.map(function(p){ return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="#4fc7cf" fill-opacity=".35" stroke="#1c8c93" stroke-width="3"/>';
    if(sym) for(var k = 0; k < n; k++){ var ang = rot + k * Math.PI / n; h += '<line x1="' + (c - r * 1.1 * Math.cos(ang)).toFixed(1) + '" y1="' + (c - r * 1.1 * Math.sin(ang)).toFixed(1) + '" x2="' + (c + r * 1.1 * Math.cos(ang)).toFixed(1) + '" y2="' + (c + r * 1.1 * Math.sin(ang)).toFixed(1) + '" stroke="#d0653f" stroke-width="1.5" stroke-dasharray="5 4"/>'; }
    pts.forEach(function(p){ h += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5" fill="#f2b544"/>'; });
    return h + '</svg>';
  }
  LIB.views.geometry = { title: 'Shapes', render: function(el){
    tabs(el, [['explore', '🔷 Explore'], ['quiz', '❓ Name that shape']], function(v, box){
      if(v === 'explore'){
        box.innerHTML = '<section class="clib-card clib-center"><label class="clib-label" for="gSides">Sides: <b data-s>5</b></label><input id="gSides" type="range" min="3" max="10" value="5" class="clib-range"><label class="clib-check"><input type="checkbox" id="gSym"> Show lines of symmetry</label><div data-out></div></section>';
        var upd = function(){ var n = +$('#gSides', box).value, sym = $('#gSym', box).checked; $('[data-s]', box).textContent = n;
          $('[data-out]', box).innerHTML = polygonSVG(n, sym) + '<p class="clib-big">A regular ' + SHAPE_NAMES[n] + '</p><ul class="clib-facts"><li>' + n + ' straight sides, all the same length</li><li>' + n + ' corners (vertices)</li><li>' + n + ' lines of symmetry</li><li>The corners add up to ' + ((n - 2) * 180) + '°' + ((n - 2) * 180 % n === 0 ? ', so each is ' + ((n - 2) * 180 / n) + '°' : '') + '</li>' + (n === 4 ? '<li>Each corner is a right angle, like the corner of a page.</li>' : n === 6 ? '<li>Honeycomb cells are hexagons: they fit together with no gaps.</li>' : n === 3 ? '<li>Triangles are strong, so bridges and roofs use them.</li>' : n === 8 ? '<li>A stop sign is an octagon.</li>' : '') + '</ul>'; };
        $('#gSides', box).addEventListener('input', upd); $('#gSym', box).addEventListener('change', upd); upd();
      } else {
        var score = 0, asked = 0, ask1 = function(){
          var n = 3 + rnd(6), opts = shuffle([n].concat(shuffle([3, 4, 5, 6, 7, 8].filter(function(x){ return x !== n; })).slice(0, 2)));
          box.innerHTML = '<section class="clib-card clib-center">' + polygonSVG(n, false, 180) + '<p class="clib-big">What is this shape called?</p><div class="clib-row clib-centre-row">' + opts.map(function(o){ return '<button type="button" class="clib-btn" data-o="' + o + '">' + SHAPE_NAMES[o] + '</button>'; }).join('') + '</div><p class="clib-msg" aria-live="polite">' + (asked ? score + ' out of ' + asked : '') + '</p></section>';
          $$('[data-o]', box).forEach(function(b){ b.addEventListener('click', function(){ asked++; var ok = +b.dataset.o === n; if(ok) score++; sound(ok ? 'correct' : 'wrong');
            log('math', { skill: 'shapes', ok: ok, q: SHAPE_NAMES[n], given: SHAPE_NAMES[b.dataset.o], src: 'shapes' });
            $('.clib-msg', box).textContent = (ok ? 'Yes! ' : 'It\'s a ' + SHAPE_NAMES[n] + ': count the sides, there are ' + n + '. ') + score + ' out of ' + asked;
            $$('[data-o]', box).forEach(function(x){ x.disabled = true; }); setTimeout(ask1, ok ? 900 : 2200); }); });
        }; ask1();
      }
    });
  } };

  /* ---- clocks and money ---- */
  function timeWords(h, m){ var hh = h % 12 || 12, nx = hh % 12 + 1;
    return m === 0 ? hh + ' o\'clock' : m === 30 ? 'half past ' + hh : m === 15 ? 'quarter past ' + hh : m === 45 ? 'quarter to ' + nx : m < 30 ? m + ' minutes past ' + hh : (60 - m) + ' minutes to ' + nx; }
  LIB.views.measure = { title: 'Clocks and money', render: function(el){
    tabs(el, [['clock', '🕒 Clock'], ['quiz', '❓ What time is it?'], ['shop', '🪙 Shop']], function(v, box){
      if(v === 'clock'){
        var h = 3, m = 0;
        box.innerHTML = '<section class="clib-card clib-center"><div data-c></div><p class="clib-huge" data-d></p><p class="clib-big" data-w></p><div class="clib-row clib-centre-row"><button type="button" class="clib-btn" data-m="-60">− hour</button><button type="button" class="clib-btn" data-m="-5">− 5 min</button><button type="button" class="clib-btn" data-m="5">+ 5 min</button><button type="button" class="clib-btn" data-m="60">+ hour</button></div><button type="button" class="clib-btn" data-say>🔊 Say it</button></section>';
        var draw = function(){ $('[data-c]', box).innerHTML = clockSVG(h, m).replace('width="96" height="96"', 'width="200" height="200"'); $('[data-d]', box).textContent = h + ':' + String(m).padStart(2, '0'); $('[data-w]', box).textContent = timeWords(h, m); };
        $$('[data-m]', box).forEach(function(b){ b.addEventListener('click', function(){ var t = ((h % 12) * 60 + m + +b.dataset.m + 720) % 720; h = Math.floor(t / 60) || 12; m = t % 60; sound('tick'); draw(); }); });
        $('[data-say]', box).addEventListener('click', function(){ speak(timeWords(h, m)); }); draw();
      } else if(v === 'quiz'){
        var lv = levelGuess(), score = 0, asked = 0, q1 = function(){
          var mins = lv === 'easy' ? [0, 30] : lv === 'medium' ? [0, 15, 30, 45] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
          var mk = function(){ return [1 + rnd(12), pick(mins)]; }, t = mk(), opts = [t], key = function(x){ return x[0] + ':' + x[1]; };
          while(opts.length < 3){ var o = rnd(2) ? [t[1] === 0 ? t[0] : (t[0] % 12) + 1, t[1]] : mk(); if(opts.map(key).indexOf(key(o)) < 0) opts.push(o); }
          opts = shuffle(opts);
          box.innerHTML = '<section class="clib-card clib-center">' + clockSVG(t[0], t[1]).replace('width="96" height="96"', 'width="180" height="180"') + '<div class="clib-row clib-centre-row">' + opts.map(function(o){ return '<button type="button" class="clib-btn" data-o="' + key(o) + '">' + timeWords(o[0], o[1]) + '</button>'; }).join('') + '</div><p class="clib-msg" aria-live="polite">' + (asked ? score + ' out of ' + asked : '') + '</p></section>';
          $$('[data-o]', box).forEach(function(b){ b.addEventListener('click', function(){ asked++; var ok = b.dataset.o === key(t); if(ok) score++; sound(ok ? 'correct' : 'wrong');
            log('math', { skill: 'time', ok: ok, q: key(t), given: b.dataset.o, src: 'clock' });
            $('.clib-msg', box).textContent = (ok ? 'Yes! ' : 'It\'s ' + timeWords(t[0], t[1]) + '. The short hand shows the hour. ') + score + ' out of ' + asked;
            $$('[data-o]', box).forEach(function(x){ x.disabled = true; }); setTimeout(q1, ok ? 900 : 2500); }); });
        }; q1();
      } else {
        var COINS = [1, 5, 10, 25, 50, 100], ITEMS = ['🍪', '🧃', '🐚', '🎈', '🖍️', '🍎', '🦀', '🧸', '🍦', '📒'];
        var item, price, paid = [], newItem = function(){ var lv2 = levelGuess(); item = pick(ITEMS); price = lv2 === 'easy' ? 2 + rnd(19) : lv2 === 'medium' ? 10 + rnd(90) : 50 + rnd(150); paid = []; draw2(); };
        var fmt = function(c){ return c >= 100 ? '$' + (c / 100).toFixed(2) : c + '¢'; };
        var draw2 = function(){ var tot = paid.reduce(function(a, b){ return a + b; }, 0);
          box.innerHTML = '<section class="clib-card clib-center"><p class="clib-huge">' + item + '</p><p class="clib-big">costs ' + fmt(price) + '</p><p>Tap coins to pay exactly.</p><div class="clib-row clib-centre-row">' + COINS.map(function(c){ return '<button type="button" class="clib-coin" data-c="' + c + '" aria-label="' + fmt(c) + ' coin">' + fmt(c) + '</button>'; }).join('') + '</div>' +
            '<p class="clib-paid">' + (paid.length ? paid.map(fmt).join(' + ') + ' = <b>' + fmt(tot) + '</b>' : 'Nothing paid yet') + '</p><div class="clib-row clib-centre-row"><button type="button" class="clib-btn" data-undo>↩️ Undo</button><button type="button" class="clib-btn main" data-pay>Pay</button><button type="button" class="clib-btn" data-skip>Something else</button></div><p class="clib-msg" aria-live="polite"></p></section>';
          $$('[data-c]', box).forEach(function(b){ b.addEventListener('click', function(){ paid.push(+b.dataset.c); sound('tap'); draw2(); }); });
          $('[data-undo]', box).addEventListener('click', function(){ paid.pop(); draw2(); });
          $('[data-skip]', box).addEventListener('click', newItem);
          $('[data-pay]', box).addEventListener('click', function(){ var ok = tot === price, msg = $('.clib-msg', box);
            log('math', { skill: 'money', ok: ok, q: 'pay ' + price, given: String(tot), src: 'shop' });
            if(ok){ sound('correct'); msg.textContent = '🌟 Exactly right! Enjoy your ' + item + '.'; setTimeout(newItem, 1400); }
            else { sound('wrong'); msg.textContent = tot > price ? 'That\'s ' + fmt(tot - price) + ' too much. Take a coin back.' : 'You need ' + fmt(price - tot) + ' more.'; } });
        };
        newItem();
      }
    });
  } };

  /* ---- puzzles ---- */
  function sudoku4(){
    var g = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]], d = shuffle([1, 2, 3, 4]);
    g = g.map(function(r){ return r.map(function(v){ return d[v - 1]; }); });
    if(rnd(2)) g = [g[1], g[0], g[2], g[3]]; if(rnd(2)) g = [g[0], g[1], g[3], g[2]]; if(rnd(2)) g = [g[2], g[3], g[0], g[1]];
    if(rnd(2)) g = g[0].map(function(_, c){ return g.map(function(r){ return r[c]; }); });
    return g;
  }
  function pattern(){
    var kind = rnd(4);
    if(kind === 0){ var s = pick([['🐠', '🐚'], ['🔴', '🔵', '🟡'], ['🐢', '🐢', '🦀'], ['⭐', '🌙', '🌙']]), seq = range(0, 6).map(function(i){ return s[i % s.length]; }), ans = s[7 % s.length]; return { seq: seq, ans: ans, opts: shuffle(s.filter(function(x, i){ return s.indexOf(x) === i; }).concat(s.length < 3 ? ['🐙'] : [])), why: 'The pattern repeats: ' + s.join(' ') + '.' }; }
    var st = 1 + rnd(10), step = pick([2, 3, 5, 10]);
    if(kind === 1){ var a = range(0, 4).map(function(i){ return st + i * step; }), n = st + 5 * step; return { seq: a, ans: n, opts: shuffle([n, n + 1, n - 1]), why: 'It goes up by ' + step + ' each time.' }; }
    if(kind === 2){ var top = st + 6 * step, b = range(0, 4).map(function(i){ return top - i * step; }), n2 = top - 5 * step; return { seq: b, ans: n2, opts: shuffle([n2, n2 + 1, n2 - 1]), why: 'It goes down by ' + step + ' each time.' }; }
    var s0 = pick([1, 2, 3]), c = range(0, 4).map(function(i){ return s0 * Math.pow(2, i); }), n3 = s0 * 32; return { seq: c, ans: n3, opts: shuffle([n3, n3 + 2, s0 * 16 + s0 * 8]), why: 'Each number is double the one before.' };
  }
  LIB.views.puzzles = { title: 'Puzzles', render: function(el){
    tabs(el, [['sudoku', '🔢 Mini sudoku'], ['pattern', '🔁 What comes next?']], function(v, box){
      if(v === 'sudoku'){
        var g = sudoku4(), hide = { easy: 6, medium: 8, stretch: 10 }[levelGuess()] || 6, holes = shuffle(range(0, 15)).slice(0, hide);
        box.innerHTML = '<section class="clib-card clib-center"><p>Fill the grid so every row, every column and every 2×2 box has 1, 2, 3 and 4.</p><div class="clib-sudoku" role="grid">' + range(0, 15).map(function(i){ var r = Math.floor(i / 4), c = i % 4, v2 = g[r][c];
            return holes.indexOf(i) >= 0 ? '<input class="clib-cell" inputmode="numeric" maxlength="1" data-i="' + i + '" aria-label="Row ' + (r + 1) + ' column ' + (c + 1) + '">' : '<span class="clib-cell given">' + v2 + '</span>'; }).join('') + '</div>' +
          '<div class="clib-row clib-centre-row"><button type="button" class="clib-btn main" data-check>Check</button><button type="button" class="clib-btn" data-new>New puzzle</button></div><p class="clib-msg" aria-live="polite"></p></section>';
        $$('.clib-cell[data-i]', box).forEach(function(inp){ inp.addEventListener('input', function(){ inp.value = inp.value.replace(/[^1-4]/g, '').slice(0, 1); inp.classList.remove('no'); }); });
        $('[data-new]', box).addEventListener('click', function(){ go('puzzles', null, true); });
        $('[data-check]', box).addEventListener('click', function(){ var wrong = 0, empty = 0;
          $$('.clib-cell[data-i]', box).forEach(function(inp){ var i = +inp.dataset.i, want = g[Math.floor(i / 4)][i % 4]; if(!inp.value) empty++; else if(+inp.value !== want){ wrong++; inp.classList.add('no'); } });
          var msg = $('.clib-msg', box); msg.textContent = wrong ? wrong + ' square' + (wrong === 1 ? ' doesn\'t' : 's don\'t') + ' fit yet. Look along its row and column.' : empty ? 'So far so good! ' + empty + ' to go.' : '🌟 Solved!';
          if(!wrong && !empty){ sound('sessionEnd'); log('puzzle', { kind: 'sudoku', level: levelGuess() }); } });
      } else {
        var score = 0, asked = 0, q1 = function(){ var p = pattern();
          box.innerHTML = '<section class="clib-card clib-center"><p class="clib-huge clib-seq">' + p.seq.map(esc).join('  ') + '  ❓</p><div class="clib-row clib-centre-row">' + p.opts.map(function(o){ return '<button type="button" class="clib-btn clib-big" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div><p class="clib-msg" aria-live="polite">' + (asked ? score + ' out of ' + asked : '') + '</p></section>';
          $$('[data-o]', box).forEach(function(b){ b.addEventListener('click', function(){ asked++; var ok = b.dataset.o === String(p.ans); if(ok) score++; sound(ok ? 'correct' : 'wrong');
            log('math', { skill: 'patterns', ok: ok, q: p.seq.join(','), given: b.dataset.o, src: 'pattern' });
            $('.clib-msg', box).textContent = (ok ? 'Yes! ' : 'It\'s ' + p.ans + '. ') + p.why + ' ' + score + ' out of ' + asked;
            $$('[data-o]', box).forEach(function(x){ x.disabled = true; }); setTimeout(q1, ok ? 1200 : 2600); }); });
        }; q1();
      }
    });
  } };
  CSS += '\n' + [
    '.clib-back{ display:inline-flex; align-items:center; gap:6px; } .clib-back .cc-ic{ width:1.15em; height:1.15em; }',
    '.clib-more-b .cc-ic{ width:1.2em; height:1.2em; vertical-align:-.25em; color:var(--clib-accent); }',
    '.clib-tile-e .cc-ic{ width:2.1rem; height:2.1rem; color:var(--clib-accent); } .clib-tile-e .cc-ic .f{ opacity:.22; }',
    '[data-mic] .cc-ic{ width:1.3em; height:1.3em; } [data-mic].listening{ background:var(--clib-accent); color:var(--clib-accent-ink); }',
    '.clib-chat{ display:flex; flex-direction:column; height:calc(100dvh - 140px); min-height:360px; }',
    '.clib-msgs{ flex:1; overflow:auto; display:flex; flex-direction:column; gap:8px; padding:4px 2px 10px; }',
    '.clib-m{ max-width:82%; padding:10px 14px; border-radius:18px; font-weight:700; line-height:1.4; white-space:pre-wrap; overflow-wrap:anywhere; }',
    '.clib-m.me{ align-self:flex-end; background:var(--clib-accent); color:var(--clib-accent-ink); border-bottom-right-radius:6px; }',
    '.clib-m.bot{ align-self:flex-start; background:var(--clib-card); border:1px solid var(--clib-line); border-bottom-left-radius:6px; }',
    '.clib-m.wait{ align-self:flex-start; background:var(--clib-bg); color:var(--clib-soft); border:1px dashed var(--clib-line); animation:clib-pulse 1.2s ease-in-out infinite; }',
    '@keyframes clib-pulse{ 50%{ opacity:.45; } }',
    '.clib-send{ position:sticky; bottom:0; display:flex; gap:8px; align-items:center; padding:10px 0 0; background:var(--clib-bg); border-top:1px solid var(--clib-line); }',
    '.clib-send .clib-input{ flex:1; width:auto; }',
    '.clib-dots, .clib-arr{ display:flex; flex-wrap:wrap; gap:4px; justify-content:center; font-size:1.8rem; line-height:1.3; margin:8px 0; }',
    '.clib-arr{ flex-direction:column; align-items:center; gap:2px; }',
    '.clib-huge{ font:600 2.2rem var(--clib-display); text-align:center; margin:10px 0; }',
    '.clib-e3{ font-size:2.4rem; text-align:center; letter-spacing:.2em; margin:8px 0; }',
    '.clib-fb, .clib-tb{ min-height:1.3em; font-weight:800; margin:8px 0; }',
    '.clib-tb{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }',
    '.clib-recent{ margin:8px 0; color:var(--clib-soft); font-weight:700; }',
    '.clib-dim{ opacity:.3; filter:grayscale(1); }',
    '.clib-ws-head{ display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; border-bottom:2px solid var(--clib-ink); padding-bottom:6px; margin-bottom:12px; font-weight:800; }',
    '.clib-ws-sec{ margin:18px 0; break-inside:avoid; } .clib-ws-sec h3{ margin:0 0 6px; font:600 1.15rem var(--clib-display); }',
    '.clib-bank{ display:flex; flex-wrap:wrap; gap:8px; padding:8px 12px; border:1px dashed var(--clib-line); border-radius:12px; font-weight:800; margin:6px 0; }',
    '.clib-match{ display:grid; gap:8px; } .clib-mrow{ display:flex; align-items:center; gap:10px; } .clib-mrow > span, .clib-mrow > label{ flex:1; font-weight:700; }',
    '.clib-mrow select, .clib-op, select.clib-ans{ font-weight:700; font-size:1rem; font-family:inherit; color:var(--clib-ink); background:var(--clib-bg); border:1px solid var(--clib-line); border-radius:10px; padding:6px 8px; }',
    '.clib-qs{ padding-left:1.6em; margin:8px 0; } .clib-qs li{ padding:8px 10px; margin:6px 0; border-left:4px solid transparent; border-radius:8px; line-height:1.7; }',
    '.clib-qs li > span{ margin-right:8px; font-weight:700; }',
    '.clib-qs li input[type=text], .clib-qs li input:not([type]), .clib-ans{ font-weight:700; font-size:1rem; font-family:inherit; color:var(--clib-ink); background:var(--clib-bg); border:1px solid var(--clib-line); border-radius:8px; padding:5px 8px; }',
    '.clib-qs li.ok{ border-left-color:var(--clib-good); background:rgba(47,122,82,.12); } .clib-qs li.no{ border-left-color:var(--clib-bad); background:rgba(181,69,47,.12); }',
    '.clib-opts{ display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:4px; } .clib-opts label{ font-weight:700; }',
    '.clib-num{ width:4.5em; text-align:center; font-weight:700; font-size:1rem; font-family:inherit; color:var(--clib-ink); background:var(--clib-bg); border:1px solid var(--clib-line); border-radius:8px; padding:5px; }',
    '.clib-order{ list-style:decimal; } .clib-why, .clib-steps{ color:var(--clib-soft); font-weight:700; font-size:.95rem; margin:4px 0; } .clib-steps{ padding-left:1.4em; }',
    '.clib-key, .clib-keypage{ display:none; }',
    '.clib-trace{ display:grid; gap:10px; } .clib-trow{ display:flex; align-items:flex-end; gap:6px; border-bottom:2px dashed var(--clib-line); min-height:3.4rem; }',
    '.clib-tmodel{ font:800 2.4rem/1.2 "Baloo 2",sans-serif; color:var(--clib-ink); min-width:1.4em; text-align:center; }',
    '.clib-tfaint{ font:800 2.4rem/1.2 "Baloo 2",sans-serif; color:#c9d0d1; min-width:1.4em; text-align:center; }',
    '.clib-tblank{ display:inline-block; width:2.4rem; height:3rem; border:1px dashed var(--clib-line); border-radius:6px; }',
    '.clib-diagram{ display:block; max-width:420px; width:100%; margin:10px auto; background:#fff; color:#000; border-radius:10px; }',
    '.clib-clock{ display:block; width:200px; max-width:100%; margin:10px auto; background:#fff; border-radius:50%; }',
    '.clib-print-area{ display:block; }',
    '.clib-letter{ max-width:640px; margin:0 auto; line-height:1.9; font-size:1.05rem; background:var(--clib-card); padding:18px 22px; border-radius:12px; }',
    '.clib-rubric{ list-style:none; padding:0; margin:8px 0; display:grid; gap:8px; }',
    '.clib-rubric li{ display:flex; flex-wrap:wrap; justify-content:space-between; gap:2px 10px; background:var(--clib-card); border:1px solid var(--clib-line); border-radius:12px; padding:8px 12px; font-weight:800; }',
    '.clib-rubric small{ flex-basis:100%; color:var(--clib-soft); font-weight:700; }',
    '.clib-center{ text-align:center; }',
    '.clib-num-big{ display:block; margin:10px auto; max-width:200px; width:100%; box-sizing:border-box; font-weight:800; font-size:2rem; font-family:inherit; text-align:center; color:var(--clib-ink); background:var(--clib-bg); border:2px solid var(--clib-line); border-radius:14px; padding:8px; }',
    '.clib-conf, .clib-out, .clib-facts{ margin:10px 0; font-weight:700; } .clib-conf{ color:var(--clib-soft); } .clib-out{ background:var(--clib-bg); border-radius:12px; padding:10px 12px; }',
    '.clib-facts{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }',
    '.clib-tabs{ display:flex; flex-wrap:wrap; gap:8px; margin:0 auto 12px; }',
    '.clib-inline{ display:inline-flex; align-items:center; gap:6px; font-weight:800; margin:4px 8px 4px 0; } .clib-inline input{ width:5em; font-weight:700; font-size:1rem; font-family:inherit; color:var(--clib-ink); background:var(--clib-bg); border:1px solid var(--clib-line); border-radius:8px; padding:5px 8px; }',
    '.clib-op{ width:auto; max-width:7em; }',
    '.clib-vis{ display:block; width:100%; max-width:640px; margin:8px auto; color:var(--clib-ink); } .clib-vis svg{ width:100%; height:auto; color:var(--clib-ink); }',
    '.clib-blocks{ display:flex; flex-wrap:wrap; align-items:flex-end; gap:6px; margin:10px 0; }',
    '.clib-b100{ width:60px; height:60px; border:1px solid var(--clib-accent); background:repeating-linear-gradient(0deg, transparent 0 5px, var(--clib-accent) 5px 6px), repeating-linear-gradient(90deg, transparent 0 5px, var(--clib-accent) 5px 6px), var(--clib-card); }',
    '.clib-b10{ width:6px; height:60px; border:1px solid var(--clib-accent); background:repeating-linear-gradient(0deg, transparent 0 5px, var(--clib-accent) 5px 6px), var(--clib-card); }',
    '.clib-b1{ width:6px; height:6px; background:var(--clib-warm); border:1px solid var(--clib-ink); box-sizing:content-box; }',
    '.clib-groups{ display:flex; flex-wrap:wrap; gap:10px; margin:10px 0; justify-content:center; }',
    '.clib-group{ border:2px solid var(--clib-line); border-radius:14px; padding:8px 10px; background:var(--clib-card); font-size:1.4rem; max-width:160px; text-align:center; }',
    '.clib-shape{ max-width:100%; height:auto; } .clib-range{ width:100%; } .clib-centre-row{ justify-content:center; }',
    '.clib-coin{ width:64px; height:64px; border-radius:50%; border:3px solid #b8860b; background:radial-gradient(circle at 35% 30%, #ffe08a, #e0a82e); color:#21363a; font-weight:800; font-size:1rem; font-family:inherit; cursor:pointer; }',
    '.clib-coin:focus-visible{ outline:3px solid var(--clib-accent); outline-offset:2px; }',
    '.clib-paid{ display:flex; flex-wrap:wrap; gap:6px; justify-content:center; min-height:44px; margin:8px 0; font-weight:800; }',
    '.clib-sudoku{ display:grid; grid-template-columns:repeat(4, 56px); grid-auto-rows:56px; margin:12px auto; width:max-content; border:3px solid var(--clib-ink); }',
    '.clib-cell{ box-sizing:border-box; width:56px; height:56px; display:flex; align-items:center; justify-content:center; text-align:center; font-weight:700; font-size:1.6rem; font-family:inherit; color:var(--clib-ink); background:var(--clib-card); border:1px solid var(--clib-line); border-radius:0; padding:0; }',
    '.clib-cell.given{ font-weight:800; background:var(--clib-bg); } input.clib-cell{ color:var(--clib-accent); } .clib-cell.no{ background:rgba(181,69,47,.18); color:var(--clib-bad); }',
    '.clib-sudoku > :nth-child(4n+2){ border-right:3px solid var(--clib-ink); } .clib-sudoku > :nth-child(n+5):nth-child(-n+8), .clib-sudoku > :nth-child(n+13){ border-top:0; }',
    '.clib-sudoku > :nth-child(n+5):nth-child(-n+8){ border-bottom:3px solid var(--clib-ink); }',
    '.clib-seq{ letter-spacing:.15em; }',
    '@media (max-width: 420px){ .clib-tiles{ grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); } .clib-huge{ font-size:1.8rem; } }',
    '.clib-center ol, .clib-center ul{ text-align:left; display:inline-block; margin-left:auto; margin-right:auto; }',
    '@media print{',
    '  body.clib-printing{ overflow:visible; } body.clib-printing > *{ display:none !important; }',
    '  body.clib-printing > .clib{ display:block !important; position:static; background:#fff; color:#000; }',
    '  body.clib-printing .clib-head, body.clib-printing .clib-noprint{ display:none !important; }',
    '  body.clib-printing .clib-body > *:not(.clib-print-area), body.clib-printing .clib-why{ display:none !important; }',
    '  body.clib-printing .clib{ --clib-bg:#fff; --clib-card:#fff; --clib-ink:#000; --clib-soft:#444; --clib-line:#999; }',
    '  body.clib-printing .clib-body{ overflow:visible; padding:0; } body.clib-printing .clib-body > *{ max-width:none; }',
    '  body.clib-printing .clib-card{ border:0; padding:0; background:#fff; color:#000; }',
    '  body.clib-printing .clib-keypage{ display:block; break-before:page; } body.clib-printing .clib-keypage .clib-key{ display:inline; font-weight:800; }',
    '}'
  ].join('\n');

})();
