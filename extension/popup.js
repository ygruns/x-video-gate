const DEFAULTS = { enabled: true, allowlist: [] };
const WAIT_SECONDS = 15;
const $ = (id) => document.getElementById(id);

let current = Object.assign({}, DEFAULTS);
let timer = null;
let shownAt = -1e9;

chrome.storage.local.get("settings", (r) => {
  current = Object.assign({}, DEFAULTS, r.settings || {});
  fill(current);
  $("save").disabled = false;
});

function fill(s) {
  $("enabled").checked = s.enabled;
  $("allowlist").value = s.allowlist.map((h) => "@" + h).join("\n");
}

function readForm() {
  const allowlist = $("allowlist").value
    .split(/[\s,]+/)
    .map((h) => h.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  return { enabled: $("enabled").checked, allowlist };
}

// Anything that lets more video through than the saved settings do.
function loosenings(next) {
  const out = [];
  if (current.enabled && !next.enabled) out.push("turn blocking off completely");
  const added = next.allowlist.filter((h) => !current.allowlist.includes(h));
  if (added.length) out.push("always allow " + added.map((h) => "@" + h).join(", "));
  return out;
}

function commit(next) {
  chrome.storage.local.set({ settings: next }, () => {
    const failed = !!chrome.runtime.lastError;
    if (!failed) current = next;
    say(failed ? "Couldn't save. Try again." : "Saved", failed);
  });
}

let sayTimer = null;
function say(text, bad) {
  const el = $("saved");
  el.textContent = text;
  el.classList.toggle("bad", !!bad);
  el.style.visibility = "visible";
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => (el.style.visibility = "hidden"), bad ? 6000 : 2000);
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

function cancel() {
  clearInterval(timer);
  timer = null;
  fill(current);
  show("form");
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
    title.textContent = "Wait";
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
      yes.onclick = () => { if (fresh()) return; commit(next); show("form"); };
    };
    tick();
    timer = setInterval(tick, 250);
  };
}

$("gate-no").onclick = () => { if (!fresh()) cancel(); };

$("save").onclick = () => {
  if (fresh()) return;
  // Judge against what is actually stored, not this popup's copy of it.
  chrome.storage.local.get("settings", (r) => {
    current = Object.assign({}, DEFAULTS, r.settings || {});
    const next = readForm();
    const what = loosenings(next);
    if (what.length) gate(next, what);
    else commit(next);
  });
};
