  /* ---------- REEF 3D: a game board on the sea floor (a sunken ship at night). Shelly (Lumi at night)
     stands on a space; tapping a deck or a surprise space makes her hop along the path to it while the
     camera follows. The painted 2D reef stays underneath as the fallback when 3D can't run. ---------- */
  var REEF_THREE_URL = 'three.min.js';
  var R3 = { loading: null, failed: false, view: null };
  /* Auto quality. Each device is different and we can't test them all, so the board and lobby time their own frames
     and step down one level at a time while drawing runs slow, and back up again when there's room to spare.
     0: sharpest, 60 a second · 1: a little less sharp · 2: no light rays · 3: 30 a second
     Sharpness is set by a pixel budget, never below the screen's own size, so phones (small screens with dense
     pixels) stay crisp at every level instead of going soft. */
  var R3Q_KEY = 'cc-3dq3', R3Q_MAX = 3;   // '3': levels saved by older versions (which could get stuck soft) don't carry over
  var R3Q_BUDGET = [2.2e6, 1.6e6, 1.25e6, 1e6];   // pixels drawn per frame at each level
  R3.q = (function(){ try { var n = parseInt(localStorage.getItem(R3Q_KEY), 10); return n >= 0 && n <= R3Q_MAX ? n : 0; } catch(e){ return 0; } })();
  function reef3dQRatio(q){
    var dpr = devicePixelRatio || 1, css = Math.max(1, innerWidth * innerHeight);
    return Math.min(dpr, 2, Math.max(1, Math.sqrt(R3Q_BUDGET[q] / css)));
  }
  function reef3dQApply(view){
    var q = R3.q, r = view.renderer;
    r.setPixelRatio(reef3dQRatio(q));
    var sh = q < 2 && !view.baked;
    if(r.shadowMap.enabled !== sh){
      r.shadowMap.enabled = sh; r.shadowMap.needsUpdate = true;
      view.scene.traverse(function(o){ if(o.material) [].concat(o.material).forEach(function(m){ m.needsUpdate = true; }); });
    }
    (view.rayList || view.rays || []).forEach(function(rm){ rm.visible = q < 2; });
    view.every = q >= 3 ? 2 : 1; view.w = 0; view.qs = null;
  }
  function reef3dQSet(view, q, now){
    R3.q = q; try { localStorage.setItem(R3Q_KEY, String(q)); } catch(e){}
    reef3dQApply(view); view.qs = { n: 0, t0: now, last: now, hold: now + 1500 };
  }
  // Called on every drawn frame. Skips start-up, the moment after a change, and pauses (hidden tab, app switch).
  // One slow stretch (a deck loading, a song unpacking) isn't enough to step down: it takes two in a row. If a
  // step down didn't make drawing faster, the device is capped (iPhone Low Power Mode draws 30 a second whatever
  // we do), so that step is undone and the level stays put for this visit.
  function reef3dQTick(view, now){
    try { if(localStorage.getItem('cc-3dq-lock')) return; } catch(e){}   // tests hold the level steady
    var s = view.qs || (view.qs = { n: 0, t0: now, last: now, hold: now + 2500 });
    var gap = now - s.last; s.last = now;
    // Hops, the dive into a deck and the day/night switch are slow on purpose (a deck loads, shadows redraw every
    // frame). They don't say how the device copes, and changing level then (shadows on or off rebuilds every
    // material) is what made the dive stutter. So those frames aren't counted, and levels only change when it's calm.
    var busy = view.moving || window.__reefTx || view.themeFx || view.themeIn || view.dice;
    if(now < s.hold || gap > 1000 || busy){ s.n = 0; s.t0 = now; if(busy) s.hold = Math.max(s.hold, now + 1000); return; }
    s.n++;
    if(now - s.t0 < 2000) return;
    var fps = s.n * 1000 / (now - s.t0), want = view.every === 2 ? 30 : 60;
    view.fps = Math.round(fps); s.n = 0; s.t0 = now;
    var R = R3.qRun || (R3.qRun = { slow: 0, fast: 0 });
    if(R.check != null){   // the first full reading after a step down
      var was = R.check; R.check = null;
      if(fps * (view.every || 1) < was * 1.12 && R3.q > 0){ R3.qStuck = true; R.slow = R.fast = 0; return reef3dQSet(view, R3.q - 1, now); }
    }
    // (frames drawn × frames skipped) compares fairly across the 60 and 30 a second levels
    if(fps < want * .8){ R.fast = 0; if(++R.slow >= 2 && R3.q < R3Q_MAX && !R3.qStuck){
      R.slow = 0; R.check = fps * (view.every || 1);
      if(R.upAt && now - R.upAt < 15000) R3.qMin = R3.q + 1;   // just stepped up and it's slow again: stay at the lower level this visit
      reef3dQSet(view, R3.q + 1, now); } }
    else if(fps > want * .95){ R.slow = 0; if(++R.fast >= 4 && R3.q > (R3.qMin || 0) && !R3.qStuck){ R.fast = 0; R.upAt = now; reef3dQSet(view, R3.q - 1, now); } }
    else R.slow = R.fast = 0;
  }
  // For checking performance: how many draws and triangles the board's last frame took.
  window.__reef3dScene = function(){   // test helper: what the board draws, biggest first
    var v = R3.view; if(!v) return null; var rows = [];
    v.scene.traverse(function(o){
      if(!o.isMesh && !o.isPoints) return; var g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      var inst = o.isInstancedMesh ? o.count : 1, mats = [].concat(o.material);
      var vis = true; for(var q = o; q; q = q.parent) if(!q.visible) vis = false;
      rows.push({ name: (o.name || o.parent && o.parent.name || '').slice(0, 18), tris: Math.round(n * inst), inst: inst, mat: mats.map(function(m){ return m.type.replace('Mesh', '').replace('Material', '') + (m.transparent ? '*' : ''); }).join(','), cast: o.castShadow, recv: o.receiveShadow, vis: vis, size: [o.scale.x].map(function(x){ return +x.toFixed(2); })[0] });
    });
    rows.sort(function(a, b){ return b.tris - a.tris; }); return rows;
  };
  window.__reef3dBench = function(n){   // test helper: milliseconds per frame, waiting for the GPU each time
    var v = R3.view; if(!v) return null; var gl = v.renderer.getContext(), px = new Uint8Array(4), t0, i, out = {};
    v.renderer.render(v.scene, v.cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    t0 = performance.now(); for(i = 0; i < n; i++){ v.renderer.render(v.scene, v.cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } out.still = +((performance.now() - t0) / n).toFixed(1);
    if(v.renderer.shadowMap.enabled){ t0 = performance.now(); for(i = 0; i < n; i++){ v.renderer.shadowMap.needsUpdate = true; v.renderer.render(v.scene, v.cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } out.moving = +((performance.now() - t0) / n).toFixed(1); }
    else out.moving = out.still;
    out.calls = v.renderer.info.render.calls; out.tris = v.renderer.info.render.triangles; out.programs = v.renderer.info.programs.length;
    return out;
  };
  window.__reef3dView = function(){ return R3.view; };
  window.__reef3dThemeAt = function(p){ var v = R3.view; if(!v) return; if(!v.themeFx) reef3dThemeShow(v, true); v.themeFx.hold = p; };   // test helper
  window.__reef3dGo = function(i){ if(R3.view) reef3dGoTo(R3.view, i); };   // test helper
  window.__reef3dDice = function(){ if(R3.view) reef3dDice(R3.view); };   // test helper
  window.__reefBoard = function(){ return reefBoard(); };   // test helper
  window.__reef3dEmote = function(n){ if(R3.view) reef3dEmote(R3.view, n); return R3.view && R3.view.emote && R3.view.emote.name; };   // test helper   // test helper
  window.__reef3dInfo = function(){ var v = R3.view; return v ? { calls: v.renderer.info.render.calls, triangles: v.renderer.info.render.triangles, tier: R3.q, fps: v.fps } : { tier: R3.q }; };
  function reef3dLoad(){
    if(window.THREE) return Promise.resolve(window.THREE);
    if(R3.failed) return Promise.reject(new Error('3D unavailable'));
    if(!R3.loading) R3.loading = new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = REEF_THREE_URL; s.async = true;
      s.onload = function(){ window.THREE ? res(window.THREE) : rej(new Error('three.js did not load')); };
      s.onerror = function(){ rej(new Error('three.js did not load')); };
      document.head.appendChild(s);
    }).catch(function(e){ R3.failed = true; R3.loading = null; throw e; });
    return R3.loading;
  }

  // Board spaces in order: per subject a run of decks with a plain and a surprise space between
  // each pair; the Treasure Reef and Story Bottle close the path.
  function reef3dSpaces(zones){
    var list = [{ kind: 'start' }];
    zones.forEach(function(z, zi){
      z.items.forEach(function(it, i){
        list.push({ kind: 'plain' });
        if(i > 0 || zi > 0) list.push({ kind: 'surprise' });
        list.push({ kind: 'deck', item: it, zone: z, first: i === 0 });
      });
    });
    list.push({ kind: 'plain' }, { kind: 'surprise' }, { kind: 'plain' });
    // Night: halfway along, the path winds down a broken spiral staircase into the ship's hold (see reef3dWreckDeck).
    // Three stair spaces go in after a deck near the middle; everything after them is on the lower deck.
    var night = reefNight(), REEF3D_HOLD = 6, k0 = -1;
    if(night && list.length > 10){
      for(var q = Math.round(list.length * .5); q < list.length - 4; q++) if(list[q].kind === 'deck'){ k0 = q; break; }
      if(k0 > 0) list.splice(k0 + 1, 0, { kind: 'plain', stair: 1 }, { kind: 'plain', stair: 2 }, { kind: 'plain', stair: 3 });
    }
    var amp = innerWidth < 640 ? .5 : 1; // a narrower board on phones so the path stays on screen
    list.forEach(function(s, i){
      s.i = i;
      s.x = (Math.sin(i * .42) * 4.2 + Math.sin(i * .13) * 1.6) * amp;
      s.z = -i * 2.6; s.y = 0;
      s.links = [];
      if(i > 0){ s.links.push(i - 1); list[i - 1].links.push(i); }
    });
    if(k0 > 0){
      var top = list[k0], cx = top.x, cz = top.z - 2.6, rad = 2.6;
      list.stair = { cx: cx, cz: cz, rad: rad, low: -REEF3D_HOLD, k0: k0 };
      for(var j = 1; j <= 3; j++){ var th = (90 + j * 60) * Math.PI / 180, st = list[k0 + j]; st.x = cx + Math.cos(th) * rad; st.z = cz + Math.sin(th) * rad; st.y = -REEF3D_HOLD * j / 4; }
      for(var after = k0 + 4; after < list.length; after++){ list[after].z += 2.6 + 2.6; list[after].y = -REEF3D_HOLD; }   // the hold carries on from the foot of the stairs
    }
    if(night){
      var ship = list.ship = { half: Math.max.apply(null, list.map(function(s){ return Math.abs(s.x); })) + 4.5, roll: .06, sand: -3.35 };
      list.forEach(function(s){ s.y += s.x * ship.roll; });   // the wreck lists a little to one side
    }
    // Party spaces: a hermit crab's shop, a pair of whirlpools, Chance Time on every third surprise, and a clam
    // gate between two spaces that opens and closes every turn (see reef3dParty*).
    var plains = list.filter(function(s){ return s.kind === 'plain' && !s.stair && s.i > 1 && s.i < list.length - 2; });
    function takePlain(f){ if(!plains.length) return null; var k = Math.min(plains.length - 1, Math.round(f * (plains.length - 1))); return plains.splice(k, 1)[0]; }
    var shop = takePlain(.18); if(shop) shop.kind = 'shop';
    if(plains.length >= 5){ var w1 = takePlain(.25), w2 = takePlain(.8); if(w1 && w2){ w1.kind = w2.kind = 'whirl'; w1.pair = w2.i; w2.pair = w1.i; } }
    list.filter(function(s){ return s.kind === 'surprise'; }).forEach(function(s, k){ if(k % 3 === 1) s.kind = 'chance'; });
    list.gateAt = list.length > 12 ? Math.round(list.length * .58) : -1;
    if(list.stair && list.gateAt >= k0 - 1 && list.gateAt <= k0 + 4) list.gateAt = k0 + 5 < list.length - 1 ? k0 + 5 : -1;   // never across the stairs
    // Side branches (like a Mario Party fork): the Treasure Reef and the Story Bottle sit at the end of their own
    // short paths off the main one. A fork is a plain space; the branch curls out to the open side and dead-ends.
    var mainN = list.length;
    function forkNear(f){
      for(var d = 0; d < mainN; d++){ var k = [Math.round(mainN * f) + d, Math.round(mainN * f) - d];
        for(var j = 0; j < 2; j++){ var c = list[k[j]]; if(c && c.kind === 'plain' && !c.stair && c.i > 1 && c.i < mainN - 1 && !c.fork) return c; } }
      return list[mainN - 1];
    }
    [{ name: 'treasure', at: .42, kinds: ['plain', 'surprise', 'plain', 'treasure'] },
     { name: 'story', at: .78, kinds: ['plain', 'surprise', 'story'] }].forEach(function(br){
      var j = forkNear(br.at), side = j.x >= 0 ? 1 : -1, prev = j, step = innerWidth < 640 ? 2 : 2.4, sandN = 0;
      j.fork = br.name;
      br.kinds.forEach(function(kind, k){
        var s = { kind: kind, i: list.length, branch: br.name, jn: j.i, links: [prev.i], end: k === br.kinds.length - 1, y: j.y };
        s.x = j.x + side * step * (k + 1); s.z = j.z - .7 * (k + 1) + Math.sin(k * 1.3) * .5;
        if(list.ship && list.stair && j.i > list.stair.k0){   // from the hold the hull walls are too high to climb: the branch runs along the wall inside
          var lim = list.ship.half - 2;
          s.x = side * Math.min(lim, Math.abs(j.x) + step); s.z = j.z - .6 - step * .95 * k; s.y = j.y + (s.x - j.x) * list.ship.roll;
        } else if(list.ship){   // at night a branch steps off the wreck, down a plank, onto the sand outside
          var sh = list.ship, ax = Math.abs(s.x);
          if(ax > sh.half - .6){ s.x = side * Math.max(ax, sh.half + 1.7 + step * sandN); sandN++; s.y = sh.sand; }   // each space on the sand a full step further out
          else s.y = j.y + (s.x - j.x) * sh.roll;
        }
        prev.links.push(s.i); list.push(s); prev = s;
      });
    });
    list.mainN = mainN;
    return list;
  }
  // The shortest way along the paths from one space to another (spaces in order, not counting the start).
  function reef3dRoute(spaces, from, to){
    if(from === to) return [];
    var back = {}, q = [from]; back[from] = -1;
    while(q.length){ var c = q.shift(); if(c === to) break; (spaces[c].links || []).forEach(function(n){ if(back[n] === undefined){ back[n] = c; q.push(n); } }); }
    if(back[to] === undefined) return [];
    var r = []; for(var x = to; x !== from; x = back[x]) r.unshift(x); return r;
  }
  // The space a guide standing here would face: the next one along (on a branch, toward its end; at an end, back).
  function reef3dAhead(spaces, i){
    var s = spaces[i], L = s.links || [];
    if(s.branch) return spaces[s.end ? L[0] : L[L.length - 1]];
    var fwd = L.filter(function(n){ return n > i && !spaces[n].branch; })[0];
    return spaces[fwd != null ? fwd : (L[0] != null ? L[0] : i)];
  }
  // The path as separate lines: the main path, then each branch starting from its fork.
  function reef3dPathLines(spaces){
    var n = spaces.mainN || spaces.length, lines = [spaces.slice(0, n)], cur = null;
    for(var i = n; i < spaces.length; i++){ var s = spaces[i]; if(!cur || cur.name !== s.branch){ cur = { name: s.branch, pts: [spaces[s.jn]] }; lines.push(cur.pts); } cur.pts.push(s); }
    return lines;
  }

  /* ---- little 3D builders, all simple shapes with cartoon (toon) shading ---- */
  function reef3dKit(THREE, night){
    var grad = (function(){ // three soft light bands give the cartoon look
      var c = document.createElement('canvas'); c.width = 4; c.height = 1;
      var g = c.getContext('2d'); ['#6a6a6a', '#b4b4b4', '#ffffff', '#ffffff'].forEach(function(col, i){ g.fillStyle = col; g.fillRect(i, 0, 1, 1); });
      var t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.NearestFilter; return t;
    })();
    var mats = {};
    function M(color, extra){
      var key = color + JSON.stringify(extra || {});
      if(!mats[key]){ var o = { color: color, gradientMap: grad }; for(var k in extra) o[k] = extra[k]; mats[key] = new THREE.MeshToonMaterial(o); }
      return mats[key];
    }
    function mesh(geo, mat, x, y, z){ var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m; }
    function group(){ var g = new THREE.Group(); for(var i = 0; i < arguments.length; i++) g.add(arguments[i]); return g; }
    var B = {
      brain: function(){ // grooves pressed into a dome, like a real brain coral
        var geo = new THREE.IcosahedronGeometry(1, 4), pos = geo.attributes.position, v = new THREE.Vector3();
        for(var i = 0; i < pos.count; i++){ v.fromBufferAttribute(pos, i); var n = v.clone().normalize(); var groove = Math.sin(n.x * 9 + Math.sin(n.z * 6) * 1.6) * .5 + .5; v.copy(n.multiplyScalar(1 - groove * groove * .09)); pos.setXYZ(i, v.x, v.y, v.z); }
        geo.computeVertexNormals();
        var s = mesh(geo, M('#ef9a86'), 0, .55, 0); s.scale.set(1.1, .78, 1.1); var g = group(s);
        var foot = mesh(new THREE.CylinderGeometry(.7, .9, .3, 20), M('#c97a66'), 0, .12, 0); g.add(foot); return g; },
      staghorn: function(){ // branching coral: tapered, curving arms with pale tips
        var g = group(), mat = M('#f08ca0'), tipM = M('#ffd3dc');
        function arm(x0, y0, z0, dx, dy, dz, r0){
          var c = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x0 + dx * .45, y0 + dy * .55, z0 + dz * .45), new THREE.Vector3(x0 + dx, y0 + dy, z0 + dz)]);
          var tube = mesh(new THREE.TubeGeometry(c, 6, r0, 6), mat); g.add(tube);
          g.add(mesh(new THREE.SphereGeometry(r0 * 1.15, 7, 5), tipM, x0 + dx, y0 + dy, z0 + dz));
        }
        arm(0, 0, 0, .05, 1.5, 0, .16); arm(0, .6, 0, -.6, .8, .2, .12); arm(0, .8, 0, .55, .75, -.2, .12); arm(0, 1.1, 0, .2, .7, .45, .1); arm(-.35, 1.1, .1, -.3, .5, -.25, .08); arm(.35, 1.2, -.1, .35, .45, .2, .08);
        return g; },
      fan: function(){ var g = group(); var f = mesh(new THREE.CircleGeometry(1.1, 24, 0, Math.PI), M('#b49be0', { side: THREE.DoubleSide }), 0, .45, 0); g.add(f);
        for(var i = 0; i < 5; i++){ var r = mesh(new THREE.TorusGeometry(.3 + i * .18, .03, 4, 20, Math.PI), M('#8a6cc4'), 0, .45, .01); g.add(r); }
        g.add(mesh(new THREE.CylinderGeometry(.08, .12, .5, 8), M('#7b5ab5'), 0, .25, 0)); return g; },
      clam: function(){ var g = group(), shell = M('#f1ead8');
        var lo = mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shell, 0, .5, 0); lo.scale.set(1, .45, .8);
        var hi = mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, .5, 0); hi.scale.set(1, .5, .8);
        var hinge = new THREE.Group(); hinge.position.set(0, .5, -.75); hi.position.set(0, 0, .75); hinge.add(hi); hinge.rotation.x = -.55;
        g.add(lo, hinge, mesh(new THREE.SphereGeometry(.24, 16, 12), M('#ffffff', { emissive: '#3a3a3a' }), 0, .6, .15)); g.userData.lid = hinge; return g; },
      sponge: function(){ var g = group(); [['#f2b46a', 0, 0, 1.5], ['#d983b4', .45, .2, 1.1], ['#f2b46a', -.4, .25, .9]].forEach(function(t){
          g.add(mesh(new THREE.CylinderGeometry(.26, .3, t[3], 14, 1, true), M(t[0], { side: THREE.DoubleSide }), t[1], t[3] / 2, t[2])); }); return g; },
      anemone: function(){ var g = group(); g.add(mesh(new THREE.CylinderGeometry(.45, .55, .6, 16), M('#8c5bb8'), 0, .3, 0));
        for(var i = 0; i < 14; i++){ var a = i / 14 * Math.PI * 2, t = mesh(new THREE.CylinderGeometry(.05, .08, .8, 6), M('#f5a8e8'), Math.cos(a) * .3, .95, Math.sin(a) * .3);
          t.rotation.z = Math.cos(a) * .5; t.rotation.x = -Math.sin(a) * .5; g.add(t); } return g; },
      crate: function(){ var g = group(); g.add(mesh(new THREE.BoxGeometry(1.4, 1.1, 1.2), M('#9a6b3f'), 0, .55, 0));
        [-.36, .36].forEach(function(y){ g.add(mesh(new THREE.BoxGeometry(1.46, .12, 1.26), M('#6b4626'), 0, .55 + y, 0)); }); g.rotation.y = .3; return g; },
      barrel: function(){ var g = group();
        var prof = [[0, 0], [.48, 0], [.56, .3], [.6, .65], [.56, 1], [.48, 1.3], [0, 1.3]].map(function(q){ return new THREE.Vector2(q[0], q[1]); });
        g.add(mesh(new THREE.LatheGeometry(prof, 24), M('#8a5a32')));
        for(var k = 0; k < 8; k++){ var st = mesh(new THREE.BoxGeometry(.03, 1.26, .02), M('#6b4424'), Math.cos(k * .785) * .585, .65, Math.sin(k * .785) * .585); st.rotation.y = -k * .785; g.add(st); }
        [.22, 1.08].forEach(function(y){ var r = mesh(new THREE.TorusGeometry(.565, .045, 6, 28), M('#4a5458'), 0, y, 0); r.rotation.x = Math.PI / 2; g.add(r); });
        var r2 = mesh(new THREE.TorusGeometry(.61, .045, 6, 28), M('#4a5458'), 0, .65, 0); r2.rotation.x = Math.PI / 2; g.add(r2);
        g.rotation.z = .12; return g; },
      anchor: function(){ var g = group(), iron = M('#7a5a46');
        g.add(mesh(new THREE.CylinderGeometry(.1, .1, 1.6, 8), iron, 0, .95, 0));
        var arc = mesh(new THREE.TorusGeometry(.6, .1, 8, 20, Math.PI), iron, 0, .35, 0); arc.rotation.z = Math.PI; g.add(arc);
        var ring = mesh(new THREE.TorusGeometry(.22, .07, 8, 16), iron, 0, 1.9, 0); g.add(ring);
        g.add(mesh(new THREE.BoxGeometry(.9, .12, .12), iron, 0, 1.45, 0)); g.rotation.z = .25; return g; },
      wheel: function(){ var g = group(), wood = M('#a8743f'); var w = new THREE.Group(); w.position.y = 1.05;
        var rim = mesh(new THREE.TorusGeometry(.8, .09, 8, 28), wood); w.add(rim); w.add(mesh(new THREE.CylinderGeometry(.18, .18, .2, 14), M('#d9b45a'))); w.children[1].rotation.x = Math.PI / 2;
        for(var i = 0; i < 8; i++){ var s = mesh(new THREE.CylinderGeometry(.05, .05, 2, 6), wood); s.rotation.z = i * Math.PI / 8; w.add(s); }
        w.rotation.y = .4; g.add(w, mesh(new THREE.BoxGeometry(.3, .9, .3), M('#6b4626'), 0, .4, -.1)); g.userData.spin = w; return g; },
      cannon: function(){ var g = group(); var c = mesh(new THREE.CylinderGeometry(.28, .38, 1.8, 16), M('#4f5a60'), 0, .75, 0); c.rotation.z = Math.PI / 2 - .25; g.add(c);
        [-.45, .45].forEach(function(z){ var w = mesh(new THREE.CylinderGeometry(.35, .35, .14, 16), M('#7a5230'), -.1, .35, z); w.rotation.x = Math.PI / 2; g.add(w); }); return g; },
      lantern: function(){ var g = group(); g.add(mesh(new THREE.BoxGeometry(.8, .12, .8), M('#b8902f'), 0, .06, 0), mesh(new THREE.BoxGeometry(.8, .12, .8), M('#b8902f'), 0, 1.4, 0));
        [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]].forEach(function(p){ g.add(mesh(new THREE.CylinderGeometry(.05, .05, 1.3, 6), M('#b8902f'), p[0], .72, p[1])); });
        var glow = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe08a', fog: false })); glow.position.y = .72; g.add(glow);
        // a warm halo round the flame, so the lantern really glows in the dark water (the frame loop makes it flicker)
        var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3haloTex || (R3haloTex = reef3dBlobTex(true)), color: '#ffb84a', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
        halo.position.y = .72; halo.scale.setScalar(2.6); halo.renderOrder = 4; g.add(halo);
        g.add(mesh(new THREE.TorusGeometry(.18, .05, 6, 14), M('#b8902f'), 0, 1.62, 0)); g.userData.glow = glow; g.userData.halo = halo;
        reefCrabMerge(g, [glow]);   // the brass frame in one draw; the flame stays apart so it can flicker
        return g; },
      treasure: function(){ var g = group(); g.add(mesh(new THREE.BoxGeometry(1.5, .8, 1), M('#9a5f2c'), 0, .4, 0));
        var lid = mesh(new THREE.CylinderGeometry(.5, .5, 1.5, 16, 1, false, 0, Math.PI), M('#b8743a'), 0, .8, 0); lid.rotation.z = Math.PI / 2; g.add(lid);
        [-.45, .45].forEach(function(x){ g.add(mesh(new THREE.BoxGeometry(.14, 1.32, 1.04), M('#f0c35a'), x, .62, 0)); });
        g.add(mesh(new THREE.BoxGeometry(.24, .3, .1), M('#f0c35a'), 0, .7, .52));
        for(var i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(.16, .16, .05, 14), M('#f6d36b', { emissive: '#4a3500' }), Math.cos(i * 1.3) * .9, .03, .6 + Math.sin(i * 1.3) * .3));
        return g; },
      story: function(){ var g = group(); var b = new THREE.Group(); b.position.y = .45; b.rotation.z = .5;
        b.add(mesh(new THREE.CylinderGeometry(.45, .45, 1.3, 18), new THREE.MeshToonMaterial({ color: '#9ed6e0', transparent: true, opacity: .6, gradientMap: grad })));
        b.add(mesh(new THREE.CylinderGeometry(.18, .3, .45, 14), new THREE.MeshToonMaterial({ color: '#9ed6e0', transparent: true, opacity: .6, gradientMap: grad }), 0, .85, 0));
        b.add(mesh(new THREE.CylinderGeometry(.16, .16, .25, 12), M('#9a6b3f'), 0, 1.15, 0));
        var paper = mesh(new THREE.CylinderGeometry(.2, .2, .9, 12), M('#fff4d6'), 0, 0, 0); b.add(paper); g.add(b); return g; },
      kelp: function(r){ var g = group(), col = night ? '#2f5a4e' : '#5fa478';
        for(var i = 0; i < 3; i++){
          var h = 3 + r() * 3, pts = [];
          for(var j = 0; j <= 6; j++) pts.push(new THREE.Vector3(Math.sin(j * .9 + i) * .35, j / 6 * h, Math.cos(j * .7 + i) * .2));
          var t = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .12, 5), M(col), (i - 1) * .4, 0, (r() - .5) * .4); g.add(t);
        }
        g.userData.sway = true; return g; },
      rock: function(r){ var s = mesh(new THREE.DodecahedronGeometry(1, 0), M(night ? '#3b4a50' : '#a7b7b4'), 0, .3, 0); s.scale.set(1 + r(), .55 + r() * .4, 1 + r() * .6); s.rotation.y = r() * 3; return group(s); },
      coralBall: function(r){ var g = group(), pal = night ? ['#5a4a66', '#4a5a66'] : ['#f2a59a', '#f6c08c', '#c4aee6', '#f7cfc0'];
        for(var i = 0; i < 4; i++){ var s = mesh(new THREE.SphereGeometry(.4 + r() * .4, 10, 7), M(pal[Math.floor(r() * pal.length)]), (r() - .5) * 1.4, .3, (r() - .5) * 1.2); s.scale.y = .8; g.add(s); } return g; },
      star: function(){ var sh = new THREE.Shape(); for(var i = 0; i < 10; i++){ var a = i / 10 * Math.PI * 2, rr = i % 2 ? .22 : .55; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
        var s = mesh(new THREE.ExtrudeGeometry(sh, { depth: .12, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }), M(night ? '#8a6056' : '#f29b74'), 0, .1, 0); s.rotation.x = -Math.PI / 2; return group(s); },
      plank: function(r){ var p = mesh(new THREE.BoxGeometry(2.4, .14, .45), M('#6b4f3a'), 0, .1, 0); p.rotation.y = r() * 3; p.rotation.z = .08; return group(p); }
    };
    // The guide: Shelly the turtle by day, Lumi the anglerfish at night. Parts that animate
    // (flippers, eyes, fins, the lure) are kept in userData so the frame loop can move them.
    function eye(x, y, z, r){
      var e = new THREE.Group(); e.position.set(x, y, z);
      e.add(mesh(new THREE.SphereGeometry(r, 16, 12), M('#ffffff')));
      var pupil = mesh(new THREE.SphereGeometry(r * .62, 14, 10), M('#14232a'), 0, 0, r * .5); e.add(pupil);
      var glint = new THREE.Mesh(new THREE.SphereGeometry(r * .2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); glint.position.set(r * .22, r * .25, r * 1.02); e.add(glint);
      return e;
    }
    // Shelly's shell plates, painted to wrap round the dome: u runs around, v from the top (0) to the rim (1). Each plate is
    // six-sided with a lighter middle, and the dark seams zig-zag, so they read as a real turtle's scutes.
    function shellTexture(EQ){   // EQ: the canvas row of the shell's widest line (see the body shape below)
      var c = document.createElement('canvas'); c.width = 512; c.height = 256; var g = c.getContext('2d');
      g.fillStyle = '#3f8550'; g.fillRect(0, 0, 512, 256);
      function plate(pts){
        var xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; });
        var cx = (Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2, cy = (Math.min.apply(0, ys) + Math.max.apply(0, ys)) / 2;
        var gr = g.createRadialGradient(cx, cy, 2, cx, cy, Math.max(Math.max.apply(0, xs) - cx, Math.max.apply(0, ys) - cy) * 1.2);
        gr.addColorStop(0, '#5fae6c'); gr.addColorStop(1, '#4f9a5e'); g.fillStyle = gr;
        g.beginPath(); pts.forEach(function(p, k){ g[k ? 'lineTo' : 'moveTo'](p[0], p[1]); }); g.closePath(); g.fill();
      }
      g.save(); g.scale(1, EQ / 230);   // the plates fill the dome above the widest line (EQ); the belly is painted below it
      plate([[0, 0], [512, 0], [512, 50], [0, 50]]);                                    // the middle plate, on top of the dome
      for(var q = 0; q < 5; q++){ var x0 = q * 102.4, xm = x0 + 51.2, x1 = x0 + 102.4;    // a ring of five big plates
        plate([[x0 + 5, 66], [xm, 58], [x1 - 5, 66], [x1 - 5, 150], [xm, 160], [x0 + 5, 150]]); }
      for(var q2 = 0; q2 < 11; q2++){ var y0 = q2 * 46.5, ym = y0 + 23.3, y1 = y0 + 46.5; // eleven small plates round the edge
        plate([[y0 + 4, 172], [ym, 166], [y1 - 4, 172], [y1 - 4, 222], [ym, 228], [y0 + 4, 222]]); }
      g.restore();
      // no hard edge: the shell's green fades softly into the cream belly round the widest line
      var fade = g.createLinearGradient(0, EQ - 6, 0, EQ + 14); fade.addColorStop(0, 'rgba(240,220,160,0)'); fade.addColorStop(1, '#f0dca0');
      g.fillStyle = fade; g.fillRect(0, EQ - 6, 512, 20); g.fillStyle = '#f0dca0'; g.fillRect(0, EQ + 14, 512, 256);
      var t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
    }
    // A smooth flipper: a bevelled curved paddle lying flat, pointing out along +x.
    function paddle(len, wid, sweep){
      var s = new THREE.Shape(); s.moveTo(0, -wid * .5);
      s.bezierCurveTo(len * .35, -wid * .75, len * .8, -wid * .35 - sweep, len, -sweep);
      s.bezierCurveTo(len * .85, wid * .25 - sweep, len * .4, wid * .6, 0, wid * .5); s.lineTo(0, -wid * .5);
      var geo = new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 4, curveSegments: 16 });
      geo.translate(0, 0, -.015); geo.rotateX(Math.PI / 2); return geo;
    }
    B.guide = function(){
      var g = new THREE.Group(), body = new THREE.Group(), parts = {}; g.add(body);
      if(!night){
        // Shelly (Wendy picked the smooth sea turtle): one flowing domed shell with a soft rolled lip, an egg-shaped head on
        // a short tapered neck, and paddle flippers. The parts the frame loop moves keep their names (neck, eyes, flippers).
        // The shell and belly are one smooth pebble (no lip or seam): from the middle of the belly, out round the widest
        // line, then up over the dome. Listed bottom to top, so the surface faces outward.
        var R = .82, H = .56, HB = .2, OV = 1.16, pts = [], NB = 10, NT = 26;
        for(var si = 0; si <= NB; si++){ var th = Math.PI - si / NB * Math.PI / 2; pts.push(new THREE.Vector2(R * Math.pow(Math.sin(th), .7), HB * Math.cos(th))); }
        for(var sj = 1; sj <= NT; sj++){ var th2 = Math.PI / 2 - sj / NT * Math.PI / 2; pts.push(new THREE.Vector2(R * Math.pow(Math.sin(th2), .7), H * Math.pow(Math.cos(th2), .85))); }
        var sg = new THREE.LatheGeometry(pts, 48), sp = sg.attributes.position;
        for(var sv = 0; sv < sp.count; sv++){ var vz = sp.getZ(sv); sp.setZ(sv, vz * OV); if(vz < 0) sp.setX(sv, sp.getX(sv) * (1 - .08 * (-vz / R))); }   // oval, narrower at the back
        sg.computeVertexNormals();
        body.add(mesh(sg, new THREE.MeshToonMaterial({ map: shellTexture(Math.round((1 - NB / (NB + NT)) * 256)), gradientMap: grad }), 0, .3, 0));
        var neck = new THREE.Group(); neck.position.set(0, .4, R * OV * .92); body.add(neck);
        var nk = mesh(new THREE.CylinderGeometry(.17, .22, .32, 16), M('#8fd18e'), 0, .02, .09); nk.rotation.x = Math.PI / 2 - .35; neck.add(nk);
        var hr = .34, hz = .22 + hr * .55;
        var head = mesh(new THREE.SphereGeometry(hr, 28, 20), M('#8fd18e'), 0, .12, hz); head.scale.set(1, .9, 1.12); neck.add(head);
        parts.hat = new THREE.Group(); parts.hat.position.set(0, .12 + hr * .8, hz - .03); parts.hat.userData.size = hr; neck.add(parts.hat);   // where a shop hat sits
        var chin = mesh(new THREE.SphereGeometry(hr * .8, 20, 14), M('#b8e6a8'), 0, .02, hz + hr * .3); chin.scale.set(.95, .55, .9); neck.add(chin);
        var eL = eye(hr * .44, .12 + hr * .38, hz + hr * .78, .115), eR = eye(-hr * .44, .12 + hr * .38, hz + hr * .78, .115); neck.add(eL, eR); parts.eyes = [eL, eR];
        [-1, 1].forEach(function(sd){ var ck = mesh(new THREE.SphereGeometry(hr * .22, 12, 8), M('#f6a5a0', { transparent: true, opacity: .75 }), sd * hr * .7, .06, hz + hr * .72); ck.scale.set(1, .6, .4); neck.add(ck); });
        var smile = mesh(new THREE.TorusGeometry(hr * .24, .022, 6, 16, Math.PI), M('#1f3a2c'), 0, .12 - hr * .22, hz + hr); smile.rotation.z = Math.PI; smile.rotation.x = -.35; neck.add(smile);
        parts.mouth = new THREE.Object3D(); parts.mouth.position.set(0, .12 - hr * .2, hz + hr * 1.05); neck.add(parts.mouth);   // where food goes in (see reefLobbyFrame)
        parts.flippers = [];
        var frontG = paddle(.72, .34, .22), backG = paddle(.36, .29, .08);
        [[.62, .52, 1], [-.62, .52, -1], [.5, -.62, 1], [-.5, -.62, -1]].forEach(function(p, i){
          var pivot = new THREE.Group(); pivot.position.set(p[0], .26, p[1] * OV); body.add(pivot);
          var f = mesh(i < 2 ? frontG : backG, M('#8fd18e'), 0, 0, 0); f.scale.x = p[2]; f.rotation.y = i < 2 ? -p[2] * .35 : p[2] * .5; f.rotation.z = -p[2] * (i < 2 ? .18 : .1); pivot.add(f);   // tips droop a little
          if(i < 2) [[.3, .02], [.5, -.1]].forEach(function(d){ var dot = mesh(new THREE.SphereGeometry(.045, 8, 6), M('#b8e6a8'), d[0], .07, d[1]); dot.scale.y = .3; f.add(dot); });
          pivot.userData.side = p[2]; pivot.userData.front = i < 2; parts.flippers.push(pivot);
        });
        var tail = mesh(new THREE.ConeGeometry(.1, .32, 12), M('#8fd18e'), 0, .24, -R * OV - .08); tail.rotation.x = -Math.PI / 2 - .2; body.add(tail);
        parts.neck = neck;
      } else {
        var fish = mesh(new THREE.SphereGeometry(.68, 28, 20), M('#3d6f9a'), 0, .95, 0); fish.scale.set(.9, .85, 1.1); body.add(fish);
        body.add(mesh(new THREE.SphereGeometry(.62, 24, 12, 0, Math.PI * 2, Math.PI * .55, Math.PI * .45), M('#9cc6e0'), 0, .93, .05));
        // A friendly face like Shelly's: round eyes sitting on the surface (not sunk in, which made them slits), a
        // thin smile in a soft navy, two little rounded teeth and pink cheeks (it was a thick dark jaw with fangs).
        var smile2 = mesh(new THREE.TorusGeometry(.16, .021, 8, 20, Math.PI * .8), M('#3f6f99'), 0, .82, .72); smile2.rotation.z = Math.PI * 1.1; smile2.rotation.x = -.28; body.add(smile2);
        [-1, 1].forEach(function(sd){ var tooth = mesh(new THREE.SphereGeometry(.035, 8, 6), M('#ffffff'), sd * .055, .675, .742); tooth.scale.set(1, 1.25, .6); body.add(tooth); });
        [-1, 1].forEach(function(sd){ var ck = mesh(new THREE.SphereGeometry(.09, 12, 8), M('#f7a3c0', { transparent: true, opacity: .7 }), sd * .33, .93, .62); ck.scale.set(1, .6, .35); ck.rotation.y = sd * .5; body.add(ck); });
        parts.mouth = new THREE.Object3D(); parts.mouth.position.set(0, .74, .74); body.add(parts.mouth);
        var eL2 = eye(.25, 1.17, .6, .16), eR2 = eye(-.25, 1.17, .6, .16); body.add(eL2, eR2); parts.eyes = [eL2, eR2];
        parts.hat = new THREE.Group(); parts.hat.position.set(0, 1.47, -.18); parts.hat.userData.size = .42; body.add(parts.hat);
        var tailP = new THREE.Group(); tailP.position.set(0, .95, -.75); body.add(tailP);
        var tail2 = mesh(new THREE.ConeGeometry(.42, .55, 4), M('#2e5878'), 0, 0, -.25); tail2.rotation.x = -Math.PI / 2; tail2.scale.set(.25, 1, 1); tailP.add(tail2);
        parts.tail = tailP; parts.flippers = [];
        [1, -1].forEach(function(s){ var fp = new THREE.Group(); fp.position.set(s * .58, .85, .05); body.add(fp);
          var fin = mesh(new THREE.ConeGeometry(.2, .45, 4), M('#2e5878'), s * .15, 0, 0); fin.rotation.z = s * -Math.PI / 2; fin.scale.set(.3, 1, 1); fp.add(fin); fp.userData.side = s; parts.flippers.push(fp); });
        var stalk = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.5, .1), new THREE.Vector3(0, 1.95, .35), new THREE.Vector3(0, 1.75, .78)]), 12, .035, 6), M('#2e5878'));
        stalk.userData.noOutline = true; body.add(stalk);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), new THREE.MeshBasicMaterial({ color: '#b8fff2' })); bulb.position.set(0, 1.68, .82); body.add(bulb);
        var glow = new THREE.PointLight('#8ffff0', 1.4, 7, 2); glow.position.copy(bulb.position); body.add(glow);
        parts.bulb = bulb; parts.glow = glow;
      }
      g.userData.body = body; g.userData.parts = parts; return g;
    };
    return { M: M, mesh: mesh, B: B, grad: grad };
  }

  // A board space: a puck with a rounded bevel, like a game-board tile.
  var R3geo = {};
  function reef3dTileGeo(R){
    if(R3geo[R]) return R3geo[R];
    var THREE = window.THREE, pts = [[0, .34], [R - .14, .34], [R - .05, .32], [R, .26], [R + .02, .1], [R + .05, 0], [0, 0]].map(function(p){ return new THREE.Vector2(p[0], p[1]); });
    return (R3geo[R] = new THREE.LatheGeometry(pts, 48));
  }
  function reef3dShade(hex, amt){
    var c = new window.THREE.Color(hex), hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt))); return '#' + c.getHexString();
  }
  // The painted top of a space: the deck's emoji, a "?" for surprises, a shell for plain spaces.
  var R3tex = {};
  function reef3dTileTex(col, icon, night, kind){
    var key = col + icon + night + kind; if(R3tex[key]) return R3tex[key];
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    var gr = g.createRadialGradient(100, 90, 20, 128, 128, 130); gr.addColorStop(0, reef3dShade(col, .14)); gr.addColorStop(1, reef3dShade(col, -.04));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 10; g.setLineDash(kind === 'plain' ? [] : [18, 14]);
    g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    if(/^deck/.test(kind)){   // decks: a white badge behind a big emoji, and a gold star once it's all done
      g.fillStyle = night ? 'rgba(255,246,222,.92)' : 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(128, 128, 82, 0, Math.PI * 2); g.fill();
      g.font = '128px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 128, 136);
      if(kind === 'deck-done'){ g.font = '900 64px "Baloo 2", system-ui, sans-serif'; g.fillStyle = '#ffcf3f'; g.strokeStyle = '#8a5a12'; g.lineWidth = 6; g.strokeText('★', 200, 58); g.fillText('★', 200, 58); }
      var dt = new window.THREE.CanvasTexture(c); dt.anisotropy = 4; return (R3tex[key] = dt);
    }
    if(icon === '?'){ g.fillStyle = night ? '#ffe29a' : '#ffffff'; g.font = '900 150px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 128, 140); }
    else if(icon){ g.font = (kind === 'plain' ? 90 : 120) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 128, 138); }
    else { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(128, 128, 26, 0, Math.PI * 2); g.fill(); }
    var t = new window.THREE.CanvasTexture(c); t.anisotropy = 4; return (R3tex[key] = t);
  }
  // Builds one board space: returns the still parts (merged with the scenery) and the painted top (tappable).
  // 'classic' is the sandy pedestal (decks, treasure, story, start); 'shell' is a fluted seashell (plain and ? spaces).
  function reef3dTile(style, s, R, top, icon, night, kit, M, mesh){
    var THREE = window.THREE, parts = [], faceY = .345, faceR = R - .1;
    var base = mesh(new THREE.CylinderGeometry(R + .16, R + .26, .12, 40), M(night ? '#26302f' : '#cdb684'), s.x, .03, s.z); parts.push(base);
    if(style === 'shell'){
      var sh = new THREE.Shape(), n = 14, k;
      for(k = 0; k <= 96; k++){ var a = k / 96 * Math.PI * 2, rr = R * (1 + .07 * Math.cos(n * a)); sh[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      var g = new THREE.ExtrudeGeometry(sh, { depth: .26, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 3, curveSegments: 4 }); g.rotateX(-Math.PI / 2);
      var shell = mesh(g, M(reef3dShade(top, -.12)), s.x, .02, s.z); parts.push(shell);
      faceY = .335; faceR = R - .06;
    } else {
      parts.push(mesh(reef3dTileGeo(R), M(reef3dShade(top, -.18)), s.x, 0, s.z));
      if(s.kind === 'deck'){   // a deck stands out from every other space: a raised gold rim
        var rim = mesh(new THREE.TorusGeometry(R - .04, .1, 8, 44), M(night ? '#e0b44a' : '#f2c14e'), s.x, .37, s.z); rim.rotation.x = Math.PI / 2; parts.push(rim);
      }
    }
    var face = new THREE.Mesh(new THREE.CircleGeometry(faceR, 48), new THREE.MeshToonMaterial({ map: style === 'classic' ? reef3dTileTex(top, icon, night, s.kind === 'deck' ? 'deck-' + s.item.state : s.kind) : reef3dTileTex2(style, top, icon, night, s.kind), gradientMap: kit.grad }));
    face.rotation.x = -Math.PI / 2; face.position.set(s.x, faceY, s.z);
    return { parts: parts, face: face };
  }
  function reef3dTileTex2(style, col, icon, night, kind){   // the seashell's painted top
    var key = style + col + icon + night + kind; if(R3tex[key]) return R3tex[key];
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), k;
    if(style === 'shell'){
      var gr = g.createRadialGradient(128, 128, 10, 128, 128, 130); gr.addColorStop(0, reef3dShade(col, .18)); gr.addColorStop(1, reef3dShade(col, -.02));
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 7;   // the shell's fluting: ridges fanning out to each wave of the edge
      for(k = 0; k < 14; k++){ var a = k / 14 * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70); g.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); g.stroke(); }
      g.fillStyle = night ? '#3c4a47' : '#fff6e2'; g.beginPath(); g.arc(128, 128, 66, 0, Math.PI * 2); g.fill();
    }
    if(icon === '?'){ g.fillStyle = night ? '#ffe29a' : '#ffffff'; g.font = '900 140px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 128, 140); }
    else if(icon){ g.font = (kind === 'plain' ? 86 : 112) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 128, 138); }
    else { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(128, 128, 24, 0, Math.PI * 2); g.fill(); }
    var t = new window.THREE.CanvasTexture(c); t.anisotropy = 4; return (R3tex[key] = t);
  }

  // Cartoon outline: a dark copy of each part, slightly larger and drawn inside-out.
  function reef3dOutline(obj, color, amt){
    var THREE = window.THREE, mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.BackSide }), list = [];
    obj.traverse(function(m){ if(m.isMesh && !m.userData.noOutline && !(m.material && m.material.transparent)) list.push(m); });
    list.forEach(function(m){
      // grow the copy around the part's own middle (not its pivot), so parts built away from their pivot (Lumi's lure
      // stalk, her belly) get an even line instead of a shifted dark shadow; tiny parts (teeth) get no line at all
      if(!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      var bs = m.geometry.boundingSphere, sc = m.scale, size = bs.radius * Math.min(Math.abs(sc.x), Math.abs(sc.y), Math.abs(sc.z));
      if(size < .09) return;
      var o = new THREE.Mesh(m.geometry, mat); o.scale.setScalar(1 + amt); o.position.copy(bs.center).multiplyScalar(-amt);
      o.userData.noOutline = true; o.raycast = function(){}; m.add(o);
    });
  }

  // The CC0 models (see REEF_MODELS), parsed once and given the same cartoon shading as everything else.
  var R3models = null;
  // The model data lives in its own file next to the page, fetched the first time the board opens.
  function reef3dModelData(){
    if(window.REEF_MODELS) return Promise.resolve(window.REEF_MODELS);
    return new Promise(function(res){
      var s = document.createElement('script'); s.src = 'reef-models.js'; s.async = true;
      s.onload = function(){ res(window.REEF_MODELS || {}); }; s.onerror = function(){ res({}); };
      document.head.appendChild(s);
    });
  }
  function reef3dModels(){
    if(R3models) return R3models;
    try { reefInstallGLTF(); } catch(e){}
    var THREE = window.THREE;
    if(!THREE.GLTFLoader) return (R3models = Promise.resolve({}));
    var loader = new THREE.GLTFLoader(), REEF_MODELS = {};
    R3models = reef3dModelData().then(function(data){ REEF_MODELS = data || {}; return Promise.all(Object.keys(REEF_MODELS).map(function(k){
      return new Promise(function(res){
        try {
          var s = atob(REEF_MODELS[k]), u = new Uint8Array(s.length);
          for(var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
          loader.parse(u.buffer, '', function(g){ res([k, g]); }, function(){ res([k, null]); });
        } catch(e){ res([k, null]); }
      });
    })); }).then(function(list){ var o = {}; list.forEach(function(p){ if(p[1]) o[p[0]] = p[1]; }); R3.modelsReady = o; return o; });
    return R3models;
  }
  // A ready-to-place copy of a model, scaled to the given height, sitting on y = 0.
  function reef3dModel(models, name, height, grad, tint){
    var THREE = window.THREE, g = models && models[name]; if(!g) return null;
    var root = THREE.SkeletonUtils && g.animations && g.animations.length ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
    root.traverse(function(m){
      if(!m.isMesh) return;
      var mats = Array.isArray(m.material) ? m.material : [m.material];
      var out = mats.map(function(src){
        // model colours are stored as linear light; this page draws without colour conversion, so convert them
        var col = src.color ? src.color.clone() : new THREE.Color('#ffffff');
        if(!/fish|dolphin|whale|manta/.test(name)) col.convertLinearToSRGB(); // the converted fish already hold display colours
        if(tint) col.lerp(new THREE.Color(tint), .35);
        return new THREE.MeshToonMaterial({ color: col, map: src.map || null, gradientMap: grad, skinning: !!m.isSkinnedMesh, vertexColors: !!src.vertexColors, transparent: !!src.transparent, opacity: src.opacity });
      });
      m.material = Array.isArray(m.material) ? out : out[0];
      m.castShadow = true; m.receiveShadow = true;
      if(m.isSkinnedMesh) m.frustumCulled = false; // its bounds are measured in the rest pose
    });
    var box = new THREE.Box3().setFromObject(root), size = new THREE.Vector3(); box.getSize(size);
    var k = height / (size.y || 1); root.scale.setScalar(k);
    var holder = new THREE.Group(); holder.add(root);
    root.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k, -(box.min.z + size.z / 2) * k);
    holder.userData.gltf = g; holder.userData.root = root;
    return holder;
  }

  /* ---------- Baked lighting ----------
     The scenery never moves and neither do the lights' directions, so the light each corner of each shape
     receives is worked out once, when the board is built, and stored as that corner's colour. The iPad then
     draws scenery with no lighting maths and no shadow maps: the single biggest cost on a tablet's graphics chip.
     The bake uses the same sky light, sun and three cartoon light bands as the live toon material, so it looks
     the same; contact shadows are soft painted blobs instead of a shadow map. */
  function reef3dRig(scene){
    var THREE = window.THREE, rig = { sky: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), dir: new THREE.Vector3(6, 18, 10).normalize() };
    scene.children.forEach(function(l){
      if(l.isHemisphereLight){ rig.sky.copy(l.color).multiplyScalar(l.intensity); rig.ground.copy(l.groundColor).multiplyScalar(l.intensity); }
      if(l.isDirectionalLight) rig.sun.copy(l.color).multiplyScalar(l.intensity);
    });
    return rig;
  }
  // The toon material's three bands (see reef3dKit's gradient), with the edges softened a little: a bake stores
  // light per corner, and hard steps between corners would look jagged on low-detail shapes.
  function reef3dBand(d){
    var c = d * .5 + .5, sm = function(e0, e1, x){ var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    return .416 + (.706 - .416) * sm(.21, .29, c) + (1 - .706) * sm(.46, .54, c);
  }
  // Writes lit colour into a world-space geometry's colour attribute: albedo × (sky + sun band) × ground shade + glow.
  function reef3dBakeGeo(g, mat, rig, opts){
    var THREE = window.THREE, pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    var old = mat.vertexColors && g.attributes.color, out = new Float32Array(n * 3), v = new THREE.Vector3(), c = new THREE.Color();
    var alb = mat.color || new THREE.Color(1, 1, 1), em = mat.emissive || null, ao = !(opts && opts.noAO), unlit = !!mat.isMeshBasicMaterial;
    for(var i = 0; i < n; i++){
      if(unlit){ c.copy(alb); if(old){ c.r *= old.getX(i); c.g *= old.getY(i); c.b *= old.getZ(i); } out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; continue; }
      v.fromBufferAttribute(nor, i); var len = v.length(); if(len) v.multiplyScalar(1 / len);
      var up = v.y * .5 + .5, band = reef3dBand(v.dot(rig.dir));
      c.r = rig.ground.r + (rig.sky.r - rig.ground.r) * up + rig.sun.r * band;
      c.g = rig.ground.g + (rig.sky.g - rig.ground.g) * up + rig.sun.g * band;
      c.b = rig.ground.b + (rig.sky.b - rig.ground.b) * up + rig.sun.b * band;
      // fake ambient occlusion: shapes darken toward the sea floor, the way crevices and undersides would
      // (tops that face the open water stay bright; sides and undersides near the sand get the shade)
      if(ao){ var y = pos.getY(i), t = Math.min(1, Math.max(0, (y + .1) / 1.5)), sh = .66 + .34 * t * t * (3 - 2 * t), open = Math.max(0, v.y); c.multiplyScalar(sh + (1 - sh) * open * open); }
      c.r *= alb.r; c.g *= alb.g; c.b *= alb.b;
      if(old){ c.r *= old.getX(i); c.g *= old.getY(i); c.b *= old.getZ(i); }
      if(em){ c.r += em.r; c.g += em.g; c.b += em.b; }
      out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  }
  // One unlit material per look (texture, see-through, two-sided); colour lives in the shapes, so almost all
  // scenery shares a handful of materials.
  function reef3dBakedMat(cache, src){
    var THREE = window.THREE, key = (src.map ? src.map.uuid : '-') + '|' + (src.transparent ? src.opacity : 1) + '|' + src.side;
    return cache[key] || (cache[key] = new THREE.MeshBasicMaterial({ vertexColors: true, map: src.map || null, transparent: !!src.transparent, opacity: src.transparent ? src.opacity : 1, side: src.side, depthWrite: !src.transparent }));
  }
  // Pieces of one mesh, one per material (models can carry several materials in one mesh).
  function reef3dPieces(m){
    var mats = Array.isArray(m.material) ? m.material : [m.material];
    var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    if(!Array.isArray(m.material) || !g.groups.length) return [{ g: g, mat: mats[0] }];
    var THREE = window.THREE;
    return g.groups.map(function(gr){
      var part = new THREE.BufferGeometry();
      Object.keys(g.attributes).forEach(function(n){ var a = g.attributes[n], s = a.itemSize; part.setAttribute(n, new THREE.BufferAttribute(a.array.slice(gr.start * s, (gr.start + gr.count) * s), s)); });
      return { g: part, mat: mats[gr.materialIndex] || mats[0] };
    });
  }
  // Bake a group into world space and merge it into a few big meshes, cut into sections along the path so the
  // sections off screen are skipped entirely.
  var REEF3D_CHUNK = 22;
  function reef3dMerge(root, rig, cache){
    var THREE = window.THREE, U = THREE.BufferGeometryUtils, buckets = {}, out = new THREE.Group(), ctr = new THREE.Vector3();
    if(!U){ out.add(root); return out; }
    root.updateMatrixWorld(true);
    root.traverse(function(m){
      if(!m.isMesh || m.isSkinnedMesh || !m.visible) return;
      var vis = true; m.traverseAncestors(function(a){ if(a.visible === false) vis = false; }); if(!vis) return;
      reef3dPieces(m).forEach(function(pc){
        var g = pc.g;
        g.applyMatrix4(m.matrixWorld);
        if(!g.attributes.normal) g.computeVertexNormals();
        reef3dBakeGeo(g, pc.mat, rig);
        Object.keys(g.attributes).forEach(function(n){ if(n !== 'position' && n !== 'color' && !(n === 'uv' && pc.mat.map)) g.deleteAttribute(n); });
        g.morphAttributes = {}; g.groups = [];
        g.computeBoundingBox(); g.boundingBox.getCenter(ctr);
        var mat = reef3dBakedMat(cache, pc.mat), key = mat.uuid + '@' + Math.floor(ctr.z / REEF3D_CHUNK);
        (buckets[key] = buckets[key] || { mat: mat, geos: [] }).geos.push(g);
      });
    });
    Object.keys(buckets).forEach(function(k){
      var b = buckets[k], merged = null;
      try { merged = U.mergeBufferGeometries(b.geos, false); } catch(e){}
      if(merged){ var mm = new THREE.Mesh(merged, b.mat); mm.matrixAutoUpdate = false; mm.renderOrder = b.mat.transparent ? 1 : 0; out.add(mm); }
      b.geos.forEach(function(g){ g.dispose(); });
    });
    return out;
  }
  // Swap a moving object's materials (a deck's coral, a ship's barrel) for baked, unlit ones. Its lighting is
  // baked where it stands; small sways don't change it enough to notice.
  function reef3dBakeObject(o, rig, cache){
    o.updateMatrixWorld(true);
    o.traverse(function(m){
      if(!m.isMesh || m.isSkinnedMesh || Array.isArray(m.material) || m.material.isMeshBasicMaterial) return;
      var g = m.geometry.clone(), world = g.clone();
      world.applyMatrix4(m.matrixWorld); if(!world.attributes.normal) world.computeVertexNormals();
      reef3dBakeGeo(world, m.material, rig);
      g.setAttribute('color', world.attributes.color); world.dispose();
      m.geometry = g; m.material = reef3dBakedMat(cache, m.material);
    });
  }
  // After baking, fuse an object's parts into one mesh per material (in the object's own space, so it can still
  // sway, spin or bob as a whole). Parts the frame loop moves on their own (a clam's lid, a wheel, a glow) stay apart.
  function reef3dCompact(o){
    var THREE = window.THREE, U = THREE.BufferGeometryUtils; if(!U) return o;
    var keep = []; Object.keys(o.userData).forEach(function(k){ var v = o.userData[k]; if(k !== 'root' && v && v.isObject3D) keep.push(v); });   // 'root' is the whole model, not a moving part
    o.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), rel = new THREE.Matrix4(), buckets = {}, victims = [];
    o.traverse(function(m){
      if(!m.isMesh || m.isSkinnedMesh || Array.isArray(m.material) || !m.material.isMeshBasicMaterial || !m.material.vertexColors) return;
      for(var q = m; q && q !== o; q = q.parent) if(keep.indexOf(q) >= 0) return;
      var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
      Object.keys(g.attributes).forEach(function(n){ if(n !== 'position' && n !== 'color' && !(n === 'uv' && m.material.map)) g.deleteAttribute(n); });
      g.morphAttributes = {}; g.groups = [];
      (buckets[m.material.uuid] = buckets[m.material.uuid] || { mat: m.material, geos: [] }).geos.push(g); victims.push(m);
    });
    if(victims.length < 2) return o;
    var made = [];
    Object.keys(buckets).forEach(function(k){
      var b = buckets[k], merged = null; try { merged = U.mergeBufferGeometries(b.geos, false); } catch(e){}
      if(!merged) return; var mm = new THREE.Mesh(merged, b.mat); mm.userData.space = o.userData.space; made.push(mm);
    });
    if(made.length !== Object.keys(buckets).length) return o;   // something wouldn't merge: leave the object as it was
    victims.forEach(function(m){ m.parent.remove(m); });
    made.forEach(function(mm){ o.add(mm); });
    return o;
  }
  // Unlit sand: its baked colour, plus the caustic pattern added as light (a texture lookup and an add per pixel).
  function reef3dSandMat(caus, glow){
    var THREE = window.THREE, m = new THREE.MeshBasicMaterial({ vertexColors: true, map: caus });
    m.onBeforeCompile = function(sh){
      sh.uniforms.causGlow = { value: glow };
      sh.fragmentShader = 'uniform vec3 causGlow;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', '')
        .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb += texture2D( map, vUv ).rgb * causGlow;');
    };
    return m;
  }
  // Soft round shadows painted on the sand: one texture, all the still ones merged into a single draw.
  var R3haloTex = null;
  function reef3dBlobTex(light){   // dark for shadows, white for glows
    var THREE = window.THREE, c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'), k = light ? '255,255,255' : '0,0,0';
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(' + k + ',.55)'); gr.addColorStop(.55, 'rgba(' + k + ',.28)'); gr.addColorStop(1, 'rgba(' + k + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  function reef3dBlobMat(tex, night){
    var THREE = window.THREE;
    return new THREE.MeshBasicMaterial({ map: tex, color: night ? '#06141a' : '#3a4a40', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  function reef3dBlobs(list, mat, groundY){   // list of [x, z, radius]
    var THREE = window.THREE, U = THREE.BufferGeometryUtils, geos = [];
    list.forEach(function(b){ var g = new THREE.PlaneGeometry(b[2] * 2, b[2] * 2); g.rotateX(-Math.PI / 2); g.translate(b[0], groundY(b[0], b[1]) + .05, b[1]); geos.push(g); });
    if(!geos.length || !U) return null;
    var m = new THREE.Mesh(U.mergeBufferGeometries(geos, false), mat); m.renderOrder = 2; m.matrixAutoUpdate = false; return m;
  }
  // Where an object sits on the sand: a blob under its middle, sized to its footprint.
  // A thin column of rising air bubbles. Each grows and wobbles more as it rises, and shrinks away at the top.
  function reef3dPlume(p, d, t){
    var u = p.userData, n = p.count;
    for(var i = 0; i < n; i++){
      var h = (t * .8 + i / n * u.h) % u.h, w = .12 + h * .03;
      d.position.set(u.x + Math.sin(t * 2.1 + i * 1.7) * w, u.y + h, u.z + Math.cos(t * 1.7 + i * 2.3) * w * .7);
      d.scale.setScalar((.55 + (i % 3) * .22) * (1 + h / u.h * .4) * Math.min(1, (u.h - h) / .8)); d.updateMatrix(); p.setMatrixAt(i, d.matrix);
    }
    p.instanceMatrix.needsUpdate = true;
  }
  function reef3dFootprint(o, list){
    var THREE = window.THREE, box = new THREE.Box3().setFromObject(o), size = new THREE.Vector3(), c = new THREE.Vector3();
    if(box.isEmpty()) return; box.getSize(size); box.getCenter(c);
    if(size.y < .45 || box.min.y > 1.2 || Math.max(size.x, size.z) > 10) return;   // flat tiles, floating things, huge pieces
    list.push([c.x, c.z, Math.min(3.2, Math.max(size.x, size.z) * .62)]);
  }

  function reef3dBuild(host, zones, models){
    var THREE = window.THREE, night = reefNight();
    var spaces = reef3dSpaces(zones);
    var wrap = document.createElement('div');
    wrap.className = 'r3 ' + (night ? 'night' : 'day');
    wrap.innerHTML = '<canvas class="r3-canvas" aria-hidden="true"></canvas><div class="r3-labels"></div>' +
      '<button type="button" class="r3-mapbtn" data-r3-map>'+ccIcon('map')+'<span>Treasure map</span></button>' +
      reefMusicButtonHTML('r3-musicbtn') +
      '<button type="button" class="r3-themebtn" data-r3-theme aria-label="'+(night ? 'Switch to the sunlit reef (light mode)' : 'Switch to the midnight wreck (dark mode)')+'">'+ccIcon(night ? 'sun' : 'moon')+'</button>' +
      '<div class="r3-bubble" aria-live="polite" hidden></div>' +
      '<div class="r3-hud" aria-live="polite"><span class="r3-hud-shells" title="Shells">🐚 <b>0</b></span><span class="r3-hud-pearls" title="Golden pearls">🫧 <b>0</b></span></div>' +
      '<button type="button" class="r3-modebtn" data-r3-mode hidden></button>' +
      '<button type="button" class="r3-gamesbtn" data-r3-games aria-label="Minigame corner">'+ccIcon('games')+'</button>';
    var canvas = wrap.querySelector('canvas');
    var big = innerWidth * innerHeight > 700000;   // tablets and larger: skip edge smoothing, the costliest per-pixel step
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !big, alpha: true, powerPreference: 'low-power' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; // redrawn only when things move (see reef3dFrame)
    var scene = new THREE.Scene();
    var fogCol = night ? '#0c2a30' : '#7fd4d8';
    scene.fog = new THREE.Fog(fogCol, night ? 14 : 11, night ? 48 : 42);
    var cam = new THREE.PerspectiveCamera(42, 1, .1, scene.fog.far + 8);   // past the fog nothing shows, so nothing is drawn there
    var kit = reef3dKit(THREE, night), B = kit.B, M = kit.M, mesh = kit.mesh;
    var mainN = spaces.mainN || spaces.length;
    var r = reefRand(mainN * 131 + (night ? 5 : 1));

    scene.add(new THREE.HemisphereLight(night ? '#86c9c0' : '#fff6e2', night ? '#14262c' : '#3f7f88', night ? .78 : .5));
    var sun = new THREE.DirectionalLight(night ? '#b5f0e6' : '#fff1d2', night ? .78 : .72);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60; sun.shadow.bias = -.0015; sun.shadow.normalBias = .04;
    scene.add(sun, sun.target);
    var rig = reef3dRig(scene), bake = {};   // lighting is baked into the scenery (see reef3dBakeGeo), so no shadow maps
    renderer.shadowMap.enabled = false; sun.castShadow = false;

    // Sea floor with soft dunes.
    var len = mainN * 2.6 + 40;
    var floorGeo = new THREE.PlaneGeometry(70, len, 35, Math.round(len / 2));
    var pos = floorGeo.attributes.position;
    // The dunes settle down under the path and just around it, so no tile or bit of path sinks into the sand.
    var pathLines = reef3dPathLines(spaces), pathPts = [];
    pathLines.forEach(function(ln){ if(ln.length > 1) pathPts = pathPts.concat(new THREE.CatmullRomCurve3(ln.map(function(s){ return new THREE.Vector3(s.x, 0, s.z); })).getSpacedPoints(ln.length * 6)); });
    function duneK(x, z){
      var d2 = 1e9; for(var pi = 0; pi < pathPts.length; pi++){ var dx = pathPts[pi].x - x, dz = pathPts[pi].z - z, q = dx * dx + dz * dz; if(q < d2) d2 = q; }
      var k = Math.min(1, Math.max(0, (Math.sqrt(d2) - 1.9) / 2.6)); return k * k * (3 - 2 * k);   // 0 on the path, 1 a few steps away
    }
    function duneH(fx, fy, k){ var h = Math.sin(fx * .35) * .25 + Math.cos(fy * .22 + fx * .1) * .3; return Math.min(h, 0) * .4 - .06 + (h - Math.min(h, 0) * .4 + .06) * k; }
    var floorZ = -len / 2 + 14;
    // Night: the main path runs along the deck of a huge abandoned ship (see reef3dWreckDeck). The deck spans the
    // path with room to spare; the silt under it is pushed down so it never shows through the planks.
    var shipDeck = night && spaces.ship ? { half: spaces.ship.half, roll: spaces.ship.roll, sand: spaces.ship.sand, stair: spaces.stair,
      z0: spaces[0].z + 7, z1: spaces[mainN - 1].z - 9, y: -.02 } : null;
    if(shipDeck) shipDeck.holeZ = shipDeck.stair ? shipDeck.stair.cz + 2 : -1e9;
    function onDeck(x, z){ return shipDeck && Math.abs(x) < shipDeck.half + .6 && z < shipDeck.z0 + .6 && z > shipDeck.z1 - shipDeck.half * 1.4; }
    // Night: the sea floor sits low, a third of the way up the hull, and drifts of sand bank up against its sides.
    function sandH(fx, fy){
      var h = duneH(fx, fy, duneK(fx, floorZ - fy)) + (Math.abs(fx) > 12 ? (Math.abs(fx) - 12) * .25 : 0);
      if(!shipDeck) return h;
      var zz = floorZ - fy, along = zz < shipDeck.z0 + 2 && zz > shipDeck.z1 - shipDeck.half * 1.4, out = Math.abs(fx) - shipDeck.half;
      return h + shipDeck.sand + (along && out > 0 ? Math.max(0, 1 - out / 6) * 1.1 * duneK(fx, zz) : 0);
    }
    for(var v = 0; v < pos.count; v++){ var fx = pos.getX(v), fy = pos.getY(v);
      pos.setZ(v, onDeck(fx, floorZ - fy) ? (shipDeck.sand - 3) : sandH(fx, fy)); }
    floorGeo.computeVertexNormals();
    var floor = new THREE.Mesh(floorGeo, M(night ? '#2f3e3e' : '#d9cba6'));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.15, -len / 2 + 14); floor.receiveShadow = true; scene.add(floor);

    // Path: a sandy ribbon joining the spaces, then the round spaces themselves.
    var ribbonLines = [];
    pathLines.forEach(function(ln){ var cur = []; ln.forEach(function(s){ if(s.stair){ if(cur.length) ribbonLines.push(cur); cur = []; } else cur.push(s); }); if(cur.length) ribbonLines.push(cur); });
    ribbonLines.forEach(function(ln){
      if(ln.length < 2) return;
      var curve = new THREE.CatmullRomCurve3(ln.map(function(s){ return new THREE.Vector3(s.x, (s.y || 0) / .12, s.z); }));   // the tube is squashed to .12 high
      var ribbon = mesh(new THREE.TubeGeometry(curve, ln.length * 8, .55, 8), M(night ? '#6b5640' : '#efdcb4'));
      ribbon.scale.y = .12; ribbon.position.y = .02; scene.add(ribbon); reef3dBakeObject(ribbon, rig, bake);
    });
    var hitables = [], deckObjs = [], swayers = [], chestModel = null, spinners = [];
    var statics = new THREE.Group(); // parts that never move; merged into a few draws at the end
    spaces.forEach(function(s){
      var big = s.kind === 'deck' || s.kind === 'treasure' || s.kind === 'story' || s.kind === 'start' || s.kind === 'shop';
      var top = s.kind === 'chance' ? (night ? '#b45a7a' : '#f27b98') : s.kind === 'whirl' ? (night ? '#3f62a8' : '#5b8fe0') : s.kind === 'shop' ? (night ? '#b0802a' : '#f2b544')
        : s.kind === 'surprise' ? (night ? '#3f8fa0' : '#5cc2c8') : s.kind === 'plain' ? (night ? '#6f7d78' : '#fbf3df') : (s.zone ? s.zone.place.hue : (night ? '#c99a2e' : '#f0c35a'));
      var R = big ? 1.25 : .86, icon = s.kind === 'deck' ? s.item.d.emoji : s.kind === 'surprise' ? '?' : s.kind === 'treasure' ? '🧰' : s.kind === 'story' ? '🍾' : s.kind === 'start' ? '🐚' : s.kind === 'chance' ? '!' : s.kind === 'whirl' ? '🌀' : s.kind === 'shop' ? '🛍️' : '';
      var tile = reef3dTile(big ? 'classic' : 'shell', s, R, top, icon, night, kit, M, mesh);   // Wendy's mix: decks keep the sandy pedestal, the spaces between are seashells
      if(s.y){ tile.parts.forEach(function(pt){ pt.position.y += s.y; }); tile.face.position.y += s.y; }
      var face = tile.face; reef3dBakeObject(face, rig, bake);
      tile.parts.forEach(function(p){ statics.add(p); }); scene.add(face);
      face.userData.space = s.i; hitables.push(face);
      if(s.kind === 'surprise'){ // a floating "?" block over every surprise space
        var qb = reef3dQBlock(night); qb.position.set(s.x, REEF3D_QY + (s.y || 0), s.z); qb.traverse(function(c){ c.userData.space = s.i; }); scene.add(qb); hitables.push(qb); s.qb = qb;
      }
      if(s.kind === 'deck' || s.kind === 'treasure' || s.kind === 'story'){
        var set = night ? ['crate', 'barrel', 'anchor', 'wheel', 'cannon', 'lantern'] : ['brain', 'staghorn', 'fan', 'clam', 'sponge', 'anemone'];
        var kind = s.kind === 'deck' ? set[reefHash(s.item.d.id) % set.length] : s.kind;
        var MODEL_FOR = { crate: [s.i % 2 ? 'crateBottles' : 'crate', 1.1], barrel: ['barrel', 1.2], cannon: ['cannon', 1], treasure: ['chest', 1.1], story: ['bottle', 1.3] };
        var o = (MODEL_FOR[kind] && reef3dModel(models, MODEL_FOR[kind][0], MODEL_FOR[kind][1], kit.grad)) || B[kind](r);
        if(kind === 'treasure' && o.userData.gltf) chestModel = o;
        var nxt = reef3dAhead(spaces, s.i), side = s.x > nxt.x ? 1 : -1;
        if(innerWidth < 640) side = s.x > 0 ? -1 : 1; // on phones, keep objects toward the middle
        if(s.end) side = s.x > spaces[s.jn].x ? 1 : -1;   // a branch's prize sits past its end, away from the main path
        o.position.set(s.x + side * 2.1, s.y || 0, s.z - .2);
        o.scale.setScalar(1.25);
        o.traverse(function(c){ c.userData.space = s.i; });
        o.userData.space = s.i; s.obj = o; s.side = side;
        scene.add(o); deckObjs.push(o); hitables.push(o);
        if(/staghorn|fan|anemone|kelp/.test(kind)) swayers.push(o);
      }
    });
    // Scenery off the path.
    function nearPath(x, z){ for(var i = 0; i < spaces.length; i++){ var dx = spaces[i].x - x, dz = spaces[i].z - z; if(dx * dx + dz * dz < 12) return true; } return false; }
    var setD = night ? ['kelp', 'rock', 'plank', 'coralBall', 'rock'] : ['kelp', 'coralBall', 'rock', 'staghorn', 'coralBall', 'star', 'kelp'];
    for(var n = 0; n < mainN * 3.2; n++){
      var sx = (r() - .5) * 30, sz = 8 - r() * (mainN * 2.6 + 18);
      if(nearPath(sx, sz)) continue;
      if(shipDeck && Math.abs(sx) < shipDeck.half + 1.5 && sz < shipDeck.z0 + 1 && sz > shipDeck.z1 - shipDeck.half * 1.5) continue;   // nothing grows on the wreck
      var nm = setD[Math.floor(r() * setD.length)];
      if(nm === 'kelp' && Math.abs(sx) < 9) nm = 'coralBall'; // tall kelp only at the sides, so it never hides the board
      var d = null;
      if(nm === 'rock' && models.rock1) d = reef3dModel(models, ['rock1', 'rock2', 'rockp', 'rock1'][Math.floor(r() * 4)], .6 + r() * .9, kit.grad, night ? '#30464e' : '#9fb8bb');
      else if(!night && nm === 'coralBall' && models.plant && r() < .35) d = reef3dModel(models, 'plant', .8 + r() * .5, kit.grad, '#5fa478');
      if(!d) d = B[nm](r);
      d.position.set(sx, shipDeck ? groundY(sx, sz) + .15 : 0, sz); d.rotation.y = r() * 6; d.scale.multiplyScalar(.7 + r() * .7); statics.add(d);
    }
    var wreckM = night ? reef3dModel(models, 'wreck', 7, kit.grad, '#3c5560') : null;
    if(wreckM){ // the pirate shipwreck lies beside the middle of the path
      wreckM.traverse(function(m){ if(/^grass/.test(m.name || '')) m.visible = false; });
      var wmid = spaces[Math.floor(mainN / 2)], wside = wmid.x > 0 ? -1 : 1;
      wreckM.position.set(wmid.x + wside * (shipDeck ? shipDeck.half + 13 : 11), shipDeck ? shipDeck.sand - 1 : -.3, wmid.z - 3); wreckM.rotation.y = wside > 0 ? -.6 : Math.PI + .6; wreckM.scale.multiplyScalar(1);
      statics.add(wreckM);
    } else if(night){ // the sunken ship lies on its side beside the middle of the path, half buried in the silt
      var mid = spaces[Math.floor(mainN / 2)], ship = new THREE.Group();
      var hs = new THREE.Shape(); hs.moveTo(-6, 1.2); hs.quadraticCurveTo(-5.4, -1.6, -1, -2); hs.lineTo(3.6, -2); hs.quadraticCurveTo(6.4, -1.4, 7, 1.6); hs.lineTo(-6, 1.2);
      var hull = mesh(new THREE.ExtrudeGeometry(hs, { depth: 3, bevelEnabled: true, bevelSize: .35, bevelThickness: .35, bevelSegments: 3, curveSegments: 18 }), M('#5a4332'));
      hull.position.z = -1.5; ship.add(hull);
      for(var pl = 0; pl < 5; pl++){ var plank = mesh(new THREE.BoxGeometry(12.4 - pl * .9, .06, .06), M('#3a2b20'), .4, -1.6 + pl * .62, 1.88); ship.add(plank); }
      var deck = mesh(new THREE.BoxGeometry(12.6, .25, 3.4), M('#7a5f48'), .5, 1.3, 0); ship.add(deck);
      for(var rl = 0; rl < 9; rl++) ship.add(mesh(new THREE.CylinderGeometry(.07, .07, .7, 6), M('#4a3a2c'), -5 + rl * 1.35, 1.75, 1.6));
      ship.add(mesh(new THREE.BoxGeometry(12, .1, .1), M('#4a3a2c'), .5, 2.1, 1.6));
      for(var ph = 0; ph < 4; ph++){ var hole = new THREE.Mesh(new THREE.CircleGeometry(.36, 18), new THREE.MeshBasicMaterial({ color: '#ffe6a6' })); hole.position.set(-3.4 + ph * 2.4, -.2, 1.9); ship.add(hole);
        var ringP = mesh(new THREE.TorusGeometry(.4, .08, 6, 18), M('#b8902f'), -3.4 + ph * 2.4, -.2, 1.92); ship.add(ringP); }
      var mast = mesh(new THREE.CylinderGeometry(.22, .3, 8, 10), M('#3a2b20'), 1.2, 5.2, 0); ship.add(mast);
      var nest = mesh(new THREE.CylinderGeometry(.7, .55, .6, 12, 1, true), M('#4a3a2c', { side: THREE.DoubleSide }), 1.2, 8.4, 0); ship.add(nest);
      var sail = mesh(new THREE.PlaneGeometry(3.4, 2.6, 6, 4), M('#8c8576', { side: THREE.DoubleSide, transparent: true, opacity: .85 }), 1.2, 5.8, .3); sail.rotation.y = .3; ship.add(sail);
      var mastB = mesh(new THREE.CylinderGeometry(.18, .22, 4.5, 8), M('#3a2b20'), -3.6, 3.2, 0); mastB.rotation.z = .5; ship.add(mastB);
      var side = mid.x > 0 ? -1 : 1;
      ship.position.set(mid.x + side * 11.5, .6, mid.z - 3); ship.rotation.set(0, side > 0 ? -.35 : Math.PI + .35, side * .32);
      statics.add(ship);
    } else { // a coral-covered rock arch over the path, partway along
      var a = spaces[Math.floor(mainN * .6)], arch = mesh(new THREE.TorusGeometry(4.2, .9, 12, 36, Math.PI), M('#a9bcb9'), a.x, -.2, a.z);
      statics.add(arch);
      for(var q = 0; q < 9; q++){ var ang = q / 8 * Math.PI, cb = B.coralBall(r); cb.position.set(a.x + Math.cos(ang) * 4.2, Math.sin(ang) * 4.2 + .5, a.z); cb.scale.setScalar(.55); statics.add(cb); }
    }
    // The landmark comes alive: a thin stream of air bubbles rises from the wreck (from a vent at the foot of the
    // coral arch by day), and at night a lantern stands on the sand by the wreck in a warm pool of light.
    // No r() calls here, so the rest of the seeded layout stays where it was.
    var landmark = wreckM || ship || arch, plume = null, lamp = null;
    if(landmark){
      statics.updateMatrixWorld(true);
      var lmBox = new THREE.Box3().setFromObject(landmark), lmC = new THREE.Vector3(); lmBox.getCenter(lmC);
      var px = arch ? a.x - 4.2 : lmC.x, py = arch ? 0 : lmBox.max.y * .55, pz = arch ? a.z : lmC.z;
      plume = new THREE.InstancedMesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshBasicMaterial({ color: night ? '#cfeff0' : '#ffffff', transparent: true, opacity: .7 }), 16);
      plume.userData = { x: px, y: py, z: pz, h: 9 }; plume.frustumCulled = false; reef3dPlume(plume, new THREE.Object3D(), 0); scene.add(plume);
      if(night){
        var lmMid = spaces[Math.floor(mainN / 2)], lx = lmC.x + (lmMid.x - lmC.x) * .55, lz = lmC.z + 1.5;
        var lantern = B.lantern(); lantern.position.set(lx, groundY(lx, lz) + .15, lz); lantern.rotation.y = .4; lantern.scale.setScalar(1.1); deckObjs.push(lantern); scene.add(lantern);
        var poolGeo = new THREE.PlaneGeometry(13, 13); poolGeo.rotateX(-Math.PI / 2);   // Wendy chose the warmer, bigger glow
        var pool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ map: reef3dBlobTex(true), color: '#ffab45', transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        pool.position.set(lx, groundY(lx, lz) + .08, lz); pool.renderOrder = 3; scene.add(pool);
        lamp = { glow: lantern.userData.glow, halo: lantern.userData.halo, pool: pool };
      }
    }
    var reefFx = !night ? reef3dReefGarden({ THREE: THREE, scene: scene, statics: statics, spaces: spaces, mainN: mainN, M: M, mesh: mesh, B: B, r: reefRand(mainN * 17 + 3), groundY: groundY, taken: deckObjs.map(function(d){ return [d.position.x, d.position.z]; }) }) : null;
    var wreckFx = shipDeck ? reef3dWreckDeck({ THREE: THREE, scene: scene, statics: statics, deck: shipDeck, spaces: spaces, mainN: mainN, M: M, mesh: mesh, B: B, r: r, models: models, kit: kit, deckObjs: deckObjs }) : null;
    // Tall towers in the haze on both sides give the sea floor depth: coral by day, rock spires at night.
    for(var tz = 6; tz > -mainN * 2.6 - 10; tz -= 7 + r() * 5){
      [-1, 1].forEach(function(sd){
        var tw = new THREE.Group(), hgt = 4 + r() * 6, x = sd * (15 + r() * 8);
        if(night){ var sp = mesh(new THREE.ConeGeometry(1.4 + r(), hgt, 7), M('#25363c')); sp.position.y = hgt / 2; tw.add(sp); }
        else {
          var cols = ['#e7a39a', '#efc196', '#bcaedd', '#9fcfb0'], cc = cols[Math.floor(r() * cols.length)], yy = 0;
          for(var lv = 0; lv < 3; lv++){ var seg = mesh(new THREE.CylinderGeometry(.9 - lv * .2, 1.2 - lv * .2, hgt / 3, 8), M(reef3dShade(cc, -.05 * lv))); seg.position.y = yy + hgt / 6; yy += hgt / 3; tw.add(seg); }
          var cap = mesh(new THREE.SphereGeometry(1.1, 10, 7), M(cc)); cap.position.y = yy; cap.scale.y = .7; tw.add(cap);
        }
        tw.position.set(x, shipDeck ? groundY(x, tz) - .1 : -.2, tz); statics.add(tw);
      });
    }
    // Drifting bubbles (by day) or marine snow (by night).
    var bubbleGeo = new THREE.SphereGeometry(.07, 8, 6), bubbleMat = new THREE.MeshBasicMaterial({ color: night ? '#d8efe8' : '#ffffff', transparent: true, opacity: .55 });
    var bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, 70), bubbleData = [], dummy = new THREE.Object3D();
    for(var bI = 0; bI < 70; bI++) bubbleData.push({ x: (r() - .5) * 26, y: r() * 8, z: 6 - r() * 40, s: .4 + r() * 1.2, v: .2 + r() * .5 });
    scene.add(bubbles);

    // Moving caustics on the sand: a cell pattern in the floor's glow channel that drifts.
    var caus = (function(){
      var N = 128, c = document.createElement('canvas'); c.width = c.height = N; var g = c.getContext('2d'), img = g.createImageData(N, N), pts = [];
      for(var q = 0; q < 22; q++) pts.push([r() * N, r() * N]);
      for(var y = 0; y < N; y++) for(var x = 0; x < N; x++){
        var d1 = 1e9, d2 = 1e9;
        pts.forEach(function(p){ for(var ox = -N; ox <= N; ox += N) for(var oy = -N; oy <= N; oy += N){ var dx = x - p[0] - ox, dy = y - p[1] - oy, d = dx * dx + dy * dy; if(d < d1){ d2 = d1; d1 = d; } else if(d < d2) d2 = d; } });
        var e = Math.max(0, 1 - (Math.sqrt(d2) - Math.sqrt(d1)) / 5), v = Math.round(255 * e * e), o = (y * N + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, Math.round(len / 4.5)); return t;
    })();
    // The sand covers the whole screen, so it gets the cheapest shader of all: baked light plus the drifting
    // caustics added on top (see reef3dSandMat).
    floor.material = M(night ? '#2f3e3e' : '#d9cba6'); reef3dBakeObject(floor, rig, bake);
    floor.material = reef3dSandMat(caus, new THREE.Color(night ? '#2a6f78' : '#fff6da').multiplyScalar(.2));

    // Light rays slanting down from the surface; they travel with the camera.
    var rayTex = (function(){
      var c = document.createElement('canvas'); c.width = 64; c.height = 256; var g = c.getContext('2d');
      var gv = g.createLinearGradient(0, 0, 0, 256); gv.addColorStop(0, 'rgba(255,255,255,1)'); gv.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gv; g.fillRect(0, 0, 64, 256);
      g.globalCompositeOperation = 'destination-in';
      var gh = g.createLinearGradient(0, 0, 64, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gh; g.fillRect(0, 0, 64, 256);
      return new THREE.CanvasTexture(c);
    })();
    var rays = new THREE.Group(), rayList = [];
    for(var ri = 0; ri < 7; ri++){
      var rm = new THREE.Mesh(new THREE.PlaneGeometry(1.4 + r() * 1.8, 18), new THREE.MeshBasicMaterial({ map: rayTex, color: night ? '#7fe0d6' : '#fffbe8', transparent: true, opacity: night ? .05 : .14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      rm.position.set((r() - .5) * 20, 6.5, -4 - r() * 14); rm.rotation.set(0, (r() - .5) * .8, .32 + (r() - .5) * .1);
      rm.userData.base = rm.material.opacity; rm.userData.ph = r() * 6; rays.add(rm); rayList.push(rm);
    }
    scene.add(rays);

    // Little fish swimming in loose schools around the board.
    function fishMesh(col){
      var f = new THREE.Group();
      var b = mesh(new THREE.SphereGeometry(.2, 12, 8), M(col)); b.scale.set(.6, .8, 1.3); f.add(b);
      var tl = mesh(new THREE.ConeGeometry(.14, .22, 4), M(col), 0, 0, -.32); tl.rotation.x = -Math.PI / 2; tl.scale.set(.3, 1, 1); f.add(tl);
      f.add(mesh(new THREE.SphereGeometry(.045, 6, 6), M('#14232a'), .1, .05, .16));
      return f;
    }
    var fishMixers = [], schools = [], schoolCols = night ? ['#6fb3c9', '#8a7fc4', '#5fa39a'] : ['#ff9a6b', '#ffd166', '#7fc8f0'];
    for(var sI = 0; sI < 3; sI++){
      var sch = { fish: [], ph: r() * 6, rad: 3.5 + r() * 2.5, h: 2.2 + r() * 1.6, spd: (.16 + r() * .1) * (sI % 2 ? -1 : 1), off: (r() - .5) * 8, hx: null, hz: null };
      for(var fI = 0; fI < (models.fish1 ? 3 : 5); fI++){
        var fm = reef3dModel(models, ['fish1', 'fish2', 'fish1'][sI], .36, kit.grad, sI === 2 ? '#ffd166' : null), mx = null;
        if(fm){ // a real swimming fish: its own copy of the swim animation, started at a random point
          var inner = new THREE.Group(); inner.add(fm); fm = inner;
          mx = new THREE.AnimationMixer(inner.children[0].userData.root); var clip = inner.children[0].userData.gltf.animations[0];
          if(clip){ var ac = mx.clipAction(clip); ac.play(); ac.time = r() * clip.duration; } fishMixers.push(mx);
        } else fm = fishMesh(schoolCols[sI]);
        fm.userData.o = new THREE.Vector3((r() - .5) * 1.8, (r() - .5) * .9, (r() - .5) * 1.8); scene.add(fm); sch.fish.push(fm);
      }
      schools.push(sch);
    }
    // A whale (a manta ray at night) glides slowly far off in the haze.
    var bigOne = reef3dModel(models, night ? 'manta' : 'whale', night ? .45 : 2.6, kit.grad), bigMixer = null;
    // It starts far off: with Calm motion it never swims, so it must not sit on top of the guide.
    if(bigOne){ var bw = new THREE.Group(); bw.add(bigOne); bigOne = bw; bw.position.set(22, night ? 4.5 : 6, spaces[0].z - 18); scene.add(bigOne); bigMixer = new THREE.AnimationMixer(bw.children[0].userData.root); var bc = bw.children[0].userData.gltf.animations[0]; if(bc) bigMixer.clipAction(bc).play(); fishMixers.push(bigMixer); }
    // Coins in a ring around the Treasure Reef, gems here and there, and a star over the next deck.
    var tSpace = spaces.find(function(s){ return s.kind === 'treasure'; });
    if(tSpace && models.coin) for(var ci = 0; ci < 6; ci++){ var cn = reef3dModel(models, 'coin', .55, kit.grad); var ca = ci / 6 * Math.PI * 2; cn.position.set(tSpace.x + Math.cos(ca) * 1.9, .9 + (tSpace.y || 0), tSpace.z + Math.sin(ca) * 1.9); cn.userData.y0 = .9 + (tSpace.y || 0); reef3dBakeObject(cn, rig, bake); reef3dCompact(cn); scene.add(cn); spinners.push(cn); }
    if(models.gemPink) for(var gi = 0; gi < spaces.length; gi += 5){ var gs = spaces[gi], gm = reef3dModel(models, gi % 10 ? 'gemBlue' : 'gemPink', .5, kit.grad); gm.position.set(gs.x + (gi % 2 ? 2.6 : -2.6), .8 + (gs.y || 0), gs.z + 1); gm.userData.y0 = .8 + (gs.y || 0); reef3dBakeObject(gm, rig, bake); reef3dCompact(gm); scene.add(gm); spinners.push(gm); }
    var nextStar = reef3dModel(models, 'star', .8, kit.grad);
    if(nextStar){ nextStar.visible = false; scene.add(nextStar); }
    // Kiko the crab (Mochi or Hermit, see reef_crabs.js) walks along with the guide and dances at surprises.
    var crab = reefCrabBuild(reefCrabNow, kit.grad, .95); scene.add(crab);
    var chestMixer = null, chestActs = {};
    if(chestModel){ chestMixer = new THREE.AnimationMixer(chestModel.userData.root); chestModel.userData.gltf.animations.forEach(function(c){ chestActs[c.name] = chestMixer.clipAction(c); }); }
    // Soft shadows under everything that stands on the sand, then the still scenery baked and merged.
    function groundY(x, z){
      if(onDeck(x, z) && Math.abs(x) < shipDeck.half) return (z < shipDeck.holeZ && shipDeck.stair ? shipDeck.stair.low : 0) + shipDeck.y + x * shipDeck.roll;
      return sandH(x, -(z - (-len / 2 + 14))) - .15;
    }
    var blobList = [], blobMat = reef3dBlobMat(reef3dBlobTex(), night);
    statics.updateMatrixWorld(true);
    statics.children.forEach(function(c){ reef3dFootprint(c, blobList); });
    deckObjs.forEach(function(o){ reef3dFootprint(o, blobList); if(o !== chestModel){ reef3dBakeObject(o, rig, bake); reef3dCompact(o); } });
    var blobs = reef3dBlobs(blobList, blobMat, groundY); if(blobs) scene.add(blobs);
    scene.add(reef3dMerge(statics, rig, bake));
    var guide = B.guide(); reef3dOutline(guide, night ? '#173d5c' : '#1f3a2c', night ? .035 : .05); scene.add(guide);
    var crabFit = reefCrabExtent(guide) * .7; reefCrabFit(crab, crabFit);   // the crab is about 70% of Shelly's (or Lumi's) size
    function moverBlob(r){ var g = new THREE.PlaneGeometry(r * 2, r * 2); g.rotateX(-Math.PI / 2); var b = new THREE.Mesh(g, blobMat); b.renderOrder = 2; scene.add(b); return b; }
    var blobG = moverBlob(1.1), blobC = crab ? moverBlob(.8) : null, glowG = null;
    if(night){
      var gtex = reef3dBlobTex(true), gg = new THREE.PlaneGeometry(11, 11); gg.rotateX(-Math.PI / 2);
      glowG = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ map: gtex, color: '#5ff0e0', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      glowG.renderOrder = 3; scene.add(glowG);
    }
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, .08, 8, 40), new THREE.MeshBasicMaterial({ color: night ? '#ffe29a' : '#ffffff', transparent: true, opacity: .8 }));
    ring.rotation.x = Math.PI / 2; ring.visible = false; scene.add(ring);

    // HTML labels for the decks (crisp text, real buttons for touch and screen readers).
    var labels = wrap.querySelector('.r3-labels');
    spaces.forEach(function(s){
      if(!s.obj) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'r3-label';
      if(s.kind === 'deck'){
        var it = s.item, label = it.state === 'ready' ? 'Ready' : it.state === 'done' ? 'All done' : it.kind;
        b.classList.add(it.state);
        b.innerHTML = '<span class="r3-emoji" aria-hidden="true">'+it.d.emoji+'</span><span><b>'+esc(it.d.name)+'</b><small>'+esc(label)+'</small></span>' + (it.state === 'done' ? '<i class="r3-star" aria-hidden="true">★</i>' : '');
        b.setAttribute('aria-label', it.d.name + '. ' + (it.state === 'ready' ? 'Ready to practice.' : it.state === 'done' ? 'All done. Tap to play again.' : 'Tap to ' + it.kind.toLowerCase() + '.'));
      } else {
        var t = s.kind === 'treasure' ? ['🧰', 'Treasure Reef', 'My sea friends'] : ['🍾', 'Story Bottle', 'Make a story'];
        b.innerHTML = '<span class="r3-emoji" aria-hidden="true">'+t[0]+'</span><span><b>'+t[1]+'</b><small>'+t[2]+'</small></span>';
        b.setAttribute('aria-label', t[1] + '. ' + t[2] + '.');
      }
      b.dataset.space = s.i; s.label = b; labels.appendChild(b);
      if(s.kind === 'deck' && s.first){
        var names = REEF_ZONE_NAMES[night ? 'night' : 'day'], zn = names[s.zone.id] || s.zone.label;
        var sign = document.createElement('button'); sign.type = 'button'; sign.className = 'r3-sign'; sign.dataset.space = s.i; sign.setAttribute('aria-label', zn + '. Go to ' + s.item.d.name + '.');
        sign.innerHTML = '<b>'+esc(zn)+'</b><small>'+esc(s.zone.label)+'</small>'; s.sign = sign; labels.appendChild(sign);
      }
    });

    var view = {
      wrap: wrap, renderer: renderer, scene: scene, cam: cam, spaces: spaces, guide: guide, ring: ring, night: night,
      at: 0, moving: false, camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), t0: performance.now(),
      bubbles: bubbles, bubbleData: bubbleData, dummy: dummy, swayers: swayers, hitables: hitables, sun: sun, key: '', dirty: true,
      caus: caus, rays: rays, rayList: rayList, schools: schools, fx: [], kit: kit,
      fishMixers: fishMixers, bigOne: bigOne, models: models, baked: true, blobG: blobG, blobC: blobC, glowG: glowG, groundY: groundY,
      crab: crab, crabFit: crabFit, crabGap: reefCrabExtent(guide) / 2 + crabFit / 2 + .2, leaving: null, spareCrab: null, chestMixer: chestMixer, chestActs: chestActs, nextStar: nextStar, spinners: spinners, lastT: performance.now(),
      plume: plume, lamp: lamp, wreck: wreckFx, reefFx: reefFx, shipDeck: shipDeck
    };
    reef3dPartyBuild(view);
    reef3dQApply(view);
    return view;
  }

  function reef3dPlace(view, i){
    var s = view.spaces[i]; view.at = i;
    view.guide.position.set(s.x, .3 + (s.y || 0), s.z);
    var nx = reef3dAhead(view.spaces, i);
    if(nx !== s) view.guide.rotation.y = Math.atan2(nx.x - s.x, nx.z - s.z);
    // the crab starts at its place beside her (it used to appear on top of her and walk out)
    if(view.crab && !view.crab.userData.entering){ var cs = reef3dCrabSpot(view); view.crab.position.set(cs.x, view.guide.position.y - .3, cs.z); }
  }
  // Where the crab stands: beside the guide on the side away from the middle of the path, a little in front.
  function reef3dCrabSpot(view){
    var g = view.guide.position, side = g.x > 0 ? -1 : 1;
    return { x: g.x + side * view.crabGap, z: g.z + 1.4 };
  }
  function reef3dCamTarget(view, out, look){
    var g = view.guide.position;
    var f = view.w && view.w < 640 ? .95 : .6;
    var gy = g.y - .3;   // the level she's on (the ship's hold at night is lower)
    if(view.night){
      // On the spiral staircase the camera swings out to a three-quarter view of it, so the climb down reads.
      var st = view.spaces.stair;
      if(st && Math.hypot(g.x - st.cx, g.z - st.cz) < 4.4 && gy < -.5 && gy > st.low + .5){
        var sd = st.cx > 0 ? -1 : 1;   // from above the open hold, a little to the side, looking down into the spiral
        out.set(st.cx + sd * 3, st.low + 12.5, st.cz - 6.5); look.set(st.cx, gy - .8, st.cz + .3); view.camMode = 'stair'; return;
      }
      if(st && gy < st.low + .8){   // down in the hold: high above and looking steeply down, so the broken deck edge
        // and the top deck's things don't block her, and the path ahead along the hold stays in view
        out.set(g.x * f, gy + 15.5, g.z + 7.5); look.set(g.x * (f + .05), gy + .2, g.z - 5.5); view.camMode = 'hold'; return;
      }
      var sd2 = view.shipDeck, side = g.x > 0 ? 1 : -1;
      if(sd2 && Math.abs(g.x) > sd2.half + .5){   // off the ship on the sand: the camera goes out there too, not behind the hull
        out.set(g.x + side * 5, 9 + gy * .3, g.z + 9); look.set(g.x - side * .5, gy + .5, g.z - 3); view.camMode = 'sand'; return;   // from outside and above the gangplank
      }
      // Elsewhere on the ship it sits lower and looks ahead, so the masts, sails and the drop to the hold show.
      out.set(g.x * f, 10.5 + gy * .55, g.z + 12.5 + (gy < -1 ? -gy * .25 : 0));
      look.set(g.x * (f + .05), gy + 1.4, g.z - 4.5); view.camMode = 'deck';
      // a mast standing between the camera and her: slide the camera sideways until it clears
      var ms = view.wreck && view.wreck.masts;
      (ms || []).forEach(function(m){
        var dx = g.x - out.x, dz = g.z - out.z, L2 = dx * dx + dz * dz, u = ((m.x - out.x) * dx + (m.z - out.z) * dz) / L2;
        if(u < .08 || u > .92) return;
        var px = out.x + dx * u - m.x, pz = out.z + dz * u - m.z, dist = Math.sqrt(px * px + pz * pz);
        if(dist < 2.8){ var push = (2.8 - dist) / (1 - u) + .4, dir = px !== 0 ? Math.sign(px) : (m.x > g.x ? -1 : 1); out.x += dir * push; }
      });
      return;
    }
    out.set(g.x * f, 13 + gy, g.z + 10.5);
    look.set(g.x * (f + .05), gy, g.z - 2.6);
  }
  function reef3dSize(view){
    var w = view.wrap.clientWidth || 1, h = view.wrap.clientHeight || 1;
    if(view.w === w && view.h === h) return;
    view.w = w; view.h = h; view.renderer.setSize(w, h, false);
    view.cam.aspect = w / h; view.cam.fov = w < 640 ? 52 : 42; view.cam.updateProjectionMatrix(); view.dirty = true;
  }
  function reef3dFrame(view, now){
    var THREE = window.THREE, calm = reefCalm(), t = (now - view.t0) / 1000;
    var dt = Math.min(.05, Math.max(0, (now - view.lastT) / 1000)); view.lastT = now;
    reef3dSize(view);
    var tp = new THREE.Vector3(), tl = new THREE.Vector3();
    reef3dCamTarget(view, tp, tl);
    var up = view.themeFx || view.themeIn ? reef3dThemeFrame(view, now, t) : 0;
    if(!up && view.wrap.classList.contains('r3-sky')) view.wrap.classList.remove('r3-sky');
    if(up){ tl.y += 15 * up; tl.z -= 12 * up; tp.y -= 4 * up; tp.z += 2 * up; }
    // A change of view (onto the stairs, into the hold, out onto the sand) glides over about two seconds
    // instead of snapping; the rest of the time the camera keeps up with her briskly.
    if(view.camMode !== view.camModeWas){ if(view.camModeWas) view.camGlide = now + 2200; view.camModeWas = view.camMode; }
    var k = calm || up ? 1 : 1 - Math.pow(view.camGlide > now ? .955 : .84, dt * 30);
    view.camPos.lerp(tp, k); view.camLook.lerp(tl, k);
    view.cam.position.copy(view.camPos); view.cam.lookAt(view.camLook);
    var g = view.guide.position;
    view.sun.position.set(g.x + 6, 18, g.z + 8); view.sun.target.position.set(g.x, 0, g.z - 2);
    if(!calm){
      var body = view.guide.userData.body, q = reef3dPose(), em = view.emote;
      if(em){ var ep = (now - em.t0) / em.dur; if(ep >= 1 || view.moving){ view.emote = null; view.emoteEnd = now; if(em.after) em.after(); } else REEF3D_EMOTES[em.name].pose(ep, q, t); }
      if(view.skyUp){ q.headX -= .6 * view.skyUp; q.rx -= .32 * view.skyUp; q.eyes = Math.max(q.eyes, 1.15); }   // looking up at the sky with you
      if(!view.moving){
        var sxz = 1 / Math.sqrt(q.sy);
        body.position.y = Math.sin(t * 2.2) * .08 + q.y; body.rotation.z = Math.sin(t * 1.3) * .04 + q.rz;
        var ry = q.ry;
        if(q.face){ var gp = view.guide.position, toCam = Math.atan2(view.cam.position.x - gp.x, view.cam.position.z - gp.z) - view.guide.rotation.y;
          toCam = Math.atan2(Math.sin(toCam), Math.cos(toCam)); ry += toCam * q.face; }   // the shortest way round
        if(!view.guide.userData.parts.neck) ry += q.headY * .6;   // Lumi has no neck: she turns her whole body to look
        body.rotation.x = q.rx; body.rotation.y = ry; body.scale.set(sxz, q.sy, sxz);
        // idle life: every so often she looks around, or does a little twirl
        if(!view.emote){ if(!view.idleAt) view.idleAt = now + 6000 + Math.random() * 5000; else if(now > view.idleAt){ view.idleAt = 0; reef3dEmote(view, Math.random() < .25 ? 'twirl' : 'look'); } }
        else view.idleAt = 0;
      }
      view.swayers.forEach(function(s, i){ s.rotation.z = Math.sin(t * .9 + i) * .06; s.rotation.x = Math.cos(t * .7 + i) * .05; });
      view.spaces.forEach(function(s){ var u = s.obj && s.obj.userData; if(!u || !u.glow) return; var w = Math.sin(t * 2 + s.i);
        u.glow.material.color.setHSL(.12, 1, .68 + w * .06); if(u.halo) u.halo.scale.setScalar(2.5 + w * .25 + Math.sin(t * 9 + s.i * 3) * .08); });
      view.bubbleData.forEach(function(b, i){
        var y = (b.y + t * b.v) % 9, d = view.dummy;
        // fixed in the water (they don't travel with the guide); one left far behind comes back far ahead, in the haze
        var bz = g.z + 6 - (((g.z + 6 - b.z) % 40) + 40) % 40;
        d.position.set(b.x + Math.sin(t + i) * .3, view.night ? 9 - y : y, bz); d.scale.setScalar(b.s); d.updateMatrix(); view.bubbles.setMatrixAt(i, d.matrix);
      });
      view.bubbles.instanceMatrix.needsUpdate = true;
      if(view.plume) reef3dPlume(view.plume, view.dummy, t);
      if(view.lamp){ var lf = .5 + Math.sin(t * 1.6) * .5, fk = Math.sin(t * 7.3) * .5 + Math.sin(t * 11.1) * .5;   // a slow breath plus a candle flicker
        view.lamp.pool.material.opacity = .85 + lf * .12 + fk * .03; if(view.lamp.glow) view.lamp.glow.material.color.setHSL(.12, 1, .68 + lf * .08);
        if(view.lamp.halo){ view.lamp.halo.scale.setScalar(3.4 + lf * .5 + fk * .12); view.lamp.halo.material.opacity = .85 + fk * .1; } }
      view.ring.scale.setScalar(1 + Math.sin(t * 2.4) * .06);
      var parts = view.guide.userData.parts, mv = view.moving;
      var fl = mv ? 1 : q.flap;
      (parts.flippers || []).forEach(function(f, i){
        var sp = 2.2 + 10.8 * fl, amp = .18 + .37 * fl;
        if(view.night) f.rotation.z = f.userData.side * Math.sin(t * sp * 1.4 + i) * amp;
        else { f.rotation.y = f.userData.side * Math.sin(t * sp + (f.userData.front ? 0 : 1.6)) * amp; f.rotation.z = f.userData.side * Math.sin(t * sp + .8) * amp * .4; }
        // a wave: the front right flipper (or fin) lifts high and waves
        if(q.wave && i === 0){ var wv = f.userData.side * (1.05 + Math.sin(t * 13) * .38); f.rotation.z = f.rotation.z * (1 - q.wave) + wv * q.wave; f.rotation.y *= 1 - q.wave; }
      });
      if(parts.tail) parts.tail.rotation.y = Math.sin(t * (mv ? 14 : 4)) * .45;
      if(parts.neck){ parts.neck.rotation.y = Math.sin(t * .7) * .18 * (1 - Math.min(1, Math.abs(q.headY) * 2)) + q.headY; parts.neck.rotation.x = q.headX; }
      var blink = (t % 3.7) < .13 ? .12 : 1;
      // eyes: blink, happy squint (^ ^) or wide with surprise
      (parts.eyes || []).forEach(function(e){ var w = q.eyes > 1 ? q.eyes : 1; e.scale.set(w, blink * q.eyes, w); });
      if(parts.glow) parts.glow.intensity = 1.2 + Math.sin(t * 3) * .25;
      view.caus.offset.set(t * .012, t * .02);
      view.rays.position.set(g.x * .5, 0, g.z);
      view.rayList.forEach(function(rm){ rm.material.opacity = rm.userData.base * (.65 + .35 * Math.sin(t * .5 + rm.userData.ph)); });
      // Each school circles its own home on the reef; it doesn't follow Shelly. A school she has left far
      // behind swims (not jumps) to a new home ahead of her. Fish face the way they are really moving.
      view.fishLvl = (view.fishLvl || 0) + ((g.y - .3) - (view.fishLvl || 0)) * Math.min(1, dt * 1.5);
      view.schools.forEach(function(sc, k){
        if(sc.hz == null){ sc.hx = sc.off; sc.hz = g.z - 4 - k * 7; sc.tx = sc.hx; sc.tz = sc.hz; }
        if(Math.abs(sc.tz - g.z) > 18){ sc.tz = g.z - 6 - Math.random() * 8; sc.tx = (Math.random() - .5) * 10; }
        // after a tap the fish dart apart (fl.k rises fast), then drift back together while the school swims to its new home
        var fl = sc.flee, fa = fl ? performance.now() / 1000 - fl.t0 : 9;
        if(fl && fa > fl.dur) sc.flee = fl = null;
        var mx = sc.tx - sc.hx, mz = sc.tz - sc.hz, md = Math.sqrt(mx * mx + mz * mz), step = Math.min(md, dt * (fl ? 4 : 1.8));
        if(md > .01){ sc.hx += mx / md * step; sc.hz += mz / md * step; }
        var sdk = view.shipDeck, rad = sc.rad;
        if(sdk){   // night: the schools stay inside the wreck (never through the hull, never down in the sand)
          rad = Math.min(sc.rad, sdk.half - 3); var room = sdk.half - 1.8 - rad;
          sc.hx = Math.max(-room, Math.min(room, sc.hx)); sc.tx = Math.max(-room, Math.min(room, sc.tx));
        }
        var a = t * sc.spd + sc.ph, cx = sc.hx + Math.cos(a) * rad, cz = sc.hz + Math.sin(a) * rad * .7;
        if(sdk){   // swim over whichever deck is below the school: the top deck, or down in the open hold
          var floor = (sdk.stair && cz < sdk.holeZ - 1 ? sdk.stair.low + sdk.y : sdk.y) + cx * sdk.roll;
          sc.lvl = sc.lvl == null ? floor : sc.lvl + (floor - sc.lvl) * Math.min(1, dt * 1.2);
        }
        var lvl = sdk ? sc.lvl : view.fishLvl;
        sc.fish.forEach(function(f, j){
          var o = f.userData.o, px = f.position.x, pz = f.position.z;
          var fo = fl ? reef3dFleeOff(fl, j, fa) : null;
          f.position.set(cx + o.x + Math.sin(t * .9 + j) * .12 + (fo ? fo.x : 0), sc.h + lvl + o.y + Math.sin(t * 2 + j) * .12 + (fo ? Math.min(.5, fo.y) : 0), cz + o.z + (fo ? fo.z : 0));
          // Face the way the fish is really going: its velocity is smoothed over a few frames, and it turns
          // no faster than about a half-turn a second, so small wobbles never make it spin on the spot.
          var sv = f.userData.v || (f.userData.v = { x: 0, z: 0 }), ease = Math.min(1, dt * 4);
          if(dt > 0){ sv.x += ((f.position.x - px) / dt - sv.x) * ease; sv.z += ((f.position.z - pz) / dt - sv.z) * ease; }
          if(sv.x * sv.x + sv.z * sv.z > .01){
            var want = Math.atan2(sv.x, sv.z), d = Math.atan2(Math.sin(want - f.rotation.y), Math.cos(want - f.rotation.y)), turn = dt * 3.2;
            f.rotation.y += Math.max(-turn, Math.min(turn, d * Math.min(1, dt * 5)));
          }
          if(!f.children[0].userData.gltf && f.children[1]) f.children[1].rotation.y = Math.sin(t * 12 + j) * .5;
        });
      });
      view.fishMixers.forEach(function(m){ m.update(dt); });
      if(view.bigOne){ var ba = t * .05; view.bigOne.position.set(Math.cos(ba) * 22, (view.night ? 4.5 : 6) + Math.sin(t * .3) * .6, g.z - 18 + Math.sin(ba) * 8); view.bigOne.rotation.y = Math.atan2(-Math.sin(ba) * 20, Math.cos(ba) * 10); }
      if(view.crab) reefCrabAnimate(view.crab);
      reefCrabLeaveTick(view, dt);
      if(view.chestMixer) view.chestMixer.update(dt);
      view.spinners.forEach(function(sp, i){ sp.rotation.y = t * 1.4 + i; sp.position.y = (sp.userData.y0 != null ? sp.userData.y0 : .8) + Math.sin(t * 2 + i) * .12; });
      if(view.nextStar && view.nextStar.visible){ view.nextStar.rotation.y = t * 2; view.nextStar.position.y = view.nextStar.userData.y + Math.sin(t * 2.4) * .15; }
      view.spaces.forEach(function(s){ if(s.qb) reef3dQIdle(s, t); });
      reef3dDiceTick(view, now, t);
      reef3dPartyTick(view, now, t);
      reef3dWreckTick(view, t);
      reef3dReefTick(view, t);
      view.spaces.forEach(function(s){
        if(!s.obj) return;
        if(s.obj.userData.lid) s.obj.userData.lid.rotation.x = -.25 - .35 * (Math.sin(t * .7 + s.i) * .5 + .5);
        if(s.obj.userData.spin) s.obj.userData.spin.rotation.z = t * .25;
      });
    }
    if(calm) reef3dDiceTick(view, now, t);
    // short-lived effects (sand puffs, star bursts) run even in Calm motion as a single still frame
    view.fx = view.fx.filter(function(fx){ var p = Math.min(1, (now - fx.t0) / fx.dur); fx.step(p); if(p >= 1){ fx.end(); return false; } return true; });
    if(!calm && view.amb && now - (view.ambBlip || 0) > 3500 + Math.random() * 4000){ view.ambBlip = now; try { if(Sound.isEnabled()) Sound.bloop(700 + Math.random() * 500, 0, .012); } catch(e){} }
    if(view.crab){ // the crab trots after the guide, a little to the side
      var spot = reef3dCrabSpot(view), tx = spot.x, tz = spot.z;   // side by side, never overlapping
      var cp = view.crab.position, dx = tx - cp.x, dz = tz - cp.z, dist = Math.sqrt(dx * dx + dz * dz);
      var entering = view.crab.userData.entering && !calm;   // a crab swapped in scuttles over from the side
      if(!entering && (calm || dist > 6)){ cp.set(tx, 0, tz); dist = 0; }
      else if(dist > .05){ var st = Math.min(dist, dt * (entering ? 4.5 : 7)); cp.x += dx / dist * st; cp.z += dz / dist * st; }
      cp.y += (view.guide.position.y - .3 - cp.y) * (calm ? 1 : .2);   // the crab keeps to her level (stairs, the hold)
      if(entering && dist < .3){ view.crab.userData.entering = false; view.crabBusy = false; reef3dCrabAct(view, 'Dance', true); }
      var walking = dist > .25 && !calm;
      if(walking) view.crab.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;   // crabs walk sideways
      else if(!view.crabBusy) view.crab.rotation.y += (Math.atan2(view.cam.position.x - cp.x, view.cam.position.z - cp.z) - view.crab.rotation.y) * .1;
      if(!view.crabBusy) reef3dCrabAct(view, walking ? 'Walk' : 'Idle');
    }
    if(view.blobG){ var bg = view.guide.position; view.blobG.position.set(bg.x, view.groundY(bg.x, bg.z) + .07, bg.z); if(view.glowG){ view.glowG.position.set(bg.x, view.groundY(bg.x, bg.z) + .09, bg.z + .6); view.glowG.material.opacity = .45 + Math.sin(t * 3) * .1; } }
    if(view.blobC && view.crab){ var bc = view.crab.position; view.blobC.position.set(bc.x, view.groundY(bc.x, bc.z) + .07, bc.z); }
    // Keep it light on the iPad: full speed while something is moving, half speed when it's calm,
    // and shadows recalculated only while Shelly moves or now and then for the fish.
    view.frameN = (view.frameN || 0) + 1;
    var busy = view.moving || view.fx.length || view.camPos.distanceToSquared(tp) > .0004;
    if(busy || view.frameN % (view.every === 2 ? 6 : 12) === 0) view.renderer.shadowMap.needsUpdate = true;
    view.renderer.render(view.scene, view.cam);
    // reef3dLabels(view) is off: the deck names no longer hover over the board (the tiles show which deck is which,
    // and the treasure map lists them). The label buttons stay, hidden, for screen readers and keyboards.
    // nothing important moving: a device that has shown it struggles may draw the gentle idle motion at half speed
    view.idle = !busy && !view.emote && !view.dice && !view.themeFx && !view.themeIn && now - (view.touchAt || 0) > 2000 &&
      !view.schools.some(function(sc){ return sc.flee; });
  }
  function reef3dLoop(view){
    if(view.raf) return;
    function tick(now){
      if(!document.body.contains(view.wrap)){ view.raf = null; reef3dAmbience(view, false); if(!document.querySelector('.r3')) document.body.classList.remove('r3-full'); return; }
      view.tick = (view.tick || 0) + 1;
      if(window.__reefTx){ if(view.qs) view.qs.hold = now + 800; }   // a transition covers the board: don't draw under it
      else if(view.tick % (view.every || 1) === 0){
        if(view.idle && R3.q >= 1 && view.every !== 2 && view.tick % 2){ if(view.qs) view.qs.hold = now + 600; }   // skipped: not counted as slow
        else { reef3dFrame(view, now); reef3dQTick(view, now); }
      }
      view.raf = requestAnimationFrame(tick);
    }
    view.raf = requestAnimationFrame(tick);
  }

  // Hop along the path one space at a time; Calm motion skips straight there.
