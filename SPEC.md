# FlowBoard Work OS - Specification (SPEC.md)

## Part 2: Product Decisions (v1 Scope)

**Product Promise**: A calm, fast, offline-first personal work system: plan the week, execute with a focus timer, reflect daily, and see honest analytics.

**v1 Includes**:
- Kanban
- Focus timer with task linking
- Habits strip
- Weekly planner
- Journal
- Insights
- Theme toggle
- JSON export/import
- CSV export
- Automatic local backups
- Onboarding with sample data or blank start
- Keyboard shortcuts
- PWA install support

**v1.1** (after one to two weeks of real use):
- Cloud sync with merge (Part 6)

**Explicitly Out of Scope**:
- Accounts and logins
- Team collaboration
- Notifications from a server
- File attachments
- Recurring tasks (consider in v2)

### Key Behaviors to Lock Down
- **Week definition**: Weeks start Monday. A week is identified by the ISO date of its Monday (for example `2026-10-26`).
- **Task scheduling**: A task has an optional `scheduledDate` (`'YYYY-MM-DD'`), not just `'Mon'`. The planner shows the selected week and tasks are placed by date. Unfinished tasks from past days show a 'Carry over' prompt.
- **Habits**: Completions are stored by date, so weekly matrices and streaks are derived, never stored.
- **Focus time**: Stored as an append-only log of sessions. Task `loggedMin` is derived from the log, not hand-edited, except through an explicit manual adjustment entry.
- **Done tasks**: Setting status to done records `completedAt`. Moving it back clears it. Velocity and High-Priority Cleared use `completedAt`.
- **WIP limit**: Configurable in Settings (default 3), warning only, never blocking.
- **Undo**: Every delete and bulk action shows a toast with Undo for 6 seconds.

---

## Part 3: Data Schema v3 (`schemaVersion: 3`)

```json
{
  "schemaVersion": 3,
  "deviceId": "dev-a1b2c3",
  "settings": {
    "theme": "dark",
    "compactCards": false,
    "soundEnabled": true,
    "dailyCapacityHours": 6,
    "capacityByWeekday": { "Mon": 6, "Tue": 6, "Wed": 6, "Thu": 6, "Fri": 6, "Sat": 2, "Sun": 0 },
    "wipLimit": 3,
    "weekStartsOn": 1,
    "timerPresets": [25, 50, 15, 5],
    "autoBackup": true
  },
  "ui": {
    "activeView": "kanban",
    "activeTagFilter": "all",
    "searchQuery": "",
    "plannerWeek": "2026-10-26",
    "journalDate": "2026-10-29",
    "showOlderDone": false,
    "kanbanGroupBy": "none",
    "kanbanSortBy": "manual",
    "kanbanFilterArea": "all",
    "kanbanFilterPriority": "all",
    "kanbanFilterScheduled": "all",
    "kanbanCollapsedColumns": {},
    "kanbanCollapsedGroups": {},
    "kanbanFiltersOpen": false,
    "kanbanSavedView": null
  },
  "areas": [
    {
      "id": "area-work",
      "name": "Work",
      "color": "blue",
      "icon": "💼",
      "order": 1000,
      "createdAt": 0,
      "updatedAt": 0,
      "deletedAt": null
    }
  ],
  "timer": {
    "status": "idle",
    "mode": "focus",
    "presetMin": 25,
    "startedAt": null,
    "sessionStartedAt": null,
    "accumulatedMs": 0,
    "linkedTaskId": null
  },
  "tags": [
    {
      "id": "tag-1",
      "name": "Deep Work",
      "color": "indigo",
      "createdAt": 0,
      "updatedAt": 0,
      "deletedAt": null
    }
  ],
  "tasks": [
    {
      "id": "t-1",
      "title": "",
      "desc": "",
      "status": "todo",
      "priority": "high",
      "tagIds": ["tag-1"],
      "areaId": "area-work",
      "scheduledDate": "2026-10-27",
      "estMin": 60,
      "order": 1000,
      "completedAt": null,
      "subtasks": [
        { "id": "st-1", "text": "", "done": false }
      ],
      "createdAt": 0,
      "updatedAt": 0,
      "deletedAt": null
    }
  ],
  "focusLog": [
    {
      "id": "f-1",
      "date": "2026-10-27",
      "taskId": "t-1",
      "minutes": 25,
      "kind": "focus",
      "startedAt": 0,
      "createdAt": 0,
      "updatedAt": 0,
      "deletedAt": null
    }
  ],
  "dayIntentions": [
    {
      "id": "di-2026-10-27",
      "date": "2026-10-27",
      "text": "",
      "updatedAt": 0
    }
  ],
  "habits": [
    {
      "id": "h-1",
      "title": "90m Morning Deep Work",
      "targetDays": [1, 2, 3, 4, 5],
      "archived": false,
      "createdAt": 0,
      "updatedAt": 0,
      "deletedAt": null
    }
  ],
  "habitLog": [
    {
      "id": "hl-h-1-2026-10-27",
      "habitId": "h-1",
      "date": "2026-10-27",
      "done": true,
      "updatedAt": 0
    }
  ],
  "journalEntries": [
    {
      "id": "j-2026-10-27",
      "date": "2026-10-27",
      "mood": 4,
      "energy": 8,
      "tagId": "tag-1",
      "wins": "",
      "blockers": "",
      "notes": "",
      "createdAt": 0,
      "updatedAt": 0,
      "deletedAt": null
    }
  ],
  "meta": {
    "lastBackupAt": 0,
    "lastSyncAt": 0,
    "onboarded": true
  }
}
```

