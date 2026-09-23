const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  await page.goto('http://localhost:8532', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shots4/true-bottom.png' });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.click('#themeToggle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots4/dark-hero.png' });
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('h2,h3,p')];
    const el = els.find(e => e.textContent.includes('Dos personas'));
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots4/dark-equipo.png' });
  await browser.close();
  console.log('ERRORS:', JSON.stringify(errors));
})().catch(e => { console.error(e); process.exit(1); });
