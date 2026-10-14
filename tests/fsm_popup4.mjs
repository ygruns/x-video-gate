import { launch, sleep } from './lib.mjs';
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 100000);
const { browser, id } = await launch();
const stored = page => page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(JSON.stringify(x.settings || null)))));
for (const [name, setup] of [['turn off', async p => { await p.click('#enabled'); }], ['long allowlist', async p => { await p.type('#allowlist', 'aaaaaaaaaaaaaaa\nbbbbbbbbbbbbbbb\nccccccccccccccc\nddddddddddddddd\neeeeeeeeeeeeeee'); }]]) {
  const page = await browser.newPage(); await page.setViewport({ width: 340, height: 500 });
  await page.goto(`chrome-extension://${id}/popup.html`); await sleep(900);
  await page.evaluate(() => new Promise(r => chrome.storage.local.set({ settings: { enabled: true, allowlist: [] } }, r)));
  await page.reload(); await sleep(900);
  await setup(page); await page.click('#save'); await sleep(750);
  const y1 = await page.$eval('#gate-yes', e => Math.round(e.getBoundingClientRect().y));
  await page.click('#gate-yes'); await sleep(300);
  const yWait = await page.$eval('#gate-yes', e => Math.round(e.getBoundingClientRect().y));
  await page.waitForFunction(() => !document.getElementById('gate-yes').disabled, { timeout: 20000 });
  const yKeep = await page.$eval('#gate-no', e => Math.round(e.getBoundingClientRect().y));
  console.log(`[${name}] Yes y at CONFIRM1=${y1}, at WAIT=${yWait}; 'Keep blocking' y at CONFIRM2=${yKeep} -> same spot: ${yWait === yKeep && y1 === yWait}`);
  await sleep(750);
  const before = await page.evaluate(() => ({ box: document.getElementById('enabled').checked, list: document.getElementById('allowlist').value }));
  await page.click('#gate-yes', { clickCount: 2 }); await sleep(400);
  const after = await page.evaluate(() => ({ form: !document.getElementById('form').hidden, box: document.getElementById('enabled').checked, focus: document.activeElement.id }));
  console.log(`[${name}] double-click final yes: form=${after.form} checkbox ${before.box} -> ${after.box} (focus: ${after.focus || 'none'}) stored=${await stored(page)}`);
  await page.close();
}
await browser.close(); process.exit(0);
