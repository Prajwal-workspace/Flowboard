# Changelog

Newest first. Each version is also listed in the app under Settings > About.

## v0.8.2 · 18 Nov 2026 · Click a card to edit it
- Click anywhere on a task card, on the board or in the planner, to open it for editing. No need to find the pencil.
- The buttons on a card (move, focus, delete, subtasks) keep their own jobs.
- Keyboard users can Tab to a card's title and press Enter.

## v0.8.1 · 18 Nov 2026 · Rename tags
- Rename a tag in the Tag Manager: click the name, type, press Enter. Escape cancels.
- Every task and journal entry with that tag updates at once, and the change can be undone.
- Empty names and duplicate names are refused with a message.

## v0.8.0 · 17 Nov 2026 · Tests and hardening (M8)
- If a screen fails to draw, a panel offers Try again, a way to another screen and a backup download, instead of a blank page.
- Stays quick with 1,000 tasks: long board columns and the planner tray show their first cards with a Show more button.
- More tests for midnight, month ends, year ends, leap days and clock changes, run in several time zones. Tests can also run in the browser.
- README, and a short web address for the hosted app.

## v0.7.0 · 12 to 14 Nov 2026 · Welcome, polish and Insights (M7 and M5)
- First-run welcome: start blank or with sample data, set your daily hours, add a first habit.
- Keyboard shortcut list (press ?), U to undo, arrow keys on the screen tabs.
- Offline badge, loading placeholder, clearer empty states, About panel with this changelog.
- Accessibility pass: zoom allowed, skip link, every control labelled, focus stays put after every action, stronger colour contrast in both themes.
- Insights screen (M5): completion velocity, focus time, high priority cleared and habit consistency, three charts with data tables, plain-language notes.

## v0.6.0 · 4 Nov 2026 · Settings and data safety (M6)
- JSON backup export, and import with strict checks, a preview and undo. Old formats are upgraded.
- CSV export of tasks, safe for Excel.
- Automatic daily backup copies inside the browser, with restore.
- Start blank, sample data, storage meter, editable timer lengths and In Progress limit.

## Before v0.6.0 · Foundations (M0 to M4)
Version numbers were not recorded for these milestones.
- M4 Journal: mood, energy, wins, blockers and notes per day; autosave; pull finished tasks in; send note lines to the board; timeline, trend and streak.
- M3 Weekly planner: tasks on days, daily load against capacity, carry over unfinished work, weekly habit grid.
- M2 Focus timer and habits: timestamp-based timer that survives reloads, chime, task linking, habit strip with streaks.
- M1 Kanban board: four columns, tags, areas, priorities, subtasks, search, filters, grouping, sorting, quick views, undo.
- M0 Scaffold: build pipeline, light and dark theme, storage with corruption recovery.
