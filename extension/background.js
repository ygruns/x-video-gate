// Opens the single-video player tab. If X gave us direct MP4 links, the video
// plays on a bare extension page (no feed at all). Otherwise it falls back to
// the post's own page with a one-time pass for just that post's video.
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (!msg || msg.type !== "xvg:open") return;
  cleanup();
  const p = msg.payload || {};
  const opener = sender.tab ? { openerTabId: sender.tab.id, index: sender.tab.index + 1 } : {};

  // The page is told ok only once the tab really exists, so it can say when
  // it doesn't.
  const open = (url) => () => {
    if (chrome.runtime.lastError) { respond({ ok: false }); return; }
    chrome.tabs.create(Object.assign({ url }, opener), () => respond({ ok: !chrome.runtime.lastError }));
  };

  if (p.variants && p.variants.length) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    chrome.storage.local.set({ ["xvg_p_" + id]: Object.assign({ created: Date.now() }, p) },
      open(chrome.runtime.getURL("player.html?id=" + id)));
  } else if (p.tweetId) {
    chrome.storage.local.set({ allowOnce: { tweetId: p.tweetId, until: Date.now() + 15 * 60 * 1000 } },
      open("https://x.com/i/status/" + p.tweetId));
  } else {
    respond({ ok: false });
  }
  return true; // the answer comes later
});

// Housekeeping: drop stored player payloads older than a day.
function cleanup() {
  chrome.storage.local.get(null, (all) => {
    if (chrome.runtime.lastError || !all) return;
    const old = Object.keys(all).filter(
      (k) => k.startsWith("xvg_p_") && Date.now() - (all[k].created || 0) > 864e5
    );
    if (old.length) chrome.storage.local.remove(old);
  });
}
chrome.runtime.onStartup.addListener(cleanup);
chrome.runtime.onInstalled.addListener(cleanup);
