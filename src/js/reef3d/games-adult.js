  /* ---------- Grown-up minigames: built from the profile's own decks, with scores and a personal best ----------
     A grown-up profile with Korean decks (Wendy) gets six Korean games; any other grown-up profile gets Tide Pairs
     and Bubble Catch from its decks. A profile with too few usable cards falls back to the children's games. */
  var MG_KL = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', MG_KT = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
  function koV(i){ return String.fromCharCode(0x314F + i); }
  function koHas(t){ return /[가-힣]/.test(t); }
  // 감 -> [ㄱ, ㅏ, ㅁ] (compatibility jamo, the way they're typed and taught)
  function koParts(ch){
    var c = ch.charCodeAt(0) - 0xAC00; if(c < 0 || c > 11171) return null;
    var t = c % 28, v = Math.floor(c / 28) % 21, l = Math.floor(c / 588);
    return [MG_KL[l], koV(v)].concat(t ? [MG_KT[t]] : []);
  }
  // the block as far as it's built: ㄱ, 가, 감
  function koJoin(parts){
    if(parts.length < 2) return parts[0] || '';
    var l = MG_KL.indexOf(parts[0]), v = parts[1].charCodeAt(0) - 0x314F, t = parts[2] ? MG_KT.indexOf(parts[2]) : 0;
    return String.fromCharCode(0xAC00 + (l * 21 + v) * 28 + t);
  }
  var KO_SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  var KO_NAT1 = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'], KO_NAT10 = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
  function koSino(n){ var t = Math.floor(n / 10), u = n % 10; return (t > 1 ? KO_SINO[t] : '') + (t ? '십' : '') + KO_SINO[u]; }
  function koNative(n){ return KO_NAT10[Math.floor(n / 10)] + KO_NAT1[n % 10]; }

  function reefIsAdult(){ return !!(S.profile && S.profile.mode === 'adult'); }
  // Everything the games draw on, read once per profile from its decks.
  function reefAdultPool(){
    var pid = S.profile && S.profile.id;
    if(R3.adultPool && R3.adultPool.pid === pid) return R3.adultPool.p;
    var decks = (S.decks || []).filter(function(d){ return !d.archived; });
    var get = function(d){ return (S.store && S.store.getCardsOnce ? Promise.resolve(S.store.getCardsOnce(d.id)) : Promise.resolve([])).then(function(cs){ return cs || []; }, function(){ return []; }); };
    var p = Promise.all(decks.map(get)).then(function(all){
      var pool = { pairs: [], ko: [], blocks: [], sentences: [], twins: [], counts: [] }, seenP = {}, seenK = {}, seenS = {};
      all.forEach(function(cards){ cards.forEach(function(c){
        var unq = function(t){ return reefPlainText(t).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim(); }, f = unq(c.front), b = unq(c.back);
        if(!f || !b || f === b) return;
        var choices = (Array.isArray(c.choices) ? c.choices : []).map(function(x){ return reefPlainText(x); }).filter(Boolean);
        if(c.mode === 'numsys' && choices.length) return pool.counts.push({ k: f, e: b, opts: [f].concat(choices.slice(0, 3)) });
        if(c.mode === 'listen' && choices.length && koHas(f)) return pool.twins.push({ k: f, e: b, opts: [f].concat(choices.slice(0, 3)) });
        if(f.length <= 24 && b.length <= 24 && !seenP[f + '|' + b]){ seenP[f + '|' + b] = 1; pool.pairs.push({ a: f, b: b }); }
        var k = koHas(f) && !koHas(b) ? f : koHas(b) && !koHas(f) ? b : null, e = k === f ? b : f;
        if(!k) return;
        if(/\s/.test(k.trim()) && k.length <= 30 && e.length <= 40){
          if(!seenS[k]){ seenS[k] = 1; pool.sentences.push({ k: k, e: e }); }
          return;
        }
        if(k.length <= 12 && e.length <= 24 && !seenK[k]){
          seenK[k] = 1; pool.ko.push({ k: k, e: e });
          var w = k.replace(/[.!?,"']/g, '');
          if(/^[가-힣]{1,3}$/.test(w) && e.length <= 18) pool.blocks.push({ k: w, e: e });
        }
      }); });
      return pool;
    });
    R3.adultPool = { pid: pid, p: p };
    return p;
  }
  var REEF_ADULT_GAMES = [
    { id: 'kblock', ic: 'hangul', name: 'Hangul Blocks', how: 'Hear a word, then build it piece by piece: first consonant, vowel, then the bottom consonant.', need: function(p){ return p.blocks.length >= 4; }, play: reefGameBlocks },
    { id: 'ktwins', ic: 'ear', name: 'Echo Shell', how: 'Listen closely and pick the word you hear. Tap the shell to hear it again.', need: function(p){ return p.twins.length + p.ko.length >= 8; }, play: reefGameEcho },
    { id: 'ksent', ic: 'sentence', name: 'Sentence Current', how: 'Tap the words in order to build the Korean sentence.', need: function(p){ return p.sentences.length >= 4; }, play: reefGameSentence },
    { id: 'knum', ic: 'counting', name: 'Counting Cove', how: 'Sino-Korean or native Korean? Pick the right way to say each number.', need: function(p){ return p.ko.length > 0; }, play: reefGameCount2 },
    { id: 'pairs', ic: 'pairs', name: 'Tide Pairs', how: 'Match each word with its meaning as fast as you can.', need: function(p){ return p.pairs.length >= 6; }, play: reefGamePairs, any: true },
    { id: 'catch', ic: 'bubbles', name: 'Bubble Catch', how: 'Catch the bubble with the right answer before it floats away.', need: function(p){ return p.pairs.length >= 6; }, play: reefGameCatch, any: true }
  ];
  // The games this profile plays: calls back with a list (the children's games for children).
  function reefGamesFor(cb){
    if(!reefIsAdult()) return cb(REEF_GAMES);
    reefAdultPool().then(function(pool){
      var ko = pool.ko.length >= 8;
      var list = REEF_ADULT_GAMES.filter(function(g){ return (ko || g.any) && g.need(pool); });
      cb(list.length >= 2 ? list.map(function(g){ return Object.assign({ pool: pool }, g); }) : REEF_GAMES);
    }, function(){ cb(REEF_GAMES); });
  }
  function reefGameIcon(g, cls){ return g.ic ? ccIcon(g.ic, cls) : esc(g.e); }
  // Personal best per profile and game. higher: more is better (points); otherwise less is better (seconds).
  function reefBest(id, score, higher){
    var key = 'cc-mg-best-' + (S.profile && S.profile.id) + '-' + id, old = null;
    try { old = localStorage.getItem(key); } catch(e){}
    old = old == null ? null : +old;
    var isNew = old == null || (higher ? score > old : score < old);
    if(isNew){ try { localStorage.setItem(key, String(score)); } catch(e){} }
    return { best: isNew ? score : old, isNew: isNew && old != null, first: old == null };
  }
  function reefScoreNote(id, score, higher, fmt){
    var b = reefBest(id, score, higher);
    return fmt(score) + (b.first ? '' : b.isNew ? ' · <b>New best!</b>' : ' · Best: ' + fmt(b.best));
  }
  function reefSay(t){ try { Speech.speak(t); } catch(e){} }
  function reefPick(a, n){ return reefShuffle(a.slice()).slice(0, n); }
  function reefShake(b){ b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); try { Sound.bloop(300); } catch(e){} }
  function reefHearBtn(label){ return '<button type="button" class="r3-hear" data-hear aria-label="' + esc(label || 'Hear it again') + '">' + ccIcon('sound') + '</button>'; }

  // Hangul Blocks: four short words from her decks, built syllable by syllable from the jamo.
  function reefGameBlocks(play, finish, g){
    var words = reefPick(g.pool.blocks, 4), wi = 0, slips = 0, peeks = 0;
    function word(){
      if(wi === words.length) return finish(true, reefScoreNote('kblock', slips + peeks, false, function(n){ return n === 0 ? 'No slips' : n + (n === 1 ? ' slip' : ' slips'); }));
      var w = words[wi], syl = w.k.split(''), si = 0, built = [];
      function pad(){
        var need = koParts(syl[si]), pieces = need.filter(function(x, i){ return need.indexOf(x) === i; });
        var pool = MG_KL.split('').concat([0, 1, 2, 4, 6, 8, 12, 13, 17, 18, 20].map(koV), ['ㄴ', 'ㅁ', 'ㅇ', 'ㄹ']);
        while(pieces.length < 8){ var x = pool[Math.floor(Math.random() * pool.length)]; if(pieces.indexOf(x) < 0) pieces.push(x); }
        return reefShuffle(pieces);
      }
      function draw(){
        var need = koParts(syl[si]);
        play.innerHTML = '<p class="r3-mini-ask">Word ' + (wi + 1) + ' of ' + words.length + ': <b>' + esc(w.e) + '</b> ' + reefHearBtn('Hear the word') + '</p>' +
          '<div class="r3-kslots">' + syl.map(function(s, i){ return '<span class="r3-kslot' + (i < si ? ' done' : i === si ? ' now' : '') + '">' + (i < si ? s : i === si ? esc(koJoin(built)) : '') + '</span>'; }).join('') + '</div>' +
          '<p class="r3-khint">' + (built.length === 0 ? 'First consonant' : built.length === 1 ? 'Vowel' : 'Bottom consonant') + '</p>' +
          '<div class="r3-kpad">' + pad().map(function(j){ return '<button type="button" class="r3-kjamo" data-j="' + j + '">' + j + '</button>'; }).join('') + '</div>' +
          '<div class="r3-panel-row"><button type="button" class="r3-btn" data-peek>Peek</button></div>';
        play.dataset.need = need.join('');
      }
      play.onclick = function(e){
        if(e.target.closest('[data-hear]')) return reefSay(w.k);
        if(e.target.closest('[data-peek]')){ peeks++; var sl = play.querySelectorAll('.r3-kslot'); sl.forEach(function(s, i){ s.dataset.was = s.textContent; s.textContent = syl[i]; s.classList.add('peek'); }); setTimeout(function(){ sl.forEach(function(s){ s.textContent = s.dataset.was; s.classList.remove('peek'); }); }, 1400); return; }
        var b = e.target.closest('.r3-kjamo'); if(!b) return;
        var need = koParts(syl[si]);
        if(b.dataset.j !== need[built.length]){ slips++; return reefShake(b); }
        built.push(b.dataset.j); try { Sound.bloop(700 + built.length * 140, 0, .05); } catch(err){}
        if(built.length === need.length){
          si++; built = [];
          if(si === syl.length){ try { Sound.correct(); } catch(err){} reefSay(w.k); play.querySelectorAll('.r3-kslot').forEach(function(s, i){ s.textContent = syl[i]; s.className = 'r3-kslot done'; }); wi++; return setTimeout(word, 1300); }
          return draw();
        }
        var now = play.querySelector('.r3-kslot.now'); if(now) now.textContent = koJoin(built);
        var h = play.querySelector('.r3-khint'); if(h) h.textContent = built.length === 1 ? 'Vowel' : 'Bottom consonant';
      };
      draw(); setTimeout(function(){ reefSay(w.k); }, 300);
    }
    word();
  }

  // Echo Shell: eight words read aloud; pick the one heard (sound twins like 달 / 탈 / 딸) or its meaning.
  function reefGameEcho(play, finish, g){
    var p = g.pool, rounds = reefPick(p.twins, 4).map(function(t){ return { say: t.k, ok: t.k, opts: reefShuffle(t.opts.slice()), ko: true }; });
    reefPick(p.ko, 8 - rounds.length).forEach(function(w){
      var wrong = reefPick(p.ko.filter(function(x){ return x.e !== w.e; }), 3).map(function(x){ return x.e; });
      rounds.push({ say: w.k, ok: w.e, opts: reefShuffle([w.e].concat(wrong)), ko: false });
    });
    reefShuffle(rounds);
    var ri = 0, right = 0, missed = false;
    function next(){
      if(ri === rounds.length) return finish(right >= 6, reefScoreNote('ktwins', right, true, function(n){ return n + ' of ' + rounds.length + ' right'; }));
      var r = rounds[ri]; missed = false;
      play.innerHTML = '<p class="r3-mini-ask">' + (ri + 1) + ' of ' + rounds.length + ': ' + (r.ko ? 'which word do you hear?' : 'what does it mean?') + '</p>' +
        '<button type="button" class="r3-echo" data-hear aria-label="Hear it again">' + ccIcon('sound') + '</button>' +
        '<div class="r3-kopts' + (r.ko ? ' ko' : '') + '">' + r.opts.map(function(o){ return '<button type="button" class="r3-kopt" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
      setTimeout(function(){ reefSay(r.say); }, 250);
    }
    play.onclick = function(e){
      var r = rounds[ri]; if(!r) return;
      if(e.target.closest('[data-hear]')) return reefSay(r.say);
      var b = e.target.closest('.r3-kopt'); if(!b || b.disabled) return;
      if(b.dataset.o === r.ok){ b.classList.add('got'); if(!missed) right++; try { Sound.correct(); } catch(err){} play.querySelectorAll('.r3-kopt').forEach(function(x){ x.disabled = true; }); ri++; setTimeout(next, 800); }
      else { missed = true; b.disabled = true; reefShake(b); }
    };
    next();
  }

  // Sentence Current: four sentences; tap the Korean words in order.
  function reefGameSentence(play, finish, g){
    var list = reefPick(g.pool.sentences, 4), si = 0, slips = 0;
    function next(){
      if(si === list.length) return finish(true, reefScoreNote('ksent', slips, false, function(n){ return n === 0 ? 'No slips' : n + (n === 1 ? ' slip' : ' slips'); }));
      var s = list[si], words = s.k.split(/\s+/), order = reefShuffle(words.map(function(w, i){ return i; })), at = 0;
      if(order.join() === words.map(function(w, i){ return i; }).join() && words.length > 1) order.reverse();
      play.innerHTML = '<p class="r3-mini-ask">' + (si + 1) + ' of ' + list.length + ': <b>' + esc(s.e) + '</b></p>' +
        '<div class="r3-kline" aria-live="polite"></div>' +
        '<div class="r3-kwords">' + order.map(function(i){ return '<button type="button" class="r3-kword" data-i="' + i + '">' + esc(words[i]) + '</button>'; }).join('') + '</div>';
      var line = play.querySelector('.r3-kline');
      play.onclick = function(e){
        var b = e.target.closest('.r3-kword'); if(!b || b.disabled) return;
        // a repeated word can go in either of its places
        if(words[+b.dataset.i] !== words[at]){ slips++; return reefShake(b); }
        b.disabled = true; b.classList.add('used'); line.insertAdjacentHTML('beforeend', '<span>' + esc(words[at]) + '</span> '); at++;
        try { Sound.bloop(650 + at * 90, 0, .05); } catch(err){}
        if(at === words.length){ try { Sound.correct(); } catch(err){} line.classList.add('done'); reefSay(s.k); si++; setTimeout(next, 1700); }
      };
    }
    next();
  }

  // Counting Cove: the deck's counter questions (두 개 or 이 개?) and numbers to say the Sino or native way.
  function reefGameCount2(play, finish, g){
    var rounds = reefPick(g.pool.counts, 3).map(function(c){ return { ask: c.e, ok: c.k, opts: reefShuffle(c.opts.slice()) }; });
    while(rounds.length < 6){
      var sino = rounds.length % 2 === 0, n = sino ? 11 + Math.floor(Math.random() * 89) : 2 + Math.floor(Math.random() * 38);
      var say = sino ? koSino : koNative, ok = say(n), wrong = {};
      [sino ? koNative(n) : koSino(n), say(n + 1), say(n > 2 ? n - 1 : n + 2), n >= 12 && n % 10 && n % 11 ? say((n % 10) * 10 + Math.floor(n / 10)) : say(n + 10)]
        .forEach(function(x){ if(x && x !== ok) wrong[x] = 1; });
      rounds.push({ ask: '<span class="r3-knum">' + n + '</span> ' + (sino ? 'the Sino-Korean way (dates, money, phone numbers)' : 'the native Korean way (counting things, age)'), html: true, ok: ok, opts: reefShuffle([ok].concat(Object.keys(wrong).slice(0, 3))) });
    }
    reefShuffle(rounds);
    var ri = 0, right = 0, missed = false;
    function next(){
      if(ri === rounds.length) return finish(right >= 4, reefScoreNote('knum', right, true, function(n){ return n + ' of ' + rounds.length + ' right'; }));
      var r = rounds[ri]; missed = false;
      play.innerHTML = '<p class="r3-mini-ask">' + (ri + 1) + ' of ' + rounds.length + ': ' + (r.html ? r.ask : '<b>' + esc(r.ask) + '</b>') + '</p>' +
        '<div class="r3-kopts ko">' + r.opts.map(function(o){ return '<button type="button" class="r3-kopt" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
    }
    play.onclick = function(e){
      var r = rounds[ri]; if(!r) return;
      var b = e.target.closest('.r3-kopt'); if(!b || b.disabled) return;
      if(b.dataset.o === r.ok){ b.classList.add('got'); if(!missed) right++; try { Sound.correct(); } catch(err){} reefSay(r.ok); play.querySelectorAll('.r3-kopt').forEach(function(x){ x.disabled = true; }); ri++; setTimeout(next, 1200); }
      else { missed = true; b.disabled = true; reefShake(b); }
    };
    next();
  }

  // Tide Pairs: five words and five meanings; tap one of each to match. Timed, with a personal best.
  function reefGamePairs(play, finish, g){
    var src = g.pool.ko.length >= 8 ? g.pool.ko.map(function(w){ return { a: w.k, b: w.e }; }) : g.pool.pairs, seen = {};
    var set = reefShuffle(src.slice()).filter(function(p){ if(seen[p.a] || seen[p.b]) return false; seen[p.a] = seen[p.b] = 1; return true; }).slice(0, 5);
    var left = reefShuffle(set.map(function(p, i){ return i; })), right = reefShuffle(set.map(function(p, i){ return i; }));
    var t0 = Date.now(), pick = null, got = 0, slips = 0;
    play.innerHTML = '<p class="r3-mini-ask">Match all five pairs.</p><div class="r3-pairs"><div>' +
      left.map(function(i){ return '<button type="button" class="r3-kpair a" data-k="' + i + '">' + esc(set[i].a) + '</button>'; }).join('') + '</div><div>' +
      right.map(function(i){ return '<button type="button" class="r3-kpair b" data-k="' + i + '">' + esc(set[i].b) + '</button>'; }).join('') + '</div></div>';
    play.onclick = function(e){
      var b = e.target.closest('.r3-kpair'); if(!b || b.disabled) return;
      if(!pick || pick.classList.contains(b.classList.contains('a') ? 'a' : 'b')){ if(pick) pick.classList.remove('sel'); pick = b; b.classList.add('sel'); if(b.classList.contains('a') && koHas(b.textContent)) reefSay(b.textContent); return; }
      if(pick.dataset.k === b.dataset.k){
        [pick, b].forEach(function(x){ x.classList.remove('sel'); x.classList.add('got'); x.disabled = true; }); pick = null; got++;
        try { Sound.correct(); } catch(err){}
        if(got === set.length){ var secs = Math.round((Date.now() - t0) / 1000) + slips * 2; setTimeout(function(){ finish(true, reefScoreNote('pairs', secs, false, function(n){ return n + ' seconds'; }) + (slips ? '<br><small>(includes 2 seconds for each of ' + slips + ' slips)</small>' : '')); }, 600); }
      } else { slips++; reefShake(b); pick.classList.remove('sel'); pick = null; }
    };
  }

  // Bubble Catch: ten prompts; four answer bubbles rise and float away after six seconds.
  function reefGameCatch(play, finish, g){
    var ko = g.pool.ko.length >= 8, src = (ko ? g.pool.ko.map(function(w){ return { q: w.e, a: w.k }; }) : g.pool.pairs.map(function(p){ return { q: p.a, a: p.b }; })).filter(function(x){ return x.a.length <= (ko ? 7 : 14); });
    var rounds = reefPick(src, 10), ri = 0, right = 0, timer = null, calm = reefCalm();
    function next(){
      clearTimeout(timer);
      if(!document.body.contains(play)) return;
      if(ri === rounds.length) return finish(right >= 7, reefScoreNote('catch', right, true, function(n){ return n + ' of ' + rounds.length + ' caught'; }));
      var r = rounds[ri], seen = {}; seen[r.a] = 1;
      var wrong = reefShuffle(src.slice()).filter(function(x){ if(seen[x.a]) return false; seen[x.a] = 1; return true; }).slice(0, 3).map(function(x){ return x.a; });
      var opts = reefShuffle([r.a].concat(wrong));
      play.innerHTML = '<p class="r3-mini-ask">' + (ri + 1) + ' of ' + rounds.length + ': <b>' + esc(r.q) + '</b></p>' +
        '<div class="r3-catch' + (calm ? ' calm' : '') + '">' + opts.map(function(o, i){ return '<button type="button" class="r3-cbub' + (o.length > (ko ? 4 : 8) ? ' long' : '') + '" style="--x:' + (6 + i * 23) + '%;--i:' + i + ';--d:' + (i * .35).toFixed(2) + 's" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') +
        '<div class="r3-ctime"><i></i></div></div>';
      timer = setTimeout(function(){
        var ok = play.querySelector('.r3-cbub[data-o="' + CSS.escape(r.a) + '"]');
        play.querySelectorAll('.r3-cbub').forEach(function(x){ x.disabled = true; });
        if(ok){ ok.classList.add('reveal'); }
        try { Sound.bloop(260); } catch(err){}
        ri++; timer = setTimeout(next, 1300);
      }, 6400);
    }
    play.onclick = function(e){
      var r = rounds[ri]; if(!r) return;
      var b = e.target.closest('.r3-cbub'); if(!b || b.disabled) return;
      if(b.dataset.o === r.a){
        clearTimeout(timer); b.classList.add('got'); right++; try { Sound.bloop(900 + Math.random() * 300, 0, .05); } catch(err){}
        play.querySelectorAll('.r3-cbub').forEach(function(x){ x.disabled = true; });
        if(koHas(r.a)) reefSay(r.a);
        ri++; timer = setTimeout(next, 900);
      } else { b.disabled = true; reefShake(b); }
    };
    next();
  }
