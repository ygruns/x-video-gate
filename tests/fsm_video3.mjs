import { launch, mobile, sleep } from './lib.mjs';
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 110000);
const { browser, id, sw } = await launch();
const w = await sw.worker();
const setS = s => w.evaluate(s => new Promise(r => chrome.storage.local.set({ settings: s }, r)), s);
const MID = '2110094814733651969';
const rec = { tweetId: '2110094874024219133', mediaId: MID, thumb: 'https://pbs.twimg.com/amplify_video_thumb/' + MID + '/img/mi2EnXdCG2jxU1NW', kind: 'video', screenName: 'NASA', following: false, isMe: false, text: 't', variants: [
  { url: 'https://video.twimg.com/amplify_video/' + MID + '/vid/avc1/1920x1080/Iw3FOQxVrNtU6UEJ.mp4', bitrate: 2 }, { url: 'https://video.twimg.com/amplify_video/' + MID + '/vid/avc1/1280x720/TSbz_WE8fV_mdDmj.mp4', bitrate: 1 }] };
await setS({ enabled: true, allowlist: [] });
const page = await browser.newPage(); await mobile(page); await page.goto('https://x.com/NASA', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.position === 'fixed' && /Get the full app|Open X/.test(el.innerText || '')) el.remove(); } });
await page.evaluate(r => document.dispatchEvent(new CustomEvent('xvg:media', { detail: JSON.stringify([r]) })), rec); await sleep(500);
const snap = () => page.evaluate(MID => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes(MID)); if (!v) return 'NO VIDEO';
  const box = v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement;
  return JSON.stringify({ muted: v.muted, autoplay: v.autoplay, xvg: v.dataset.xvg || null, vis: getComputedStyle(v).visibility, boxClass: box.classList.contains('xvg-blocked'), boxPos: box.style.position || '', overlays: box.querySelectorAll('.xvg-overlay').length }); }, MID);
// idle work while blocked
const muts = await page.evaluate(() => new Promise(r => { let n = 0; const mo = new MutationObserver(l => n += l.length); mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true }); setTimeout(() => { mo.disconnect(); r(n); }, 2000); }));
console.log('DOM mutations in 2 s idle, blocked:', muts);
// round trip with an "as X had it" unmuted, autoplaying video
await setS({ enabled: false, allowlist: [] }); await sleep(600);
await page.evaluate(MID => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes(MID)); v.muted = false; v.autoplay = true; }, MID);
console.log('FREE, set as X might (unmuted)    ', await snap());
await setS({ enabled: true, allowlist: [] }); await sleep(600);
console.log('BLOCKED                           ', await snap());
await setS({ enabled: true, allowlist: [] }); await sleep(300); await setS({ enabled: true, allowlist: ['zzz'] }); await sleep(600);
console.log('BLOCKED (re-blocked by a rescan)  ', await snap());
await setS({ enabled: false, allowlist: [] }); await sleep(600);
console.log('FREE again                        ', await snap());
await setS({ enabled: true, allowlist: [] }); await sleep(600);
// taps: single, then double 120 ms apart, counted by new tabs
const nPlayers = () => browser.targets().filter(t => t.type() === 'page' && t.url().includes('player.html')).length;
const clickBtn = () => page.evaluate(MID => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes(MID)); (v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement).querySelector('.xvg-btn').click(); }, MID);
await page.evaluate(MID => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes(MID)); const b = (v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement).querySelector('.xvg-btn'); b.click(); const t = performance.now(); while (performance.now() - t < 120) {} b.click(); }, MID); await sleep(2500);
console.log('double tap (120 ms): player tabs =', nPlayers());
await sleep(1500); await clickBtn(); await sleep(2500);
console.log('one more tap 4 s later: player tabs =', nPlayers());
await page.bringToFront(); await sleep(300);
// X removes the video element
await page.evaluate(MID => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes(MID)); window.__box = v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement; v.remove(); }, MID); await sleep(600);
console.log('video element removed: overlays left in its box =', await page.evaluate(() => window.__box.querySelectorAll('.xvg-overlay').length), 'class left =', await page.evaluate(() => window.__box.classList.contains('xvg-blocked')));
// player
const pl = await browser.targets().filter(t => t.type() === 'page' && t.url().includes('player.html')).pop().page(); await pl.bringToFront(); await sleep(6000);
const ps = () => pl.evaluate(() => { const v = document.getElementById('v'), s = document.getElementById('quality'); return JSON.stringify({ q: s.options[s.selectedIndex]?.textContent, t: +v.currentTime.toFixed(1), paused: v.paused, w: v.videoWidth }); });
const pick = (...idx) => pl.evaluate(idx => { const s = document.getElementById('quality'); for (const i of idx) { s.selectedIndex = i; s.dispatchEvent(new Event('change')); } }, idx);
console.log('player                            ', await ps());
let b = await ps(); await pick(1); await sleep(2500); console.log('switch quality while playing      ', b, '->', await ps());
await pl.evaluate(() => document.getElementById('v').pause()); await sleep(300); b = await ps(); await pick(0); await sleep(2500); console.log('switch while paused               ', b, '->', await ps());
await pl.evaluate(() => document.getElementById('v').play()); await sleep(1500); b = await ps(); await pick(1, 0, 1); await sleep(3000); console.log('three switches at once            ', b, '->', await ps());
await pl.reload(); await sleep(4000); console.log('reload                            ', await ps());
await browser.close(); process.exit(0);
