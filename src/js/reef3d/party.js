  /* ---------- Party board: shells, the golden pearl, the shop, Chance Time, whirlpools, the clam gate, minigames
     and story mode. What she owns is saved with the profile's stats (stats.board), so it follows her everywhere. ---------- */
  function reefBoard(){
    var st = S.stats || (S.stats = {});
    var b = st.board || (st.board = {});
    if(typeof b.shells !== 'number') b.shells = 0;
    if(typeof b.pearls !== 'number') b.pearls = 0;
    if(!Array.isArray(b.hats)) b.hats = [];
    if(typeof b.dbl !== 'number') b.dbl = 0;
    return b;
  }
  var reefBoardQ = Promise.resolve();
  function reefBoardSave(){
    if(!S.store || !S.profile) return;
    var snap = JSON.parse(JSON.stringify(reefBoard()));
    reefBoardQ = reefBoardQ.then(function(){
      return S.store.getStats().then(function(st){ return S.store.setStats(Object.assign({}, st || {}, { board: snap })); });
    }).catch(function(e){ console.warn('[Coral Cove] board save failed', e); });
  }
  function reef3dHud(view){
    var b = reefBoard(), h = view.wrap.querySelector('.r3-hud'); if(!h) return;
    h.querySelector('.r3-hud-shells b').textContent = b.shells;
    h.querySelector('.r3-hud-pearls b').textContent = b.pearls;
    var mb = view.wrap.querySelector('[data-r3-mode]');
    if(mb){
      mb.hidden = !planOn();
      var tg = reef3dStoryTarget(view), day = S.planDay, total = day && day.blocks ? day.blocks.length : 0, done = total ? day.blocks.filter(function(x){ return x.done; }).length : 0;
      mb.innerHTML = reef3dStoryOn() ? ccIcon('story') + '<span>Story · ' + (total ? done + ' of ' + total : 'today') + '</span>' : ccIcon('dice') + '<span>Free play</span>';
      mb.setAttribute('aria-label', reef3dStoryOn() ? 'Story mode: following today\'s plan. Tap for free play.' : 'Free play. Tap for story mode.');
      mb.dataset.alldone = tg < 0 && reef3dStoryOn() ? '1' : '';
    }
  }
  function reef3dShells(view, n, why){
    var b = reefBoard();
    if(n > 0 && b.dblShells){ n *= 2; b.dblShells = false; }
    b.shells = Math.max(0, b.shells + n); reefBoardSave(); reef3dHud(view);
    var pop = document.createElement('div'); pop.className = 'r3-shellpop' + (n < 0 ? ' minus' : ''); pop.setAttribute('aria-hidden', 'true');
    pop.textContent = (n > 0 ? '+' : '') + n + ' 🐚';
    view.wrap.appendChild(pop); setTimeout(function(){ pop.remove(); }, 1500);
    try { if(n > 0){ Sound.bloop(1040, 0, .05); Sound.bloop(1320, .07, .04); } else Sound.bloop(300); } catch(e){}
  }
  // A modal panel over the board (shop, Chance Time, pearl, minigames). Returns the panel's body element.
  function reef3dPanel(view, cls, html){
    var old = view.wrap.querySelector('.r3-panel'); if(old) old.remove();
    var el = document.createElement('div'); el.className = 'r3-panel ' + (cls || ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="r3-panel-card">' + html + '</div>';
    el.addEventListener('click', function(e){ e.stopPropagation(); });
    el.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    view.wrap.appendChild(el);
    var f = el.querySelector('button'); if(f) setTimeout(function(){ try { f.focus({ preventScroll: true }); } catch(err){} }, 50);
    return el;
  }

  // What happens on a space: when she lands there (passing = false) or stops on the way (the pearl, the shop).
  function reef3dVisit(view, s, passing, done){
    var b = reefBoard();
    if(s.i === b.pearlAt) return reef3dPearl(view, function(){ if(passing) done(); else reef3dVisitKind(view, s, done); });
    if(s.kind === 'shop') return reef3dShop(view, done);
    if(passing) return done();
    reef3dVisitKind(view, s, done);
  }
  function reef3dVisitKind(view, s, done){
    var calm = reefCalm();
    if(s.kind === 'surprise'){
      if(calm){ reef3dQHit(view, s); reef3dSurprise(view, s); return setTimeout(done, 3900); }
      setTimeout(function(){ reef3dEmote(view, 'bonk', function(){ reef3dEmote(view, 'startle'); }); }, 250);
      setTimeout(function(){ reef3dQHit(view, s); reef3dCrabAct(view, 'Dance', true); }, 650);
      setTimeout(function(){ reef3dSurprise(view, s); }, 950);
      return setTimeout(done, 4900);
    }
    if(s.kind === 'chance') return reef3dChance(view, s, done);
    if(s.kind === 'whirl') return reef3dWhirl(view, s, done);
    if(s.kind === 'plain' || s.kind === 'start'){ reef3dShells(view, 3); reef3dEmote(view, 'hello'); return setTimeout(done, 1400); }
    if(s.kind === 'deck'){ reef3dStars(view, s); if(!calm) reef3dCrabAct(view, 'Yes', true); reef3dEmote(view, 'twirl'); return setTimeout(done, 1600); }
    done();
  }
  // After every dice turn: the clam gate flips, then a minigame.
  function reef3dAfterTurn(view){
    var b = reefBoard(); b.gateOpen = !b.gateOpen; reefBoardSave(); reef3dGateShow(view);
    setTimeout(function(){ if(document.body.contains(view.wrap) && !view.moving) reef3dMinigame(view, null, false); }, reefCalm() ? 200 : 900);
  }

  /* ---- the golden pearl: trade 10 shells for it; then it moves to a new space ---- */
  var REEF_PEARL_COST = 10;
  function reef3dPearlSpot(view, near){
    var sp = view.spaces, b = reefBoard();
    var cands = sp.filter(function(s){ return s.kind === 'plain' && !s.branch && !s.fork && s.i !== b.pearlAt && s.i !== view.at && s.i > 1; });
    if(near != null){ var ahead = cands.filter(function(s){ return s.i > near && s.i <= near + 4; }); if(ahead.length) return ahead[0].i; }
    var far = cands.filter(function(s){ return Math.abs(s.i - view.at) >= 6; });
    var pool = far.length ? far : cands; return pool.length ? pool[Math.floor(Math.random() * pool.length)].i : -1;
  }
  function reef3dPearl(view, done){
    var b = reefBoard();
    if(b.shells < REEF_PEARL_COST){
      reef3dPrize(view, '🫧', 'The golden pearl!', 'It costs ' + REEF_PEARL_COST + ' shells. You have ' + b.shells + '. Keep collecting!');
      return setTimeout(done, 2600);
    }
    var el = reef3dPanel(view, 'r3-pearl-panel', '<div class="r3-panel-e" aria-hidden="true">🫧</div><h3>The golden pearl!</h3>' +
      '<p>Trade ' + REEF_PEARL_COST + ' shells for it? You have ' + b.shells + '.</p>' +
      '<div class="r3-panel-row"><button type="button" class="r3-btn main" data-yes>Yes, please!</button><button type="button" class="r3-btn" data-no>Not now</button></div>');
    el.querySelector('[data-yes]').addEventListener('click', function(){
      el.remove(); b.pearls++; reef3dShells(view, -REEF_PEARL_COST);
      b.pearlAt = reef3dPearlSpot(view); reefBoardSave(); reef3dPearlShow(view); reef3dHud(view);
      reef3dEmote(view, 'cheer'); reef3dCrabAct(view, 'Dance', true); try { reefWinSound(false); } catch(e){}
      reef3dPrize(view, '🫧', 'A golden pearl!', 'You have ' + b.pearls + (b.pearls === 1 ? ' pearl' : ' pearls') + ' now. A new one appears somewhere else.');
      setTimeout(done, 3000);
    });
    el.querySelector('[data-no]').addEventListener('click', function(){ el.remove(); done(); });
  }
  function reef3dPearlShow(view){
    var p = view.party && view.party.pearl; if(!p) return;
    var b = reefBoard(), s = view.spaces[b.pearlAt];
    if(!s || s.kind !== 'plain' || s.branch){ b.pearlAt = reef3dPearlSpot(view); s = view.spaces[b.pearlAt]; reefBoardSave(); }
    p.visible = !!s; if(s){ p.position.set(s.x, 1.55 + (s.y || 0), s.z); p.userData.y = 1.55 + (s.y || 0); }
  }

  /* ---- the hermit crab's shop ---- */
  var REEF_SHOP = [
    { id: 'dbl', e: '🎲', name: 'Double Dice', note: 'Roll two dice once', cost: 6 },
    { id: 'party', e: '🎉', name: 'Party hat', cost: 8, hat: true },
    { id: 'flower', e: '🌸', name: 'Flower crown', cost: 8, hat: true },
    { id: 'pirate', e: '🏴‍☠️', name: 'Pirate hat', cost: 10, hat: true },
    { id: 'crown', e: '👑', name: 'Gold crown', cost: 15, hat: true }
  ];
  function reef3dShop(view, done, browse){
    var b = reefBoard();
    function rows(){
      return REEF_SHOP.map(function(it){
        var own = it.hat && b.hats.indexOf(it.id) >= 0, wearing = b.hat === it.id;
        var btn = own ? '<button type="button" class="r3-btn" data-wear="' + it.id + '">' + (wearing ? 'Take off' : 'Wear') + '</button>'
          : '<button type="button" class="r3-btn main" data-buy="' + it.id + '"' + (b.shells < it.cost ? ' disabled' : '') + '>🐚 ' + it.cost + '</button>';
        return '<li><span class="r3-shop-e" aria-hidden="true">' + it.e + '</span><span class="r3-shop-t"><b>' + esc(it.name) + '</b>' +
          (it.id === 'dbl' ? '<small>' + esc(it.note) + (b.dbl ? ' · you have ' + b.dbl : '') + '</small>' : own ? '<small>Yours</small>' : '') + '</span>' + btn + '</li>';
      }).join('');
    }
    var el = reef3dPanel(view, 'r3-shop', '<div class="r3-panel-e" aria-hidden="true">🦀</div><h3>Hermit Crab\'s Shop</h3>' +
      '<p class="r3-shop-have">You have <b>' + b.shells + '</b> shells.</p><ul class="r3-shop-list">' + rows() + '</ul>' +
      '<div class="r3-panel-row"><button type="button" class="r3-btn" data-done>' + (browse ? 'Close' : 'Keep going') + '</button></div>');
    try { Sound.bloop(620, 0, .05); } catch(e){}
    function redraw(){ el.querySelector('.r3-shop-list').innerHTML = rows(); el.querySelector('.r3-shop-have b').textContent = b.shells; }
    el.addEventListener('click', function(e){
      var buy = e.target.closest('[data-buy]'), wear = e.target.closest('[data-wear]');
      if(buy){
        var it = REEF_SHOP.find(function(x){ return x.id === buy.dataset.buy; }); if(!it || b.shells < it.cost) return;
        if(it.id === 'dbl') b.dbl++; else { b.hats.push(it.id); b.hat = it.id; reef3dHat(view); }
        reef3dShells(view, -it.cost); reefBoardSave(); redraw();
        try { Sound.sessionStart(); } catch(err){}
      } else if(wear){
        b.hat = b.hat === wear.dataset.wear ? '' : wear.dataset.wear; reefBoardSave(); reef3dHat(view); redraw();
        try { Sound.tap(); } catch(err){}
      } else if(e.target.closest('[data-done]')){ el.remove(); if(done) done(); }
    });
  }
  // The hat she bought, built from simple shapes and sat on her head.
  function reef3dHat(view){
    var THREE = window.THREE, slot = view.guide.userData.parts.hat; if(!slot) return;
    while(slot.children.length) slot.remove(slot.children[0]);
    var id = reefBoard().hat; if(!id) return;
    var k = slot.userData.size / .34 * 1.5, M = view.kit.M, mesh = view.kit.mesh, g = new THREE.Group();
    if(id === 'party'){
      var cone = mesh(new THREE.ConeGeometry(.2, .46, 20), M('#ff7aa8'), 0, .23, 0); g.add(cone);
      g.add(mesh(new THREE.SphereGeometry(.07, 12, 8), M('#ffe066'), 0, .48, 0));
      [.08, .2, .32].forEach(function(y, i){ var r = mesh(new THREE.TorusGeometry(.2 * (1 - y / .46) + .005, .018, 6, 20), M(i % 2 ? '#7fd8e0' : '#ffe066'), 0, y, 0); r.rotation.x = Math.PI / 2; g.add(r); });
      g.rotation.z = -.18;
    } else if(id === 'flower'){
      var ring = mesh(new THREE.TorusGeometry(.24, .04, 8, 24), M('#5aa65a'), 0, .02, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
      for(var i = 0; i < 6; i++){ var a = i / 6 * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(.07, 10, 8), M(i % 2 ? '#ffb3cf' : '#fff2a8'), Math.cos(a) * .24, .05, Math.sin(a) * .24)); }
    } else if(id === 'pirate'){
      var hat = mesh(new THREE.CylinderGeometry(.2, .24, .2, 20), M('#2b2b33'), 0, .1, 0); g.add(hat);
      var brim = mesh(new THREE.CylinderGeometry(.36, .36, .04, 3), M('#2b2b33'), 0, .02, 0); brim.rotation.y = Math.PI / 6; g.add(brim);
      g.add(mesh(new THREE.SphereGeometry(.05, 10, 8), M('#ffffff'), 0, .12, .2));
    } else if(id === 'crown'){
      g.add(mesh(new THREE.CylinderGeometry(.2, .2, .14, 20, 1, true), M('#f2c14e', { side: THREE.DoubleSide }), 0, .07, 0));
      for(var j = 0; j < 5; j++){ var b2 = j / 5 * Math.PI * 2; g.add(mesh(new THREE.ConeGeometry(.05, .14, 8), M('#f2c14e'), Math.cos(b2) * .19, .2, Math.sin(b2) * .19)); }
      g.add(mesh(new THREE.SphereGeometry(.045, 10, 8), M('#e2725b'), 0, .08, .2));
    }
    g.scale.setScalar(k); slot.add(g);
  }

  /* ---- Chance Time: a wheel of silly outcomes ---- */
  var REEF_CHANCE = [
    { e: '🐚', t: '+5 shells!', c: '#ffd75e' },
    { e: '✨', t: 'Double shells next time!', c: '#7fd8e0' },
    { e: '🌀', t: 'A whirlpool ride ahead!', c: '#5b8fe0' },
    { e: '💃', t: 'Dance party!', c: '#ff9fc0' },
    { e: '🫧', t: 'The pearl swims closer!', c: '#d9c8ff' },
    { e: '🦀', t: 'Kiko shares 3 shells!', c: '#f2a08f' }
  ];
  function reef3dChance(view, s, done){
    var n = REEF_CHANCE.length, seg = 360 / n, pick = Math.floor(Math.random() * n);
    var grad = REEF_CHANCE.map(function(o, i){ return o.c + ' ' + (i * seg) + 'deg ' + ((i + 1) * seg) + 'deg'; }).join(',');
    var labels = REEF_CHANCE.map(function(o, i){ return '<span style="--a:' + (i * seg + seg / 2) + 'deg">' + o.e + '</span>'; }).join('');
    var el = reef3dPanel(view, 'r3-chance', '<h3>Chance Time!</h3><div class="r3-wheel-wrap"><div class="r3-wheel" style="background:conic-gradient(' + grad + ')">' + labels + '</div><i class="r3-wheel-pin" aria-hidden="true"></i></div>' +
      '<p class="r3-chance-out" aria-live="polite">Spinning…</p><div class="r3-panel-row"><button type="button" class="r3-btn main" data-ok hidden>Yay!</button></div>');
    var wheel = el.querySelector('.r3-wheel'), spins = reefCalm() ? 0 : 4, end = spins * 360 + (360 - (pick * seg + seg / 2));
    try { Sound.bubbles(4); } catch(e){}
    requestAnimationFrame(function(){ wheel.style.transform = 'rotate(' + end + 'deg)'; });
    setTimeout(function(){
      var o = REEF_CHANCE[pick], b = reefBoard();
      el.querySelector('.r3-chance-out').textContent = o.e + ' ' + o.t;
      try { Sound.sessionStart(); } catch(e){}
      var ok = el.querySelector('[data-ok]'); ok.hidden = false; ok.focus({ preventScroll: true });
      ok.addEventListener('click', function(){
        el.remove();
        if(pick === 0) reef3dShells(view, 5);
        else if(pick === 1){ b.dblShells = true; reefBoardSave(); }
        else if(pick === 3){ reef3dEmote(view, 'cheer'); reef3dCrabAct(view, 'Dance', true); }
        else if(pick === 4){ b.pearlAt = reef3dPearlSpot(view, view.at); reefBoardSave(); reef3dPearlShow(view); }
        else if(pick === 5) reef3dShells(view, 3);
        if(pick === 2){
          var ahead = view.spaces.filter(function(x){ return !x.branch && x.i > view.at && x.i <= view.at + 4 && x.kind !== 'deck'; });
          var to = ahead.length ? ahead[ahead.length - 1] : null;
          if(to) return reef3dSwirlTo(view, to.i, function(){ setTimeout(done, 400); });
        }
        setTimeout(done, pick === 3 ? 2200 : 600);
      });
    }, reefCalm() ? 300 : 3300);
  }

  /* ---- whirlpools: a pair of spaces; land on one and swirl out of the other ---- */
  function reef3dWhirl(view, s, done){
    if(s.pair == null) return done();
    reef3dPrize(view, '🌀', 'Whirlpool!', 'Wheee! Off to the other whirlpool.');
    setTimeout(function(){ reef3dSwirlTo(view, s.pair, function(){ setTimeout(done, 500); }); }, 900);
  }
  function reef3dSwirlTo(view, to, done){
    var g = view.guide, body = g.userData.body;
    try { Sound.bubbles(5); } catch(e){}
    if(reefCalm()){ reef3dPlace(view, to); S.reef3dAt = to; return done(); }
    view.moving = true; view.emote = null;
    var r0 = g.rotation.y;
    view.fx.push({ t0: performance.now(), dur: 800, step: function(p){ g.rotation.y = r0 + p * p * Math.PI * 6; body.scale.setScalar(1 - p * .95); body.position.y = -p * .5; },
      end: function(){
        reef3dPlace(view, to); S.reef3dAt = to;
        view.fx.push({ t0: performance.now(), dur: 700, step: function(p){ var e = reef3dBounce(p); g.rotation.y = r0 + (1 - p) * Math.PI * 4; body.scale.setScalar(.05 + .95 * e); body.position.y = Math.sin(p * Math.PI) * 1.2; },
          end: function(){ body.scale.setScalar(1); body.position.y = 0; view.moving = false; reef3dPuff(view, view.spaces[to]); done(); } });
      } });
  }

  /* ---- the clam gate: a giant clam across the path that opens and closes every turn ---- */
  function reef3dGateShut(view, a, b){
    var g = view.spaces.gateAt; if(g == null || g < 0 || reefBoard().gateOpen) return false;
    return (a === g && b === g + 1) || (a === g + 1 && b === g);
  }
  function reef3dGateShow(view){ var gt = view.party && view.party.gate; if(gt) gt.userData.want = reefBoard().gateOpen ? 1 : 0; }

  // The board's party pieces, built once with the board.
  function reef3dPartyBuild(view){
    var THREE = window.THREE, M = view.kit.M, mesh = view.kit.mesh, sp = view.spaces, night = view.night, party = view.party = { whirls: [] };
    // whirlpools: two spinning rings of foam over each whirlpool space
    sp.forEach(function(s){
      if(s.kind !== 'whirl') return;
      var w = new THREE.Group(); w.position.set(s.x, .32 + (s.y || 0), s.z);
      [0, 1].forEach(function(k){
        var r = new THREE.Mesh(new THREE.TorusGeometry(.42 + k * .2, .045, 6, 32, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: night ? '#9fd8ff' : '#e8f6ff', transparent: true, opacity: .85 - k * .2 }));
        r.rotation.x = -Math.PI / 2; r.rotation.z = k * Math.PI; r.raycast = function(){}; w.add(r);
      });
      view.scene.add(w); party.whirls.push(w);
    });
    // the golden pearl: a shining pearl floating over a plain space
    var pearl = new THREE.Group();
    var pm = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 18), new THREE.MeshLambertMaterial({ color: '#fff4dc', emissive: '#ffd98a', emissiveIntensity: night ? .55 : .3 }));
    pm.userData.space = -1; pm.raycast = function(){}; pearl.add(pm);
    var ph = new THREE.Sprite(new THREE.SpriteMaterial({ map: reef3dBlobTex(true), color: '#ffe3a0', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending }));
    ph.scale.setScalar(2.2); ph.raycast = function(){}; pearl.add(ph);
    var shellBase = mesh(new THREE.SphereGeometry(.5, 20, 10, 0, Math.PI * 2, Math.PI * .55, Math.PI * .45), M('#f2b5c8'), 0, -.22, 0); shellBase.raycast = function(){}; pearl.add(shellBase);
    pearl.userData.halo = ph; view.scene.add(pearl); party.pearl = pearl;
    reef3dPearlShow(view);
    // the clam gate: two big shell halves on the path between two spaces; the top half lifts when it's open
    var gi = sp.gateAt;
    if(gi != null && gi >= 0 && sp[gi + 1]){
      var a = sp[gi], b = sp[gi + 1], gate = new THREE.Group();
      gate.position.set((a.x + b.x) / 2, ((a.y || 0) + (b.y || 0)) / 2, (a.z + b.z) / 2); gate.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
      var shellM = M(night ? '#8c6aa8' : '#c9a0dc');
      var low = mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shellM, 0, .35, 0); low.scale.set(1.4, .55, .5); gate.add(low);
      var lid = new THREE.Group(); lid.position.set(0, .35, -.5); gate.add(lid);
      var top = mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shellM, 0, 0, .5); top.scale.set(1.4, .6, .5); lid.add(top);
      for(var r = -3; r <= 3; r++){ var rib = mesh(new THREE.BoxGeometry(.05, .62, .04), M(night ? '#a888c2' : '#e2c3ef'), r * .2, .28, .78); rib.rotation.z = r * .14; lid.add(rib); }
      gate.traverse(function(o){ o.raycast = function(){}; });
      gate.userData = { lid: lid, open: reefBoard().gateOpen ? 1 : 0, want: reefBoard().gateOpen ? 1 : 0 };
      view.scene.add(gate); party.gate = gate;
    }
    reef3dHat(view);
    reef3dHud(view);
  }
  function reef3dPartyTick(view, now, t){
    var party = view.party; if(!party) return;
    party.whirls.forEach(function(w, i){ w.children[0].rotation.z = t * 2.4 + i; w.children[1].rotation.z = Math.PI - t * 1.6 - i; });
    var p = party.pearl; if(p && p.visible){ p.position.y = p.userData.y + Math.sin(t * 2) * .12; p.rotation.y = t * .8; p.userData.halo.material.opacity = .55 + .2 * Math.sin(t * 3); }
    var gt = party.gate;
    if(gt){ var u = gt.userData; u.open += (u.want - u.open) * .06; u.lid.rotation.x = -u.open * 1.15; }
  }

  /* ---- minigames: a short game after each turn, and the minigame corner. No timers or scores in her mode. ---- */
  var REEF_GAMES = [
    { id: 'match', e: '🃏', name: 'Card Match', how: 'Flip two cards to find a pair.' },
    { id: 'count', e: '🫧', name: 'Bubble Numbers', how: 'Pop every bubble with the number!' },
    { id: 'odd', e: '🐠', name: 'Odd Fish Out', how: 'Tap the fish that is different.' }
  ];
  function reef3dMinigame(view, id, practice, done){
    reefGamesFor(function(games){ reef3dMinigameOpen(view, games, id, practice, done); });
  }
  function reef3dMinigameOpen(view, games, id, practice, done){
    if(!document.body.contains(view.wrap)) return;
    var g = games.find(function(x){ return x.id === id; }) || games[Math.floor(Math.random() * games.length)];
    var el = reef3dPanel(view, 'r3-mini', '<div class="r3-mini-intro"><p class="r3-mini-tag">' + (practice ? 'Minigame corner' : 'Minigame time!') + '</p>' +
      '<div class="r3-panel-e" aria-hidden="true">' + reefGameIcon(g, 'r3-gameic') + '</div><h3>' + esc(g.name) + '</h3><p>' + esc(g.how) + '</p>' +
      '<div class="r3-panel-row"><button type="button" class="r3-btn main" data-go>Play!</button>' + (practice ? '' : '<button type="button" class="r3-btn" data-skip>Skip</button>') + '</div></div>');
    try { Sound.sessionStart(); } catch(e){}
    reefMusicUpdate();   // the game song comes in
    var shut = function(){ el.remove(); reefMusicUpdate(); };
    function finish(won, note){
      var reward = practice ? 0 : (won ? 3 : 1);
      var card = el.querySelector('.r3-panel-card');
      if(!card) return;
      card.innerHTML = '<div class="r3-panel-e" aria-hidden="true">' + (won ? '🎉' : '🐚') + '</div><h3>' + (won ? (note ? 'Well done!' : 'You did it!') : 'Nice try!') + '</h3>' +
        (note ? '<p class="r3-mini-score">' + note + '</p>' : '') + (reward ? '<p>You get ' + reward + ' shells.</p>' : '<p>Want to play again?</p>') +
        '<div class="r3-panel-row">' + (practice ? '<button type="button" class="r3-btn main" data-again>Play again</button>' : '') + '<button type="button" class="r3-btn' + (practice ? '' : ' main') + '" data-back>Back to the ' + (view.night ? 'wreck' : 'reef') + '</button></div>';
      if(won){ try { reefWinSound(false); } catch(e){} reef3dCrabAct(view, 'Dance', true); }
      if(reward) reef3dShells(view, reward);
      var bk = card.querySelector('[data-back]'); bk.focus({ preventScroll: true });
      bk.addEventListener('click', function(){ shut(); if(done) done(); });
      var ag = card.querySelector('[data-again]'); if(ag) ag.addEventListener('click', function(){ el.remove(); reef3dMinigame(view, g.id, true, done); });
    }
    el.querySelector('[data-go]').addEventListener('click', function(){
      var card = el.querySelector('.r3-panel-card');
      card.innerHTML = '<h3>' + reefGameIcon(g, 'r3-gameic sm') + ' ' + esc(g.name) + '</h3><div class="r3-mini-play"></div>';
      var play = card.querySelector('.r3-mini-play');
      if(g.play) g.play(play, finish, g);
      else if(g.id === 'match') reefGameMatch(play, finish);
      else if(g.id === 'count') reefGameCount(play, finish);
      else reefGameOdd(play, finish);
    });
    var sk = el.querySelector('[data-skip]'); if(sk) sk.addEventListener('click', function(){ shut(); if(done) done(); });
  }
  function reefShuffle(a){ for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function reefPlainText(h){ var d = document.createElement('div'); d.innerHTML = String(h || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  // Card Match: three pairs of sea friends as pictures (she can't read the words yet). Each card says its
  // friend's name when it turns over, and again when a pair is found.
  function reefGameMatch(play, finish){
    var pairs = reefShuffle(REEF_FRIENDS.slice()).slice(0, 3);
    var tiles = reefShuffle([].concat.apply([], pairs.map(function(f, i){ return [{ k: i, f: f }, { k: i, f: f }]; })));
    play.innerHTML = '<p class="r3-mini-ask">Find the two that match!</p><div class="r3-match">' + tiles.map(function(x, i){
      return '<button type="button" class="r3-tile pic" data-i="' + i + '" aria-label="Hidden card"><span>' + x.f.e + '</span></button>'; }).join('') + '</div>';
    var open = [], got = 0, busy = false;
    play.addEventListener('click', function(e){
      var b = e.target.closest('.r3-tile'); if(!b || busy || b.classList.contains('up')) return;
      var t = tiles[+b.dataset.i];
      b.classList.add('up'); b.setAttribute('aria-label', t.f.name); open.push(b); try { Sound.flip(); } catch(err){}
      try { Speech.speak(t.f.name); } catch(err){}
      if(open.length < 2) return;
      var a = tiles[+open[0].dataset.i], c = tiles[+open[1].dataset.i];
      if(a.k === c.k){ open.forEach(function(x){ x.classList.add('got'); }); open = []; got++; try { Sound.correct(); } catch(err){} if(got === pairs.length) setTimeout(function(){ finish(true); }, 900); }
      else { busy = true; setTimeout(function(){ open.forEach(function(x){ x.classList.remove('up'); x.setAttribute('aria-label', 'Hidden card'); }); open = []; busy = false; }, 1200); }
    });
  }
  // Bubble Numbers: pop every bubble that shows the number.
  function reefGameCount(play, finish){
    var want = 2 + Math.floor(Math.random() * 8), nums = [want, want, want];
    while(nums.length < 10){ var n = 1 + Math.floor(Math.random() * 9); if(n !== want) nums.push(n); }
    reefShuffle(nums);
    play.innerHTML = '<p class="r3-mini-ask">Pop every <b>' + want + '</b>!</p><div class="r3-bubs">' + nums.map(function(n, i){
      return '<button type="button" class="r3-bub" data-n="' + n + '" style="--d:' + (i * .17 % 1.3).toFixed(2) + 's">' + n + '</button>'; }).join('') + '</div>';
    var left = 3;
    play.addEventListener('click', function(e){
      var b = e.target.closest('.r3-bub'); if(!b || b.classList.contains('pop')) return;
      if(+b.dataset.n === want){ b.classList.add('pop'); b.disabled = true; try { Sound.bloop(900 + Math.random() * 300, 0, .05); } catch(err){} if(--left === 0) setTimeout(function(){ finish(true); }, 500); }
      else { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); try { Sound.bloop(300); } catch(err){} }
    });
  }
  // Odd Fish Out: three rounds of six sea creatures where one is different.
  function reefGameOdd(play, finish){
    var sets = [['🐠', '🐟'], ['🐡', '🐠'], ['🦀', '🦞'], ['🐙', '🦑'], ['🐢', '🦎'], ['🐳', '🐬'], ['🦈', '🐬'], ['🐚', '🦪']], round = 0;
    function next(){
      if(round === 3) return finish(true);
      var pr = sets.splice(Math.floor(Math.random() * sets.length), 1)[0], odd = Math.floor(Math.random() * 6);
      play.innerHTML = '<p class="r3-mini-ask">Round ' + (round + 1) + ' of 3: tap the one that\'s different.</p><div class="r3-odd">' +
        [0, 1, 2, 3, 4, 5].map(function(i){ return '<button type="button" class="r3-oddb" data-odd="' + (i === odd ? 1 : 0) + '">' + (i === odd ? pr[1] : pr[0]) + '</button>'; }).join('') + '</div>';
    }
    play.addEventListener('click', function(e){
      var b = e.target.closest('.r3-oddb'); if(!b) return;
      if(b.dataset.odd === '1'){ b.classList.add('got'); try { Sound.correct(); } catch(err){} round++; setTimeout(next, 600); }
      else { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); try { Sound.bloop(300); } catch(err){} }
    });
    next();
  }
  function reef3dGames(view){ reefGamesFor(function(games){ if(document.body.contains(view.wrap)) reef3dGamesOpen(view, games); }); }
  function reef3dGamesOpen(view, games){
    var el = reef3dPanel(view, 'r3-corner', '<div class="r3-panel-e" aria-hidden="true">' + ccIcon('games', 'r3-gameic') + '</div><h3>Minigame corner</h3><p>Play any minigame, as many times as you like.</p>' +
      '<ul class="r3-games' + (games !== REEF_GAMES ? ' two' : '') + '">' + games.map(function(g){ return '<li><button type="button" class="r3-btn" data-game="' + g.id + '"><span aria-hidden="true">' + reefGameIcon(g) + '</span> ' + esc(g.name) + '</button></li>'; }).join('') + '</ul>' +
      '<div class="r3-panel-row"><button type="button" class="r3-btn" data-shop>🦀 Visit the shop</button><button type="button" class="r3-btn" data-close>Close</button></div>');
    el.addEventListener('click', function(e){
      var g = e.target.closest('[data-game]');
      if(g){ el.remove(); reef3dMinigame(view, g.dataset.game, true); }
      else if(e.target.closest('[data-shop]')){ el.remove(); reef3dShop(view, null, true); }
      else if(e.target.closest('[data-close]')) el.remove();
    });
  }

  /* ---- story mode: today's plan (Coral Calendar's schedule) is the adventure. The next planned deck is the goal;
     the dice always rolls exactly the number of spaces to it, she hops there, dives in and the plan records it. Free play is the board
     as before. Only profiles with a daily plan have the switch. ---- */
  function reef3dStoryOn(){ if(!planOn()) return false; var m = reefBoard().mode; return m !== 'free'; }
  function reef3dStoryTarget(view){
    if(!reef3dStoryOn()) return -1;
    var day = S.planDay; if(!day || day.off || day.date !== todayISO() || !day.blocks) return -1;
    var i = planNextIndex(day); if(i < 0) return -1;
    var b = day.blocks[i], sp = view.spaces;
    var s = b.maker ? sp.find(function(x){ return x.kind === 'story'; }) : sp.find(function(x){ return x.kind === 'deck' && x.item.d.id === b.deckId; });
    return s ? s.i : -1;
  }
  function reef3dStoryArrive(view, s){
    S.reef3dAt = s.i;
    reef3dEmote(view, 'cheer'); reef3dStars(view, s); if(!reefCalm()) reef3dCrabAct(view, 'Dance', true);
    reef3dPrize(view, '📖', 'Next stop!', 'Today\'s plan says: ' + (s.kind === 'deck' ? s.item.d.name : 'Story Bottle') + '.');
    S.reefReturnY = window.scrollY;
    setTimeout(function(){ reefGo('dive', s.label, function(){ R3.fromDeck = true; if(s.kind === 'deck') R3.lastDeckId = s.item.d.id; planStartNext(); }); }, reefCalm() ? 400 : 2200);
  }
  function reef3dStoryMark(view){
    var tg = reef3dStoryTarget(view); if(tg < 0) return false;
    var s = view.spaces[tg];
    view.ring.visible = true; view.ring.position.set(s.x, .34 + (s.y || 0), s.z);
    if(view.nextStar){ var o = s.obj || s; view.nextStar.visible = true; view.nextStar.position.set(o.position ? o.position.x : s.x, 3.2 + (s.y || 0), o.position ? o.position.z : s.z); view.nextStar.userData.y = 3.2 + (s.y || 0); }
    return true;
  }

  // A puff of sand where Shelly lands.
  function reef3dPuff(view, s){
    if(reefCalm()) return;
    var THREE = window.THREE, bits = [];
    for(var i = 0; i < 7; i++){
      var m = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 5), new THREE.MeshBasicMaterial({ color: view.night ? '#6b7c78' : '#f4e6c4', transparent: true, opacity: .8 }));
      var a = i / 7 * Math.PI * 2, sy = s.y || 0; m.position.set(s.x, .35 + sy, s.z); m.userData.v = [Math.cos(a), Math.sin(a)]; view.scene.add(m); bits.push(m);
    }
    view.fx.push({ t0: performance.now(), dur: 520,
      step: function(p){ bits.forEach(function(m){ m.position.x = s.x + m.userData.v[0] * p * 1.1; m.position.z = s.z + m.userData.v[1] * p * 1.1; m.position.y = .35 + sy + Math.sin(p * Math.PI) * .25; m.scale.setScalar(1 + p * 1.5); m.material.opacity = .8 * (1 - p); }); },
      end: function(){ bits.forEach(function(m){ view.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); } });
  }
  // Gold stars burst up when Shelly reaches a deck.
  function reef3dStars(view, s){
    var THREE = window.THREE, stars = [], shape = new THREE.Shape();
    for(var k = 0; k < 10; k++){ var a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? .1 : .24; shape[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    var geo = new THREE.ShapeGeometry(shape), mat = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, side: THREE.DoubleSide });
    try { Sound.correct(); } catch(e){}
    if(reefCalm()) return;
    for(var i = 0; i < 12; i++){
      var m = new THREE.Mesh(geo, mat); var a2 = i / 12 * Math.PI * 2;
      m.userData.v = new THREE.Vector3(Math.cos(a2) * (1 + Math.random()), 2.4 + Math.random() * 1.6, Math.sin(a2) * (1 + Math.random()));
      m.position.set(s.x, 1 + (s.y || 0), s.z); view.scene.add(m); stars.push(m);
    }
    view.fx.push({ t0: performance.now(), dur: 900,
      step: function(p){ stars.forEach(function(m){ m.position.set(s.x + m.userData.v.x * p, 1 + (s.y || 0) + m.userData.v.y * p - 2.2 * p * p, s.z + m.userData.v.z * p); m.rotation.z = p * 6; m.lookAt(view.cam.position); m.rotation.z += p * 6; }); mat.opacity = 1 - p * p; },
      end: function(){ stars.forEach(function(m){ view.scene.remove(m); }); geo.dispose(); mat.dispose(); } });
  }
  // Soft underwater hum with the odd bubble, only on the board and only with sound on.
  var R3amb = null;
  function reef3dAmbience(view, on){
    try {
      on = on && Sound.isEnabled() && document.body.contains(view.wrap);
      view.amb = on;
      if(!on){ if(R3amb) R3amb.gain.gain.setTargetAtTime(0, R3amb.ctx.currentTime, .3); return; }
      var ctx = Sound.getCtx(); if(!ctx) return;
      if(ctx.state === 'suspended' && ctx.resume) ctx.resume();
      if(!R3amb){
        var len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
        for(var i = 0; i < len; i++){ last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        var lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = .07; lfoG.gain.value = 160; lfo.connect(lfoG); lfoG.connect(lp.frequency);
        var gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(lp); lp.connect(gain); gain.connect(ctx.destination); src.start(); lfo.start();
        R3amb = { ctx: ctx, gain: gain };
      }
      R3amb.gain.gain.setTargetAtTime(.06, ctx.currentTime, 1.2);
    } catch(e){}
  }

  // Switch the crab to another move; 'once' plays it (Dance, Yes) and then returns to idle.
  function reef3dCrabAct(view, name, once){
    var c = view.crab; if(!c || (!once && (view.crabBusy || c.userData.anim.name === name))) return;
    if(once){ view.crabBusy = true; reefCrabPlay(c, name, function(){ view.crabBusy = false; }); }
    else reefCrabPlay(c, name);
  }
  // Screen distance (CSS pixels) from a tap to a point in the scene.
  function reef3dTapDist(view, v, e, rc){
    var p = v.clone().project(view.cam); if(p.z > 1) return 1e9;
    return Math.hypot((p.x + 1) / 2 * rc.width + rc.left - e.clientX, (1 - p.y) / 2 * rc.height + rc.top - e.clientY);
  }
  // Tap the crab: the other crab takes its place (see reefCrabSwap). It leaves toward the outside of the board.
  function reef3dCrabTap(view){
    var cp = view.crab.position, out = cp.x >= view.guide.position.x ? 1 : -1;
    view.crabBusy = false; reefCrabSwap(view, { x: cp.x - out * 7, z: cp.z + 1 }, out);
  }
  // How far a fleeing fish is pushed from its place in the school, fa seconds after the tap.
  //  burst: straight out from the middle · dart: the whole school glides off one way in a stream · swirl: a slowly
  //  turning ring that widens · split: two groups peel off to either side.
  // Every style is one smooth curve: a quick start that slows down, then a gentle drift back into the school.
  // (Fast wiggles and sudden side-steps made the fish look like they were twitching, so there are none.)
  var REEF3D_FLEE = ['burst', 'dart', 'swirl', 'split'], reef3dFleeV = { x: 0, y: 0, z: 0 };
  function reef3dFleeOff(fl, j, fa){
    var p = fl.fish[j], o = reef3dFleeV, ta = Math.max(0, fa - p.lag), back = fl.dur - fl.out - p.lag;
    var k = ta < fl.out ? Math.sin(ta / fl.out * Math.PI / 2) : Math.max(0, 1 - (ta - fl.out) / Math.max(.5, back));
    k = k * k * (3 - 2 * k);   // ease in and out
    var d = p.d, r = p.r * k, bob = Math.sin(ta * 2 + p.ph) * .15 * k;
    if(fl.style === 'dart'){ var w = Math.sin(ta * 1.5 + p.ph) * .25 * k; o.x = fl.dir.x * r * 1.3 - fl.dir.z * w; o.y = fl.dir.y * r + bob; o.z = fl.dir.z * r * 1.3 + fl.dir.x * w; }
    else if(fl.style === 'swirl'){ var a = Math.atan2(d.z, d.x) + fl.spin * Math.min(ta, fl.dur) * 1.2; o.x = Math.cos(a) * r; o.y = bob; o.z = Math.sin(a) * r * .8; }
    else if(fl.style === 'split'){ o.x = p.side * r * 1.2; o.y = d.y * r * .5 + bob; o.z = d.z * r * .5; }
    else { o.x = d.x * r; o.y = d.y * r * .6 + bob; o.z = d.z * r; }
    return o;
  }
  // Tap near a school of fish: they flee (a different way each time), then swim off and regroup at a new home elsewhere on the reef.
  function reef3dScatter(view, sc){
    try { Sound.bubbles(3); Sound.bloop(980, 0, .03); } catch(e){}
    if(reefCalm()) return;
    var THREE = window.THREE, n = sc.fish.length, mid = new THREE.Vector3();
    sc.fish.forEach(function(f){ mid.add(f.position); }); mid.multiplyScalar(1 / n);
    // A different escape each time: never the same style twice in a row, with random direction, reach and timing.
    var styles = REEF3D_FLEE.filter(function(st){ return st !== sc.lastFlee; }), style = styles[Math.floor(Math.random() * styles.length)];
    sc.lastFlee = style;
    var ang = Math.random() * Math.PI * 2, dir = new THREE.Vector3(Math.cos(ang), (Math.random() - .5) * .4, Math.sin(ang) * .6);
    sc.flee = { t0: performance.now() / 1000, style: style, out: .5 + Math.random() * .3, dur: 2.8 + Math.random() * 1.2, spin: Math.random() < .5 ? -1 : 1, dir: dir,
      fish: sc.fish.map(function(f, j){
        var d = f.position.clone().sub(mid); d.y *= .5; if(d.lengthSq() < 1e-4) d.set(Math.random() - .5, 0, Math.random() - .5);
        return { d: d.normalize(), r: 1.2 + Math.random() * 1.3, lag: style === 'dart' ? j * .06 + Math.random() * .05 : Math.random() * .12, ph: Math.random() * 6.3, side: j % 2 ? 1 : -1 };
      }) };
    var g = view.guide.position, other = sc.hx > g.x ? -1 : 1;   // the far side of Shelly, a little way ahead
    sc.tx = Math.max(-9, Math.min(9, g.x + other * (3 + Math.random() * 4))); sc.tz = g.z - 5 - Math.random() * 8;
  }


  var REEF3D_SURPRISES = ['fish', 'shell', 'bubbles', 'fact'];
  function reef3dSurprise(view, s){
    var bubble = view.wrap.querySelector('.r3-bubble');
    var kind = REEF3D_SURPRISES[(s.i * 7 + (view.surpriseN = (view.surpriseN || 0) + 1)) % REEF3D_SURPRISES.length];
    var f = REEF_FRIENDS[(s.i * 3 + view.surpriseN) % REEF_FRIENDS.length];
    var e = kind === 'shell' ? '🦪' : kind === 'bubbles' ? '🫧' : f.e;
    var head = kind === 'shell' ? 'A pearl!' : kind === 'bubbles' ? 'Magic bubbles!' : kind === 'fish' ? 'A ' + f.name.toLowerCase() + '!' : 'A sea secret!';
    var sub = kind === 'fact' ? f.fact : kind === 'fish' ? 'A new friend swam by.' : kind === 'shell' ? 'The shell opened just for you.' : 'Pop, pop, pop!';
    if(bubble) bubble.hidden = true;
    reef3dPrize(view, e, head, sub);
    if(!reefCalm() && kind !== 'fact') reef3dSwimBy(view, s, f, kind);
  }
  // The ? block's prize: shown in the middle of the screen with a "ta-da" (not read aloud). Tap to close.
  function reef3dPrize(view, e, head, sub){
    var old = view.wrap.querySelector('.r3-prize'); if(old) old.remove();
    var el = document.createElement('div');
    el.className = 'r3-prize'; el.setAttribute('role', 'status');
    var rays = ''; for(var i = 0; i < 10; i++) rays += '<i style="--a:' + (i * 36) + 'deg"></i>';
    el.innerHTML = '<div class="r3-prize-rays" aria-hidden="true">' + rays + '</div><div class="r3-prize-card">' +
      '<div class="r3-prize-e" aria-hidden="true">' + e + '</div><b>' + esc(head) + '</b><span>' + esc(sub) + '</span></div>';
    view.wrap.appendChild(el);
    try { Sound.sessionStart(); } catch(err){}
    function close(){ clearTimeout(view.prizeTimer); el.classList.add('out'); setTimeout(function(){ el.remove(); }, reefCalm() ? 0 : 260); }
    el.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); close(); });
    clearTimeout(view.prizeTimer);
    view.prizeTimer = setTimeout(close, 3800);
  }
  function reef3dSwimBy(view, s, f, kind){
    if(kind === 'fish' && view.models && view.models.dolphin){ // a real dolphin swims past Shelly
      var THREE = window.THREE, d = reef3dModel(view.models, 'dolphin', 1.1, view.kit.grad);
      if(d){
        var w = new THREE.Group(); w.add(d); view.scene.add(w);
        var mx = new THREE.AnimationMixer(d.userData.root), clip = d.userData.gltf.animations[0]; if(clip) mx.clipAction(clip).play();
        var y0 = 2.4, last = performance.now();
        w.rotation.y = Math.PI / 2;
        view.fx.push({ t0: performance.now(), dur: 3200,
          step: function(p){ var now = performance.now(); mx.update((now - last) / 1000); last = now; w.position.set(s.x - 12 + p * 24, y0 + Math.sin(p * Math.PI * 2) * .8, s.z - 1.5); w.rotation.z = Math.cos(p * Math.PI * 2) * .25; },
          end: function(){ view.scene.remove(w); } });
        return;
      }
    }
    var el = document.createElement('div');
    el.className = 'r3-swim ' + kind; el.setAttribute('aria-hidden', 'true');
    el.textContent = kind === 'fish' ? f.e : kind === 'shell' ? '🐚' : '🫧';
    view.wrap.appendChild(el);
    setTimeout(function(){ el.remove(); }, 2600);
  }

  function reef3dGoTo(view, i){
    var s = view.spaces[i];
    if(view.dice){ reef3dDiceHit(view); return; }
    if(!s || view.moving) return;
    view.ring.visible = false;
    reef3dTravel(view, i, function(){ reef3dArrive(view, s); });
  }
  // What happens when the guide stops on a space she was sent to (a deck opens, the Treasure Reef shelf opens…).
  function reef3dArrive(view, s){
    var i = s.i;
    (function(){
      S.reef3dAt = i;
      if(s.kind === 'shop') return reef3dShop(view, null, true);
      if(s.kind === 'surprise'){
        if(reefCalm()){ reef3dQHit(view, s); return reef3dSurprise(view, s); }
        reef3dEmote(view, 'bonk', function(){ reef3dEmote(view, 'startle'); });
        setTimeout(function(){ reef3dQHit(view, s); reef3dCrabAct(view, 'Dance', true); }, 400);    // the moment her head meets the block
        return setTimeout(function(){ reef3dSurprise(view, s); }, 700);
      }
      if(s.kind === 'deck' && !reefCalm()) reef3dCrabAct(view, 'Yes', true);
      if(s.kind === 'treasure' && view.chestActs.open){ var co = view.chestActs.open; co.reset(); co.setLoop(window.THREE.LoopOnce); co.clampWhenFinished = true; co.play(); }
      if(s.kind === 'deck' || s.kind === 'treasure') reef3dStars(view, s);
      if(s.kind === 'deck' || s.kind === 'story') reef3dEmote(view, 'dive'); else if(s.kind === 'treasure') reef3dEmote(view, 'twirl');
      if(s.kind === 'deck'){ Sound.bloop(520); S.reefReturnY = window.scrollY; return setTimeout(function(){ reefGo('dive', s.label, function(){ reefStartDeck(s.item.d.id); }); }, reefCalm() ? 0 : 750); }
      if(s.kind === 'treasure'){ Sound.bloop(600); S.reefReturnY = window.scrollY; return setTimeout(function(){ reefGo('swim', s.label, function(){ S.view = 'collection'; render(); window.scrollTo(0, 0); }); }, reefCalm() ? 0 : 750); }
      if(s.kind === 'story'){ S.reefReturnY = window.scrollY; return setTimeout(function(){ reefGo('dive', s.label, startStoryMaker); }, reefCalm() ? 0 : 250); }
    })();
  }

  // Coral Classroom on the map: the course as a voyage. Each unit is an island with its dates; finished ones fly a
  // flag, Shelly (Lumi at night) sits on today's, and the ones still to come wait further along the route.
  function reef3dVoyageHTML(view){
    var n = reefCourseNow(); if(!n || !n.co.units.length) return '';
    var nice = function(iso){ var p = String(iso || '').split('-'); try { return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch(e){ return iso; } };
    return '<div class="r3-voyage" aria-label="Your course"><b class="r3-voy-h">Your voyage: ' + esc(n.co.goal || 'my course') + '</b><ol>' + n.co.units.map(function(u, i){
      var st = u.done ? 'done' : i === n.i ? 'now' : 'later';
      return '<li class="r3-isle ' + st + (u.review ? ' review' : '') + '"><span class="r3-isle-i" aria-hidden="true">' + (u.done ? '🚩' : i === n.i ? reefGuideMini(view.night) : u.review ? '⭐' : '🏝️') + '</span>' +
        '<span class="r3-isle-t">' + esc(u.title) + '</span><small>' + nice(u.start) + '</small></li>'; }).join('') + '</ol></div>';
  }
  // Treasure map: the whole board from above on parchment. Tap a deck to send the guide there.
  function reef3dMap(view, fromZoom){
    var sp = view.spaces, minX = -8, maxX = 8, minZ = 0, maxZ = 2;
    sp.forEach(function(s){ minX = Math.min(minX, s.x - 2); maxX = Math.max(maxX, s.x + 2); minZ = Math.min(minZ, s.z - 2); });
    var W = 300, H = Math.max(420, (maxZ - minZ) * 13);
    function px(s){ return ((s.x - minX) / (maxX - minX)) * (W - 60) + 30; }
    function py(s){ return ((maxZ - s.z) / (maxZ - minZ)) * (H - 60) + 30; }
    var d = reef3dPathLines(sp).map(function(ln){ return 'M' + ln.map(function(s){ return px(s).toFixed(1) + ' ' + py(s).toFixed(1); }).join('L'); }).join(' ');
    var dots = sp.map(function(s){
      if(s.kind === 'plain' || s.kind === 'start') return '<circle cx="'+px(s).toFixed(1)+'" cy="'+py(s).toFixed(1)+'" r="4" fill="#a8814f"/>';
      if(s.kind === 'surprise') return '<text x="'+px(s).toFixed(1)+'" y="'+(py(s) + 5).toFixed(1)+'" text-anchor="middle" font-size="14" fill="#2f8f95">✦</text>';
      return '';
    }).join('');
    var spots = sp.filter(function(s){ return s.label; }).map(function(s){
      var x = px(s), y = py(s), left = x > W / 2;
      var name = s.kind === 'deck' ? s.item.d.name : s.kind === 'treasure' ? 'Aquarium' : 'Story Bottle';
      var em = s.kind === 'deck' ? s.item.d.emoji : s.kind === 'treasure' ? '🐠' : '🍾';
      return '<button type="button" class="r3-map-spot'+(s.kind === 'deck' ? ' ' + s.item.state : '')+(left ? ' left' : '')+'" data-r3-go="'+s.i+'" style="left:'+(x / W * 100).toFixed(1)+'%;top:'+y.toFixed(0)+'px" aria-label="Go to '+esc(name)+'">' +
        '<span class="r3-map-em" aria-hidden="true">'+em+'</span><span class="r3-map-name">'+esc(name)+'</span></button>';
    }).join('');
    var me = sp[view.at];
    var ov = document.createElement('div');
    ov.className = 'r3-map' + (fromZoom ? ' from-zoom' : ''); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Treasure map');
    ov.innerHTML = '<div class="r3-map-card"><div class="r3-map-head"><b>Treasure map</b><button type="button" class="r3-map-close" data-r3-close aria-label="Close the map">'+ccIcon('close')+'</button></div>' +
      '<p class="r3-map-hint">Tap a place to swim there.</p>' + reef3dVoyageHTML(view) +
      '<div class="r3-map-board" style="height:'+H+'px"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="'+d+'" fill="none" stroke="#b5452f" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>' + dots + '</svg>' + spots +
        '<span class="r3-map-me" style="left:'+(px(me) / W * 100).toFixed(1)+'%;top:'+py(me).toFixed(0)+'px" aria-hidden="true">'+reefGuideMini(view.night)+'</span>' +
      '</div></div>';
    function close(){
      var mb = view.wrap.querySelector('[data-r3-map]');
      if(!view.zoomNow){ ov.remove(); if(mb) mb.focus(); return; }
      // opened by a pinch: the map fades away as the camera swoops back down to her
      ov.classList.add('closing'); setTimeout(function(){ ov.remove(); }, 380);
      reef3dZoomTo(view, 0, 700, function(){ view.zoomCenter = null; });
      if(mb) mb.focus();
    }
    ov.addEventListener('click', function(e){
      var go = e.target.closest('[data-r3-go]');
      if(go){ ov.remove(); view.zoomAnim = null; view.zoomGoal = null; view.zoomNow = 0; view.zoomCenter = null; return reef3dGoTo(view, +go.dataset.r3Go); }
      if(e.target.closest('[data-r3-close]') || e.target === ov) close();
    });
    ov.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
    document.body.appendChild(ov);
    var meEl = ov.querySelector('.r3-map-me'); if(meEl) meEl.scrollIntoView({ block: 'center' });
    ov.querySelector('[data-r3-close]').focus();
  }

  /* ---- Pinch to the map: two fingers closing pull the camera up and back over the board; close them far enough
     (or let go past three quarters of the way) and it keeps rising while the treasure map fades in. Let go
     sooner and it settles back. A trackpad pinch (ctrl + wheel, or Safari's gesture events) works the same way.
     Closing a map opened like this swoops the camera back down. ---- */
  function reef3dZoomFrame(view, now){
    var a = view.zoomAnim;
    if(a){ var p = Math.min(1, (now - a.t0) / a.dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      view.zoomNow = a.from + (a.to - a.from) * e; if(p >= 1){ view.zoomAnim = null; if(a.done) a.done(); } }
    else if(view.zoomGoal != null) view.zoomNow = (view.zoomNow || 0) + (view.zoomGoal - (view.zoomNow || 0)) * .35;
    var out = view.outskirts;
    if(!view.zoomNow || view.zoomNow < .002){ view.zoomNow = 0; if(out) out.visible = false; return false; }
    out = reef3dOutskirts(view); if(out) out.visible = view.zoomNow > .2;   // once the camera has risen a little, so nothing pops in beside her
    view.touchAt = now;   // keeps the board drawing every frame while the camera moves
    if(!view.zoomCenter){
      var THREE = window.THREE, sp = view.spaces, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      sp.forEach(function(s){ minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z); });
      // at night the ship reaches past the path: the stern behind the start and the long bow beyond the end
      var ship = view.night && sp.ship ? sp.ship.half : 0;
      if(ship){ maxZ += ship * .55 + 6; minZ -= ship * 2.6 + 6; minX = Math.min(minX, -ship); maxX = Math.max(maxX, ship); }
      view.zoomCenter = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      // high enough that the whole board (the whole ship at night) fits on the screen, either way up
      var span = 2 * Math.tan(view.cam.fov * Math.PI / 360);
      view.zoomH = Math.max(28, (maxZ - minZ + 10) / span, (maxX - minX + 10) / (span * view.cam.aspect));
    }
    return true;
  }
  /* The reef carries on past the board: built the first time she pinches out, and only shown while zoomed out.
     A wide sea floor that follows on from the board's own (its sides slope up, then level off), and a broad ring
     of coral, kelp and rocks (by night: rocks, kelp, dark coral, planks, barrels, anchors and far-off wrecks),
     merged into a few draws so it costs little. */
  function reef3dOutskirts(view){
    if(view.outskirts !== undefined) return view.outskirts;
    view.outskirts = null;
    try {
      var THREE = window.THREE, kit = view.kit, B = kit.B, night = view.night, sp = view.spaces, r = reefRand(91);
      var minZ = 1e9, maxZ = -1e9; sp.forEach(function(s){ minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z); });
      var off = night && view.shipDeck ? view.shipDeck.sand : 0, len = maxZ - minZ, cz = (minZ + maxZ) / 2;
      var W = 260, L = len + 260;
      var hgt = function(x, z){ return Math.min(6.5, Math.max(0, (Math.abs(x) - 12) * .25)) + Math.sin(x * .21) * .35 + Math.cos(z * .17 + x * .05) * .35 - .45 + off; };
      var g = new THREE.PlaneGeometry(W, L, 52, Math.round(L / 5)), pos = g.attributes.position;
      for(var v = 0; v < pos.count; v++){ var x = pos.getX(v), z = cz - pos.getY(v); pos.setZ(v, hgt(x, z)); }
      g.computeVertexNormals();
      var root = new THREE.Group();
      var bed = new THREE.Mesh(g, kit.M(night ? '#2a3838' : '#d4c49d')); bed.rotation.x = -Math.PI / 2; bed.position.set(0, -.15, cz); root.add(bed);
      var deco = new THREE.Group();
      var set = night ? ['rock', 'rock', 'kelp', 'coralBall', 'plank', 'barrel', 'crate', 'kelp', 'anchor', 'cannon']
                      : ['staghorn', 'brain', 'fan', 'coralBall', 'kelp', 'sponge', 'anemone', 'rock', 'staghorn', 'coralBall', 'star', 'kelp'];
      // keep clear of the path (and, at night, of the ship) so nothing new crowds the board
      var ship = night && view.shipDeck ? view.shipDeck.half + 4 : 0;
      function clearOf(x, z){
        if(ship && Math.abs(x) < ship && z < maxZ + 12 && z > minZ - ship * 2.8) return false;
        for(var i = 0; i < sp.length; i += 2){ var dx = sp[i].x - x, dz = sp[i].z - z; if(dx * dx + dz * dz < 64) return false; }
        return true;
      }
      // beds of colour on the sand, so no stretch of it is bare from above
      var bedCols = night ? ['#23463f', '#2c3f52', '#3a2f4a', '#24413a'] : ['#f2b8c6', '#c9b6f0', '#a8dcb0', '#f6d08a', '#9fd6e8'];
      for(var bI = 0; bI < 90; bI++){
        var bx = (r() - .5) * (W - 20), bz = cz + (r() - .5) * (L - 20); if(!clearOf(bx, bz)) continue;
        var bg = new THREE.CircleGeometry(4 + r() * 7, 18); bg.rotateX(-Math.PI / 2);
        var bm = new THREE.Mesh(bg, kit.M(bedCols[bI % bedCols.length])); bm.scale.set(1, 1, .6 + r() * .8); bm.rotation.y = r() * 6; bm.position.set(bx, hgt(bx, bz) - .1, bz); deco.add(bm);
      }
      for(var n = 0; n < 720; n++){
        var px = (r() - .5) * (W - 20), pz = cz + (r() - .5) * (L - 20);
        if(!clearOf(px, pz)) continue;
        var nm = set[Math.floor(r() * set.length)]; if(!B[nm]) continue;
        // coral grows in clumps: a few of each together
        var clump = night ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 3);
        for(var c = 0; c < clump; c++){
          var d = B[nm](r); var cx = px + (r() - .5) * 4, czz = pz + (r() - .5) * 4;
          d.position.set(cx, hgt(cx, czz) - .15, czz); d.rotation.y = r() * 6; d.scale.multiplyScalar(1.6 + r() * 2.2); deco.add(d);
        }
      }
      if(night && view.models){ for(var w = 0; w < 4; w++){ var wr = reef3dModel(view.models, 'wreck', 9 + r() * 5, kit.grad, '#3c5560'); if(!wr) break;
        var wx = (w % 2 ? 1 : -1) * (55 + r() * 40), wz = cz + (r() - .5) * len; wr.traverse(function(m){ if(/^grass/.test(m.name || '')) m.visible = false; });
        wr.position.set(wx, hgt(wx, wz) - .3, wz); wr.rotation.y = r() * 6; deco.add(wr); } }
      root.add(view.rig ? reef3dMerge(deco, view.rig, view.bake || {}) : deco);
      root.visible = false; view.scene.add(root); view.outskirts = root;
    } catch(err){ try { console.warn('reef outskirts skipped:', err); } catch(e){} }
    return view.outskirts;
  }
  function reef3dZoomTo(view, to, dur, done){ view.zoomGoal = null; view.zoomAnim = { from: view.zoomNow || 0, to: to, t0: performance.now(), dur: reefCalm() ? 1 : dur, done: done }; }
  function reef3dZoomRelease(view){
    if(view.mapOpening) return;
    if((view.zoomNow || 0) >= .75) reef3dZoomToMap(view);
    else reef3dZoomTo(view, 0, 380);
  }
  function reef3dZoomToMap(view){
    if(view.mapOpening || document.querySelector('.r3-map')) return;
    view.mapOpening = true; view.zoomCenter = null;
    reef3dZoomTo(view, 1.35, 750, function(){ view.mapOpening = false; });
    try { Sound.bubbles(3); } catch(e){}
    setTimeout(function(){ if(document.body.contains(view.wrap)) reef3dMap(view, true); }, reefCalm() ? 0 : 330);
  }
  function reef3dPinchWire(view){
    var el = view.wrap, pinch = null;
    // the reef beyond the board is made ahead of time, when the device is quiet, so the first pinch is smooth
    setTimeout(function(){ var idle = window.requestIdleCallback || function(f){ setTimeout(f, 0); }; idle(function(){ if(document.body.contains(view.wrap)) reef3dOutskirts(view); }); }, 5000);
    var dist = function(t){ return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); };
    var set = function(scale){   // scale < 1: fingers closing
      if(view.mapOpening || document.querySelector('.r3-map') || view.moving) return;
      view.pinching = performance.now(); view.zoomAnim = null; view.zoomCenter = view.zoomCenter || null;
      view.zoomGoal = Math.max(0, Math.min(1.05, (1 - scale) / .5));
      if(view.zoomGoal >= 1) reef3dZoomToMap(view);
    };
    el.addEventListener('touchstart', function(e){ if(e.touches.length === 2){ pinch = { d0: dist(e.touches) || 1 }; } }, { passive: true });
    el.addEventListener('touchmove', function(e){ if(!pinch || e.touches.length !== 2) return; e.preventDefault(); set(dist(e.touches) / pinch.d0); }, { passive: false });
    el.addEventListener('touchend', function(e){ if(pinch && e.touches.length < 2){ pinch = null; reef3dZoomRelease(view); } });
    el.addEventListener('touchcancel', function(){ if(pinch){ pinch = null; reef3dZoomRelease(view); } });
    // Safari on a Mac (and iPad Safari as a backup): gesture events carry the pinch scale
    var g0 = null;
    el.addEventListener('gesturestart', function(e){ e.preventDefault(); g0 = 1; });
    el.addEventListener('gesturechange', function(e){ e.preventDefault(); if(!pinch) set(e.scale); });
    el.addEventListener('gestureend', function(e){ e.preventDefault(); if(g0 && !pinch){ g0 = null; reef3dZoomRelease(view); } });
    // a trackpad pinch in other browsers arrives as ctrl + wheel
    var wz = 0, wt = null;
    el.addEventListener('wheel', function(e){
      if(!e.ctrlKey) return; e.preventDefault();
      if(!wt) wz = view.zoomNow || 0;   // a pinch that starts again picks up where the camera is
      wz = Math.max(0, Math.min(1.05, wz + e.deltaY * .012)); set(1 - wz * .5);
      clearTimeout(wt); wt = setTimeout(function(){ wt = null; reef3dZoomRelease(view); }, 350);
    }, { passive: false });
  }

  function reef3dWire(view){
    reef3dPinchWire(view);
    var THREE = window.THREE, ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
    view.wrap.addEventListener('pointerdown', function(e){ down = { x: e.clientX, y: e.clientY }; view.touchAt = performance.now(); view.idle = false; reef3dAmbience(view, true); });
    view.renderer.domElement.addEventListener('click', function(e){
      if(down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 12) return;
      if(view.pinching && performance.now() - view.pinching < 400) return;   // the end of a pinch isn't a tap
      if(view.dice) return reef3dDiceHit(view);   // while the dice is out, a tap anywhere rolls it
      var rc = view.renderer.domElement.getBoundingClientRect();
      ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ptr, view.cam);
      if(!view.moving && ray.intersectObject(view.guide, true).length){
        try { Sound.bubbles(3); } catch(err){}
        return reef3dEmote(view, 'giggle');
      }
      // the crab or a school of fish near the tap reacts; otherwise the tap moves Shelly as before
      if(view.crab && !view.leaving && !view.crab.userData.entering &&
         (ray.intersectObject(view.crab, true).length || reef3dTapDist(view, view.crab.position.clone().setY(.45), e, rc) < 60)) return reef3dCrabTap(view);
      var near = null, nd = 70;
      view.schools.forEach(function(sc){ sc.fish.forEach(function(f){ var d = reef3dTapDist(view, f.position, e, rc); if(d < nd){ nd = d; near = sc; } }); });
      if(near) return reef3dScatter(view, near);
      var hit = ray.intersectObjects(view.hitables, true).find(function(h){ return h.object.userData.space != null; });
      if(hit) return reef3dGoTo(view, hit.object.userData.space);
      // otherwise: the board space nearest to where the tap meets the sand (tile edges, bevels)
      var p = new THREE.Vector3(); if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -.3), p)) return;
      var best = null, bd = 2.2;
      view.spaces.forEach(function(s){ var d = Math.hypot(s.x - p.x, s.z - p.z); if(d < bd){ bd = d; best = s; } });
      if(best) reef3dGoTo(view, best.i);
    });
    view.wrap.querySelector('.r3-labels').addEventListener('click', function(e){
      var b = e.target.closest('[data-space]'); if(b) reef3dGoTo(view, +b.dataset.space);
    });
    view.wrap.querySelector('[data-r3-map]').addEventListener('click', function(){ reef3dMap(view); });
    view.wrap.querySelector('[data-r3-games]').addEventListener('click', function(e){ e.stopPropagation(); if(!view.moving && !(view.dice && !view.dice.rolling)) reef3dGames(view); });   // the dice can still be waiting for a tap
    view.wrap.querySelector('[data-r3-mode]').addEventListener('click', function(e){
      e.stopPropagation(); var b = reefBoard(); b.mode = reef3dStoryOn() ? 'free' : 'story'; reefBoardSave(); reef3dHud(view);
      if(!reef3dStoryMark(view)){ var nx = view.spaces.find(function(x){ return x.kind === 'deck' && x.item.state === 'ready'; }); view.ring.visible = !!nx; if(nx) view.ring.position.set(nx.x, .34 + (nx.y || 0), nx.z); }
      try { Sound.tap(); } catch(err){}
      if(reef3dStoryOn() && reef3dStoryTarget(view) >= 0 && reef3dStoryTarget(view) !== view.at) setTimeout(function(){ if(!view.moving) reef3dDice(view); }, 600);   // story mode: roll for the next stop
    });
    view.wrap.querySelector('[data-r3-theme]').addEventListener('click', function(){ reef3dThemeShow(view); });
  }

