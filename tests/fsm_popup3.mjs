import { launch, sleep } from './lib.mjs';
const { browser, id } = await launch();
const page = await browser.newPage(); await page.setViewport({ width: 340, height: 400 });
await page.goto(`chrome-extension://${id}/popup.html`); await sleep(900);
const stored = () => page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(JSON.stringify(x.settings || null)))));
const st = () => page.evaluate(() => { const f = !document.getElementById('form').hidden, g = !document.getElementById('gate').hidden, y = document.getElementById('gate-yes');
  return (f && !g ? 'FORM' : (y.disabled ? 'WAIT' : (/continue/.test(y.textContent) ? 'CONFIRM1' : 'CONFIRM2'))) + (g ? `[${y.textContent}]` : '') + ' box=' + document.getElementById('enabled').checked; });
const log = async n => console.log(n.padEnd(44), (await st()).padEnd(34), await stored());
await page.click('#save'); await sleep(750); await log('save (baseline)');
await page.click('#enabled'); await page.click('#save', { clickCount: 2 }); await sleep(300); await log('untick, double-click Save');
await sleep(600); const b = await (await page.$('#gate-yes')).boundingBox(); const X = b.x + b.width / 2, Y = b.y + b.height / 2;
const order = () => page.evaluate(() => [...document.querySelectorAll('#gate button')].sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y).map(x => x.textContent).join(' / '));
console.log('  button order now:', await order());
const tm = Date.now(); let seen = new Set(); while (Date.now() - tm < 17500) { await page.mouse.click(X, Y); await sleep(200); seen.add((await st()).split('[')[0].split(' ')[0]); }
console.log('  states passed through:', [...seen].join(' -> '));
await log('mashed the Yes spot for 17.5 s');
// deliberate path still works
await page.click('#enabled'); await page.click('#save'); await sleep(750); await page.click('#gate-yes');
await page.waitForFunction(() => !document.getElementById('gate-yes').disabled, { timeout: 20000 }); console.log('  button order at CONFIRM2:', await order());
await page.screenshot({ path: '../previews/08_confirm2_swapped.png' });
await sleep(750); await page.click('#gate-yes'); await sleep(750); await log('deliberate: yes, wait, yes');
await browser.close();
