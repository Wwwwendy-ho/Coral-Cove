  /* ---------- Ask Shelly (Lumi at night): what a word or sentence means and how it's built ---------- */
  // Needs Claude (the `sample` capability). Where it isn't available (GitHub copy, a view without it)
  // the button never appears. Only the question and the card on screen are sent: no profile data.
  var Ask = { ns: undefined, open: false, busy: false, q: '', res: null, err: '' };
  function askNS(){
    if(Ask.ns !== undefined) return Promise.resolve(Ask.ns);
    if(!(window.claude && window.claude.use)){ Ask.ns = null; return Promise.resolve(null); }
    return window.claude.use('sample').then(function(ns){ Ask.ns = ns || null; return Ask.ns; }).catch(function(){ Ask.ns = null; return null; });
  }
  function askName(){ try { return coveSwimName() || 'Shelly'; } catch(e){ return 'Shelly'; } }
  function askPlain(s){ var d = document.createElement('div'); d.innerHTML = String(s == null ? '' : s); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  // The card on screen right now, if there is one.
  function askCard(){
    var c = null;
    try {
      if(S.view === 'study') c = S.studyQueue[0];
      else {
        var f = { feed:['feedQueue','feedIndex'], langFeed:['langQueue','langIndex'], flashFeed:['flashQueue','flashIndex'] }[S.view];
        var q = f && S[f[0]], n = q ? q.length : 0;
        if(n) c = q[(((S[f[1]] || 0) % n) + n) % n];
      }
    } catch(e){ c = null; }
    if(!c) return null;
    var front = askPlain(c.front).slice(0, 120), back = askPlain(c.back).slice(0, 200);
    return front ? { front: front, back: back } : null;
  }
  function askShowable(){
    return !!(S.booted && S.activeProfileId && !S.pinPromptFor && !S.creatingProfile && !S.managingProfiles && !S.profileLoading);
  }
  function askSyncBtn(){
    var b = document.getElementById('askBtn');
    var want = askShowable(); // offline it still explains Korean, English and Chinese words (askLocal)
    if(!want){ if(b) b.remove(); return; }
    if(!b){
      b = document.createElement('button');
      b.id = 'askBtn'; b.type = 'button'; b.className = 'ask-btn';
      b.addEventListener('click', askOpen);
      document.body.appendChild(b);
    }
    var label = 'Ask ' + askName();
    if(b.dataset.label !== label){ b.dataset.label = label; b.innerHTML = '<span class="ask-btn-q" aria-hidden="true">' + ccIcon('ask') + '</span><span>' + esc(label) + '</span>'; }
  }
  function askResHTML(){
    if(Ask.busy) return '<p class="ask-wait">' + esc(askName()) + ' is thinking…</p>';
    if(Ask.err) return '<p class="ask-err">' + esc(Ask.err) + '</p>';
    var r = Ask.res; if(!r) return '';
    var h = '<p class="ask-q">' + esc(Ask.q) + '</p>';
    if(r.answer) h += '<p class="ask-a">' + esc(r.answer) + '</p>';
    if(r.parts.length) h += '<p class="ask-sub">The parts</p><ol class="ask-parts">' + r.parts.map(function(p){
      return '<li><b>' + esc(p.part) + '</b><span>' + esc(p.meaning) + '</span></li>'; }).join('') + '</ol>';
    if(r.example) h += '<p class="ask-sub">Example</p><p class="ask-ex">' + esc(r.example) + '</p>';
    h += '<button type="button" class="btn btn-ghost ask-read" data-ask="read">🔊 Read it to me</button>';
    return h;
  }
  function askRender(){
    var w = document.getElementById('askWrap'); if(!w) return;
    var name = askName(), card = askCard();
    var chips = card ? [
      'What does “' + card.front + '” mean?',
      'What are the parts of “' + card.front + '”?'
    ] : [];
    w.querySelector('.ask-sheet').innerHTML =
      '<div class="ask-head">' + (name === 'Lumi' ? lumiSVG('ask-face lumi') : mascotTurtleSVG('ask-face')) +
        '<div class="ask-title"><h2 id="askTitle">Ask ' + esc(name) + '</h2><p>Ask what a word or sentence means, or what its parts are.</p></div>' +
        '<button type="button" class="icon-btn ask-x" data-ask="close" aria-label="Close">'+ccIcon('close')+'</button></div>' +
      (chips.length ? '<div class="ask-chips">' + chips.map(function(c, i){ return '<button type="button" class="ask-chip" data-ask-chip="' + i + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') +
      '<form class="ask-form" data-ask-form><input id="askIn" type="text" maxlength="200" autocomplete="off" placeholder="Type a word or a question" aria-label="Your question"><button class="btn btn-primary" type="submit"' + (Ask.busy ? ' disabled' : '') + '>Ask</button></form>' +
      '<div class="ask-res" aria-live="polite">' + askResHTML() + '</div>' +
      '<button type="button" class="btn btn-ghost ask-done" data-ask="close">Done</button>';
    w._chips = chips;
  }
  // Offline answers: Korean from koLocalAnswer, English and Chinese from words.js (its dictionary loads on first use).
  function askWords(){ return window.CoralWords ? window.CoralWords.load().catch(function(){}) : Promise.resolve(); }
  function askLocal(q, card){ return koLocalAnswer(q, card) || (window.CoralWords ? window.CoralWords.answer(q, card) : null); }
  function askOpen(){
    if(document.getElementById('askWrap')) return;
    askWords();
    var w = document.createElement('div');
    w.id = 'askWrap'; w.className = 'ask-wrap';
    w.innerHTML = '<div class="ask-sheet" role="dialog" aria-modal="true" aria-labelledby="askTitle"></div>';
    document.body.appendChild(w);
    Ask.open = true;
    askRender();
    w.addEventListener('click', function(e){
      if(e.target === w){ askClose(); return; }
      var a = e.target.closest('[data-ask]'), c = e.target.closest('[data-ask-chip]');
      if(a && a.dataset.ask === 'close'){ askClose(); return; }
      if(a && a.dataset.ask === 'read' && Ask.res){
        var r = Ask.res, t = [r.answer].concat(r.parts.map(function(p){ return p.part + ': ' + p.meaning; }), r.example ? [r.example] : []).join('. ');
        try { Speech.speak(t); } catch(err){}
        return;
      }
      if(c && w._chips){ askGo(w._chips[+c.dataset.askChip]); }
    });
    w.addEventListener('submit', function(e){
      e.preventDefault();
      var i = document.getElementById('askIn'), q = (i && i.value || '').trim();
      if(q) askGo(q);
    });
    w._key = function(e){ if(e.key === 'Escape'){ e.preventDefault(); askClose(); } };
    document.addEventListener('keydown', w._key);
    setTimeout(function(){ var x = w.querySelector('.ask-chip') || document.getElementById('askIn'); if(x) x.focus(); }, 60);
  }
  function askClose(){
    var w = document.getElementById('askWrap'); if(!w) return;
    document.removeEventListener('keydown', w._key);
    w.remove(); Ask.open = false;
    var b = document.getElementById('askBtn'); if(b) b.focus();
  }
  function askGo(q){
    q = String(q || '').trim().slice(0, 200);
    if(!q || Ask.busy) return;
    var card = askCard();
    Ask.q = q; Ask.busy = true; Ask.err = ''; Ask.res = null; askRender();
    var prompt = 'You are ' + askName() + ', a friendly sea helper in a flashcard app. The person asking is a 12-year-old learner (reading at about a first-grade level) or their tutor. ' +
      'You only explain words and sentences in any language (for example Korean, English or Chinese): what they mean, and how they are built from parts (syllables, roots, particles, words). ' +
      'Use short, simple, literal sentences. No idioms, no sarcasm. Be warm and calm. ' +
      'For Korean, write each part in Hangul with its romanization in brackets, like "찜 (jjim)". For Chinese, add pinyin. ' +
      'If the question is not about a word or a sentence, say kindly in one sentence that you help with words and sentences, and leave parts and example empty. ' +
      (card ? 'The card on screen says: "' + card.front + '"' + (card.back ? ' (other side: "' + card.back + '")' : '') + '. ' : '') +
      'Question: ' + q + '\n' +
      'Reply with JSON only: {"answer":"1-2 short sentences that answer the question","parts":[{"part":"one piece of the word or sentence","meaning":"what that piece means, in a few words"}],"example":"one short example sentence using the word, or an empty string"}. ' +
      'Give 2-6 parts when the word or sentence can be split; an empty list when it cannot.';
    var name = askName();
    askWords().then(askNS).then(function(ns){
      if(!ns || navigator.onLine === false){ var loc = askLocal(q, card); if(loc) return loc; throw { code: 'not_available' }; }
      return ns.json(prompt, { modelTier: 'default', cache: true });
    }).then(function(r){
      r = r || {};
      Ask.res = {
        answer: String(r.answer || '').slice(0, 400),
        parts: (Array.isArray(r.parts) ? r.parts : []).filter(function(p){ return p && p.part; }).slice(0, 8)
          .map(function(p){ return { part: String(p.part).slice(0, 60), meaning: String(p.meaning || '').slice(0, 160) }; }),
        example: String(r.example || '').slice(0, 200)
      };
      if(!Ask.res.answer && !Ask.res.parts.length) Ask.err = name + ' did not find an answer. Try asking in a different way.';
    }).catch(function(e){
      var loc = askLocal(q, card); if(loc){ Ask.res = loc; return; }
      if(e && e.code === 'not_available'){ Ask.err = name + ' can explain Korean, English and Chinese words without the internet. Type one word, like “turtle”, “거북이” or “烏龜”.'; return; }
      Ask.err = e && e.code === 'not_granted' ? name + ' needs permission to answer. Tap Ask again and choose Allow.'
        : e && e.code === 'rate_limited' ? name + ' needs a short rest. Try again in one minute.'
        : name + ' cannot answer right now. Try again in one minute.';
    }).then(function(){
      Ask.busy = false; askRender();
      var i = document.getElementById('askIn'); if(i && !Ask.err) i.value = '';
    });
  }
  afterRender('ask', function(){ askSyncBtn(); if(Ask.open) askRender(); });
  askNS().then(function(){ try { askSyncBtn(); } catch(e){} });
