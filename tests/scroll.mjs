import { launch, mobile, sleep } from './lib.mjs';
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 90000);
const { browser } = await launch();
const page = await browser.newPage(); await mobile(page);
await page.goto('https://x.com/NASA', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.position === 'fixed' && /Get the full app|Open X/.test(el.innerText || '')) el.remove(); } });
// put a covered video in the middle of the screen
const r = await page.evaluate(() => { const ov = document.querySelector('.xvg-overlay'); ov.scrollIntoView({ block: 'center' }); const b = ov.getBoundingClientRect();
  const chain = []; for (let e = ov; e; e = e.parentElement) { const t = getComputedStyle(e).touchAction; if (t !== 'auto') chain.push(e.tagName + '.' + (e.className || '').toString().slice(0, 30) + ' touch-action=' + t); }
  return { x: b.x + 20, y: b.y + b.height - 15, h: b.height, chain }; });
await sleep(500);
console.log('touch-action set on the cover or its ancestors:', r.chain.length ? r.chain : 'none');
const cdp = await page.createCDPSession();
const pos = () => page.evaluate(() => { let t = scrollY; for (const e of document.querySelectorAll('*')) if (e.scrollTop) t += e.scrollTop; return t; });
const swipe = async (x, y) => { const y0 = await pos();
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(x), y: Math.round(y), yDistance: -250, gestureSourceType: 'touch', speed: 800 });
  await sleep(800); return Math.round(await pos() - y0); };
const onCover = await swipe(r.x, r.y);
const sideX = 8; const offCover = await swipe(sideX, r.y);
console.log(`swipe up 250 px starting ON the cover: page scrolled ${onCover} px | starting beside it: ${offCover} px`);
await browser.close(); process.exit(0);
