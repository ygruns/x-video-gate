const DEFAULTS = { enabled: true, blockGifs: true, allowlist: [] };
const WAIT_SECONDS = 15;
const $ = (id) => document.getElementById(id);

let current = Object.assign({}, DEFAULTS);
let timer = null;

chrome.storage.local.get("settings", (r) => {
  current = Object.assign({}, DEFAULTS, r.settings || {});
  fill(current);
});

function fill(s) {
  $("enabled").checked = s.enabled;
  $("blockGifs").checked = s.blockGifs;
  $("allowlist").value = s.allowlist.map((h) => "@" + h).join("\n");
}

function readForm() {
  const allowlist = $("allowlist").value
    .split(/[\s,]+/)
    .map((h) => h.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  return { enabled: $("enabled").checked, blockGifs: $("blockGifs").checked, allowlist };
}

// Anything that lets more video through than the saved settings do.
function loosenings(next) {
  const out = [];
  if (current.enabled && !next.enabled) out.push("turn blocking off completely");
  if (current.blockGifs && !next.blockGifs) out.push("let GIFs play");
  const added = next.allowlist.filter((h) => !current.allowlist.includes(h));
  if (added.length) out.push("always allow " + added.map((h) => "@" + h).join(", "));
  return out;
}

function commit(next) {
  chrome.storage.local.set({ settings: next }, () => {
    current = next;
    $("saved").style.visibility = "visible";
    setTimeout(() => ($("saved").style.visibility = "hidden"), 2000);
  });
}

function show(view) {
  $("form").hidden = view !== "form";
  $("gate").hidden = view !== "gate";
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
  show("gate");

  title.textContent = "Are you sure?";
  msg.textContent = "This will " + what.join(" and ") + ".";
  yes.textContent = "Yes, continue";
  yes.disabled = false;
  yes.onclick = () => {
    const end = Date.now() + WAIT_SECONDS * 1000;
    title.textContent = "Wait";
    msg.textContent = "Still want to? You can go back any time.";
    yes.disabled = true;
    const tick = () => {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left > 0) { yes.textContent = "Wait " + left + "s"; return; }
      clearInterval(timer);
      timer = null;
      title.textContent = "Really sure?";
      msg.textContent = "Last check: this will " + what.join(" and ") + ".";
      yes.textContent = "Yes, do it";
      yes.disabled = false;
      yes.onclick = () => { commit(next); show("form"); };
    };
    tick();
    timer = setInterval(tick, 250);
  };
}

$("gate-no").onclick = cancel;

$("save").onclick = () => {
  const next = readForm();
  const what = loosenings(next);
  if (what.length) gate(next, what);
  else commit(next);
};
