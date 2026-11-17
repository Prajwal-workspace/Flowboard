# FlowBoard Work OS

A calm, fast, offline-first personal work system in a single HTML file. Plan the week, work with a focus timer, reflect each day, and see honest numbers about how it went.

**Try it:** https://prajwal-workspace.github.io/Flowboard/

No account, no server, no install. Everything you enter stays in your own browser.

## What it does

- **Kanban board**: Backlog, To Do, In Progress, Done. Tags, areas, priorities, subtasks, search, filters, grouping, sorting, quick views, and an In Progress limit that warns but never blocks.
- **Focus timer**: four editable lengths (the last is a break), linked to a task, survives a reload, logs the time when it finishes.
- **Habits**: tick today's habits from any screen; streaks and a weekly grid.
- **Weekly planner**: schedule tasks on days, see each day's load against your capacity, carry over what was not finished.
- **Journal**: mood, energy, wins, blockers and notes per day; pull finished tasks in, send note lines to the board.
- **Insights**: completion velocity, focus time, high priority cleared, habit consistency, three charts, and plain-language notes.
- **Your data, your file**: JSON backup and checked import, CSV export, automatic daily backup copies, undo on every delete.
- **Keyboard and accessibility**: shortcuts (press `?`), full keyboard use, screen-reader labels, light and dark themes, works at phone width.

## Using it

Open the link above, or download `flowboard_work_os.html` and double-click it. The first time, a short welcome lets you start blank or with sample data.

Your data is stored only in the browser you use, at the address you opened. The hosted page and a downloaded copy keep separate data; move between them with **Settings > Export JSON backup** and **Import JSON backup**. Export a backup every week or so: clearing the browser's site data would erase it.

The page loads its styling, font and chart library from public CDNs the first time, then the browser reuses them. It is not installable as an app.

## Working on it

You need [Node.js](https://nodejs.org) for building and testing. No packages to install.

```
node build.js              builds flowboard_work_os.html and index.html from src/
node tests/logic-test.js   runs the tests (expect: failed 0)
node tests/perf-test.js    speed check with 1,000 tasks
```

You can also open `tests/smoke.html` in a browser to run the same tests there. It uses a pretend storage, so it never touches your real data.

```
src/
  index.template.html   page shell
  styles.css
  00-utils.js           dates, ids, toasts, version and changelog
  01-storage.js         load, save, migrate, import checks, backups
  02-state.js           actions and selectors
  03-timer.js           focus timer and habits strip
  04-view-kanban.js  05-view-planner.js  06-view-journal.js
  07-view-insights.js   08-view-settings.js
  09-sync.js            placeholder for cloud sync
  10-app.js             routing, shortcuts, welcome, error panel, start-up
tests/                  cases.js, logic-test.js, smoke.html, perf-test.js, stress-data.js
build.js
SPEC.md                 how every feature is meant to behave
Progress.md             what is done, what is next, known gaps
```

Edit only the files in `src/`. `flowboard_work_os.html` and `index.html` are produced by the build.

## Releasing a new version

1. Change the code in `src/`. Raise `APP_VERSION` and add a changelog entry at the top of `src/00-utils.js`.
2. `node build.js`, then `node tests/logic-test.js`.
3. Open `flowboard_work_os.html` and check the change by hand.
4. Commit, tag and push:
   ```
   git add .
   git commit -m "v0.8.1: short description"
   git tag v0.8.1
   git push
   git push --tags
   ```
The live site updates a minute or two after the push.

## Status

Version 0.8.0. Built in milestones M0 to M8; see `Progress.md`. Cloud sync between devices is planned and not built.