**Migration Rule**:
`migrate(rawState)` upgrades v1 (the original schema with `day: 'Mon'`, habits with `days`, `todayFocusMinutes`) to v2, and v2 to v3, step by step, and is used for localStorage load and JSON import. Imports are validated before replacing state, and the current state is auto-backed-up first.

**`meta.onboarded` (M7)**: `false` only in a browser with no saved FlowBoard data, until the welcome screen is finished or skipped. Existing data, imported backups, Start blank and sample data always count as onboarded. No schema change (still v3).

**v2 to v3 (M1.1)**: adds `areas` (seeded with Work, Personal, Health, Learning), adds `areaId: null` to every task (meaning 'No area'), and adds the Kanban toolbar fields to `ui`.

**Organization layer (M1.1)**: tasks belong to an optional Area; tags remain free-form labels. The board supports Group by (None, Area, Priority, Tag), Sort by (Manual, Priority, Estimate, Scheduled date), filters (Area, Priority, Scheduled/Unscheduled) combined with search and tag filter, collapsible columns and groups, and saved views: Today (scheduled today or in progress), This Week, Urgent Only, Unscheduled. Saved-view dates are computed when read, never stored. Drag-and-drop reordering is only enabled when Sort is Manual and Group is None; arrow buttons always work. Deleting an area that is the active filter resets the filter to 'all'.

---

## Part 4: Code Architecture

```
flowboard/
  SPEC.md
  AGENTS.md (Part 1 rules)
  src/
    index.template.html (head, Tailwind config, layout shell, CDN tags)
    styles.css
    00-utils.js         (esc, dates, ids, debounce, toast)
    01-storage.js       (load, save, migrate, validate, backup)
    02-state.js         (default state, actions, selectors)
    03-timer.js         (timestamp-based timer, chime)
    04-view-kanban.js
    05-view-planner.js
    06-view-journal.js
    07-view-insights.js
    08-view-settings.js (export/import, backup, sync config)
    09-sync.js          (v1.1)
    10-app.js           (router, event delegation, boot)
  build.js              (concatenates into flowboard_work_os.html)
  tests/
    cases.js            (the test cases, shared by both runners)
    logic-test.js       (runs cases.js in Node)
    smoke.html          (runs cases.js in the browser, on a pretend storage)
    stress-data.js      (large workspace for the speed check)
    perf-test.js        (speed check in Node)
  flowboard_work_os.html (generated output)
  index.html             (generated, identical copy for hosting)
```

