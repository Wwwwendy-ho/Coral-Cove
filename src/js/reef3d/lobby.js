  /* ---------- REEF LOBBY: the profile picker as a 3D underwater room. Shelly (Lumi at night) swims
     around; tapping the water drops food she swims over to eat. The profile buttons, title and links
     are the picker's own HTML, styled as game-board spaces floating over the scene. ---------- */
  var RL = { view: null };
  window.__reefLobbyView = function(){ return RL.view; };   // test helper
  // The profile screen's day/night button: the choice is kept on this device, and the next profile that opens
  // takes it over (saved to that profile), so the board looks the way it did when she tapped.
  var RL_THEME_K = 'cc-lobby-theme', rlThemeHandOff = null;
  function reefThemeFor(profile){
    if(!profile){ try { return localStorage.getItem(RL_THEME_K); } catch(e){ return null; } }
    if(rlThemeHandOff){
      var m = rlThemeHandOff; rlThemeHandOff = null;
      if(profile.themeMode !== m){ profile.themeMode = m; try { S.store.updateProfile(profile.id, { themeMode: m }); } catch(e){} }
    }
    return profile.themeMode;
  }
  function reefLobby(){
    var shell = app.querySelector('.lock-screen');
    if(!shell || R3.failed) return;
    function attach(models){
      if(!document.body.contains(shell)) return;
      try {
        var night = reefNight(), view = RL.view;
        if(!view || view.night !== night){
          if(view){ view.renderer.dispose(); view.renderer.forceContextLoss && view.renderer.forceContextLoss(); }
          view = RL.view = reefLobbyBuild(models, night);
        }
        document.body.classList.add('r3-lobby');
        app.insertBefore(view.wrap, app.firstChild);
        view.w = 0; reefLobbyLoop(view);
      } catch(err){ try { console.warn('3D lobby turned off:', err); } catch(e){} document.body.classList.remove('r3-lobby'); }
    }
    if(window.THREE && R3.modelsReady){ attach(R3.modelsReady); return; }
    document.body.classList.add('r3-lobby');   // the lobby look (sea background, game-board profiles) right away
    reef3dLoad().then(function(){ return reef3dModels(); }).then(attach, function(){ document.body.classList.remove('r3-lobby'); });
  }

  function reefLobbyBuild(models, night){
    var THREE = window.THREE, r = reefRand(night ? 17 : 11);
    var wrap = document.createElement('div');
    wrap.className = 'rl ' + (night ? 'night' : 'day');
    wrap.innerHTML = '<canvas class="rl-canvas" aria-hidden="true"></canvas>' + reefMusicButtonHTML('rl-musicbtn') +
      '<div class="r3-bubble rl-note" role="status" hidden></div>' +
      '<button type="button" class="rl-themebtn" data-rl-theme aria-label="' + (night ? 'Switch to the sunlit reef (light mode)' : 'Switch to the midnight wreck (dark mode)') + '">' + (night ? '☀️' : '🌙') + '</button>';
    var renderer = new THREE.WebGLRenderer({ canvas: wrap.querySelector('canvas'), antialias: innerWidth * innerHeight <= 700000, alpha: true, powerPreference: 'low-power' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
    var scene = new THREE.Scene(); scene.fog = new THREE.Fog(night ? '#0d2b35' : '#8fcfd2', 12, 40);
    var cam = new THREE.PerspectiveCamera(45, 1, .1, 100); cam.position.set(0, 5.5, 13); cam.lookAt(0, 2.2, 0);
    var kit = reef3dKit(THREE, night), B = kit.B, M = kit.M;
    scene.add(new THREE.HemisphereLight(night ? '#7fb6c4' : '#fff6e2', night ? '#0b1e26' : '#3f7f88', night ? .55 : .5));
    var sun = new THREE.DirectionalLight(night ? '#a9e6ff' : '#fff1d2', night ? .6 : .72); sun.position.set(6, 16, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); var sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; scene.add(sun);
    var rig = reef3dRig(scene), bake = {};   // baked lighting and painted shadows, as on the board (see reef3dBakeGeo)
    renderer.shadowMap.enabled = false; sun.castShadow = false;

    // Sand with drifting sunlight (or faint glow at night), like the board.
    var floorGeo = new THREE.PlaneGeometry(60, 50, 60, 50), pos = floorGeo.attributes.position;
    for(var v = 0; v < pos.count; v++){ var fx = pos.getX(v), fy = pos.getY(v); pos.setZ(v, Math.sin(fx * .35) * .25 + Math.cos(fy * .22 + fx * .1) * .3 + Math.max(0, -fy - 6) * .18); }
    floorGeo.computeVertexNormals();
    var caus = (function(){
      var N = 128, c = document.createElement('canvas'); c.width = c.height = N; var g = c.getContext('2d'), img = g.createImageData(N, N), pts = [];
      for(var q = 0; q < 22; q++) pts.push([r() * N, r() * N]);
      for(var y = 0; y < N; y++) for(var x = 0; x < N; x++){
        var d1 = 1e9, d2 = 1e9;
        pts.forEach(function(p){ for(var ox = -N; ox <= N; ox += N) for(var oy = -N; oy <= N; oy += N){ var dx = x - p[0] - ox, dy = y - p[1] - oy, d = dx * dx + dy * dy; if(d < d1){ d2 = d1; d1 = d; } else if(d < d2) d2 = d; } });
        var e = Math.max(0, 1 - (Math.sqrt(d2) - Math.sqrt(d1)) / 5), val = Math.round(255 * e * e), o = (y * N + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = val; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 10); return t;
    })();
    var floor = new THREE.Mesh(floorGeo, M(night ? '#2f3e3e' : '#d9cba6'));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.15; scene.add(floor);
    reef3dBakeObject(floor, rig, bake); floor.material = reef3dSandMat(caus, new THREE.Color(night ? '#2a6f78' : '#fff6da').multiplyScalar(.2));
    function groundY(x, z){ var fy = -z; return Math.sin(x * .35) * .25 + Math.cos(fy * .22 + x * .1) * .3 + Math.max(0, -fy - 6) * .18 - .15; }

    // A ring of scenery around the room, kept clear of the middle where Shelly swims.
    var lobbyStatics = new THREE.Group();
    var setD = night ? ['kelp', 'rock', 'coralBall', 'plank'] : ['kelp', 'coralBall', 'staghorn', 'rock', 'star', 'kelp'];
    for(var n = 0; n < 34; n++){
      var a = r() * Math.PI * 2, rad = 7 + r() * 12, sx = Math.cos(a) * rad, sz = Math.sin(a) * rad * .8 - 4;
      if(sz > 6) continue;
      var nm = setD[Math.floor(r() * setD.length)], d = null;
      if(nm === 'rock' && models.rock1) d = reef3dModel(models, ['rock1', 'rock2', 'rockp'][Math.floor(r() * 3)], .7 + r() * .9, kit.grad, night ? '#30464e' : '#9fb8bb');
      if(!d) d = B[nm](r);
      d.position.set(sx, 0, sz); d.rotation.y = r() * 6; d.scale.multiplyScalar(.8 + r() * .7); lobbyStatics.add(d);
    }
    var wreck = night ? reef3dModel(models, 'wreck', 6, kit.grad, '#3c5560') : null;
    if(wreck){ wreck.traverse(function(m){ if(/^grass/.test(m.name || '')) m.visible = false; }); wreck.position.set(-9, -.3, -10); wreck.rotation.y = .7; lobbyStatics.add(wreck); }
    var blobList = [], blobMat = reef3dBlobMat(reef3dBlobTex(), night);
    lobbyStatics.updateMatrixWorld(true); lobbyStatics.children.forEach(function(c){ reef3dFootprint(c, blobList); });
    scene.add(reef3dMerge(lobbyStatics, rig, bake));
    var chest = reef3dModel(models, 'chest', 1.1, kit.grad); if(chest){ chest.position.set(6.5, 0, -2); chest.rotation.y = -.6; scene.add(chest); reef3dFootprint(chest, blobList); }
    // Kiko (Mochi or Hermit, the same one as on the board) sits at the side of the room; tap it to swap crabs.
    var crab = reefCrabBuild(reefCrabNow, kit.grad, .9); crab.position.set(-4.5, 0, 2); crab.rotation.y = .6; scene.add(crab);

    // Rays of light and a few fish, as on the board.
    var rayTex = (function(){ var c = document.createElement('canvas'); c.width = 64; c.height = 256; var g = c.getContext('2d');
      var gv = g.createLinearGradient(0, 0, 0, 256); gv.addColorStop(0, 'rgba(255,255,255,1)'); gv.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gv; g.fillRect(0, 0, 64, 256);
      g.globalCompositeOperation = 'destination-in'; var gh = g.createLinearGradient(0, 0, 64, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gh; g.fillRect(0, 0, 64, 256);
      return new THREE.CanvasTexture(c); })();
    var rays = [];
    for(var ri = 0; ri < 6; ri++){
      var rm = new THREE.Mesh(new THREE.PlaneGeometry(1.4 + r() * 1.6, 16), new THREE.MeshBasicMaterial({ map: rayTex, color: night ? '#7fe0d6' : '#fffbe8', transparent: true, opacity: night ? .05 : .14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      rm.position.set((r() - .5) * 18, 6, -3 - r() * 8); rm.rotation.set(0, (r() - .5) * .8, .32); rm.userData.base = rm.material.opacity; rm.userData.ph = r() * 6; scene.add(rm); rays.push(rm);
    }
    var fish = [], mixers = [];
    for(var fI = 0; fI < 7; fI++){
      var fm = reef3dModel(models, fI % 2 ? 'fish2' : 'fish1', .4, kit.grad, fI % 3 === 2 ? '#ffd166' : null);
      if(!fm) break;
      var holder = new THREE.Group(); holder.add(fm); scene.add(holder);
      var mx = new THREE.AnimationMixer(fm.userData.root), clip = fm.userData.gltf.animations[0]; if(clip){ var ac = mx.clipAction(clip); ac.play(); ac.time = r() * clip.duration; } mixers.push(mx);
      holder.userData = { rad: 6 + r() * 5, h: 1.5 + r() * 4, spd: (.15 + r() * .15) * (fI % 2 ? 1 : -1), ph: r() * 6 }; fish.push(holder);
    }

    if(crab) reef3dFootprint(crab, blobList);
    var blobs = reef3dBlobs(blobList, blobMat, groundY); if(blobs) scene.add(blobs);
    var guide = B.guide(); reef3dOutline(guide, night ? '#173d5c' : '#1f3a2c', night ? .035 : .05); guide.position.set(0, 4, -1); scene.add(guide);
    // Shelly swims high in the lobby, so her shadow is soft and faint; at night Lumi's lure lights the sand instead
    var gb = new THREE.PlaneGeometry(2.6, 2.6); gb.rotateX(-Math.PI / 2);
    var blobG = new THREE.Mesh(gb, night ? new THREE.MeshBasicMaterial({ map: reef3dBlobTex(true), color: '#5ff0e0', transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : blobMat.clone());
    if(night) blobG.scale.setScalar(2.4); else blobG.material.opacity = .55;
    blobG.renderOrder = 3; scene.add(blobG);
    var view = { wrap: wrap, renderer: renderer, scene: scene, cam: cam, night: night, guide: guide, caus: caus, rays: rays, fish: fish, mixers: mixers, crab: crab, leaving: null, spareCrab: null,
      food: [], target: new THREE.Vector3(0, 4, -1), vel: new THREE.Vector3(), t0: performance.now(), lastT: performance.now(), wanderAt: 0, kit: kit, floorY: -.15, baked: true, blobG: blobG, groundY: groundY };

    // Tap the water: a food (picked by chance, see reef_food.js) appears where you tapped and sinks slowly.
    var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
    renderer.domElement.addEventListener('click', function(e){
      var rc = renderer.domElement.getBoundingClientRect();
      ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ptr, cam);
      if(view.crab && !view.leaving && !view.crab.userData.entering &&
         (ray.intersectObject(view.crab, true).length || reef3dTapDist(view, view.crab.position.clone().setY(.45), e, rc) < 60)){ reefCrabSwap(view, { x: 7.5, z: 2 }, -1); return; }
      if(!ray.ray.intersectPlane(plane, hit)) return;
      hit.x = Math.max(-8, Math.min(8, hit.x)); hit.y = Math.max(1, Math.min(6, hit.y));
      var pellet = reefFoodBuild(reefFoodPick(), kit.grad, night), sc = pellet.userData.kind === 'bag' ? 1.7 : 1.3;   // the bag is a bit bigger, so it can be seen
      pellet.scale.setScalar(sc); pellet.userData.base = sc;
      pellet.position.copy(hit); scene.add(pellet); view.food.push(pellet);
      if(view.food.length > 6){ var old = view.food.shift(); scene.remove(old); }
      try { Sound.unlock(); Sound.bloop(760, 0, .04); } catch(err){}
      try { localStorage.setItem(COVE_FED_K, '1'); } catch(err){}
    });
    // Day ⇄ night from the profile screen: a soft wash covers the switch while the room is rebuilt for the new time of day.
    wrap.querySelector('[data-rl-theme]').addEventListener('click', function(){
      if(view.switching) return; view.switching = true;
      try { Sound.unlock(); reefThemeSting(!night); } catch(err){}
      var w = reef3dWash(!night);
      setTimeout(function(){
        var mode = night ? 'light' : 'dark'; rlThemeHandOff = mode;
        try { localStorage.setItem(RL_THEME_K, mode); } catch(err){}
        render();
      }, reefCalm() ? 280 : 450);
      setTimeout(function(){ reef3dWashOut(w); }, reefCalm() ? 420 : 900);
    });
    reef3dQApply(view);
    return view;
  }

  // The plastic bag: she won't eat it. It floats up and away, and a note (which stays until OK) explains why.
  function reefLobbyRefuse(view, bag, now, calm){
    view.food.shift(); view.refuseAt = now;
    if(calm) view.scene.remove(bag);
    else { var from = bag.position.clone(), mats = [];
      bag.traverse(function(o){ if(o.material && mats.indexOf(o.material) < 0) mats.push(o.material); });
      (view.fx = view.fx || []).push({ t0: performance.now(), dur: 2600,
        step: function(p){ bag.position.set(from.x + p * .8, from.y + p * 3, from.z); mats.forEach(function(m){ m.opacity = .85 * (1 - p); }); },
        end: function(){ view.scene.remove(bag); } }); }
    var note = view.wrap.querySelector('.rl-note'); if(!note) return;
    var who = view.night ? 'Lumi' : 'Shelly';
    note.innerHTML = reefGuideMini(view.night, 'rl-note-e') +
      '<span><b>No, thank you!</b> ' + who + ' does not eat plastic bags. Plastic in the sea can make sea animals sick. ' +
      'Help keep the ocean clean: put trash in a trash can.</span><button type="button" class="rl-note-ok">OK</button>';
    note.hidden = false; note.classList.remove('show'); void note.offsetWidth; note.classList.add('show');
    note.querySelector('.rl-note-ok').addEventListener('click', function(){ note.hidden = true; });
  }

  function reefLobbyFrame(view, now){
    var THREE = window.THREE, calm = reefCalm(), t = (now - view.t0) / 1000, dt = Math.min(.05, Math.max(0, (now - view.lastT) / 1000)); view.lastT = now;
    var w = view.wrap.clientWidth || 1, h = view.wrap.clientHeight || 1;
    if(view.w !== w || view.h !== h){ view.w = w; view.h = h; view.renderer.setSize(w, h, false); view.cam.aspect = w / h; view.cam.fov = w < 640 ? 60 : 45; view.cam.updateProjectionMatrix(); }
    var g = view.guide, body = g.userData.body, parts = g.userData.parts;
    if(view.blobG){ var gp = g.position; view.blobG.position.set(gp.x, view.groundY(gp.x, gp.z) + .07, gp.z); }
    // Shelly heads for the nearest food, or wanders to a new spot every few seconds.
    var food = view.food[0], mouthAt = null;
    if(food && parts.mouth){   // swim so her MOUTH meets the food: aim her middle at the food minus the mouth's offset
      g.updateMatrixWorld(true); mouthAt = parts.mouth.getWorldPosition(new THREE.Vector3());
      view.target.copy(food.position).sub(mouthAt).add(g.position);
    } else if(food) view.target.copy(food.position);
    else if(now > view.wanderAt){ view.target.set((Math.random() - .5) * 9, 3.2 + Math.random() * 2.2, (Math.random() - .5) * 4 - 2); view.wanderAt = now + 3500 + Math.random() * 3000; }
    var to = view.target.clone().sub(g.position), dist = to.length();
    if(calm){ if(food){ g.position.copy(view.target); } }
    else if(dist > .05){ var sp = (food ? 3.2 : 1.1) * dt; g.position.add(to.multiplyScalar(Math.min(1, sp / dist))); }
    var aim = food ? food.position : view.target;   // with food, she turns to face the food itself
    if((dist > .1 || food) && !calm){ var want = Math.atan2(aim.x - g.position.x, aim.z - g.position.z); var dA = ((want - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; g.rotation.y += dA * Math.min(1, dt * 4); }
    var reached = food && (mouthAt ? mouthAt.distanceTo(food.position) < .32 : g.position.distanceTo(food.position) < .55);
    if(reached && food.userData.kind === 'bag'){ reefLobbyRefuse(view, food, now, calm); reached = false; }
    if(reached){ // gulp: the food shrinks into her mouth
      view.food.shift();
      if(calm || !mouthAt) view.scene.remove(food);
      else { var bite = food, from = food.position.clone(), s0 = food.scale.x;
        (view.fx = view.fx || []).push({ t0: performance.now(), dur: 180,
          step: function(p){ g.updateMatrixWorld(true); bite.position.lerpVectors(from, parts.mouth.getWorldPosition(new THREE.Vector3()), p); bite.scale.setScalar(s0 * (1 - p)); },
          end: function(){ view.scene.remove(bite); } }); }
      try { Sound.bloop(420, 0, .06); } catch(e){}
      view.gulpAt = now;
      var kind = food.userData.kind;   // rare foods: a twirl and sparkles for the star treat, a small sparkle for the jellyfish
      if(!calm && kind === 'star'){ view.twirlAt = now; reefFoodSparkle(view, food.position.clone(), true); try { Sound.bloop(880, .05, .05); Sound.bloop(1175, .15, .05); Sound.bloop(1568, .25, .05); } catch(e){} }
      else if(!calm && kind === 'jelly') reefFoodSparkle(view, food.position.clone(), false);
    }
    view.food.forEach(function(f){ if(f.position.y > .25) f.position.y -= dt * .35; if(!calm) reefFoodIdle(f, t, dt); });
    if(view.fx) view.fx = view.fx.filter(function(fx){ var p = Math.min(1, (performance.now() - fx.t0) / fx.dur); fx.step(p); if(p >= 1){ fx.end(); return false; } return true; });
    if(!calm){
      var gs = view.gulpAt && now - view.gulpAt < 300 ? 1 + Math.sin((now - view.gulpAt) / 300 * Math.PI) * .18 : 1;
      body.scale.setScalar(gs); body.position.y = Math.sin(t * 2) * .12;
      var tw = view.twirlAt ? Math.min(1, (now - view.twirlAt) / 900) : 1;   // the star-treat twirl: one full happy spin
      body.rotation.y = tw < 1 ? (1 - Math.pow(1 - tw, 3)) * Math.PI * 2 : 0;
      var nope = view.refuseAt ? Math.min(1, (now - view.refuseAt) / 1000) : 1;   // the plastic bag: a slow "no" shake of the head
      if(nope < 1) body.rotation.y = Math.sin(nope * Math.PI * 4) * .35 * (1 - nope);
      (parts.flippers || []).forEach(function(f, i){
        var sp2 = dist > .3 ? 9 : 2.2, amp = dist > .3 ? .5 : .2;
        if(view.night) f.rotation.z = f.userData.side * Math.sin(t * sp2 * 1.4 + i) * amp;
        else { f.rotation.y = f.userData.side * Math.sin(t * sp2 + (f.userData.front ? 0 : 1.6)) * amp; f.rotation.z = f.userData.side * Math.sin(t * sp2 + .8) * amp * .4; }
      });
      if(parts.tail) parts.tail.rotation.y = Math.sin(t * 6) * .45;
      (parts.eyes || []).forEach(function(e){ e.scale.y = (t % 3.7) < .13 ? .12 : 1; });
      view.mixers.forEach(function(m){ m.update(dt); });
      var lc = view.crab;   // a crab swapped in scuttles over to Kiko's spot, then dances
      if(lc && lc.userData.entering){
        var hx = -4.5 - lc.position.x, hz = 2 - lc.position.z, hd = Math.hypot(hx, hz);
        if(hd < .1){ lc.userData.entering = false; lc.rotation.y = .6; reefCrabPlay(lc, 'Dance'); }
        else { var cs = Math.min(hd, dt * 4.5); lc.position.x += hx / hd * cs; lc.position.z += hz / hd * cs; lc.rotation.y = 0; if(lc.userData.anim.name !== 'Walk') reefCrabPlay(lc, 'Walk'); }
      }
      if(lc) reefCrabAnimate(lc);
      reefCrabLeaveTick(view, dt);
      view.caus.offset.set(t * .012, t * .02);
      view.rays.forEach(function(rm){ rm.material.opacity = rm.userData.base * (.65 + .35 * Math.sin(t * .5 + rm.userData.ph)); });
      view.fish.forEach(function(f){ var u = f.userData, a = t * u.spd + u.ph; f.position.set(Math.cos(a) * u.rad, u.h + Math.sin(t + u.ph) * .3, Math.sin(a) * u.rad * .5 - 3); f.rotation.y = Math.atan2(-Math.sin(a) * u.spd, Math.cos(a) * u.spd * .5); });
    }
    // Occasional shadow updates, as on the board, to keep the iPad cool.
    view.frameN = (view.frameN || 0) + 1;
    if(view.frameN % (view.every === 2 ? 6 : 12) === 0 || view.frameN < 4) view.renderer.shadowMap.needsUpdate = true;
    view.renderer.render(view.scene, view.cam);
  }
  function reefLobbyLoop(view){
    if(view.raf) return;
    function tick(now){
      if(!document.body.contains(view.wrap)){ view.raf = null; if(!app.querySelector('.lock-screen .profile-grid')) document.body.classList.remove('r3-lobby'); return; }
      view.tick = (view.tick || 0) + 1;
      if(view.tick % (view.every || 1) === 0){ reefLobbyFrame(view, now); reef3dQTick(view, now); }
      view.raf = requestAnimationFrame(tick);
    }
    view.raf = requestAnimationFrame(tick);
  }
