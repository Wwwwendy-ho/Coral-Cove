  /* ---------- REEF WORLD: every deck is its own spot in one scrolling reef (a shipwreck at night) ---------- */
  function reefNight(){ try { return themeNow() === 'dark'; } catch(e){ return false; } }
  var REEF_ZONE_NAMES = {
    day:   { reading:'Kelp Library', math:'Number Reef', korean:'Lantern Reef', science:'Bubble Lab', life:'Sandy Town', other:'Coral Garden', all:'The Reef' },
    night: { reading:'Captain\'s Library', math:'Cargo Hold', korean:'Lantern Deck', science:'Engine Room', life:'Galley', other:'Crow\'s Nest', all:'The Wreck' }
  };
  function reefDeckKind(d){
    return d.feedMode ? 'Watch' : d.storyMode ? 'Story' : d.equationMode ? 'Solve' : d.langFeedMode ? 'Words' : d.readAlongMode ? 'Read' : d.flashFeedMode ? 'Flip' : d.miniStoryMode ? 'Pictures' : null;
  }
  function reefHash(s){ var h = 7; s = String(s); for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function reefZones(){
    var live = S.decks.filter(function(d){ return !d.archived; });
    var tabs = buildSubjectTabs(live) || [{ id:'all', label:'Decks' }];
    return tabs.map(function(t){
      var decks = t.id === 'all' ? live : live.filter(function(d){ return (d.subject ? subjectMeta(d.subject).id : 'other') === t.id; });
      decks = decks.slice().sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
      var items = decks.map(function(d){
        var dc = S.dueCounts[d.id] || { due:0, total:0 };
        var kind = reefDeckKind(d);
        var state = dc.total === 0 ? 'empty' : (kind ? 'feed' : (dc.due > 0 ? 'ready' : 'done'));
        return { d: d, dc: dc, kind: kind, state: state };
      }).filter(function(x){ return x.state !== 'empty'; });
      var place = reefPlaceFor(t.id === 'all' ? 'other' : t.id, t.label);
      return { id: t.id, label: t.label, place: place, items: items };
    }).filter(function(z){ return z.items.length; });
  }

  /* Shared shading for every object: one hidden <svg> of gradients the objects point at. */
  function reefDefsSVG(){
    return '<svg class="rw-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="rwBrain" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd1c2"/><stop offset=".45" stop-color="#ff8f73"/><stop offset="1" stop-color="#b8432c"/></radialGradient>' +
      '<linearGradient id="rwStag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb3c1"/><stop offset=".5" stop-color="#ff6f86"/><stop offset="1" stop-color="#b63655"/></linearGradient>' +
      '<radialGradient id="rwFan" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#e2d4ff"/><stop offset=".55" stop-color="#9b7be0"/><stop offset="1" stop-color="#5a3fa8"/></radialGradient>' +
      '<linearGradient id="rwClamOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1e8"/><stop offset=".6" stop-color="#cfc6ad"/><stop offset="1" stop-color="#8d846b"/></linearGradient>' +
      '<radialGradient id="rwClamIn" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#7fe3ff"/><stop offset=".6" stop-color="#2a8fc9"/><stop offset="1" stop-color="#1b4f86"/></radialGradient>' +
      '<radialGradient id="rwPearl" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f3eee6"/><stop offset="1" stop-color="#bdb3a3"/></radialGradient>' +
      '<linearGradient id="rwTube" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a5a1f"/><stop offset=".35" stop-color="#ffd27a"/><stop offset=".7" stop-color="#e8a33a"/><stop offset="1" stop-color="#8a4f1c"/></linearGradient>' +
      '<linearGradient id="rwTube2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a2f5a"/><stop offset=".35" stop-color="#ff9fd0"/><stop offset=".7" stop-color="#d9559a"/><stop offset="1" stop-color="#6e2350"/></linearGradient>' +
      '<linearGradient id="rwAnem" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#6b2fa0"/><stop offset="1" stop-color="#f6a6ff"/></linearGradient>' +
      '<radialGradient id="rwSand" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#fff2cc"/><stop offset=".7" stop-color="#ecd08f"/><stop offset="1" stop-color="#c9a45a"/></radialGradient>' +
      '<linearGradient id="rwWoodTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b98a52"/><stop offset="1" stop-color="#7b5228"/></linearGradient>' +
      '<linearGradient id="rwWoodL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5b2c"/><stop offset="1" stop-color="#4e3015"/></linearGradient>' +
      '<linearGradient id="rwWoodR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e3b1a"/><stop offset="1" stop-color="#2c1a09"/></linearGradient>' +
      '<linearGradient id="rwBarrel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3d2510"/><stop offset=".35" stop-color="#a87443"/><stop offset=".65" stop-color="#7b5228"/><stop offset="1" stop-color="#2c1a09"/></linearGradient>' +
      '<linearGradient id="rwIron" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7d8a8f"/><stop offset=".5" stop-color="#3e4a50"/><stop offset="1" stop-color="#1c2428"/></linearGradient>' +
      '<linearGradient id="rwRust" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9773d"/><stop offset="1" stop-color="#5e2c12"/></linearGradient>' +
      '<linearGradient id="rwCannon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d9aa0"/><stop offset=".4" stop-color="#4b585e"/><stop offset="1" stop-color="#151c20"/></linearGradient>' +
      '<radialGradient id="rwGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e9fffb"/><stop offset=".35" stop-color="#7ff5e3"/><stop offset="1" stop-color="#7ff5e3" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="rwSilt" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#4b5d63"/><stop offset="1" stop-color="#1a262b"/></radialGradient>' +
      '<linearGradient id="rwBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset=".5" stop-color="#c99a2e"/><stop offset="1" stop-color="#6e4f10"/></linearGradient>' +
    '</defs></svg>';
  }
  var RW_LINE = 'stroke="#0b2b33" stroke-opacity=".22" stroke-width="2" stroke-linejoin="round"';
  // Each object stands on its own little mound, viewBox 0 0 160 140, base around y=124.
  var REEF_OBJ_DAY = [
    function brain(){ return '<ellipse cx="80" cy="124" rx="62" ry="12" fill="url(#rwSand)"/>' +
      '<path d="M22 122Q20 52 80 48Q140 52 138 122Z" fill="url(#rwBrain)" '+RW_LINE+'/>' +
      '<path d="M34 110q8-14 0-26t12-22M52 118q-6-16 6-28t2-26M74 120q8-18-2-32t10-24M98 118q-8-16 4-28t-2-24M120 112q-10-12 0-24" fill="none" stroke="#9a3420" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="58" cy="66" rx="18" ry="9" fill="#fff" opacity=".35" transform="rotate(-20 58 66)"/>'; },
    function staghorn(){ return '<ellipse cx="80" cy="124" rx="58" ry="11" fill="url(#rwSand)"/>' +
      '<path d="M80 122C80 100 72 88 58 72C50 62 48 50 52 36M76 98C90 90 98 78 98 60C98 50 104 42 112 38M60 74C46 68 38 58 38 44M98 64C108 62 118 56 122 46M84 112C100 108 114 98 120 86" fill="none" stroke="url(#rwStag)" stroke-width="11" stroke-linecap="round"/>' +
      '<path d="M80 122C80 100 72 88 58 72C50 62 48 50 52 36M76 98C90 90 98 78 98 60" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-linecap="round" transform="translate(-3 -2)"/>' +
      '<circle cx="52" cy="35" r="6.5" fill="#ffd6de"/><circle cx="112" cy="38" r="6.5" fill="#ffd6de"/><circle cx="38" cy="43" r="6" fill="#ffd6de"/><circle cx="122" cy="45" r="6" fill="#ffd6de"/><circle cx="120" cy="85" r="5.5" fill="#ffd6de"/>'; },
    function fan(){ return '<ellipse cx="80" cy="124" rx="52" ry="10" fill="url(#rwSand)"/>' +
      '<path d="M80 122L76 96Q40 92 30 58Q28 30 56 22Q80 14 104 22Q132 30 130 58Q120 92 84 96Z" fill="url(#rwFan)" '+RW_LINE+'/>' +
      '<path d="M78 96L56 30M79 96L80 20M80 96L104 28M78 94L36 56M82 94L124 56M60 80Q80 70 100 80M44 60Q80 44 116 60M50 40Q80 28 110 40" fill="none" stroke="#efe6ff" stroke-opacity=".7" stroke-width="2.2"/>' +
      '<path d="M76 96V122" stroke="#5a3fa8" stroke-width="7" stroke-linecap="round"/>'; },
    function clam(){ return '<ellipse cx="80" cy="124" rx="64" ry="12" fill="url(#rwSand)"/>' +
      '<path d="M20 108Q22 78 80 76Q138 78 140 108Q138 126 80 126Q22 126 20 108Z" fill="url(#rwClamOut)" '+RW_LINE+'/>' +
      '<path d="M26 104Q80 92 134 104Q120 86 80 84Q40 86 26 104Z" fill="url(#rwClamIn)"/>' +
      '<path d="M22 92Q24 40 80 34Q136 40 138 92Q120 70 80 68Q40 70 22 92Z" fill="url(#rwClamOut)" '+RW_LINE+'/>' +
      '<path d="M40 82Q44 52 58 42M62 72Q64 48 72 38M98 72Q96 48 88 38M120 82Q116 52 102 42" fill="none" stroke="#8d846b" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="80" cy="96" r="11" fill="url(#rwPearl)"/><circle cx="76" cy="92" r="3" fill="#fff"/>'; },
    function sponge(){ return '<ellipse cx="80" cy="124" rx="60" ry="11" fill="url(#rwSand)"/>' +
      '<rect x="36" y="56" width="26" height="66" rx="8" fill="url(#rwTube)"/><ellipse cx="49" cy="57" rx="13" ry="6" fill="#5a2e0c"/><ellipse cx="49" cy="56" rx="13" ry="5" fill="none" stroke="#ffd27a" stroke-width="2.5"/>' +
      '<rect x="70" y="30" width="28" height="92" rx="9" fill="url(#rwTube2)"/><ellipse cx="84" cy="31" rx="14" ry="6.5" fill="#4a1236"/><ellipse cx="84" cy="30" rx="14" ry="5.5" fill="none" stroke="#ff9fd0" stroke-width="2.5"/>' +
      '<rect x="106" y="72" width="22" height="50" rx="7" fill="url(#rwTube)"/><ellipse cx="117" cy="73" rx="11" ry="5" fill="#5a2e0c"/><ellipse cx="117" cy="72" rx="11" ry="4.2" fill="none" stroke="#ffd27a" stroke-width="2.2"/>'; },
    function anemone(){
      var t = ''; for(var i = 0; i < 13; i++){ var a = -80 + i * 13.3, r = a * Math.PI / 180, x = 80 + Math.sin(r) * 46, y = 70 - Math.cos(r) * 40;
        t += '<path d="M80 82Q'+(80 + Math.sin(r) * 20).toFixed(1)+' '+(64 - Math.cos(r) * 10).toFixed(1)+' '+x.toFixed(1)+' '+y.toFixed(1)+'" fill="none" stroke="url(#rwAnem)" stroke-width="7" stroke-linecap="round"/><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="4.5" fill="#ffd6ff"/>'; }
      return '<ellipse cx="80" cy="124" rx="56" ry="11" fill="url(#rwSand)"/>' +
        '<path d="M58 122Q56 96 66 84H94Q104 96 102 122Z" fill="#7b3fae" '+RW_LINE+'/>' + t +
        '<g transform="translate(102 92) rotate(-12)"><ellipse cx="0" cy="0" rx="15" ry="9" fill="#ff8a3d"/><path d="M-6 -8v16M5 -8v16" stroke="#fff" stroke-width="3.5"/><path d="M13 0l9-7v14Z" fill="#ff8a3d"/><circle cx="-9" cy="-2" r="2" fill="#0b2b33"/></g>'; }
  ];
  var REEF_OBJ_NIGHT = [
    function crate(){ return '<ellipse cx="80" cy="124" rx="62" ry="12" fill="url(#rwSilt)"/>' +
      '<path d="M30 60L80 40L130 60L80 80Z" fill="url(#rwWoodTop)" '+RW_LINE+'/>' +
      '<path d="M30 60L80 80V124L30 106Z" fill="url(#rwWoodL)" '+RW_LINE+'/>' +
      '<path d="M130 60L80 80V124L130 106Z" fill="url(#rwWoodR)" '+RW_LINE+'/>' +
      '<path d="M30 74L80 94M30 90L80 110M130 74L80 94M130 90L80 110M44 54L94 74M58 48L108 68" stroke="#2c1a09" stroke-opacity=".55" stroke-width="2"/>' +
      '<path d="M30 60L80 80L130 60" fill="none" stroke="#c9a45a" stroke-width="3" stroke-opacity=".7"/><circle cx="56" cy="92" r="3" fill="#c9a45a"/><circle cx="104" cy="92" r="3" fill="#c9a45a"/>'; },
    function barrel(){ return '<ellipse cx="80" cy="124" rx="56" ry="11" fill="url(#rwSilt)"/>' +
      '<path d="M46 40Q36 82 46 120H114Q124 82 114 40Z" fill="url(#rwBarrel)" '+RW_LINE+'/>' +
      '<ellipse cx="80" cy="40" rx="34" ry="9" fill="#5e3b1a"/><ellipse cx="80" cy="40" rx="30" ry="7" fill="#3d2510"/>' +
      '<path d="M42 58Q80 68 118 58M38 82Q80 92 122 82M42 106Q80 116 118 106" fill="none" stroke="url(#rwIron)" stroke-width="6"/>' +
      '<path d="M60 46Q56 82 60 116" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>'; },
    function anchor(){ return '<ellipse cx="80" cy="124" rx="58" ry="11" fill="url(#rwSilt)"/>' +
      '<g transform="rotate(-14 80 80)"><circle cx="80" cy="26" r="10" fill="none" stroke="url(#rwRust)" stroke-width="7"/>' +
      '<rect x="74" y="34" width="12" height="78" rx="5" fill="url(#rwRust)" '+RW_LINE+'/><rect x="56" y="46" width="48" height="10" rx="5" fill="url(#rwRust)"/>' +
      '<path d="M36 92Q40 120 80 120Q120 120 124 92L134 98L122 74L110 92Q108 110 80 110Q52 110 50 92L38 74L26 98Z" fill="url(#rwRust)" '+RW_LINE+'/></g>' +
      '<path d="M20 120q10-10 20 0t20 0" fill="none" stroke="#3e4a50" stroke-width="5" stroke-linecap="round"/>'; },
    function wheel(){
      var s = ''; for(var i = 0; i < 8; i++){ var r = i * Math.PI / 4; s += '<path d="M80 74L'+(80 + Math.cos(r) * 56).toFixed(1)+' '+(74 + Math.sin(r) * 56).toFixed(1)+'" stroke="url(#rwBarrel)" stroke-width="7" stroke-linecap="round"/><circle cx="'+(80 + Math.cos(r) * 58).toFixed(1)+'" cy="'+(74 + Math.sin(r) * 58).toFixed(1)+'" r="5" fill="#7b5228"/>'; }
      return '<ellipse cx="80" cy="124" rx="60" ry="11" fill="url(#rwSilt)"/>' + s +
        '<circle cx="80" cy="74" r="40" fill="none" stroke="url(#rwWoodTop)" stroke-width="10"/><circle cx="80" cy="74" r="12" fill="url(#rwBrass)" '+RW_LINE+'/>' +
        '<path d="M14 124Q80 100 146 124Z" fill="url(#rwSilt)"/>'; },
    function cannon(){ return '<ellipse cx="80" cy="124" rx="64" ry="12" fill="url(#rwSilt)"/>' +
      '<path d="M26 74L120 56Q136 54 138 68Q140 82 124 84L30 96Q18 96 18 85Q18 75 26 74Z" fill="url(#rwCannon)" '+RW_LINE+'/>' +
      '<ellipse cx="132" cy="70" rx="7" ry="13" fill="#0c1215"/><path d="M30 80L118 64" stroke="#fff" stroke-opacity=".2" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="54" cy="104" r="17" fill="url(#rwWoodL)" '+RW_LINE+'/><circle cx="54" cy="104" r="5" fill="#2c1a09"/><circle cx="96" cy="100" r="15" fill="url(#rwWoodL)" '+RW_LINE+'/><circle cx="96" cy="100" r="4.5" fill="#2c1a09"/>'; },
    function lantern(){ return '<ellipse cx="80" cy="124" rx="54" ry="11" fill="url(#rwSilt)"/>' +
      '<circle cx="80" cy="74" r="62" fill="url(#rwGlow)" class="rw-glow"/>' +
      '<path d="M80 12V28" stroke="url(#rwIron)" stroke-width="4"/><path d="M66 22Q80 6 94 22" fill="none" stroke="url(#rwIron)" stroke-width="4"/>' +
      '<rect x="58" y="28" width="44" height="10" rx="3" fill="url(#rwBrass)"/>' +
      '<path d="M60 38H100L106 104H54Z" fill="#7ff5e3" fill-opacity=".55" '+RW_LINE+'/>' +
      '<ellipse cx="80" cy="74" rx="11" ry="18" fill="#e9fffb"/>' +
      '<path d="M60 38L54 104M100 38L106 104M80 38V104" stroke="url(#rwBrass)" stroke-width="4"/>' +
      '<rect x="50" y="104" width="60" height="14" rx="4" fill="url(#rwBrass)" '+RW_LINE+'/>'; }
  ];
  function reefObjSVG(item, night){
    var set = night ? REEF_OBJ_NIGHT : REEF_OBJ_DAY;
    var f = set[reefHash(item.d.id) % set.length];
    return '<svg class="rw-art" viewBox="0 0 160 140" aria-hidden="true">' + f() + '</svg>';
  }
  /* Storybook scene: one painted landscape. Decks are stops along a winding sandy path, each subject
     starts at a signpost, and the scenery (kelp, coral and rocks by day; a sunken ship by night) fills
     the space the path leaves open. Everything is laid out in scene units (W wide) so it scales evenly. */
  function reefRand(seed){ var s = (seed >>> 0) || 1; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function reefN(n){ return Math.round(n * 10) / 10; }
  function reefPathD(pts){ // a smooth curve through every stop
    var d = 'M' + reefN(pts[0].x) + ' ' + reefN(pts[0].y);
    for(var i = 0; i < pts.length - 1; i++){
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += 'C' + [p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y].map(reefN).join(' ');
    }
    return d;
  }
  function reefLayout(zones){
    var narrow = innerWidth < 640, W = narrow ? 420 : 1000, step = narrow ? 128 : 122;
    var lanes = narrow ? [.3, .7] : [.22, .5, .78, .5];
    var stops = [], k = 0, y = narrow ? 96 : 90;
    function add(stop){ stop.x = W * lanes[k % lanes.length]; stop.y = y; stops.push(stop); k++; y += step; }
    zones.forEach(function(z){
      add({ sign: z });
      z.items.forEach(function(it){ add({ item: it, zone: z }); });
    });
    y += step * .2;
    add({ special: 'treasure' });
    add({ special: 'story' });
    return { W: W, H: y - step + (narrow ? 150 : 140), stops: stops, narrow: narrow };
  }

  // Scenery, drawn around (0,0) = where it meets the sand, then placed with a transform.
  var REEF_DECO = {
    kelp: function(r, night){
      var c = night ? ['#2c4a43', '#355a50'] : ['#7fa889', '#93b99a'], out = '';
      for(var i = 0; i < 3; i++){
        var h = 130 + r() * 90, dx = (i - 1) * 14, w = 6 + r() * 3;
        out += '<path d="M'+dx+' 0C'+(dx-14)+' '+(-h*.3)+' '+(dx+16)+' '+(-h*.6)+' '+(dx+2)+' '+(-h)+'" fill="none" stroke="'+c[i % 2]+'" stroke-width="'+reefN(w)+'" stroke-linecap="round"/>';
        for(var j = 1; j < 4; j++) out += '<ellipse cx="'+reefN(dx + (j % 2 ? 9 : -9))+'" cy="'+reefN(-h * j / 4.2)+'" rx="9" ry="4" transform="rotate('+(j % 2 ? -30 : 30)+' '+reefN(dx)+' '+reefN(-h * j / 4.2)+')" fill="'+c[(i + j) % 2]+'"/>';
      }
      return out;
    },
    coral: function(r, night){
      var pal = night ? ['#4c4057', '#3e4c56', '#57493f'] : ['#e4a19a', '#efbf8f', '#b8a6d6', '#f2c9b8'], out = '';
      for(var i = 0; i < 5; i++){
        var cx = (r() - .5) * 70, ry = 14 + r() * 16, rx = ry * (1 + r() * .5), c = pal[Math.floor(r() * pal.length)];
        out += '<ellipse cx="'+reefN(cx)+'" cy="'+reefN(-ry * .8)+'" rx="'+reefN(rx)+'" ry="'+reefN(ry)+'" fill="'+c+'"/>' +
               '<ellipse cx="'+reefN(cx - rx * .25)+'" cy="'+reefN(-ry * 1.15)+'" rx="'+reefN(rx * .45)+'" ry="'+reefN(ry * .3)+'" fill="#fff" opacity="'+(night ? .06 : .3)+'"/>';
      }
      return out;
    },
    branch: function(r, night){
      var c = night ? '#5a4a5c' : ['#e58f86', '#f0b07a', '#c4a0d8'][Math.floor(r() * 3)], h = 60 + r() * 40;
      return '<path d="M0 0C-2 '+(-h*.4)+' -18 '+(-h*.6)+' -24 '+(-h)+'M-2 '+(-h*.35)+'C8 '+(-h*.55)+' 20 '+(-h*.7)+' 22 '+(-h*.95)+'M-12 '+(-h*.62)+'C-30 '+(-h*.7)+' -36 '+(-h*.8)+' -40 '+(-h*.9)+'M10 '+(-h*.6)+'C4 '+(-h*.8)+' 6 '+(-h*.9)+' 2 '+(-h*1.05)+'" fill="none" stroke="'+c+'" stroke-width="9" stroke-linecap="round"/>';
    },
    rock: function(r, night){
      var w = 50 + r() * 50, h = 22 + r() * 22, c = night ? '#2a3a40' : '#a9bcbd', hi = night ? '#3a4d54' : '#c9d7d6';
      return '<path d="M'+(-w)+' 0C'+(-w)+' '+(-h)+' '+(-w*.3)+' '+(-h*1.3)+' 0 '+(-h*1.2)+'C'+(w*.5)+' '+(-h*1.2)+' '+w+' '+(-h*.7)+' '+w+' 0Z" fill="'+c+'"/>' +
             '<path d="M'+(-w*.6)+' '+(-h*.8)+'C'+(-w*.3)+' '+(-h*1.15)+' '+(w*.1)+' '+(-h*1.15)+' '+(w*.3)+' '+(-h)+'" fill="none" stroke="'+hi+'" stroke-width="6" stroke-linecap="round"/>';
    },
    grass: function(r, night){
      var c = night ? '#2f4a44' : '#9cc0a0', out = '';
      for(var i = 0; i < 7; i++){ var x = (i - 3) * 6, h = 24 + r() * 26; out += '<path d="M'+x+' 0Q'+(x + (r() - .5) * 16)+' '+(-h*.6)+' '+(x + (r() - .5) * 14)+' '+(-h)+'" fill="none" stroke="'+c+'" stroke-width="3" stroke-linecap="round"/>'; }
      return out;
    },
    star: function(r, night){
      var c = night ? '#7a5a52' : '#eea27f';
      return '<path d="M0 -26L6 -14 20 -14 9 -6 13 8 0 0 -13 8 -9 -6 -20 -14 -6 -14Z" fill="'+c+'" transform="rotate('+Math.floor(r() * 60)+' 0 -10)"/>';
    },
    plank: function(r){
      var a = (r() - .5) * 40;
      return '<g transform="rotate('+reefN(a)+')"><rect x="-44" y="-12" width="88" height="12" rx="3" fill="#4d3c2f"/><path d="M-30 -6h20M6 -6h24" stroke="#3a2c22" stroke-width="2"/></g>';
    },
    bottle: function(r){
      return '<g transform="rotate('+reefN(-20 - r() * 30)+')"><rect x="-16" y="-14" width="30" height="14" rx="6" fill="#5f8f86" opacity=".8"/><rect x="12" y="-11" width="10" height="8" rx="2" fill="#5f8f86" opacity=".8"/></g>';
    },
    glow: function(r){ // a soft glowing anemone in the dark
      var out = '<circle cx="0" cy="-16" r="34" fill="url(#rwSceneGlow)"/>';
      for(var i = 0; i < 6; i++){ var a = (i - 2.5) * .35; out += '<path d="M0 0Q'+reefN(Math.sin(a) * 14)+' -14 '+reefN(Math.sin(a) * 22)+' '+reefN(-24 - Math.cos(a) * 6)+'" fill="none" stroke="#8fe3d6" stroke-width="4" stroke-linecap="round" opacity=".85"/>'; }
      return out;
    }
  };
  function reefDecoAt(name, x, y, s, r, night, extra){
    return '<g transform="translate('+reefN(x)+' '+reefN(y)+') scale('+reefN(s * 100) / 100+')"'+(extra || '')+'>' + REEF_DECO[name](r, night) + '</g>';
  }

  // The sunken ship lies on its side behind the middle of the path; the path crosses its deck.
  function reefShipSVG(L){
    var w = L.W * (L.narrow ? 1.25 : .92), h = w * .6, x = L.narrow ? -L.W * .18 : L.W * .02, y = L.H * .5 - h * .55;
    var s = w / 1000;
    return '<g transform="translate('+reefN(x)+' '+reefN(y)+') scale('+reefN(s * 1000) / 1000+')" opacity=".92">' +
      '<path d="M880 -170L600 150" stroke="#3a2d24" stroke-width="22" stroke-linecap="round"/>' +
      '<path d="M790 -60Q700 -40 650 40L740 60Q760 0 800 -40Z" fill="#6f6658" opacity=".55"/>' +
      '<path d="M40 420Q120 160 520 120L940 90Q990 210 900 330Q700 520 300 560Q120 560 40 420Z" fill="url(#rwHull)"/>' +
      '<path d="M90 400Q200 230 520 190L930 165M120 460Q260 300 540 270L915 255M190 510Q330 380 560 350L880 330" fill="none" stroke="#241b15" stroke-width="5" opacity=".7"/>' +
      '<path d="M40 420Q120 160 520 120L940 90" fill="none" stroke="#7a5f48" stroke-width="12" stroke-linecap="round"/>' +
      [[300, 300], [470, 270], [640, 250]].map(function(p){ return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="40" fill="url(#rwSceneGlow)" opacity=".8"/><circle cx="'+p[0]+'" cy="'+p[1]+'" r="20" fill="#e9d9a8" stroke="#a88a4a" stroke-width="6"/>'; }).join('') +
      '<path d="M920 340Q990 420 960 520M860 380Q930 460 900 560" fill="none" stroke="#3a2d24" stroke-width="16" stroke-linecap="round"/>' +
    '</g>';
  }
  // The day scene's big landmark: a coral-covered rock arch.
  function reefArchSVG(L){
    var w = L.W * (L.narrow ? 1 : .7), x = L.narrow ? L.W * .5 : L.W * .5, y = L.H * .52, s = w / 600;
    return '<g transform="translate('+reefN(x)+' '+reefN(y)+') scale('+reefN(s * 1000) / 1000+')" opacity=".55">' +
      '<path d="M-300 120C-300 -120 -200 -260 0 -260C200 -260 300 -120 300 120H190C190 -40 120 -140 0 -140C-120 -140 -190 -40 -190 120Z" fill="#9db5b6"/>' +
      '<ellipse cx="-220" cy="-150" rx="50" ry="30" fill="#e4a19a"/><ellipse cx="-150" cy="-230" rx="40" ry="24" fill="#b8a6d6"/><ellipse cx="60" cy="-262" rx="56" ry="26" fill="#efbf8f"/><ellipse cx="210" cy="-180" rx="44" ry="28" fill="#e4a19a"/><ellipse cx="260" cy="-60" rx="30" ry="22" fill="#b8a6d6"/>' +
    '</g>';
  }

  function reefPaintSVG(L, night){
    var r = reefRand(L.stops.length * 977 + (night ? 7 : 3)), back = '', front = '';
    var pts = L.stops.map(function(s){ return { x: s.x, y: s.y + 36 }; });
    pts.unshift({ x: pts[0].x, y: 0 });
    var sand = night ? '#34413f' : '#efe2c2', sandEdge = night ? '#26302f' : '#dcc9a0', pebble = night ? '#4b5a57' : '#f9f1dc';
    var backSet = night ? ['kelp', 'rock', 'coral', 'plank', 'grass'] : ['kelp', 'coral', 'rock', 'branch', 'grass'];
    var frontSet = night ? ['rock', 'plank', 'bottle', 'glow', 'grass', 'kelp'] : ['coral', 'grass', 'star', 'rock', 'branch', 'kelp'];
    // Keep scenery off the sand: sample the path and skip any spot too close to it.
    var samples = [];
    for(var q = 0; q < pts.length - 1; q++) for(var u = 0; u < 1; u += .1) samples.push([pts[q].x + (pts[q + 1].x - pts[q].x) * u, pts[q].y + (pts[q + 1].y - pts[q].y) * u]);
    var clear = L.W * (L.narrow ? .16 : .1);
    function offPath(x, y){ return samples.every(function(p){ var dx = p[0] - x, dy = p[1] - y; return dx * dx + dy * dy > clear * clear; }); }
    L.stops.forEach(function(s, i){
      var left = s.x > L.W * .55, right = s.x < L.W * .45, sides = left ? [0] : right ? [1] : [0, 1];
      sides.forEach(function(side){
        var lo = side === 0 ? L.W * .02 : s.x + L.W * .18, hi = side === 0 ? s.x - L.W * .18 : L.W * .98;
        if(hi - lo < L.W * .08) return;
        var n = L.narrow ? 1 : 2;
        for(var j = 0; j < n; j++){
          var x = lo + r() * (hi - lo), y = s.y + 30 + (r() - .5) * 70, fx = x + (r() - .5) * 60;
          if(offPath(x, y - 40)) back += reefDecoAt(backSet[Math.floor(r() * backSet.length)], x, y - 40, .55 + r() * .25, r, night, ' opacity=".55"');
          if(offPath(fx, y + 30)) front += reefDecoAt(frontSet[Math.floor(r() * frontSet.length)], fx, y + 30, .8 + r() * .35, r, night);
        }
      });
      var gx = s.x + (s.x > L.W / 2 ? -1 : 1) * L.W * .2;
      if(night && i % 3 === 1 && offPath(gx, s.y + 70)) front += reefDecoAt('glow', gx, s.y + 70, .9, r, night);
    });
    // Tall kelp along both edges, so the scene feels framed.
    for(var y = 120; y < L.H; y += 260 + r() * 140){
      front += reefDecoAt('kelp', L.W * (.01 + r() * .03), y, 1.1 + r() * .4, r, night);
      front += reefDecoAt('kelp', L.W * (.96 + r() * .03), y + 130, 1 + r() * .4, r, night);
    }
    var rays = '';
    for(var k = 0; k < 5; k++){ var rx = L.W * (.08 + k * .2 + r() * .06); rays += '<path d="M'+reefN(rx)+' 0L'+reefN(rx + L.W * .07)+' 0L'+reefN(rx + L.W * .2)+' '+reefN(Math.min(L.H, 900))+'L'+reefN(rx + L.W * .09)+' '+reefN(Math.min(L.H, 900))+'Z" fill="url(#rwRay)"/>'; }
    return '<svg class="rw-paint" viewBox="0 0 '+L.W+' '+reefN(L.H)+'" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<filter id="rwWob" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>' +
        '<filter id="rwSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="'+(L.narrow ? 6 : 10)+'"/></filter>' +
        '<filter id="rwGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .3  0 0 0 0 .25  0 0 0 .55 0"/></filter>' +
        '<linearGradient id="rwRay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(night ? '#9fe8de' : '#fffbe9')+'" stop-opacity="'+(night ? .12 : .5)+'"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<radialGradient id="rwSceneGlow"><stop offset="0" stop-color="#ffe3a3" stop-opacity=".55"/><stop offset="1" stop-color="#ffe3a3" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="rwHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4636"/><stop offset="1" stop-color="#2b221b"/></linearGradient>' +
      '</defs>' +
      '<g filter="url(#rwSoft)">'+rays+'</g>' +
      '<g filter="url(#rwWob)">' +
        (night ? reefShipSVG(L) : reefArchSVG(L)) +
        '<rect x="0" y="0" width="'+L.W+'" height="'+reefN(L.H)+'" fill="'+(night ? '#0b2630' : '#a9d3d2')+'" opacity=".28"/>' +
        back +
        '<path d="'+reefPathD(pts)+'" fill="none" stroke="'+sandEdge+'" stroke-width="'+(L.narrow ? 74 : 92)+'" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="'+reefPathD(pts)+'" fill="none" stroke="'+sand+'" stroke-width="'+(L.narrow ? 60 : 76)+'" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="'+reefPathD(pts)+'" fill="none" stroke="'+pebble+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="0 34" opacity=".9"/>' +
        front +
      '</g>' +
      '<rect class="rw-grain" x="0" y="0" width="'+L.W+'" height="'+reefN(L.H)+'" filter="url(#rwGrain)" opacity="'+(night ? .35 : .22)+'"/>' +
    '</svg>';
  }

  function reefWorldHTML(zones){
    var night = reefNight();
    var names = REEF_ZONE_NAMES[night ? 'night' : 'day'];
    var next = null;
    zones.forEach(function(z){ z.items.forEach(function(it){ if(!next && it.state === 'ready') next = it; }); });
    var guide = 'Shelly'; try { guide = coveSwimName() || 'Shelly'; } catch(e){}
    var line = next ? 'Let\'s dive into ' + next.d.name + '!' : 'All done!';   // short, and said by Shelly herself (reefHeadOnce)
    var L = reefLayout(zones), tally = reefTally();
    function pos(s, i){ return 'style="--x:'+reefN(s.x / L.W * 100)+'%;--y:'+reefN(s.y / L.H * 100)+'%;--i:'+i+'"'; }
    var html = L.stops.map(function(s, i){
      if(s.sign){
        var z = s.sign, name = names[z.id] || (z.label + (night ? ' Deck' : ' Cove'));
        return '<div class="rw-post '+(s.x > L.W / 2 ? 'r' : 'l')+'" '+pos(s, i)+' role="heading" aria-level="3">' +
          '<span class="rw-post-board"><b>'+esc(name)+'</b><small>'+esc(z.label)+'</small></span>' +
          '<button type="button" class="rw-say" data-reef-say="'+esc(name + '. ' + z.items.map(function(it){ return it.d.name; }).join(', ') + '.')+'" aria-label="Read this area aloud">'+ccIcon('sound')+'</button>' +
        '</div>';
      }
      if(s.special === 'treasure') return '' +
        '<button type="button" class="rw-obj special" data-reef-special="treasure" '+pos(s, i)+' aria-label="Treasure Reef. My sea friends.">' +
          '<span class="rw-shadow" aria-hidden="true"></span>'+reefArtSVG('treasure').replace('reef-art-svg', 'rw-art')+(tally.found ? '<span class="rw-count" aria-hidden="true">'+tally.found+'</span>' : '') +
          '<span class="rw-plaque"><b>Treasure Reef</b><small>My sea friends</small></span></button>';
      if(s.special === 'story') return '' +
        '<button type="button" class="rw-obj special" data-reef-special="story" '+pos(s, i)+' aria-label="Story Bottle. Make a story.">' +
          '<span class="rw-shadow" aria-hidden="true"></span>'+reefArtSVG('story').replace('reef-art-svg', 'rw-art') +
          '<span class="rw-plaque"><b>Story Bottle</b><small>Make a story</small></span></button>';
      var it = s.item;
      var label = it.state === 'ready' ? 'Ready' : it.state === 'done' ? 'All done' : it.kind;
      var say = it.d.name + '. ' + (it.state === 'ready' ? 'Ready to practice.' : it.state === 'done' ? 'All done. Tap to play again.' : 'Tap to ' + it.kind.toLowerCase() + '.');
      return '' +
        '<button type="button" class="rw-obj '+it.state+(it === next ? ' next' : '')+'" data-reef-deck="'+esc(it.d.id)+'" '+pos(s, i)+' aria-label="'+esc(say)+'">' +
          '<span class="rw-shadow" aria-hidden="true"></span>' +
          reefObjSVG(it, night) +
          '<span class="rw-badge" aria-hidden="true">'+it.d.emoji+'</span>' +
          (it.state === 'ready' ? '<span class="rw-pearl" aria-hidden="true"></span>' : (it.state === 'done' ? '<span class="rw-star" aria-hidden="true">★</span>' : '')) +
          (it === next ? '<span class="rw-guide" aria-hidden="true">'+(night ? lumiSVG('rw-guide-svg') : mascotTurtleSVG('rw-guide-svg'))+'</span>' : '') +
          '<span class="rw-plaque"><b>'+esc(it.d.name)+'</b><small>'+esc(label)+'</small></span>' +
        '</button>';
    }).join('');
    return '' +
      '<section class="rw '+(night ? 'night' : 'day')+'" aria-label="'+(night ? 'The shipwreck' : 'The reef')+'">' +
        reefDefsSVG() +
        '<div class="rw-head">' +
          '<div class="rw-head-text"><h2>'+(night ? 'Where should we explore?' : 'Where should we swim?')+'</h2><p>'+esc(guide)+' says: '+esc(line)+'</p>'+reefTodayHTML(zones)+'</div>' +
          '<button type="button" class="reef-say" data-reef-say="'+esc(line)+'" aria-label="Read this aloud">'+ccIcon('sound')+'</button>' +
        '</div>' +
        '<div class="rw-scene" style="aspect-ratio:'+L.W+' / '+reefN(L.H)+'">' +
          reefPaintSVG(L, night) +
          '<div class="rw-light" aria-hidden="true"></div>' +
          html +
        '</div>' +
      '</section>';
  }
  // How far today: one shell per practice deck, gold once it's all done.
  function reefTodayHTML(zones){
    var total = 0, done = 0;
    zones.forEach(function(z){ z.items.forEach(function(it){ if(it.state === 'ready' || it.state === 'done'){ total++; if(it.state === 'done') done++; } }); });
    if(!total) return '';
    var n = Math.min(total, 12), lit = Math.round(done / total * n), shells = '';
    for(var i = 0; i < n; i++) shells += '<i class="'+(i < lit ? 'on' : '')+'"></i>';
    return '<div class="reef-today"><span class="reef-today-shells" aria-hidden="true">'+shells+'</span><span>'+done+' of '+total+' decks all done</span></div>';
  }
  function reefStartDeck(id){
    var d = S.decks.find(function(x){ return x.id === id; });
    R3.fromDeck = true;   // back on the board after this deck (finished or not): a cheer, then the dice
    R3.lastDeckId = id;
    if(d && d.feedMode) startFeed(id);
    else if(d && d.storyMode) startStory(id);
    else if(d && d.equationMode) startEquationFeed(id);
    else if(d && d.langFeedMode) startLangFeed(id);
    else if(d && d.readAlongMode) startReadAlong(id);
    else if(d && d.flashFeedMode) startFlashFeed(id);
    else if(d && d.miniStoryMode) startMiniStory(id);
    else startStudy(id);
  }
  // Depth as you scroll: the far ridges drift slower than the page, the near kelp a little faster.
  var reefParallaxOn = false;
  function reefParallax(){
    var scene = document.querySelector('.rw-scene');
    if(!scene || reefCalm()) return;
    var r = scene.getBoundingClientRect();
    scene.style.setProperty('--py', Math.round(-r.top) + 'px');
  }
  function reefParallaxWire(){
    if(reefParallaxOn) return;
    reefParallaxOn = true;
    var queued = false;
    addEventListener('scroll', function(){
      if(queued) return; queued = true;
      requestAnimationFrame(function(){ queued = false; reefParallax(); });
    }, { passive: true });
  }

  // Shelly's line ("Let's dive into Soccer Practice!") has no text box: Shelly says it once when it's new. On the
  // 3D board she waves as she says it; without the board a little Shelly swims in, says it and swims away.
  // (The words stay in the page, hidden, for screen readers.)
  var reefHeadSaid = {};
  function reefHeadOnce(el){
    var head = el.querySelector('.rw-head'), say = head && head.querySelector('[data-reef-say]'); if(!head || !say) return;
    var key = (S.profile && S.profile.id) + '|' + say.dataset.reefSay;
    if(reefHeadSaid[key]) return;
    reefHeadSaid[key] = true;
    setTimeout(function(){
      if(!document.body.contains(head) || document.querySelector('.cc-shelly-dive')) return;
      // on the 3D board Shelly is already there: she waves and says it
      var v = typeof R3 !== 'undefined' && R3.view;
      if(v && v.wrap && document.body.contains(v.wrap)){
        try { if(!v.moving) reef3dEmote(v, 'hello'); } catch(e){}
        try { Speech.speak(say.dataset.reefSay); } catch(e){}
        return;
      }
      var d = document.createElement('div');
      d.className = 'cc-shelly-dive' + (reefCalm() ? ' calm' : ''); d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<div class="cc-sayit-shelly">' + mascotTurtleSVG('cc-sayit-svg') + '</div>';
      document.body.appendChild(d);
      var gone = function(){ if(!d.parentNode || d.classList.contains('out')) return; d.classList.add('out'); setTimeout(function(){ d.remove(); }, 900); };
      setTimeout(function(){ try { Speech.speakThen(say.dataset.reefSay, function(){ setTimeout(gone, 500); }); } catch(e){ gone(); } }, 700);
      setTimeout(gone, 8000);   // never stays on screen
    }, 900);
  }
