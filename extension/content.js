// Isolated-world content script: decides per <video> whether it may play,
// and covers blocked ones with an overlay offering "Play in new tab".
(() => {
  const byThumb = new Map();   // normalized poster URL -> record
  const byMedia = new Map();   // media id -> record
  const byTweet = new Map();   // tweet id -> [records]

  let settings = { enabled: true, blockGifs: true, allowlist: [] };
  let allowOnce = null;        // { tweetId, until }

  const DEFAULTS = { enabled: true, blockGifs: true, allowlist: [] };

  chrome.storage.local.get(["settings", "allowOnce"], (r) => {
    settings = Object.assign({}, DEFAULTS, r.settings || {});
    if (r.allowOnce && r.allowOnce.until > Date.now()) allowOnce = r.allowOnce;
    schedule();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch.settings) settings = Object.assign({}, DEFAULTS, ch.settings.newValue || {});
    if (ch.allowOnce) allowOnce = ch.allowOnce.newValue || null;
    schedule();
  });

  // ---- data from inject.js ----
  document.addEventListener("xvg:media", (e) => {
    let list;
    try { list = JSON.parse(e.detail); } catch { return; }
    for (const rec of list) {
      if (rec.thumb) byThumb.set(rec.thumb, rec);
      if (rec.mediaId) byMedia.set(rec.mediaId, rec);
      if (rec.tweetId) {
        const arr = byTweet.get(rec.tweetId) || [];
        if (!arr.some((x) => x.mediaId === rec.mediaId)) arr.push(rec);
        byTweet.set(rec.tweetId, arr);
      }
    }
    schedule();
  });

  // ---- lookup ----
  function normThumb(url) {
    if (!url) return null;
    return url.split("?")[0].replace(/\.(jpg|jpeg|png|webp)$/i, "");
  }

  function tweetIdFromArticle(article) {
    if (!article) return null;
    const timeLink = article.querySelector('a[href*="/status/"] time');
    const a = timeLink ? timeLink.closest("a") : article.querySelector('a[href*="/status/"]');
    const m = a && a.getAttribute("href").match(/\/status\/(\d+)/);
    return m ? m[1] : null;
  }

  function recordFor(video) {
    const poster = video.getAttribute("poster") || "";
    const t = normThumb(poster);
    if (t && byThumb.has(t)) return byThumb.get(t);
    const mid = poster.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)/);
    if (mid && byMedia.has(mid[1])) return byMedia.get(mid[1]);
    // Fallback: the tweet this video sits in (only safe if not inside a quote card)
    const article = video.closest("article");
    const inQuote = article && video.closest('div[role="link"]') && article.contains(video.closest('div[role="link"]'));
    if (!inQuote) {
      const id = tweetIdFromArticle(article);
      const arr = id && byTweet.get(id);
      if (arr && arr.length === 1) return arr[0];
      if (arr && arr.length > 1) return arr[0]; // same author for all media in a tweet
    }
    return null;
  }

  function currentStatusId() {
    const m = location.pathname.match(/\/status\/(\d+)/);
    return m ? m[1] : null;
  }

  function isAllowed(video, rec) {
    if (!settings.enabled) return true;
    if (rec) {
      if (rec.following || rec.isMe) return true;
      if (rec.kind === "animated_gif" && !settings.blockGifs) return true;
      const h = (rec.screenName || "").toLowerCase();
      if (h && settings.allowlist.includes(h)) return true;
    }
    // One-time override when the fallback "open tweet" path was used
    if (allowOnce && allowOnce.until > Date.now() && currentStatusId() === allowOnce.tweetId) {
      if (rec && rec.tweetId === allowOnce.tweetId) return true;
      if (!rec && tweetIdFromArticle(video.closest("article")) === allowOnce.tweetId) return true;
    }
    return false;
  }

  // ---- blocking UI ----
  function containerOf(video) {
    return video.closest('[data-testid="videoPlayer"]') ||
           video.closest('[data-testid="videoComponent"]') ||
           video.parentElement;
  }

  function block(video, rec) {
    try { video.pause(); } catch {}
    video.muted = true;
    video.autoplay = false;
    video.dataset.xvg = "blocked";
    const box = containerOf(video);
    if (!box) return;
    box.classList.add("xvg-blocked");
    if (getComputedStyle(box).position === "static") box.style.position = "relative";

    let ov = box.querySelector(":scope > .xvg-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "xvg-overlay";
      ov.innerHTML =
        '<div class="xvg-msg"></div>' +
        '<button class="xvg-btn" type="button">▶ Play in new tab</button>';
      // Bubble phase, so the button below still gets its click; and no
      // preventDefault on touch events, or a tap never becomes a click.
      const stop = (e) => { e.stopPropagation(); if (e.type === "click") e.preventDefault(); };
      ["click", "pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup"]
        .forEach((t) => ov.addEventListener(t, stop));
      ov.querySelector(".xvg-btn").addEventListener("click", (e) => {
        stop(e);
        openSingle(video);
      });
      box.appendChild(ov);
    }
    const who = rec && rec.screenName ? "@" + rec.screenName : "an account you don't follow";
    ov.querySelector(".xvg-msg").textContent =
      rec ? `Video from ${who} — not followed` : "Video blocked (account not verified as followed)";
  }

  function unblock(video) {
    if (video.dataset.xvg !== "blocked") { video.dataset.xvg = "ok"; return; }
    video.dataset.xvg = "ok";
    const box = containerOf(video);
    if (!box) return;
    box.classList.remove("xvg-blocked");
    const ov = box.querySelector(":scope > .xvg-overlay");
    if (ov) ov.remove();
  }

  function openSingle(video) {
    const rec = recordFor(video);
    const tweetId = (rec && rec.tweetId) || tweetIdFromArticle(video.closest("article"));
    chrome.runtime.sendMessage({
      type: "xvg:open",
      payload: {
        tweetId,
        screenName: rec && rec.screenName,
        text: rec && rec.text,
        variants: (rec && rec.variants) || [],
        poster: video.getAttribute("poster") || "",
        kind: rec && rec.kind,
      },
    });
  }

  // ---- scanning ----
  function process(video) {
    const rec = recordFor(video);
    if (isAllowed(video, rec)) unblock(video);
    else block(video, rec);
  }

  function scan() {
    document.querySelectorAll("video").forEach(process);
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; scan(); });
  }

  // Hard stop: any play attempt on a non-allowed video is cancelled immediately.
  const guard = (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    const rec = recordFor(v);
    if (!isAllowed(v, rec)) {
      try { v.pause(); } catch {}
      block(v, rec);
    }
  };
  document.addEventListener("play", guard, true);
  document.addEventListener("playing", guard, true);
  document.addEventListener("loadeddata", guard, true);

  const mo = new MutationObserver(schedule);
  const start = () => {
    mo.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["poster", "src"],
    });
    schedule();
  };
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start);

  // SPA navigation (allowOnce depends on URL)
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; schedule(); }
  }, 500);
})();
