  /* ---------- REEF art: one small drawn scene per map place (viewBox 0 0 120 120) ---------- */
  var REEF_LINE = 'stroke="#173a44" stroke-opacity=".28" stroke-width="2" stroke-linejoin="round"';
  function reefMound(fill, top){
    return '<ellipse cx="60" cy="104" rx="50" ry="13" fill="'+(fill||'#e8c987')+'"/>' +
      '<ellipse cx="54" cy="100" rx="34" ry="6" fill="'+(top||'#f6e2b0')+'" opacity=".8"/>';
  }
  var REEF_ART = {
    reading: function(){ // an open storybook standing in the sand, kelp on both sides
      return reefMound() +
        '<path d="M22 100C14 82 28 70 20 52C14 40 22 30 18 20" fill="none" stroke="#3f9c6d" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M100 100C108 84 96 72 102 58C106 48 100 40 104 30" fill="none" stroke="#2f7d58" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M60 96L28 88V40L60 48Z" fill="#fff8e7" '+REEF_LINE+'/>' +
        '<path d="M60 96L92 88V40L60 48Z" fill="#fffdf6" '+REEF_LINE+'/>' +
        '<path d="M60 48V96" stroke="#c99a2e" stroke-width="3"/>' +
        '<path d="M26 92L60 100L94 92V86L60 94L26 86Z" fill="#2f9e6e"/>' +
        '<path d="M35 56l18 4M35 64l18 4M35 72l14 3M67 60l18-4M67 68l18-4M67 76l14-3" stroke="#7aa8b0" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cx="44" cy="30" r="4" fill="#fff" opacity=".7"/><circle cx="52" cy="20" r="2.6" fill="#fff" opacity=".6"/>';
    },
    math: function(){ // a little sunken ship with a 1-2-3 porthole
      return reefMound() +
        '<path d="M14 72L104 64L94 98Q60 106 26 100Z" fill="#b8713a" '+REEF_LINE+'/>' +
        '<path d="M18 80L101 72" stroke="#8a4f1c" stroke-width="3"/><path d="M22 90L98 83" stroke="#8a4f1c" stroke-width="3"/>' +
        '<path d="M14 72L104 64L102 58L12 66Z" fill="#d08a3f"/>' +
        '<path d="M58 66L62 18" stroke="#6b3b14" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M62 22L88 30L62 40Z" fill="#ff8a6b" '+REEF_LINE+'/>' +
        '<circle cx="40" cy="84" r="11" fill="#bff3f0" stroke="#ffd166" stroke-width="4"/>' +
        '<text x="40" y="88.5" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="11" fill="#0b5d73">123</text>' +
        '<circle cx="76" cy="82" r="6" fill="#5e3410" opacity=".45"/>';
    },
    other: function(){ // a coral garden: branching coral, a sea fan and a brain coral
      return reefMound() +
        '<path d="M86 96L84 60Q84 40 96 30Q92 46 98 58Q100 70 92 96Z" fill="#ffa94d" '+REEF_LINE+'/>' +
        '<path d="M86 92L82 52M84 70L94 46M84 80L96 66M84 62L76 44" stroke="#ffd8a8" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M42 100C41 88 38 80 31 70C27 64 25 58 27 49M37 79C45 73 49 65 47 55M31 70C23 66 19 59 20 51M47 55C47 50 50 46 54 44M47 61C53 60 57 56 58 51" fill="none" stroke="#ff6f86" stroke-width="7" stroke-linecap="round"/>' +
        '<circle cx="27" cy="48" r="4" fill="#ffc2cc"/><circle cx="20" cy="50" r="4" fill="#ffc2cc"/><circle cx="54" cy="43" r="3.6" fill="#ffc2cc"/><circle cx="58" cy="50" r="3.4" fill="#ffc2cc"/>' +
        '<path d="M50 104Q50 82 66 82Q82 82 82 104Z" fill="#9b7be0" '+REEF_LINE+'/>' +
        '<path d="M56 98q4-4 0-8t4-6M64 100q-4-5 2-9t2-8M73 98q4-5-1-9" fill="none" stroke="#d7c8ff" stroke-width="2.2" stroke-linecap="round"/>';
    },
    korean: function(){ // a rock with a glowing paper lantern
      return reefMound() +
        '<path d="M24 102Q22 70 44 62Q70 54 92 70Q102 84 98 102Z" fill="#7d8f96" '+REEF_LINE+'/>' +
        '<path d="M60 58V30" stroke="#5c3a1e" stroke-width="3"/><path d="M50 30h20" stroke="#5c3a1e" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="60" cy="46" r="20" fill="#ffd166" opacity=".35"/>' +
        '<rect x="46" y="32" width="28" height="30" rx="12" fill="#e2445c" '+REEF_LINE+'/>' +
        '<path d="M50 40h20M49 47h22M50 54h20" stroke="#ff9aa8" stroke-width="2"/>' +
        '<path d="M56 62l-2 8M60 62v9M64 62l2 8" stroke="#ffd166" stroke-width="2" stroke-linecap="round"/>';
    },
    science: function(){ // a glass flask full of bubbles
      return reefMound() +
        '<path d="M50 24h20v22l20 40q4 12-10 14H40q-14-2-10-14l20-40Z" fill="#dff6ff" fill-opacity=".85" '+REEF_LINE+'/>' +
        '<path d="M36 78h48l6 10q2 10-10 10H40q-12 0-10-10Z" fill="#4fc7cf"/>' +
        '<rect x="47" y="18" width="26" height="8" rx="4" fill="#7aa8b0"/>' +
        '<circle cx="52" cy="86" r="4" fill="#fff" opacity=".85"/><circle cx="66" cy="82" r="3" fill="#fff" opacity=".85"/><circle cx="60" cy="62" r="3.5" fill="#bff3f0"/>' +
        '<circle cx="64" cy="10" r="4" fill="#fff" opacity=".7"/><circle cx="56" cy="4" r="2.5" fill="#fff" opacity=".6"/>';
    },
    life: function(){ // a sandcastle
      return reefMound() +
        '<path d="M28 100V66h10v-6h8v6h8v-6h8v6h8v-6h8v6h10v34Z" fill="#f2cf7d" '+REEF_LINE+'/>' +
        '<path d="M48 66V40h6v-6h6v6h6v-6h6v6h-0v26" fill="#f6dc95" '+REEF_LINE+'/>' +
        '<path d="M60 100V86a8 8 0 0 1 16 0v14Z" fill="#c99a2e"/>' +
        '<path d="M60 34V14" stroke="#8a6516" stroke-width="2.5"/><path d="M60 14l14 5-14 5Z" fill="#ff8a6b"/>';
    },
    custom: function(){ // a tiny palm island
      return reefMound() +
        '<path d="M58 98Q54 70 62 44" fill="none" stroke="#a0662f" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M62 44Q40 34 26 44Q44 40 60 48ZM62 44Q84 32 98 42Q78 40 64 48ZM62 44Q56 24 40 20Q56 30 60 46ZM62 44Q72 24 88 22Q72 32 64 46Z" fill="#3f9c6d"/>' +
        '<circle cx="60" cy="48" r="4" fill="#7a4a1e"/><circle cx="66" cy="49" r="3.6" fill="#7a4a1e"/>';
    },
    treasure: function(){ // a treasure chest with gold
      return reefMound() +
        '<path d="M26 66h68v30q0 6-6 6H32q-6 0-6-6Z" fill="#a0602a" '+REEF_LINE+'/>' +
        '<path d="M24 66q0-26 36-26t36 26Z" fill="#c07a38" '+REEF_LINE+'/>' +
        '<path d="M26 66h68" stroke="#ffd166" stroke-width="5"/><path d="M40 42v58M80 42v58" stroke="#ffd166" stroke-width="4"/>' +
        '<rect x="54" y="62" width="12" height="16" rx="3" fill="#ffd166" stroke="#a8770a" stroke-width="2"/>' +
        '<circle cx="34" cy="38" r="5" fill="#ffd166"/><circle cx="88" cy="40" r="4" fill="#ffe39a"/><path d="M60 22l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" fill="#fff4c2"/>';
    },
    story: function(){ // a message in a bottle
      return reefMound() +
        '<g transform="rotate(-24 60 70)">' +
          '<path d="M30 58h44q14 0 14 14t-14 14H30q-8 0-8-14t8-14Z" fill="#8fd3e8" fill-opacity=".85" '+REEF_LINE+'/>' +
          '<path d="M88 64h12v16H88Z" fill="#8fd3e8" '+REEF_LINE+'/>' +
          '<rect x="100" y="62" width="8" height="20" rx="3" fill="#b8713a"/>' +
          '<rect x="36" y="64" width="38" height="16" rx="4" fill="#fff4d6" stroke="#c99a2e" stroke-width="2"/>' +
          '<path d="M42 70h26M42 75h18" stroke="#c99a2e" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M30 62q10-2 18 0" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>' +
        '</g>';
    }
  };
  function reefArtSVG(id){
    var f = REEF_ART[id] || REEF_ART.custom;
    return '<svg class="reef-art-svg" viewBox="0 0 120 120" aria-hidden="true">' + f() + '</svg>';
  }

  /* ============ REEF: the child's cove map, silly deck transitions, treasure rewards ============ */
  // Child Mode only (Adult Mode screens never use any of this). Every animation here is skipped
  // when "Calm motion" is on in Settings or the device asks for reduced motion -- the screen just
  // changes, the same as before.
  function reefKid(){ return !!(S.profile && S.profile.mode === 'child' && !S.managingDecks); }
  // The game experience (3D board, transitions, music, praise) for every profile; grown-up tools stay
  // reachable through Edit Mode. Child-only rules (no countdowns, the math question to leave) use reefKid().
  function reefGame(){ return !!(S.profile && (S.profile.mode === 'adult' || reefKid())); }
  function reefCalm(){
    if(S.settings && S.settings.calmMotion) return true;
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; }
  }
  function reefSyncBody(){
    document.body.classList.toggle('reef-kid', reefKid());
    document.body.classList.toggle('reef-calm', reefCalm());
  }

  // One place on the map per subject. Each keeps the same spot every time.
  var REEF_PLACES = {
    reading: { name:'Kelp Library', art:'📚', hue:'#2f9e6e', ink:'#1d6b49' },
    math:    { name:'Number Wreck', art:'⚓', hue:'#d9735a', ink:'#a24a33' },
    korean:  { name:'Lantern Reef', art:'🏮', hue:'#c2477a', ink:'#8f2c58' },
    science: { name:'Bubble Lab',   art:'🔬', hue:'#3a7bd5', ink:'#2558a0' },
    life:    { name:'Sandy Town',   art:'🏖️', hue:'#c99a2e', ink:'#8a6516' },
    other:   { name:'Coral Garden', art:'🪸', hue:'#7a5cc2', ink:'#56409a' }
  };
  function reefPlaceFor(id, label){
    var p = REEF_PLACES[id] || { name: (label || 'Secret') + ' Cove', art:'🏝️', hue:'#1c8c93', ink:'#0d5262' };
    return Object.assign({ artId: REEF_PLACES[id] ? id : 'custom' }, p);
  }
  function reefWireSay(root){
    root.querySelectorAll('[data-reef-say]').forEach(function(b){
      b.addEventListener('click', function(e){ e.stopPropagation(); try { Speech.speak(b.dataset.reefSay); } catch(err){} });
    });
  }

  /* ---------- transitions: a silly splash into a deck, a pop back up out of it ---------- */
  var reefBusy = false;
  function reefTxHTML(kind){
    var bubbles = '';
    for(var i = 0; i < 40; i++){   // a flurry of bubbles (these used to share the screen with three fish)
      var x = Math.round(Math.random() * 100), s = 10 + Math.round(Math.pow(Math.random(), 1.5) * 50), d = (0.05 + Math.random() * 0.5).toFixed(2);
      bubbles += '<span class="tx-bub" style="--x:'+x+'%;--s:'+s+'px;--d:'+d+'s"></span>';
    }
    return '' +
      '<div class="tx-water"><svg class="tx-crest" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 70 C150 10 300 10 450 60 S750 120 900 50 S1100 0 1200 50 V120 H0 Z"/></svg></div>' +
      '<div class="tx-bubbles">'+bubbles+'</div>' +
      '<div class="tx-shelly">'+mascotTurtleSVG('tx-shelly-svg')+'</div>' +
      '<canvas class="tx-splash"></canvas>';
  }
  // An animated water splash drawn on a canvas: a crown of droplets thrown up and falling back with
  // gravity, a ripple ring, and spray. 'surface' sends the spray up from the bottom edge instead.
  function reefSplash(cv, cx, cy, kind){
    if(!cv || !cv.getContext) return;
    var dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; var g = cv.getContext('2d'); g.scale(dpr, dpr);
    var up = kind === 'surface', drops = [], n = up ? 70 : 90, t0 = performance.now(), k = Math.max(.8, Math.min(W, H) / 520);
    if(up){ cx = W / 2; cy = H + 10; }
    for(var i = 0; i < n; i++){
      var a = up ? (-Math.PI / 2 + (Math.random() - .5) * 1.6) : (-Math.PI / 2 + (Math.random() - .5) * 2.4);
      var sp = ((up ? 10 : 9) + Math.random() * (up ? 10 : 11)) * k, r = (4 + Math.random() * (up ? 10 : 9)) * k;
      drops.push({ x: cx + (up ? (Math.random() - .5) * W : (Math.random() - .5) * 30), y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: r, life: .75 + Math.random() * .5 });
    }
    // One drop is painted once (gradient and glint) and then stamped for every drop, stretched along its direction
    // of travel: far cheaper than building a gradient per drop per frame, which made the dive stutter on phones.
    var spr = reefSplash.spr;
    if(!spr){
      spr = reefSplash.spr = document.createElement('canvas'); spr.width = 96; spr.height = 48; var sg = spr.getContext('2d');
      var gr = sg.createRadialGradient(38, 17, 0, 48, 24, 48); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#c9f2f2'); gr.addColorStop(1, '#4fc7cf');
      sg.fillStyle = gr; sg.beginPath(); sg.ellipse(48, 24, 47, 23, 0, 0, Math.PI * 2); sg.fill();
      sg.fillStyle = 'rgba(255,255,255,.85)'; sg.beginPath(); sg.arc(34, 16, 7, 0, Math.PI * 2); sg.fill();
    }
    function drop(d, alpha){ // a teardrop stretched along its direction of travel
      var v = Math.sqrt(d.vx * d.vx + d.vy * d.vy), ang = Math.atan2(d.vy, d.vx), len = d.r * (1 + Math.min(2.2, v / 6));
      var c = Math.cos(ang), s = Math.sin(ang);
      g.globalAlpha = alpha; g.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, d.x * dpr, d.y * dpr);
      g.drawImage(spr, -len, -d.r, len * 2, d.r * 2);
    }
    (function frame(now){
      var e = (now - t0) / 1000; g.clearRect(0, 0, W, H);
      if(!up && e < .7){ // ripple rings spreading out from the splash point
        for(var q = 0; q < 2; q++){ var re = Math.max(0, e - q * .12); g.globalAlpha = Math.max(0, .8 - re * 1.3); g.strokeStyle = "#ffffff"; g.lineWidth = 5 - q * 2;
          g.beginPath(); g.ellipse(cx, cy + 10, (40 + re * 420) * k, (12 + re * 110) * k, 0, 0, Math.PI * 2); g.stroke(); }
      }
      if(!up && e < .35){ // the crown: a sheet of water thrown up in a ring
        var c = e / .35, ch = Math.sin(c * Math.PI) * 190 * k, cw = (50 + c * 130) * k; g.globalAlpha = .85 * (1 - c * .6);
        var cg = g.createLinearGradient(0, cy - ch, 0, cy); cg.addColorStop(0, 'rgba(255,255,255,.95)'); cg.addColorStop(1, 'rgba(79,199,207,.8)');
        g.fillStyle = cg; g.beginPath(); g.moveTo(cx - cw, cy);
        for(var s = 0; s <= 8; s++){ var px = cx - cw + s / 8 * cw * 2; g.lineTo(px, cy - ch * (s % 2 ? 1 : .55)); }
        g.lineTo(cx + cw, cy); g.closePath(); g.fill();
      }
      if(!up && e > .18 && e < .75){ // the jet that shoots up from the middle after the crown
        var j = (e - .18) / .57, jh = Math.sin(j * Math.PI) * 300 * k, jw = 22 * k * (1 - j * .5);
        g.globalAlpha = .9 * (1 - j * .7); var jg = g.createLinearGradient(0, cy - jh, 0, cy); jg.addColorStop(0, '#ffffff'); jg.addColorStop(1, 'rgba(79,199,207,.85)');
        g.fillStyle = jg; g.beginPath(); g.moveTo(cx - jw, cy); g.quadraticCurveTo(cx - jw * .4, cy - jh * .6, cx, cy - jh); g.quadraticCurveTo(cx + jw * .4, cy - jh * .6, cx + jw, cy); g.closePath(); g.fill();
        g.beginPath(); g.arc(cx, cy - jh, jw * .9, 0, Math.PI * 2); g.fill();
      }
      drops.forEach(function(d){
        if(e > d.life) return;
        d.vy += .5 * k; d.x += d.vx; d.y += d.vy; drop(d, Math.min(1, (d.life - e) * 3));
      });
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = 1;
      if(e < 1.3) requestAnimationFrame(frame);
    })(t0);
  }
  // Plays a transition and calls fn while the screen is covered. With Calm motion (or in Adult
  // Mode) fn just runs straight away.
  function reefGo(kind, fromEl, fn, always){   // always: play it even outside a profile (the title screen's dive)
    if((!always && !reefGame()) || reefCalm() || reefBusy){ fn(); return; }
    reefBusy = true; window.__reefTx = true;   // the 3D board pauses underneath while the water covers it
    var ov = document.createElement('div');
    ov.className = 'reef-tx reef-tx-' + kind;
    ov.setAttribute('aria-hidden', 'true');
    if(kind === 'swim'){
      var r = fromEl && fromEl.getBoundingClientRect ? fromEl.getBoundingClientRect() : null;
      var cx = r ? r.left + r.width / 2 : innerWidth / 2, cy = r ? r.top + r.height / 2 : innerHeight / 2;
      ov.style.setProperty('--cx', cx + 'px'); ov.style.setProperty('--cy', cy + 'px');
      ov.innerHTML = '<span class="tx-iris"></span>';
    } else {
      ov.innerHTML = reefTxHTML(kind);
      try { Sound.bubbles(5); Sound.bloop(kind === 'dive' ? 300 : 520, 0.35, 0.09); } catch(e){}
    }
    document.body.appendChild(ov);
    if(kind !== 'swim'){
      reefSplash(ov.querySelector('.tx-splash'), innerWidth / 2, innerHeight * .58, kind); // always in the middle of the screen
    }
    var mid = kind === 'swim' ? 230 : 560, end = kind === 'swim' ? 560 : 1300;
    setTimeout(function(){ try { fn(); } catch(e){ console.error('[Coral Cove] transition', e); } }, mid);
    setTimeout(function(){ ov.remove(); reefBusy = false; window.__reefTx = false; }, end);
  }
  function reefInDeck(){
    return ['study','summary','feed','story','equationFeed','langFeed','readAlong','flashFeed','miniStory','wordBank'].indexOf(S.view) !== -1;
  }
  // Every way out of a deck goes through goHome(), so this is the one place that adds the pop-up.
  function goHome(){
    if(reefGame() && reefInDeck()) reefGo('surface', null, goHomeNow);
    else goHomeNow();
  }

  /* ---------- a short tutor line on a miss: the answer, then what to try next time ---------- */
  function reefTip(answer){
    var a = String(answer || '').trim(), tip;
    if(/^-?\d+([.,]\d+)?$/.test(a)) tip = 'Next time, count up on your fingers to check.';
    else if(/[가-힣]/.test(a)) tip = 'Next time, say each block out loud, one at a time.';
    else if(/\s/.test(a)) tip = 'Next time, read it one word at a time, out loud.';
    else if(/^[A-Za-z]/.test(a)) tip = 'Next time, look at the first letter, ' + esc(a.charAt(0)) + ', and say the word slowly.';
    else tip = 'Next time, say it out loud with Shelly.';
    return '<span class="reef-tip"><span class="reef-tip-face" aria-hidden="true">🐢</span><span>' + tip + ' Shelly will bring this one back soon.</span></span>';
  }
  function reefSayAnswer(answer){
    if(!reefGame()) return;
    setTimeout(function(){ try { Speech.speak('It\'s ' + answer + '.'); } catch(e){} }, 1000);
  }

  /* ---------- treasure: one sea friend for every finished round ---------- */
  var REEF_FRIENDS = [
    { id:'octopus', e:'🐙', name:'Octopus', fact:'An octopus has eight arms and three hearts.' },
    { id:'puffer', e:'🐡', name:'Pufferfish', fact:'A pufferfish puffs up into a ball when it feels scared.' },
    { id:'dolphin', e:'🐬', name:'Dolphin', fact:'A dolphin breathes air through a blowhole on top of its head.' },
    { id:'turtle', e:'🐢', name:'Sea Turtle', fact:'A sea turtle can stay under water for a long time.' },
    { id:'crab', e:'🦀', name:'Crab', fact:'A crab walks sideways.' },
    { id:'jelly', e:'🪼', name:'Jellyfish', fact:'A jellyfish has no brain and no bones.' },
    { id:'shark', e:'🦈', name:'Shark', fact:'A shark grows new teeth again and again.' },
    { id:'humpback', e:'🐳', name:'Humpback Whale', fact:'Humpback whales sing long songs.' },
    { id:'bluewhale', e:'🐋', name:'Blue Whale', fact:'The blue whale is the biggest animal ever.' },
    { id:'seal', e:'🦭', name:'Seal', fact:'A seal can sleep in the water.' },
    { id:'squid', e:'🦑', name:'Squid', fact:'A squid squirts ink to hide.' },
    { id:'lobster', e:'🦞', name:'Lobster', fact:'A lobster has blue blood.' },
    { id:'shrimp', e:'🦐', name:'Shrimp', fact:'Some shrimp clean other fish.' },
    { id:'shell', e:'🐚', name:'Seashell', fact:'A hermit crab can move into an empty shell.' },
    { id:'coral', e:'🪸', name:'Coral', fact:'Coral is made of tiny animals.' },
    { id:'otter', e:'🦦', name:'Sea Otter', fact:'Sea otters hold hands while they sleep.' },
    { id:'penguin', e:'🐧', name:'Penguin', fact:'A penguin is a bird that swims but cannot fly.' },
    { id:'tropical', e:'🐠', name:'Reef Fish', fact:'Bright reef fish live near coral.' },
    { id:'fish', e:'🐟', name:'Fish', fact:'A fish breathes through its gills.' },
    { id:'oyster', e:'🦪', name:'Oyster', fact:'An oyster can make a pearl.' }
  ];
  function reefFriend(id){ return REEF_FRIENDS.find(function(f){ return f.id === id; }) || null; }
  function reefTally(){
    var c = (S.stats && S.stats.collection) || {};
    return { found: REEF_FRIENDS.filter(function(f){ return c[f.id]; }).length, total: REEF_FRIENDS.length };
  }
  // Adds a sea friend to newStats.collection and remembers it for the summary screen.
  function reefAward(stats, newStats){
    S.reefFind = null;
    if(!reefGame() || !S.sessionReviewed) return;
    reefWinSound(true); // finished the deck: the celebration music
    var have = Object.assign({}, stats.collection || {});
    var fresh = REEF_FRIENDS.filter(function(f){ return !have[f.id]; });
    var pool = fresh.length ? fresh : REEF_FRIENDS;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    have[pick.id] = (have[pick.id] || 0) + 1;
    newStats.collection = have;
    S.reefFind = { id: pick.id, again: !fresh.length };
  }
  function reefSummary(){
    var deck = S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Deck', emoji:'🌊' };
    var find = S.reefFind ? reefFriend(S.reefFind.id) : null;
    var earnedHTML = '';
    if(S.justEarnedBadges && S.justEarnedBadges.length){
      earnedHTML = '<div class="badge-earned-banner">' + BADGES.filter(function(b){ return S.justEarnedBadges.indexOf(b.id) !== -1; }).map(function(b){
        return '<div class="badge-earned-item"><span class="badge-earned-icon">'+b.icon+'</span><span>New badge: <strong>'+esc(b.name)+'</strong></span></div>';
      }).join('') + '</div>';
    }
    var head = find ? (S.reefFind.again ? 'Another ' + find.name + '!' : 'You found ' + (/^[AEIOU]/.test(find.name) ? 'an ' : 'a ') + find.name + '!') : 'Nice swimming!';
    app.innerHTML = '' +
      '<div class="reef-sum">' +
        '<div class="summary-card reef-sum-card">' +
          errorBannerHTML() +
          '<div class="reef-sum-deck">'+deck.emoji+' '+esc(deck.name)+' · All done!</div>' +
          (find ? '' +
            '<button type="button" class="reef-chest" data-reef-friend="'+find.id+'" aria-label="'+esc(head+' '+find.fact)+'">' +
              '<span class="reef-chest-rays" aria-hidden="true"></span>' +
              '<span class="reef-chest-friend" aria-hidden="true">'+find.e+'</span>' +
              '<span class="reef-chest-box" aria-hidden="true"><span class="lid"></span><span class="body"></span></span>' +
            '</button>' : '') +
          '<h2>'+esc(head)+'</h2>' +
          (find ? '<p class="reef-fact">'+esc(find.fact)+'</p><p class="reef-sum-note">It\'s in your Treasure Reef now.</p>' : '') +
          earnedHTML +
          planNextHTML() +
          (S.planRun ? '' : '<div class="reef-sum-actions">' +
            '<button class="btn btn-primary" data-act="play-again">🔁 Play Again</button>' +
            '<button class="btn btn-ghost" data-act="back-home">'+(reefNight() ? '⚓ Back to the wreck' : '🪸 Back to the reef')+'</button>' +
            '<button class="btn btn-ghost" data-act="reef-treasure">💎 Treasure Reef</button>' +
          '</div>') +
        '</div>' +
      '</div>';
    wireErrorBanner();
    wirePlanNext();
    var chest = app.querySelector('[data-reef-friend]');
    if(chest){
      var sayIt = function(){ try { Speech.speak(head + ' ' + find.fact); } catch(e){} };
      chest.addEventListener('click', sayIt);
      if(!S.reefSaid || S.reefSaid !== S.reefFind){ S.reefSaid = S.reefFind; setTimeout(sayIt, reefCalm() ? 200 : 900); }
    }
    if(S.planRun) return;
    app.querySelector('[data-act="back-home"]').addEventListener('click', function(){ S.reefPlace = null; S.subjectFilter = 'all'; goHome(); });
    app.querySelector('[data-act="play-again"]').addEventListener('click', function(){ reefGo('dive', null, function(){ startStudy(S.currentDeckId); }); });
    app.querySelector('[data-act="reef-treasure"]').addEventListener('click', function(){ goHomeNow(); S.view = 'collection'; render(); });
  }
  function reefCollection(){
    var c = (S.stats && S.stats.collection) || {};
    var t = reefTally();
    var tiles = REEF_FRIENDS.map(function(f){
      var n = c[f.id] || 0;
      return n
        ? '<button type="button" class="reef-friend found" data-reef-friend="'+f.id+'" aria-label="'+esc(f.name+'. '+f.fact)+'"><span class="reef-friend-e">'+f.e+'</span><b>'+esc(f.name)+'</b>'+(n > 1 ? '<small>× '+n+'</small>' : '')+'</button>'
        : '<div class="reef-friend" aria-label="Not found yet"><span class="reef-friend-e">'+f.e+'</span><b>Not found yet</b></div>';
    }).join('');
    app.innerHTML = '' +
      '<div class="nav-row">' +
        '<button class="back-btn" data-act="reef-back">'+(reefNight() ? '⚓ Back to the wreck' : '🪸 Back to the reef')+'</button>' +
      '</div>' +
      '<section class="reef-collection">' +
        '<div class="reef-collection-head">' +
          '<span class="reef-collection-art" aria-hidden="true">'+reefArtSVG('treasure')+'</span>' +
          '<div><h2>My Treasure Reef</h2><p>You have found '+t.found+' of '+t.total+' sea friends. Finish a deck to find another one.</p></div>' +
        '</div>' +
        '<div class="reef-fact-box" id="reefFactBox" hidden></div>' +
        '<div class="reef-friends">'+tiles+'</div>' +
      '</section>';
    app.querySelector('[data-act="reef-back"]').addEventListener('click', function(){
      reefGo('swim', null, function(){ S.view = 'home'; S.reefPlace = null; S.subjectFilter = 'all'; render(); });
    });
    var box = app.querySelector('#reefFactBox');
    app.querySelectorAll('[data-reef-friend]').forEach(function(b){
      b.addEventListener('click', function(){
        var f = reefFriend(b.dataset.reefFriend);
        box.hidden = false;
        box.innerHTML = '<span class="reef-fact-e">'+f.e+'</span><span><b>'+esc(f.name)+'</b><br>'+esc(f.fact)+'</span>';
        app.querySelectorAll('.reef-friend.on').forEach(function(x){ x.classList.remove('on'); });
        b.classList.add('on');
        try { Speech.speak(f.name + '. ' + f.fact); } catch(e){}
      });
    });
  }

  /* ---------- Settings: Calm motion ---------- */
  function reefCalmHTML(){
    var on = !!(S.settings && S.settings.calmMotion);
    return '' +
      '<div class="stats-section">' +
        '<h3>🌊 Calm motion</h3>' +
        '<button type="button" class="algo-opt'+(on?' active':'')+'" data-act="toggle-calm-motion">' +
          '<span class="algo-name">'+(on ? '✅ On' : '⬜ Off')+'</span>' +
          '<span class="algo-blurb">Turns off the splash animations when a deck opens or closes, the moving map and the treasure chest animation. Screens change straight away instead. The device\'s own "Reduce Motion" setting does the same.</span>' +
        '</button>' +
      '</div>';
  }
  function reefWireCalm(){
    var b = app.querySelector('[data-act="toggle-calm-motion"]');
    if(!b) return;
    b.addEventListener('click', function(){
      var newSettings = Object.assign({}, S.settings, { calmMotion: !(S.settings && S.settings.calmMotion) });
      S.settings = newSettings;
      S.store.setSettings(newSettings);
      render();
    });
  }

  /* ---------- Shelly on the study screen: cheers after a right answer, encourages after a miss ---------- */
  function reefStudyBuddy(){
    if(!reefGame() || S.view !== 'study') return;
    var stage = app.querySelector('.stage');
    if(!stage || stage.classList.contains('stage-exit')) return;
    var mood = app.querySelector('.choice-feedback.ok') ? 'yay' : (app.querySelector('.choice-feedback.no') ? 'hmm' : 'idle');
    var say = mood === 'yay' ? 'Yay! 🎉' : (mood === 'hmm' ? 'Let\'s look together.' : '');
    var bud = stage.querySelector('.reef-buddy');
    if(!bud){
      bud = document.createElement('div');
      bud.className = 'reef-buddy';
      bud.setAttribute('aria-hidden', 'true');
      var night = false; try { night = coveSwimName() === 'Lumi'; } catch(e){}
      bud.innerHTML = '<div class="reef-seabed"></div>' + (night ? lumiSVG('reef-buddy-turtle lumi') : mascotTurtleSVG('reef-buddy-turtle')) + '<span class="reef-buddy-say"></span>';
      stage.appendChild(bud);
      stage.classList.add('has-buddy');
    }
    if(bud.dataset.mood !== mood){
      bud.dataset.mood = mood;
      bud.querySelector('.reef-buddy-say').textContent = say;
    }
  }
  afterRender('study buddy', reefStudyBuddy);
  afterRender('praise', reefPraiseCheck);
  afterRender('music', reefMusicUpdate);

  /* ---------- No grown-up check in the Claude version (Wendy's choice). The GitHub/iPad copy loads its seed data
     file, which defines CORAL_COVE_SEED, and asks the grown-up maths question (reefGrownUpGate) wherever a PIN
     used to be asked. Leaving a deck early still asks the subtraction question in both. ---------- */
  function reefNoPin(){ return !window.CORAL_COVE_SEED; }
  /* Inside a grown-up profile nothing asks again (Wendy's choice): the question was answered on the way in.
     Opening the profile and Manage Profiles (on the profile screen, outside any profile) still ask. */
  function reefInsideAdult(kind){
    return kind !== 'enterAdult' && kind !== 'manageProfiles' && !!(S.activeProfileId && S.profile && S.profile.mode === 'adult');
  }
  function reefSkipPin(kind){
    S.pinPromptFor = null;
    setTimeout(function(){ grownUpPassed(kind); }, 0);
  }
  /* ---------- Grown-ups only: a times question a young child can't do yet, in place of a PIN ----------
     Two-digit × one-digit (like 47 × 6). A wrong answer brings a new question, so guessing doesn't work. */
  function reefGrownUpProblem(){ var a = 13 + Math.floor(Math.random() * 75), b = 6 + Math.floor(Math.random() * 4); return { a: a, b: b, ans: a * b }; }
  function reefGrownUpGate(kind){
    if(!S.adultGate || S.adultGate.kind !== kind) S.adultGate = { kind: kind, q: reefGrownUpProblem(), msg: '' };
    var g = S.adultGate, q = g.q, t = pinPadTitles(kind);
    var what = t[1].replace(/^(Ask a grown-up to )?[Ee]nter the PIN (to )?/, '').replace(/\.$/, '');
    var keys = [1,2,3,4,5,6,7,8,9].map(function(k){ return '<button type="button" class="pin-key" data-gate-digit="'+k+'">'+k+'</button>'; }).join('') +
      '<button type="button" class="pin-key" data-gate="back" aria-label="Delete">'+ccIcon('backspace')+'</button><button type="button" class="pin-key" data-gate-digit="0">0</button>' +
      '<button type="button" class="pin-key reef-gate-check" data-gate="check">OK</button>';
    app.innerHTML = '' +
      '<div class="lock-screen reef-gate">' +
        '<h2>' + esc(t[0].replace('🔐', '🧮')) + '</h2>' +
        '<p>Grown-ups: solve this' + (what ? ' to ' + esc(what) : '') + '.</p>' +
        '<div class="pin-wrap">' +
          '<div class="reef-gate-q"><span>'+q.a+' × '+q.b+' =</span>' +
            '<input id="adultGateInput" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Your answer to '+q.a+' times '+q.b+'" value=""></div>' +
          '<div class="reef-gate-msg" role="status" aria-live="polite">'+(g.msg || '&nbsp;')+'</div>' +
          '<div class="pin-grid">'+keys+'</div>' +
          '<div class="reef-gate-row"><button type="button" class="pin-cancel" data-gate="cancel">Cancel</button></div>' +
        '</div>' +
      '</div>';
    var inp = app.querySelector('#adultGateInput');
    function check(){
      var v = inp.value.replace(/\D/g, '');
      if(!v){ inp.focus(); return; }
      if(+v === q.ans){ S.adultGate = null; grownUpPassed(kind); return; }
      try { Sound.bloop(300); } catch(e){}
      S.adultGate = { kind: kind, q: reefGrownUpProblem(), msg: 'Not quite. Here\'s a new one.' };
      reefGrownUpGate(kind);
    }
    function cancel(){ S.adultGate = null; cancelPinPrompt(kind); }
    app.querySelectorAll('[data-gate-digit]').forEach(function(b){
      b.addEventListener('click', function(){ if(inp.value.length < 3){ try { Sound.tap(); } catch(e){} inp.value += b.dataset.gateDigit; } });
    });
    app.querySelector('[data-gate="back"]').addEventListener('click', function(){ inp.value = inp.value.slice(0, -1); });
    app.querySelector('[data-gate="check"]').addEventListener('click', check);
    app.querySelector('[data-gate="cancel"]').addEventListener('click', cancel);
    inp.addEventListener('input', function(){ var d = inp.value.replace(/\D/g, '').slice(0, 3); if(d !== inp.value) inp.value = d; });
    inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); check(); } else if(e.key === 'Escape'){ e.preventDefault(); cancel(); } });
    setTimeout(function(){ try { inp.focus({ preventScroll: true }); } catch(e){} }, 50);
  }
  window.CoralCoveGrownUpQuestion = reefGrownUpProblem;   // the Library's settings use the same kind of question
  /* ---------- Leaving a deck early in Child Mode: a subtraction question instead of the PIN ---------- */
  /* Leaving a deck early asks a problem. In the endless decks (the swipe feeds) it gets easier the more cards
     she has read there: a two-digit take-away (20 − 15), then take-away within 10, then adding within 10, then
     a tiny sum, and after REEF_FREE_EXIT cards she can just leave. */
  var REEF_ENDLESS = ['feed', 'equationFeed', 'flashFeed', 'langFeed', 'story'], REEF_FREE_EXIT = 30;
  function reefEndlessSeen(){ return REEF_ENDLESS.indexOf(S.view) >= 0 && S.endless && S.endless.deck === S.currentDeckId ? S.endless.n : 0; }
  function reefNewProblem(){
    var n = reefEndlessSeen(), r = function(k){ return Math.floor(Math.random() * k); }, a, b;
    if(n >= 22){ a = 1 + r(3); return { a: a, b: 1, op: '+', ans: a + 1, tries: 0 }; }   // 2 + 1
    if(n >= 15){ a = 1 + r(5); b = 1 + r(5); return { a: a, b: b, op: '+', ans: a + b, tries: 0 }; }   // 3 + 4
    if(n >= 8){ a = 4 + r(6); b = 1 + r(a - 1); return { a: a, b: b, op: '−', ans: a - b, tries: 0 }; }   // 9 − 4
    a = 12 + r(19); var ans = 3 + r(Math.min(17, a - 7));
    return { a: a, b: a - ans, op: '−', ans: ans, tries: 0 };
  }
  // Counts the cards she has seen in an endless deck (a new card on screen), for the exit problem above.
  afterRender('endless count', function(){
    if(REEF_ENDLESS.indexOf(S.view) < 0) return;
    var cur = document.querySelector('.feed-card-current'); if(!cur) return;
    if(!S.endless || S.endless.deck !== S.currentDeckId) S.endless = { deck: S.currentDeckId, n: 0, last: null };
    var sig = S.view + '|' + cur.textContent.replace(/\s+/g, ' ').trim();
    if(sig !== S.endless.last){ S.endless.last = sig; S.endless.n++; }
  });
  /* ---------- "Say it with me!": in the reading decks (Phonics Words and the other word feeds, and word cards
     she flips) a little Shelly swims in every few cards, says "Say it with me!" and reads the word again, then
     swims away. Child profile only; with Calm motion she fades in and out instead. ---------- */
  function reefSayWord(){
    if(!reefKid()) return null;
    var el = S.view === 'feed' ? document.querySelector('.feed-card-current .feed-word')
      : S.view === 'study' ? document.querySelector('.stage .flip-card:not(.flipped) .face-front .card-text') : null;
    var t = el && el.textContent.replace(/\s+/g, ' ').trim();
    return t && t.length <= 30 && /[a-z]/i.test(t) ? t : null;
  }
  afterRender('say it with me', function(){
    var word = reefSayWord();
    var old = document.querySelector('.cc-sayit');
    if(!word){ if(old && !reefSayWord.keep) old.remove(); return; }
    var sig = S.view + '|' + word, st = S.sayIt || (S.sayIt = { last: null, n: 0, next: 2, at: 0 });
    if(sig === st.last) return;
    st.last = sig; st.n++;
    if(st.n < st.next || Date.now() - st.at < 40000) return;
    st.n = 0; st.next = 4 + Math.floor(Math.random() * 3); st.at = Date.now();
    setTimeout(function(){
      if(reefSayWord() !== word || document.querySelector('.cc-sayit')) return;
      var d = document.createElement('div');
      d.className = 'cc-sayit' + (reefCalm() ? ' calm' : ''); d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<div class="cc-sayit-shelly">' + mascotTurtleSVG('cc-sayit-svg') + '</div><div class="cc-sayit-say">Say it with me!</div>';
      document.body.appendChild(d);
      var gone = function(){ if(!d.parentNode) return; d.classList.add('out'); setTimeout(function(){ d.remove(); }, 900); };
      setTimeout(function(){
        try { Speech.speakThen('Say it with me!', function(){ setTimeout(function(){ if(reefSayWord() === word) Speech.speak(word); }, 250); setTimeout(gone, 2600); }); } catch(e){ gone(); }
      }, 700);
      setTimeout(gone, 9000);   // never stays on screen
    }, 1800);   // after the card has been read once
  });

  var REEF_PRAISE = ['You got it right!', 'Great thinking!', 'You worked it out!', 'Nice careful work!', 'That\'s right! Good checking.', 'Awesome effort!', 'You did it! Great focus.', 'Yes! Good work.'];
  function reefPraiseLine(){ return REEF_PRAISE[Math.floor(Math.random() * REEF_PRAISE.length)]; }
  function reefMathGate(){
    // after enough cards in an endless deck she can just leave
    if(!S.reefGate && reefEndlessSeen() >= REEF_FREE_EXIT){ S.pinPromptFor = null; S.endless = null; setTimeout(goHome, 0); return; }
    if(!S.reefGate) S.reefGate = reefNewProblem();
    var g = S.reefGate;
    g.op = g.op || '−';
    var opWord = g.op === '+' ? 'plus' : 'minus';
    var keys = [1,2,3,4,5,6,7,8,9].map(function(k){ return '<button type="button" class="pin-key" data-gate-digit="'+k+'">'+k+'</button>'; }).join('') +
      '<button type="button" class="pin-key" data-gate="back" aria-label="Delete">'+ccIcon('backspace')+'</button><button type="button" class="pin-key" data-gate-digit="0">0</button>' +
      '<button type="button" class="pin-key reef-gate-check" data-gate="check">Check</button>';
    app.innerHTML = '' +
      '<div class="lock-screen reef-gate">' +
        '<h2>🧮 Leave This Deck?</h2>' +
        '<p>Solve this problem to go back.</p>' +
        '<div class="pin-wrap">' +
          '<div class="reef-gate-q"><span>'+g.a+' '+g.op+' '+g.b+' =</span>' +
            '<input id="reefGateInput" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Your answer to '+g.a+' '+opWord+' '+g.b+'" value=""></div>' +
          '<div class="reef-gate-msg" role="status" aria-live="polite">'+(g.msg || '&nbsp;')+'</div>' +
          '<div class="pin-grid">'+keys+'</div>' +
          '<div class="reef-gate-row"><button type="button" class="reef-gate-hint" data-gate="hint">💡 Hint</button>' +
          '<button type="button" class="pin-cancel" data-gate="stay">Keep practicing</button></div>' +
        '</div>' +
      '</div>';
    var inp = app.querySelector('#reefGateInput'), msg = app.querySelector('.reef-gate-msg');
    function say(html, cls){ msg.innerHTML = html; msg.className = 'reef-gate-msg' + (cls ? ' ' + cls : ''); }
    function hint(){ return g.op === '+' ? 'Hint: start at ' + g.a + '. Count up ' + g.b + ' more.' : 'Hint: start at ' + g.b + '. Count up to ' + g.a + '. How many numbers did you count?'; }
    function check(){
      var v = inp.value.replace(/\D/g, '');
      if(!v){ say('Type your answer first, then tap Check.'); inp.focus(); return; }
      if(+v === g.ans){
        var p = reefPraiseLine();
        say('🎉 ' + esc(p) + ' ' + g.a + ' ' + g.op + ' ' + g.b + ' = ' + g.ans + '.', 'ok');
        try { Sound.correct(); } catch(e){}
        try { Speech.speak(p); } catch(e){}
        reefPopBubbles();
        reefWinSound(false);
        app.querySelectorAll('.reef-gate button, .reef-gate input').forEach(function(b){ b.disabled = true; });
        clearTimeout(S.reefGateIdle); S.reefGateIdle = null;
        setTimeout(function(){ S.reefGate = null; S.pinPromptFor = null; S.endless = null; goHome(); }, 1600);
        return;
      }
      g.tries++;
      try { Sound.bloop(300); } catch(e){}
      inp.value = '';
      say('Not quite. ' + esc(g.tries >= 2 ? hint() : 'Try again. You can tap 💡 Hint for help.'), 'no');
      inp.focus();
    }
    app.querySelectorAll('[data-gate-digit]').forEach(function(b){
      b.addEventListener('click', function(){ if(inp.value.length < 2){ try { Sound.tap(); } catch(e){} inp.value += b.dataset.gateDigit; } });
    });
    app.querySelector('[data-gate="back"]').addEventListener('click', function(){ inp.value = inp.value.slice(0, -1); });
    app.querySelector('[data-gate="check"]').addEventListener('click', check);
    app.querySelector('[data-gate="hint"]').addEventListener('click', function(){ say(esc(hint())); try { Speech.speak(hint()); } catch(e){} });
    app.querySelector('[data-gate="stay"]').addEventListener('click', function(){ clearTimeout(S.reefGateIdle); S.reefGateIdle = null; S.reefGate = null; cancelPinPrompt('exit'); });
    inp.addEventListener('input', function(){ var d = inp.value.replace(/\D/g, '').slice(0, 2); if(d !== inp.value) inp.value = d; });
    // Ten seconds without a tap: the problem goes away and she's back in the deck where she was.
    // (A re-draw of this screen keeps the countdown going; only her taps restart it.)
    function idle(){ clearTimeout(S.reefGateIdle); S.reefGateIdle = setTimeout(function(){ S.reefGateIdle = null; if(S.pinPromptFor === 'exit' && document.querySelector('.reef-gate')){ S.reefGate = null; cancelPinPrompt('exit'); } }, 10000); }
    app.querySelector('.reef-gate').addEventListener('pointerdown', idle);
    inp.addEventListener('keydown', idle);
    if(!S.reefGateIdle) idle();
    inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); check(); }
      else if(e.key === 'Escape'){ e.preventDefault(); S.reefGate = null; cancelPinPrompt('exit'); }
    });
  }

  /* ---------- Praise after a right answer: a spoken line that names the effort, any deck type ---------- */
  var reefWasOk = false;
  function reefPraiseCheck(){
    var ok = reefGame() && !!app.querySelector('.choice-feedback.ok');
    if(ok && !reefWasOk){
      var line = reefPraiseLine();
      S.reefPraise = line;
      var bubble = app.querySelector('.reef-buddy-say');
      if(bubble) bubble.textContent = line + ' 🎉';
      // after the card's own answer has been read aloud
      clearTimeout(reefPraiseCheck.t);
      reefPopBubbles();
      reefWinSound(false);
      reefPraiseCheck.t = setTimeout(function(){ try { if(app.querySelector('.choice-feedback.ok')) Speech.speak(line); } catch(e){} }, 1100);
    }
    if(ok && S.reefPraise){ var bub = app.querySelector('.reef-buddy-say'); if(bub) bub.textContent = S.reefPraise + ' 🎉'; }
    if(!ok) S.reefPraise = null;
    reefWasOk = ok;
  }

  /* ---------- Celebration bubbles after a right answer: they float up and pop when tapped ---------- */
  function reefPopsDone(layer){ if(!layer.children.length){ layer.classList.remove('active'); clearTimeout(layer._safety); } }
  function reefPopBubbles(){
    if(reefCalm() || !reefGame()) return;
    var layer = document.getElementById('reefPops');
    if(!layer){ layer = document.createElement('div'); layer.id = 'reefPops'; layer.className = 'reef-pops'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); }
    if(layer.children.length) return;
    // While the bubbles float, the layer catches every other tap so the next card waits.
    layer.classList.add('active');
    clearTimeout(layer._safety); layer._safety = setTimeout(function(){ layer.textContent = ''; reefPopsDone(layer); }, 6500);
    for(var i = 0; i < 6; i++){
      var b = document.createElement('button');
      b.type = 'button'; b.tabIndex = -1; b.className = 'reef-pop';
      var size = 46 + Math.round(Math.random() * 38);
            var x = 4 + Math.random() * 82;
      b.style.cssText = '--x:' + x.toFixed(1) + 'vw;--s:' + size + 'px;--d:' + (3.2 + Math.random()).toFixed(2) + 's;--w:' + ((Math.random() - .5) * 60).toFixed(0) + 'px;animation-delay:' + (i * .12).toFixed(2) + 's';
      b.addEventListener('pointerdown', function(e){
        e.preventDefault(); e.stopPropagation();
        var me = e.currentTarget; if(me.classList.contains('popped')) return;
        var r = me.getBoundingClientRect();
        me.classList.add('popped'); me.style.left = r.left + 'px'; me.style.top = r.top + 'px';
        try { Sound.bloop(880 + Math.random() * 500, 0, .05); } catch(err){}
        setTimeout(function(){ me.remove(); reefPopsDone(layer); }, 320);
      });
      b.addEventListener('animationend', function(e){ if(e.animationName === 'reefPopRise'){ e.currentTarget.remove(); reefPopsDone(layer); } });
      layer.appendChild(b);
    }
  }

  /* ---------- Celebration music (Wendy's clip, win.mp3):
     the first four seconds after a right answer, the whole clip after finishing a deck. Played
     through Web Audio so it can fade out on the iPad too. Without the file, the usual chime plays. ---------- */
  var reefWinBuf = null, reefWinLoading = null, reefWinNode = null;
  function reefWinLoad(){
    if(reefWinBuf || reefWinLoading) return reefWinLoading;
    var ctx = null; try { ctx = Sound.getCtx(); } catch(e){}
    if(!ctx || !window.fetch) return null;
    // packed in a script file first, for the same reason as the songs (see reefMusicBytes)
    reefWinLoading = (window.CORAL_COVE_SEED ? Promise.reject() : reefMusicScript('win')).catch(function(){ return fetch('win.mp3').then(function(r){ if(!r.ok) throw new Error('no music file'); return r.arrayBuffer(); }); })
      .then(function(b){ return new Promise(function(res, rej){ ctx.decodeAudioData(b, res, rej); }); })
      .then(function(buf){ reefWinBuf = buf; return buf; })
      .catch(function(){ reefWinLoading = 'none'; return null; });
    return reefWinLoading;
  }
  function reefWinSound(full){
    try { if(!Sound.isEnabled()) return; } catch(e){ return; }
    if(!(S.profile && S.profile.mode === 'child')){ try { Sound.correct(); } catch(e){} return; }   // the "I Like to Move It" clip is just for the child's profile
    var ctx = null; try { ctx = Sound.getCtx(); } catch(e){}
    if(!ctx) return;
    if(!reefWinBuf){ var p = reefWinLoad(); if(p && p.then) p.then(function(buf){ if(buf && full) reefWinSound(true); }); else { try { Sound.correct(); } catch(e){} } return; }
    try {
      if(ctx.state === 'suspended' && ctx.resume) ctx.resume();
      if(reefWinNode){ try { reefWinNode.stop(); } catch(e){} }
      var src = ctx.createBufferSource(), gain = ctx.createGain(), t = ctx.currentTime;
      var dur = Math.min(reefWinBuf.duration, full ? 14 : 4), vol = full ? .7 : .5;
      src.buffer = reefWinBuf; src.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(vol, t); gain.gain.setValueAtTime(vol, t + Math.max(0, dur - (full ? 1.5 : .6))); gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      src.start(t, 0, dur + .05); reefWinNode = src;
      try { reefMusicDuck(dur + .3); } catch(e){}
    } catch(e){}
  }

  /* ---------- No "is resting" page: a child profile starts its session straight away, and after a
     session ends (results, then Done) it goes back to the profile lobby. ---------- */
  var reefEnded = false, reefStarting = false;
  function reefSkipResting(){
    if(reefEnded){ reefEnded = false; goToPicker(); return true; }
    app.innerHTML = '';
    if(!reefStarting){ reefStarting = true; beginSession(); setTimeout(function(){ reefStarting = false; }, 2000); }
    return true;
  }
  /* ---------- Ask Shelly offline: Korean word parts a beginner wonders about ----------
     No internet needed. Splits Korean into the main word plus common particles and endings, and can
     spell out the letters in each syllable. Anything else still needs Claude (online). */
  var KO_L = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  var KO_V = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  var KO_T = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
  var KO_LJ = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', KO_VJ = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  var KO_TJ = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  function koSyl(ch){ var c = ch.charCodeAt(0) - 0xAC00; if(c < 0 || c > 11171) return null; return { l: Math.floor(c / 588), v: Math.floor(c % 588 / 28), t: c % 28 }; }
  function koRom(s){ return Array.prototype.map.call(s, function(ch){ var j = koSyl(ch); return j ? KO_L[j.l] + KO_V[j.v] + KO_T[j.t] : ch; }).join(''); }
  function koHasFinal(ch){ var j = koSyl(ch); return !!(j && j.t); }
  function koPart(p){ return p + ' (' + koRom(p) + ')'; }
  // Endings and particles, longest first. need: 'C' = only after a final consonant, 'V' = only after a vowel.
  var KO_ENDS = [
    ['고 싶어요', 'want to (polite)'], ['지 않아요', 'do not (polite)'], ['었어요', 'did — past, polite'], ['았어요', 'did — past, polite'], ['였어요', 'was / did — past, polite'], ['했어요', 'did — past, polite'],
    ['습니다', 'formal polite ending'], ['입니다', 'is / am / are (formal)'], ['이에요', 'is / am / are (polite)', 'C'], ['예요', 'is / am / are (polite)', 'V'], ['주세요', 'please give / please do it for me'],
    ['으세요', 'please do (polite)', 'C'], ['세요', 'please do (polite)'], ['해요', 'does (polite)'], ['어요', 'does / is (polite)'], ['아요', 'does / is (polite)'], ['니다', 'formal polite ending'],
    ['에서', 'at / from (where it happens)'], ['에게', 'to (a person)'], ['한테', 'to (a person)'], ['하고', 'and / with'], ['이랑', 'and / with', 'C'], ['랑', 'and / with', 'V'],
    ['으로', 'by / with / toward', 'C'], ['로', 'by / with / toward'], ['부터', 'from (a time)'], ['까지', 'until / up to'], ['처럼', 'like (the same as)'], ['보다', 'more than'],
    ['은', 'topic marker: what we are talking about', 'C'], ['는', 'topic marker: what we are talking about', 'V'], ['이', 'subject marker: who or what does it', 'C'], ['가', 'subject marker: who or what does it', 'V'],
    ['을', 'object marker: the thing the action is done to', 'C'], ['를', 'object marker: the thing the action is done to', 'V'], ['과', 'and', 'C'], ['와', 'and', 'V'],
    ['에', 'to / at / in (a place or time)'], ['의', '\'s (belongs to)'], ['도', 'also / too'], ['만', 'only'], ['요', 'makes it polite'], ['고', 'and then']
  ];
  // Common beginner words. Verbs are listed by the stem the endings attach to.
  var KO_WORDS = {
    '나':'I / me','저':'I / me (polite)','너':'you','우리':'we / our','엄마':'mom','아빠':'dad','언니':'older sister (said by a girl)','누나':'older sister (said by a boy)','오빠':'older brother (said by a girl)','형':'older brother (said by a boy)',
    '동생':'younger brother or sister','친구':'friend','선생님':'teacher','학생':'student','사람':'person','이름':'name','학교':'school','집':'home / house','방':'room','교실':'classroom','책':'book','연필':'pencil','가방':'bag',
    '물':'water','밥':'rice / a meal','우유':'milk','커피':'coffee','주스':'juice','빵':'bread','사과':'apple','바나나':'banana','김치':'kimchi','고기':'meat','과자':'snack / cookie','음식':'food',
    '고양이':'cat','개':'dog','강아지':'puppy','새':'bird','물고기':'fish','거북이':'turtle','바다':'sea','하늘':'sky','꽃':'flower','나무':'tree','비':'rain','눈':'snow / eye',
    '오늘':'today','내일':'tomorrow','어제':'yesterday','지금':'now','아침':'morning','저녁':'evening','밤':'night','시간':'time','한국':'Korea','한국어':'Korean (language)','영어':'English (language)',
    '이것':'this thing','그것':'that thing','저것':'that thing over there','이거':'this','그거':'that','뭐':'what','무엇':'what','누구':'who','어디':'where','언제':'when','왜':'why','어떻게':'how',
    '네':'yes','아니요':'no','안녕':'hi / bye (to a friend)','안녕하세요':'hello (polite)','감사합니다':'thank you (formal)','고마워요':'thank you (polite)','미안해요':'I am sorry (polite)','죄송합니다':'I am sorry (formal)',
    '안':'not','못':'cannot','아주':'very','정말':'really','많이':'a lot','조금':'a little','같이':'together','다시':'again',
    '하':'do','먹':'eat','마시':'drink','가':'go','오':'come','보':'see / watch','읽':'read','쓰':'write / use','듣':'listen','말하':'speak','공부하':'study','좋':'good / like','싫':'dislike','크':'big','작':'small',
    '있':'there is / have','없':'there is not / do not have','자':'sleep','놀':'play','사':'buy','주':'give','알':'know','모르':'not know','좋아하':'like','사랑하':'love','배우':'learn','앉':'sit','일어나':'get up',
    '공부':'study','사랑':'love','숙제':'homework','게임':'game','노래':'song','그림':'picture'
  };
  // Some everyday verb forms that join two sounds together (가 + 아요 = 가요).
  var KO_FORMS = { '가요':['가','go','아요'], '와요':['오','come','아요'], '봐요':['보','see / watch','아요'], '해요':['하','do','여요'], '마셔요':['마시','drink','어요'], '자요':['자','sleep','아요'], '사요':['사','buy','아요'],
    '줘요':['주','give','어요'], '배워요':['배우','learn','어요'], '써요':['쓰','write / use','어요'], '커요':['크','big','어요'], '좋아요':['좋','good / like','아요'], '있어요':['있','there is / have','어요'], '없어요':['없','there is not / do not have','어요'],
    '먹어요':['먹','eat','어요'], '읽어요':['읽','read','어요'], '들어요':['듣','listen','어요'], '몰라요':['모르','not know','아요'], '알아요':['알','know','아요'], '놀아요':['놀','play','아요'], '앉아요':['앉','sit','아요'], '갔어요':['가','go','았어요'], '했어요':['하','do','였어요'], '먹었어요':['먹','eat','었어요'], '봤어요':['보','see / watch','았어요'], '왔어요':['오','come','았어요'], '마셨어요':['마시','drink','었어요'] };
  function koEndMeaning(e){ for(var i = 0; i < KO_ENDS.length; i++) if(KO_ENDS[i][0] === e) return KO_ENDS[i][1]; return e === '여요' ? 'does (polite)' : ''; }
  function koSplitWord(w){
    if(KO_WORDS[w]) return [{ part: koPart(w), meaning: KO_WORDS[w] }];
    if(KO_FORMS[w]){ var f = KO_FORMS[w]; return [{ part: koPart(f[0]) + ' + ' + f[2], meaning: f[1] + ', joined with ' + f[2] + ' — ' + koEndMeaning(f[2]) }]; }
    for(var i = 0; i < KO_ENDS.length; i++){
      var e = KO_ENDS[i][0], need = KO_ENDS[i][2];
      if(e.indexOf(' ') !== -1 || w.length <= e.length || w.slice(-e.length) !== e) continue;
      var stem = w.slice(0, -e.length), last = stem.slice(-1);
      if(need === 'C' && !koHasFinal(last)) continue;
      if(need === 'V' && koHasFinal(last)) continue;
      // a two-syllable word like 포도 (grape) is only split when the first part is a word we know
      if(w.length <= 2 && !KO_WORDS[stem] && !KO_FORMS[stem]) continue;
      var head = koSplitWord(stem);
      return head.concat([{ part: koPart(e), meaning: KO_ENDS[i][1] }]);
    }
    return [{ part: koPart(w), meaning: 'the main word', unknown: true }];
  }
  function koLetters(text){
    var out = [];
    Array.prototype.forEach.call(text.replace(/[^가-힣]/g, ''), function(ch){
      var j = koSyl(ch); if(!j || out.length >= 8) return;
      var bits = [KO_LJ[j.l] + ' (' + (KO_L[j.l] || 'silent at the start') + ')', KO_VJ[j.v] + ' (' + KO_V[j.v] + ')'];
      if(j.t) bits.push(KO_TJ[j.t] + ' (' + KO_T[j.t] + ', at the bottom)');
      out.push({ part: ch + ' (' + koRom(ch) + ')', meaning: bits.join(' + ') });
    });
    return out;
  }
  // Returns an answer in Ask Shelly's shape, or null when the question has no Korean in it.
  function koLocalAnswer(q, card){
    var ko = (String(q).match(/[가-힣]+(?:\s+[가-힣]+)*/g) || []).join(' ').trim();
    if(!ko) return null;
    var words = ko.split(/\s+/).slice(0, 6), wantLetters = /letter|spell|sound|read|syllable|글자|자모/i.test(q) || (words.length === 1 && ko.length === 1);
    var parts = [];
    if(wantLetters) parts = koLetters(ko);
    else {
      for(var i = 0; i < words.length; i++){
        if(words[i] === '싶어요' && i > 0) continue;
        var w = words[i] + (words[i + 1] === '싶어요' && /고$/.test(words[i]) ? ' 싶어요' : '');
        if(w.indexOf(' 싶어요') !== -1){ var st = w.replace(/고 싶어요$/, ''); parts = parts.concat(koSplitWord(st), [{ part: koPart('고 싶어요'), meaning: 'want to (polite)' }]); }
        else parts = parts.concat(koSplitWord(words[i]));
      }
    }
    var whole = card && card.front && card.front.replace(/[^가-힣\s]/g, '').trim() === ko && card.back ? card.back : '';
    var answer = wantLetters ? '“' + ko + '” is written with these letters. Each block is one syllable.'
      : (whole ? '“' + ko + '” (' + koRom(ko) + ') means: ' + whole + '. ' : '“' + ko + '” (' + koRom(ko) + ') ') + (parts.length > 1 ? 'Here are its parts.' : '');
    var unknown = parts.some(function(p){ return p.unknown; });
    if(unknown && !whole) answer += ' I know the parts that are listed. For the meaning of the main word, ask again when you are online.';
    return { answer: answer.trim(), parts: parts.map(function(p){ return { part: p.part, meaning: p.meaning }; }).slice(0, 8), example: '', offline: true };
  }

  /* ---------- Never stuck (child profile) ----------
     After ten seconds without a tap, the next thing to do glows and Shelly says it ("Tap the card to flip it!"),
     again every twelve seconds while nothing happens. A pop-up on the board that is still waiting fifteen seconds
     after the first nudge closes itself, so she's back on the board. (The exit problem has its own ten-second
     timer, in reefMathGate.) */
  var REEF_NUDGES = [
    // [what to find, what Shelly says]; the first one on screen wins
    ['.r3-mini-play .r3-tile:not(.up):not(.got)', 'Tap a card to turn it over!'],
    ['.r3-mini-play .r3-bub.want:not(.pop)', 'Pop the bubbles with the number!'],
    ['.r3-mini-play [data-odd="1"]', 'Tap the one that is different!'],
    ['.r3-panel .r3-btn.main', 'Tap the glowing button!'],
    ['.r3-panel [data-ok], .r3-panel [data-done], .r3-panel [data-close]', 'Tap the glowing button!'],
    ['.r3-dice-tip', 'Tap to roll the dice!'],
    ['.grade-row:not([hidden]) button', 'Did you get it right? Tap a button!'],
    ['.choice-row .choice-btn:not(:disabled)', 'Tap an answer!'],
    ['.blend-slider-handle', 'Slide the shell to sound it out!'],
    ['#flipCard:not(.flipped)', 'Tap the card to flip it!'],
    ['.feed-stage', 'Swipe up for the next one!'],
    ['.btn-primary', 'Tap the glowing button!']
  ];
  var reefNudge = { touch: Date.now(), last: 0, first: 0 };
  ['pointerdown', 'keydown', 'touchstart'].forEach(function(t){
    document.addEventListener(t, function(){ reefNudge.touch = Date.now(); reefNudge.first = 0; }, true);
  });
  // a new screen or card starts the ten seconds again
  afterRender('never stuck', function(){ var c = document.querySelector('.feed-card-current, .stage .face-front'), v = S.view + '|' + (S.pinPromptFor || '') + '|' + (c ? c.textContent : ''); if(v !== reefNudge.view){ reefNudge.view = v; reefNudge.touch = Date.now(); reefNudge.first = 0; } });
  function reefVisible(el){ var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; }
  setInterval(function(){
    if(!reefKid() || document.hidden || window.__reefTx || reefBusy || document.querySelector('.reef-gate')) return;
    var now = Date.now(), idle = now - reefNudge.touch;
    if(idle < 10000 || now - reefNudge.last < 12000) return;
    // a board pop-up that's still waiting after a nudge: close it
    var panel = document.querySelector('.r3-panel');
    if(panel && reefNudge.first && now - reefNudge.first > 15000 && !panel.querySelector('.r3-mini-play')){
      var leave = panel.querySelector('[data-skip], [data-back], [data-close], [data-done], [data-no], [data-ok]');
      if(leave){ leave.click(); reefNudge.touch = now; reefNudge.first = 0; return; }
    }
    var ask = document.querySelector('.r3-mini-play .r3-mini-ask b');
    if(ask) document.querySelectorAll('.r3-bub').forEach(function(b){ b.classList.toggle('want', b.dataset.n === ask.textContent.trim()); });
    for(var i = 0; i < REEF_NUDGES.length; i++){
      var el = Array.prototype.find.call(document.querySelectorAll(REEF_NUDGES[i][0]), reefVisible);
      if(!el) continue;
      reefNudge.last = now; if(!reefNudge.first) reefNudge.first = now;
      el.classList.remove('cc-nudge'); void el.offsetWidth; el.classList.add('cc-nudge');
      setTimeout(function(){ el.classList.remove('cc-nudge'); }, 4200);
      try { Speech.speak(REEF_NUDGES[i][1]); } catch(e){}
      return;
    }
  }, 1000);
