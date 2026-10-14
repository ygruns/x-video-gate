// Isolated-world content script: decides per <video> whether it may play,
// and covers blocked ones with an overlay offering "Play in new tab".
(() => {
  const byThumb = new Map();   // normalized poster URL -> record
  const byMedia = new Map();   // media id -> record
  const byTweet = new Map();   // tweet id -> [records]

  let settings = { enabled: true, allowlist: [] };
  let allowOnce = null;        // { tweetId, until }

  const DEFAULTS = { enabled: true, allowlist: [] };

  chrome.storage.local.get(["settings", "allowOnce"], (r) => {
    r = (!chrome.runtime.lastError && r) || {};
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

  // The popup asks whether the blocker is alive in this tab.
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg && msg.type === "xvg:ping") respond({ ok: true });
  });

  // ---- data from inject.js ----
  // Follow / unfollow pressed on this page: apply it to what is already loaded.
  document.addEventListener("xvg:follow", (e) => {
    let d;
    try { d = JSON.parse(e.detail); } catch { return; }
    const name = String(d.screenName || "").toLowerCase();
    if (!name) return;
    const set = (rec) => {
      if ((rec.screenName || "").toLowerCase() === name) { rec.following = !!d.following; rec.followKnown = true; }
    };
    byThumb.forEach(set);
    byMedia.forEach(set);
    byTweet.forEach((arr) => arr.forEach(set));
    schedule();
  });

  document.addEventListener("xvg:media", (e) => {
    let list;
    try { list = JSON.parse(e.detail); } catch { return; }
    for (const rec of list) {
      // A later response that doesn't say whether you follow the author must
      // not turn a followed author's video into a blocked one. One that says
      // "not followed" outright still does.
      const old = rec.mediaId && byMedia.get(rec.mediaId);
      if (rec.followKnown === false && old && old.following && old.screenName === rec.screenName) rec.following = true;
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

  // GIFs are not videos: never blocked, whoever posted them.
  function isGif(video, rec) {
    if (rec) return rec.kind === "animated_gif";
    return (video.getAttribute("poster") || "").includes("/tweet_video_thumb/");
  }

  function isAllowed(video, rec) {
    if (!settings.enabled) return true;
    if (isGif(video, rec)) return true;
    if (rec) {
      if (rec.following || rec.isMe) return true;
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

  // What the video and its box looked like before the first block, so
  // unblocking puts them back exactly.
  const before = new WeakMap();

  function block(video, rec) {
    const box = containerOf(video);
    if (!before.has(video)) {
      before.set(video, { muted: video.muted, autoplay: video.autoplay, boxPosition: box ? box.style.position : "" });
    }
    try { video.pause(); } catch {}
    video.muted = true;
    video.autoplay = false;
    video.dataset.xvg = "blocked";
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
      // A tap on the cover itself goes nowhere on purpose; point at the button
      // so it doesn't feel dead.
      ov.addEventListener("click", (e) => {
        if (e.target.closest(".xvg-btn")) return;
        const b = ov.querySelector(".xvg-btn");
        b.classList.remove("xvg-nudge");
        void b.offsetWidth;
        b.classList.add("xvg-nudge");
      });

      let lastOpen = 0;
      ov.querySelector(".xvg-btn").addEventListener("click", (e) => {
        stop(e);
        // A double tap opens one tab, not two.
        if (Date.now() - lastOpen < 1500) return;
        // X may have swapped the <video> element since this overlay was made.
        const current = box.querySelector("video");
        const note = (text) => {
          lastOpen = 0;
          ov.dataset.xvgNote = "1";
          setText(ov.querySelector(".xvg-msg"), text);
        };
        const result = current ? openSingle(current, () => note("Couldn't open the tab. Tap again.")) : "nothing";
        if (result === "sent") {
          lastOpen = Date.now();
          // An earlier failure note no longer applies.
          delete ov.dataset.xvgNote;
          schedule();
        } else if (result === "stale") note("The extension was updated. Reload this page.");
        else note("Can't open this one in a new tab");
      });
      box.appendChild(ov);
    }
    // Too small for two lines of text and a button: keep just the button
    // (and a failure note, when there is one).
    ov.classList.toggle("xvg-small", box.clientHeight > 0 && box.clientHeight < 130);
    if (ov.dataset.xvgNote) {
      // Keep the "can't open" notice only while there is still nothing to open.
      // Notes about a failed attempt stay; "nothing to open" lifts once there is something.
      const nothing = ov.querySelector(".xvg-msg").dataset.xvgText === "Can't open this one in a new tab";
      const openable = (rec && ((rec.variants || []).length || rec.tweetId)) || tweetIdFromArticle(video.closest("article"));
      if (!nothing || !openable) return;
      delete ov.dataset.xvgNote;
    }
    const who = rec && rec.screenName ? "@" + rec.screenName : "an account you don't follow";
    setText(ov.querySelector(".xvg-msg"),
      rec ? `Video from ${who} — not followed` : "Video blocked (account not verified as followed)");
  }

  // Writing the same text again would still count as a DOM change and
  // re-trigger the scan on every frame.
  function setText(el, text) {
    if (el.dataset.xvgText === text) return;
    el.dataset.xvgText = text;
    el.textContent = text;
  }

  function unblock(video) {
    const was = before.get(video);
    if (was) {
      video.muted = was.muted;
      video.autoplay = was.autoplay;
      before.delete(video);
    }
    video.dataset.xvg = "ok";
    const box = containerOf(video);
    if (!box) return;
    // Another video sharing this box may still be blocked: leave its cover.
    if (box.querySelector('video[data-xvg="blocked"]')) return;
    if (was) box.style.position = was.boxPosition;
    box.classList.remove("xvg-blocked");
    const ov = box.querySelector(":scope > .xvg-overlay");
    if (ov) ov.remove();
  }

  // "sent", or "nothing" (no direct file and no post id), or "stale" (this
  // page outlived an extension update and can no longer reach it).
  function openSingle(video, onFail) {
    const rec = recordFor(video);
    const tweetId = (rec && rec.tweetId) || tweetIdFromArticle(video.closest("article"));
    const variants = (rec && rec.variants) || [];
    if (!variants.length && !tweetId) return "nothing";
    try {
      chrome.runtime.sendMessage({
        type: "xvg:open",
        payload: {
          tweetId,
          screenName: rec && rec.screenName,
          text: rec && rec.text,
          variants,
          poster: video.getAttribute("poster") || "",
          kind: rec && rec.kind,
        },
      }, (res) => { if (chrome.runtime.lastError || !res || !res.ok) onFail(); });
    } catch {
      return "stale";
    }
    return "sent";
  }

  // ---- scanning ----
  function process(video) {
    const rec = recordFor(video);
    if (isAllowed(video, rec)) unblock(video);
    else block(video, rec);
  }

  function scan() {
    document.querySelectorAll("video").forEach(process);
    // Overlays whose video X has since removed.
    document.querySelectorAll(".xvg-overlay").forEach((ov) => {
      const box = ov.parentElement;
      if (box && !box.querySelector("video")) {
        ov.remove();
        box.classList.remove("xvg-blocked");
      }
    });
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    const run = () => { if (!pending) return; pending = false; scan(); };
    // Whichever comes first. A hidden tab gets no animation frames, and a
    // tab can be hidden after the frame was requested, so the timer backs it up.
    requestAnimationFrame(run);
    setTimeout(run, 250);
  }

  // A vertical drag that starts on a cover is the page's to scroll with: X
  // never sees those moves, so its handlers can't treat them as a drag on the
  // video and cancel the scroll. Sideways drags still reach X (photo
  // carousels, the media viewer), and so do presses and lifts (menus that
  // close on an outside tap). Window + capture runs before X's listeners;
  // passive never delays the scroll.
  let drag = null; // { x, y, dir } for a touch that began on a cover
  window.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    drag = t && e.touches.length === 1 && e.target instanceof Element && e.target.closest(".xvg-overlay")
      ? { x: t.clientX, y: t.clientY, dir: null } : null;
  }, { capture: true, passive: true });
  const hideVertical = (e) => {
    if (!drag) return;
    if (!drag.dir) {
      const p = e.touches ? e.touches[0] : e;
      if (!p) return;
      // Chrome sends no moves inside its touch slop, so the first one already
      // shows which way the finger is going.
      drag.dir = Math.abs(p.clientY - drag.y) >= Math.abs(p.clientX - drag.x) ? "v" : "h";
    }
    if (drag.dir === "v") e.stopImmediatePropagation();
  };
  window.addEventListener("touchmove", hideVertical, { capture: true, passive: true });
  window.addEventListener("pointermove", (e) => { if (e.pointerType === "touch") hideVertical(e); }, { capture: true, passive: true });
  for (const t of ["touchend", "touchcancel"]) {
    window.addEventListener(t, (e) => { if (!e.touches.length) drag = null; }, { capture: true, passive: true });
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
