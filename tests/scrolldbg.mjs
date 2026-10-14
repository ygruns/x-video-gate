import { launch, mobile, sleep } from './lib.mjs';
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 90000);
const { browser } = await launch();
const page = await browser.newPage(); await mobile(page);
await page.goto('https://x.com/NASA', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
const info = () => page.evaluate(() => ({ sy: Math.round(scrollY), sh: document.scrollingElement.scrollHeight, ih: innerHeight, bodyOverflow: getComputedStyle(document.body).overflow + '/' + getComputedStyle(document.documentElement).overflow, scrollers: [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(e => e.tagName + '.' + String(e.className).slice(0, 25) + ' st=' + e.scrollTop) }));
console.log('start', JSON.stringify(await info()));
await page.evaluate(() => scrollBy(0, 300)); await sleep(300); console.log('after scrollBy', JSON.stringify(await info()));
const cdp = await page.createCDPSession();
const g = async (label, o) => { try { await cdp.send('Input.synthesizeScrollGesture', Object.assign({ x: 200, y: 500, yDistance: -250 }, o)); } catch (e) { console.log(label, 'ERR', e.message); } await sleep(900); console.log(label, (await info()).sy); };
await g('mouse gesture', { gestureSourceType: 'mouse' });
await g('touch gesture', { gestureSourceType: 'touch' });
await g('touch, no fling', { gestureSourceType: 'touch', preventFling: true, speed: 400 });
// raw touch events through CDP
const t = async (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
await t('touchStart', 600); for (let i = 1; i <= 15; i++) { await t('touchMove', 600 - i * 20); await sleep(16); } await t('touchEnd'); await sleep(900); console.log('raw touch events', (await info()).sy);
await browser.close(); process.exit(0);
