/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
// Run with Playwright available: node scripts/page-scroll.test.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: process.env.SCROLL_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 650 } });
      const css = fs.readFileSync('app/globals.css', 'utf8').replace('@import "tailwindcss";', '');
      const theme = fs.readFileSync('styles/starfield-theme.css', 'utf8');
      await page.setContent(`<!doctype html><style>${css}\n${theme}\nhtml{height:100%}</style><div class="theme-starfield"><div class="starfield-sky"></div><main style="min-height:2600px"><h1>Invoice</h1><input placeholder="Customer"><div style="height:2100px">Long page content</div><button>Bottom</button></main></div>`);
      await page.mouse.move(width / 2, 400);
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(() => scrollY > 100);
      const down = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, -400);
      await page.waitForFunction(previous => scrollY < previous, down);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      // A modal's intentional scroll lock must still work, then release normally.
      await page.evaluate(() => { document.body.style.overflow = 'hidden'; });
      const locked = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => scrollY), locked);
      await page.evaluate(() => { document.body.style.overflow = ''; });
      await page.mouse.wheel(0, 400);
      await page.waitForFunction(previous => scrollY > previous, locked);
      console.log(`PASS ${width}px: wheel down/up, horizontal clipping, modal lock and restore`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
