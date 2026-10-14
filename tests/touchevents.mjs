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
    root.addEventListener(t, (e) => { seen.push(t + '(page capture)'); if (!/start/.test(t)) e.preventDefault(); }, { capture: true, passive: false });
    root.addEventListener(t, (e) => { seen.push(t + '(page bubble)'); if (!/start/.test(t)) e.preventDefault(); }, { passive: false });
  }
  const ov = document.querySelector('.xvg-overlay');
  const r = ov.getBoundingClientRect(); const x = r.x + 20, y = r.y + r.height - 15;
  const touch = (xx, yy) => new Touch({ identifier: 1, target: ov, clientX: xx, clientY: yy });
  const res = {};
  const fire = (ev) => { ov.dispatchEvent(ev); return ev.defaultPrevented ? 'SCROLL CANCELLED' : 'allowed'; };
  const T = (type, xx, yy) => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch(xx, yy)], targetTouches: type === 'touchend' ? [] : [touch(xx, yy)], changedTouches: [touch(xx, yy)] });
  const run = (label, dx, dy) => { const before = seen.length; fire(T('touchstart', x, y)); const m = fire(T('touchmove', x + dx, y + dy));
    const pm = fire(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerType: 'touch', clientX: x + dx, clientY: y + dy })); fire(T('touchend', x + dx, y + dy));
    res[label] = { move: m, pointermove: pm, pageSaw: seen.slice(before).filter(s => /move/.test(s)) }; };
  run('vertical drag', 3, -40);
  run('sideways drag', -40, 3);
  return res;
});
console.log(JSON.stringify(out));
await browser.close(); process.exit(0);
