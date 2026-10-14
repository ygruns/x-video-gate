// Runs in the page's own JS world. Watches X's API responses and extracts,
// for every video/GIF: who posted it, whether you follow them, and the
// direct MP4 URLs. Sends that to content.js via a DOM event.
(() => {
  if (window.__xvgHooked) return;
  window.__xvgHooked = true;

  const EVENT = "xvg:media";

  function viewerId() {
    const m = document.cookie.match(/(?:^|;\s*)twid=([^;]+)/);
    if (!m) return null;
    const v = decodeURIComponent(m[1]);
    const id = v.match(/u=(\d+)/);
    return id ? id[1] : null;
  }

  function userInfo(userResult) {
    if (!userResult) return null;
    const u = userResult.result || userResult;
    const real = u.__typename === "UserWithVisibilityResults" ? u.user : u;
    if (!real) return null;
    const legacy = real.legacy || {};
    const core = real.core || {};
    const rel = real.relationship_perspectives || {};
    return {
      id: real.rest_id || legacy.id_str || null,
      screenName: core.screen_name || legacy.screen_name || null,
      following: !!(legacy.following || rel.following),
      // false when the response simply doesn't say either way
      followKnown: legacy.following !== undefined || rel.following !== undefined,
    };
  }

  function bestVariants(videoInfo) {
    if (!videoInfo || !Array.isArray(videoInfo.variants)) return [];
    return videoInfo.variants
      .filter((v) => v.content_type === "video/mp4" && v.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
      .map((v) => ({ url: v.url, bitrate: v.bitrate || 0 }));
  }

  function normThumb(url) {
    if (!url) return null;
    return url.split("?")[0].replace(/\.(jpg|jpeg|png|webp)$/i, "");
  }

  function extractFromTweet(t, out, me) {
    const legacy = t.legacy;
    if (!legacy) return;
    const media =
      (legacy.extended_entities && legacy.extended_entities.media) ||
      (legacy.entities && legacy.entities.media) ||
      [];
    const vids = media.filter((m) => m.type === "video" || m.type === "animated_gif");
    if (!vids.length) return;
    const user = userInfo(t.core && t.core.user_results);
    if (!user) return;
    const isMe = me && user.id === me;
    for (const m of vids) {
      out.push({
        tweetId: t.rest_id || legacy.id_str,
        mediaId: m.id_str,
        thumb: normThumb(m.media_url_https),
        kind: m.type,
        screenName: user.screenName,
        following: user.following || isMe,
        followKnown: user.followKnown || !!isMe,
        isMe: !!isMe,
        text: (legacy.full_text || "").slice(0, 280),
        variants: bestVariants(m.video_info),
        aspect: m.video_info && m.video_info.aspect_ratio,
      });
    }
  }

  function walk(node, out, me, depth) {
    if (!node || typeof node !== "object" || depth > 60) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n, out, me, depth + 1);
      return;
    }
    if (node.legacy && node.core && node.core.user_results && node.rest_id) {
      extractFromTweet(node, out, me);
    }
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === "object") walk(v, out, me, depth + 1);
    }
  }

  function handle(url, text) {
    if (!url || !/\/(graphql|i\/api)\//.test(url)) return;
    if (!text || text[0] !== "{") return;
    let data;
    try { data = JSON.parse(text); } catch { return; }
    const out = [];
    walk(data, out, viewerId(), 0);
    if (out.length) {
      document.dispatchEvent(new CustomEvent(EVENT, { detail: JSON.stringify(out) }));
    }
  }

  // --- fetch hook ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
      if (url && /\/(graphql|i\/api)\//.test(url)) {
        res.clone().text().then((t) => handle(url, t)).catch(() => {});
      }
    } catch {}
    return res;
  };

  // --- XHR hook ---
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__xvgUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (this.responseType === "" || this.responseType === "text") {
          handle(String(this.__xvgUrl), this.responseText);
        } else if (this.responseType === "json" && this.response) {
          handle(String(this.__xvgUrl), JSON.stringify(this.response));
        }
      } catch {}
    });
    return origSend.apply(this, args);
  };

})();
