# Verification method for anything interactive

Run this whenever the code changes. The point is not to prove that code matches
a sentence. The defects that actually occur are (a) a branch nobody defined and
(b) something a person using it would expect that nobody considered. Both passes
below exist to surface those.

## Who does what

- **Main session** writes `spec/intended.json`: the state graph we mean, every
  user action in every state with the outcome the user SEES. "Nothing happens"
  is never a valid outcome on its own: either the control looks inactive, or it
  says why, or the entry is a bug.
- **A source-only agent** (same agent across updates when the session allows;
  otherwise a fresh one started from this file plus its previous output) reads
  only `extension/` and writes the files below. It is never shown
  `intended.json` before its own files are on disk.
- **Live run** settles anything the agent marks as not determinable, and every
  fix. A static reading is a lead, not a verdict: it has produced false alarms.

## Agent pass 1 — omission audit → `spec/gaps.json` (the main pass)

Read ALL of `extension/`. No README, store/, previews/, intended.json, git history. Nothing run.

- `control_census`: every control and input (buttons, checkbox, text box, select,
  the overlay surface, the video element, Back, tab close, popup dismiss,
  reload, rotate, Enter/Esc, long-press, double tap) in every state it is
  reachable in → what the user sees happen → class:
  `acts | visibly_disabled | silently_ignored | fails_silently | undefined`.
- `failure_census`: every storage call, message, tab create, network load,
  timer, nullable DOM lookup, optional API field → what the user sees if it
  fails or never returns → `handled_with_feedback | handled_silently | unhandled`.
- `missing_states`: loading, empty, error, offline, logged out, extension just
  updated, first run, very long text, zero / many items, two tabs or popups at
  once, slow phone.
- `human_expectations`: walk through real use as a first-time phone user who
  has read nothing; at least 25 situations; verdict `met | unmet | surprising`.
- `top`: the 10 most likely to make a real user think it is broken.

## Agent pass 2 — state graph → `spec/from_source.json`

Hidden and visible state variables, states, events, a TOTAL transition table
(every state x event; self-loops verified to change nothing), each with file:line.
- `repeat_checks`: every user event twice in a row in every state, including
  the second arriving before the first's async callback.
- `round_trip_checks`: every inverse pair (block/unblock, open/cancel, off/on,
  tick/untick); compare ALL state variables, list residue.

## Agent pass 3 — `spec/alignment.json` (secondary)

Only now read `intended.json`. One row per intended transition, invariant and
accepted gap: `match | mismatch | not_determinable_statically`, plus
`unintended`: behaviour with no counterpart in the intended graph.

## Then

Fix or consciously accept every item; record accepted ones under
`accepted_gaps` in `intended.json`; re-run the live scripts; repeat until the
agent's `top` list is empty or accepted.
