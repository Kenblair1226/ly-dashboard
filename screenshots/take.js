// Screenshot script using Playwright
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  console.log('→ home');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/work/screenshots/home.png', fullPage: true });

  console.log('→ legislator');
  await page.goto('http://localhost:3000/legislators/' + encodeURIComponent('葛如鈞') + '?term=11',
                  { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500); // let recharts render
  await page.screenshot({ path: '/work/screenshots/legislator-koju-chun.png', fullPage: true });

  await browser.close();
  console.log('done');
})();