### Patterns the Agent Must Follow
- **Actions**: Named functions such as `addTask`, `moveTask`, `toggleHabit`, `logFocus`. Each updates `updatedAt`, calls `save()`, and triggers `render()`.
- **Selectors**: Pure functions such as `tasksByStatus`, `weekLoad(weekStart)`, `habitStreak(habitId)`, `velocity(range)`. Analytics only use selectors, which makes them testable.
- **Event delegation**: One click handler per view container using `data-action` attributes. No inline onclick strings.
- **Render**: Re-render only the active view. Preserve focus and scroll position on re-render of inputs.

---

## Part 5: Milestones

- **M0**: Project scaffold and build pipeline
- **M1**: State, actions, and Kanban
- **M1.1**: Organization layer (areas, group, sort, filters, saved views)
- **M2**: Focus timer and habits strip (done)
- **M3**: Weekly planner (done)
- **M4**: Journal and reflection (done)
- **M5**: Insights and analytics (done)
- **M6**: Settings, data portability, and safety (done)
- **M7**: Onboarding, polish, and PWA (done; PWA install documented as not possible in one file, see M7 behaviors)
- **M8**: Tests and hardening (done)
- **M9 (v1.1)**: Cloud sync with merge

---

## Part 6: Sync Design (v1.1)
- **Model**: Each collection (`tasks`, `tags`, `habits`, `habitLog`, `focusLog`, `journalEntries`, `dayIntentions`) is merged record by record. For two versions of the same id, the one with the higher `updatedAt` wins. A record with `deletedAt` set is a tombstone and wins over older edits. `settings` are merged per key with a single `updatedAt` for the settings object. `ui` and `timer` are never synced.
- **Flow**: `pull()` fetches remote snapshot, merges into local state, `push()` sends merged result, both sides store `lastSyncAt`. Ignore edits >5m in future.
- **Transport**: Google Apps Script Web App / Firebase RTDB.
- **Safety**: Secrets in separate localStorage key, never in JSON exports.

---

## Part 7: Security and Quality Checklist
- All user text rendered through `esc()` or `textContent`; no `eval`, no inline event attributes.
- CSP meta tag allowing only approved CDN hosts, inline styles/scripts, and sync endpoint.
- Import validates types, lengths, enums, caps array sizes.
- No secrets in HTML/exports.
- Storage quota handled gracefully without crashing.
- Date logic tested around midnight, DST changes, year boundaries.
- Timer correct after sleep, throttling, reload.
- Cross-browser compatibility: Chrome, Safari (iOS), Firefox, Edge.

---

## Part 8: Final Acceptance Test Script
1. Fresh browser profile: onboarding appears; choose blank start.
2. Create 3 tags, 8 tasks across priorities, with subtasks and estimates.
3. Schedule tasks across the week; overload one day and confirm warning.
4. Move tasks through all columns using drag and using buttons; exceed WIP limit.
5. Start 25m timer linked to task; reload mid-run; confirm continuity; chime and log.
6. Toggle habits for several days; navigate weeks; confirm no leakage.
7. Write journal entry, pull done tasks, send note to Kanban.
8. Open Insights; confirm KPIs match manual counts; toggle theme.
9. Export JSON, wipe with Start Blank, import JSON; confirm identical state.
10. Go offline and reload; confirm app works.
11. Test on phone at 390px: every action reachable without drag-and-drop.
12. Paste `<img src=x onerror=alert(1)>` into every text field; confirm nothing executes.


---

## M2 behaviors (timer and habits)
- Timer time is always computed from timestamps (`startedAt`, `accumulatedMs`), never by counting ticks. A running timer survives reloads.
- Presets 25 Focus, 50 Deep work, 15 Sprint, 5 Break. Presets can only change while idle. The 5m preset is a break and is never logged as focus.
- Completing a focus session logs the full preset minutes to `focusLog` (kind 'focus'), dated by the session start. The timer is stopped and saved BEFORE logging, so a session can never be logged twice. If it finishes while the app is closed, it is logged on next open (no chime).
- '+ Log' logs the rounded elapsed minutes (minimum 30 seconds) to the linked task, then stops the timer. If the linked task was deleted, time is logged with no task.
- Habit `targetDays` use `Date.getDay()` numbers (0 = Sunday ... 6 = Saturday). Streaks skip unscheduled days; today not yet done does not break a streak.
- Chime uses Web Audio, unlocked on the first click anywhere on the page.

