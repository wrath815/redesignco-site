const { chromium } = require('C:/Users/px/AppData/Local/hermes/hermes-agent/node_modules/playwright');
const OUT = 'C:/Users/px/proactivity/redesignco-site/qa';
const fs = require('fs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = {};

  async function run(label, opts, steps) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto('http://localhost:8791/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    await steps(page, label);
    results[label] = { errors, canvas: await page.evaluate(() => !!document.querySelector('#heroCanvas canvas')) };
    await ctx.close();
  }

  // Desktop initial
  await run('desktop-initial', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, async (page, label) => {
    await page.screenshot({ path: `${OUT}/${label}.png` });
  });
  // Desktop mid-scroll (into pinned transform section)
  await run('desktop-midscroll', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, async (page, label) => {
    // scroll to parallax band first
    await page.evaluate(() => { const el = document.getElementById('parallax'); if (el) el.scrollIntoView(); });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/parallax.png` });
    // capture pinned mid-progress
    await page.evaluate(() => {
      const pin = document.getElementById('transform');
      const y = pin.offsetTop + pin.offsetHeight * 0.5 - window.innerHeight / 2;
      window.scrollTo(0, y);
    });
    await page.waitForTimeout(700);
    const step = await page.evaluate(() => {
      const on = document.querySelector('.pin-line.on');
      const bar = document.querySelector('.pin-bar');
      return { activeStep: on ? on.getAttribute('data-step') : null, bar: bar ? bar.style.transform : null };
    });
    results['pin-state'] = step;
    await page.screenshot({ path: `${OUT}/${label}.png` });
    // gallery motion check: read transform twice
    await page.evaluate(() => { const el = document.getElementById('work'); if (el) el.scrollIntoView(); });
    await page.waitForTimeout(500);
    const t1 = await page.evaluate(() => { const el = document.querySelector('.gallery-track'); return el ? getComputedStyle(el).transform : null; });
    await page.waitForTimeout(900);
    const t2 = await page.evaluate(() => { const el = document.querySelector('.gallery-track'); return el ? getComputedStyle(el).transform : null; });
    results['gallery-moving'] = t1 !== null && t1 !== t2;
    await page.screenshot({ path: `${OUT}/gallery.png` });
    // parallax layer moved check
    const pl = await page.evaluate(() => {
      const l = document.querySelector('.px-near');
      return l ? l.style.transform : null;
    });
    results['parallax-transform'] = pl;
  });
  // Mobile initial 390px
  await run('mobile-initial', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile' }, async (page, label) => {
    await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
  });

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
