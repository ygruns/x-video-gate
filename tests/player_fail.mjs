import { launch, sleep } from './lib.mjs';
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 80000);
const { browser, id, sw } = await launch();
const w = await sw.worker();
const MID = '2110094814733651969';
const good = 'https://video.twimg.com/amplify_video/' + MID + '/vid/avc1/1280x720/TSbz_WE8fV_mdDmj.mp4';
const put = (k, variants) => w.evaluate((k, variants) => new Promise(r => chrome.storage.local.set({ ['xvg_p_' + k]: { created: Date.now(), screenName: 'NASA', text: 't', variants, kind: 'video' } }, r)), k, variants);
await put('a', [{ url: 'https://video.twimg.com/nope/1920x1080/x.mp4', bitrate: 2 }, { url: good, bitrate: 1 }]);
await put('b', [{ url: 'https://video.twimg.com/nope/1920x1080/x.mp4', bitrate: 2 }, { url: 'https://video.twimg.com/nope/1280x720/y.mp4', bitrate: 1 }]);
const look = p => p.evaluate(() => { const v = document.getElementById('v'), e = document.querySelector('.err'), s = document.getElementById('quality'); return JSON.stringify({ err: e && e.textContent, playing: v ? !v.paused && v.currentTime > 0 : false, w: v && v.videoWidth, q: s && !s.hidden ? s.options[s.selectedIndex]?.textContent : null }); });
const P = '../previews/';
for (const [k, label] of [['a', 'first file dead, second good'], ['b', 'all files dead'], ['zzz', 'no stored link']]) {
  const p = await browser.newPage(); await p.setViewport({ width: 412, height: 600 }); await p.goto(`chrome-extension://${id}/player.html?id=${k}`); await sleep(6000);
  console.log(label.padEnd(30), await look(p));
  if (k === 'b') await p.screenshot({ path: P + '11_player_load_failed.png' });
  if (k === 'zzz') { const n0 = browser.targets().filter(t => t.type() === 'page').length; await p.click('#close'); await sleep(800); console.log('Close button'.padEnd(30), 'tabs', n0, '->', browser.targets().filter(t => t.type() === 'page').length); }
}
// popup: buttons look inactive right after a view switch
const pp = await browser.newPage(); await pp.setViewport({ width: 340, height: 400 }); await pp.goto(`chrome-extension://${id}/popup.html`); await sleep(900);
await pp.click('#enabled'); await pp.click('#save'); await sleep(120);
const o1 = await pp.$eval('#gate-yes', e => getComputedStyle(e).opacity + '/' + getComputedStyle(e).pointerEvents); await sleep(700);
const o2 = await pp.$eval('#gate-yes', e => getComputedStyle(e).opacity + '/' + getComputedStyle(e).pointerEvents);
console.log('gate button 0.1 s after appearing:', o1, '| 0.8 s after:', o2);
await browser.close(); process.exit(0);
