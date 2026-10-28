/* Browser smoke test of the GitHub copy, both profiles. The site must be served on the port (run.sh does it).
   Checks, with no page errors anywhere:
   - each profile opens the 3D board (the grown-up profile through the maths question);
   - the crab starts beside the guide, tapped fish escape, and a deck opens from the board;
   - the grown-up checks: a wrong answer gives a new question, Cancel goes back, the right answer opens; inside a
     grown-up profile nothing asks again (leaving a deck, Library settings, Edit Mode), while the child's Edit
     Mode and Library settings still ask; the Library's home has a tab per learning goal, with Next up and today's count;
     a child leaving a deck early gets the subtraction question;
   - Ask Shelly answers English, Chinese and Korean words with the network switched off;
   - the Library opens.
   Usage: node smoke.js [port]        Exits with 1 if anything fails. */
const { chromium } = require('playwright');
const { enter, solveGate } = require('./steps');
const port = +process.argv[2] || 8820;
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
let failed = 0;
// The Library's top-left button is "‹ Back" inside a page and "✕ Close" on its first page
async function closeLibrary(p) {
  for (let i = 0; i < 5 && await p.isVisible('.clib .clib-back'); i++) { await p.click('.clib .clib-back'); await p.waitForTimeout(500); }
}
function check(name, ok, detail) { console.log((ok ? 'ok    ' : 'FAIL  ') + name + (detail ? '  ' + detail : '')); if (!ok) failed++; }
const nearestDeck = () => { const v = window.__reef3dView(), here = v.at; const s = v.spaces.filter(s => s.kind === 'deck').sort((a, b) => Math.abs(a.i - here) - Math.abs(b.i - here))[0]; window.__reef3dGo(s.i); return s.item.d.name; };

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  return p;
}

