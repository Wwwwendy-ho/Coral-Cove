/* Coral Cove: offline word help for Ask Shelly (English meanings, Chinese word and character parts).
   Korean is handled in index.html (koLocalAnswer). Answers use Ask Shelly's shape: { answer, parts: [{ part, meaning }], example }.
   The dictionary (words-data.js, about 3 MB) loads the first time Ask Shelly opens, so the app itself starts as fast as before.
   Inside Claude the same data sits in the page as <script type="application/json" id="coralWordsData">. */
(function(){
  'use strict';
  var D = null, loading = null;

  function load(){
    if(D) return Promise.resolve(D);
    if(loading) return loading;
    loading = new Promise(function(resolve){
      var inline = document.getElementById('coralWordsData');
      if(inline){ try { D = JSON.parse(inline.textContent); } catch(e){ D = null; } resolve(D); return; }
      if(window.CORAL_WORDS){ D = window.CORAL_WORDS; resolve(D); return; }
      var s = document.createElement('script');
      s.src = 'words-data.js?v=' + (window.CORAL_WORDS_VERSION || '1');
      s.onload = function(){ D = window.CORAL_WORDS || null; resolve(D); };
      s.onerror = function(){ loading = null; resolve(null); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* ---------- Chinese ---------- */
  function zhTrad(text){
    var z = D.zh;
    if(z.w[text] || z.c[text]) return text;
    if(z.s[text]) return z.s[text];
    return Array.from(text).map(function(ch){ return z.c[ch] ? ch : (z.s[ch] || ch); }).join('');
  }
  // Splits a run of characters into the longest known words, left to right.
  function zhSegment(text){
    var z = D.zh, chars = Array.from(text), out = [], i = 0;
    while(i < chars.length){
      var hit = null;
      for(var n = Math.min(6, chars.length - i); n >= 2; n--){ var w = chars.slice(i, i + n).join(''); if(z.w[w]){ hit = w; break; } }
      if(!hit) hit = chars[i];
      out.push(hit); i += Array.from(hit).length;
    }
    return out;
  }
  function zhEntry(w){ var z = D.zh; return z.w[w] || z.c[w] || null; }
  function zhCharParts(ch){
    var c = D.zh.c[ch]; if(!c || !c.k || !c.k.length) return [];
    return c.k.map(function(k){ var e = D.zh.c[k]; return { part: k + (e && e.p ? ' (' + e.p + ')' : ''), meaning: e && e.m ? e.m : 'a part of the character' }; });
  }
  function zhMadeOf(ch){
    var c = D.zh.c[ch]; if(!c || !c.k || !c.k.length) return '';
    return ' Made of ' + c.k.map(function(k){ var e = D.zh.c[k]; return k + (e && e.m ? ' (' + e.m.split(';')[0] + ')' : ''); }).join(' + ') + '.';
  }
  function zhAnswer(raw){
    var text = zhTrad(raw), words = zhSegment(text), chars = Array.from(text);
    var pin = words.map(function(w){ var e = zhEntry(w); return e && e.p ? e.p : '?'; }).join(' ');
    var shown = text === raw ? text : text + ' (' + raw + ')';
    // one character: what it means and the parts it is built from
    if(chars.length === 1){
      var e = zhEntry(text);
      if(!e) return null;
      var parts = zhCharParts(text);
      return { answer: '“' + shown + '” (' + e.p + ') means: ' + e.m + '.' + (parts.length ? ' It is built from these parts.' : ''), parts: parts, example: '' };
    }
    // one word: what it means, then each character
    if(words.length === 1 && zhEntry(text)){
      var w = zhEntry(text);
      return { answer: '“' + shown + '” (' + w.p + ') means: ' + w.m + '. Here is each character.',
        parts: chars.map(function(ch){ var c = D.zh.c[ch]; return { part: ch + (c && c.p ? ' (' + c.p + ')' : ''), meaning: (c && c.m ? c.m : 'a character') + '.' + zhMadeOf(ch) }; }), example: '' };
    }
    // a phrase or sentence: each word in order
    var known = words.filter(function(x){ return zhEntry(x); }).length;
    if(!known) return null;
    return { answer: '“' + shown + '” (' + pin + '). Here are its words.',
      parts: words.slice(0, 8).map(function(x){ var e = zhEntry(x); return { part: x + (e ? ' (' + e.p + ')' : ''), meaning: e ? e.m : 'I do not know this word yet' }; }), example: '' };
  }

  /* ---------- English ---------- */
  var ASK = [/what\s+does\s+["“']?(.+?)["”']?\s+mean/i, /what\s+is\s+the\s+meaning\s+of\s+["“']?(.+?)["”']?\s*\??$/i, /meaning\s+of\s+["“']?(.+?)["”']?\s*\??$/i,
    /what\s+are\s+the\s+parts\s+of\s+["“']?(.+?)["”']?\s*\??$/i, /define\s+["“']?(.+?)["”']?\s*\??$/i, /what\s+(?:is|are)\s+(?:a|an|the)?\s*["“']?(.+?)["”']?\s*\??$/i];
  function enTarget(q){
    for(var i = 0; i < ASK.length; i++){ var m = q.match(ASK[i]); if(m) return m[1]; }
    return q;
  }
  // Child-friendly definitions win: the word itself, then its base form ("puppies" -> "puppy"), and only then the grown-up backup.
  function enLemma(w){
    var E = D.en, B = D.enwn, F = D.enf || {};
    var tries = [[/ies$/, 'y'], [/ves$/, 'f'], [/es$/, ''], [/s$/, ''], [/ied$/, 'y'], [/([^aeiou])\1ed$/, '$1'], [/ed$/, 'e'], [/ed$/, ''],
      [/([^aeiou])\1ing$/, '$1'], [/ing$/, 'e'], [/ing$/, ''], [/ier$/, 'y'], [/iest$/, 'y'], [/er$/, ''], [/est$/, ''], [/ly$/, ''], [/n't$/, '']];
    function base(has){
      for(var i = 0; i < tries.length; i++){
        if(!tries[i][0].test(w)) continue;
        var b = w.replace(tries[i][0], tries[i][1]);
        if(b.length > 1 && has[b]) return b;
      }
      return null;
    }
    if(E[w]) return w;
    if(F[w] && E[F[w]]) return F[w];
    return base(E) || (B[w] ? w : null) || (F[w] && B[F[w]] ? F[w] : null) || base(B);
  }
  function enLook(word){
    var shown = word.replace(/[’]/g, "'").replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, ''), w = shown.toLowerCase();  // shown as typed, looked up in lower case
    if(!w) return null;
    var lem = enLemma(w);
    if(!lem) return { word: shown, none: true };
    if(D.en[lem]) return { word: shown, lemma: lem, senses: D.en[lem] };
    var g = D.enwn[lem];
    return { word: shown, lemma: lem, senses: [{ pos: g[0], def: g[1], ex: '' }], grown: true };
  }
  function enAnswer(q){
    var target = enTarget(q).replace(/[?!.,;:]+$/g, '').trim();
    var words = target.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    if(!words.length || words.length > 10) return null;
    if(words.length === 1){
      var r = enLook(words[0]);
      if(!r) return null;
      if(r.none) return { answer: 'I do not know the word “' + r.word + '” yet. Check the spelling, or ask a grown-up.', parts: [], example: '' };
      var s = r.senses, ans = '“' + r.word + '”' + (r.word.toLowerCase() !== r.lemma ? ' is a form of “' + r.lemma + '”. It' : ' (' + s[0].pos + ')') + ' means: ' + s[0].def.replace(/\.$/, '') + '.';
      if(r.grown) ans += ' This is a grown-up definition. A grown-up can help explain it.';
      return { answer: ans,
        parts: s.length > 1 ? s.map(function(x, i){ return { part: 'Meaning ' + (i + 1) + ' (' + x.pos + ')', meaning: x.def }; }) : [],
        example: s[0].ex || '' };
    }
    // a few words or a sentence: each word's meaning
    var parts = [], seen = {};
    words.forEach(function(w){
      var r = enLook(w); if(!r || seen[r.word.toLowerCase()]) return; seen[r.word.toLowerCase()] = 1;
      parts.push({ part: r.word, meaning: r.none ? 'I do not know this word yet' : r.senses[0].def + (r.grown ? ' (grown-up definition)' : '') });
    });
    if(!parts.some(function(p){ return p.meaning !== 'I do not know this word yet'; })) return null;
    return { answer: 'Here is what each word in “' + target + '” means.', parts: parts.slice(0, 8), example: '' };
  }

  // Returns an answer, or null when the question has no Chinese or English word in it.
  function answer(q, card){
    if(!D) return null;
    q = String(q || '').trim();
    var han = (q.match(/[㐀-鿿豈-﫿]+/g) || []).join('');
    if(han){ var z = zhAnswer(han); if(z){ z.offline = true; return z; } return null; }
    if(/[가-힣]/.test(q)) return null;
    var e = enAnswer(q);
    if(e) e.offline = true;
    return e;
  }
  window.CoralWords = { load: load, answer: answer, ready: function(){ return !!D; } };
})();
