// node size_test.cjs <pfad-zu-playwright>  → konzept/katze/icons/*.png (Originalgröße)
const path = require('path'), fs = require('fs');
const { chromium } = require(process.argv[2]);
const dir = path.resolve(__dirname, '../konzept/katze');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(dir, 'groessentest.html'));
  fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
  for (const el of await p.$$('.i')) {
    const k = await el.getAttribute('data-k');
    await el.screenshot({ path: path.join(dir, 'icons', k + '.png') });
  }
  fs.writeFileSync(path.join(dir, 'icons', 'meta.json'), JSON.stringify(await p.evaluate(() => ({ rows: window.ROWS, sizes: window.SIZES }))));
  await b.close();
})();
