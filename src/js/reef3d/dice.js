  /* ---------- The dice block (after leaving a deck): it floats over the guide's head and flicks through its
     numbers; a tap and she jumps up and hits it, then hops that many spaces along the path, counting down.
     Before the tap she can pick a die: the regular one, her guide's own die, Kiko's die, or Double Dice from
     the shop. Passing the golden pearl or the shop stops her to visit; a closed clam gate stops her short. ---------- */
  function reef3dDiceTex(n, night){
    var THREE = window.THREE, N = 192, cv = document.createElement('canvas'); cv.width = cv.height = N; var gx = cv.getContext('2d');
    var bg = gx.createLinearGradient(0, 0, 0, N); bg.addColorStop(0, night ? '#c9fff8' : '#ffffff'); bg.addColorStop(1, night ? '#7fd8e0' : '#e9eef6');
    gx.fillStyle = bg; gx.fillRect(0, 0, N, N);
    gx.lineWidth = 10; gx.strokeStyle = night ? '#2aa7b6' : '#5a8fd8'; gx.strokeRect(14, 14, N - 28, N - 28);
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 2; t.userData = { cv: cv, night: night };
    reef3dDiceDraw(t, n); return t;
  }
  function reef3dDiceDraw(t, n){
    var cv = t.userData.cv, gx = cv.getContext('2d'), N = cv.width, night = t.userData.night;
    gx.save(); gx.beginPath(); gx.rect(22, 22, N - 44, N - 44); gx.clip();
    var bg = gx.createLinearGradient(0, 0, 0, N); bg.addColorStop(0, night ? '#c9fff8' : '#ffffff'); bg.addColorStop(1, night ? '#7fd8e0' : '#e9eef6');
    gx.fillStyle = bg; gx.fillRect(0, 0, N, N); gx.restore();
    gx.font = '900 ' + (String(n).length > 1 ? 104 : 128) + 'px "Baloo 2", system-ui, -apple-system, sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle';
    gx.lineJoin = 'round'; gx.lineWidth = 14; gx.strokeStyle = night ? '#0f4a55' : '#1d4f9a'; gx.strokeText(String(n), N / 2, N / 2 + 8);
    gx.fillStyle = night ? '#ffffff' : '#ffd24a'; gx.fillText(String(n), N / 2, N / 2 + 8);
    t.needsUpdate = true;
  }
  // The dice she can pick. Faces are what the block flicks through and lands on.
  function reef3dDiceKinds(view){
    var b = reefBoard(), list = [
      { id: 'regular', label: '🎲 1 to 6', faces: [1, 2, 3, 4, 5, 6] },
      view.night ? { id: 'guide', label: 'Lumi: 1 or 7', pic: true, faces: [1, 1, 1, 7, 7, 7] } : { id: 'guide', label: 'Shelly: 3 or 4', pic: true, faces: [3, 3, 3, 4, 4, 4] },
      { id: 'kiko', label: '🦀 Kiko: 0 gives 🐚3', faces: [0, 0, 2, 2, 6, 6] }
    ];
    if(b.dbl > 0) list.push({ id: 'double', label: '🎲🎲 Double (' + b.dbl + ')', faces: [1, 2, 3, 4, 5, 6], double: true });
    return list;
  }
  function reef3dDiceRoll(k){ var f = k.faces, r = function(){ return f[Math.floor(Math.random() * f.length)]; }; return k.double ? r() + r() : r(); }
  function reef3dDice(view){
    if(view.dice || !reef3dWays(view.spaces, view.at).length || !document.body.contains(view.wrap)) return;
    var THREE = window.THREE, b = reefBoard(), kinds = reef3dDiceKinds(view);
    var kind = kinds.find(function(k){ return k.id === b.die; }) || kinds[0];
    var n = reef3dDiceRoll(kind);
    // Story mode: the dice always lands on exactly the number of spaces to today's next deck (no picking a die)
    var storyTo = reef3dStoryTarget(view), storyN = storyTo >= 0 && storyTo !== view.at ? reef3dRoute(view.spaces, view.at, storyTo).length : 0;
    if(storyN){ n = storyN; kind = kinds[0]; }   // a plain die, so no special-die effects either
    var tex = reef3dDiceTex(n, view.night);
    var mat = new THREE.MeshLambertMaterial({ map: tex, emissive: view.night ? '#38e6d6' : '#7fb0ff', emissiveIntensity: view.night ? .45 : .12 });
    var box = new THREE.Mesh(reef3dRoundBox(1.05, .16, 4), mat), dg = new THREE.Group(); dg.add(box);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: reef3dBlobTex(true), color: view.night ? '#5ff0e0' : '#bfe0ff', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(2.6); halo.raycast = function(){}; dg.add(halo);
    var gp = view.guide.position; dg.position.set(gp.x, REEF3D_QY + gp.y - .3, gp.z); dg.scale.setScalar(.01); view.scene.add(dg);
    var here = view.spaces[view.at]; if(here && here.qb) here.qb.visible = false;
    var d = view.dice = { g: dg, box: box, mat: mat, tex: tex, halo: halo, n: n, kind: kind, rolling: true, t0: performance.now(), flick: 0, here: here };
    var ui = document.createElement('div'); ui.className = 'r3-dice-ui';
    function pickHTML(){ return reef3dDiceKinds(view).map(function(k){ return '<button type="button" class="r3-die-pick" data-die="' + k.id + '" aria-pressed="' + (k.id === d.kind.id) + '">' + (k.pic ? reefGuideMini(view.night) + ' ' : '') + esc(k.label) + '</button>'; }).join(''); }
    ui.innerHTML = (storyN ? '' : '<div class="r3-die-picks" role="group" aria-label="Pick a die">' + pickHTML() + '</div>') + '<button type="button" class="r3-dice-tip">🎲 Tap to roll!</button>';
    ui.addEventListener('click', function(e){
      e.stopPropagation();
      var pk = e.target.closest('[data-die]');
      if(pk){
        var k = reef3dDiceKinds(view).find(function(x){ return x.id === pk.dataset.die; }); if(!k || !d.rolling) return;
        d.kind = k; d.n = reef3dDiceRoll(k); b.die = k.id === 'double' ? b.die : k.id; reefBoardSave();
        ui.querySelectorAll('[data-die]').forEach(function(x){ x.setAttribute('aria-pressed', String(x.dataset.die === k.id)); });
        try { Sound.tap(); } catch(err){} return;
      }
      if(e.target.closest('.r3-dice-tip')) reef3dDiceHit(view);
    });
    view.wrap.appendChild(ui); d.tip = ui;
    try { Sound.bloop(660, 0, .05); Sound.bloop(990, .1, .04); } catch(e){}
    if(reefCalm()) dg.scale.setScalar(1);
  }
  // Every frame while the dice is out: grow in, bob and spin, and flick through the numbers until it's hit.
  function reef3dDiceTick(view, now, t){
    var d = view.dice; if(!d) return;
    var gp = view.guide.position, age = (now - d.t0) / 1000;
    if(!d.hitAt){
      d.g.position.set(gp.x, REEF3D_QY + gp.y - .3 + Math.sin(t * 2.2) * .12, gp.z);
      if(!reefCalm()){ var k = Math.min(1, age / .45); d.g.scale.setScalar(k < 1 ? reef3dBounce(k) * 1.1 + .01 : 1); d.box.rotation.y = t * 1.8; d.box.rotation.x = Math.sin(t * 1.3) * .25; }
      d.halo.material.opacity = .4 + .2 * Math.sin(t * 5);
      if(d.rolling && now - d.flick > 85){ d.flick = now; var m, tries = 0; do { m = reef3dDiceRoll(d.kind); } while(m === d.shown && ++tries < 6); d.shown = m; reef3dDiceDraw(d.tex, m); try { Sound.tick(); } catch(e){} }
    } else if(d.counting){
      // hovering over her head while she hops, showing how many hops are left
      d.g.position.set(gp.x, gp.y + view.guide.userData.body.position.y + 2.5, gp.z); d.g.scale.setScalar(.7); d.box.rotation.set(0, Math.atan2(view.cam.position.x - gp.x, view.cam.position.z - gp.z), 0);
    }
  }
  function reef3dDiceHit(view){
    var d = view.dice; if(!d || !d.rolling || view.moving) return;
    d.rolling = false; if(d.tip){ d.tip.remove(); d.tip = null; }
    if(d.kind.double){ var b = reefBoard(); b.dbl = Math.max(0, (b.dbl || 0) - 1); reefBoardSave(); }
    var calm = reefCalm();
    if(!calm) reef3dEmote(view, 'bonk');
    setTimeout(function(){
      if(view.dice !== d) return;
      d.hitAt = performance.now(); d.shown = d.n; reef3dDiceDraw(d.tex, d.n);
      try { Sound.bloop(880, 0, .06); Sound.bloop(1320, .09, .05); } catch(e){}
      if(!calm){
        var y0 = d.g.position.y, r0 = d.box.rotation.y;
        view.fx.push({ t0: performance.now(), dur: 700, step: function(p){
          d.g.position.y = y0 + Math.sin(Math.min(1, p / .5) * Math.PI) * .5; d.box.rotation.y = r0 + reef3dEase(p) * Math.PI * 3; d.box.rotation.x = 0;
          d.g.scale.setScalar(1 + .35 * Math.sin(p * Math.PI)); d.mat.emissiveIntensity = (view.night ? .45 : .12) + 1.4 * Math.max(0, 1 - p * 2);
        }, end: function(){} });
      }
      var big = document.createElement('div'); big.className = 'r3-dice-num'; big.setAttribute('role', 'status'); big.textContent = d.n;
      view.wrap.appendChild(big); setTimeout(function(){ big.remove(); }, 1300);
      if(d.n === 0){   // Kiko's zero: no hops, but shells
        setTimeout(function(){ reef3dDiceDone(view, d); reef3dShells(view, 3, 'Kiko\'s zero'); reef3dCrabAct(view, 'Dance', true); reef3dAfterTurn(view); }, calm ? 300 : 1100);
        return;
      }
      setTimeout(function(){ reef3dDiceMove(view, d); }, calm ? 300 : 1000);
    }, calm ? 0 : 400);   // the moment her head meets the block
  }
  function reef3dDiceMove(view, d){
    var left = d.n, sp = view.spaces, story = reef3dStoryTarget(view), gateStop = false;
    d.counting = true; reef3dDiceDraw(d.tex, left);
    // Hop along until the count runs out, the path ends, or something comes up on the way: a fork (she picks a
    // way, like Mario Party), the golden pearl or the shop (she stops to visit), a closed clam gate (she waits),
    // or, in story mode, today's next deck.
    function stretch(firstStep){
      var route = [], at = view.at, next = firstStep;
      while(left - route.length > 0){
        if(next == null){
          var opts = reef3dWays(sp, at);
          if(!opts.length) break;
          if(opts.length > 1 && story >= 0){ var way = reef3dRoute(sp, at, story)[0]; if(opts.indexOf(way) >= 0) next = way; }
          if(next == null && opts.length > 1){
            if(route.length || at !== d.startAt || d.asked) return run(route, function(){ choose(opts); });
            return choose(opts);
          }
          if(next == null) next = opts[0];
        }
        if(story < 0 && reef3dGateShut(view, at, next)){ gateStop = true; break; }   // in story mode the clam lets her through
        route.push(next); at = next; next = null;
        if(sp[at].end || at === story) break;
        if(left - route.length > 0 && (at === reefBoard().pearlAt || sp[at].kind === 'shop')){
          var stop = sp[at];
          return run(route, function(){ reef3dVisit(view, stop, true, function(){ stretch(null); }); });
        }
      }
      run(route, land);
    }
    function run(route, then){
      if(!route.length) return then();
      reef3dTravel(view, route[route.length - 1], then, function(){ left--; if(view.dice === d) reef3dDiceDraw(d.tex, left); }, route);
    }
    function choose(opts){
      if(left <= 0) return land();
      d.asked = true;
      var box = document.createElement('div'); box.className = 'r3-fork'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Which way?');
      box.innerHTML = '<b>Which way?</b>' + opts.map(function(n){
        var br = sp[n].branch;
        var lab = br === 'treasure' ? '🐠 Aquarium' : br === 'story' ? '🍾 Story Bottle' : '⬆️ Keep going';
        return '<button type="button" data-fork="' + n + '">' + lab + '</button>';
      }).join('');
      view.wrap.appendChild(box); d.fork = box;
      try { Sound.bloop(700, 0, .05); } catch(e){}
      box.addEventListener('click', function(e){
        var b = e.target.closest('[data-fork]'); if(!b) return; e.stopPropagation();
        box.remove(); d.fork = null; try { Sound.tap(); } catch(err){}
        stretch(+b.dataset.fork);
      });
    }
    function land(){
      reef3dDiceDone(view, d);
      S.reef3dAt = view.at;
      var s = sp[view.at];
      if(gateStop) reef3dPrize(view, '🐚', 'The clam is shut!', 'It opens again next turn.');
      if(story >= 0 && view.at === story) return reef3dStoryArrive(view, s);
      if(s.kind === 'treasure' || s.kind === 'story') return reef3dArrive(view, s);   // the end of a branch: go in
      reef3dVisit(view, s, false, function(){ reef3dAfterTurn(view); });
    }
    d.startAt = view.at;
    stretch(null);
  }
  // The ways forward from a space: along the main path, and onto a branch at a fork. On a branch, toward its end.
  function reef3dWays(spaces, i){
    var s = spaces[i];
    if(s.branch) return s.end ? [] : (s.links || []).filter(function(n){ return n > i; });
    return (s.links || []).filter(function(n){ return n > i; });
  }
  function reef3dDiceDone(view, d){
    if(view.dice !== d) return;
    view.dice = null; if(d.tip) d.tip.remove(); if(d.fork) d.fork.remove(); if(d.here && d.here.qb) d.here.qb.visible = true;
    var fin = function(){ view.scene.remove(d.g); d.box.geometry.dispose(); d.mat.dispose(); d.tex.dispose(); d.halo.material.dispose(); };
    if(reefCalm()) return fin();
    var s0 = d.g.scale.x;
    view.fx.push({ t0: performance.now(), dur: 300, step: function(p){ d.g.scale.setScalar(s0 * (1 + .3 * Math.sin(p * Math.PI) - p)); d.g.position.y += .02; }, end: fin });
  }

