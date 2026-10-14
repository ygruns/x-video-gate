import { launch, mobile, sleep } from './lib.mjs';
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 60000);
const { browser } = await launch();
const page = await browser.newPage(); await mobile(page);
await page.setContent('<body style="margin:0"><div style="height:5000px;background:linear-gradient(#fff,#000)"></div></body>'); await sleep(500);
const cdp = await page.createCDPSession();
for (const src of ['touch', 'mouse']) { const y0 = await page.evaluate(() => scrollY); await cdp.send('Input.synthesizeScrollGesture', { x: 200, y: 600, yDistance: -250, gestureSourceType: src }); await sleep(800); console.log('plain page,', src, 'gesture scrolled', await page.evaluate(() => scrollY) - y0); }
await browser.close(); process.exit(0);