## M3 behaviors (weekly planner)
- The planner shows the week stored in `ui.plannerWeek` (always a Monday). Prev, This week and Next change it. Tasks appear by `scheduledDate`.
- Day load = sum of `estMin` of every non-deleted task scheduled that day (done tasks count) versus `settings.capacityByWeekday[day] * 60`. States: Day off (0h, nothing planned), Free (nothing planned), On track (under 80%), Near limit (80% up to and including 100%), Overloaded (over 100%, or any work on a 0h day). Colour is always paired with a text label.
- Daily #1 intention is stored per date in `dayIntentions` and saves as you type without re-rendering, so focus is never lost.
- Unscheduled tray: open tasks with no `scheduledDate`. One tap on a weekday button schedules the task; mouse users can also drag. Every card also has previous-day, next-day, focus and unschedule buttons, which are the touch alternative to drag and drop.
- Carry over: any unfinished task scheduled before today is listed in a banner on every week view, with Today and Unschedule per task and Move all to today. Nothing moves automatically.
- Habit matrix: derived from `habitLog` for the viewed week. Rate = done / scheduled days up to today (future days are not counted). Streak counts consecutive scheduled days back from today.
- Capacity per weekday is edited in Settings (0 to 16 hours, rounded to 15 minutes).

## M4 behaviors (journal)
- One entry per date, id `j-YYYY-MM-DD`. An entry is only created when there is something to store (a mood, an energy level or text). Opening a day or clicking a box creates nothing.
- Mood is 1 to 5 (tap the same mood again to clear it). Energy is 1 to 10 and stays unset until the slider is moved. Each text box is capped at 5000 characters. Theme-of-the-day tag is optional.
- Autosave: every keystroke updates state immediately (no re-render, so focus is never lost); storage is written in a short batch and flushed at once when the page is hidden or closed. A 'Saving…' / 'All changes saved' status is shown.
- A day 'counts' for the streak when it has a mood, an energy level or any text. The streak is consecutive days ending today; today not being written yet does not break it.
- Future dates cannot be opened; invalid dates fall back to today.
- Pull done tasks: adds the titles of tasks whose `completedAt` falls on the selected LOCAL date to Key wins, as '• Title' lines, skipping titles already listed (case, bullets and → markers ignored). Pulling twice never duplicates.
- Send to Kanban: lines of Notes, Blockers or Wins (blank lines and lines starting with → are skipped; bullets, numbers and checkboxes are stripped) become cards: To Do or Backlog, medium priority, 30 min estimate, planned for the next day or no day. Sent lines are prefixed with → (optional) so they are never sent twice.
- Timeline: entries with content, newest first, searchable (text in any box, date, tag name). The 14-day mood/energy trend ends at the selected day and has a text alternative.
- Delete is soft (`deletedAt`) with Undo. Writing on a deleted day starts a clean entry.
- While the storage-recovery screen is showing, nothing is saved over the unreadable data.

## M5 behaviors (insights)
- Period: This week (Monday to today, compared with the same days last week), Last 7 days, Last 30 days (each compared with the equal period before). Stored in `ui.insightsRange`; `ui.insightsTables` shows the chart numbers as tables.
- KPI cards: completion velocity (tasks whose `completedAt` falls in the period), focus time (non-deleted `focusLog` minutes, with the estimates of finished tasks beside it), high priority cleared (urgent/high finished in the period against those still open), habit consistency (done / scheduled check-ins, counted from the day each habit began, up to today).
- Charts (Chart.js): focus time by tag (time on a task with several tags is shared equally; rounded so the parts add up), priority pipeline (stage by priority; Done counts only the period), planned vs logged for the last 8 weeks. Each chart has a text label and a data table; if the chart library cannot load, the tables are shown instead. Charts are destroyed before every re-draw and when leaving the screen, and re-drawn on a theme change.
- Notes: In Progress over the limit, unfinished tasks from earlier days, active tasks with no day, estimates running well over or under (needs 3 finished tasks with logged time), and whether energy and focus time move together (needs 5 journal days with energy).
- All numbers come from the pure functions in `insightsSelectors`, tested without a browser.

