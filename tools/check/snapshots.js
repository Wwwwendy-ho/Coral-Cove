/* Screenshots of the main screens, for checking that a change to the styles or layout changed nothing by accident.
   Run it before and after a change and compare the two folders with compare.py.
   Everything that moves or is random is frozen: Math.random is seeded, the clock starts at a fixed date, animations
   and transitions are off, and the 3D canvases are hidden (they are checked by smoke.js instead).
   Usage: node snapshots.js <out-folder> [port]        (the site must be served on the port, default 8820) */
const { chromium } = require('playwright');
const { enter, solveGate } = require('./steps');

const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} canvas{visibility:hidden!important}';

async function page(browser, scheme, port) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-10-28T10:00:00') });
  await p.addInitScript(() => {   // the same "random" numbers every run
    let s = 12345; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  });
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  p.port = port;
  return p;
}
async function shot(p, out, name) {
  await p.addStyleTag({ content: FREEZE }).catch(() => {});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/${name}.png` });
  // The computed style of every element on the screen (hidden ones too), as one fingerprint per element, so a
  // style change that doesn't show in the picture is still caught. compare.py compares these as well.
  const styles = await p.evaluate(() => {
    const out = {}, skip = /^(animation|transition|caret-color|visibility)/;
    const path = el => { const a = []; for (; el && el.nodeType === 1; el = el.parentElement) { let i = 0, s = el; while ((s = s.previousElementSibling)) i++; a.unshift(el.tagName + i); } return a.join('/'); };
    // inline styles (random sizes and places of bubbles and other decorations) are set aside while measuring:
    // this check is about the style sheets
    const inl = []; document.querySelectorAll('[style]').forEach(el => { inl.push([el, el.getAttribute('style')]); el.removeAttribute('style'); });
    document.querySelectorAll('body *').forEach(el => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      const cs = getComputedStyle(el), kv = [];   // sorted: the browser lists custom properties in no fixed order
      for (let i = 0; i < cs.length; i++) { const k = cs[i]; if (!skip.test(k)) kv.push(k + ':' + cs.getPropertyValue(k)); }
      const t = kv.sort().join(';\n');
      out[path(el) + ' ' + (el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 40) : '')] = t;
    });
    inl.forEach(([el, st]) => el.setAttribute('style', st));
    return out;
  });
  require('fs').writeFileSync(`${out}/${name}.styles.json`, JSON.stringify(styles));
}

(async () => {
  const out = process.argv[2], port = process.argv[3] || 8820;
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = {};
  for (const scheme of ['light', 'dark']) {
    let p = await page(browser, scheme, port);
    await enter(p, null, { port }); await shot(p, out, `lobby-${scheme}`);
    await enter(p, 'child', { port, wait: 6000 });
    if (scheme === 'dark') { await p.click('[data-r3-theme]'); await p.waitForTimeout(5000); }   // the app's own night mode
    await shot(p, out, `child-board-${scheme}`);
    await p.click('#askBtn'); await p.fill('#askIn', 'turtle'); await p.click('.ask-form button[type=submit]'); await p.waitForTimeout(1500);
    await shot(p, out, `child-ask-${scheme}`); await p.click('[data-ask="close"]');
    await p.click('[data-act="open-library"]'); await p.waitForTimeout(800); await shot(p, out, `child-library-${scheme}`);
    await p.click('text=Close').catch(() => {}); await p.waitForTimeout(800);
    await p.evaluate(() => { const v = window.__reef3dView(), here = v.at; const s = v.spaces.filter(s => s.kind === 'deck').sort((a, b) => Math.abs(a.i - here) - Math.abs(b.i - here))[0]; window.__reef3dGo(s.i); });
    await p.waitForTimeout(8000); await shot(p, out, `child-deck-${scheme}`);
    errors[`child-${scheme}`] = p.errors; await p.context().close();

    p = await page(browser, scheme, port);
    await enter(p, 'wendy', { port, wait: 6000 }); await shot(p, out, `wendy-board-${scheme}`);
    await p.click('[data-act="open-stats"]'); await p.waitForTimeout(1200); await shot(p, out, `wendy-stats-${scheme}`);
    await p.goBack().catch(() => {}); await enter(p, 'wendy', { port, wait: 5000 });
    await p.click('[data-act="toggle-edit-mode"]'); await p.waitForTimeout(800); await solveGate(p); await p.waitForTimeout(1200);
    await shot(p, out, `wendy-edit-${scheme}`);
    errors[`wendy-${scheme}`] = p.errors; await p.context().close();
  }
  require('fs').writeFileSync(`${out}/errors.json`, JSON.stringify(errors, null, 1));
  console.log('snapshots in', out, JSON.stringify(errors));
  await browser.close();
})();
