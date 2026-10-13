(() => {
  const id = new URLSearchParams(location.search).get("id");
  const key = "xvg_p_" + id;
  const v = document.getElementById("v");
  const sel = document.getElementById("quality");

  document.getElementById("close").onclick = () => window.close();

  chrome.storage.local.get(key, (r) => {
    const p = r[key];
    if (!p || !p.variants || !p.variants.length) {
      document.getElementById("main").innerHTML = '<div class="err">This video link has expired. Go back and tap it again.</div>';
      sel.hidden = true;
      return;
    }
    if (p.screenName) {
      document.getElementById("who").textContent = "@" + p.screenName;
      document.title = "@" + p.screenName + " — video";
    }
    if (p.text) {
      const t = document.getElementById("text");
      t.textContent = p.text;
      t.hidden = false;
    }
    if (p.poster) v.poster = p.poster;
    if (p.kind === "animated_gif") { v.loop = true; v.muted = true; }

    p.variants.forEach((variant, i) => {
      const o = document.createElement("option");
      const res = (variant.url.match(/\/(\d+x\d+)\//) || [])[1];
      o.value = variant.url;
      o.textContent = res || (variant.bitrate ? Math.round(variant.bitrate / 1000) + " kbps" : "Source " + (i + 1));
      sel.appendChild(o);
    });
    if (p.variants.length < 2) sel.hidden = true;

    v.src = p.variants[0].url;
    v.play().catch(() => {});

    // Position and play state to carry across a quality switch. Kept outside
    // the handler so a second switch before the first has loaded still
    // resumes from the right place.
    let resume = null;
    v.addEventListener("loadedmetadata", () => {
      if (!resume) return;
      const r = resume;
      resume = null;
      v.currentTime = r.t;
      if (r.playing) v.play().catch(() => {});
    });
    sel.onchange = () => {
      if (!resume) resume = { t: v.currentTime, playing: !v.paused && !v.ended };
      v.autoplay = false;
      v.src = sel.value;
    };
  });
})();