## M6 behaviors (settings and data safety)
- Settings: theme, compact cards (hides card descriptions, tighter padding), timer chime, four timer lengths, In Progress limit (1 to 50, warning only), daily capacity per weekday, automatic daily copy switch.
- Timer lengths are four SLOTS in this order: Focus, Deep work, Sprint, Break. They must be four different whole numbers from 1 to 600. The Break slot is the one that is never logged as focus time. Changing lengths never disturbs a running or paused session.
- Export JSON: whole state plus `exportInfo { app, version, exportedAt }`; file name `flowboard_backup_YYYY-MM-DD_v3.json`; records `meta.lastBackupAt`. Settings warns when no backup file was made in the last 7 days.
- Export CSV: all non-deleted tasks, UTF-8 with BOM for Excel, CRLF rows, quotes doubled, cells starting with = + - @ tab or CR get a leading apostrophe so spreadsheets never run them as formulas.
- Import JSON: validated before anything is touched (`validateImportData`). Refused: empty, not JSON, not an object, no FlowBoard data, newer format, lists that are not lists, over 10 MB, over the per-list caps. Accepted files are upgraded from v1 and v2, then every record is checked: unreadable or duplicate records are skipped and counted, values are range-checked and length-capped, enums fall back to safe defaults, references to missing tags, areas, tasks or habits are dropped, tag names from old files are mapped to ids. Screen state (`ui`), a running timer and `meta` are never imported; this device keeps its own `deviceId`.
- The user sees a preview (counts now vs in the file, warnings) and must confirm. Confirming saves a safety copy of the current data, replaces everything, and offers Undo for 15 seconds. If the browser cannot store the new data, nothing is replaced.
- Snapshots (`flowboard_work_os_v1_snapshots`): one automatic copy per day when the app opens (if enabled), keeping the newest 7 'daily' and the newest 5 'safety' copies (manual, before import, before restore, before Start Blank, before sample data). When the browser is full the oldest copies are dropped to make room. Restoring a copy goes through the same validation, saves a safety copy first, and offers Undo.
- Start blank: requires typing DELETE (case-insensitive); removes tasks, tags, areas, habits, journal and focus history; keeps settings and device id; safety copy first; Undo for 15 seconds.
- Load sample data: replaces the workspace with a small example (10 tasks, 3 habits with history, 4 journal days, focus sessions) planned around today; settings kept; safety copy first; Undo.
- Storage meter: approximate use of the browser's roughly 5 million character limit, with warnings at 70% and 90%.
- While the recovery screen is showing nothing is saved over unreadable data, and no snapshots are taken.

