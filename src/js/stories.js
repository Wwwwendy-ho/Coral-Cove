  /* ---------- MINI STORY ----------
     A deck-level mode (deck.miniStoryMode) for short picture stories in a new language. Each card is one
     page, in the order the cards were added: its hint/note is the picture (emoji), its front is the
     sentence and its back is the translation. A page reads its sentence aloud when it arrives; tapping a
     word says just that word; "🌐 Meaning" shows the translation. A last "The end" page follows. Uses
     the same swipe engine as the feeds. Just for fun: no grading, no stats. */
  function startMiniStory(deckId){
    S.currentDeckId = deckId;
    S.editMode = false;
    S.store.updateDeck(deckId, { lastOpenedAt: Date.now() });
    S.store.getCardsOnce(deckId).then(function(cards){
      if(!cards.length) return;
      S.msPanels = cards.slice().sort(function(a,b){ return (a.createdAt||0) - (b.createdAt||0); });
      S.msGen = null;
      S.msIndex = 0;
      S.msShowTr = false;
      S.msSpokenKey = null;
      S.view = 'miniStory';
      render();
    });
  }

  function miniStoryWordsHTML(sentence, pageKey){
    var wi = 0;
    var g = S.msGen, kl = g ? (g.lang === 'easy' ? 'en' : g.lang) : null;
    return String(sentence||'').split(/(\s+)/).map(function(part){
      if(!part) return '';
      if(/^\s+$/.test(part)) return part;
      if(!/[\p{L}\p{N}]/u.test(part)) return esc(part);
      var core = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || part;
      var known = g && StoryMaker.knownLevel(core, kl, g.words);
      return '<span class="ms-word'+(known ? ' ms-known' : '')+'" data-ms-word="'+pageKey+'-'+(wi++)+'" data-speak="'+esc(core)+'">'+esc(part)+'</span>';
    }).join('');
  }

  function renderMiniStory(){
    var gen = S.msGen;
    var deck = gen ? { name: gen.title, emoji: '✨' } : (S.decks.find(function(d){ return d.id === S.currentDeckId; }) || { name:'Mini Story', emoji:'🎞️' });
    var pages = S.msPanels;
    if(!pages.length){ goHome(); return; }
    var n = pages.length + 1; // + "The end"
    var idx = ((S.msIndex % n) + n) % n;
    function pageAt(i){ i = ((i % n) + n) % n; return i < pages.length ? pages[i] : null; }
    var cur = pageAt(idx);
    var key = cur ? cur.id : 'end';
    if(S.msSpokenKey !== key){
      S.msSpokenKey = key;
      S.msShowTr = false;
      if(cur) setTimeout(function(){ if(S.view === 'miniStory' && S.msSpokenKey === key) Speech.speak(cur.front, { rate: 0.8 }); }, 300);
    }
    function pageHTML(p, pos){
      var inner;
      if(!p){
        var endExtra = '';
        if(pos === 'current' && S.planRun){ planRecord({ pages: pages.length }); endExtra += planNextHTML(); }
        if(gen && pos === 'current'){
          var canSave = S.managingDecks || S.editMode || (S.profile && S.profile.mode === 'adult');
          endExtra += (gen.used && gen.used.length ? '<div class="ms-words">⭐ Your words in this story: <b>'+esc(gen.used.slice(0, 14).join(', '))+'</b></div>' : '') +
            '<div class="ms-end-btns">' +
              '<button type="button" class="ms-btn" data-act="ms-new-story">✨ New story</button>' +
              (canSave ? '<button type="button" class="ms-btn" data-act="ms-save-story" '+(gen.saved ? 'disabled' : '')+'>'+(gen.saved ? '✅ Saved as a deck' : '💾 Keep this story')+'</button>' : '') +
            '</div>';
        }
        inner = '<div class="ms-page"><div class="ms-scene">🎉</div><div class="ms-end">The end!<small>👆 Swipe up to read again</small></div>'+endExtra+'</div>';
      } else {
        var live = pos === 'current';
        inner = '<div class="ms-page">' +
          '<div class="ms-scene" aria-hidden="true">'+esc(p.note || '🌊')+'</div>' +
          '<div class="ms-sentence">'+(live ? miniStoryWordsHTML(p.front, p.id) : esc(p.front))+'</div>' +
          (live && S.msShowTr && p.back ? '<div class="ms-tr flash-reveal">'+esc(p.back)+'</div>' : '') +
          (live ? '<div class="ms-btns"><button type="button" class="ms-btn" data-act="ms-read">🔊 Read</button>'+(p.back ? '<button type="button" class="ms-btn" data-act="ms-meaning">🌐 '+(S.msShowTr ? 'Hide meaning' : 'Meaning')+'</button>' : '')+'</div>' : '') +
        '</div>';
      }
      return '<div class="feed-card feed-card-'+pos+'" data-feed-pos="'+pos+'">'+inner+'</div>';
    }
    app.innerHTML = '' +
      '<div class="feed-topbar">' +
        '<button type="button" class="icon-btn" data-act="exit-mini" aria-label="Close Mini Story" title="Close">'+ccIcon('close')+'</button>' +
        '<div class="feed-deck-label">'+deck.emoji+' '+esc(deck.name)+'</div>' +
        '<span class="feed-topbar-spacer" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="feed-stage" id="miniStage">' +
        pageHTML(pageAt(idx-1), 'prev') +
        pageHTML(cur, 'current') +
        pageHTML(pageAt(idx+1), 'next') +
      '</div>' +
      '<div class="feed-hint">👆 Swipe up'+(cur ? ' · '+(idx+1)+' / '+pages.length : '')+'</div>';

    app.querySelector('[data-act="exit-mini"]').addEventListener('click', function(){
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){}
      if(S.managingDecks){ goHome(); return; }
      S.pinPromptFor = 'exit';
      render();
    });
    // Words and buttons keep their own touches, so tapping them never starts a page swipe underneath.
    function ownTouch(el){ el.addEventListener('pointerdown', function(e){ e.stopPropagation(); }); }
    var litTimer = null;
    app.querySelectorAll('.ms-word').forEach(function(el){
      ownTouch(el);
      el.addEventListener('click', function(){
        app.querySelectorAll('.ms-word.lit').forEach(function(x){ x.classList.remove('lit'); });
        el.classList.add('lit');
        clearTimeout(litTimer);
        Speech.speakThen(el.dataset.speak, function(){ el.classList.remove('lit'); });
      });
    });
    var rb = app.querySelector('[data-act="ms-read"]');
    if(rb){ ownTouch(rb); rb.addEventListener('click', function(){ if(cur) Speech.speak(cur.front, { rate: 0.8 }); }); }
    var mb = app.querySelector('[data-act="ms-meaning"]');
    if(mb){ ownTouch(mb); mb.addEventListener('click', function(){ S.msShowTr = !S.msShowTr; render(); }); }
    wirePlanNext();
    var nb = app.querySelector('[data-act="ms-new-story"]');
    if(nb){ ownTouch(nb); nb.addEventListener('click', startStoryMaker); }
    var sb = app.querySelector('[data-act="ms-save-story"]');
    if(sb){ ownTouch(sb); sb.addEventListener('click', saveGeneratedStory); }

    wireVerticalSwipeFeed('miniStage',
      function(){ S.msIndex = S.msIndex + 1; if(S.view === 'miniStory') render(); },
      function(){ S.msIndex = S.msIndex - 1; if(S.view === 'miniStory') render(); },
      function(){ if(cur) Speech.speak(cur.front, { rate: 0.8 }); });
  }

  /* ---------- STORY MAKER ----------
     Writes a brand-new Mini Story on the device from the words this profile has in its decks, favouring
     words already studied. No AI calls: a story is an "arc" (a plot shape such as Lost Thing, Rainy Day,
     Birthday) whose beats each have several sentence variants, with slots (hero, friend, food, place,
     colour...) filled from a small built-in word list. 16 candidate stories are built each time and the
     one that uses the most of the learner's own words wins, skipping plots used recently, so stories
     rarely repeat.
       - Korean (adult profiles with Korean decks): Korean sentence + English meaning. Particles (이/가,
         을/를, 은/는 ...) are chosen from the word's last syllable, so any slot word reads correctly.
       - English (other adult profiles): the English side of the same arcs.
       - Easy English (child profiles): separate short, decodable arcs (CVC names like Sam and Pam). */
  var StoryMaker = (function(){
    function rnd(a){ return a[Math.floor(Math.random()*a.length)]; }
    function jong(w){
      var c = String(w||'').charCodeAt(String(w||'').length-1);
      if(c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28;
      return 0;
    }
    function josa(w, p){
      var j = jong(w), has = j > 0;
      switch(p){
        case '이/가': return w + (has ? '이' : '가');
        case '을/를': return w + (has ? '을' : '를');
        case '은/는': return w + (has ? '은' : '는');
        case '와/과': return w + (has ? '과' : '와');
        case '이랑/랑': return w + (has ? '이랑' : '랑');
        case '이에요/예요': return w + (has ? '이에요' : '예요');
        case '으로/로': return w + ((has && j !== 8) ? '으로' : '로');
        case '아/야': return w + (has ? '아' : '야');
        default: return w + p; // 에, 도, 의, 에서, 하고, 에게 ...
      }
    }
    // Word list: k = Korean, n = English, e = picture. pl = plural noun, mass = "some ...", name = no article.
    function L(rows, extra){ return rows.map(function(r){ var o = { k:r[0], n:r[1], e:r[2] }; if(r[3]) Object.assign(o, r[3]); if(extra) Object.assign(o, extra); return o; }); }
    var NAMES = L([
      ['민지','Minji','👧',{g:'f'}],['지호','Jiho','👦',{g:'m'}],['서연','Seoyeon','👧',{g:'f'}],['하준','Hajun','👦',{g:'m'}],
      ['수아','Sua','👧',{g:'f'}],['도윤','Doyun','👦',{g:'m'}],['유나','Yuna','👧',{g:'f'}],['준서','Junseo','👦',{g:'m'}]
    ], { name:1 });
    var ANIMALS = L([
      ['고양이','cat','🐱'],['개','dog','🐶'],['새','bird','🐦'],['물고기','fish','🐟'],['소','cow','🐮'],['돼지','pig','🐷'],
      ['말','horse','🐴'],['토끼','rabbit','🐰'],['호랑이','tiger','🐯'],['곰','bear','🐻'],['강아지','puppy','🐶'],['오리','duck','🦆']
    ]);
    var ANIMAL_HEROES = ANIMALS.filter(function(a){ return ['물고기','소','말','새'].indexOf(a.k) < 0; }).map(function(a){ return Object.assign({}, a, { n:'the '+a.n, name:1, g:'n', hero:1 }); });
    var FAMILY = L([
      ['할머니','Grandma','👵',{g:'f'}],['할아버지','Grandpa','👴',{g:'m'}],['어머니','Mom','👩',{g:'f'}],['아버지','Dad','👨',{g:'m'}],['선생님','the teacher','🧑‍🏫',{g:'n'}]
    ], { name:1 });
    var POOLS = {
      hero: NAMES.concat(ANIMAL_HEROES),
      names: NAMES,
      pal: NAMES.concat(FAMILY),
      fam: FAMILY.slice(0,4),
      animal: ANIMALS,
      food: L([['밥','rice','🍚',{mass:1}],['김치','kimchi','🥬',{mass:1}],['고기','meat','🍖',{mass:1}],['닭고기','chicken','🍗',{mass:1}],['생선','fish','🐟',{mass:1}],
        ['야채','vegetables','🥦',{pl:1}],['과일','fruit','🍎',{mass:1}],['계란','egg','🥚'],['빵','bread','🍞',{mass:1}],['국수','noodles','🍜',{pl:1}],['국','soup','🍲',{mass:1}],['떡','rice cake','🍡']]),
      drink: L([['커피','coffee','☕',{mass:1}],['차','tea','🍵',{mass:1}],['우유','milk','🥛',{mass:1}],['주스','juice','🧃',{mass:1}],['물','water','💧',{mass:1}]]),
      place: L([['학교','school','🏫',{to:'to school',at:'at school'}],['병원','hospital','🏥'],['식당','restaurant','🍽️'],['가게','store','🏪'],['은행','bank','🏦'],
        ['공원','park','🌳'],['공항','airport','✈️'],['역','station','🚉'],['호텔','hotel','🏨'],['도서관','library','📚'],['산','mountain','⛰️',{to:'to the mountains',at:'in the mountains'}],
        ['바다','sea','🌊',{to:'to the sea',at:'by the sea'}],['집','home','🏠',{to:'home',at:'at home'}]]),
      thing: L([['책','book','📖'],['가방','bag','👜'],['열쇠','key','🔑'],['우산','umbrella','☂️'],['안경','glasses','👓',{pl:1}],['전화기','phone','📱'],
        ['공책','notebook','📓'],['모자','hat','🧢'],['연필','pencil','✏️'],['지갑','wallet','👛'],['공','ball','⚽'],['인형','doll','🧸']]),
      cloth: L([['셔츠','shirt','👕',{v:'입어요'}],['바지','pants','👖',{v:'입어요',pl:1}],['신발','shoes','👟',{v:'신어요',pl:1}],['모자','hat','🧢',{v:'써요'}],
        ['양말','socks','🧦',{v:'신어요',pl:1}],['코트','coat','🧥',{v:'입어요'}],['옷','clothes','👚',{v:'입어요',pl:1}]]),
      feelgood: L([['행복해요','happy','😊'],['신나요','excited','🤩'],['기뻐요','glad','😄']]),
      feelbad: L([['슬퍼요','sad','😢'],['피곤해요','tired','😴'],['심심해요','bored','😑'],['걱정돼요','worried','😟'],['무서워요','scared','😨'],['외로워요','lonely','🥺'],['화가 나요','angry','😠']]),
      worry: L([['걱정돼요','worried','😟'],['슬퍼요','sad','😢'],['무서워요','scared','😨']]),
      color: L([['빨간색','red','🔴'],['주황색','orange','🟠'],['노란색','yellow','🟡'],['초록색','green','🟢'],['파란색','blue','🔵'],['보라색','purple','🟣'],
        ['분홍색','pink','🩷'],['갈색','brown','🟤'],['검은색','black','⚫'],['흰색','white','⚪']]),
      weather: L([['비','rain','🌧️',{kt:'비 오는 날',nt:'A Rainy Day',ks:'비가 와요.',ns:"It's raining.",kstop:'비가 그쳐요.',nstop:'The rain stops.'}],
        ['눈','snow','❄️',{kt:'눈 오는 날',nt:'A Snowy Day',ks:'눈이 와요.',ns:"It's snowing.",kstop:'눈이 그쳐요.',nstop:'The snow stops.'}],
        ['바람','wind','🌬️',{kt:'바람 부는 날',nt:'A Windy Day',ks:'바람이 많이 불어요.',ns:"It's very windy.",kstop:'바람이 멈춰요.',nstop:'The wind stops.'}]]),
      time: L([['아침','morning','🌅'],['오후','afternoon','🌤️'],['저녁','evening','🌇'],['밤','night','🌙']]),
      day: L([['월요일','Monday','📅'],['화요일','Tuesday','📅'],['수요일','Wednesday','📅'],['목요일','Thursday','📅'],['금요일','Friday','📅'],['토요일','Saturday','📅'],['일요일','Sunday','📅']], { name:1 }),
      transport: L([['자동차','car','🚗'],['버스','bus','🚌'],['기차','train','🚆'],['지하철','subway','🚇'],['택시','taxi','🚕']]),
      thingadj: L([['커요','big','🔎'],['작아요','small','🤏'],['예뻐요','pretty','✨'],['무거워요','heavy','🏋️'],['가벼워요','light','🪶'],['비싸요','expensive','💰'],['오래됐어요','old','🕰️']]),
      animaladj: L([['커요','big','🐘'],['작아요','small','🐭'],['예뻐요','pretty','✨'],['빨라요','fast','💨'],['느려요','slow','🐢'],['귀여워요','cute','🥰']]),
      animalverb: L([['뛰어요','runs','💨'],['자요','sleeps','💤'],['먹어요','eats','😋'],['걸어요','walks','🐾'],['놀아요','plays','🎾']]),
      body: L([['머리','head','🤕'],['배','stomach','🤢'],['다리','leg','🦵'],['팔','arm','💪'],['발','foot','🦶'],['손','hand','✋'],['귀','ear','👂']]),
      act: L([['놀아요','play','🎈',{n3:'plays'}],['걸어요','walk','🚶',{n3:'walks'}],['이야기해요','talk','💬',{n3:'talks'}],['운동해요','exercise','🏃',{n3:'exercises'}],['쉬어요','rest','🧺',{n3:'rests'}]]),
      price: L([['비싸요','expensive','💰'],['싸요','cheap','🏷️']]),
      diff: L([['어려워요','hard','😵'],['쉬워요','easy','😎']]),
      temp: L([['추워요','cold','🥶'],['더워요','hot','🥵'],['좋아요','nice','😎']]),
      foodplace: null, natureplace: null, waitplace: null, dayplace: null
    };
    function pickPlaces(keys){ return POOLS.place.filter(function(p){ return keys.indexOf(p.k) >= 0; }); }
    POOLS.foodplace = pickPlaces(['식당','가게','집']);
    POOLS.natureplace = pickPlaces(['산','바다','공원']);
    POOLS.waitplace = pickPlaces(['역','공항','공원','도서관']);
    POOLS.dayplace = pickPlaces(['학교','도서관','공원','은행','병원','역','가게']);
    POOLS.findplace = pickPlaces(['공원','학교','도서관','가게','식당','집']);
    POOLS.zooplace = L([['동물원','zoo','🦁'],['공원','park','🌳'],['산','mountain','⛰️',{to:'to the mountains',at:'in the mountains'}]]);

    // Arcs: need = slot -> pool. A beat is a list of variants [ko, en, scene]; a beat that starts with a
    // number p is optional (used with probability p).
    var ARCS = [
      { id:'snack', t:['{H}의 간식 시간',"{H.poss} Snack Time"], need:{H:'hero',P:'pal',PL:'foodplace',F:'food',D:'drink',FE:'feelgood'}, beats:[
        [['{H|은/는} 배가 고파요.','{H} is hungry.','{H.e}🍽️'],['{H|이/가} 배고파요. 꼬르륵!','{H} is hungry. Grumble!','{H.e}😋']],
        [['{H|이/가} {PL|에} 가요.','{H} goes {PL.to}.','{H.e}🚶{PL.e}'],['{H|은/는} {P|하고} {PL|에} 가요.','{H} goes {PL.to} with {P}.','{H.e}{P.e}{PL.e}']],
        [['"{F} 주세요!"','"{F.A}, please!"','{F.e}👉'],['{H|은/는} {F|을/를} 사요.','{H} buys {a F}.','{F.e}💵'],['{H|은/는} {F|을/를} 골라요.','{H} chooses {a F}.','🤔{F.e}']],
        [0.7,['{D|도} 마셔요.','{H} drinks {a D} too.','{D.e}'],['{P|은/는} {D|을/를} 마셔요.','{P} drinks {a D}.','{P.e}{D.e}']],
        [['{F|이/가} 정말 맛있어요!','{F.The} {F.is} really delicious!','😋{F.e}'],['음~ 맛있어요!','Mmm, delicious!','😋'],['{F|이/가} 조금 뜨거워요. 후후!','{F.The} {F.is} a little hot. Blow, blow!','🔥{F.e}']],
        [['{H|은/는} 이제 {FE}','Now {H} is {FE}.','{H.e}{FE.e}'],['"감사합니다!"','"Thank you!"','🙏']]
      ]},
      { id:'lost', t:['{T|을/를} 찾아요','Looking for the {T}'], need:{H:'hero',P:'pal',T:'thing',CO:'color',AD:'thingadj',W:'worry',PL:'findplace',FE:'feelgood'}, beats:[
        [['{H|은/는} {T|이/가} 있어요.','{H} has {a T}.','{H.e}{T.e}'],['{H|은/는} {T|을/를} 좋아해요.','{H} likes {H.pos} {T}.','{H.e}❤️{T.e}']],
        [['{T|은/는} {CO|이에요/예요}.','{T.The} {T.is} {CO}.','{T.e}{CO.e}'],['{T|이/가} {AD}','{T.The} {T.is} {AD}.','{T.e}{AD.e}']],
        [['어? {T|이/가} 없어요!','Huh? The {T} {T.is} gone!','❓{H.e}'],['{H|이/가} {T|을/를} 잃어버렸어요.','{H} lost the {T}.','😮']],
        [['{H|은/는} {W}','{H} is {W}.','{H.e}{W.e}'],['"{T|이/가} 어디에 있어요?"','"Where {T.is} the {T}?"','🔍']],
        [['{P|이/가} 도와줘요.','{P} helps.','{P.e}🤝'],['{H|은/는} {P|에게} 물어봐요.','{H} asks {P}.','{H.e}💬{P.e}']],
        [['{PL|에} {T|이/가} 있어요!','The {T} {T.is} {PL.at}!','{PL.e}{T.e}✨'],['찾았어요! {T|이/가} {PL|에} 있어요.','Found it! The {T} {T.is} {PL.at}.','🎉{T.e}']],
        [['{H|은/는} 다시 {FE}','{H} is {FE} again.','{H.e}{FE.e}'],['"감사합니다, {P}!"','"Thank you, {P}!"','🙏{P.e}']]
      ]},
      { id:'rainy', t:['{W.kt}','{W.nt}'], need:{H:'hero',P:'pal',W:'weather',C:'cloth',DY:'day',TI:'time',FE:'feelgood'}, noOpen:1, beats:[
        [['{DY} {TI|이에요/예요}.',"It's {DY} {TI}.",'📅{TI.e}'],['오늘은 {DY|이에요/예요}.','Today is {DY}.','📅']],
        [['{W.ks}','{W.ns}','{W.e}']],
        [['{H|은/는} {C|을/를} {C.v}.','{H} puts on {H.pos} {C}.','{H.e}{C.e}'],['{H|은/는} 우산을 가져가요.','{H} takes an umbrella.','☂️']],
        [['{H|은/는} 집에 있어요.','{H} stays home.','🏠'],['{H|은/는} 창문 밖을 봐요.','{H} looks out the window.','🪟👀']],
        [['{H|은/는} 책을 읽어요.','{H} reads a book.','📖'],['{H|은/는} {P|하고} 놀아요.','{H} plays with {P}.','{H.e}{P.e}'],['{H|은/는} 조금 심심해요.','{H} is a little bored.','😑']],
        [['{W.kstop}','{W.nstop}','🌈']],
        [['해가 나와요! {H|은/는} {FE}','The sun comes out! {H} is {FE}.','☀️{H.e}']]
      ]},
      { id:'visit', t:['{P|을/를} 만나는 날','Visiting {P}'], need:{H:'hero',P:'fam',TR:'transport',F:'food',ACT:'act',DY:'day'}, beats:[
        [['{DY|에} {H|은/는} {P|을/를} 만나요.','On {DY}, {H} visits {P}.','{H.e}{P.e}']],
        [0.8,['{H|은/는} {TR|을/를} 타요.','{H} takes the {TR}.','{TR.e}'],['{TR|이/가} 빨라요!','The {TR} is fast!','{TR.e}💨']],
        [['"안녕하세요, {P}!"','"Hello, {P}!"','👋{P.e}'],['{P|이/가} 기다려요.','{P} is waiting.','{P.e}⏳']],
        [['{P|이/가} {F|을/를} 만들어요.','{P} makes {a F}.','{P.e}{F.e}'],['{P|은/는} 요리해요.','{P} cooks.','{P.e}🍳']],
        [['같이 {F|을/를} 먹어요.','They eat {F.the} together.','🍽️{F.e}'],['{F|이/가} 정말 맛있어요!','{F.The} {F.is} really delicious!','😋']],
        [['{H|은/는} {P|하고} {ACT}','{H} and {P} {ACT}.','{H.e}{P.e}{ACT.e}']],
        [['"{P}, 사랑해요!"','"{P}, I love you!"','❤️'],['{H|은/는} {P|이/가} 벌써 보고 싶어요.','{H} already misses {P}.','🥺']]
      ]},
      { id:'animals', t:['{A|을/를} 봤어요!','We Saw {a A}!'], need:{H:'hero',P:'pal',PL:'zooplace',A:'animal',A2:'animal',AD:'animaladj',AV:'animalverb'}, beats:[
        [['{H|은/는} {P|하고} {PL|에} 가요.','{H} goes {PL.to} with {P}.','{H.e}{P.e}{PL.e}']],
        [['와! {A|이/가} 있어요!',"Wow! There's {a A}!",'{A.e}'],['저기 {A|이/가} 있어요.',"There's {a A} over there.",'👉{A.e}']],
        [['{A|은/는} {AD}','The {A} is {AD}.','{A.e}{AD.e}'],['{A|이/가} {AV}','The {A} {AV}.','{A.e}{AV.e}']],
        [['{H|은/는} {A|을/를} 봐요.','{H} watches the {A}.','👀{A.e}']],
        [['그리고 {A2|도} 있어요!',"And there's {a A2} too!",'{A2.e}']],
        [['{H|은/는} {A2|을/를} 좋아해요.','{H} likes the {A2}.','{H.e}❤️{A2.e}'],['{A2|이/가} {H|을/를} 봐요. 하하!','The {A2} looks at {H}. Ha ha!','{A2.e}👀{H.e}']]
      ]},
      { id:'shop', t:['{C} 사기','Buying {a C}'], need:{H:'hero',C:'cloth',CO:'color',PR:'price'}, beats:[
        [['{H|은/는} {C|이/가} 필요해요.','{H} needs {a C}.','{H.e}{C.e}'],['{H|은/는} 새 {C|을/를} 원해요.','{H} wants {C.new}.','{H.e}✨{C.e}']],
        [['{H|은/는} 가게에 가요.','{H} goes to the store.','🏪']],
        [['"어서 오세요!"','"Welcome!"','🙋']],
        [['{CO} {C|이/가} 있어요.','{C.There} {C} in {CO}.','{CO.e}{C.e}']],
        [['"얼마예요?"','"How much is it?"','💵❓']],
        [['{C|이/가} {PR}','{C.It} {C.is} {PR}.','{C.e}{PR.e}']],
        [['{H|은/는} {C|을/를} 사요.','{H} buys {C.them}.','🛍️'],['{H|은/는} {C|을/를} {C.v}. 예뻐요!','{H} puts {C.them} on. So pretty!','{H.e}{C.e}✨']]
      ]},
      { id:'morning', t:['{H}의 아침',"{H.poss} Morning"], need:{H:'hero',F:'food',C:'cloth',PL:'dayplace',TR:'transport'}, noOpen:1, beats:[
        [['아침이에요. {H|이/가} 일어나요.',"It's morning. {H} wakes up.",'🌅{H.e}'],['{H|은/는} 아침 일찍 일어나요.','{H} wakes up early in the morning.','⏰{H.e}']],
        [['{H|은/는} 얼굴을 씻어요.','{H} washes {H.pos} face.','🧼'],['{H|은/는} 손을 씻어요.','{H} washes {H.pos} hands.','🧼✋']],
        [['아침 식사로 {F|을/를} 먹어요.','{H} eats {a F} for breakfast.','🍳{F.e}']],
        [0.8,['{H|은/는} {C|을/를} {C.v}.','{H} puts on {H.pos} {C}.','{C.e}']],
        [['{H|은/는} {PL|에} 가요.','{H} goes {PL.to}.','{PL.e}'],['{H|은/는} {TR|을/를} 타고 {PL|에} 가요.','{H} takes the {TR} {PL.to}.','{TR.e}{PL.e}']],
        [['{PL|에} 도착해요!','{H} arrives {PL.at}!','✅{PL.e}']],
        [['오늘도 좋은 하루예요!',"It's another good day!",'🌞']]
      ]},
      { id:'party', t:['{P}의 생일',"{P.poss} Birthday"], need:{H:'hero',P:'pal',T:'thing',F:'food',D:'drink',FE:'feelgood'}, beats:[
        [['오늘은 {P}의 생일이에요!',"Today is {P.poss} birthday!",'🎂{P.e}']],
        [['{H|은/는} 선물을 사요.','{H} buys a present.','🎁'],['{H|은/는} {T|을/를} 선물로 사요.','{H} buys {a T} as a present.','🎁{T.e}']],
        [['{H|은/는} 파티에 가요.','{H} goes to the party.','🎉']],
        [['"생일 축하합니다!"','"Happy birthday!"','🎂🎶']],
        [['{P|은/는} 정말 {FE}','{P} is really {FE}.','{P.e}{FE.e}']],
        [['모두 케이크를 먹어요.','Everyone eats cake.','🍰'],['모두 {F|을/를} 먹고 {D|을/를} 마셔요.','Everyone eats {F.some} and drinks {D.some}.','{F.e}{D.e}']],
        [['{H|은/는} {P|하고} 놀아요. 정말 재미있어요!','{H} plays with {P}. It is so much fun!','🥳']]
      ]},
      { id:'outing', t:['{PL}에서',"A Day {PL.at}"], need:{H:'hero',P:'pal',PL:'natureplace',DY:'day',TE:'temp',ACT:'act',F:'food'}, beats:[
        [['{DY|에} {H|은/는} {PL|에} 가요.','On {DY}, {H} goes {PL.to}.','{PL.e}{H.e}']],
        [['날씨가 {TE}',"The weather is {TE}.",'{TE.e}'],['하늘이 정말 예뻐요.','The sky is really pretty.','🌤️']],
        [['{H|은/는} {P|하고} 같이 걸어요.','{H} walks with {P}.','🚶{P.e}'],['{H|은/는} {PL|에서} {ACT}','{H} {ACT.n3} {PL.at}.','{ACT.e}']],
        [0.7,['{H|은/는} 조금 피곤해요. 그래서 쉬어요.','{H} is a little tired, so {H.he} rests.','😮‍💨🧺']],
        [['{F|을/를} 먹어요. 맛있어요!','{H} eats {F.some}. Yum!','{F.e}😋']],
        [['저녁에 {H|은/는} 집에 돌아와요.','In the evening, {H} comes back home.','🌇🏠']]
      ]},
      { id:'sick', t:['{H|이/가} 아파요','{H} Feels Sick'], need:{H:'hero',P:'fam',B:'body'}, beats:[
        [['{H|은/는} 아파요.','{H} is sick.','🤒{H.e}'],['{H|은/는} {B|이/가} 아파요.',"{H.poss} {B} hurts.",'🤕{B.e}']],
        [['{H|은/는} 병원에 가요.','{H} goes to the hospital.','🏥']],
        [['{H|은/는} 의자에 앉아서 기다려요.','{H} sits on a chair and waits.','🪑⏳']],
        [['의사 선생님이 말해요: "괜찮아요!"','The doctor says, "You\'ll be okay!"','🧑‍⚕️']],
        [['{H|은/는} 집에서 쉬어요.','{H} rests at home.','🛌'],['{H|은/는} 물을 마시고 자요.','{H} drinks water and sleeps.','💧😴']],
        [0.8,['{P|이/가} 국을 만들어요.','{P} makes soup.','{P.e}🍲']],
        [['다음 날, {H|은/는} 괜찮아요!','The next day, {H} is fine!','🌞{H.e}']]
      ]},
      { id:'homework', t:['{H}의 숙제',"{H.poss} Homework"], need:{H:'hero',P:'pal',DF:'diff'}, beats:[
        [['{H|은/는} 숙제가 있어요.','{H} has homework.','📚{H.e}']],
        [['숙제가 {DF}','The homework is {DF}.','📝{DF.e}']],
        [['{H|은/는} 도서관에 가요.','{H} goes to the library.','📚'],['{H|은/는} 책상에 앉아요.','{H} sits at the desk.','🪑']],
        [['{H|은/는} 공책에 써요.','{H} writes in a notebook.','📓✏️'],['{H|은/는} 책을 봐요.','{H} looks at a book.','📖']],
        [['{P|이/가} 도와줘요.','{P} helps.','{P.e}🤝'],['{H|은/는} {P|에게} 물어봐요.','{H} asks {P}.','💬{P.e}']],
        [['{H|은/는} 이제 이해해요!','Now {H} understands!','💡'],['숙제가 끝나요!','The homework is done!','✅']],
        [0.7,['{H|은/는} {P|하고} 놀아요.','{H} plays with {P}.','🎈']]
      ]},
      { id:'cook', t:['같이 요리해요',"Let's Cook Together"], need:{H:'hero',P:'pal',F:'food',F2:'food'}, beats:[
        [['{H|은/는} {P|하고} 요리해요.','{H} cooks with {P}.','👩‍🍳{H.e}{P.e}']],
        [['{H|은/는} 가게에서 {F|을/를} 사요.','{H} buys {F.some} at the store.','🏪{F.e}']],
        [['{F2|도} 사요.','{H} buys {F2.some} too.','{F2.e}']],
        [['{P|이/가} 물어봐요: "뭐 만들어요?"','{P} asks, "What are we making?"','❓']],
        [['{H|은/는} 열심히 만들어요.','{H} works hard on it.','💪'],['음식이 뜨거워요!','The food is hot!','🔥🍲']],
        [['같이 먹어요. 정말 맛있어요!','They eat together. It is really delicious!','😋']]
      ]},
      { id:'pet', t:['{H}의 {A}',"{H.poss} {A.Cap}"], need:{H:'names',A:'animal',CO:'color',AV:'animalverb',PL:'findplace'}, beats:[
        [['{H|은/는} {A|이/가} 있어요.','{H} has {a A}.','{H.e}{A.e}']],
        [['{A|은/는} {CO|이에요/예요}.','The {A} is {CO}.','{A.e}{CO.e}'],['{A|이/가} 정말 귀여워요.','The {A} is really cute.','🥰{A.e}']],
        [['{A|은/는} 매일 {AV}','The {A} {AV} every day.','{A.e}{AV.e}']],
        [['{H|은/는} {A|하고} 놀아요.','{H} plays with the {A}.','{H.e}{A.e}']],
        [['어? {A|이/가} 없어요!','Huh? The {A} is gone!','❓'],['{A|이/가} 어디에 있어요?','Where is the {A}?','🔍']],
        [['{H|은/는} {PL|에} 가요. 거기 {A|이/가} 있어요!','{H} goes {PL.to}. The {A} is there!','{PL.e}{A.e}']],
        [['{H|은/는} {A|을/를} 사랑해요.','{H} loves the {A}.','❤️{A.e}']]
      ]},
      { id:'school', t:['학교 가는 날','A School Day'], need:{H:'hero',P:'pal',T:'thing',F:'food',W:'feelbad',DY:'day'}, beats:[
        [['{DY} 아침, {H|은/는} 학교에 가요.','On {DY} morning, {H} goes to school.','🏫']],
        [['{H|은/는} 가방에 {T|을/를} 넣어요.','{H} puts {a T} in {H.pos} bag.','🎒{T.e}']],
        [['선생님이 말해요: "안녕하세요!"','The teacher says, "Hello!"','🧑‍🏫👋']],
        [['오늘은 시험이 있어요.',"There's a test today.",'📝'],['수업이 재미있어요.','Class is fun.','📚✨']],
        [0.8,['{H|은/는} 조금 {W}','{H} is a little {W}.','{H.e}{W.e}']],
        [['점심에 {H|은/는} {P|하고} {F|을/를} 먹어요.','At lunch, {H} eats {F.some} with {P}.','🍱{P.e}']],
        [['수업이 끝나요!','Class is over!','🔔']]
      ]},
      { id:'wait', t:['{P|을/를} 기다려요','Waiting for {P}'], need:{H:'hero',P:'pal',PL:'waitplace',PL2:'place',W:'worry'}, beats:[
        [['{H|은/는} {PL|에서} {P|을/를} 기다려요.','{H} waits for {P} {PL.at}.','⏳{PL.e}']],
        [['{P|이/가} 안 와요.',"{P} isn't here yet.",'⌛'],['"{P|은/는} 어디에 있어요?"','"Where is {P}?"','❓']],
        [['{H|은/는} {W}','{H} is {W}.','{H.e}{W.e}']],
        [['{H|은/는} {P|에게} 전화해요.','{H} calls {P}.','📱']],
        [['"미안해요! 지금 가요!"',"\"Sorry! I'm coming now!\"",'📱🏃']],
        [['{P|이/가} 도착해요!','{P} arrives!','🎉{P.e}']],
        [['두 사람은 같이 {PL2|에} 가요.','The two of them go {PL2.to} together.','{H.e}{P.e}{PL2.e}']]
      ]},
      { id:'windy', t:['바람 부는 날','A Windy Day'], need:{H:'hero',C:'cloth',A:'animal',PL:'findplace'}, beats:[
        [['바람이 많이 불어요.',"It's very windy.",'🌬️']],
        [['{H|은/는} {C|을/를} {C.v}.','{H} puts on {H.pos} {C}.','{H.e}{C.e}']],
        [['휙! {C|이/가} 날아가요!','Whoosh! {C.It} {C.flies} away!','💨{C.e}']],
        [['{H|은/는} 뛰어요!','{H} runs!','🏃']],
        [['{C|이/가} {PL|에} 있어요!','{C.It} {C.is} {PL.at}!','{PL.e}{C.e}'],['{A|이/가} {C|을/를} 가지고 있어요!','{a A} has {C.them}!','{A.e}{C.e}']],
        [['{H|은/는} 웃어요. 하하!','{H} laughs. Ha ha!','😂']]
      ]}
    ];
    var OPENERS = [
      ['{DY} {TI|이에요/예요}.',"It's {DY} {TI}.",'📅{TI.e}'],['{TI|이에요/예요}.',"It's {TI}.",'{TI.e}'],['오늘은 {DY|이에요/예요}.','Today is {DY}.','📅'],['{H|이에요/예요}.','This is {H}.','{H.e}']
    ];
    var CLOSERS = [
      ['정말 좋은 하루였어요!','It was a really good day!','🌈'],['{H|은/는} 피곤해요. 이제 자요. 잘 자요!','{H} is tired. Time to sleep. Good night!','🌙😴'],
      ['{H|은/는} {FE}','{H} is {FE}.','{H.e}{FE.e}'],['내일 또 만나요!','See you tomorrow!','👋']
    ];

    // Easy English (child profiles): short, mostly decodable sentences. Variants are [text, scene].
    var E = function(rows, extra){ return rows.map(function(r){ var o = { k:r[0], n:r[0], e:r[1] }; if(r[2]) Object.assign(o, r[2]); if(extra) Object.assign(o, extra); return o; }); };
    var EPOOLS = {
      hero: E([['Sam','👦',{g:'m'}],['Pam','👧',{g:'f'}],['Ben','👦',{g:'m'}],['Meg','👧',{g:'f'}],['Max','👦',{g:'m'}],['Dot','👧',{g:'f'}],['Tim','👦',{g:'m'}],['Jen','👧',{g:'f'}]], { name:1 }),
      animal: E([['cat','🐱'],['dog','🐶'],['pig','🐷'],['hen','🐔'],['fox','🦊'],['bug','🐛'],['duck','🦆'],['frog','🐸'],['fish','🐟']]),
      thing: E([['hat','🎩'],['bag','👜'],['cup','🥤'],['pen','🖊️'],['fan','🪭'],['map','🗺️'],['net','🥅'],['pot','🍲'],['rug','🟫'],['lamp','💡'],['mask','🎭'],['vest','🦺'],['bucket','🪣'],['box','📦'],['sock','🧦'],['doll','🪆']]),
      food: E([['jam','🍓',{mass:1}],['milk','🥛',{mass:1}],['chocolate','🍫',{mass:1}],['egg','🥚'],['bun','🍞'],['nut','🥜']]),
      place: E([['shed','🛖'],['tent','⛺'],['van','🚐'],['bus','🚌'],['box','📦'],['nest','🪺'],['bed','🛏️'],['den','🕳️']]),
      adj: E([['big','🔎'],['red','🔴'],['pink','🩷'],['wet','💦'],['soft','☁️'],['fluffy','☁️'],['fuzzy','🧸'],['bumpy','〰️'],['bright','✨'],['tiny','🤏']]),
      verb: E([['runs','🏃'],['hops','🐇'],['naps','😴'],['digs','⛏️'],['jumps','🦘'],['sits','🪑'],['spins','🌀']])
    };
    EPOOLS.pal = EPOOLS.hero;
    var EARCS = [
      { id:'e-lost', t:['The Lost {T.Cap}'], need:{H:'hero',T:'thing',AD:'adj',PL:'place',A:'animal'}, beats:[
        [['{H} has a {AD} {T}.','{H.e}{T.e}'],['{H} has {a T}. It is {AD}.','{H.e}{T.e}']],
        [['Oh no! The {T} is not here!','😮'],['Where is the {T}?','❓']],
        [['{H} looks in the {PL}.','{PL.e}👀'],['Is it in the {PL}? No!','{PL.e}❌']],
        [0.7,['{H} looks under the bed.','🛏️👀']],
        [['The {A} has the {T}!','{A.e}{T.e}'],['Look! The {T} is on the {A}!','{A.e}{T.e}']],
        [['{H} hugs the {A}.','🤗{A.e}'],['{H} is glad. Yes!','😊']]
      ]},
      { id:'e-sun', t:['Fun in the Sun'], need:{H:'hero',P:'pal',T:'thing'}, beats:[
        [['The sun is hot.','☀️'],['It is a hot, hot day.','🔥☀️']],
        [['{H} and {P} run to the sand.','🏃🏖️']],
        [['{H} digs in the sand.','⛏️'],['{P} fills a bucket with sand.','🪣']],
        [['They make a big sandcastle.','🏰'],['They dig a moat.','🌊']],
        [0.7,['{H} sees {a T} in the sand.','{T.e}']],
        [['Splash! Now {H} is wet.','💦'],['A wave hits the sandcastle. Splash!','🌊💥']]
      ]},
      { id:'e-mud', t:['The {AD.Cap} {A.Cap}'], need:{H:'hero',A:'animal',AD:'adj'}, beats:[
        [['{a A} sits in the mud.','{A.e}🟤']],
        [['The {A} is {AD} and wet.','{A.e}💦']],
        [['{H} has a net.','🥅{H.e}'],['Can {H} get the {A}?','❓']],
        [['The {A} runs! The {A} jumps!','💨{A.e}']],
        [['Now {H} is in the mud too!','😂🟤']],
        [['{H} and the {A} get a bath.','🛁'],['{H} and the {A} sit in the sun.','☀️']]
      ]},
      { id:'e-camp', t:['Camp Night'], need:{H:'hero',P:'pal',A:'animal',F:'food'}, beats:[
        [['{H} and {P} set up a tent.','⛺']],
        [['They sit by the campfire.','🔥'],['The campfire is bright.','🔥✨']],
        [['{H} has {a F}.','{F.e}'],['They toast a bun.','🍞🔥']],
        [['What is that? Is it a fox?','👀'],['Crack! What is in the dark?','🌑']],
        [['No! It is {a A}.','{A.e}']],
        [['{H} and {P} nap in the tent.','😴⛺']]
      ]},
      { id:'e-gift', t:['A Gift for {P}'], need:{H:'hero',P:'pal',T:'thing',AD:'adj'}, beats:[
        [['It is {P.poss} birthday!','🎂']],
        [['{H} has a gift for {P}.','🎁']],
        [['The gift is in a big box.','📦'],['The gift is in a red bag.','👜']],
        [['What is in it? Is it {a T}?','❓']],
        [['Yes! It is a {AD} {T}!','{T.e}✨']],
        [['{P} is glad. {P} hugs {H}.','🤗']]
      ]},
      { id:'e-bus', t:['On the Bus'], need:{H:'hero',P:'pal',A:'animal'}, beats:[
        [['{H} gets on the bus.','🚌']],
        [['The bus is big and red.','🚌🔴']],
        [['{H} sits next to {P}.','🪑']],
        [['The bus stops at the zoo.','🛑🦁'],['The bus stops at the farm.','🛑🚜']],
        [['{H} and {P} hop off.','🐇']],
        [['They see {a A}!','{A.e}'],['They pet {a A}.','🤚{A.e}']]
      ]},
      { id:'e-nest', t:['The Egg in the Nest'], need:{H:'hero',P:'pal'}, beats:[
        [['A hen sits on a nest.','🐔🪺']],
        [['In the nest is an egg.','🥚']],
        [['{H} and {P} sit and wait.','⏳']],
        [['Tap, tap, tap!','🥚💥']],
        [['Look! It is a chick!','🐣']],
        [['{H} and {P} grin.','😁']]
      ]},
      { id:'e-snack', t:['Snack Time'], need:{H:'hero',P:'pal',F:'food'}, beats:[
        [['{H} wants a snack.','🍽️']],
        [['{H} gets jam and a bun.','🍓🍞'],['{H} gets {a F}.','{F.e}']],
        [['{P} gets a cup of milk.','🥛']],
        [['Oops! The milk spills on the rug!','💦']],
        [['{H} gets a rag. Wipe, wipe!','🧽']],
        [['Now they sit and eat.','😋']]
      ]},
      { id:'e-rain', t:['A Rainy Day'], need:{H:'hero',P:'pal'}, beats:[
        [['It is a rainy day.','🌧️']],
        [['{H} has a vest and a hat.','🦺🎩']],
        [['Splash! {H} jumps in the mud.','💦🟤']],
        [['Now {H} is wet.','💧'],['{H} is damp and wet.','💧']],
        [['{H} runs back in.','🏃🏠']],
        [['{H} naps on a soft rug.','😴']]
      ]},
      { id:'e-zoo', t:['A Trip to the Zoo'], need:{H:'hero',P:'pal',A:'animal'}, beats:[
        [['{H} and {P} visit the zoo.','🦁']],
        [['The zookeeper has a bucket.','🪣']],
        [['Look at the big {A}!','{A.e}'],['The {A} gets a snack.','{A.e}🍽️']],
        [['The {A} naps in the sun.','😴☀️']],
        [['{H} waves to the {A}.','👋{A.e}']]
      ]},
      { id:'e-garden', t:['In the Garden'], need:{H:'hero'}, beats:[
        [['{H} digs in the soil.','🌱⛏️']],
        [['Look! An earthworm!','🪱']],
        [['It is wiggling.','〰️']],
        [['{H} sets it down gently.','🤲']],
        [['{H} puts in a seed.','🌰'],['{H} gets the water.','💧']],
        [['Now {H} has to wait.','⏳']]
      ]},
      { id:'e-library', t:['At the Library'], need:{H:'hero',A:'animal'}, beats:[
        [['{H} goes to the library.','📚']],
        [['The librarian has a puppet.','🧸']],
        [['{H} picks a book from the shelf.','📕']],
        [['The book is about {a A}.','{A.e}']],
        [['{H} checks out the book.','✅']],
        [['{H} reads it in bed.','🛏️📖']]
      ]},
      { id:'e-soccer', t:['Soccer Fun'], need:{H:'hero',P:'pal'}, beats:[
        [['{H} has a ball.','⚽']],
        [['The coach sets up cones.','🔶']],
        [['{H} kicks the ball to {P}.','⚽💨']],
        [['{P} kicks it in the net!','🥅']],
        [['{P} scores!','🎉']],
        [['{H} and {P} jump and yell.','🙌']]
      ]},
      { id:'e-snow', t:['Snow Day'], need:{H:'hero',P:'pal'}, beats:[
        [['It is a snow day!','❄️']],
        [['{H} gets a hat and a vest.','🎩🦺']],
        [['{H} and {P} go sledding.','🛷']],
        [['Zip! Down the hill they go!','💨']],
        [['{H} makes a snowman.','⛄']],
        [['Then a cup of hot milk.','🥛']]
      ]},
      { id:'e-pet', t:['{H} and the {A.Cap}'], need:{H:'hero',A:'animal',V:'verb',AD:'adj'}, beats:[
        [['{H} has {a A}.','{H.e}{A.e}']],
        [['The {A} is {AD}.','{A.e}']],
        [['The {A} {V}.','{A.e}{V.e}']],
        [['Can the {A} jump? Yes!','🦘'],['Can the {A} sit? Yes!','🪑']],
        [['{H} pets the {A}.','🤚{A.e}']],
        [['{H} and the {A} nap.','😴']]
      ]}
    ];
    var EOPEN = [['This is {H}.','{H.e}'],['Here is {H}.','{H.e}']];

    function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
    function enA(s){ if(s.name) return s.n; if(s.mass) return 'some '+s.n; if(s.pl) return s.n; return (/^[aeiou]/i.test(s.n) ? 'an ' : 'a ') + s.n; }
    function pos(s){ return s.g === 'f' ? 'her' : (s.g === 'm' ? 'his' : (s.g === 'n' && !s.hero ? 'their' : 'its')); }
    function enField(s, f){
      switch(f){
        case 'to': return s.to || ('to the '+s.n);
        case 'at': return s.at || ('at the '+s.n);
        case 'pos': return pos(s);
        case 'he': return s.g === 'f' ? 'she' : (s.g === 'm' ? 'he' : 'it');
        case 'poss': return s.n + "'s";
        case 'is': return s.pl ? 'are' : 'is';
        case 'It': return s.pl ? 'They' : 'It';
        case 'them': return s.pl ? 'them' : 'it';
        case 'flies': return s.pl ? 'fly' : 'flies';
        case 'There': return s.pl ? 'There are' : 'There is a';
        case 'the': return s.name ? s.n : 'the '+s.n;
        case 'The': return s.name ? s.n : 'The '+s.n;
        case 'some': return enA(s);
        case 'A': return cap(s.n);
        case 'Cap': return s.n.replace(/\b\w/g, function(c){ return c.toUpperCase(); });
        case 'cap': return cap(s.n);
        case 'bare': return s.n;
        case 'new': return s.pl ? 'new '+s.n : 'a new '+s.n;
        default: return s[f] != null ? s[f] : s.n;
      }
    }
    function fill(tpl, slots, lang){
      return String(tpl).replace(/\{(a )?([A-Z][A-Z0-9]*)(?:\.(\w+))?(?:\|([^}]+))?\}/g, function(m, art, key, field, jos){
        var s = slots[key]; if(!s) return m;
        if(field === 'e') return s.e || '';
        if(lang === 'ko'){
          var base = field ? (s[field] != null ? s[field] : s.k) : s.k;
          return jos ? josa(base, jos) : base;
        }
        if(art) return enA(s);
        return field ? enField(s, field) : s.n;
      });
    }
    function tidyEn(s){ s = s.replace(/\s+/g, ' ').trim(); return s.replace(/^(["“]?)(\w)/, function(m, q, c){ return q + c.toUpperCase(); }); }

    // ---- learner's words ----
    function norm(w){ return String(w||'').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim(); }
    function collectWords(cards){
      var map = {};
      cards.forEach(function(c){
        var learned = (c.reps||0) > 0 || (c.state && c.state !== 'new');
        [c.front, c.back].forEach(function(t){
          String(t||'').split(/[\/,]/).forEach(function(part){
            var w = norm(part);
            if(!w || w.length > 24) return;
            [w].concat(w.split(' ').length <= 3 ? w.split(' ') : []).forEach(function(x){
              if(!x) return;
              var cur = map[x] || 0;
              map[x] = Math.max(cur, learned ? 2 : 1);
            });
          });
        });
      });
      return map;
    }
    var EASY_FUNCTION_WORDS = {}; 'a an the and but or so to of in on at up is am are was were be it he she we they i you my his her our their this that with for from not no yes can see go get got has had have do did will'.split(' ').forEach(function(w){ EASY_FUNCTION_WORDS[w] = 1; });
    // Word Bank levels (1 new, 2 learning, 3 known) override the simple "studied or not" guess.
    function applyLevels(words, list){
      (list || []).forEach(function(e){
        var lv = WB_RANK[e.status] || 1, w = norm(e.word);
        if(!w) return;
        [w].concat(w.split(' ').length <= 3 ? w.split(' ') : []).forEach(function(x){ if(x) words[x] = x === w ? lv : Math.max(words[x] || 0, lv); });
      });
      return words;
    }
    var PARTICLES = ['이','가','을','를','은','는','도','에','에서','하고','와','과','랑','이랑','의','로','으로','에게','이에요','예요','아','야'];
    function knownMatch(token, lang, words){
      var t = norm(token); if(!t) return null;
      if(words[t]) return { lv: words[t], base: t };
      if(lang === 'ko'){
        for(var i = 0; i < PARTICLES.length; i++){
          var p = PARTICLES[i], b = t.slice(0, -p.length);
          if(t.length > p.length && t.slice(-p.length) === p && words[b]) return { lv: words[b], base: b };
        }
        return null;
      }
      if(/s$/.test(t) && words[t.slice(0,-1)]) return { lv: words[t.slice(0,-1)], base: t.slice(0,-1) };
      return null;
    }
    function knownLevel(token, lang, words){ var m = knownMatch(token, lang, words); return m ? m.lv : 0; }
    function entryLevel(e, lang, words){ var key = norm(lang === 'ko' ? e.k : String(e.n).replace(/^the /,'')); return words[key] || 0; }
    function pickFrom(pool, lang, words, used){
      var opts = pool.filter(function(e){ return !used[e.k]; });
      if(!opts.length) opts = pool;
      var total = 0, ws = opts.map(function(e){ var lv = entryLevel(e, lang, words); var w = lv === 2 ? 10 : (lv === 3 ? 8 : (lv === 1 ? 4 : 1)); total += w; return w; });
      var r = Math.random() * total;
      for(var i = 0; i < opts.length; i++){ r -= ws[i]; if(r <= 0) return opts[i]; }
      return opts[opts.length-1];
    }
    function buildOne(arc, lang, words){
      var easy = lang === 'easy';
      var pools = easy ? EPOOLS : POOLS;
      var used = {}, slots = {};
      Object.keys(arc.need).forEach(function(key){
        var e = pickFrom(pools[arc.need[key]], easy ? 'en' : lang, words, used);
        used[e.k] = 1; slots[key] = e;
      });
      ['DY','TI','FE'].forEach(function(k){ if(!slots[k] && !easy){ var e = pickFrom(POOLS[{DY:'day',TI:'time',FE:'feelgood'}[k]], lang, words, used); used[e.k] = 1; slots[k] = e; } });
      var lines = [];
      if(easy){ if(Math.random() < 0.5) lines.push(rnd(EOPEN)); }
      else if(!arc.noOpen && Math.random() < 0.45) lines.push(rnd(OPENERS));
      arc.beats.forEach(function(b){
        var opt = typeof b[0] === 'number' ? b[0] : 1;
        var vs = typeof b[0] === 'number' ? b.slice(1) : b;
        if(Math.random() <= opt) lines.push(rnd(vs));
      });
      if(!easy && Math.random() < 0.5) lines.push(rnd(CLOSERS));
      var pages = lines.map(function(v, i){
        if(easy) return { id:'sm'+i, front: tidyEn(fill(v[0], slots, 'en')), back:'', note: fill(v[1], slots, 'en') || '🌊' };
        var ko = fill(v[0], slots, 'ko').replace(/([\uAC00-\uD7A3])$/, '$1.'), en = tidyEn(fill(v[1], slots, 'en'));
        return lang === 'ko' ? { id:'sm'+i, front: ko, back: en, note: fill(v[2], slots, 'ko') || '🌊' }
                             : { id:'sm'+i, front: en, back: '', note: fill(v[2], slots, 'en') || '🌊' };
      });
      var title = easy ? tidyEn(fill(arc.t[0], slots, 'en')) : (lang === 'ko' ? fill(arc.t[0], slots, 'ko') : tidyEn(fill(arc.t[1], slots, 'en')));
      // Learning words score highest (they need the practice), known words next, new words least.
      // i+1: a sentence should carry at most one word the learner hasn't started on yet, so every
      // extra unfamiliar word on a page costs points.
      var seen = {}, score = 0, scoreLang = easy ? 'en' : lang;
      pages.forEach(function(p){
        var unfamiliar = 0;
        p.front.split(/\s+/).forEach(function(tok){
          if(!/[\p{L}]/u.test(tok)) return;
          var m = knownMatch(tok, scoreLang, words);
          if(!m || m.lv < 2){ if(!(scoreLang === 'en' && EASY_FUNCTION_WORDS[norm(tok)])) unfamiliar++; }
          if(m && !seen[m.base]){ seen[m.base] = m.lv; score += m.lv === 2 ? 3 : (m.lv === 3 ? 2 : 1); }
        });
        if(unfamiliar > 1) score -= 1.5 * (unfamiliar - 1);
      });
      return { arc: arc.id, title: title, pages: pages, score: score, words: Object.keys(seen) };
    }
    function make(opts){
      var lang = opts.lang, words = opts.words || {}, recent = opts.recent || [];
      var all = lang === 'easy' ? EARCS : ARCS, best = null;
      // Plots used in the last few stories are skipped entirely, so the same plot never comes twice in a row.
      var arcs = all.filter(function(a){ return recent.indexOf(a.id) < 0; });
      if(arcs.length < 3) arcs = all;
      for(var i = 0; i < 16; i++){
        var arc = rnd(arcs);
        var c = buildOne(arc, lang, words);
        c.rank = c.score + Math.random() * 6;
        if(!best || c.rank > best.rank) best = c;
      }
      return best;
    }
    function count(){
      function variants(arcs){ return arcs.reduce(function(n, a){ return n + a.beats.reduce(function(m, b){ return m + (typeof b[0] === 'number' ? b.length - 1 : b.length); }, 0); }, 0); }
      return { arcs: ARCS.length + EARCS.length, sentences: variants(ARCS) + variants(EARCS) + OPENERS.length + CLOSERS.length + EOPEN.length };
    }
    return { make: make, collectWords: collectWords, applyLevels: applyLevels, knownLevel: knownLevel, josa: josa, count: count, _arcs: ARCS, _earcs: EARCS };
  })();

  // Which kind of story a profile gets: Korean for adult profiles with Korean decks, easy English for
  // child profiles, plain English otherwise.
  function storyLangFor(cards){
    var p = S.profile || {};
    if(p.mode === 'child' || p.initialMode === 'child') return 'easy';
    var hangul = cards.filter(function(c){ return /[가-힣]/.test((c.front||'') + (c.back||'')); }).length;
    return hangul >= 20 ? 'ko' : 'en';
  }
  /* ---------- WORD BANK ----------
     Every word in the profile's decks, sorted into New (never practised), Learning and Known, from the
     cards' own review history: a word is Known once it has been remembered after a gap of three weeks,
     or answered right on most tries over at least a week. The same word in several decks counts once,
     at its best status. A grown-up can also mark a word "I know this". Korean profiles list the Korean
     side of each card; English profiles list the English word side. Story Maker reads the same levels
     (see startStoryMaker) so its stories lean on known and learning words. */
  var WB_RANK = { 'new': 1, learning: 2, known: 3 };
  var WB_ORDER = { learning: 0, 'new': 1, known: 2 }; // list order: what's being learned now comes first
  function wbCardStatus(c){
    var seen = (c.timesSeen||0) > 0 || (c.reps||0) > 0 || cardState(c) !== 'new';
    if(!seen) return 'new';
    var iv = c.interval || 0, n = c.timesSeen || 0, acc = n ? (c.timesCorrect || 0) / n : 0;
    if(cardState(c) === 'review' && !c.isLeech && (iv >= 21 || (iv >= 6 && n >= 3 && acc >= 0.8))) return 'known';
    return 'learning';
  }
  function wbBuild(decks, lists, lang, marks){
    var map = {};
    decks.forEach(function(d, i){
      if(d.equationMode || d.miniStoryMode || d.subject === 'math') return;
      (lists[i] || []).forEach(function(c){
        if(c.mode === 'build' || c.mode === 'hanja' || c.mode === 'numsys') return; // whole sentences; Chinese-bridge cards repeat words from other decks
        var f = String(c.front||'').trim(), b = String(c.back||'').trim(), word, meaning;
        if(lang === 'ko'){
          var fk = /[가-힣]/.test(f), bk = /[가-힣]/.test(b);
          if(fk === bk) return;
          word = fk ? f : b; meaning = fk ? b : f;
        } else {
          if(/[가-힣]/.test(f + b) || /\d/.test(f)) return;
          word = f; meaning = (b && b.toLowerCase() !== f.toLowerCase()) ? b : '';
        }
        if(/[.!?]["”’]?$/.test(word) && word.split(/\s+/).length > 1) return; // a sentence, not a word
        word = word.replace(/^["“'‘]+|["”'’.!?]+$/g, '').trim();
        if(!word || word.split(/\s+/).length > (lang === 'ko' ? 3 : 2)) return;
        var k = VoicePack.key(word); if(!k) return;
        var st = wbCardStatus(c);
        var e = map[k] || (map[k] = { key: k, word: word, meaning: '', status: 'new', seen: 0, right: 0, decks: [] });
        if(WB_RANK[st] > WB_RANK[e.status]) e.status = st;
        if(!e.meaning && meaning) e.meaning = meaning;
        e.seen += c.timesSeen || 0; e.right += c.timesCorrect || 0;
        if(e.decks.indexOf(d.name) === -1) e.decks.push(d.name);
      });
    });
    return Object.keys(map).map(function(k){
      var e = map[k]; e.auto = e.status; e.marked = !!(marks && marks[k] === 'known');
      if(e.marked) e.status = 'known';
      return e;
    }).sort(function(a, b){ return WB_ORDER[a.status] - WB_ORDER[b.status] || a.word.localeCompare(b.word); });
  }
  // -> Promise<{ lang, list, marks }> for the active profile.
  function wbLoad(){
    var decks = S.decks.filter(function(d){ return !d.archived; });
    return Promise.all([
      Promise.all(decks.map(function(d){ return S.store.getCardsOnce(d.id).catch(function(){ return []; }); })),
      S.store.getWordBank ? S.store.getWordBank().catch(function(){ return null; }) : Promise.resolve(null)
    ]).then(function(r){
      var lists = r[0], cards = [].concat.apply([], lists), marks = (r[1] && r[1].marks) || {};
      var lang = storyLangFor(cards) === 'ko' ? 'ko' : 'en';
      return { lang: lang, list: wbBuild(decks, lists, lang, marks), marks: marks, cards: cards };
    });
  }
  function openWordBank(){
    S.view = 'wordBank'; S.wb = { loading: true, filter: S.wb && S.wb.filter || 'all', q: '' };
    render();
    wbLoad().then(function(res){ if(S.view !== 'wordBank') return; Object.assign(S.wb, res, { loading: false }); render(); })
      .catch(function(){ if(S.view === 'wordBank'){ S.wb.loading = false; S.wb.list = []; render(); } });
  }
  function renderWordBank(){
    var wb = S.wb || { loading: true };
    var adult = !!(S.managingDecks || S.editMode || (S.profile && S.profile.mode === 'adult'));
    var head = '<div class="nav-row"><button class="back-btn" data-act="wb-back">⟵ Lagoon</button><span class="nav-title">📒 Word Bank</span></div>';
    if(wb.loading){ app.innerHTML = head + '<div class="empty-filter-note">Counting your words…</div>'; wbWire(); return; }
    var list = wb.list || [];
    var n = { 'new': 0, learning: 0, known: 0 }; list.forEach(function(e){ n[e.status]++; });
    var total = list.length || 1;
    var filter = wb.filter || 'all', q = String(wb.q || '').trim().toLowerCase();
    var shown = list.filter(function(e){
      if(filter !== 'all' && e.status !== filter) return false;
      return !q || e.word.toLowerCase().indexOf(q) !== -1 || String(e.meaning).toLowerCase().indexOf(q) !== -1;
    });
    var LABEL = { known: '✅ Known', learning: '🌱 Learning', 'new': '✨ New' };
    var rows = shown.slice(0, 500).map(function(e){
      return '<li class="wb-row wb-'+e.status+'">' +
        '<button type="button" class="wb-say" data-wb-say="'+esc(e.word)+'" aria-label="Hear '+esc(e.word)+'">'+ccIcon('sound')+'</button>' +
        '<div class="wb-text"><b lang="'+(wb.lang === 'ko' ? 'ko' : 'en')+'">'+esc(e.word)+'</b>'+(e.meaning ? '<span>'+esc(e.meaning)+'</span>' : '')+'</div>' +
        '<span class="wb-chip">'+LABEL[e.status]+'</span>' +
        (adult ? (e.marked ? '<button type="button" class="wb-mark" data-wb-unmark="'+esc(e.key)+'">Undo</button>'
                           : (e.status !== 'known' ? '<button type="button" class="wb-mark" data-wb-mark="'+esc(e.key)+'">I know it</button>' : '')) : '') +
      '</li>';
    }).join('');
    app.innerHTML = head +
      '<div class="wb-page">' +
        '<div class="wb-summary">' +
          '<div class="wb-stat known"><b class="tabular">'+n.known+'</b><span>Known</span></div>' +
          '<div class="wb-stat learning"><b class="tabular">'+n.learning+'</b><span>Learning</span></div>' +
          '<div class="wb-stat new"><b class="tabular">'+n['new']+'</b><span>New</span></div>' +
        '</div>' +
        '<div class="wb-bar" role="img" aria-label="'+n.known+' known, '+n.learning+' learning, '+n['new']+' new out of '+list.length+' words">' +
          '<i class="known" style="width:'+(n.known/total*100)+'%"></i><i class="learning" style="width:'+(n.learning/total*100)+'%"></i></div>' +
        '<p class="wb-note">'+list.length+' words across your decks. A word is <b>Known</b> once you remember it after three weeks, or get it right most times over a week.</p>' +
        '<div class="wb-actions"><button type="button" class="btn btn-primary" data-act="wb-story">✨ Make a story with my words</button></div>' +
        '<div class="filter-tabs">' + [['all','All',list.length],['new','New',n['new']],['learning','Learning',n.learning],['known','Known',n.known]].map(function(t){
          return '<button type="button" class="filter-tab'+(filter===t[0]?' active':'')+'" data-wb-filter="'+t[0]+'">'+t[1]+'<span class="filter-count"> '+t[2]+'</span></button>'; }).join('') + '</div>' +
        '<input type="search" class="wb-search" data-wb-search placeholder="Search words or meanings" value="'+esc(wb.q||'')+'" aria-label="Search words">' +
        (shown.length ? '<ul class="wb-list">'+rows+'</ul>' : '<div class="empty-filter-note">'+(list.length ? 'No words match.' : 'No words yet. Add a vocabulary deck to start your Word Bank.')+'</div>') +
        (shown.length > 500 ? '<p class="wb-note">Showing the first 500. Search to find others.</p>' : '') +
      '</div>';
    wbWire();
  }
  function wbWire(){
    var back = app.querySelector('[data-act="wb-back"]'); if(back) back.addEventListener('click', function(){ goHome(); });
    var st = app.querySelector('[data-act="wb-story"]'); if(st) st.addEventListener('click', startStoryMaker);
    app.querySelectorAll('[data-wb-filter]').forEach(function(b){ b.addEventListener('click', function(){ S.wb.filter = b.dataset.wbFilter; render(); }); });
    app.querySelectorAll('[data-wb-say]').forEach(function(b){ b.addEventListener('click', function(){ Speech.speak(b.dataset.wbSay); }); });
    var srch = app.querySelector('[data-wb-search]');
    if(srch) srch.addEventListener('input', function(){
      S.wb.q = srch.value; var pos = srch.selectionStart; render();
      var again = app.querySelector('[data-wb-search]'); if(again){ again.focus(); try { again.setSelectionRange(pos, pos); } catch(e){} }
    });
    function saveMark(k, on){
      var marks = Object.assign({}, S.wb.marks || {});
      if(on) marks[k] = 'known'; else delete marks[k];
      S.wb.marks = marks;
      S.wb.list.forEach(function(e){ if(e.key === k){ e.marked = on; e.status = on ? 'known' : e.auto; } });
      if(S.store.setWordBank) S.store.setWordBank({ marks: marks, updatedAt: Date.now() });
      render();
    }
    app.querySelectorAll('[data-wb-mark]').forEach(function(b){ b.addEventListener('click', function(){ saveMark(b.dataset.wbMark, true); }); });
    app.querySelectorAll('[data-wb-unmark]').forEach(function(b){ b.addEventListener('click', function(){ saveMark(b.dataset.wbUnmark, false); }); });
  }

  function storyRecentKey(){ return 'cc-story-recent-' + (S.activeProfileId || ''); }
  function startStoryMaker(){
    var decks = S.decks.filter(function(d){ return !d.archived; });
    Promise.all([
      Promise.all(decks.map(function(d){ return S.store.getCardsOnce(d.id).catch(function(){ return []; }); })),
      S.store.getWordBank ? S.store.getWordBank().catch(function(){ return null; }) : Promise.resolve(null)
    ]).then(function(res){
      var lists = res[0], marks = (res[1] && res[1].marks) || {};
      var cards = [].concat.apply([], lists);
      var lang = storyLangFor(cards);
      var recent = [];
      try { recent = JSON.parse(localStorage.getItem(storyRecentKey()) || '[]'); } catch(e){}
      var words = StoryMaker.applyLevels(StoryMaker.collectWords(cards), wbBuild(decks, lists, lang === 'ko' ? 'ko' : 'en', marks));
      var story = StoryMaker.make({ lang: lang, words: words, recent: recent });
      try { localStorage.setItem(storyRecentKey(), JSON.stringify([story.arc].concat(recent.filter(function(a){ return a !== story.arc; })).slice(0, 6))); } catch(e){}
      S.msGen = { title: story.title, lang: lang, words: words, used: story.words, saved: false };
      S.msPanels = story.pages.map(function(p, i){ return Object.assign({}, p, { id: 'sm' + Date.now() + '-' + i }); });
      S.msIndex = 0;
      S.msShowTr = false;
      S.msSpokenKey = null;
      S.currentDeckId = null;
      S.editMode = false;
      S.view = 'miniStory';
      render();
    });
  }
  function saveGeneratedStory(){
    var g = S.msGen; if(!g || g.saved) return;
    g.saved = true;
    var pages = S.msPanels.slice();
    var base = Date.now();
    S.store.addDeck({ name: g.title, emoji: '✨', order: S.decks.length, miniStoryMode: true, subject: g.lang === 'ko' ? 'korean' : 'reading', archived: false }).then(function(deckId){
      if(!deckId) return;
      return pages.reduce(function(pr, p, i){
        return pr.then(function(){ return S.store.addCard(deckId, { front: p.front, back: p.back || '', note: p.note || '', mode: 'flip', choices: [], category: '', photoId: '', photoUrl: '', createdAt: base + i }); });
      }, Promise.resolve());
    }).then(function(){ if(S.view === 'miniStory') render(); });
    render();
  }

