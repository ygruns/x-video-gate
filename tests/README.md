# Live checks

Each script loads `../extension` into a headless Chrome with a phone-sized
screen and drives the real thing. Run from this folder:

    npm i puppeteer-core
    node e2e.mjs

`lib.mjs` expects Chrome for Testing in `~/.cache/puppeteer` (adjust
`executablePath` if yours lives elsewhere). The X pages are loaded logged out,
so "who posted this" is fed in by the script; follow detection against a real
logged-in feed has to be checked by hand.

- `e2e.mjs` — block, forced play, Play in new tab, followed, GIF
- `fsm_popup3.mjs`, `fsm_popup4.mjs`, `popup5.mjs` — the settings popup and its gate
- `fsm_video3.mjs`, `dtap.mjs` — round trips, double tap, player quality switching
- `player_fail.mjs` — dead files, expired link, Close
- `touchevents.mjs` — a vertical drag starting on a cover never reaches the page's listeners; a sideways one does

Real finger scrolling cannot be checked here: Chrome ignores synthetic touch
scroll gestures in this setup, headless or not (`scrollharness.mjs` shows it on
a plain page). Swipe behaviour is checked at the event level and needs a phone
for the rest. `XVG_HEADFUL=1` runs any script in a real window parked off-screen.
