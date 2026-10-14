import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import os from 'os'; import path from 'path'; import fs from 'fs';
export const EXT = process.env.XVG_EXT || fileURLToPath(new URL('../extension', import.meta.url)).split(path.sep).join('/');
export const PREV = '../previews';
export const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
export async function launch() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'xvg_prof_'));
  const browser = await puppeteer.launch({
    executablePath: path.join(os.homedir(), '.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe'),
    headless: true, userDataDir: prof,
    args: [`--load-extension=${EXT}`, `--disable-extensions-except=${EXT}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const sw = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes('background.js'), { timeout: 15000 });
  const id = new URL(sw.url()).host;
  return { browser, id, sw };
}
export async function mobile(page) {
  await page.setUserAgent(UA);
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
