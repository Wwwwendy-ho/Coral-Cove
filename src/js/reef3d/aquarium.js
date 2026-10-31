  /* ---------- My Aquarium in 3D: every sea friend she has found lives in the tank, like Shelly on the profile
     screen. Swimmers wander and turn toward where they're going, bottom-dwellers walk the sand, jellyfish pulse
     and drift, the otter floats on its back. Tap a friend: it spins and hops (the pufferfish puffs up) and its fact
     is read. Tap the water: food drops and the nearest swimmer races over to eat it. If 3D can't start, the flat
     aquarium (reefCollection's own HTML) stays. ---------- */
  var AQ = { view: null };
  function reefAquarium3D(host, found, onTap){
    if(!host || R3.failed || !found.length) return;
    var go = function(models){
      if(!document.body.contains(host)) return;
      try {
        var view = reefAqBuild(host, found, models, onTap);
        AQ.view = view; host.classList.add('is-3d'); host.appendChild(view.canvas);
        reefAqLoop(view);
      } catch(err){ try { console.warn('3D aquarium turned off:', err); } catch(e){} }
    };
    if(window.THREE && R3.modelsReady) return go(R3.modelsReady);
    reef3dLoad().then(function(){ return reef3dModels(); }).then(go, function(){});
  }

  // One sea friend, built in the board's cartoon style, facing +z. userData: how it moves (kind), how big it is,
  // and an anim(t, moving) that wags its tail, flaps its flippers or waves its tentacles.
  function reefAqCreature(id, kit, models, night){
    var THREE = window.THREE, M = kit.M, mesh = kit.mesh, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    function sph(r, w, h){ return new THREE.SphereGeometry(r, w || 18, h || 12); }
    function eyes(r, x, y, z, parent){
      [-1, 1].forEach(function(sd){
        var e = mesh(sph(r, 14, 10), M('#ffffff'), sd * x, y, z); (parent || body).add(e);
        e.add(mesh(sph(r * .6, 12, 8), M('#14232a'), 0, 0, r * .5));
        var gl = new THREE.Mesh(sph(r * .2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); gl.position.set(r * .2, r * .25, r * 1.02); e.add(gl);
      });
    }
    function tentacles(n, len, r, col, y, spread, parent){   // chains of tapering pieces, so they can curl
      var arms = [];
      for(var i = 0; i < n; i++){
        var a = i / n * Math.PI * 2, root = new THREE.Group(); root.position.set(Math.cos(a) * spread, y, Math.sin(a) * spread); root.rotation.y = -a; (parent || body).add(root);
        var seg = root, segs = [];
        for(var k = 0; k < 4; k++){
          var sl = len / 4, piece = new THREE.Group(); piece.position.y = k ? -sl : 0; seg.add(piece);
          piece.add(mesh(new THREE.CylinderGeometry(r * (1 - k * .2), r * (1 - (k + 1) * .2), sl, 8), M(col), 0, -sl / 2, 0)); seg = piece; segs.push(piece);
        }
        arms.push({ root: root, segs: segs, ph: i * .9 });
      }
      return arms;
    }
    var u = { kind: 'swim', size: 1, speed: 1.2, y: [1.2, 5.4], anim: function(){} };
    var fishModel = function(name, h, tint){
      var fm = reef3dModel(models, name, h, kit.grad, tint); if(!fm) return false;
      body.add(fm);
      var clip = fm.userData.gltf.animations && fm.userData.gltf.animations[0];
      if(clip){ var mx = new THREE.AnimationMixer(fm.userData.root), ac = mx.clipAction(clip); ac.play(); ac.time = Math.random() * clip.duration; u.mixer = mx; }
      return true;
    };
    switch(id){
      case 'fish': if(!fishModel('fish1', .55)) body.add(mesh(sph(.3), M('#6fb7e0'))); u.speed = 1.8; break;
      case 'tropical': if(!fishModel('fish2', .6, '#ffd166')) body.add(mesh(sph(.3), M('#ffd166'))); u.speed = 1.7; break;
      case 'dolphin': if(!fishModel('dolphin', .9)) body.add(mesh(sph(.5), M('#7aa7c7'))); u.speed = 2.2; u.size = 2.2; u.y = [2, 5]; break;
      case 'shark': if(!fishModel('dolphin', .95, '#7d8a96')) body.add(mesh(sph(.5), M('#7d8a96'))); u.speed = 1.7; u.size = 2.3; u.y = [1.6, 4.5];
        body.add(mesh(new THREE.ConeGeometry(.22, .55, 4), M('#6b7884'), 0, 1.0, 0)); break;   // a taller fin than the dolphin's
      case 'humpback': if(!fishModel('whale', .95, '#556a80')) body.add(mesh(sph(.9), M('#556a80'))); u.speed = .9; u.size = 2.6; u.y = [3, 5.4]; break;
      case 'bluewhale': if(!fishModel('whale', 1.15, '#5b86c4')) body.add(mesh(sph(1), M('#5b86c4'))); u.speed = .8; u.size = 2.8; u.y = [3.4, 5.6]; break;
      case 'turtle': {
        var sh = reef3dKit(THREE, false).B.guide(); sh.scale.setScalar(.55); body.add(sh); u.speed = 1.1; u.size = 1.6;
        var parts = sh.userData.parts || {};
        u.anim = function(t, mv){ (parts.flippers || []).forEach(function(f, i){ var s = mv ? 7 : 2.2, a = mv ? .5 : .2; f.rotation.y = f.userData.side * Math.sin(t * s + (f.userData.front ? 0 : 1.6)) * a; }); };
        break; }
      case 'puffer': {
        body.add(mesh(sph(.42, 20, 14), M('#f2c46b'))); var belly = mesh(sph(.38), M('#fff3c8'), 0, -.1, .06); belly.scale.set(.9, .7, .9); body.add(belly);
        for(var p = 0; p < 22; p++){ var th = Math.acos(1 - 2 * (p + .5) / 22), ph = p * 2.4, sp = mesh(new THREE.ConeGeometry(.04, .16, 5), M('#c99a3e')); var dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); sp.position.copy(dir.clone().multiplyScalar(.42)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); body.add(sp); }
        eyes(.1, .2, .12, .32);
        var tail = mesh(new THREE.ConeGeometry(.14, .26, 4), M('#e2a94a'), 0, 0, -.5); tail.rotation.x = -Math.PI / 2; body.add(tail);
        u.speed = .9; u.anim = function(t){ tail.rotation.y = Math.sin(t * 8) * .5; }; u.puff = true; break; }
      case 'octopus': {
        var head = mesh(sph(.42, 20, 14), M('#c46fd6'), 0, .45, 0); head.scale.set(1, 1.2, 1); body.add(head); eyes(.1, .18, .35, .33);
        var arms = tentacles(8, .9, .08, '#b45ec4', .1, .22); u.kind = 'bottomSwim'; u.speed = .8; u.y = [.4, 2.6];
        u.anim = function(t){ arms.forEach(function(a){ a.segs.forEach(function(s, k){ s.rotation.x = Math.sin(t * 2.4 + a.ph + k * .6) * .35 + .25; }); }); }; break; }
      case 'jelly': {
        var bell = mesh(new THREE.SphereGeometry(.45, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#ff9ad8', night ? { emissive: '#ff5fc8', emissiveIntensity: .8, transparent: true, opacity: .8 } : { transparent: true, opacity: .8 })); body.add(bell);
        var jarms = tentacles(7, 1.1, .03, '#ffc2e8', 0, .25); u.kind = 'drift'; u.speed = .35; u.y = [2, 5];
        u.anim = function(t){ var p = Math.sin(t * 2.2); bell.scale.set(1 + p * .1, 1 - p * .12, 1 + p * .1); jarms.forEach(function(a){ a.segs.forEach(function(s, k){ s.rotation.x = Math.sin(t * 2 + a.ph + k) * .25; }); }); }; break; }
      case 'squid': {
        var mantle = mesh(new THREE.ConeGeometry(.22, .9, 14), M('#f0a58c'), 0, 0, -.25); mantle.rotation.x = -Math.PI / 2; body.add(mantle);
        [-1, 1].forEach(function(sd){ var fin = mesh(new THREE.ConeGeometry(.14, .3, 3), M('#e58e75'), sd * .2, 0, -.6); fin.rotation.z = sd * Math.PI / 2; body.add(fin); });
        eyes(.08, .14, .06, .25);
        var sarms = tentacles(6, .6, .035, '#e58e75', 0, .1); sarms.forEach(function(a){ a.root.rotation.x = -Math.PI / 2; a.root.position.z = .25; });
        u.speed = 1.5; u.anim = function(t){ sarms.forEach(function(a){ a.segs.forEach(function(s, k){ s.rotation.x = Math.sin(t * 5 + a.ph + k) * .3; }); }); }; break; }
      case 'crab': {
        var crab = reefCrabBuild('mochi', kit.grad, .55); body.add(crab); u.kind = 'bottom'; u.speed = .7; u.crab = crab;
        u.anim = function(t, mv){ var want = mv ? 'Walk' : 'Idle'; if(!crab.userData.anim || crab.userData.anim.name !== want){ try { reefCrabPlay(crab, want); } catch(e){} } try { reefCrabAnimate(crab); } catch(e){} }; break; }
      case 'lobster': {
        var red = M('#d8483a');
        for(var s2 = 0; s2 < 5; s2++){ var seg = mesh(sph(.2 - s2 * .025), red, 0, .2, .25 - s2 * .2); seg.scale.set(1, .75, 1.1); body.add(seg); }
        var fan = mesh(new THREE.ConeGeometry(.2, .2, 5), red, 0, .2, -.78); fan.rotation.x = Math.PI / 2; body.add(fan);
        var claws = [-1, 1].map(function(sd){ var arm = new THREE.Group(); arm.position.set(sd * .18, .22, .38); body.add(arm);
          arm.add(mesh(new THREE.CylinderGeometry(.04, .04, .35, 6), red, 0, 0, .16)).rotation.x = Math.PI / 2;
          var cl = mesh(sph(.13), red, 0, 0, .4); cl.scale.set(.8, .6, 1.3); arm.add(cl); return arm; });
        [-1, 1].forEach(function(sd){ var an = mesh(new THREE.CylinderGeometry(.012, .012, .8, 4), red, sd * .08, .45, .7); an.rotation.x = 1.1; an.rotation.z = sd * .3; body.add(an); });
        eyes(.05, .07, .32, .45); u.kind = 'bottom'; u.speed = .5;
        u.anim = function(t){ claws.forEach(function(c, i){ c.rotation.y = Math.sin(t * 2 + i * 2) * .25; }); fan.rotation.y = Math.sin(t * 3) * .2; }; break; }
      case 'shrimp': {
        var pk = M('#ff9d8a'), segs = [];
        for(var s3 = 0; s3 < 6; s3++){ var sg = mesh(sph(.12 - s3 * .012), pk, 0, .25 + Math.sin(s3 * .5) * .12, .25 - s3 * .12); body.add(sg); segs.push(sg); }
        [-1, 1].forEach(function(sd){ var an2 = mesh(new THREE.CylinderGeometry(.008, .008, .7, 4), pk, sd * .05, .4, .55); an2.rotation.x = 1.2; body.add(an2); });
        eyes(.035, .05, .3, .32); u.kind = 'bottomSwim'; u.speed = 1; u.y = [.3, 1.6];
        u.anim = function(t){ segs.forEach(function(sg2, k){ sg2.position.y = .25 + Math.sin(k * .5 + t * 6) * .04 + Math.sin(k * .5) * .12; }); }; break; }
      case 'shell': {
        var cone = mesh(new THREE.ConeGeometry(.3, .7, 16), M('#f6d6c2'), 0, .3, 0); cone.rotation.x = -Math.PI / 2 + .3; body.add(cone);
        for(var rr = 0; rr < 4; rr++){ var ring = mesh(new THREE.TorusGeometry(.26 - rr * .055, .035, 6, 18), M('#e9a98f'), 0, .3 + rr * .03, -.22 + rr * .16); body.add(ring); }
        u.kind = 'still'; break; }
      case 'coral': { var c2 = kit.B.staghorn ? kit.B.staghorn(Math.random) : kit.B.fan(); c2.scale.setScalar(.6); body.add(c2); u.kind = 'still'; break; }
      case 'oyster': {
        var clam = kit.B.clam(); clam.scale.setScalar(.6); body.add(clam); u.kind = 'still';
        var lid = clam.userData.lid; u.anim = function(t){ if(lid) lid.rotation.x = -Math.max(0, Math.sin(t * .8)) * .7; }; break; }
      case 'seal': case 'otter': {
        var col = id === 'seal' ? '#8d9aa6' : '#7a5a3e', light = id === 'seal' ? '#c2ccd5' : '#c8a27a';
        var trunk = mesh(sph(.35, 18, 12), M(col), 0, 0, 0); trunk.scale.set(.9, .85, 1.7); body.add(trunk);
        var hd = mesh(sph(.28), M(col), 0, .12, .62); body.add(hd); var muzzle = mesh(sph(.13), M(light), 0, .06, .85); body.add(muzzle);
        body.add(mesh(sph(.05, 8, 6), M('#14232a'), 0, .1, .97)); eyes(.06, .12, .22, .78);
        var flips = [-1, 1].map(function(sd){ var f = mesh(sph(.14), M(col), sd * .3, -.12, .25); f.scale.set(.4, .25, 1); body.add(f); return f; });
        var tl = mesh(sph(.15), M(col), 0, 0, -.65); tl.scale.set(1.3, .25, .8); body.add(tl);
        u.speed = id === 'seal' ? 1.8 : .5; u.size = 1.6;
        if(id === 'otter'){ u.kind = 'float'; u.y = [5.4, 5.6]; body.rotation.x = 0; g.userData.onBack = true; trunk.material = M('#7a5a3e'); var bel = mesh(sph(.3), M(light), 0, .14, 0); bel.scale.set(.8, .5, 1.4); body.add(bel); }
        u.anim = function(t){ flips.forEach(function(f, i){ f.rotation.z = Math.sin(t * 5 + i * Math.PI) * .4; }); tl.rotation.y = Math.sin(t * 4) * .4; }; break; }
      case 'penguin': {
        var pb = mesh(sph(.35, 18, 12), M('#1f2a33'), 0, 0, 0); pb.scale.set(.85, .85, 1.6); body.add(pb);
        var pw = mesh(sph(.3), M('#f4f4f0'), 0, -.12, .12); pw.scale.set(.75, .6, 1.4); body.add(pw);
        body.add(mesh(sph(.24), M('#1f2a33'), 0, .1, .55)); var beak = mesh(new THREE.ConeGeometry(.06, .2, 6), M('#f2a33a'), 0, .08, .82); beak.rotation.x = Math.PI / 2; body.add(beak);
        eyes(.05, .1, .2, .7);
        var wings = [-1, 1].map(function(sd){ var w2 = mesh(sph(.16), M('#1f2a33'), sd * .32, 0, .1); w2.scale.set(.25, .2, 1); body.add(w2); return w2; });
        u.speed = 2.4; u.anim = function(t, mv){ wings.forEach(function(w2, i){ w2.rotation.z = (i ? -1 : 1) * Math.sin(t * (mv ? 12 : 4)) * .6; }); }; break; }
      default: body.add(mesh(sph(.3), M('#9ad3e0')));
    }
    if(id !== 'turtle') reef3dOutline(g, night ? '#173d5c' : '#1f3a2c', .04);
    g.userData = u; u.body = body; u.id = id;
    return g;
  }

  function reefAqBuild(host, found, models, onTap){
    var THREE = window.THREE, night = reefNight(), r = reefRand(7);
    var canvas = document.createElement('canvas'); canvas.className = 'aq-canvas'; canvas.setAttribute('aria-hidden', 'true');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: innerWidth * innerHeight <= 700000, alpha: true, powerPreference: 'low-power' });
    var scene = new THREE.Scene(), fogCol = night ? '#0b2d3a' : '#3fa6b8'; scene.fog = new THREE.Fog(fogCol, 10, 26);
    var cam = new THREE.PerspectiveCamera(45, 1, .1, 60); cam.position.set(0, 1.6, 12); cam.lookAt(0, 3.3, -1);
    var kit = reef3dKit(THREE, night), B = kit.B;
    scene.add(new THREE.HemisphereLight(night ? '#7fb6c4' : '#fff6e2', night ? '#0b1e26' : '#3f7f88', night ? .7 : .65));
    var sun = new THREE.DirectionalLight(night ? '#a9e6ff' : '#fff1d2', night ? .6 : .8); sun.position.set(5, 14, 8); scene.add(sun);
    // the sand floor, with the same drifting light as the board
    var floorGeo = new THREE.PlaneGeometry(30, 18, 30, 18), pos = floorGeo.attributes.position;
    for(var v = 0; v < pos.count; v++){ var fx = pos.getX(v), fy = pos.getY(v); pos.setZ(v, Math.sin(fx * .5) * .12 + Math.cos(fy * .4 + fx * .2) * .12 + Math.max(0, fy - 3) * .25); }
    floorGeo.computeVertexNormals();
    var floor = new THREE.Mesh(floorGeo, kit.M(night ? '#4b5a52' : '#d9bf86')); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -2); scene.add(floor);
    function groundY(){ return .05; }
    // scenery round the back and sides, leaving the middle open for swimming
    var setD = night ? ['kelp', 'rock', 'coralBall', 'plank'] : ['kelp', 'coralBall', 'staghorn', 'rock', 'kelp', 'fan'];
    for(var n = 0; n < 22; n++){
      var side = n % 2 ? 1 : -1, sx = side * (5 + r() * 3.5), sz = -6 + r() * 6; if(n > 15){ sx = (r() - .5) * 12; sz = -7 - r() * 2; }
      var nm = setD[Math.floor(r() * setD.length)], d = B[nm] ? B[nm](r) : null; if(!d) continue;
      d.position.set(sx, 0, sz); d.rotation.y = r() * 6; d.scale.multiplyScalar(.6 + r() * .6); scene.add(d);
    }
    // aquarium gravel: small coloured pebbles over the front of the sand
    var pebG = new THREE.DodecahedronGeometry(.12, 0), pebCols = night ? ['#5d6f6a', '#4a5a66', '#6a5a72', '#3f5a52'] : ['#f2a3a0', '#9fd6e8', '#f6e0a8', '#c9b6f0', '#ffffff', '#a8dcb0'];
    for(var pb = 0; pb < 70; pb++){ var pe = new THREE.Mesh(pebG, kit.M(pebCols[pb % pebCols.length])); pe.position.set((r() - .5) * 16, .05, -1 + r() * 7); pe.scale.set(1 + r(), .6, 1 + r()); pe.rotation.y = r() * 6; scene.add(pe); }
    var chest = reef3dModel(models, 'chest', .9, kit.grad); if(chest){ chest.position.set(3.4, 0, -3.5); chest.rotation.y = -.5; scene.add(chest); }
    // rising bubbles
    var bubG = new THREE.SphereGeometry(.07, 8, 6), bubM = new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: .55, depthWrite: false }), bubbles = [];
    for(var b = 0; b < 26; b++){ var bb = new THREE.Mesh(bubG, bubM); bb.position.set((r() - .5) * 12, r() * 7, -4 + r() * 4); bb.scale.setScalar(.5 + r()); bb.userData.sp = .5 + r() * .7; scene.add(bb); bubbles.push(bb); }
    // the friends
    var friends = found.map(function(f, i){
      var c = reefAqCreature(f.id, kit, models, night), u = c.userData;
      var still = u.kind === 'still', ground = u.kind === 'bottom' || still;
      c.position.set((r() - .5) * 11, ground ? groundY() : u.y[0] + r() * (u.y[1] - u.y[0]), -4.5 + r() * 5);   // spread through the tank from the start
      if(still){ c.position.x = -5.5 + ((i * 3.7) % 11); c.position.z = -1.5 - r() * 3; c.rotation.y = r() * 6; }
      u.target = c.position.clone(); u.wanderAt = 0; u.vel = 0; u.friend = f;
      scene.add(c); return c;
    });
    var view = { canvas: canvas, renderer: renderer, scene: scene, cam: cam, night: night, kit: kit, friends: friends, bubbles: bubbles, food: [], t0: performance.now(), lastT: performance.now(), host: host };
    // taps: a friend (or close to one) spins and its fact is read; otherwise food drops into the water
    var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1), hit = new THREE.Vector3();
    canvas.addEventListener('click', function(e){
      var rc = canvas.getBoundingClientRect();
      ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ptr, cam);
      var best = null, bd = 70;
      friends.forEach(function(c){
        if(ray.intersectObject(c, true).length){ best = c; bd = 0; return; }
        var p = c.position.clone().add(new THREE.Vector3(0, .3, 0)).project(cam), dd = Math.hypot((p.x + 1) / 2 * rc.width + rc.left - e.clientX, (1 - p.y) / 2 * rc.height + rc.top - e.clientY);
        if(dd < bd){ bd = dd; best = c; }
      });
      if(best){ best.userData.happyAt = performance.now(); if(onTap) onTap(best.userData.id); return; }
      if(!ray.ray.intersectPlane(plane, hit)) return;
      hit.x = Math.max(-6, Math.min(6, hit.x)); hit.y = Math.max(1.5, Math.min(6, hit.y));
      var kind = reefFoodPick(); if(kind === 'bag') kind = 'flakes';   // the plastic bag is the profile screen's lesson; here it's always food
      var pellet; try { pellet = reefFoodBuild(kind, kit.grad, night); } catch(err){ pellet = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), kit.M('#c98a4a')); }
      pellet.position.copy(hit); scene.add(pellet); view.food.push(pellet);
      if(view.food.length > 5){ scene.remove(view.food.shift()); }
      try { Sound.unlock(); Sound.bloop(760, 0, .04); } catch(err){}
    });
    return view;
  }

  function reefAqFrame(view, now){
    var calm = reefCalm(), t = (now - view.t0) / 1000, dt = Math.min(.05, Math.max(0, (now - view.lastT) / 1000)); view.lastT = now;
    var w = view.host.clientWidth || 1, h = view.host.clientHeight || 1;
    if(view.w !== w || view.h !== h){ view.w = w; view.h = h; view.renderer.setSize(w, h, false); view.cam.aspect = w / h; view.cam.fov = w / h < .8 ? 58 : 45; view.cam.updateProjectionMatrix(); }
    // the food goes to the nearest swimmer that isn't already busy eating
    view.food.forEach(function(f){
      if(f.position.y > .3) f.position.y -= dt * .35;
      if(f.userData.eater && view.friends.indexOf(f.userData.eater) >= 0) return;
      var best = null, bd = 1e9;
      view.friends.forEach(function(c){ var u = c.userData; if(u.kind === 'still' || u.kind === 'bottom' || u.meal) return; var dd = c.position.distanceTo(f.position); if(dd < bd){ bd = dd; best = c; } });
      if(best){ f.userData.eater = best; best.userData.meal = f; }
    });
    view.friends.forEach(function(c){
      var u = c.userData, moving = false;
      if(u.kind !== 'still' && !calm){
        if(u.meal && view.food.indexOf(u.meal) < 0) u.meal = null;
        if(u.meal) u.target.copy(u.meal.position);
        else if(now > u.wanderAt){
          var gy = u.kind === 'bottom' ? .05 : u.y[0] + Math.random() * (u.y[1] - u.y[0]);
          var span = u.kind === 'float' ? 5 : u.size > 2 ? 4.5 : 6;
          u.target.set((Math.random() - .5) * span * 2, gy, -5 + Math.random() * 5);
          u.wanderAt = now + (u.kind === 'drift' ? 6000 : 3000) + Math.random() * 4000;
        }
        var to = u.target.clone().sub(c.position), dist = to.length();
        if(dist > .08){
          var sp = (u.meal ? u.speed * 2.2 : u.speed) * dt;
          c.position.add(to.multiplyScalar(Math.min(1, sp / dist))); moving = dist > .3;
          if(u.kind !== 'drift'){ var want = Math.atan2(u.target.x - c.position.x, u.target.z - c.position.z), dA = ((want - c.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; c.rotation.y += dA * Math.min(1, dt * 3); }
        }
        if(u.meal && c.position.distanceTo(u.meal.position) < .45 + u.size * .15){   // gulp
          view.scene.remove(u.meal); view.food.splice(view.food.indexOf(u.meal), 1); u.meal = null; u.gulpAt = now;
          try { Sound.bloop(420, 0, .06); } catch(e){}
        }
      }
      // body motion: a gentle bob, the happy spin and hop when tapped, a puff for the pufferfish, a gulp
      var body = u.body, hp = u.happyAt ? Math.min(1, (now - u.happyAt) / 900) : 1;
      if(!calm){
        body.position.y = (u.kind === 'bottom' || u.kind === 'still' ? 0 : Math.sin(t * 1.8 + c.id) * .12) + (hp < 1 ? Math.sin(hp * Math.PI) * .6 : 0);
        body.rotation.y = hp < 1 ? (1 - Math.pow(1 - hp, 3)) * Math.PI * 2 : 0;
        if(c.userData.onBack){ body.rotation.z = Math.PI; body.position.y += .2; }
        var gs = u.gulpAt && now - u.gulpAt < 300 ? 1 + Math.sin((now - u.gulpAt) / 300 * Math.PI) * .2 : 1;
        var puff = u.puff && hp < 1 ? 1 + Math.sin(hp * Math.PI) * .45 : 1;
        body.scale.setScalar(gs * puff);
        u.anim(t, moving);
        if(u.mixer) u.mixer.update(dt * (moving ? 1.4 : .8));
      } else if(c.userData.onBack) body.rotation.z = Math.PI;
    });
    if(!calm) view.bubbles.forEach(function(b){ b.position.y += dt * b.userData.sp; if(b.position.y > 7.5){ b.position.y = 0; } b.position.x += Math.sin(t * 2 + b.position.y) * .003; });
    view.renderer.render(view.scene, view.cam);
  }
  function reefAqLoop(view){
    function tick(now){
      if(!document.body.contains(view.canvas)){ view.renderer.dispose(); if(AQ.view === view) AQ.view = null; return; }
      if(!document.hidden) reefAqFrame(view, now);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
