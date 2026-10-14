import { launch, mobile, sleep, PREV } from './lib.mjs';
const { browser, id } = await launch();
const page = await browser.newPage(); await mobile(page);
await page.goto('https://x.com/NASA', { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(8000);
const rec = (following) => ({ tweetId: '2110094874024219133', mediaId: '2110094814733651969',
  thumb: 'https://pbs.twimg.com/amplify_video_thumb/2110094814733651969/img/mi2EnXdCG2jxU1NW', kind: 'video', screenName: 'NASA',
  following, isMe: false, text: 'test', variants: [
    { url: 'https://video.twimg.com/amplify_video/2110094814733651969/vid/avc1/1920x1080/Iw3FOQxVrNtU6UEJ.mp4', bitrate: 2 },
    { url: 'https://video.twimg.com/amplify_video/2110094814733651969/vid/avc1/1280x720/TSbz_WE8fV_mdDmj.mp4', bitrate: 1 }] });
const send = r => page.evaluate(r => document.dispatchEvent(new CustomEvent('xvg:media', { detail: JSON.stringify([r]) })), r);
const state = () => page.evaluate(() => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes('2110094814733651969')); if (!v) return null;
  const box = v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement;
  return { xvg: v.dataset.xvg, paused: v.paused, t: +v.currentTime.toFixed(2), msg: box.querySelector('.xvg-overlay .xvg-msg')?.textContent || null, vis: getComputedStyle(v).visibility }; });
console.log('A no record     ', JSON.stringify(await state()));
await send(rec(false)); await sleep(500);
console.log('B not followed  ', JSON.stringify(await state()));
// try to force play from the page, like X's own player would
await page.evaluate(() => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes('2110094814733651969')); v.play().catch(() => {}); });
await sleep(1500);
console.log('C forced play() ', JSON.stringify(await state()));
await page.evaluate(() => { // dismiss the logged-out "get the app" sheet that sits over the page
  for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.position === 'fixed' && !el.closest('.xvg-overlay') && /Get the full app|Open X/.test(el.innerText || '')) el.remove(); }
  const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes('2110094814733651969'));
  (v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement).querySelector('.xvg-btn').scrollIntoView({ block: 'center' }); });
await sleep(500);
console.log('  top element at button:', await page.evaluate(() => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes('2110094814733651969')); const b = (v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement).querySelector('.xvg-btn'); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el.className; }));
await page.screenshot({ path: PREV + '/' + (process.env.XVG_EXT ? 'tmp_orig' : '04_x_blocked_mobile') + '.png' });
// tap "Play in new tab"
const newTab = new Promise(r => browser.once('targetcreated', r));
const btn = await page.evaluateHandle(() => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes('2110094814733651969')); return (v.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || v.parentElement).querySelector('.xvg-btn'); });
await btn.tap();
const tgt = await Promise.race([newTab, sleep(8000).then(() => null)]);
if (!tgt) console.log('D NO TAB OPENED');
else { const p2 = await tgt.page(); await mobile(p2); await sleep(7000);
  console.log('D player tab    ', p2.url().replace(id, '<ext>'), JSON.stringify(await p2.evaluate(() => { const v = document.getElementById('v'); return v ? { paused: v.paused, t: +v.currentTime.toFixed(2), w: v.videoWidth, h: v.videoHeight, err: v.error && v.error.message, rs: v.readyState, who: document.getElementById('who').textContent, opts: [...document.querySelectorAll('#quality option')].map(o => o.textContent) } : { html: document.body.innerText } })));
  await p2.screenshot({ path: PREV + '/' + (process.env.XVG_EXT ? 'tmp_orig2' : '05_player_tab_mobile') + '.png' }); }
console.log('E x.com page url still', page.url());
await page.bringToFront(); await sleep(300);
// followed account -> must unblock
await send(rec(true)); await sleep(500);
console.log('F followed      ', JSON.stringify(await state()));
await page.evaluate(() => { const v = [...document.querySelectorAll('video')].find(v => (v.poster || '').includes('2110094814733651969')); v.play().catch(() => {}); });
await sleep(2500);
console.log('G followed play ', JSON.stringify(await state()));
await send(rec(false)); await sleep(500);
console.log('H back to blocked', JSON.stringify(await state()));
await send(Object.assign(rec(false), { kind: 'animated_gif' })); await sleep(500);
console.log('I gif, unfollowed', JSON.stringify(await state()));
await browser.close();
