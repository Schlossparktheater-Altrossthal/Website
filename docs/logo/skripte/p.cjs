// Rendert ein Konzeptblatt (HTML) als PNG und PDF.
// node p.cjs <pfad-zu-playwright> [html] [ausgabe-ohne-endung]
const path = require('path');
const { chromium } = require(process.argv[2]);
const html = path.resolve(process.argv[3] || path.join(__dirname, '../konzept/konzept.html'));
const out = path.resolve(process.argv[4] || path.join(__dirname, '../konzept/konzeptblatt-1'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1470, height: 900 } });
  await p.goto('file://' + html); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '.png', fullPage: true });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.pdf({ path: out + '.pdf', width: '1470px', height: (h + 40) + 'px', printBackground: true });
  await b.close();
})();
