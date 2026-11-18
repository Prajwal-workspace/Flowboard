# FlowBoard progress

Last updated: 2026-11-18
Version: 0.8.1, schemaVersion 3
Code: https://github.com/Prajwal-workspace/Flowboard

## Done
- M0: scaffold, build pipeline, theme, storage with corruption recovery
- M1 / M1.1: Kanban, tags, areas, group/sort/filters, saved views, undo
- M2 / M2.1: focus timer, chime, task linking, habits strip, dropdown toolbar buttons
- M3 / M3.1: weekly planner, carry-over, habit grid, capacity
- M4: journal (mood, energy, autosave, pull done tasks, send to Kanban, timeline, trend, streak)
- M5: insights: period selector, 4 KPI cards, 3 charts each with a data table, plain-language notes
- M6: settings and data safety: JSON export and checked import with preview and undo, CSV export, daily backup copies, Start blank, sample data, storage meter
- M7: first-run welcome, keyboard shortcut list, U to undo, Offline badge, About panel with changelog, accessibility pass
- M8: error panel when a screen fails to draw (Try again, way out, backup), guards around the header pieces and click actions, long board columns and the planner tray shortened with Show more, date-edge and migration tests, tests runnable in the browser (tests/smoke.html), speed check (tests/perf-test.js), README, index.html for hosting

## Fixes after M8 (one per version)
- v0.8.1: rename tags in the Tag Manager (click the name, Enter saves, Escape cancels, Undo in the message). Empty and duplicate names are refused.

## Test results (2026-11-17)
- Logic tests: 362 passed, 0 failed (Node), also in 8 time zones, and the same 362 in real Chrome through tests/smoke.html
- Real Chrome checks of the built file: 82 passed (welcome, shortcuts, focus, undo, offline, tabs, insights, error panel, long lists, old data, unreadable data)
- Limits of those checks: the test machine had no internet, so they ran WITHOUT the Tailwind styling and WITHOUT the real chart library (a stand-in was used). Chrome only: Firefox, Safari and Edge were not run.
- Speed with 1,000 tasks, 365 journal days, 5,000 focus sessions, in Chrome without styling (median of 5):
  - open board 74 ms, planner 20 ms, journal 22 ms, insights 19 ms, settings 3 ms
  - move a task 80 to 95 ms across runs (the closest to the 100 ms target), add a task 76 ms, search 42 ms, group by area 88 ms, tick a habit 61 ms
  - planner move 19 ms, journal typing under 1 ms, journal search 41 ms, save 29 ms
  - Before the long-list change the board took about 300 ms and the planner 110 ms.
  - With styling loaded the board will be somewhat slower than these figures. Not measured.

## Next
- Use it for one to two weeks; log problems as GitHub issues
- Acceptance script (SPEC.md Part 8) on the hosted copy
- M9, optional: cloud sync between devices (not built; use Export/Import until then)

## Needs your eyes (not checkable by the automated tests)
- Everything with styling loaded, in both themes, at desktop width and 390px: welcome, shortcut list, Offline badge, Insights charts, the error panel is not something you will normally see
- Board with more than 30 cards in a column: the Show more button
- Chime, real file download and file picker
- Firefox, Safari (iPhone) and Edge
- The older simulated-browser suite (221 tests) was never sent, so it has not been run since M6. A browser with empty storage now opens the welcome dialog first; that suite needs `meta.onboarded: true` in its seed data or one Escape press.

## Known gaps
- Not installable as an app, and a hosted copy does not cache itself for offline use: that needs a separate service-worker file (see SPEC.md, M7 behaviors). Opened from disk it works offline already.
- The hosted page and a downloaded file keep separate data (browser storage is per address). Move data with Export / Import.
- Backup copies live in the same browser: they protect against mistakes, not against clearing browser data. Export a JSON file weekly.
- The header is sticky on large screens only; on phones and tablets the timer scrolls away with the page
- Planner shows 7 columns from about 1280px wide; narrower screens show fewer
- A few deliberately dimmed labels (finished tasks, "not scheduled" dashes, the "Nothing planned" hint in the planner) are below the 4.5:1 contrast target
- A planner day with a very large number of tasks is not shortened (only the Unscheduled tray is)

## How to check the project
- node build.js
- node tests/logic-test.js   (expect: Passed 371, failed 0)
- node tests/perf-test.js    (expect: All steps under 100 ms)
- or open tests/smoke.html in a browser

## Rules
- Small steps. After every step: test in browser, back up the folder, update this file.
- Read AGENTS.md, SPEC.md and this file before changing anything.
