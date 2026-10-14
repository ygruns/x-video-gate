const DEFAULTS = { enabled: true, allowlist: [] };
const WAIT_SECONDS = 15;
const $ = (id) => document.getElementById(id);

let current = Object.assign({}, DEFAULTS);
let timer = null;
let shownAt = -1e9;

// The form stays visibly inactive until the saved settings are in it, so
// nothing typed early gets overwritten.
const loadGiveUp = setTimeout(
  () => say("Couldn't read your settings. Close this and open it again.", true, true), 4000);
chrome.storage.local.get("settings", (r) => {
  clearTimeout(loadGiveUp);
  $("saved").style.visibility = "hidden";
  if (chrome.runtime.lastError || !r) {
    say("Couldn't read your settings. Close this and open it again.", true, true);
    return;
  }
  current = Object.assign({}, DEFAULTS, r.settings || {});
  fill(current);
  for (const id of ["enabled", "allowlist", "save"]) $(id).disabled = false;
});

// A tab that was open before the extension was installed or updated has no
// blocker running in it. Say so, and offer the reload.
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = !chrome.runtime.lastError && tabs && tabs[0];
  if (!tab || !/^https:\/\/(mobile\.)?(x|twitter)\.com\//.test(tab.url || "")) return;
  chrome.tabs.sendMessage(tab.id, { type: "xvg:ping" }, (res) => {
    if (!chrome.runtime.lastError && res && res.ok) return;
    $("stale").hidden = false;
    $("reload").onclick = () => chrome.tabs.reload(tab.id, () => { $("stale").hidden = true; });
  });
});

function fill(s) {
  $("enabled").checked = s.enabled;
  $("allowlist").value = s.allowlist.map((h) => "@" + h).join("\n");
  mark();
}

// X paths that look like a profile link but are not an account.
const NOT_ACCOUNTS = ["i", "home", "explore", "search", "notifications", "messages",
  "settings", "compose", "hashtag", "intent", "share", "login", "signup"];

// One entry per line (or comma): "@name", "name" or a profile link. Anything
// that cannot be a handle is returned in `bad` instead of being saved as if
// it were one. A display name like "John Smith" is one bad entry, not two
// accounts.
function parseHandles(text) {
  const good = [], bad = [];
  for (const raw of text.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean)) {
    const link = /^(https?:\/\/)?(www\.|mobile\.)?(x|twitter)\.com\//i;
    const h = raw
      .replace(link, "")
      .replace(/[/?#].*$/, "")
      .replace(/^@/, "")
      .toLowerCase();
    // "@home" typed as a name is an account; "x.com/home" pasted as a link is a page.
    if (!/^[a-z0-9_]{1,15}$/.test(h) || (link.test(raw) && NOT_ACCOUNTS.includes(h))) bad.push(raw);
    else if (!good.includes(h)) good.push(h);
  }
  return { good, bad };
}

function readForm() {
  const { good, bad } = parseHandles($("allowlist").value);
  return { enabled: $("enabled").checked, allowlist: good, bad };
}

// Shows "Not saved yet" while the form differs from what is stored.
function mark() {
  const f = readForm();
  const same = f.enabled === current.enabled && !f.bad.length &&
    f.allowlist.join(",") === current.allowlist.join(",");
  $("dirty").style.visibility = same ? "hidden" : "visible";
}
$("enabled").addEventListener("change", mark);
$("allowlist").addEventListener("input", mark);

// Anything that lets more video through than the saved settings do.
function loosenings(next) {
  const out = [];
  if (current.enabled && !next.enabled) out.push("turn blocking off completely");
  const added = next.allowlist.filter((h) => !current.allowlist.includes(h));
  if (added.length) out.push("always allow " + added.map((h) => "@" + h).join(", "));
  return out;
}

function commit(next) {
  // A write that never answers is a failure too.
  const giveUp = setTimeout(() => say("Couldn't save. Try again.", true), 4000);
  chrome.storage.local.set({ settings: next }, () => {
    clearTimeout(giveUp);
    if (chrome.runtime.lastError) { say("Couldn't save. Try again.", true); return; }
    current = next;
    fill(current);
    say("Saved");
  });
}

let sayTimer = null;
function say(text, bad, sticky) {
  const el = $("saved");
  el.textContent = text;
  el.classList.toggle("bad", !!bad);
  el.style.visibility = "visible";
  clearTimeout(sayTimer);
  if (!sticky) sayTimer = setTimeout(() => (el.style.visibility = "hidden"), bad ? 6000 : 2000);
}

function show(view) {
  $("form").hidden = view !== "form";
  $("gate").hidden = view !== "gate";
  settle();
}

// A button that has only just appeared ignores clicks, so the second half of
// a double click can't answer a question the user hasn't seen yet. It also
// LOOKS inactive for that moment, so the ignored click isn't a mystery.
function settle() {
  shownAt = performance.now();
  document.body.classList.add("settling");
  setTimeout(() => {
    if (!fresh()) document.body.classList.remove("settling");
  }, 620);
}

function fresh() {
  return performance.now() - shownAt < 600;
}

// Back to the form. The blocking switch returns to what is really stored;
// typed handles are kept, since saving them needs the full gate again anyway.
function cancel() {
  clearInterval(timer);
  timer = null;
  $("enabled").checked = current.enabled;
  show("form");
  mark();
}

// Two confirmations with a forced wait in between. Closing the popup
// throws the whole thing away, so the wait can't be skipped.
function gate(next, what) {
  const title = $("gate-title"), msg = $("gate-msg"), yes = $("gate-yes");
  clearInterval(timer);
  timer = null;
  show("gate");
  $("gate").classList.remove("last");

  title.textContent = "Are you sure?";
  msg.textContent = "This will " + what.join(" and ") + ".";
  yes.textContent = "Yes, continue";
  yes.disabled = false;
  yes.onclick = () => {
    if (fresh()) return;
    // performance.now() is monotonic: changing the device clock doesn't help.
    const end = performance.now() + WAIT_SECONDS * 1000;
    title.textContent = "Wait. Keep this open.";
    yes.disabled = true;
    const tick = () => {
      const left = Math.ceil((end - performance.now()) / 1000);
      if (left > 0) { yes.textContent = "Wait " + left + "s"; return; }
      clearInterval(timer);
      timer = null;
      title.textContent = "Really sure?";
      yes.textContent = "Yes, do it";
      yes.disabled = false;
      // The two buttons trade places, so tapping the same spot through the
      // wait lands on "Keep blocking", not on the final yes.
      $("gate").classList.add("last");
      settle();
      yes.onclick = () => { if (fresh()) return; show("form"); commit(next); };
    };
    tick();
    timer = setInterval(tick, 250);
  };
}

$("gate-no").onclick = () => { if (!fresh()) cancel(); };

$("save").onclick = () => {
  if (fresh()) return;
  $("saved").style.visibility = "hidden"; // an old message no longer applies
  // Judge against what is actually stored, not this popup's copy of it.
  chrome.storage.local.get("settings", (r) => {
    if (chrome.runtime.lastError || !r) { say("Couldn't read your settings. Try again.", true); return; }
    current = Object.assign({}, DEFAULTS, r.settings || {});
    const form = readForm();
    if (form.bad.length) {
      say("Not an account name: " + form.bad.join(", "), true);
      return;
    }
    const next = { enabled: form.enabled, allowlist: form.allowlist };
    const what = loosenings(next);
    if (what.length) gate(next, what);
    else commit(next);
  });
};
