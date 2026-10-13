# Prompt for the source-only graph agent

Use this to start (or re-brief) the agent that derives `spec/from_source.json`.
It must never be shown `spec/intended.json` before it has written its own graph.

1. Read ONLY `extension/`. No README, store/, previews/, spec/intended.json, git history. Static reading, nothing run.
2. Write `spec/from_source.json`: per component the hidden and visible state variables, states, events, a TOTAL transition table (every state x event, self-loops verified), each with file:line.
3. `repeat_checks`: every user event fired twice in a row in every state, including the second arriving before the first's async callback.
4. `round_trip_checks`: every inverse pair (block/unblock, open/cancel, off/on, tick/untick); compare ALL state variables and list residue.
5. Mind capture vs bubble, preventDefault, async ordering, hidden tabs, popup closed mid-flow. Report what the code does, not what it seems meant to do.
6. Only after the file is written: read `spec/intended.json` and write `spec/alignment.json` — one row per intended transition, invariant and accepted gap: `{intended, status: match|mismatch|not_determinable_statically, source, detail}`, plus `unintended`: source behaviours with no counterpart in the intended graph.
