// Shared test steps: open the app, tap through the title screen, open a profile, and answer the grown-up
// maths question if one appears (it guards grown-up profiles).
async function solveGate(p) {
  const q = await p.evaluate(() => { const m = document.body.innerText.match(/(\d+)\s*([×x+−\-÷])\s*(\d+)\s*=/); return m && [m[1], m[2], m[3]]; });
  if (!q) return false;
  const a = +q[0], b = +q[2], op = q[1];
  const ans = String(op === '×' || op === 'x' ? a * b : op === '+' ? a + b : op === '÷' ? a / b : a - b);
  for (const d of ans) await p.locator('button', { hasText: new RegExp('^' + d + '$') }).first().click();
  await p.locator('button', { hasText: /^OK$/ }).first().click();
  return true;
}
async function enter(p, profile, opts = {}) {
  await p.goto('http://localhost:' + (opts.port || 8820) + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const splash = await p.$('.cc-splash');
  if (splash) { await splash.click(); await p.waitForSelector('.cc-splash', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await p.waitForTimeout(1500);
  if (profile) {
    await p.click('[data-profile="' + profile + '"]'); await p.waitForTimeout(1200);
    if (await solveGate(p)) await p.waitForTimeout(500);
    await p.waitForTimeout(opts.wait || 8000);
  }
}
module.exports = { enter, solveGate };
