# FlowBoard progress

Last updated: 2026-11-14
Version: 0.7.0, schemaVersion 3

## Done
- M0: scaffold, build pipeline, theme, storage with corruption recovery
- M1 / M1.1: Kanban, tags, areas, group/sort/filters, saved views, undo
- M2 / M2.1: focus timer, chime, task linking, habits strip, dropdown toolbar buttons
- M3 / M3.1: weekly planner, carry-over, habit grid, capacity
- M4: journal (mood, energy, autosave, pull done tasks, send to Kanban, timeline, trend, streak)
- M5: insights: period selector (this week, last 7 days, last 30 days), 4 KPI cards (velocity, focus time, high priority cleared, habit consistency), 3 charts (focus by tag, priority pipeline, planned vs logged per week) each with a data table, plain-language notes. Joined to the M7 code on 2026-11-14.
- M6: settings and data safety: switches (compact cards, chime, daily copies), editable timer lengths, In Progress limit, JSON export with date/version, JSON import with strict validation + preview + undo (also reads old v1/v2 files), CSV export, automatic daily backup copies with restore, Start blank (type DELETE), sample data, storage meter
- M7: first-run welcome (blank or sample data, daily hours, one habit; Skip or Escape keeps the default workspace), keyboard shortcut list (? key and header button), U to undo, arrow keys on the screen tabs, Escape closes a card's Move menu, Offline badge, loading placeholder, "nothing matches" empty state on the board, About panel with version and changelog, accessibility pass (zoom allowed, skip link, names on every control, focus stays on the same control after every action and returns after dialogs, contrast fixes in both themes, 44px touch targets on phones, calmer toasts)
- Automated tests: logic 319/319 (257 for M0 to M6, 41 for M7, 21 for M5). Also run in real Chrome (66 checks) but WITHOUT the Tailwind styling and WITHOUT the real chart library, because the test machine had no internet. The charts were checked with a stand-in library only.

## Next
- M8: more tests and hardening
- Later, optional: cloud sync between devices (not built; use Export/Import until then)

## Needs your eyes (not checkable by the automated tests)
- Insights with internet: the three charts draw, in both themes, and at 390px
- M7 with styling loaded: welcome dialog, shortcut list, Offline badge, ? button in the header, at desktop width and at 390px
- Colours in the light theme: amber, green, red and indigo text is now darker; priority badges changed in both themes
- Chime, real file download and file picker (unchanged since M6)
- tests/smoke or the simulated-browser suite: a browser with empty storage now opens the welcome dialog first. If that suite starts from empty storage it needs `meta.onboarded: true` in its seed data, or one Escape key press, before its first step.

## Known gaps
- Not installable as an app, and a hosted copy does not cache itself for offline use: that needs a separate service-worker file (see SPEC.md, M7 behaviors). Opened from disk it works offline already.
- Backup copies live in the same browser: they protect against mistakes, not against clearing browser data. Export a JSON file weekly.
- The header is sticky on large screens only; on phones and tablets the timer scrolls away with the page
- Planner shows 7 columns from about 1280px wide; narrower screens show fewer
- A few deliberately dimmed labels (finished tasks, "not scheduled" dashes, the "Nothing planned" hint in the planner) are below the 4.5:1 contrast target

## How to check the project
- node build.js
- node tests/logic-test.js   (expect: Passed 319, failed 0)

## Rules
- Small steps. After every step: test in browser, back up the folder, update this file.
- Read AGENTS.md, SPEC.md and this file before changing anything.
