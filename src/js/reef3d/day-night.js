  /* ---------- Day ⇄ night: a moonrise or sunrise inside the 3D sea (after Coral Calendar's sun/moon moment) ----------
     1. the camera tilts up from the reef toward the surface while the haze takes on the new colour;
     2. the moon (or sun) rises above the water, glowing through it, with glints and light rays;
     3. at its fullest a wash of light covers the switch to the other board;
     4. the new board opens looking up at the sky and the camera tilts back down to Shelly or Lumi, who waves.
     A short rising tune plays with it (reefThemeSting). Calm Motion: a plain quick fade. */
  var REEF3D_THEME_UP = 1900;   // ms from the tap to the switch
  function reef3dOrbTex(dark){
    var THREE = window.THREE, c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    var halo = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    halo.addColorStop(0, dark ? 'rgba(220,248,250,.55)' : 'rgba(255,240,180,.8)'); halo.addColorStop(.45, dark ? 'rgba(143,227,232,.16)' : 'rgba(240,199,106,.3)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
    var disc = g.createRadialGradient(112, 108, 4, 128, 128, 46);
    if(dark){ disc.addColorStop(0, '#ffffff'); disc.addColorStop(.6, '#e3f4f6'); disc.addColorStop(1, '#a9cdd6'); }
    else { disc.addColorStop(0, '#fffef4'); disc.addColorStop(.5, '#fbe39a'); disc.addColorStop(1, '#f0c35a'); }
    g.fillStyle = disc; g.beginPath(); g.arc(128, 128, 46, 0, Math.PI * 2); g.fill();
    if(dark){ g.fillStyle = 'rgba(110,150,166,.28)'; [[142, 140, 9], [112, 146, 6], [134, 106, 5], [104, 118, 4], [150, 118, 4]].forEach(function(k){ g.beginPath(); g.arc(k[0], k[1], k[2], 0, Math.PI * 2); g.fill(); }); }
    var t = new THREE.CanvasTexture(c); return t;
  }
  function reef3dGlintTex(){
    var THREE = window.THREE, c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
    var r = g.createRadialGradient(32, 32, 0, 32, 32, 14); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, 32); g.lineTo(64, 32); g.moveTo(32, 0); g.lineTo(32, 64); g.stroke();
    return new THREE.CanvasTexture(c);
  }
  // The sky seen from under the water: a bright patch of surface with the orb above it, and glints.
  function reef3dSky(view, dark, setting){   // setting: also show the sun or moon that is going down
    var THREE = window.THREE, sky = new THREE.Group(), g = view.guide.position;
    var surf = new THREE.Mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshBasicMaterial({ color: dark ? '#4fb7c4' : '#fff4cf', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    surf.rotation.x = Math.PI / 2; surf.position.set(g.x * .5, 15, g.z - 16); sky.add(surf);
    var orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: reef3dOrbTex(dark), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0 }));
    orb.scale.set(9, 9, 1); orb.renderOrder = 5; sky.add(orb);
    var glints = [], gt = reef3dGlintTex();
    for(var i = 0; i < 14; i++){
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: dark ? (i % 2 ? '#bff3ee' : '#eafbff') : (i % 2 ? '#fff3c4' : '#ffe08a'), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0, blending: THREE.AdditiveBlending }));
      sp.position.set(g.x * .5 + (Math.random() - .5) * 26, 9 + Math.random() * 6, g.z - 12 - Math.random() * 10); sp.scale.setScalar(.6 + Math.random() * .9); sp.renderOrder = 6;
      sp.userData.ph = Math.random() * 6; sp.userData.at = .25 + Math.random() * .5; sky.add(sp); glints.push(sp);
    }
    var old = null;
    if(setting){ old = new THREE.Sprite(new THREE.SpriteMaterial({ map: reef3dOrbTex(!dark), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0 })); old.scale.set(9, 9, 1); old.renderOrder = 5; sky.add(old); }
    var bubs = [], bt = reef3dBlobTex(true);
    for(var b = 0; b < 16; b++){
      var bb = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0, fog: false }));
      bb.userData = { x: g.x + (Math.random() - .5) * 9, z: g.z - 2 - Math.random() * 10, d: Math.random() * .4, s: .18 + Math.random() * .25 };
      bb.scale.setScalar(bb.userData.s); bb.raycast = function(){}; sky.add(bb); bubs.push(bb);
    }
    view.scene.add(sky);
    return { group: sky, surf: surf, orb: orb, old: old, bubs: bubs, glints: glints, base: new THREE.Vector3(g.x * .5, 0, g.z - 18) };
  }
  // p: 0 → 1 over the rise. rise 0 = orb below the water line, 1 = at its fullest.
  function reef3dSkyStep(view, sk, rise, fade, t, sink, lift){
    sk.orb.position.set(sk.base.x, 8 + 9 * rise, sk.base.z);
    sk.orb.material.opacity = Math.min(1, rise * 2.2) * fade;
    sk.surf.material.opacity = (.12 + .3 * rise) * fade;
    sk.glints.forEach(function(gl){ var on = reef3dSeg(rise, gl.userData.at, gl.userData.at + .25); gl.material.opacity = on * (.55 + .45 * Math.sin(t * 6 + gl.userData.ph)) * fade; gl.position.y += .004; });
    if(sk.old){ var sn = sink || 0; sk.old.position.set(sk.base.x + 4, 17 - 10 * sn, sk.base.z - 2); sk.old.material.opacity = (1 - sn) * Math.min(1, (1 - sn) * 3) * fade; }
    if(lift != null) sk.bubs.forEach(function(bb){ var u = bb.userData, k = Math.max(0, Math.min(1, (lift - u.d) / (1 - u.d)));
      bb.position.set(u.x + Math.sin(t * 3 + u.z) * .25, .6 + k * 13, u.z); bb.material.opacity = Math.sin(k * Math.PI) * .7 * fade; });
  }
  // Day ⇄ night: she swims up to the surface, the water drops away below the horizon and the sky plays a sunset
  // (sun sinking into an orange glow, stars, the moon rising) or a sunrise, then she dives back down into the new
  // board. The sky scene covers the whole screen while the board is rebuilt for the new theme (a heavy moment), and
  // the dive back down waits until the new board has drawn, so nothing is seen to freeze.
  function reef3dThemeShow(view, preview){   // preview: a test holds the sky still, no switch
    var toDark = !view.night, mode = toDark ? 'dark' : 'light';
    function swap(){ try { setThemeMode(mode, true); } catch(e){} }
    if(view.themeFx || view.moving || document.querySelector('.r3-cycle')) return;
    if(reefCalm()){ var w0 = reef3dWash(toDark); setTimeout(swap, 280); setTimeout(function(){ reef3dWashOut(w0); }, 420); return; }
    try { reefThemeSting(toDark); } catch(e){}
    view.emote = null; view.themeFx = { cycle: true };
    var stars = '', glints = '', k;
    for(k = 0; k < 34; k++) stars += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 52).toFixed(1) + '%;animation-delay:' + (Math.random() * 2).toFixed(2) + 's"></i>';
    for(k = 0; k < 10; k++) glints += '<i style="left:' + (6 + Math.random() * 88).toFixed(1) + '%;top:' + (2 + Math.random() * 20).toFixed(1) + '%;animation-delay:' + (Math.random() * 2).toFixed(2) + 's"></i>';
    var wave = function(c){ return '<svg class="cy-wave ' + c + '" viewBox="0 0 1200 80" preserveAspectRatio="none"><path d="M0 40 C100 14 200 14 300 40 S500 66 600 40 S800 14 900 40 S1100 66 1200 40 V80 H0 Z"/></svg>'; };
    var el = document.createElement('div'); el.className = 'r3-cycle ' + (toDark ? 'to-night' : 'to-day'); el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="cy-sky"><i class="cy-s day"></i><i class="cy-s dusk"></i><i class="cy-s night"></i><span class="cy-stars">' + stars + '</span>' +
        '<span class="cy-sun"></span><span class="cy-moon"></span><span class="cy-horizon"></span>' +
        '<svg class="cy-island" viewBox="0 0 220 120"><path d="M0 120 C30 92 80 84 120 88 C160 92 196 104 220 120 Z M118 92 C116 70 120 50 132 30 L136 31 C125 50 122 70 124 92 Z M132 30 C110 18 92 24 84 36 C102 30 118 30 132 30 Z M132 30 C126 10 140 2 156 4 C144 12 138 20 132 30 Z M132 30 C150 18 170 22 178 36 C162 30 146 30 132 30 Z M132 30 C116 32 106 46 108 58 C116 44 124 36 132 30 Z M132 30 C150 34 160 48 156 60 C150 46 142 38 132 30 Z"/></svg></div>' +
      '<div class="cy-sea"><i class="cy-w day"></i><i class="cy-w night"></i>' + wave('w2') + wave('w1') + '<span class="cy-glints">' + glints + '</span><span class="cy-path"></span>' +
        '<span class="cy-bubs"><i></i><i></i><i></i><i></i><i></i><i></i></span></div>';
    document.body.appendChild(el);
    var oldCv = view.renderer && view.renderer.domElement;
    if(oldCv){ oldCv.style.transition = 'filter .55s ease'; oldCv.style.filter = 'blur(10px)'; }   // the board goes soft as the sky comes in
    if(preview) return;
    var t0 = performance.now(), swapped = false;
    setTimeout(function(){ R3.themeArrive = { t0: performance.now(), dark: toDark, cycle: true }; swap(); swapped = true; }, 1150);   // under the sky: rebuild the board
    // back down once the sky has played and the new board has drawn a few frames
    (function wait(){
      var v = R3.view, ready = swapped && v && v.night === toDark && (v.frameN || 0) > 3;
      if(!ready || performance.now() - t0 < 2900){ if(performance.now() - t0 < 9000) return requestAnimationFrame(wait); }
      if(!document.body.contains(el)) document.body.appendChild(el);   // (the board's wrapper may have been rebuilt)
      el.classList.add('down');
      if(v && v.themeIn) v.themeIn.t0 = performance.now();   // the camera's tilt back down starts with the dive
      // like a film dissolve: the sky blurs away while the new board comes into focus out of a blur
      var cv = v && v.renderer && v.renderer.domElement;
      if(cv){ cv.style.transition = 'none'; cv.style.filter = 'blur(16px)'; void cv.offsetWidth; cv.style.transition = 'filter 1.3s cubic-bezier(.3,0,.2,1) .15s'; cv.style.filter = 'blur(0px)';
        setTimeout(function(){ cv.style.transition = ''; cv.style.filter = ''; }, 1600); }
      setTimeout(function(){ el.remove(); var vv = R3.view; if(vv) vv.themeFx = null; }, 1350);
    })();
  }
  function reef3dWash(dark){
    var w = document.createElement('div'); w.className = 'r3-wash ' + (dark ? 'night' : 'day'); w.setAttribute('aria-hidden', 'true');
    document.body.appendChild(w); void w.offsetWidth; w.classList.add('on'); return w;
  }
  function reef3dWashOut(w){ if(!w) return; w.classList.remove('on'); setTimeout(function(){ w.remove(); }, 700); }
  // The new board's first moments after a switch: looking up at the sky, tilting back down.
  function reef3dThemeArrive(view){
    var a = R3.themeArrive; R3.themeArrive = null;
    if(!a || performance.now() - a.t0 > 9000 || a.dark !== view.night){ reef3dWashOut(R3.wash); R3.wash = null; return false; }
    view.themeIn = { t0: performance.now(), sky: reef3dSky(view, view.night) };
    setTimeout(function(){ reef3dWashOut(R3.wash); R3.wash = null; }, 120);
    setTimeout(function(){ if(document.body.contains(view.wrap) && !view.moving) reef3dEmote(view, 'hello'); }, 1500);
    return true;
  }
  // Per frame: how far the camera looks up (0 = at Shelly, 1 = at the sky), and the sky's state.
  function reef3dThemeFrame(view, now, t){
    var THREE = window.THREE, fx = view.themeFx, inn = view.themeIn, up = 0;
    if(fx && fx.cycle) fx = null;   // the sky scene is drawn over the board (see reef3dThemeShow)
    if(fx){
      var p = fx.hold != null ? fx.hold : Math.min(1, (now - fx.t0) / REEF3D_THEME_UP);
      up = reef3dEase(reef3dSeg(p, 0, .36));
      // the old sun or moon goes down first (once the camera is looking up), then the new one comes up;
      // a sunset (or dawn) colour swells over the reef and the new light settles in
      var sink = reef3dEase(reef3dSeg(p, .2, .56)), rise = reef3dEase(reef3dSeg(p, .46, .98));
      reef3dSkyStep(view, fx.sky, rise, 1, t, sink, p);
      if(!fx.g1){ fx.g1 = fx.grade.children[0]; fx.g2 = fx.grade.children[1]; fx.c0 = fx.sky.surf.material.color.clone(); fx.cMid = new THREE.Color(fx.dark ? '#ff9a5c' : '#ff9fbf'); }
      fx.grade.style.opacity = 1;
      fx.g1.style.opacity = (.6 * reef3dBounce(reef3dSeg(p, .08, .8))).toFixed(3);
      fx.g2.style.opacity = (.55 * reef3dEase(reef3dSeg(p, .45, 1))).toFixed(3);
      fx.sky.surf.material.color.copy(fx.cMid).lerp(fx.c0, rise);   // the surface glows orange at sunset (pink at dawn), then takes the new light
      view.scene.fog.color.copy(fx.fog0).lerp(fx.fog1, reef3dEase(reef3dSeg(p, .25, 1)));
      (view.rayList || []).forEach(function(rm){ rm.material.opacity = rm.userData.base * (1 + 1.5 * up); });
    }
    if(inn){
      var q = Math.max(0, Math.min(1, (now - inn.t0) / 1700));
      up = 1 - reef3dEase(reef3dSeg(q, .15, 1));
      reef3dSkyStep(view, inn.sky, 1, 1 - reef3dEase(reef3dSeg(q, .4, 1)), t);
      if(q >= 1){ view.scene.remove(inn.sky.group); view.themeIn = null; }
    }
    view.wrap.classList.toggle('r3-sky', up > .04);   // deck names hide while the camera looks at the sky
    view.skyUp = up;
    return up;
  }

  // What Shelly does when the board appears: a cheer and then the dice when she's just come out of a deck (many
  // decks have no end, so leaving one counts), a wave hello when arriving from the profiles, nothing otherwise.
  function reef3dGreet(view, zones, quiet){
    var now = {}, finished = false;
    zones.forEach(function(z){ z.items.forEach(function(it){ now[it.d.id] = it.state; }); });
    if(R3.fromDeck){ R3.fromDeck = false; finished = true; }
    var first = !R3.seen || R3.seenProfile !== (S.profile && S.profile.id);
    R3.seen = now; R3.seenProfile = S.profile && S.profile.id;
    if(quiet || (!finished && !first)) return;
    setTimeout(function(){
      if(!document.body.contains(view.wrap) || view.moving) return;
      if(finished){ reef3dShells(view, 2); reef3dEmote(view, 'cheer'); var sp = view.spaces[view.at]; if(sp && !reefCalm()) reef3dStars(view, sp); if(!reefCalm()) reef3dCrabAct(view, 'Dance', true);
        setTimeout(function(){ if(!view.moving) reef3dDice(view); }, reefCalm() ? 200 : 2000); }   // then the dice block comes out
      else { reef3dEmote(view, 'hello'); if(reef3dStoryTarget(view) >= 0 && reef3dStoryTarget(view) !== view.at) setTimeout(function(){ if(!view.moving) reef3dDice(view); }, 1800); }
    }, 650);
  }

  // Swap the painted scene for the 3D board once three.js is ready. The 3D view is kept between
  // renders (one WebGL canvas for the whole visit) and rebuilt only when the decks or theme change.
  /* Shader warm-up. The first time the board draws a new kind of material (a star burst, a sparkle, a coin),
     the device stops to compile a shader for it, and on an iPad that pause lands on whatever is happening
     (the dive into a deck stuttered this way). The effects only use a handful of kinds, so one of each is
     compiled here while the loading cover is still up. Three.js keeps a compiled shader for as long as a
     material that uses it exists, so the warm-up materials are kept on the view (never drawn, never disposed). */
  function reef3dWarm(view){
    var THREE = window.THREE, R = view.renderer, scene = view.scene, grad = null, before = R.info.programs.length;
    scene.traverse(function(o){ if(!grad && o.material && o.material.gradientMap) grad = o.material.gradientMap; });
    var tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); tex.needsUpdate = true;
    var sides = [THREE.FrontSide, THREE.DoubleSide, THREE.BackSide], mats = [];
    [null, tex].forEach(function(map){
      [true, false].forEach(function(fog){
        sides.forEach(function(side){ mats.push(new THREE.MeshBasicMaterial({ map: map, fog: fog, side: side, transparent: true })); });
        mats.push(new THREE.SpriteMaterial({ map: map, fog: fog, transparent: true }));
      });
      [THREE.FrontSide, THREE.DoubleSide].forEach(function(side){
        mats.push(new THREE.MeshLambertMaterial({ map: map, side: side }));
        if(map) mats.push(new THREE.MeshLambertMaterial({ map: map, side: side, alphaTest: .4, transparent: true }));
        if(grad) mats.push(new THREE.MeshToonMaterial({ map: map, side: side, gradientMap: grad }));
      });
    });
    mats.push(new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }));
    var g = new THREE.Group(), geo = new THREE.PlaneGeometry(.01, .01);
    mats.forEach(function(m){ g.add(m.isSpriteMaterial ? new THREE.Sprite(m) : new THREE.Mesh(geo, m)); });
    scene.add(g);
    try { R.compile(scene, view.cam); } catch(e){}
    scene.remove(g);
    view.warmMats = mats;
    view.warmed = R.info.programs.length - before;   // for checking: how many shaders this compiled ahead of time
  }
  function reef3dMount(rw, zones){
    var scene2d = rw.querySelector('.rw-scene');
    if(!scene2d || R3.failed) return;
    var key = (reefNight() ? 'n' : 'd') + zones.map(function(z){ return z.id + ':' + z.items.map(function(it){ return it.d.id + it.state; }).join(','); }).join('|') + ':' + reefTally().found;
    function attach(){
      if(!document.body.contains(rw)) return;
      try {
        var view = R3.view;
        if(!view || view.key !== key){
          if(view){ view.renderer.dispose(); view.renderer.forceContextLoss && view.renderer.forceContextLoss(); }
          view = R3.view = reef3dBuild(rw, zones, models); view.key = key;
          reef3dWarm(view);
          reef3dWire(view);
          var start = S.reef3dAt != null && S.reef3dAt < view.spaces.length ? S.reef3dAt : 0;
          reef3dPlace(view, start);
          reef3dCamTarget(view, view.camPos, view.camLook);
        }
        scene2d.hidden = true;
        rw.classList.add('has-3d');
        document.body.classList.add('r3-full'); // the board fills the screen; see .r3-full in the styles
        document.body.classList.remove('r3-loading');
        scene2d.parentNode.insertBefore(view.wrap, scene2d);
        var next = view.spaces.find(function(s){ return s.kind === 'deck' && s.item.state === 'ready'; });
        if(next){ view.ring.visible = true; view.ring.position.set(next.x, .34 + (next.y || 0), next.z); } else view.ring.visible = false;
        if(view.nextStar){ view.nextStar.visible = !!(next && next.obj); if(next && next.obj){ view.nextStar.position.set(next.obj.position.x, 3.2 + (next.y || 0), next.obj.position.z); view.nextStar.userData.y = 3.2 + (next.y || 0); } }
        reef3dPearlShow(view); reef3dHat(view); reef3dGateShow(view); reef3dHud(view);
        reef3dStoryMark(view);
        if(planOn() && (!S.planDay || S.planDay.date !== todayISO()) && !S.planLoading) planLoad().then(function(){ reef3dHud(view); reef3dStoryMark(view); });
        view.w = 0; reef3dLoop(view);
        reef3dAmbience(view, true);
        reef3dGreet(view, zones, reef3dThemeArrive(view));   // after a day/night switch she waves on her own cue
        // back from the Treasure Reef or the Story Bottle: hop back along the branch to the main path
        var here = view.spaces[view.at];
        if(here && here.branch && here.end){
          clearTimeout(view.homeT);
          view.homeT = setTimeout(function(){
            var h = view.spaces[view.at];
            if(!document.body.contains(view.wrap) || view.moving || view.dice || !h || !h.branch) return;
            reef3dTravel(view, h.jn, function(){ S.reef3dAt = view.at; reef3dEmote(view, 'hello'); });
          }, 1300);
        }
      } catch(err){
        try { console.warn('3D reef turned off:', err); } catch(e){}
        R3.failed = true; R3.view = null; scene2d.hidden = false; rw.classList.remove('has-3d'); document.body.classList.remove('r3-full', 'r3-loading');
        var w3 = rw.querySelector('.r3'); if(w3) w3.remove();
      }
    }
    var models = null;
    if(window.THREE && R3.modelsReady){ models = R3.modelsReady; attach(); return; }   // ready: swap in now, no flash
    // first time: show the sea (not the old screen) while three.js and the models load
    document.body.classList.add('r3-full', 'r3-loading');
    // If the page redrew meanwhile, this board is gone and a newer one is waiting: leave the cover up for it.
    reef3dLoad().then(function(){ return reef3dModels(); }).then(function(m){ models = m; if(!document.body.contains(rw)) return; document.body.classList.remove('r3-loading'); attach(); },
      function(){ document.body.classList.remove('r3-full', 'r3-loading'); });
  }

  // Start fetching three.js and the models as soon as the page opens, so the lobby and the board
  // are ready by the time someone taps a profile.
  setTimeout(function(){ reef3dLoad().then(function(){ return reef3dModels(); }).catch(function(){}); }, 300);