## M7 behaviors (welcome, shortcuts, offline, accessibility)
- First-run welcome: shown once, only when the browser has no saved FlowBoard data (`meta.onboarded === false`) and never over the storage-recovery screen. One dialog, three choices: start blank or with sample data; hours of planned work for Mon to Fri, Saturday and Sunday (0 to 16, rounded to 15 minutes, bad values fall back to 6 / 2 / 0); one optional habit with its weekdays.
- Blank start: empty board; the habit you typed is the only habit (none if left empty). Sample start: the M6 sample workspace, plus your habit if its name is not already there. Theme and other settings already chosen are kept. If the browser cannot save, nothing changes and an error is shown.
- 'Skip for now' and Escape both skip: the default workspace is kept as it is and the welcome never returns. Clicking outside the welcome does nothing.
- Keyboard shortcuts: `N` new task, `/` search, `U` undo while an Undo message is showing, `?` shortcut list, `Esc` closes dialogs and menus (including a card's Move menu), Left / Right / Home / End switch screens when a screen tab has focus, Up / Down move inside an open toolbar menu. Letter shortcuts are ignored while typing, while a dialog or the recovery screen is open, and when Ctrl, Cmd or Alt is held. The list is also behind the `?` button in the header and in Settings > About.
- Focus: after any re-render, keyboard focus goes back to the same control (found by id, or by its `data-*` attributes). If that control is now disabled or gone, focus goes to another button of the same task. Closing a dialog returns focus to the control that opened it, even if the screen was re-drawn meanwhile. Escape and Tab work even when focus has drifted outside an open dialog.
- Toasts: the container is the single polite live region; only error toasts are `role="alert"`. The countdown pauses while the pointer or focus is on a toast.
- Offline badge: an 'Offline' badge in the header while `navigator.onLine` is false, plus a toast when the connection drops or returns. FlowBoard itself needs no connection.
- Loading and empty states: a placeholder skeleton is in the page until the first screen is drawn. A board column that is empty only because of search, a tag, a filter or a quick view says so and offers 'Show all cards'. 'Clear filters' now also clears the quick view.
- Accessibility: page zoom is allowed; a 'Skip to content' link is the first Tab stop; every field and button has a name; text colours meet WCAG AA (4.5:1) in both themes for the palette listed in `styles.css` (light secondary text is #475569; pale accent text gets darker shades in the light theme); white-on-accent buttons use `--accent-solid`; on touch screens every button and field is at least 44px and fields use 16px text (stops iPhone auto-zoom); motion is removed under `prefers-reduced-motion`.
- About panel (Settings): version, milestone, data format, changelog (`APP_CHANGELOG` in `00-utils.js`, newest first, add an entry per milestone) and a note on offline use.
- PWA (limitation, by design): no web manifest and no service worker. Browsers refuse a service worker from a Blob URL and on `file://`, and the CSP blocks a Blob manifest, so a single file cannot be installable or cache itself. Opened from disk the app works offline already; the Tailwind styling and the font come from the browser cache, and if they are missing the app still works with plain styling. To make a hosted copy installable later, add a separate `sw.js` and `manifest.webmanifest` beside the HTML (a deliberate break of the one-file rule).

## M8 behaviors (tests and hardening)
- Error boundary: each screen is drawn through `renderViewSafely`. If drawing throws, the main area shows a panel (`role="alert"`) naming the screen, stating that data has not been changed, with Try again, a button to another screen (the board, or Settings when the board is the one that failed), Download a backup file, and the error text (escaped, capped) under Technical details. The header, timer, tabs and other screens keep working. Nothing is saved or changed by the failure.
- The timer bar and habit strip are each drawn inside their own guard, so a fault in one never stops the other or the screen below. An exception inside a click action shows an error toast and re-draws from the saved state; the app keeps running.
- Long lists: a board column draws its first 30 cards (12 per group when grouped) with 'Show N more' / 'Show fewer'; the column counter always shows the full number, and search and filters work on all cards. The planner's Unscheduled tray draws its first 30 with 'Show all N'. These choices last until the page is reloaded and are not stored. Dropping a card at the bottom of a shortened column places it just after the last card on screen.
- Speed target: with 1,000 tasks, 365 journal days and 5,000 focus sessions, opening a screen and every common action stays under 100 ms (`node tests/perf-test.js` for the app's own work; the on-screen figures are recorded in Progress.md).
- Tests: `tests/cases.js` holds every case and runs in Node (`tests/logic-test.js`) and in a browser (`tests/smoke.html`). The browser page replaces `localStorage` with a pretend one before loading any app code, and refuses to run if it cannot, so real data is never read or written. `window.FLOWBOARD_NO_BOOT` lets the app code load without starting the app.
- Dates are tested for week starts, midnight, month ends, year ends, leap days and clock changes, and the suite is run in several time zones.
- `build.js` also writes `index.html`, an identical copy of `flowboard_work_os.html`, for hosting at the folder address.

## Fixes after M8
- v0.8.1, rename tags: in the Tag Manager each tag's name is a text box. Enter or leaving the box saves; Escape puts the old name back without closing the dialog. Names are trimmed, inner spaces squeezed, capped at 40 characters. Refused with a message: empty, or the same as another active tag ignoring case (changing only the case of its own name is allowed). Tasks and journal entries refer to tags by id, so they show the new name immediately. The confirmation toast has Undo. `updatedAt` is set so sync can pick the newer name later.
- v0.8.2, click a card to edit: a click anywhere on a board card or planner card opens the task dialog, except on buttons, links, fields and labels on the card, while text is selected, or when the click only closes an open menu. The card title is a button (`data-edit-source="title"`) so keyboard and screen-reader users can open it; the pencil (`data-edit-source="pencil"`) stays. Cards that cannot be dragged show a pointer cursor.