(async () => {
  const browser = await chromium.launch({ args: ARGS });

  // Child: board, crab, fish, Ask Shelly offline, Library, a deck, leaving it early
  let p = await newPage(browser);
  await enter(p, 'child', { port });
  const b = await p.evaluate(() => {
    const v = window.__reef3dView(); if (!v) return { board: false };
    const g = v.guide.position, c = v.crab && v.crab.position;
    const sc = v.schools[0], rc = v.renderer.domElement.getBoundingClientRect(), pt = sc.fish[0].position.clone().project(v.cam);
    const x = rc.left + (pt.x + 1) / 2 * rc.width, y = rc.top + (1 - pt.y) / 2 * rc.height;
    v.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
    v.renderer.domElement.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
    return { board: true, crabGap: c ? Math.hypot(c.x - g.x, c.z - g.z) : null, fled: !!sc.flee, warmed: v.warmed };
  });
  check('child: the 3D board opens', b.board);
  check('the designed fonts are on (Fredoka, Nunito Sans)', await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('600 20px Fredoka') && [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Fredoka' && f.status === 'loaded'); }));
  check('child: the crab starts beside the guide', b.crabGap > 1 && b.crabGap < 5, 'gap ' + (b.crabGap || 0).toFixed(2));
  check('child: tapped fish escape', b.fled);
  check('child: effect shaders are prepared while loading', b.warmed > 0, b.warmed + ' shaders');
  await p.context().setOffline(true);
  await p.click('#askBtn');
  for (const [q, want] of [['turtle', /shell/], ['puppies', /form of “puppy”/], ['好', /hǎo/], ['火車', /train/], ['거북이', /geobuki/]]) {
    await p.fill('#askIn', q); await p.click('.ask-form button[type=submit]');
    await p.waitForFunction(() => !document.querySelector('.ask-wait'), null, { timeout: 15000 }); await p.waitForTimeout(300);
    const a = await p.evaluate(() => [...document.querySelectorAll('.ask-a, .ask-parts li')].map(e => e.textContent).join(' | '));
    check('Ask Shelly offline: ' + q, want.test(a), a.slice(0, 70));
  }
  await p.click('[data-ask="close"]'); await p.context().setOffline(false);
  await p.click('[data-act="open-library"]'); await p.waitForTimeout(800);
  check('the Library opens', await p.evaluate(() => /Tutor/.test(document.body.innerText)));
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.clib-tab')].map(t => t.dataset.tab).join(','));
  check('child: the Library has a tab for each goal (math, reading)', tabs === 'math,reading', tabs);
  check('child: the Library shows one Next up activity', await p.evaluate(() => document.querySelectorAll('.clib-next .clib-go').length === 1));
  await p.click('[data-act="facts"]'); await p.waitForTimeout(800); await p.click('.clib .clib-back'); await p.waitForTimeout(800);
  check('child: an activity done counts toward today', /^1 of 4 done today/.test(await p.textContent('.clib-daybar-t')));
  await p.click('[data-view="settings"]'); await p.waitForTimeout(800);
  check('child: Library settings ask the maths question', await p.evaluate(() => !!document.getElementById('clibPin')));
  await closeLibrary(p);
  const deck = await p.evaluate(nearestDeck); await p.waitForTimeout(9000);
  check('child: a deck opens from the board', await p.evaluate(() => !document.querySelector('.r3 canvas')), deck);
  const exit = await p.$('[data-act^="exit-"], [data-act="back-home"], [aria-label^="Close"]');
  if (exit) { await exit.click(); await p.waitForTimeout(1200); }
  const sub = await p.evaluate(() => (document.body.innerText.match(/(\d+)\s*[−-]\s*(\d+)/) || []).slice(1));
  check('child: leaving early asks a subtraction question', sub.length === 2);
  if (sub.length === 2) {
    for (const d of String(+sub[0] - +sub[1])) await p.locator('button', { hasText: new RegExp('^' + d + '$') }).first().click();
    await p.locator('button', { hasText: /^(OK|Check|Done)$/ }).first().click().catch(() => {}); await p.waitForTimeout(4000);
    check('child: the right answer returns to the board', await p.evaluate(() => !!document.querySelector('.r3 canvas')));
  }
  await p.click('[data-act="toggle-edit-mode"]'); await p.waitForTimeout(800);
  check('child: Edit Mode asks the maths question', !!(await p.$('.reef-gate')));
  await p.click('[data-gate="cancel"]').catch(() => {}); await p.waitForTimeout(800);
  check('child: no page errors', !p.errors.length, p.errors.join(' / '));
  await p.context().close();

  // Grown-up profile: the maths question (wrong, cancel, right), the board, a deck
  p = await newPage(browser);
  await enter(p, null, { port }); await p.click('[data-profile="wendy"]'); await p.waitForTimeout(1200);
  const q1 = await p.textContent('.reef-gate-q').catch(() => null);
  check('grown-up profile asks the maths question', !!q1);
  for (const d of '888') await p.click('[data-gate-digit="' + d + '"]');
  check('a three-digit answer fits in the answer box', await p.evaluate(() => { const i = document.getElementById('adultGateInput'); return i.value === '888' && i.scrollWidth <= i.clientWidth; }));
  for (let k = 0; k < 3; k++) await p.click('[data-gate="back"]');
  await p.click('[data-gate-digit="1"]'); await p.click('[data-gate="check"]'); await p.waitForTimeout(500);
  check('a wrong answer gives a new question', (await p.textContent('.reef-gate-q')) !== q1);
  await p.click('[data-gate="cancel"]'); await p.waitForTimeout(1500);
  check('Cancel goes back to the profiles', !!(await p.$('[data-profile="wendy"]')));
  await p.click('[data-profile="wendy"]'); await p.waitForTimeout(1200); await solveGate(p); await p.waitForTimeout(8000);
  check('the right answer opens the board', await p.evaluate(() => !!(window.__reef3dView && window.__reef3dView())));
  const d2 = await p.evaluate(nearestDeck); await p.waitForTimeout(9000);
  check('grown-up: a deck opens from the board', await p.evaluate(() => !document.querySelector('.r3 canvas')), d2);
  // Inside a grown-up profile nothing asks again: the question was answered on the way in
  const exit2 = await p.$('[data-act^="exit-"], [data-act="back-home"], [aria-label^="Close"]');
  if (exit2) { await exit2.click(); await p.waitForTimeout(4000); }
  check('grown-up: leaving a deck early asks nothing', !!exit2 && !(await p.$('.reef-gate, .lock-screen')) && await p.evaluate(() => !!document.querySelector('.r3 canvas')));
  await p.click('[data-act="toggle-edit-mode"]'); await p.waitForTimeout(1200);
  await p.click('[data-act="open-library"]', { force: true }); await p.waitForTimeout(800);
  check('grown-up: the Library opens on the Korean goal', await p.evaluate(() => [...document.querySelectorAll('.clib-tab')].map(t => t.dataset.tab).join(',') === 'korean'));
  await p.click('[data-view="settings"]'); await p.waitForTimeout(800);
  check('grown-up: Library settings ask nothing', await p.evaluate(() => !document.getElementById('clibPin') && !!document.getElementById('clibUrl')));
  await p.click('[data-goal="reading"]'); await p.waitForTimeout(600); await p.click('.clib .clib-back'); await p.waitForTimeout(800);
  check('grown-up: a goal added in settings gets its own tab', await p.evaluate(() => [...document.querySelectorAll('.clib-tab')].map(t => t.dataset.tab).join(',') === 'korean,reading'));
  await closeLibrary(p);
  check('grown-up: Edit Mode asks nothing', !(await p.$('.reef-gate, .lock-screen')) && /Edit Mode/.test(await p.evaluate(() => document.body.innerText)));
  check('grown-up: no page errors', !p.errors.length, p.errors.join(' / '));
  await p.context().close();

  await browser.close();
  console.log(failed ? failed + ' check(s) failed' : 'smoke: all checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
