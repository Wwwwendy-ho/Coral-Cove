  /* ---------- The ? block ----------
     A game-piece block floating over each surprise space: rounded edges, a raised "?" on every side, corner
     rivets, a soft glow and a few sparkles. Gold by day, glowing teal at night. Shelly bonks it from below and
     it bursts open; it shows a plain "used" face for a while, then the "?" comes back. */
  var REEF3D_QY = 3.2;   // high enough that the block never hides Shelly from the camera
  function reef3dRoundBox(size, r, seg){
    var THREE = window.THREE, g = new THREE.BoxGeometry(size, size, size, seg, seg, seg), p = g.attributes.position, nrm = g.attributes.normal;
    var h = size / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
    for(var i = 0; i < p.count; i++){
      v.fromBufferAttribute(p, i);
      c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
      v.sub(c); if(v.lengthSq() < 1e-12) continue; v.setLength(r);
      nrm.setXYZ(i, v.x / r, v.y / r, v.z / r);          // exact rounded normals: smooth edges, no creases
      p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
    }
    return g;
  }
  function reef3dQFace(night, used){
    var THREE = window.THREE, N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; var g = cv.getContext('2d');
    var pal = night ? (used ? ['#2b5a63', '#1d434b', '#3d7580'] : ['#7ff0e4', '#2aa7b6', '#c9fff8'])
                    : (used ? ['#c79a62', '#9c7445', '#ddb88a'] : ['#ffd75e', '#f29a2e', '#fff1b0']);
    var bg = g.createLinearGradient(0, 0, 0, N); bg.addColorStop(0, pal[0]); bg.addColorStop(1, pal[1]);
    g.fillStyle = bg; g.fillRect(0, 0, N, N);
    // a raised inner panel: light top-left edge, dark bottom-right edge
    g.lineWidth = 10; g.strokeStyle = pal[2]; g.beginPath(); g.moveTo(26, N - 26); g.lineTo(26, 26); g.lineTo(N - 26, 26); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.moveTo(N - 26, 26); g.lineTo(N - 26, N - 26); g.lineTo(26, N - 26); g.stroke();
    // corner rivets
    [[18, 18], [N - 18, 18], [18, N - 18], [N - 18, N - 18]].forEach(function(q){
      var rg = g.createRadialGradient(q[0] - 3, q[1] - 3, 1, q[0], q[1], 9); rg.addColorStop(0, '#ffffff'); rg.addColorStop(.4, pal[2]); rg.addColorStop(1, pal[1]);
      g.fillStyle = rg; g.beginPath(); g.arc(q[0], q[1], 9, 0, Math.PI * 2); g.fill();
    });
    if(!used){
      g.font = '900 176px system-ui, -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillText('?', N / 2 + 6, N / 2 + 16);                       // drop shadow
      g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = night ? '#0f4a55' : '#8a4b12'; g.strokeText('?', N / 2, N / 2 + 8);
      g.fillStyle = '#ffffff'; g.fillText('?', N / 2, N / 2 + 8);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(N / 2 - 30, N / 2 - 62, 18, 30);              // a glint on the "?"
    } else {
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(N / 2, N / 2, 26, 0, Math.PI * 2); g.fill();   // a plain dimple
    }
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 2; return t;
  }
  function reef3dQBlock(night){
    var THREE = window.THREE, g = new THREE.Group();
    var q = reef3dQFace(night, false), u = reef3dQFace(night, true);
    var mat = new THREE.MeshLambertMaterial({ map: q, emissive: night ? '#38e6d6' : '#ffb347', emissiveIntensity: night ? .5 : .12 });
    var box = new THREE.Mesh(reef3dRoundBox(night ? .9 : 1.05, .15, 4), mat); g.add(box);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: reef3dBlobTex(true), color: night ? '#5ff0e0' : '#ffd870', transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(2.4); halo.renderOrder = 1; g.add(halo);
    var glints = [], gt = reef3dGlintTex();
    for(var i = 0; i < 3; i++){
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: night ? '#d9fffb' : '#fff6cc', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(.45); sp.renderOrder = 2; g.add(sp); glints.push(sp);
    }
    [halo].concat(glints).forEach(function(o){ o.raycast = function(){}; });   // only the block itself is tappable
    g.userData = { box: box, mat: mat, halo: halo, glints: glints, texQ: q, texUsed: u, night: night, used: 0 };
    return g;
  }
  // Every frame: bob, turn slowly, breathe the glow, twinkle.
  function reef3dQIdle(s, t){
    var b = s.qb, d = b.userData; if(d.bumping) return;
    b.position.y = REEF3D_QY + (s.y || 0) + Math.sin(t * 1.6 + s.i) * .12; b.rotation.y = t * .6 + s.i;
    if(d.popAt){ var pp = (performance.now() - d.popAt) / 450; if(pp < 1) b.scale.setScalar(1 + .28 * Math.sin(pp * Math.PI)); else { d.popAt = 0; b.scale.setScalar(1); } }   // the "?" pops back
    var pulse = .5 + .5 * Math.sin(t * 2.4 + s.i);
    d.mat.emissiveIntensity = d.used ? .04 : (d.night ? .4 + .35 * pulse : .08 + .12 * pulse);
    d.halo.material.opacity = d.used ? .08 : .3 + .25 * pulse; d.halo.scale.setScalar(2.2 + .3 * pulse);
    d.glints.forEach(function(gl, k){
      var a = t * 1.1 + k * 2.1, ph = (t * .7 + k * .33) % 1;
      gl.position.set(Math.cos(a) * .78, Math.sin(t * 1.3 + k) * .35, Math.sin(a) * .78);
      gl.material.opacity = d.used ? 0 : Math.max(0, Math.sin(ph * Math.PI)) * .9;
    });
  }
  // Bonked from below: squash, flash, a burst of coins and sparkles, and the "used" face for a while.
  function reef3dQHit(view, s){
    var b = s.qb; if(!b) return; var d = b.userData, THREE = window.THREE;
    try { Sound.bloop(880, 0, .05); Sound.bloop(1320, .08, .04); } catch(e){}
    d.mat.map = d.texUsed; d.mat.needsUpdate = true; d.used = 1;
    clearTimeout(d.resetT); d.resetT = setTimeout(function(){ d.mat.map = d.texQ; d.mat.needsUpdate = true; d.used = 0; d.popAt = performance.now(); }, 7000);
    if(reefCalm()) return;
    d.bumping = true; var y0 = b.position.y, r0 = b.rotation.y;
    view.fx.push({ t0: performance.now(), dur: 650,
      step: function(p){
        var up = Math.sin(Math.min(1, p / .5) * Math.PI) * .45, sq = p < .18 ? 1 - .25 * Math.sin(p / .18 * Math.PI) : 1 + .12 * Math.sin((p - .18) / .82 * Math.PI) * (1 - p);
        b.position.y = y0 + up; b.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); b.rotation.y = r0 + reef3dEase(p) * Math.PI * 2;
        d.mat.emissiveIntensity = (d.night ? .5 : .15) + 1.6 * Math.max(0, 1 - p * 3);   // a bright flash as it's hit
      },
      end: function(){ b.scale.set(1, 1, 1); d.bumping = false; } });
    // the burst: spinning coins arcing out, and sparkles
    var coinGeo = new THREE.CylinderGeometry(.16, .16, .05, 16), coinMat = new THREE.MeshLambertMaterial({ color: d.night ? '#bff7f0' : '#ffd24a', emissive: d.night ? '#2fbfb0' : '#7a5200', emissiveIntensity: .6 });
    var bits = [], gt = reef3dGlintTex();
    for(var i = 0; i < 7; i++){
      var c = new THREE.Mesh(coinGeo, coinMat), a = i / 7 * Math.PI * 2 + Math.random() * .4;
      c.userData.v = [Math.cos(a) * (1.1 + Math.random() * .6), 2.6 + Math.random() * 1.4, Math.sin(a) * (1.1 + Math.random() * .6)]; c.rotation.x = Math.PI / 2;
      c.position.set(s.x, y0 + .3, s.z); view.scene.add(c); bits.push(c);
    }
    for(var j = 0; j < 8; j++){
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: d.night ? '#d9fffb' : '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      var aa = j / 8 * Math.PI * 2; sp.userData.v = [Math.cos(aa) * 2.2, .8 + Math.random(), Math.sin(aa) * 2.2]; sp.position.set(s.x, y0, s.z); sp.scale.setScalar(.7); view.scene.add(sp); bits.push(sp);
    }
    view.fx.push({ t0: performance.now(), dur: 1100,
      step: function(p){ var tt = p * 1.1; bits.forEach(function(o){ var v = o.userData.v; o.position.set(s.x + v[0] * tt, y0 + .3 + v[1] * tt - 4.2 * tt * tt, s.z + v[2] * tt);
        if(o.isSprite){ o.material.opacity = 1 - p; o.scale.setScalar(.7 * (1 - p * .6)); } else { o.rotation.z += .35; o.scale.setScalar(1 - Math.max(0, p - .7) / .3); } }); },
      end: function(){ bits.forEach(function(o){ view.scene.remove(o); if(o.isSprite) o.material.dispose(); }); coinGeo.dispose(); coinMat.dispose(); } });
  }

  /* ---------- Shelly's (and Lumi's) acted moments ----------
     Short emotes layered on top of her idle swim, using classic cartoon timing: a wind-up, the action, an
     overshoot, then settling back. Each one is a pose for a point in time (p from 0 to 1); reef3dFrame adds it
     to the idle pose. Calm Motion skips them all. */
  function reef3dSeg(p, a, b){ return Math.min(1, Math.max(0, (p - a) / (b - a))); }   // 0..1 across [a, b]
  function reef3dEase(x){ return x * x * (3 - 2 * x); }
  function reef3dBounce(x){ return Math.sin(x * Math.PI); }                             // up and back down
  var REEF3D_EMOTES = {
    // hello: crouch, hop, land, then a happy wave
    hello: { dur: 1900, pose: function(p, q, t){
      var a = reef3dSeg(p, 0, .1), j = reef3dSeg(p, .1, .38), l = reef3dSeg(p, .38, .48), w = reef3dSeg(p, .42, 1);
      q.sy = 1 - .2 * reef3dBounce(a) + .16 * reef3dBounce(j) - .16 * reef3dBounce(l);
      q.y = .55 * reef3dBounce(j);
      q.wave = reef3dBounce(w) > .2 ? 1 : reef3dBounce(w) * 5;
      q.face = reef3dEase(reef3dSeg(p, .05, .3)) * (1 - reef3dEase(reef3dSeg(p, .88, 1)));   // turns to look at you
      q.rx = -.42 * reef3dBounce(w); q.rz = .14 * reef3dBounce(w); q.headX = -.18 * reef3dBounce(w);
      q.eyes = w > 0 && w < .95 ? .4 : 1;
    } },
    // dive: crouch low, then spring up and point nose-down into the deck
    dive: { dur: 760, pose: function(p, q){
      var c = reef3dSeg(p, 0, .38), j = reef3dSeg(p, .38, 1);
      q.sy = j > 0 ? 1.22 : 1 - .3 * reef3dEase(c);
      q.y = 1.5 * Math.sin(j * Math.PI * .7);
      q.rx = j > 0 ? -.45 + 1.25 * reef3dEase(j) : .18 * c;
      q.flap = 1; q.eyes = 1.25;
    } },
    // startled at a surprise: eyes wide, jump back, a shake, then a happy wiggle
    startle: { dur: 1600, pose: function(p, q){
      var j = reef3dSeg(p, .05, .3), sh = reef3dSeg(p, .3, .52), wg = reef3dSeg(p, .52, 1);
      q.y = .55 * reef3dBounce(j); q.sy = 1 + .18 * reef3dBounce(j) - .12 * reef3dBounce(sh);
      q.rx = -.35 * reef3dBounce(j);
      q.rz = .16 * Math.sin(sh * Math.PI * 6) * (1 - sh) + .12 * Math.sin(wg * Math.PI * 4) * (1 - wg);
      q.flap = j > 0 && j < 1 ? 1 : .5 * (1 - wg);
      q.eyes = p < .5 ? 1.3 : .4;
    } },
    // cheer after finishing a deck: big jump with a full spin, flippers going, a bounce on landing and a second hop
    cheer: { dur: 2300, pose: function(p, q){
      var a = reef3dSeg(p, 0, .1), j = reef3dSeg(p, .1, .5), l = reef3dSeg(p, .5, .6), h = reef3dSeg(p, .62, .82), s2 = reef3dSeg(p, .82, 1);
      q.sy = 1 - .26 * reef3dBounce(a) + .22 * reef3dBounce(j) - .28 * reef3dBounce(l) + .1 * reef3dBounce(h) - .07 * reef3dBounce(s2);
      q.y = 1.7 * reef3dBounce(j) + .4 * reef3dBounce(h);
      q.ry = Math.PI * 2 * reef3dEase(j);
      q.flap = j > 0 && j < 1 ? 1 : 0; q.wave = h > 0 && h < 1 ? 1 : 0; q.face = reef3dEase(reef3dSeg(p, .55, .7)) * (1 - reef3dEase(reef3dSeg(p, .9, 1)));
      q.eyes = p > .08 ? .4 : 1;
    } },
    // bonk: crouch, jump straight up into the ? block, drop back down and land
    bonk: { dur: 950, pose: function(p, q){
      var a = reef3dSeg(p, 0, .16), j = reef3dSeg(p, .16, .42), f = reef3dSeg(p, .46, .78), l = reef3dSeg(p, .78, 1);
      var top = REEF3D_QY - 1.25;   // the height where her head meets the block
      q.y = p < .42 ? top * (1 - Math.pow(1 - j, 2)) : p < .46 ? top : top * (1 - f * f);
      q.sy = 1 - .24 * reef3dBounce(a) + .2 * reef3dBounce(j) - .14 * reef3dBounce(reef3dSeg(p, .42, .5)) - .2 * reef3dBounce(l);
      q.rx = -.3 * reef3dBounce(j); q.flap = p > .16 && p < .8 ? 1 : 0; q.eyes = p > .44 ? .4 : 1;
    } },
    // giggle when tapped: a ticklish wiggle that fades out
    giggle: { dur: 1000, pose: function(p, q){
      var f = 1 - p;
      q.rz = .2 * Math.sin(p * Math.PI * 7) * f; q.sy = 1 + .09 * Math.sin(p * Math.PI * 5) * f;
      q.headY = .35 * Math.sin(p * Math.PI * 5) * f; q.eyes = .4; q.flap = .5 * f; q.face = reef3dBounce(Math.min(1, p * 1.6)) > .3 ? 1 : reef3dBounce(Math.min(1, p * 1.6)) / .3;
    } },
    // idle: look one way, then the other, then back
    look: { dur: 2800, pose: function(p, q){
      var a = reef3dEase(reef3dSeg(p, .05, .3)), b = reef3dEase(reef3dSeg(p, .5, .75)), c = reef3dEase(reef3dSeg(p, .85, 1));
      q.headY = .75 * a - 1.5 * b + .75 * c; q.ry = q.headY * .18; q.headX = -.1 * (a - c);
    } },
    // idle (now and then) and at the treasure chest: a little twirl
    twirl: { dur: 1300, pose: function(p, q){
      q.y = .45 * reef3dBounce(p); q.ry = Math.PI * 2 * reef3dEase(p); q.sy = 1 + .1 * reef3dBounce(p) - .1 * reef3dBounce(reef3dSeg(p, .85, 1));
      q.flap = .8; q.eyes = .4;
    } }
  };
  function reef3dEmote(view, name, after){
    if(reefCalm() || !REEF3D_EMOTES[name]){ if(after) after(); return; }
    var prev = view.emote; view.emote = { name: name, t0: performance.now(), dur: REEF3D_EMOTES[name].dur, after: after || null };
    if(prev && prev.after) prev.after();
  }
  function reef3dPose(){ return { y: 0, sy: 1, rx: 0, ry: 0, rz: 0, headY: 0, headX: 0, flap: 0, wave: 0, eyes: 1, face: 0 }; }

  // Hop along the path one space at a time; Calm motion skips straight there. Each hop crouches, springs, stretches
  // in the air and squashes on landing; heights and timing vary a little, the trip eases in and out, she turns
  // smoothly toward the next space and rocks side to side, and a trip of three or more ends with a spinning leap.
  // onHop(left) runs as each hop lands, with the number of hops still to go.
  function reef3dTravel(view, target, done, onHop, route){
    if(view.moving || target === view.at){ if(!view.moving) done(); return; }
    route = route || reef3dRoute(view.spaces, view.at, target);
    if(!route.length){ done(); return; }
    var calm = reefCalm();
    if(calm){ reef3dPlace(view, route[route.length - 1]); if(onHop) onHop(0); done(); return; }
    view.moving = true; view.emote = null;
    var from = view.at, steps = route.length, i = 0;
    var body = view.guide.userData.body, g = view.guide;
    function angTo(a, b){ return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
    function hop(){
      var a = view.spaces[i ? route[i - 1] : from], b = view.spaces[route[i]], t0 = performance.now();
      var last = i === steps - 1, edge = Math.min(i, steps - 1 - i);          // hops near the start and end are slower
      var dur = (steps > 6 ? 250 : 330) + (edge === 0 ? 90 : edge === 1 ? 35 : 0) + Math.random() * 40 + (last && steps >= 3 ? 160 : 0);
      var hgt = (.85 + Math.random() * .35) * (last && steps >= 3 ? 1.45 : 1), roll = (i % 2 ? 1 : -1) * (.1 + Math.random() * .06);
      var ship = view.spaces.ship;
      if(ship && (Math.abs(a.x) < ship.half) !== (Math.abs(b.x) < ship.half)){   // over the side of the wreck: clear the rail
        var u = Math.min(.85, Math.max(.15, (ship.half - Math.abs(a.x)) / ((Math.abs(b.x) - Math.abs(a.x)) || 1)));
        var baseY = (a.y || 0) + ((b.y || 0) - (a.y || 0)) * u, railTop = 1.7 + ship.roll * ship.half * (a.x < 0 ? -1 : 1);   // the rail's top, on the side she crosses
        hgt = Math.max(hgt, (railTop - baseY) / Math.sin(u * Math.PI)); dur += 220;
      }
      var ry0 = g.rotation.y, ry1 = ry0 + angTo(ry0, Math.atan2(b.x - a.x, b.z - a.z)), spin = last && steps >= 3 ? (Math.random() < .5 ? -1 : 1) * Math.PI * 2 : 0;
      try { Sound.bloop(400 + Math.min(i, 8) * 45, 0, .035); } catch(e){}
      (function step(now){
        var p = Math.min(1, (now - t0) / dur);
        var c = .2, l = .82;                                                  // crouch until c, airborne until l, then land
        var air = p < c ? 0 : p < l ? (p - c) / (l - c) : 1, ae = air * air * (3 - 2 * air);
        g.position.set(a.x + (b.x - a.x) * ae, .3 + (a.y || 0) + ((b.y || 0) - (a.y || 0)) * ae, a.z + (b.z - a.z) * ae);
        g.rotation.y = ry0 + (ry1 - ry0) * Math.min(1, p / c) + spin * ae;
        body.position.y = Math.sin(air * Math.PI) * hgt;
        var ys = p < c ? 1 - .22 * Math.sin(p / c * Math.PI / 2)                       // crouch
               : p < l ? (air < .25 ? .78 + (1.22 - .78) * (air / .25) : 1.22 - .22 * ((air - .25) / .75))   // spring up, stretch, relax
               : 1 - .2 * Math.sin((p - l) / (1 - l) * Math.PI);                       // squash on landing
        body.scale.set(1 / Math.sqrt(ys), ys, 1 / Math.sqrt(ys));
        body.rotation.x = p < c ? .12 * (p / c) : p < l ? -Math.cos(air * Math.PI) * .26 : .08 * (1 - (p - l) / (1 - l));   // lean in, nose up, nose down
        body.rotation.z = roll * Math.sin(Math.min(1, p / l) * Math.PI);
        if(p < 1) return requestAnimationFrame(step);
        body.position.y = 0; body.scale.set(1, 1, 1); body.rotation.x = 0; body.rotation.z = 0; g.rotation.y = ry1;
        i++; view.at = route[i - 1];
        reef3dPuff(view, b);
        if(onHop) try { onHop(steps - i); } catch(e){}
        if(i < steps) hop(); else { view.moving = false; done(); }
      })(t0);
    }
    hop();
  }

  /* ---------- Night: the board is the deck of a huge abandoned ship. Weathered planks under the path, the hull and
     its railings down both sides (with gaps where branch paths step off onto the sand), three broken masts with torn
     sails and lanterns, cannons at the rails, kelp hanging over the side, and a bow at the far end. ---------- */
  function reef3dPlankTex(THREE){
    var c = document.createElement('canvas'); c.width = 256; c.height = 512; var g = c.getContext('2d');
    var cols = ['#5b4632', '#4f3c2b', '#634c36', '#584331', '#4a3828', '#5f4934', '#533f2d', '#61493a'];
    for(var i = 0; i < 8; i++){
      g.fillStyle = cols[i]; g.fillRect(i * 32, 0, 32, 512);
      for(var j = 0; j < 4; j++){ var y = (i * 97 + j * 131) % 512; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(i * 32, y, 32, 2); g.fillStyle = 'rgba(255,230,190,.06)'; g.fillRect(i * 32, y + 2, 32, 1); }
      for(var k = 0; k < 14; k++){ g.fillStyle = 'rgba(0,0,0,' + (.05 + Math.random() * .08) + ')'; g.fillRect(i * 32 + 4 + Math.random() * 24, Math.random() * 512, 1, 20 + Math.random() * 60); }   // grain
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(i * 32, 0, 2, 512);   // the seam between planks
    }
    for(var m = 0; m < 9; m++){ var mx = Math.random() * 256, my = Math.random() * 512, rr = 10 + Math.random() * 26;   // patches of moss and silt
      var gr = g.createRadialGradient(mx, my, 0, mx, my, rr); gr.addColorStop(0, 'rgba(70,110,90,.45)'); gr.addColorStop(1, 'rgba(70,110,90,0)'); g.fillStyle = gr; g.fillRect(mx - rr, my - rr, rr * 2, rr * 2); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function reef3dSailTex(THREE){   // a torn, faded sail: holes and ragged edges are see-through
    var c = document.createElement('canvas'); c.width = 128; c.height = 128; var g = c.getContext('2d');
    g.fillStyle = '#b9b09a'; g.fillRect(0, 0, 128, 128);
    for(var s = 0; s < 6; s++){ g.fillStyle = 'rgba(80,70,50,.12)'; g.fillRect(0, s * 22 + 6, 128, 3); }
    g.globalCompositeOperation = 'destination-out';
    for(var h = 0; h < 7; h++){ g.beginPath(); var x = Math.random() * 128, y = 20 + Math.random() * 100, r = 4 + Math.random() * 12; g.moveTo(x + r, y);
      for(var a = 1; a <= 7; a++){ var an = a / 7 * Math.PI * 2, rr = r * (.6 + Math.random() * .6); g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } g.fill(); }
    g.beginPath(); g.moveTo(0, 128); for(var e = 0; e <= 16; e++) g.lineTo(e * 8, 112 + Math.random() * 16); g.lineTo(128, 128); g.fill();   // ragged bottom edge
    var t = new THREE.CanvasTexture(c); return t;
  }
  function reef3dWreckDeck(o){
    var THREE = o.THREE, d = o.deck, sp = o.spaces, M = o.M, mesh = o.mesh, B = o.B, r = o.r;
    var W = d.half * 2, zc0 = d.z0, st = d.stair, holeZ = st ? d.holeZ : d.z1, bowZ = d.z1, bowLen = d.half * 1.4;
    var UP = d.y, LOW = st ? st.low + d.y : d.y, BOT = LOW - 1.6, TOP = .35;
    // Everything on the ship goes into two groups that list together: still parts (merged and baked with the
    // scenery) and parts that glow or move. Inside them, heights are the ship's own (before the list).
    var S = new THREE.Group(), D = new THREE.Group(); S.rotation.z = D.rotation.z = Math.atan(d.roll);
    o.statics.add(S); o.scene.add(D);
    var hullM = M('#3a2c21'), trimM = M('#271d16'), railM = M('#4a3828'), mastM = M('#33261c');
    var tex = reef3dPlankTex(THREE), deckMat = function(w, l){ var t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / 4, l / 8); return new THREE.MeshLambertMaterial({ map: t, color: '#a9c2bb' }); };
    function slab(z0, z1, y, col){ var L = z0 - z1, mt = deckMat(W, L); if(col) mt.color.set(col); var m = new THREE.Mesh(new THREE.BoxGeometry(W, .5, L), mt); m.position.set(0, y - .25, (z0 + z1) / 2); m.raycast = function(){}; D.add(m); return m; }
    function glowSprite(col, size, op){ var g = new THREE.Sprite(new THREE.SpriteMaterial({ map: reef3dBlobTex(true), color: col, transparent: true, opacity: op, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); g.scale.setScalar(size); g.raycast = function(){}; return g; }
    function clear(x, z, room){ return !sp.some(function(s){ return Math.hypot(s.x - x, s.z - z) < (room || 2.2); }); }
    var out = { jellies: [], wisps: [], glints: [], flag: null, octo: null, eel: null, D: D };

    // decks: the top deck up to the broken edge, the hold floor below it (under the sand line), and the bow
    slab(zc0, holeZ, UP);
    if(st){
      slab(holeZ + 2.5, bowZ, LOW, '#4a5c57');   // the hold is darker: less light reaches down there
      for(var hl = 0; hl < 2; hl++){ var hz = holeZ - 5 - hl * (holeZ - bowZ - 6) / 2, hx = (hl % 2 ? 1 : -1) * (d.half - 1.2);   // lanterns hung in the hold
        var hlan = B.lantern(); hlan.position.set(hx, LOW, hz); hlan.scale.setScalar(.8); if(clear(hx, hz)) { D.add(hlan); o.deckObjs.push(hlan); } }
      for(var k = 0; k < 10; k++){   // the jagged edge: plank ends of different lengths, a few drooping into the hole
        var bw = W / 10, bx = -d.half + bw * (k + .5), blen = .3 + r() * 1.8, pl = mesh(new THREE.BoxGeometry(bw * .92, .16, blen), M('#4f3d2b'), bx, UP - .08, holeZ - blen / 2);
        pl.rotation.x = r() < .3 ? .25 + r() * .3 : 0; S.add(pl);
      }
      S.add(mesh(new THREE.BoxGeometry(W, 1.4, .3), M('#120d0a'), 0, UP - .95, holeZ + .15));   // the deck's broken edge, dark below the planks
      var shade = new THREE.Mesh(new THREE.PlaneGeometry(W, 7), new THREE.MeshBasicMaterial({ map: reef3dBlobTex(), color: '#000000', transparent: true, opacity: .75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      shade.rotation.x = -Math.PI / 2; shade.position.set(0, LOW + .02, holeZ - .5); shade.scale.x = 1.4; shade.raycast = function(){}; D.add(shade);   // shadow under the overhang
      for(var f = 0; f < 4; f++){ var fp = mesh(new THREE.BoxGeometry(.45, .14, 2 + r() * 1.5), M('#4a3828'), (r() - .5) * (W - 4), LOW + .2, holeZ - 2 - r() * 4); fp.rotation.set(r() * .3, r() * 3, r() * .2); if(clear(fp.position.x, fp.position.z)) S.add(fp); }   // fallen planks
    }
    var bowShape = new THREE.Shape(); bowShape.moveTo(-d.half, 0); bowShape.lineTo(d.half, 0); bowShape.lineTo(0, bowLen); bowShape.lineTo(-d.half, 0);
    var bd = new THREE.Mesh(new THREE.ShapeGeometry(bowShape), deckMat(W, bowLen)); bd.rotation.x = -Math.PI / 2; bd.position.set(0, (st ? LOW : UP), bowZ); bd.raycast = function(){}; D.add(bd);

    // the hull: tall walls from below the sand to the gunwale, a stern wall, angled bow walls, trim and rails
    var H = TOP - BOT, L = zc0 - bowZ;
    [-1, 1].forEach(function(side){
      S.add(mesh(new THREE.BoxGeometry(.5, H, L), hullM, side * (d.half + .25), (TOP + BOT) / 2, (zc0 + bowZ) / 2));
      S.add(mesh(new THREE.BoxGeometry(.6, .22, L), trimM, side * (d.half + .28), -1.2, (zc0 + bowZ) / 2));
      S.add(mesh(new THREE.BoxGeometry(.3, .16, L), railM, side * (d.half + .1), TOP + .75, (zc0 + bowZ) / 2));
      var wall = mesh(new THREE.BoxGeometry(.5, H, Math.hypot(d.half, bowLen)), hullM, side * d.half / 2, (TOP + BOT) / 2, bowZ - bowLen / 2);
      wall.rotation.y = side * Math.atan2(d.half, bowLen); S.add(wall);
    });
    S.add(mesh(new THREE.BoxGeometry(W + 1, H, .5), hullM, 0, (TOP + BOT) / 2, zc0 + .25));
    var sprit = mesh(new THREE.CylinderGeometry(.14, .2, 7, 8), railM, 0, (st ? LOW : UP) + 1.8, bowZ - bowLen - 2); sprit.rotation.x = -Math.PI / 2 + .35; S.add(sprit);
    var exits = sp.filter(function(s){ return s.branch && Math.abs(s.x) > d.half - .6; });
    function exitNear(z, side, w){ return exits.some(function(s){ return Math.abs(s.z - z) < (w || 2.4) && Math.sign(s.x) === side; }); }
    for(var z = zc0 - 1; z > bowZ + 1; z -= 1.6){
      [-1, 1].forEach(function(side){
        if(exitNear(z, side) || r() < .12) return;   // gaps where branches leave, and posts that rotted away
        S.add(mesh(new THREE.CylinderGeometry(.07, .09, .75, 6), railM, side * (d.half + .1), TOP + .38, z));
      });
    }
    // gangplanks down to the sand where a branch leaves the ship
    sp.forEach(function(s){
      if(!s.branch || Math.abs(s.x) < d.half - .6) return;
      var prev = sp[s.links[0]]; if(Math.abs(prev.x) > d.half - .6) return;
      var side = Math.sign(s.x), py = (prev.y || 0) - prev.x * d.roll, sy = d.sand, run = Math.abs(s.x) - Math.abs(prev.x) - 1.4;
      var gp = mesh(new THREE.BoxGeometry(Math.hypot(run, py - sy), .14, 1.3), M('#6b5238'), side * (d.half + run / 2 - .4), (py + sy) / 2, (prev.z + s.z) / 2);
      gp.rotation.z = side * Math.atan2(py - sy, run) * -1; S.add(gp);
    });
    // portholes glowing a ghostly green along the hull, above the sand; barnacles crusting the waterline
    var glassG = new THREE.Group(); D.add(glassG);   // every porthole's glass, merged into one draw below
    for(var pz = zc0 - 3; pz > bowZ + 2; pz -= 4.2){
      [-1, 1].forEach(function(side){
        if(exitNear(pz, side, 1.5)) return;
        var ring = mesh(new THREE.TorusGeometry(.38, .09, 6, 16), M('#8a6a2c'), side * (d.half + .52), -1.9, pz); ring.rotation.y = Math.PI / 2; S.add(ring);
        var glass = new THREE.Mesh(new THREE.CircleGeometry(.32, 16), new THREE.MeshBasicMaterial({ color: '#7cf2c4', fog: false })); glass.position.set(side * (d.half + .53), -1.9, pz); glass.rotation.y = side * Math.PI / 2; glassG.add(glass);
        if(r() < .18){ var gw = glowSprite('#56e0a8', 1.6, .35); gw.position.set(side * (d.half + .9), -1.9, pz); D.add(gw); }
      });
    }
    reefCrabMerge(glassG, []);
    for(var b = 0; b < 40; b++){ var side2 = r() < .5 ? -1 : 1, bc = mesh(new THREE.ConeGeometry(.09 + r() * .07, .14, 6), M('#7f8f86'), side2 * (d.half + .52), d.sand + .2 + r() * .9, zc0 - r() * L); bc.rotation.z = -side2 * Math.PI / 2; S.add(bc); }
    // sand that has drifted over the rails and spilled down into the hold
    for(var sd = 0; sd < 8; sd++){
      var sx = (r() < .5 ? -1 : 1) * (d.half - .8 - r() * 1.2), sz = zc0 - 2 - r() * (L - 4); if(!clear(sx, sz, 2.6)) continue;
      var lvl = st && sz < holeZ ? LOW : UP, dr = mesh(new THREE.SphereGeometry(1.4 + r(), 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#566a63'), sx, lvl - .05, sz); dr.scale.set(1, .25, 1.6); S.add(dr);
    }

    // the spiral staircase: a central post and wedge steps winding from the top deck down into the hold, a few
    // steps missing and the handrail broken in places
    if(st){
      var cx = st.cx, cz = st.cz, N = 16;
      S.add(mesh(new THREE.CylinderGeometry(.32, .38, UP - LOW + 2.2, 10), M('#6b5238'), cx, (UP + LOW) / 2 + 1.1, cz));
      var snap = mesh(new THREE.ConeGeometry(.33, .7, 10), mastM, cx + .1, UP + 2.5, cz); snap.rotation.z = .5; S.add(snap);
      for(var i = 0; i <= N; i++){
        var th = (90 + i / N * 190) * Math.PI / 180, y = UP + (LOW - UP) * Math.min(1, i / N * 190 / 180);
        var deg = 90 + i / N * 190, nearTile = [90, 150, 210, 270].some(function(a){ return Math.abs(deg - a) < 14; });
        if(!nearTile && (i === 4 || i === 11 || i === 14)){   // a broken step: just a stub, or fallen to the floor
          var stub = mesh(new THREE.BoxGeometry(.9, .16, .9), M('#4a3828'), cx + Math.cos(th) * .9, y, cz + Math.sin(th) * .9); stub.rotation.y = -th; S.add(stub); continue;
        }
        var step = mesh(new THREE.BoxGeometry(3.1, .32, 1.25), M(i % 2 ? '#8a6a48' : '#7a5d3f'), cx + Math.cos(th) * 1.9, y - .16, cz + Math.sin(th) * 1.9);
        step.rotation.y = -th; S.add(step);
        if(i % 2 === 0 && r() > .25){   // handrail posts at the outer edge; the rail between some of them is gone
          var px = cx + Math.cos(th) * 3.35, pz2 = cz + Math.sin(th) * 3.35;
          S.add(mesh(new THREE.CylinderGeometry(.06, .07, 1, 6), railM, px, y + .5, pz2));
          var th2 = (90 + (i + 2) / N * 190) * Math.PI / 180, y2 = UP + (LOW - UP) * Math.min(1, (i + 2) / N * 190 / 180);
          if(i + 2 <= N && r() > .3){
            var qx = cx + Math.cos(th2) * 3.35, qz = cz + Math.sin(th2) * 3.35, len = Math.hypot(qx - px, qz - pz2, y2 - y);
            var rail = mesh(new THREE.CylinderGeometry(.05, .05, len, 6), railM, (px + qx) / 2, (y + y2) / 2 + 1, (pz2 + qz) / 2);
            rail.lookAt(new THREE.Vector3(qx, y2 + 1, qz)); rail.rotateX(Math.PI / 2); S.add(rail);
          }
        }
      }
      var fallen = mesh(new THREE.BoxGeometry(3, .2, 1.2), M('#4f3d2b'), cx - 2.5, LOW + .15, cz - 3.4); fallen.rotation.set(.2, .7, .1); if(clear(fallen.position.x, fallen.position.z)) S.add(fallen);
      // stubs of the old deck beams sticking out of the hold walls
      for(var bz = holeZ - 4; bz > bowZ + 3; bz -= 7) [-1, 1].forEach(function(side){ var bl = 1 + r() * 1.6; S.add(mesh(new THREE.BoxGeometry(bl, .4, .4), trimM, side * (d.half - bl / 2), UP - .4, bz)); });
    }

    // masts: one on the top deck, one snapped, one rising out of the hold; each leans, with a torn sail and a lantern
    var mains = sp.slice(0, o.mainN), sailTex = reef3dSailTex(THREE);
    var sailMat = new THREE.MeshLambertMaterial({ map: sailTex, color: '#9aa9a3', transparent: true, alphaTest: .4, side: THREE.DoubleSide });
    var mastTops = [];
    [.14, .36, .82].forEach(function(fr, k){
      var s = mains[Math.round((mains.length - 1) * fr)]; if(s.stair) s = mains[Math.max(0, s.i - 2)];
      var side = s.x > 0 ? -1 : 1, mx = Math.max(-d.half + 1.6, Math.min(d.half - 1.6, s.x + side * 3.6)), mz = s.z - 1.2;
      var base = st && mz < holeZ ? LOW : UP, broken = k === 1, h = (broken ? 5 : 13) + (base === LOW ? 4 : 0), lean = side * .07;
      var mast = new THREE.Group(); mast.position.set(mx, base, mz); mast.rotation.z = lean; S.add(mast);
      (out.masts = out.masts || []).push({ x: mx, z: mz });   // the camera steps around these (see reef3dCamTarget)
      mast.add(mesh(new THREE.CylinderGeometry(.26, .4, h, 10), mastM, 0, h / 2, 0));
      S.add(mesh(new THREE.CylinderGeometry(.62, .62, .3, 10), trimM, mx, base + .15, mz));
      if(broken){ var stub2 = mesh(new THREE.CylinderGeometry(.24, .26, 7, 10), mastM, mx - side * 3.4, base + .4, mz + 1.4); stub2.rotation.set(0, .5, side * (Math.PI / 2 - .1)); if(clear(stub2.position.x, stub2.position.z, 3.6)) S.add(stub2); return; }
      var yard = mesh(new THREE.CylinderGeometry(.11, .11, 7, 8), mastM, 0, Math.max(h * .72 + .8, UP - base + 9.9), 0); yard.rotation.z = Math.PI / 2; yard.rotation.y = .25; mast.add(yard);
      mast.add(mesh(new THREE.CylinderGeometry(.85, .6, .7, 12, 1, true), M('#3f3024', { side: THREE.DoubleSide }), 0, h - .8, 0));
      var sailY = Math.max(base + h * .72 - 1.6, UP + 7.6);   // every sail's foot sits well above the top deck, where the fish swim
      var sail = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.6, 8, 4), sailMat); sail.position.set(mx, sailY, mz + .2); sail.rotation.set(0, .25, lean);
      var sa = sail.geometry.attributes.position; for(var v = 0; v < sa.count; v++) sa.setZ(v, Math.sin((sa.getX(v) + 3.1) / 6.2 * Math.PI) * .5);
      sail.geometry.computeVertexNormals(); sail.raycast = function(){}; D.add(sail);
      var lan = B.lantern(); lan.position.set(mx + side * .55, base + 3.3, mz + .5); lan.scale.setScalar(.7); D.add(lan); o.deckObjs.push(lan);
      mastTops.push({ x: mx, z: mz, top: base + h, base: base, side: side });
    });
    // the pirate flag on the tallest mast: black, with a white seashell and crossed anchors (no skull)
    var tall = mastTops.reduce(function(a, m){ return !a || m.top > a.top ? m : a; }, null);
    if(tall){
      var fc = document.createElement('canvas'); fc.width = 256; fc.height = 160; var fg = fc.getContext('2d');
      fg.fillStyle = '#16181c'; fg.fillRect(0, 0, 256, 160); fg.strokeStyle = '#f2efe6'; fg.fillStyle = '#f2efe6'; fg.lineWidth = 9; fg.lineCap = 'round';
      [[-1], [1]].forEach(function(q){ fg.save(); fg.translate(128, 80); fg.rotate(q[0] * .7); fg.beginPath(); fg.moveTo(0, -58); fg.lineTo(0, 52); fg.moveTo(-14, -44); fg.lineTo(14, -44); fg.stroke();
        fg.beginPath(); fg.arc(0, 40, 22, .15 * Math.PI, .85 * Math.PI); fg.stroke(); fg.beginPath(); fg.arc(0, -64, 8, 0, Math.PI * 2); fg.stroke(); fg.restore(); });   // two crossed anchors
      fg.beginPath(); fg.moveTo(128, 104); for(var fa = 0; fa <= 8; fa++){ var an = Math.PI + fa / 8 * Math.PI; fg.lineTo(128 + Math.cos(an) * 34, 104 + Math.sin(an) * 34); } fg.closePath(); fg.fill();   // a scallop shell
      fg.strokeStyle = '#16181c'; fg.lineWidth = 4; for(var fr2 = 1; fr2 < 8; fr2++){ var a2 = Math.PI + fr2 / 8 * Math.PI; fg.beginPath(); fg.moveTo(128, 104); fg.lineTo(128 + Math.cos(a2) * 32, 104 + Math.sin(a2) * 32); fg.stroke(); }
      var flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6, 12, 4), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide }));
      flag.geometry.translate(1.3, 0, 0); flag.position.set(tall.x, tall.top - .3, tall.z); flag.userData.rest = flag.geometry.attributes.position.array.slice(); flag.raycast = function(){}; D.add(flag); out.flag = flag;
    }
    // an octopus that has made the first mast its home: a head in the crow's nest, tentacles curling down the mast
    var om = mastTops[0];
    if(om){
      var octo = new THREE.Group(); octo.position.set(om.x, om.base, om.z); D.add(octo);
      var oM = M('#7b4a9a'), sM = M('#e8b6d6');
      var head = mesh(new THREE.SphereGeometry(.85, 20, 14), oM, 0, om.top - om.base - .1, .1); head.scale.set(1, 1.15, 1); octo.add(head);
      [-.3, .3].forEach(function(ex){ var eye = mesh(new THREE.SphereGeometry(.2, 12, 8), M('#fff6d8'), ex, om.top - om.base - .05, .82); octo.add(eye); var pu = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#13202a' })); pu.position.set(ex, om.top - om.base - .08, .98); octo.add(pu); });
      var tents = [], arms = new THREE.Group(); octo.add(arms);
      for(var t = 0; t < 4; t++){
        var pts = [], ph = t / 4 * Math.PI * 2, top2 = om.top - om.base - .9;
        for(var q = 0; q <= 24; q++){ var u = q / 24, ang = ph + u * Math.PI * 3.2, rr = .42 + (t % 2 ? .05 : 0), yy = top2 - u * (top2 - 1.2); pts.push(new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr)); }
        var tip = pts[pts.length - 1]; pts.push(new THREE.Vector3(tip.x * 2.2, tip.y - .1, tip.z * 2.2), new THREE.Vector3(tip.x * 2.8, tip.y + .5, tip.z * 2.8));   // the tip curls outward
        var tg = new THREE.Group(), curve = new THREE.CatmullRomCurve3(pts);
        tg.add(mesh(new THREE.TubeGeometry(curve, 60, .13, 8), oM));
        for(var su = 1; su < 14; su++){ var pp = curve.getPointAt(su / 14), sk = mesh(new THREE.SphereGeometry(.055, 6, 5), sM, pp.x * 1.25, pp.y, pp.z * 1.25); tg.add(sk); }
        arms.add(tg);
      }
      reefCrabMerge(arms, []); tents.push(arms);
      reefCrabMerge(octo, tents);   // head and eyes together; the tentacles sway on their own
      out.octo = { g: octo, tents: tents };
    }
    // the captain's cabin at the stern, beside the start: warm light in its windows, a door, a bell and the wheel
    var startX = sp[0].x, cabSide = startX > 0 ? -1 : 1, cabX = cabSide * (d.half - 3), cabZ = zc0 - 4;
    if(clear(cabX, cabZ, 3.4)){
      S.add(mesh(new THREE.BoxGeometry(4.6, 2.8, 3.6), M('#3b2c22'), cabX, UP + 1.4, cabZ));
      var roof = mesh(new THREE.BoxGeometry(5.2, .28, 4.2), M('#241a14'), cabX, UP + 2.95, cabZ); roof.rotation.z = cabSide * .06; S.add(roof);
      S.add(mesh(new THREE.BoxGeometry(.9, 1.7, .1), M('#2a1f17'), cabX + cabSide * 1.2, UP + .85, cabZ + 1.81));
      var wins = new THREE.Group(); D.add(wins);
      [[-.6, 1.82, 0], [.9, 1.82, 0], [0, 0, 1]].forEach(function(w, i){
        var win = new THREE.Mesh(new THREE.PlaneGeometry(.9, .8), new THREE.MeshBasicMaterial({ color: '#ffcf70', fog: false }));
        if(w[2]){ win.position.set(cabX - cabSide * 2.31, UP + 1.6, cabZ); win.rotation.y = -cabSide * Math.PI / 2; }
        else win.position.set(cabX - cabSide * w[0], UP + 1.6, cabZ + w[1]);
        wins.add(win);
        var mul = mesh(new THREE.BoxGeometry(.08, .8, .04), trimM, win.position.x, win.position.y, win.position.z + (w[2] ? 0 : .02)); mul.rotation.y = win.rotation.y; S.add(mul);
        var hg = glowSprite('#ffb648', 2.4, .55); hg.position.copy(win.position); hg.position.z += w[2] ? 0 : .4; hg.position.x += w[2] ? -cabSide * .4 : 0; D.add(hg); out.glints.push(hg);
      });
      reefCrabMerge(wins, []);
      var wheel = B.wheel(r); wheel.position.set(cabX, UP + 3.1, cabZ + .4); wheel.scale.setScalar(.8); S.add(wheel);
      S.add(mesh(new THREE.CylinderGeometry(.08, .08, 2, 6), railM, cabX - cabSide * 2.9, UP + 1, cabZ + 1.4));
      var bell = mesh(new THREE.LatheGeometry([new THREE.Vector2(0, .5), new THREE.Vector2(.18, .48), new THREE.Vector2(.26, .2), new THREE.Vector2(.36, 0)], 16), M('#b88a2c', { side: THREE.DoubleSide }), cabX - cabSide * 2.9, UP + 1.45, cabZ + 1.4); S.add(bell);
    }
    // the treasure-strewn hold: spilled chests, heaps of gold, goblets, gems and pearls
    var holdZ0 = st ? holeZ - 1 : zc0 - L * .6, holdZ1 = bowZ + 1, lvlT = st ? LOW : UP, gold = M('#e2b13c');
    for(var tn = 0, tries = 0; tn < Math.round((holdZ0 - holdZ1) / 2.2) && tries < 300; tries++){
      var tx = (r() - .5) * (W - 3), tz = holdZ1 + r() * (holdZ0 - holdZ1); if(!clear(tx, tz, 2.3)) continue; tn++;
      var kind = tn % 5, obj = new THREE.Group();
      if(kind === 0){ obj.add(mesh(new THREE.ConeGeometry(.75 + r() * .4, .55, 14), gold, 0, .27, 0)); for(var cc = 0; cc < 6; cc++){ var cn = mesh(new THREE.CylinderGeometry(.12, .12, .03, 10), gold, (r() - .5) * 2, .03, (r() - .5) * 2); cn.rotation.x = r() * .4; obj.add(cn); } }
      else if(kind === 1){ var ch = (o.models && reef3dModel(o.models, 'chest', .9, o.kit.grad)) || B.treasure(r); obj.add(ch); obj.rotation.z = (r() - .5) * .4;
        if(out.glints.length < 6){ var cg = glowSprite('#ffd36a', 2.2, .4); cg.position.set(tx, lvlT + .8, tz); D.add(cg); out.glints.push(cg); } }
      else if(kind === 2){ obj.add(mesh(new THREE.LatheGeometry([new THREE.Vector2(.2, 0), new THREE.Vector2(.06, .1), new THREE.Vector2(.05, .35), new THREE.Vector2(.22, .55), new THREE.Vector2(.24, .75)], 14), M('#d9a933', { side: THREE.DoubleSide }))); if(r() < .5) obj.rotation.z = Math.PI / 2 - .2; }
      else if(kind === 3){ var gm = o.models && reef3dModel(o.models, r() < .5 ? 'gemPink' : 'gemBlue', .45, o.kit.grad); if(gm){ gm.position.y = .2; obj.add(gm); } }
      else { for(var pr = 0; pr < 7; pr++) obj.add(mesh(new THREE.SphereGeometry(.08, 8, 6), M('#f4efe6'), (r() - .5) * 1.2, .08, (r() - .5) * 1.2)); obj.add(mesh(new THREE.BoxGeometry(.9, .55, .7), M('#5a4330'), 0, .27, 0)); }
      obj.position.set(tx, lvlT, tz); obj.rotation.y = r() * 6;
      S.add(obj);
    }
    // cargo, rope and cannons on the top deck
    for(var cz2 = zc0 - 6, ci = 0; cz2 > (st ? holeZ + 2 : bowZ + 4); cz2 -= 8, ci++){
      [-1, 1].forEach(function(side){
        if(exitNear(cz2, side, 3)) return;
        var cn2 = (o.models && reef3dModel(o.models, 'cannon', .9, o.kit.grad)) || B.cannon(r);
        cn2.position.set(side * (d.half - 1), UP, cz2); cn2.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; S.add(cn2);
        if((ci + (side > 0 ? 1 : 0)) % 2){ var kp = B.kelp(r); kp.position.set(side * (d.half + .5), d.sand, cz2 + 3); kp.scale.setScalar(.9); S.add(kp); }
      });
    }
    for(var n = 0, tr = 0; n < Math.round(L / 7) && tr < 300; tr++){
      var x = (r() - .5) * (W - 3), z2 = bowZ + 2 + r() * (L - 4); if(!clear(x, z2)) continue; n++;
      var lv = st && z2 < holeZ ? LOW : UP, pick = r(), ob;
      if(pick < .45) ob = (o.models && reef3dModel(o.models, r() < .5 ? 'crate' : 'barrel', .8 + r() * .4, o.kit.grad)) || B.plank(r);
      else if(pick < .7){ ob = new THREE.Group(); var coil = mesh(new THREE.TorusGeometry(.42, .13, 8, 20), M('#8f7a58'), 0, .13, 0); coil.rotation.x = Math.PI / 2; ob.add(coil); var c2 = mesh(new THREE.TorusGeometry(.26, .12, 8, 16), M('#8f7a58'), 0, .3, 0); c2.rotation.x = Math.PI / 2; ob.add(c2); }
      else ob = B.plank(r);
      ob.position.set(x, lv, z2); ob.rotation.y = r() * 6; S.add(ob);
    }
    // an eel peeking out of a hole in the hull, with glowing eyes
    var eelSide = -cabSide, eelZ = (st ? holeZ - 6 : zc0 - L * .5);
    if(!exitNear(eelZ, eelSide, 3)){
      S.add(mesh(new THREE.CircleGeometry(.55, 14), new THREE.MeshBasicMaterial({ color: '#05090b' }), eelSide * (d.half + .53), -2.5, eelZ).rotateY(eelSide * Math.PI / 2));
      var eel = new THREE.Group(); eel.position.set(eelSide * (d.half + .5), -2.5, eelZ); D.add(eel);
      var eb = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(eelSide * .8, .3, .2), new THREE.Vector3(eelSide * 1.4, .9, 0)]);
      eel.add(mesh(new THREE.TubeGeometry(eb, 20, .2, 8), M('#4f6b3a')));
      var eh = mesh(new THREE.SphereGeometry(.26, 12, 10), M('#5b7a42'), eelSide * 1.5, 1, 0); eh.scale.set(1.3, .9, .9); eel.add(eh);
      [-.1, .1].forEach(function(ez){ var ey = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff27a', fog: false })); ey.position.set(eelSide * 1.62, 1.1, ez); eel.add(ey); });
      reefCrabMerge(eel, []); out.eel = eel;
    }
    // jellyfish drifting over the deck, and ghost lights wandering about the masts
    var jellyCols = ['#ff8fd0', '#7fe9ff', '#b78cff', '#9effc8'];
    for(var j = 0; j < 5; j++){
      var jg = new THREE.Group(), col = jellyCols[j % jellyCols.length];
      var bell2 = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, fog: false, depthWrite: false }));
      jg.add(bell2);
      for(var tt = 0; tt < 5; tt++){ var ten = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.1, 4), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, depthWrite: false })); var ta = tt / 5 * Math.PI * 2; ten.position.set(Math.cos(ta) * .22, -.55, Math.sin(ta) * .22); jg.add(ten); }
      reefCrabMerge(jg, [bell2]);
      jg.traverse(function(c){ c.raycast = function(){}; });
      jg.userData = { x: (r() - .5) * (W - 2), y: 2.5 + r() * 3, z: zc0 - r() * L, ph: r() * 6, sp: .3 + r() * .4, bell: bell2 };
      o.scene.add(jg); out.jellies.push(jg);
    }
    for(var g2 = 0; g2 < 5; g2++){ var wsp = glowSprite('#8dffd0', .9 + r() * .6, .5); var mt = mastTops[g2 % Math.max(1, mastTops.length)] || { x: 0, z: zc0 - 5, top: 6, base: UP };
      wsp.userData = { x: mt.x, z: mt.z, y: mt.base + 2 + r() * (Math.min(mt.top, UP + 4.4) - mt.base - 2), ph: r() * 6, rad: 1.5 + r() * 2.5 }; o.scene.add(wsp); out.wisps.push(wsp); }   // kept under the sails
    return out;
  }
  // Every frame at night: jellyfish pulse and drift (staying near her, like the bubbles), ghost lights wander and
  // flicker, the flag ripples, the octopus's tentacles sway, the eel bobs and the treasure glints.
  function reef3dWreckTick(view, t){
    var w = view.wreck; if(!w) return;
    var g = view.guide.position;
    w.jellies.forEach(function(j, i){
      var u = j.userData, z = g.z + 8 - (((g.z + 8 - u.z) % 30) + 30) % 30;
      j.position.set(u.x + Math.sin(t * .2 + u.ph) * 1.5, u.y + (g.y - .3) * .7 + Math.sin(t * u.sp + u.ph) * .5, z);
      var pulse = 1 + .12 * Math.sin(t * 2.2 + u.ph); u.bell.scale.set(pulse, 1 / pulse, pulse);
    });
    w.wisps.forEach(function(s){ var u = s.userData; s.position.set(u.x + Math.cos(t * .4 + u.ph) * u.rad, u.y + Math.sin(t * .7 + u.ph) * .6, u.z + Math.sin(t * .4 + u.ph) * u.rad); s.material.opacity = .25 + .3 * (.5 + .5 * Math.sin(t * 3 + u.ph * 3)); });
    if(w.flag){ var a = w.flag.geometry.attributes.position, rest = w.flag.userData.rest; for(var i = 0; i < a.count; i++){ var x = rest[i * 3]; a.setZ(i, Math.sin(x * 2.2 - t * 3) * .18 * (x / 2.6)); } a.needsUpdate = true; }
    if(w.octo) w.octo.tents.forEach(function(tg, i){ tg.rotation.y = Math.sin(t * .6 + i * 1.7) * .12; });
    if(w.eel){ w.eel.rotation.y = Math.sin(t * .9) * .25; w.eel.position.y = -2.5 + Math.sin(t * 1.3) * .08; }
    w.glints.forEach(function(s, i){ s.material.opacity = .3 + .25 * (.5 + .5 * Math.sin(t * 2.5 + i * 1.9)); });
  }

  /* ---------- Day: a vibrant reef. Bright coral borders both sides of the path (brain coral, staghorn, sea fans,
     sponges, clams and anemones in hot pink, orange, yellow, violet and aqua), denser gardens further out, tufts of
     seagrass, and clownfish darting in and out of the anemones. ---------- */
  var REEF_VIVID = ['#ff6f91', '#ff9f43', '#ffd23f', '#9b7bff', '#3ddc97', '#ff4f81', '#38c9f2', '#d36bfa', '#ff8a5c'];
  function reef3dReefGarden(o){
    var THREE = o.THREE, sp = o.spaces, M = o.M, mesh = o.mesh, B = o.B, r = o.r, st = o.statics, out = { clowns: [] };
    var kinds = ['brain', 'staghorn', 'fan', 'sponge', 'anemone', 'clam', 'staghorn', 'brain', 'fan'];
    function tint(g){ var col = REEF_VIVID[Math.floor(r() * REEF_VIVID.length)], alt = REEF_VIVID[Math.floor(r() * REEF_VIVID.length)], n = 0;
      g.traverse(function(m){ if(m.isMesh && m.material && !m.material.transparent){ m.material = M(n++ % 3 === 2 ? alt : col, m.material.side === THREE.DoubleSide ? { side: THREE.DoubleSide } : undefined); } }); return g; }
    function free(x, z, room){ return !sp.some(function(s){ return Math.hypot(s.x - x, s.z - z) < (room || 2); }) && !(o.taken || []).some(function(t){ return Math.hypot(t[0] - x, t[1] - z) < 1.3; }); }
    var anemones = [];
    function plant(kind, x, z, sc){
      var g = B[kind](r); if(kind !== 'clam') tint(g);
      g.position.set(x, o.groundY(x, z) + .1, z); g.rotation.y = r() * 6; g.scale.multiplyScalar(sc); st.add(g);
      (o.taken = o.taken || []).push([x, z]);
      if(kind === 'anemone') anemones.push(g.position.clone());
    }
    // borders: a coral or two beside every space on the main path, on the side away from its deck decoration
    sp.slice(0, o.mainN).forEach(function(s, i){
      var nx = sp[Math.min(i + 1, o.mainN - 1)], dx = nx.x - s.x, dz = nx.z - s.z, dl = Math.hypot(dx, dz) || 1, px = -dz / dl, pz = dx / dl;
      [-1, 1].forEach(function(side){
        if(r() < .5) return;
        var off = 2.5 + r() * 1.3, x = s.x + px * off * side, z = s.z + pz * off * side + (r() - .5);
        if(free(x, z, 2.1)) plant(kinds[Math.floor(r() * kinds.length)], x, z, .45 + r() * .3);
      });
    });
    // gardens further out
    for(var n = 0, tries = 0; n < 0 && tries < o.mainN * 12; tries++){
      var x = (r() < .5 ? -1 : 1) * (4.5 + r() * 9), z = 6 - r() * (o.mainN * 2.6 + 12);
      if(!free(x, z, 3)) continue; n++;
      plant(kinds[Math.floor(r() * kinds.length)], x, z, .6 + r() * .6);
    }
    // seagrass tufts
    var grassM = M('#3fb37a');
    for(var g2 = 0, t2 = 0; g2 < o.mainN && t2 < o.mainN * 10; t2++){
      var gx = (r() - .5) * 26, gz = 6 - r() * (o.mainN * 2.6 + 12); if(!free(gx, gz, 1.8)) continue; g2++;
      var tuft = new THREE.Group(); for(var b = 0; b < 5; b++){ var bl = mesh(new THREE.ConeGeometry(.05, .7 + r() * .5, 4), grassM, (r() - .5) * .4, .35, (r() - .5) * .4); bl.rotation.set((r() - .5) * .5, 0, (r() - .5) * .5); tuft.add(bl); }
      tuft.position.set(gx, o.groundY(gx, gz), gz); st.add(tuft);
    }
    // clownfish: orange with white stripes, circling an anemone each
    anemones.slice(0, 6).forEach(function(a, k){
      var f = new THREE.Group(), body = mesh(new THREE.SphereGeometry(.16, 12, 8), M('#ff7a1a'), 0, 0, 0); body.scale.set(1, .8, 1.6); f.add(body);
      [-.1, .08].forEach(function(z){ var band = mesh(new THREE.CylinderGeometry(.15, .15, .05, 12), M('#ffffff'), 0, 0, z); band.rotation.x = Math.PI / 2; band.scale.set(1, 1, .8); f.add(band); });
      var tail = mesh(new THREE.ConeGeometry(.1, .18, 4), M('#ff7a1a'), 0, 0, -.3); tail.rotation.x = -Math.PI / 2; f.add(tail);
      f.userData = { cx: a.x, cy: a.y + .7, cz: a.z, ph: k * 1.7, rad: .55 + (k % 2) * .2 };
      f.traverse(function(m){ m.raycast = function(){}; });
      o.scene.add(f); out.clowns.push(f);
    });
    return out;
  }
  function reef3dReefTick(view, t){
    var rf = view.reefFx; if(!rf) return;
    rf.clowns.forEach(function(f){ var u = f.userData, a = t * 1.3 + u.ph, x = u.cx + Math.cos(a) * u.rad, z = u.cz + Math.sin(a) * u.rad;
      f.position.set(x, u.cy + Math.sin(t * 3 + u.ph) * .08, z); f.rotation.y = -a; });
  }

