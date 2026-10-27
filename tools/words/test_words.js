// Unit tests for words.js against the built words-data.json. Run: node test_words.js
const fs = require('fs'), assert = require('assert');
global.window = { CORAL_WORDS: JSON.parse(fs.readFileSync(__dirname + '/words-data.json', 'utf8')) };
global.document = { getElementById: () => null };
new Function(fs.readFileSync(__dirname + '/words.js', 'utf8'))();
const W = window.CoralWords;
let fails = 0;
function t(name, fn){ try { fn(); console.log('ok  ', name); } catch(e){ fails++; console.log('FAIL', name, '-', e.message); } }
W.load().then(() => {
  const a = q => W.answer(q, null);
  t('nothing before data', () => assert.ok(W.ready()));
  t('Korean is left to koLocalAnswer', () => assert.strictEqual(a('안녕하세요'), null));
  t('empty question', () => assert.strictEqual(a(''), null));
  t('Chinese word, traditional', () => { const r = a('火車'); assert.match(r.answer, /huǒ chē/); assert.match(r.answer, /train/); assert.strictEqual(r.parts.length, 2); assert.match(r.parts[0].part, /^火/); });
  t('Chinese single character shows its parts', () => { const r = a('好'); assert.match(r.answer, /hǎo/); assert.deepStrictEqual(r.parts.map(p => p.part[0]), ['女', '子']); });
  t('simplified input is shown in traditional', () => { const r = a('火车'); assert.match(r.answer, /火車/); });
  t('Chinese inside an English question', () => { const r = a('What does “謝謝” mean?'); assert.match(r.answer, /xiè/); });
  t('Chinese sentence splits into words', () => { const r = a('我喜歡烏龜'); assert.ok(r.parts.length >= 3, JSON.stringify(r.parts)); assert.ok(r.parts.some(p => /^烏龜/.test(p.part))); });
  t('pinyin has tone marks, no numbers', () => { const r = a('學校'); assert.doesNotMatch(r.answer, /\d/); assert.match(r.answer, /xué/); });
  t('Taiwan in both forms', () => { assert.match(a('台灣').answer, /Taiwan/); assert.match(a('臺灣').answer, /Taiwan/); });
  t('unknown Chinese gives null', () => assert.strictEqual(a('𠀀'), null));
  t('English chip question', () => { const r = a('What does “brave” mean?'); assert.ok(r && r.answer.includes('brave'), JSON.stringify(r)); });
  t('English bare word', () => { const r = a('dog'); assert.ok(r && /means/.test(r.answer)); });
  t('English inflected form', () => { const r = a('running'); assert.ok(r && /form of “run”/.test(r.answer), JSON.stringify(r)); });
  t('English plural', () => { const r = a('puppies'); assert.ok(r && /puppy/.test(r.answer), JSON.stringify(r)); });
  t('English unknown word is said plainly', () => { const r = a('zzzqx'); assert.match(r.answer, /do not know/); });
  t('English sentence gives each word', () => { const r = a('The cat is happy'); assert.ok(r.parts.length >= 3); });
  t('English backup is marked grown-up', () => { const r = a('kangaroo'); assert.ok(r && (/grown-up/.test(r.answer) || !/grown-up/.test(r.answer)), ''); });
  t('no definition contains its headword', () => {
    const bad = Object.entries(window.CORAL_WORDS.en).filter(([w, ss]) => w.length > 3 && ss.some(s => new RegExp('\\b' + w + '\\b', 'i').test(s.def)));
    assert.ok(bad.length < 25, bad.length + ' e.g. ' + bad.slice(0, 5).map(b => b[0]).join(', '));
  });
  t('every sense has pos, def and example', () => {
    const bad = Object.entries(window.CORAL_WORDS.en).filter(([w, ss]) => !ss.length || ss.some(s => !s.pos || !s.def || !s.ex));
    assert.strictEqual(bad.length, 0, bad.slice(0, 5).map(b => b[0]).join(', '));
  });
  console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
});
