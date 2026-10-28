  /* ---------- Kiko's crabs: Mochi (squishy pink) and Hermit (in a lavender shell), Wendy's two favourites ----------
     Built from simple shapes in the board's toon style and animated by hand, so they need no model file. One is
     picked at random when Coral Cove opens; tapping the crab makes it wiggle and scuttle off, and the other one
     scuttles in and dances. Each faces +z and stands on y = 0. */
  var REEF_CRABS = ['mochi', 'hermit'];
  var reefCrabNow = REEF_CRABS[Math.random() < .5 ? 0 : 1];
  function reefCrabOther(){ return reefCrabNow === 'mochi' ? 'hermit' : 'mochi'; }

  function reefCrabBuild(name, grad, size){
    var THREE = window.THREE, mats = {};
    function M(c){ return mats[c] || (mats[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: grad })); }
    var ink = new THREE.MeshBasicMaterial({ color: '#1d2a33' }), white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    var blush = new THREE.MeshBasicMaterial({ color: '#ff5c8a', transparent: true, opacity: .45, depthWrite: false });
    var g = new THREE.Group(), body = new THREE.Group(), parts = { body: body, claws: [], eyes: [], legs: [] };
    g.add(body);
    function add(parent, geo, mat, x, y, z, sx, sy, sz){ var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); parent.add(m); return m; }
    function sph(r){ return new THREE.SphereGeometry(r, 20, 14); }
    // a shiny cartoon eye: white, a big pupil looking a little inward, two glints
    function eye(x, y, z, r, look){
      var e = new THREE.Group(); e.position.set(x, y, z); body.add(e);
      add(e, sph(r), white, 0, 0, 0, 1, 1.1, 1);
      add(e, sph(r * .62), ink, look * r * .15, -r * .08, r * .62, 1, 1.1, .7);
      add(e, sph(r * .2), white, -r * .22, r * .22, r * 1.1);
      add(e, sph(r * .1), white, r * .2, -r * .25, r * 1.08);
      parts.eyes.push(e);
    }
    function stalkEye(sd, x, y, z, h, r, col){
      var s = add(body, new THREE.CylinderGeometry(.045, .06, h, 10), M(col), sd * x, y + h / 2, z); s.rotation.z = -sd * .18;
      eye(sd * (x + Math.sin(.18) * h * .5), y + h + r * .7, z, r, -sd);
    }
    function face(y, z, r, cx, cy, cz, cr){
      var s = add(body, new THREE.TorusGeometry(r, r * .22, 8, 20, Math.PI), ink, 0, y, z); s.rotation.z = Math.PI;
      [-1, 1].forEach(function(sd){ add(body, sph(cr), blush, sd * cx, cy, cz, 1, .6, .35); });
    }
    // a claw on an arm that turns at the shoulder, so the claws can lift and wave
    function claw(sd, x, y, z, r, col){
      var pivot = new THREE.Group(); pivot.position.set(sd * x * .6, y - .05, z); body.add(pivot);
      var ox = sd * x * .4, arm = add(pivot, new THREE.CylinderGeometry(.06, .07, Math.abs(ox) + .06, 10), M(col), ox / 2, 0, 0); arm.rotation.z = Math.PI / 2;
      add(pivot, sph(r), M(col), ox, .05, 0, 1, .9, .85);
      add(pivot, sph(r * .55), M(col), ox + sd * r * .15, .05 + r * .75, r * .2, 1, 1.2, .9);
      pivot.userData = { sd: sd, base: pivot.rotation.clone() }; parts.claws.push(pivot);
    }
    function legs(sd, x, y, col, n){
      for(var i = 0; i < n; i++){
        var l = add(body, new THREE.CylinderGeometry(.05, .04, .34, 8), M(col), sd * x, y, -.22 + i * .2 + (n === 2 ? .1 : 0));
        l.rotation.set(0, sd * (i - (n - 1) / 2) * .25, sd * 1.0); l.userData.base = l.rotation.clone(); parts.legs.push(l);
      }
    }
    if(name === 'hermit'){
      var c = '#ff9466', d = '#f07a4f', shell = new THREE.Group(); shell.position.set(0, .48, -.25); shell.rotation.set(-.3, 0, 0); body.add(shell);
      for(var i = 0; i < 5; i++){ var t = i / 4; add(shell, new THREE.TorusGeometry(.42 - t * .3, .2 - t * .12, 12, 28), M(i % 2 ? '#a58cf0' : '#c6b4ff'), 0, t * .55, -t * .1).rotation.x = Math.PI / 2; }
      add(shell, sph(.08), M('#a58cf0'), 0, .66, -.1);
      add(body, sph(.36), M(c), 0, .36, .22, 1.2, .85, .8);
      stalkEye(-1, .14, .55, .38, .2, .13, d); stalkEye(1, .14, .55, .38, .2, .13, d);
      face(.36, .5, .06, .3, .36, .44, .07);
      claw(-1, .5, .3, .42, .16, d); claw(1, .5, .3, .42, .16, d);
      legs(-1, .4, .14, d, 2); legs(1, .4, .14, d, 2);
    } else {
      var c2 = '#ff9fb6', d2 = '#ff7f9d';
      add(body, sph(.6), M(c2), 0, .42, 0, 1.35, .72, 1);
      eye(-.26, .62, .45, .17, 1); eye(.26, .62, .45, .17, -1);
      face(.45, .61, .06, .5, .48, .5, .09);
      claw(-1, .9, .42, .3, .15, d2); claw(1, .9, .42, .3, .15, d2);
      legs(-1, .66, .16, d2, 3); legs(1, .66, .16, d2, 3);
    }
    // Fewer draws for the iPad: each moving piece becomes one mesh per colour.
    var movers = parts.eyes.concat(parts.claws, parts.legs);
    reefCrabMerge(body, movers); parts.eyes.forEach(function(e){ reefCrabMerge(e, []); }); parts.claws.forEach(function(p){ reefCrabMerge(p, []); });
    g.scale.setScalar(size || 1);
    g.userData = { kind: name, parts: parts, anim: { name: 'Idle', t0: 0 }, seed: Math.random() * 4 };
    return g;
  }
  // Joins a group's meshes into one per material, in the group's own space; parts listed in skip stay apart.
  function reefCrabMerge(grp, skip){
    var THREE = window.THREE, U = THREE.BufferGeometryUtils; if(!U) return;
    grp.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(grp.matrixWorld).invert(), buckets = {}, victims = [];
    grp.traverse(function(m){
      if(!m.isMesh) return;
      for(var q = m; q && q !== grp; q = q.parent) if(skip.indexOf(q) >= 0) return;
      var geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      Object.keys(geo.attributes).forEach(function(n){ if(n !== 'position' && n !== 'normal') geo.deleteAttribute(n); });
      geo.groups = [];
      (buckets[m.material.uuid] = buckets[m.material.uuid] || { mat: m.material, geos: [] }).geos.push(geo); victims.push(m);
    });
    var made = [];
    Object.keys(buckets).forEach(function(k){ var b = buckets[k], merged = null; try { merged = U.mergeBufferGeometries(b.geos, false); } catch(e){} if(merged) made.push(new THREE.Mesh(merged, b.mat)); });
    if(made.length !== Object.keys(buckets).length || made.length >= victims.length) return;   // couldn't merge, or nothing to gain
    victims.forEach(function(m){ m.parent.remove(m); });
    made.forEach(function(mm){ grp.add(mm); });
  }

  // Sizes: a crab is fitted to a share of the guide's size (Wendy: about 70% of Shelly, a smaller friend), measured
  // by width as the camera sees it (side to side), so tall Hermit and wide Mochi come out equally big next to her.
  function reefCrabExtent(o){ var THREE = window.THREE, s = new THREE.Vector3(); o.updateMatrixWorld(true); new THREE.Box3().setFromObject(o).getSize(s); return s.x; }
  function reefCrabFit(crab, extent){ var now = reefCrabExtent(crab); if(now > 0) crab.scale.multiplyScalar(extent / now); }

  // Moves: Idle and Walk loop; Dance, Yes and Happy play once (seconds) and then return to Idle.
  var REEF_CRAB_ONCE = { Dance: 1.6, Yes: .9, Happy: .7 };
  function reefCrabPlay(crab, name, done){ crab.userData.anim = { name: name, t0: performance.now() / 1000 }; crab.userData.onDone = done || null; }
  function reefCrabAnimate(crab){
    var u = crab.userData, P = u.parts, a = u.anim, t = performance.now() / 1000, k = t - a.t0, len = REEF_CRAB_ONCE[a.name], p = len ? Math.min(1, k / len) : 0;
    if(len && p >= 1){ a = u.anim = { name: 'Idle', t0: t }; p = 0; if(u.onDone){ var f = u.onDone; u.onDone = null; f(); } }
    var by = 0, bry = 0, brz = 0, up = 0, wave = .06, waveSp = 1.6, swing = .05, legSp = 2;
    if(a.name === 'Walk'){ swing = .55; legSp = 18; by = Math.abs(Math.sin(t * 18)) * .035; brz = Math.sin(t * 9) * .06; wave = .1; waveSp = 9; }
    else if(a.name === 'Dance'){ by = Math.abs(Math.sin(p * Math.PI * 4)) * .28; bry = p * Math.PI * 2; up = .9; wave = .35; waveSp = 14; swing = .4; legSp = 14; }
    else if(a.name === 'Yes'){ by = Math.sin(p * Math.PI) * .22; up = .7 * Math.sin(p * Math.PI); }
    else if(a.name === 'Happy'){ brz = Math.sin(p * Math.PI * 6) * .18 * (1 - p); up = .5 * Math.sin(p * Math.PI); wave = .25; waveSp = 14; }
    else by = Math.sin(t * 2) * .02;
    P.body.position.y = by; P.body.rotation.set(0, bry, brz);
    P.claws.forEach(function(c, i){ var b = c.userData.base; c.rotation.set(b.x + Math.sin(t * waveSp + i * 1.7) * wave, b.y, b.z + c.userData.sd * up); });
    P.legs.forEach(function(l, i){ var b = l.userData.base; l.rotation.set(b.x + Math.sin(t * legSp + i * 1.3) * swing, b.y, b.z); });
    var blink = (t + u.seed) % 4.1 < .12 ? .1 : 1;
    P.eyes.forEach(function(e, i){ e.scale.y = blink; e.rotation.z = Math.sin(t * 1.3 + i) * .08; });
  }
  // Tapping the crab: it wiggles happily and scuttles off sideways; the other crab scuttles in from the other side.
  // host: { scene, crab, kit, leaving } (the board's view or the lobby's). Returns the new crab.
  function reefCrabSwap(host, from, dir){
    try { Sound.bloop(660, 0, .05); Sound.bloop(880, .1, .05); Sound.bloop(1100, .2, .05); } catch(e){}
    var old = host.crab, size = old.scale.x;
    reefCrabNow = reefCrabOther();
    var reuse = host.spareCrab && host.spareCrab.userData.kind === reefCrabNow, neu = reuse ? host.spareCrab : reefCrabBuild(reefCrabNow, host.kit.grad, size);
    if(!reuse && host.crabFit){ neu.position.set(0, 0, 0); neu.rotation.set(0, 0, 0); reefCrabFit(neu, host.crabFit); }
    host.spareCrab = old; host.crab = neu;
    neu.rotation.y = 0; reefCrabPlay(neu, 'Idle');
    if(reefCalm()){ host.scene.remove(old); neu.position.copy(old.position); host.scene.add(neu); return neu; }
    reefCrabPlay(old, 'Happy');
    old.userData.leave = { at: performance.now() / 1000 + .7, dir: dir, gone: 0 };
    host.leaving = old;
    neu.position.set(from.x, 0, from.z); neu.userData.entering = true; host.scene.add(neu);
    return neu;
  }
  // Every frame: the crab that is leaving scuttles away and is put aside once it is far enough.
  function reefCrabLeaveTick(host, dt){
    var c = host.leaving; if(!c) return;
    var lv = c.userData.leave, t = performance.now() / 1000;
    if(t >= lv.at){
      if(c.userData.anim.name !== 'Walk') reefCrabPlay(c, 'Walk');
      c.rotation.y = 0; var step = dt * 4.5; c.position.x += lv.dir * step; lv.gone += step;
      if(lv.gone > 9){ host.scene.remove(c); c.userData.leave = null; host.leaving = null; return; }
    }
    reefCrabAnimate(c);
  }
  /* ---------- Food for Shelly (by day) and Lumi (at night) on the profile screen ----------
     Each tap drops one food, picked by chance; Wendy chose the odds. Rare foods get a special reaction when eaten
     (see reefLobbyFrame): the star treat makes her twirl in a burst of sparkles, the jellyfish gives a small sparkle.
     The super rare plastic bag (1 in 2,000, Wendy's idea) is not food: she shakes her head, it floats away, and a
     note asks to keep the ocean clean (reefLobbyRefuse).
     At night every food glows softly. Each design is about 0.4 units across, centred on its origin. */
  var REEF_FOODS = [['flakes', 44.95], ['leaf', 27], ['shrimp', 15], ['jelly', 11], ['star', 2], ['bag', .05]];   // percent
  var reefFoodForce = null;
  window.__reefFoodForce = function(k){ reefFoodForce = k; };   // test helper: the next drop is this food
  window.__reefFoodOdds = function(n){ var c = {}; for(var i = 0; i < n; i++){ var k = reefFoodPick(); c[k] = (c[k] || 0) + 1; } return c; };   // test helper
  function reefFoodPick(){
    if(reefFoodForce){ var f = reefFoodForce; reefFoodForce = null; return f; }
    var roll = Math.random() * 100;
    for(var i = 0; i < REEF_FOODS.length; i++){ roll -= REEF_FOODS[i][1]; if(roll < 0) return REEF_FOODS[i][0]; }
    return REEF_FOODS[0][0];
  }
  function reefFoodBuild(name, grad, night){
    var THREE = window.THREE, mats = {}, g = new THREE.Group(), glow = null;
    function M(c, o){ var k = c + JSON.stringify(o || {}); return mats[k] || (mats[k] = new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: grad }, night ? { emissive: new THREE.Color(c).multiplyScalar(.45) } : {}, o || {}))); }
    function add(geo, mat, x, y, z, sx, sy, sz, parent){ var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx || 1, sy || 1, sz || 1); (parent || g).add(m); return m; }
    var parts = [];
    if(name === 'jelly'){         // a tiny pink jellyfish: a soft bell and five beaded tentacles
      add(new THREE.SphereGeometry(.17, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#ff9ec7', { transparent: true, opacity: .9, side: THREE.DoubleSide }), 0, .02, 0, 1, .85, 1);
      add(new THREE.SphereGeometry(.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#ffd1e6'), 0, .03, 0, 1, .9, 1);
      for(var i = 0; i < 5; i++){
        var a = i / 5 * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * .1, .02, Math.sin(a) * .1); g.add(t); parts.push(t);
        for(var k = 0; k < 4; k++) add(new THREE.SphereGeometry(.025, 8, 6), M('#ff7fb6'), Math.sin(k * 1.4 + i) * .02, -.04 - k * .055, 0, 1, 1.3, 1, t);
      }
      glow = '#ff9ec7';
    } else if(name === 'leaf'){   // a curly seaweed leaf with a stem and a middle vein
      var leaf = new THREE.Group(); leaf.rotation.set(.5, .4, .3); g.add(leaf); parts.push(leaf);
      var lg = new THREE.SphereGeometry(.2, 18, 12); lg.scale(1, .16, .55);
      var pos = lg.attributes.position; for(var v = 0; v < pos.count; v++){ var x = pos.getX(v); pos.setY(v, pos.getY(v) + x * x * 1.2 + Math.sin(x * 18) * .012); }
      lg.computeVertexNormals(); add(lg, M('#5fbf6a'), 0, 0, 0, 1, 1, 1, leaf);
      add(new THREE.CylinderGeometry(.008, .012, .4, 6), M('#3f9450'), 0, .03, 0, 1, 1, 1, leaf).rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(.012, .012, .08, 6), M('#3f9450'), -.23, .07, 0, 1, 1, 1, leaf).rotation.z = 1;
      glow = '#7ff09a';
    } else if(name === 'shrimp'){ // a curled pink shrimp with a fan tail, an eye and two feelers
      var sh = new THREE.Group(); sh.rotation.set(.3, -.4, 0); g.add(sh); parts.push(sh);
      for(var s = 0; s < 6; s++){ var a2 = Math.PI * .15 + s / 5 * Math.PI * 1.05; add(new THREE.SphereGeometry(.055 - s * .006, 12, 8), M(s % 2 ? '#ff9a7a' : '#ff8a68'), Math.cos(a2) * .12, Math.sin(a2) * .12, 0, 1, 1, 1.1, sh); }
      var fan = new THREE.Shape(); fan.moveTo(0, 0); fan.lineTo(-.06, .07); fan.quadraticCurveTo(0, .1, .06, .07); fan.lineTo(0, 0);
      add(new THREE.ShapeGeometry(fan), M('#ffb39a', { side: THREE.DoubleSide }), Math.cos(Math.PI * 1.25) * .12, Math.sin(Math.PI * 1.25) * .12, 0, 1, 1, 1, sh).rotation.z = -2.4;
      var hx = Math.cos(Math.PI * .15) * .12, hy = Math.sin(Math.PI * .15) * .12;
      add(new THREE.SphereGeometry(.018, 8, 6), new THREE.MeshBasicMaterial({ color: '#1d2a33' }), hx + .02, hy + .03, .04, 1, 1, 1, sh);
      [0, 1].forEach(function(q){ add(new THREE.CylinderGeometry(.004, .004, .18, 4), M('#ff8a68'), hx + .08, hy + .06, q * .03 - .015, 1, 1, 1, sh).rotation.z = -.9 - q * .3; });
      glow = '#ffb39a';
    } else if(name === 'star'){   // the rare one: a golden star cookie with a sugar drop in the middle
      var st = new THREE.Shape(); for(var k2 = 0; k2 < 10; k2++){ var a3 = k2 / 10 * Math.PI * 2 + Math.PI / 2, rr = k2 % 2 ? .08 : .19; st[k2 ? 'lineTo' : 'moveTo'](Math.cos(a3) * rr, Math.sin(a3) * rr); }
      var sg = new THREE.ExtrudeGeometry(st, { depth: .05, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 3 }); sg.center();
      var cookie = new THREE.Group(); g.add(cookie); parts.push(cookie);
      add(sg, M('#ffc94d'), 0, 0, 0, 1, 1, 1, cookie).rotation.x = -.3;
      add(new THREE.SphereGeometry(.045, 12, 8), M('#fff4c2'), 0, .01, .055, 1, 1, .5, cookie);
      glow = '#ffe27a';
    } else if(name === 'bag'){    // the super rare plastic bag: see-through and crinkled, with two handles
      var bag = new THREE.Group(); bag.rotation.set(.2, .5, .25); g.add(bag); parts.push(bag);
      var bm = M('#f3f8fb', { transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false });
      var tube = new THREE.CylinderGeometry(.13, .16, .26, 16, 5, true), tp = tube.attributes.position;
      for(var w = 0; w < tp.count; w++){ var wx = tp.getX(w), wy = tp.getY(w), wz = tp.getZ(w), cr = 1 + Math.sin(wy * 40 + Math.atan2(wz, wx) * 5) * .07; tp.setX(w, wx * cr); tp.setZ(w, wz * cr); }
      tube.computeVertexNormals(); add(tube, bm, 0, 0, 0, 1, 1, .55, bag);
      add(new THREE.SphereGeometry(.16, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bm, 0, -.13, 0, 1, .3, .55, bag);
      [-1, 1].forEach(function(q){ add(new THREE.TorusGeometry(.05, .012, 6, 14, Math.PI), bm, q * .075, .13, 0, 1, 1, 1, bag); });
      glow = '#dfeff5';
    } else {                      // food flakes: three thin flakes that tumble on their own
      [['#ff9a4d', -.09, .05, .02, .6], ['#ffd35c', .08, -.02, -.03, -.5], ['#79c96a', 0, -.1, .05, 1.2]].forEach(function(f){
        var m = add(new THREE.CylinderGeometry(.09, .09, .02, 7), M(f[0]), f[1], f[2], f[3]); m.rotation.set(f[4], f[4] * .7, f[4] * .4); parts.push(m); });
      name = 'flakes'; glow = '#ffd35c';
    }
    if(night || name === 'star'){   // a soft halo: every food at night, and the star treat by day too
      var c = document.createElement('canvas'); c.width = c.height = 64; var cx = c.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: glow, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(.55); g.add(halo); g.userData.halo = halo;
    }
    g.userData.kind = name; g.userData.parts = parts; g.userData.ph = Math.random() * 6;
    return g;
  }
  // While it sinks, each food moves in its own way: the jellyfish pulses, the leaf flutters, flakes tumble.
  function reefFoodIdle(f, t, dt){
    var u = f.userData, P = u.parts, ph = u.ph;
    if(u.kind === 'jelly'){ var pulse = Math.sin(t * 4 + ph); f.scale.y = f.userData.base * (1 + pulse * .1); P.forEach(function(tn, i){ tn.rotation.x = Math.sin(t * 4 + ph + i) * .25; }); }
    else if(u.kind === 'leaf'){ P[0].rotation.z = .3 + Math.sin(t * 2.2 + ph) * .5; f.position.x += Math.cos(t * 2.2 + ph) * dt * .25; }
    else if(u.kind === 'shrimp'){ P[0].rotation.z = Math.sin(t * 6 + ph) * .12; f.rotation.y += dt * .6; }
    else if(u.kind === 'bag'){ P[0].rotation.z = .25 + Math.sin(t * 1.3 + ph) * .3; P[0].scale.x = 1 + Math.sin(t * 2 + ph) * .08; f.position.x += Math.cos(t * 1.3 + ph) * dt * .15; }
    else if(u.kind === 'star'){ f.rotation.y += dt * 1.6; if(u.halo) u.halo.material.opacity = .3 + Math.sin(t * 5 + ph) * .12; }
    else P.forEach(function(m, i){ m.rotation.x += dt * (1.2 + i * .5); m.rotation.z += dt * (.8 + i * .3); });
  }
  // A burst of little stars where a rare food was eaten (big for the star treat, small for the jellyfish).
  function reefFoodSparkle(view, pos, big){
    var THREE = window.THREE, shape = new THREE.Shape(), stars = [], n = big ? 12 : 6;
    for(var k = 0; k < 10; k++){ var a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? .05 : .13; shape[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    var geo = new THREE.ShapeGeometry(shape), mat = new THREE.MeshBasicMaterial({ color: big ? '#ffd76a' : '#ffb3d6', transparent: true, side: THREE.DoubleSide, depthWrite: false });
    for(var i = 0; i < n; i++){
      var m = new THREE.Mesh(geo, mat), a2 = i / n * Math.PI * 2;
      m.userData.v = new THREE.Vector3(Math.cos(a2), Math.sin(a2), (Math.random() - .5) * .6).multiplyScalar(big ? 1.6 : 1);
      m.position.copy(pos); view.scene.add(m); stars.push(m);
    }
    (view.fx = view.fx || []).push({ t0: performance.now(), dur: big ? 1100 : 800,
      step: function(p){ stars.forEach(function(m){ m.position.copy(pos).addScaledVector(m.userData.v, Math.sin(p * Math.PI / 2)); m.lookAt(view.cam.position); m.rotation.z = p * 5; m.scale.setScalar(1 - p * .6); }); mat.opacity = 1 - p * p; },
      end: function(){ stars.forEach(function(m){ view.scene.remove(m); }); geo.dispose(); mat.dispose(); } });
  }
