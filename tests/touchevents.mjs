import { launch, mobile, sleep } from './lib.mjs';
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 70000);
const { browser } = await launch();
const page = await browser.newPage(); await mobile(page);
await page.goto('https://x.com/NASA', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
// Stand-ins for X: listeners that would cancel scrolling, in both phases, on the page root.
const out = await page.evaluate(() => {
  const seen = [];
  const root = document.body;
  for (const t of ['touchstart', 'touchmove', 'pointermove']) {
    root.addEventListener(t, (e) => { seen.push(t + '(page capture)'); e.preventDefault(); }, { capture: true, passive: false });
    root.addEventListener(t, (e) => { seen.push(t + '(page bubble)'); e.preventDefault(); }, { passive: false });
  }
  const ov = document.querySelector('.xvg-overlay');
  const r = ov.getBoundingClientRect(); const x = r.x + 20, y = r.y + r.height - 15;
  const touch = (yy) => new Touch({ identifier: 1, target: ov, clientX: x, clientY: yy });
  const res = {};
  for (const [t, ev] of [['touchstart', new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch(y)], targetTouches: [touch(y)], changedTouches: [touch(y)] })],
                         ['touchmove', new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(y - 40)], targetTouches: [touch(y - 40)], changedTouches: [touch(y - 40)] })],
                         ['pointermove', new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerType: 'touch', clientX: x, clientY: y - 40 })]]) {
    ov.dispatchEvent(ev); res[t] = ev.defaultPrevented ? 'SCROLL CANCELLED' : 'scroll allowed';
  }
  return { res, pageListenersThatRan: seen };
});
console.log(JSON.stringify(out));
await browser.close(); process.exit(0);
