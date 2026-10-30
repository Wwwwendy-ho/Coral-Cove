  /* ---------- OCEAN THEME module (from Coral Calendar) ----------
     Ocean.apply(on) switches the look. It's on for every profile and screen (a profile can opt out in Settings). Adds the moving
     sea behind the page (caustics, light rays, bubbles), marine life crossing every 9–23 s, a water ring where
     you press, rising bubbles on right answers, and a flurry of bubbles when a Daily Plan activity starts. */
  var Ocean = (function(){
    function reduced(){ try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } }
    let flurryOn=false;
    /* A flurry of bubbles rising from the bottom, thick enough in the middle to hide the screen for a moment while
       the activity changes underneath. Each bubble is one pre-drawn sprite, scaled, so it stays smooth on the iPhone XS. */
    function flurry(){if(flurryOn||matchMedia("(prefers-reduced-motion: reduce)").matches)return false;flurryOn=true;
      const cv=document.createElement("canvas");cv.className="flurry";document.body.appendChild(cv);const ctx=cv.getContext("2d"),dpr=Math.min(2,devicePixelRatio||1);
      const W=innerWidth,H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.scale(dpr,dpr);
      const cs=getComputedStyle(document.documentElement),dark=themeNow()==="dark",foam=cs.getPropertyValue("--foam").trim()||"#DCF1F3";
      const sp=document.createElement("canvas"),R=64;sp.width=sp.height=R*2;const g=sp.getContext("2d");
      const body=g.createRadialGradient(R*.8,R*.75,R*.1,R,R,R);
      body.addColorStop(0,dark?"rgba(120,200,220,.10)":"rgba(255,255,255,.35)");body.addColorStop(.75,dark?"rgba(90,170,200,.22)":"rgba(225,246,250,.55)");body.addColorStop(1,dark?"rgba(150,220,240,.55)":"rgba(255,255,255,.95)");
      g.fillStyle=body;g.beginPath();g.arc(R,R,R-2,0,6.283);g.fill();
      g.strokeStyle=dark?"rgba(170,230,245,.7)":"rgba(255,255,255,.95)";g.lineWidth=3;g.stroke();
      g.fillStyle=dark?"rgba(220,250,255,.6)":"rgba(255,255,255,.95)";g.beginPath();g.ellipse(R*.62,R*.55,R*.2,R*.11,-.7,0,6.283);g.fill();
      const N=Math.round(Math.min(650,W*H/900)),T=2800,mid=T*.48,bubs=[];
      for(let i=0;i<N;i++){const r=8+Math.pow(Math.random(),1.6)*54,dur=1500+Math.random()*700,g2=(Math.random()+Math.random()+Math.random()-1.5)/1.5;
        // each bubble is timed to be somewhere on screen at the midpoint, so the screen is fullest then
        bubs.push({x:Math.random()*W,r,d:Math.max(0,Math.min(T-dur,mid-dur*Math.random()+g2*260)),dur,ph:Math.random()*6.28,wob:3+Math.random()*10});}
      bubs.sort((p,q)=>p.r-q.r);   // small ones behind
      const t0=performance.now();
      function frame(now){const e=now-t0,k=e/T;ctx.clearRect(0,0,W,H);
        ctx.globalAlpha=(dark?.7:.6)*Math.pow(Math.sin(Math.min(1,k)*Math.PI),2);ctx.fillStyle=dark?"#04141C":foam;ctx.fillRect(0,0,W,H);
        ctx.globalAlpha=1;
        for(const p of bubs){const u=(e-p.d)/p.dur;if(u<0||u>1)continue;
          const y=H+p.r-(H+2*p.r)*(u*u*.35+u*.65),x=p.x+Math.sin(u*7+p.ph)*p.wob,s=p.r*(1+.06*Math.sin(u*18+p.ph));
          ctx.drawImage(sp,x-s,y-s,s*2,s*2);}
        if(e<T)requestAnimationFrame(frame);else{cv.remove();flurryOn=false;}}
      try{Sound.bubbles(6);}catch(e){}
      requestAnimationFrame(frame);return true;}
    
    function dropRing(x,y,big){const r=document.createElement("span");r.className="dropring"+(big?" big":"");r.style.left=x+"px";r.style.top=y+"px";document.body.appendChild(r);setTimeout(()=>r.remove(),700);}
    function riseBubbles(x,y,n){for(let i=0;i<n;i++){const b=document.createElement("span");b.className="risebub";const sz=5+Math.random()*7;b.style.cssText=`left:${x+(Math.random()*30-15)}px;top:${y}px;width:${sz}px;height:${sz}px;--dx:${(Math.random()*30-15).toFixed(0)}px;animation-delay:${(i*45)}ms`;document.body.appendChild(b);setTimeout(()=>b.remove(),1300+i*45);}}
    const SEALIFE={
      light:[{k:"school",w:170,h:80,t:[28,40],o:.34},{k:"turtle",w:130,h:84,t:[38,52],o:.32},{k:"ray",w:170,h:85,t:[32,44],o:.26},{k:"jelly",w:56,h:70,t:[34,46],o:.32,up:true},{k:"whale",w:360,h:144,t:[60,80],o:.13},{k:"school",w:110,h:55,t:[22,30],o:.2}],
      dark:[{k:"lantern",w:150,h:70,t:[30,42],o:.75},{k:"angler",w:90,h:68,t:[44,58],o:.7},{k:"squid",w:130,h:48,t:[26,36],o:.6},{k:"glowjelly",w:52,h:66,t:[36,48],o:.7,up:true},{k:"lantern",w:120,h:60,t:[26,34],o:.75}]};
    function lifeSvg(k){
      if(k==="school"||k==="lantern"){let h="";for(let i=0;i<9;i++){const x=(i%3)*34+(i>2?14:0)+Math.random()*8,y=Math.floor(i/3)*20+Math.random()*6,sc=.75+Math.random()*.4;h+=`<svg class="mlf" style="left:${x}%;top:${y}%;width:${20*sc}%;animation-delay:${(Math.random()*.6).toFixed(2)}s" viewBox="0 0 20 10"><use href="#ml-fish"/>${k==="lantern"?'<circle class="glow" cx="12" cy="6" r="1"/><circle class="glow" cx="9" cy="6.4" r=".9"/><circle class="glow" cx="15" cy="4" r=".9"/>':""}</svg>`;}return h;}
      const id={turtle:"ml-turtle",ray:"ml-ray",whale:"ml-whale",angler:"ml-angler",squid:"ml-squid",jelly:"i-jelly",glowjelly:"i-jelly"}[k];
      return `<svg class="mlone" viewBox="${{turtle:"0 0 100 64",ray:"0 0 120 60",whale:"0 0 200 80",angler:"0 0 80 60",squid:"0 0 110 40",jelly:"0 0 64 80",glowjelly:"0 0 64 80"}[k]}"><use href="#${id}"/></svg>`;}
    let lifeT=null,lifeN=0;
    function spawnLife(){clearTimeout(lifeT);if(!document.documentElement.classList.contains("ocean"))return;lifeT=setTimeout(spawnLife,9000+Math.random()*14000);
      const box=document.getElementById("sealife");if(!box||document.hidden||lifeN>=2||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      const pool=SEALIFE[themeNow()==="dark"?"dark":"light"],c=pool[Math.floor(Math.random()*pool.length)],el=document.createElement("div");
      const sc=Math.min(1.25,Math.max(.6,innerWidth/900)),w=c.w*sc,h=c.h*sc,dur=c.t[0]+Math.random()*(c.t[1]-c.t[0]),ltr=Math.random()<.6;
      el.className="critter c-"+c.k+(c.up?" up":ltr?" ltr":" rtl");el.style.cssText=`width:${w}px;height:${h}px;--o:${c.o};--dur:${dur.toFixed(1)}s;--y:${(8+Math.random()*72).toFixed(1)}vh;--x:${(6+Math.random()*80).toFixed(1)}vw`;
      el.innerHTML=`<div class="bob">${lifeSvg(c.k)}</div>`;box.appendChild(el);lifeN++;
      let gone=false;const done=()=>{if(gone)return;gone=true;el.remove();lifeN=Math.max(0,lifeN-1);};
      el.addEventListener("animationend",e=>{if(e.target===el)done();});setTimeout(done,(dur+1)*1000);}
    document.addEventListener("visibilitychange",()=>{const b=document.getElementById("sealife");if(b)b.classList.toggle("paused",document.hidden);});
    var DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <symbol id="i-star" viewBox="0 0 48 48"><path d="M24 4l5.6 13.2 14.3 1.2-10.9 9.4 3.3 14-12.3-7.5-12.3 7.5 3.3-14L4.1 18.4l14.3-1.2z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="24" r="1.6" fill="currentColor"/><circle cx="24" cy="15" r="1.2" fill="currentColor"/><circle cx="31" cy="21" r="1.2" fill="currentColor"/><circle cx="17" cy="21" r="1.2" fill="currentColor"/></symbol>
    <symbol id="i-shell" viewBox="0 0 48 48"><path d="M24 42c-9-1-17-8-17-18C7 13 15 6 24 6s17 7 17 18c0 10-8 17-17 18z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 42V8M24 42L13 11M24 42l11-31M24 42L8 20M24 42l16-22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="ml-fish" viewBox="0 0 20 10"><path d="M19 5C16 .5 9 .5 6 5c3 4.5 10 4.5 13 0zM6 5L.5 1v8z" fill="currentColor"/></symbol>
<symbol id="ml-turtle" viewBox="0 0 100 64"><g fill="currentColor"><ellipse cx="48" cy="32" rx="26" ry="18"/><ellipse cx="80" cy="30" rx="9" ry="7"/><path d="M58 18c8-14 22-16 28-12-6 4-14 10-22 18zM58 46c8 14 22 16 28 12-6-4-14-10-22-18zM30 20c-8-10-18-12-24-8 6 3 12 8 20 14zM30 44c-8 10-18 12-24 8 6-3 12-8 20-14zM22 32l-12-4v8z"/></g><g fill="none" stroke="var(--sea-mid)" stroke-width="1.6" opacity=".55"><path d="M36 20l12 12 12-12M36 44l12-12 12 12M30 32h36"/></g></symbol>
<symbol id="ml-ray" viewBox="0 0 120 60"><path d="M60 8c10 0 18 8 26 16 10 10 22 14 32 14-12 4-24 4-36 0-8-3-14-2-18 4-4 6-6 10-6 10s-2-4-6-10c-4-6-10-7-18-4-12 4-24 4-36 0 10 0 22-4 32-14C42 16 50 8 60 8z M58 46c0 6-1 10-2 14" fill="currentColor"/></symbol>
<symbol id="ml-whale" viewBox="0 0 200 80"><path d="M10 44c10-20 40-30 80-30 40 0 70 10 86 26 6 6 8 14 0 18-12 6-40 8-80 8-30 0-56-4-70-10-6 2-14 8-22 14 2-8 4-14 8-18-6-4-6-6-2-8zM150 18c4-8 14-12 22-10-6 2-10 6-12 12zM150 18c-2-8 0-14 6-16-2 6-2 10 0 16z" fill="currentColor"/></symbol>
<symbol id="ml-angler" viewBox="0 0 80 60"><g fill="currentColor"><circle cx="38" cy="34" r="20"/><path d="M18 34L2 22v24z"/></g><path d="M42 14c6-12 18-12 22-4" fill="none" stroke="currentColor" stroke-width="2"/><circle class="glow" cx="64" cy="11" r="4"/><path d="M44 40l3 6 3-6 3 6 3-6" fill="none" stroke="var(--ink)" stroke-width="1.2" opacity=".5"/></symbol>
<symbol id="ml-squid" viewBox="0 0 110 40"><g fill="currentColor"><path d="M108 20c-10-12-34-14-52-10-6 2-10 6-10 10s4 8 10 10c18 4 42 2 52-10z"/><path d="M48 14C34 8 18 6 2 10c12 2 24 4 36 8M48 20C32 20 16 22 2 20c14-2 28-2 40-2M48 26C34 32 18 34 2 30c12-2 24-4 36-8" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></g><g class="glow"><circle cx="70" cy="20" r="1.8"/><circle cx="80" cy="16" r="1.6"/><circle cx="80" cy="24" r="1.6"/><circle cx="92" cy="20" r="1.8"/></g></symbol>
<symbol id="i-jelly" viewBox="0 0 64 80"><path d="M8 34C8 18 19 8 32 8s24 10 24 26c-5 3-9-1-12 2s-6-1-12 1-7-3-12-1-9 1-12-2z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M18 38c-3 8 3 12 0 20s2 12 0 16M28 38c2 9-3 13 0 21s-2 11 0 15M38 38c-2 8 3 12 0 20s2 11 0 16M47 37c3 8-2 12 1 19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="i-fish" viewBox="0 0 64 36"><path d="M6 18c8-12 26-15 40-6l12-8-3 14 3 14-12-8C32 33 14 30 6 18z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="17" cy="16" r="2" fill="currentColor"/><path d="M28 10c3 5 3 11 0 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="i-bubbles" viewBox="0 0 32 48"><circle cx="16" cy="38" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="20" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="21" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
    <symbol id="i-wave" viewBox="0 0 240 16" preserveAspectRatio="none"><path d="M0 8c15 0 15-6 30-6s15 6 30 6 15-6 30-6 15 6 30 6 15-6 30-6 15 6 30 6 15-6 30-6 15 6 30 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></symbol>
  </defs>
</svg>`;
    var SEA = `<div class="sea" aria-hidden="true"><div class="sealife" id="sealife"></div><div class="caustic"></div><div class="rays"></div><div class="bubbles"><i style="--x:6%;--s:8px;--d:0s;--t:19s"></i><i style="--x:14%;--s:5px;--d:6s;--t:23s"></i><i style="--x:23%;--s:10px;--d:11s;--t:27s"></i><i style="--x:37%;--s:6px;--d:3s;--t:21s"></i><i style="--x:48%;--s:4px;--d:14s;--t:25s"></i><i style="--x:58%;--s:9px;--d:8s;--t:29s"></i><i style="--x:67%;--s:5px;--d:1s;--t:22s"></i><i style="--x:76%;--s:7px;--d:16s;--t:26s"></i><i style="--x:85%;--s:11px;--d:5s;--t:31s"></i><i style="--x:93%;--s:5px;--d:10s;--t:24s"></i><i style="--x:31%;--s:4px;--d:19s;--t:28s"></i><i style="--x:71%;--s:6px;--d:22s;--t:30s"></i></div></div>`;
    var lastX = innerWidth/2, lastY = innerHeight/2;
    function isOn(){ return document.documentElement.classList.contains('ocean'); }
    function apply(on){
      var root = document.documentElement;
      if(on === isOn()) return;
      root.classList.toggle('ocean', !!on);
      var sea = document.getElementById('oceanSea'), defs = document.getElementById('oceanDefs');
      if(on){
        if(!defs){ var d = document.createElement('div'); d.id = 'oceanDefs'; d.innerHTML = DEFS; document.body.insertBefore(d, document.body.firstChild); }
        if(!sea){ var w = document.createElement('div'); w.id = 'oceanSea'; w.innerHTML = SEA; document.body.insertBefore(w.firstElementChild, document.body.firstChild); w.firstElementChild; }
        var s = document.querySelector('.sea'); if(s) s.id = 'oceanSea';
        clearTimeout(lifeT); lifeN = 0; setTimeout(spawnLife, 2500);
      } else {
        clearTimeout(lifeT);
        var s2 = document.getElementById('oceanSea'); if(s2) s2.remove();
        var d2 = document.getElementById('oceanDefs'); if(d2) d2.remove();
      }
    }
    // A water ring wherever a button or card is pressed; remember where, for the answer bubbles.
    document.addEventListener('pointerdown', function(e){
      lastX = e.clientX; lastY = e.clientY;
      if(!isOn() || reduced()) return;
      var t = e.target && e.target.closest && e.target.closest('button, .flip-card, .choice-btn, .ms-word, [data-listen-idx], .deck-card, .pm-cell');
      if(t && !t.disabled) dropRing(e.clientX, e.clientY, t.matches('.btn-primary, .plan-go'));
    }, true);
    return {
      apply: apply,
      isOn: isOn,
      flurry: function(){ return isOn() && flurry(); },   // true when it plays
      bubbles: function(n){ if(isOn() && !reduced()) riseBubbles(lastX, lastY, n || 6); }
    };
  })();


  var OUTCOME_ROW_HTML = '' +
    '<div class="grade-row outcome-row" style="position:relative;z-index:1;">' +
      '<button class="grade-btn grade-wrong" data-outcome="wrong"><span class="emoji">🦀</span>Not quite</button>' +
      '<button class="grade-btn grade-right" data-outcome="right"><span class="emoji">🐬</span>Got it right!</button>' +
    '</div>';

  // On Hard difficulty, the simple right/wrong self-report is replaced with real Anki-style
  // self-grading — four options describing how hard the card actually was, same spirit as Anki's
  // own Again/Hard/Good/Easy buttons. The child's own tap IS the rating here, so it also bypasses
  // autoRating()'s response-time guesswork for these two modes (flip and read) while Hard is on.
  var ANKI_ROW_HTML = '' +
    '<div class="grade-row" style="position:relative;z-index:1;">' +
      '<button class="grade-btn grade-again" data-rating="again"><span class="emoji">🦀</span>Again</button>' +
      '<button class="grade-btn grade-hard" data-rating="hard"><span class="emoji">🐢</span>Hard</button>' +
      '<button class="grade-btn grade-good" data-rating="good"><span class="emoji">🐬</span>Good</button>' +
      '<button class="grade-btn grade-easy" data-rating="easy"><span class="emoji">🐳</span>Easy</button>' +
    '</div>';

  function outcomeRowHTML(){
    return currentDifficulty().id === 'hard' ? ANKI_ROW_HTML : OUTCOME_ROW_HTML;
  }

  // The read-only "swipe back" view of the one card the kid most recently answered. No inputs are
  // interactive here — it's a look, not a redo — so there's no route to change a grade already
  // recorded. Mirrors the live layout for each mode, just frozen in its answered state.
  function buildPeekInner(rec){
    var badge = rec.correct
      ? '<div class="peek-badge peek-right">✅ That one was right!</div>'
      : '<div class="peek-badge peek-wrong">🦀 That one was marked not quite</div>';
    var body;
    var photoHTML = rec.photoUrl ? '<img class="card-photo" src="'+esc(rec.photoUrl)+'" alt="">' : '';
    if(rec.mode === 'choice' || rec.mode === 'match' || rec.mode === 'blank' || rec.mode === 'timedchoice' || rec.mode === 'listen' || rec.mode === 'hanja' || rec.mode === 'numsys'){
      var optsHTML = (rec.choiceOptions||[]).map(function(opt){
        var cls = 'choice-btn';
        if(opt === rec.back) cls += ' correct';
        else if(opt === rec.chosenText) cls += ' wrong';
        return '<button type="button" class="'+cls+'" disabled>'+esc(opt)+'</button>';
      }).join('');
      var peekLabel = rec.mode === 'blank' ? '📝 Last question' : (rec.mode === 'match' ? '🧲 Last question' : (rec.mode === 'timedchoice' ? '⏱️ Last question' : (rec.mode === 'listen' ? '👂 Last question' : rec.mode === 'hanja' ? '🀄 Last question' : rec.mode === 'numsys' ? '🔢 Last question' : '🔘 Last question')));
      body = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face"><div class="read-label">'+peekLabel+'</div>'+photoHTML+'<div class="card-text">'+esc(rec.front)+'</div></div>' +
        '</div>' +
        '<div class="choice-row">'+optsHTML+'</div>';
    } else if(rec.mode === 'echo' || rec.mode === 'build'){
      body = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">'+(rec.mode === 'echo' ? '🎙️ Last question' : '🧩 Last question')+'</div>' + photoHTML +
            '<div class="card-text">'+esc(rec.front)+'</div>' +
            (rec.back ? '<div class="echo-meaning">'+esc(rec.back)+'</div>' : '') +
          '</div>' +
        '</div>';
    } else if(rec.mode === 'read' || rec.mode === 'blend'){
      body = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="face face-front read-face">' +
            '<div class="read-label">'+(rec.mode === 'blend' ? '🐚 Last question' : '🗣️ Last question')+'</div>' +
            photoHTML +
            '<div class="card-text">'+esc(rec.front)+'</div>' +
            (rec.mode !== 'blend' && rec.note?'<div class="card-note dim">'+esc(rec.note)+'</div>':'') +
          '</div>' +
        '</div>';
    } else {
      body = '' +
        '<div class="flip-scene" style="position:relative;z-index:1;">' +
          '<div class="flip-card flipped">' +
            '<div class="face face-front">'+photoHTML+'<div class="card-text">'+esc(rec.front)+'</div></div>' +
            '<div class="face face-back"><div class="card-text">'+esc(rec.back)+'</div>'+(rec.note && String(rec.back||'').trim().toLowerCase() !== String(rec.front||'').trim().toLowerCase()?'<div class="card-note">'+esc(rec.note)+'</div>':'')+'</div>' +
          '</div>' +
        '</div>';
    }
    return '' +
      '<div class="peek-wrap">' +
        body +
        badge +
        '<div class="flip-hint" style="position:relative;z-index:1;">⬆️ Swipe up (or tap) to continue</div>' +
      '</div>';
  }

  // Drag-to-swipe, TikTok style: live-follows the finger, snaps back if it doesn't commit. The
  // direction is asymmetric on purpose. Forward can never be dragged, because answering is the only
  // way past the current card. Backward only reaches the one card just answered. It commits on
  // distance or on a quick flick (release speed), same as the feeds. The pull stretches out softly past
  // DRAG_SOFT instead of stopping dead at a hard wall.
  function wireSwipe(stageEl){
    if(!stageEl) return;
    var dragging = false, startY = 0, dy = 0, activePointerId = null;
    var DRAG_SOFT = 90, DRAG_MAX = 150, COMMIT = 72, FLICK_V = 0.34, FLICK_MIN = 26;
    var vel = makeVelocityTracker();
    function canPeekBack(){ return !S.peeking && !!S.lastAnsweredCard && !S.transitioning; }
    function canReturnForward(){ return S.peeking && !S.transitioning; }
    function pointY(e){ return e.touches && e.touches.length ? e.touches[0].clientY : e.clientY; }
    function stretch(d){ // 1:1 up to DRAG_SOFT, then a rubber-band tail that tops out at DRAG_MAX
      var a = Math.abs(d), s = d < 0 ? -1 : 1;
      if(a <= DRAG_SOFT) return d;
      return s * Math.min(DRAG_MAX, DRAG_SOFT + (a - DRAG_SOFT) * 0.35);
    }
    // Track the drag on `document` rather than relying on setPointerCapture: this keeps
    // following the finger/mouse even if it drifts outside the card bounds mid-swipe, and
    // guarantees onUp always fires (no stuck drag state) regardless of where the release lands.
    function onDown(e){
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      if(S.transitioning || (!canPeekBack() && !canReturnForward())) return;
      dragging = true; dy = 0; startY = pointY(e);
      vel.reset(startY);
      activePointerId = e.pointerId != null ? e.pointerId : null;
      stageEl.style.animation = 'none'; // don't fight the entrance animation with a live drag transform
      stageEl.classList.add('stage-dragging');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function onMoveRaw(y){
      dy = y - startY;
      vel.push(y);
      var t;
      // The allowed direction follows the finger; the blocked one only budges a little, as a hint.
      if(dy >= 0){ t = canPeekBack() ? stretch(dy) : stretch(dy) * 0.22; }
      else { t = canReturnForward() ? stretch(dy) : stretch(dy) * 0.22; }
      stageEl.style.transform = 'translate3d(0,'+t+'px,0)';
    }
    function onMove(e){
      if(!dragging) return;
      if(activePointerId != null && e.pointerId != null && e.pointerId !== activePointerId) return;
      onMoveRaw(pointY(e));
      if(e.cancelable) e.preventDefault();
    }
    function onUp(e){
      if(!dragging) return;
      if(activePointerId != null && e && e.pointerId != null && e.pointerId !== activePointerId) return;
      dragging = false;
      activePointerId = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      stageEl.classList.remove('stage-dragging');
      var v = (e && e.type === 'pointercancel') ? 0 : vel.velocity();
      var goBack = canPeekBack() && dy > 0 && ((dy > COMMIT && v > -FLICK_V * 0.8) || (v >= FLICK_V && dy >= FLICK_MIN));
      var goForward = canReturnForward() && dy < 0 && ((dy < -COMMIT && v < FLICK_V * 0.8) || (v <= -FLICK_V && dy <= -FLICK_MIN));
      // A real drag (even one that snaps back short of the threshold) shouldn't also be read as
      // a tap by the peek view's tap-to-return handler, which fires right after via 'click'.
      stageEl.__justDragged = Math.abs(dy) > 6;
      stageEl.style.transform = '';
      if(goBack) peekBack();
      else if(goForward) returnFromPeek();
      else {
        stageEl.classList.add('stage-snapback');
        setTimeout(function(){ stageEl.classList.remove('stage-snapback'); }, 380);
      }
      dy = 0;
    }
    stageEl.addEventListener('pointerdown', onDown);
    // Guard against the browser starting a native text/element drag mid-swipe, which can steal
    // the gesture and stop delivering further pointer events to us.
    stageEl.addEventListener('dragstart', function(e){ e.preventDefault(); });
    // Trackpad/mouse wheel as a desktop equivalent of the swipe, one step per gesture (see
    // wheelStep). Scrolling up (fingers pulled down) reveals the card above, which is the one just
    // answered. Scrolling down returns to the live card. This used to be the other way round.
    stageEl.addEventListener('wheel', function(e){
      var r = wheelStep(e, function(dir){ return dir < 0 ? canPeekBack() : canReturnForward(); });
      if(r.consumed) e.preventDefault();
      if(r.dir < 0) peekBack();
      else if(r.dir > 0) returnFromPeek();
    }, { passive:false });
  }

  function peekBack(){
    if(S.transitioning || S.peeking || !S.lastAnsweredCard) return;
    S.transitioning = true;
    var stageEl = app.querySelector('.stage');
    if(stageEl) stageEl.classList.add('stage-exit-down');
    setTimeout(function(){
      S.transitioning = false;
      S.peeking = true;
      render();
    }, 200);
  }

  function returnFromPeek(){
    if(S.transitioning || !S.peeking) return;
    S.transitioning = true;
    var stageEl = app.querySelector('.stage');
    if(stageEl) stageEl.classList.add('stage-exit');
    setTimeout(function(){
      S.transitioning = false;
      S.peeking = false;
      render();
    }, 200);
  }

  function pointInRect(rect, x, y){
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  // Drag-to-answer interaction shared by 'match' and 'blank' card modes. Built on Pointer Events
  // (not native HTML5 drag/drop, which touch browsers support inconsistently) so the same code
  // handles mouse and touch alike: a tile follows the pointer via a CSS transform while held, and
  // on release either snaps into the drop zone (grading the card) or springs back to the tile row.
  // A plain tap (no real movement) drops the tile directly too, both for accessibility and so the
  // whole interaction stays usable with a simple click in automated tests.
  function wireDragTiles(card, cardMode){
    var ds = S.dragState;
    if(!ds) return;
    var dropZone = app.querySelector('[data-drop-zone]');
    if(!dropZone) return;

    function commitDrop(idx){
      if(ds.dropped != null || S.transitioning) return;
      ds.dropped = idx;
      var chosen = ds.options[idx];
      var correct = chosen === card.back;
      ds.correct = correct;
      var elapsed = Date.now() - (S.cardShownAt || Date.now());
      if(correct) Sound.correct(); else Sound.wrong();
      // Child Mode: read the tile that was just dropped aloud, right or wrong -- same rule as choice mode.
      if(!S.managingDecks) Speech.speak(chosen);
      render();
      setTimeout(function(){ grade(autoRating(cardMode, correct, elapsed), true); }, correct ? 650 : 1100 + WRONG_EXTRA_MS);
    }

    app.querySelectorAll('[data-drag-idx]').forEach(function(tile){
      var idx = parseInt(tile.dataset.dragIdx, 10);
      var startX = 0, startY = 0, dragging = false, activePid = null;

      tile.addEventListener('click', function(){
        if(tile.__justDragged){ tile.__justDragged = false; return; }
        commitDrop(idx);
      });

      tile.addEventListener('pointerdown', function(e){
        // Keep the tile's drag from also starting the study stage's swipe-back gesture underneath
        // it (dragging a tile downward used to flip the screen to the previous card) -- same fix as
        // the Sound Blend slider.
        e.stopPropagation();
        if(ds.dropped != null) return;
        activePid = e.pointerId;
        startX = e.clientX; startY = e.clientY;
        dragging = false;
      });
      tile.addEventListener('pointermove', function(e){
        if(activePid == null || e.pointerId !== activePid || ds.dropped != null) return;
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if(!dragging && Math.sqrt(dx*dx + dy*dy) > 6){
          dragging = true;
          tile.__justDragged = true;
          tile.classList.add('dragging');
          try { tile.setPointerCapture(activePid); } catch(err){}
        }
        if(dragging){
          tile.style.transform = 'translate('+dx+'px,'+dy+'px)';
          dropZone.classList.toggle('drag-over', pointInRect(dropZone.getBoundingClientRect(), e.clientX, e.clientY));
        }
      });
      function endDrag(e){
        if(activePid == null || (e && e.pointerId !== activePid)) return;
        var wasDragging = dragging;
        activePid = null; dragging = false;
        tile.classList.remove('dragging');
        dropZone.classList.remove('drag-over');
        if(wasDragging){
          var overZone = e && pointInRect(dropZone.getBoundingClientRect(), e.clientX, e.clientY);
          tile.style.transform = '';
          if(overZone) commitDrop(idx);
          // Missed the zone -- the transform reset above springs the tile back to its place in the
          // (still-flowing) tile row; nothing else to do until the next attempt.
        }
      }
      tile.addEventListener('pointerup', endDrag);
      tile.addEventListener('pointercancel', endDrag);
    });
  }

  /* ---------- timed multiple choice ("Timed choice" mode) ----------
     A sixth per-card mode, alongside flip/read/choice/match/blank: same multiple-choice interaction
     as 'choice' mode, but a visible countdown bar forces an answer before time runs out (at which
     point the correct option highlights itself and the card is graded as a miss), plus a "+time"
     button that adds a few more seconds without penalty. Built with Korean vocab practice in mind
     (see the "Korean Speed Quiz" decks), but it's a generic mode any deck can use.

     Direction alternates in groups rather than being fixed or fully random per card: every
     TIMED_CHOICE_GROUP_SIZE cards, a coin flip decides whether the next stretch of cards asks
     "front as the question, back-side text as the answer" (fwd -- e.g. "How do you say ___ in
     Korean?" with Korean options) or the reverse (rev -- e.g. shows the Korean word, English
     options). A card's own `choices` field (if the deck author filled one in) is only used for the
     forward direction, since it was written as alternatives to `back`; the reverse direction, and
     any card with no manual choices at all, draws its wrong answers from OTHER cards in the same
     deck instead -- which is also what lets a plain flip-mode deck (like Wendy's Korean Vocabulary,
     with no choices authored at all) be quizzed as multiple choice with zero extra data entry. */
  var TIMED_CHOICE_GROUP_SIZE = 3;   // how many cards in a row share the same question direction before re-rolling
  var TIMED_CHOICE_BASE_SECONDS = 6; // starting point before the length/difficulty adjustments below
  var TIMED_CHOICE_MIN_SECONDS = 5;
  var TIMED_CHOICE_MAX_SECONDS = 15;
  var TIMED_CHOICE_ADD_SECONDS = 5;  // how much the "+time" button adds, per tap
  var TIMED_CHOICE_MAX_ADDS = 2;      // the "+time" button can only be used twice per card

  // Longer text to read (either side) earns more time to scan the options, and a card the learner
  // has actually struggled with (per the SM-2 stats every card already tracks -- lapses, leech
  // status, learning state, and the plain timesCorrect/timesSeen accuracy ratio) earns more too.
  // A short, well-known word gets the tightest timer; a long phrase the learner keeps missing gets
  // the most breathing room. Always clamped to a sane range so it never feels impossibly short or
  // pointlessly long.
  // A card can carry its own fixed countdown instead (card.tcSeconds, set from the editor's "Timer"
  // field) -- meant for longer, worked problems (e.g. a math quiz at 60 or 120 seconds) where the
  // automatic 5-15 second vocab timing makes no sense. The "+time" button then scales with it:
  // card.tcAddSeconds if set, otherwise about a quarter of the timer rounded to 5s (60s -> +15s,
  // 120s -> +30s), still capped at TIMED_CHOICE_MAX_ADDS uses per card.
  function timedChoiceCustomSeconds(card){
    var s = parseInt(card && card.tcSeconds, 10);
    return (s && s > 0) ? Math.max(5, Math.min(600, s)) : 0;
  }
  function timedChoiceAddSeconds(card){
    if(!timedChoiceCustomSeconds(card)) return TIMED_CHOICE_ADD_SECONDS;
    var a = parseInt(card.tcAddSeconds, 10);
    if(a && a > 0) return Math.min(300, a);
    return Math.max(5, Math.round(timedChoiceCustomSeconds(card) / 4 / 5) * 5);
  }
  function formatSecondsLeft(ms){
    var s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  }

  function timedChoiceSeconds(card, promptText, answerText){
    var custom = timedChoiceCustomSeconds(card);
    if(custom) return custom;
    var textLen = Math.max(String(promptText||'').length, String(answerText||'').length);
    var readingBonus = Math.max(0, (textLen - 6) * 0.22);
    var struggleBonus = 0;
    if(card.isLeech) struggleBonus = 4;
    else if((card.lapses||0) >= 2 || card.state === 'learning') struggleBonus = 2;
    else if(card.timesSeen){
      var acc = (card.timesCorrect||0) / card.timesSeen;
      if(acc < 0.5) struggleBonus = 3;
      else if(acc < 0.8) struggleBonus = 1;
    }
    var seconds = TIMED_CHOICE_BASE_SECONDS + readingBonus + struggleBonus;
    return Math.max(TIMED_CHOICE_MIN_SECONDS, Math.min(TIMED_CHOICE_MAX_SECONDS, Math.round(seconds)));
  }

  // Builds a fresh { direction, prompt, answer, options } for a card just entering 'timedchoice'
  // mode -- re-rolling the shared direction every TIMED_CHOICE_GROUP_SIZE cards, then sourcing wrong
  // answers from the card's own `choices` (forward direction only) or, failing that, from sibling
  // cards' opposite field in S.timedChoiceAllCards.
  function buildTimedChoiceRound(card){
    // A card with its own hand-written wrong answers is a real question (e.g. "Factor 6x² + 7x − 3"),
    // not a two-sided vocab pair -- flipping it would show the answer as the question and other cards'
    // questions as options, which is nonsense. Those cards always ask front -> back and don't use up a
    // slot in the shared direction streak. Plain vocab cards (no manual choices) mix directions as before.
    var hasManualChoices = !!(card.choices && card.choices.length);
    var direction;
    if(hasManualChoices){
      direction = 'fwd';
    } else {
      if(S.timedChoiceGroupLeft <= 0){
        S.timedChoiceDirection = Math.random() < 0.5 ? 'fwd' : 'rev';
        S.timedChoiceGroupLeft = TIMED_CHOICE_GROUP_SIZE;
      }
      S.timedChoiceGroupLeft -= 1;
      direction = S.timedChoiceDirection;
    }
    var promptText = direction === 'fwd' ? card.front : card.back;
    var answerText = direction === 'fwd' ? card.back : card.front;
    var siblingField = direction === 'fwd' ? 'back' : 'front';
    var wrongOpts = (direction === 'fwd' && card.choices && card.choices.length) ? card.choices.slice() : null;
    if(!wrongOpts || !wrongOpts.length){
      var siblings = (S.timedChoiceAllCards || []).filter(function(c){ return c.id !== card.id; });
      wrongOpts = shuffle(siblings).map(function(c){ return c[siblingField]; })
        .filter(function(v, idx, arr){ return v && v !== answerText && arr.indexOf(v) === idx; })
        .slice(0, 3);
    }
    var seconds = timedChoiceSeconds(card, promptText, answerText);
    return {
      cardId: card.id,
      direction: direction,
      prompt: promptText,
      answer: answerText,
      options: shuffle([answerText].concat(wrongOpts)),
      selected: null,
      totalSeconds: seconds,
      deadline: Date.now() + seconds*1000,
      secondsAdded: 0,
      timesAdded: 0,
      addSeconds: timedChoiceAddSeconds(card),
      custom: !!timedChoiceCustomSeconds(card),
      expired: false
    };
  }

  function timedChoiceTimerHTML(tc){
    var remaining = Math.max(0, tc.deadline - Date.now());
    var totalMs = (tc.totalSeconds + tc.secondsAdded) * 1000;
    var pct = totalMs > 0 ? Math.max(0, Math.min(100, (remaining/totalMs)*100)) : 0;
    var addsLeft = TIMED_CHOICE_MAX_ADDS - (tc.timesAdded||0);
    var addSecs = tc.addSeconds || TIMED_CHOICE_ADD_SECONDS;
    var addBtnHTML = addsLeft > 0 ?
      '<button type="button" class="btn btn-ghost tc-addtime-btn" data-act="tc-add-time">⏱️ +'+addSecs+'s</button>' :
      '<button type="button" class="btn btn-ghost tc-addtime-btn" disabled>⏱️ No more time</button>';
    return '' +
      '<div class="tc-timer-row" style="position:relative;z-index:1;">' +
        '<div class="tc-timer-track"><div class="tc-timer-fill'+(pct < 30 ? ' tc-low' : '')+'" id="tcTimerFill" style="width:'+pct+'%"></div></div>' +
        (tc.custom ? '<span class="tc-time-left" id="tcTimeLeft">'+formatSecondsLeft(remaining)+'</span>' : '') +
        addBtnHTML +
      '</div>';
  }

  // The fixed 2.5s/6s "fast/slow" thresholds are for quick vocab cards -- on a card with its own long
  // timer (e.g. 120 seconds for a worked problem) every correct answer would count as "slow". Those
  // cards scale the thresholds to their own timer instead: first 35% = fast, up to 75% = normal.
  function timedChoiceRating(tc, correct, elapsed){
    if(!correct || !tc || !tc.custom) return autoRating('timedchoice', correct, elapsed);
    var algo = S.settings.algorithm || 'sm2_speed';
    if(algo !== 'sm2_speed') return 'good';
    var total = tc.totalSeconds * 1000;
    if(elapsed <= total * 0.35) return 'easy';
    if(elapsed <= total * 0.75) return 'good';
    return 'hard';
  }

  function clearTimedChoiceTimer(){
    if(S.timedChoiceTimerHandle){ clearInterval(S.timedChoiceTimerHandle); S.timedChoiceTimerHandle = null; reefMusicUpdate(); }   // back to the deck song
  }

  // Drives the countdown bar via direct DOM updates (not render()) every 100ms so it animates
  // smoothly without re-rendering the whole screen every tick. Self-cancels the moment anything
  // about the situation has changed underneath it (a different card, an answer already picked, the
  // view navigated away) rather than relying on every possible exit path to clear it explicitly.
  function wireTimedChoiceTimer(card){
    clearTimedChoiceTimer();
    S.timedChoiceTimerHandle = setInterval(function(){
      var tc = S.timedChoiceState;
      if(S.view !== 'study' || !tc || tc.cardId !== card.id || tc.selected != null || tc.expired){
        clearTimedChoiceTimer();
        return;
      }
      var remaining = tc.deadline - Date.now();
      var totalMs = (tc.totalSeconds + tc.secondsAdded) * 1000;
      var fillEl = document.getElementById('tcTimerFill');
      if(fillEl){
        var pct = totalMs > 0 ? Math.max(0, Math.min(100, (remaining/totalMs)*100)) : 0;
        fillEl.style.width = pct + '%';
        fillEl.classList.toggle('tc-low', pct < 30);
      }
      var leftEl = document.getElementById('tcTimeLeft');
      if(leftEl) leftEl.textContent = formatSecondsLeft(remaining);
      if(remaining <= 0){
        tc.expired = true;
        clearTimedChoiceTimer();
        Sound.wrong();
        render();
        var elapsed = (tc.totalSeconds + tc.secondsAdded) * 1000;
        setTimeout(function(){ grade(timedChoiceRating(tc, false, elapsed), true); }, 1400 + WRONG_EXTRA_MS);
      }
    }, 100);
    // the timer song's kalimba ticks once a second: start it in step with this card's countdown
    var tc0 = S.timedChoiceState;
    if(tc0 && !tc0.reefCalm) reefMusicTimerSync(tc0.deadline - (tc0.totalSeconds + tc0.secondsAdded) * 1000);
  }

  /* ---------- sound-out blend ("Blend" mode) ----------
     A seventh per-card mode, alongside flip/read/choice/match/blank/timedchoice: front-only, like
     read mode (no grading of a specific answer -- self-reported via the usual outcome row). The
     card's front word is broken into "sound chunks" (c-a-t, or sh-i-p if a parent types those in
     manually) and shown as a row of dim letter tiles under a horizontal slider. Dragging the slider
     handle from left to right lights up each chunk in turn as the handle passes it, speaking that
     chunk's sound as it lights -- a classic "blend the sounds together" phonics exercise -- and once
     the handle reaches the far right, the whole word is spoken once to conclude it. A card's own
     `blendChunks` field (if a parent filled one in, comma-separated in the editor) is used only when
     present; otherwise chunks are auto-generated from the front text (see autoBlendChunks below), so
     -- same philosophy as Timed Choice's auto-distractors -- the mode works immediately on any card
     with zero extra setup, and can be hand-tuned later for trickier digraphs/blends. */
  // A multi-word phrase blends word-by-word (dragging through "How are you?" lights up How, then are,
  // then you?); a single word blends letter-by-letter -- Array.from() splits by Unicode code point,
  // not UTF-16 code unit, so this also gives exactly one chunk per Hangul syllable block for Korean
  // words for free (each syllable block, e.g. 안, is one code point), not a mangled half-character.
  function autoBlendChunks(word){
    var str = String(word||'').trim();
    if(!str) return [];
    if(/\s/.test(str)) return str.split(/\s+/).filter(Boolean);
    return Array.from(str);
  }
