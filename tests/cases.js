// FlowBoard test cases. Shared by two runners:
//   node tests/logic-test.js   (fast, no browser)
//   tests/smoke.html           (open in a browser; uses a pretend storage, so your real data is never touched)
// The runner loads src/*.js first, so every app function is available here.
{
let pass = 0, fail = 0;
const failures = [];
const t = (n, c) => { if (c) pass++; else { fail++; failures.push(n); console.log('FAIL:', n); } };
const ids = a => a.map(x => x.id).join(',');
const mk = (o) => ({ title: o.id, desc: '', tagIds: [], areaId: null, scheduledDate: null, estMin: 30, order: 1000, deletedAt: null, subtasks: [], ...o });

// Migration
const m = migrate({ schemaVersion: 2, tasks: [mk({ id: 'a', status: 'todo', priority: 'high' })], tags: [], ui: {} });
t('migrate v2->v3', m.schemaVersion === 3 && m.tasks.length === 1 && m.tasks[0].areaId === null && m.areas.length === 4);
t('migrate adds ui fields', m.ui.kanbanGroupBy === 'none' && m.ui.kanbanSavedView === null);
t('migrate v1->v3', migrate({ tasks: [{ id: 'b', title: 'old', status: 'done', day: 'Mon', tags: ['Deep Work'] }] }).schemaVersion === 3);

initState(); const s = getState();
const today = getLocalDateString(new Date());
const dayMs = 86400000;
const nextWeek = getLocalDateString(new Date(Date.now() + 8 * dayMs));
s.tasks = [
  mk({ id: '1', status: 'todo', priority: 'urgent', tagIds: ['tag-1'], areaId: 'area-work', scheduledDate: today, estMin: 30, order: 2000 }),
  mk({ id: '2', status: 'todo', priority: 'low', estMin: 90, order: 1000 }),
  mk({ id: '3', status: 'inprogress', priority: 'high', areaId: 'area-health', scheduledDate: '2000-01-01', estMin: 10 }),
  mk({ id: '4', status: 'todo', priority: 'medium', areaId: 'area-work', order: 3000, deletedAt: Date.now() }),
  mk({ id: '5', status: 'backlog', priority: 'medium', scheduledDate: nextWeek }),
  mk({ id: '6', status: 'inprogress', priority: 'medium' }),
];
t('soft-deleted hidden', !ids(selectors.getKanbanTasksByStatus('todo')).includes('4'));
t('sort manual', ids(selectors.getKanbanTasksByStatus('todo')) === '2,1');
actions.setKanbanSortBy('priority'); t('sort priority', ids(selectors.getKanbanTasksByStatus('todo')) === '1,2');
actions.setKanbanSortBy('estimate'); t('sort estimate', ids(selectors.getKanbanTasksByStatus('todo')) === '1,2');
actions.setKanbanSortBy('scheduled'); t('sort scheduled', ids(selectors.getKanbanTasksByStatus('todo')) === '1,2');
actions.clearKanbanFilters();
actions.setKanbanFilterArea('area-work'); t('filter area', ids(selectors.getKanbanFilteredTasks()) === '1'); actions.clearKanbanFilters();
actions.setKanbanFilterPriority('high'); t('filter priority', ids(selectors.getKanbanFilteredTasks()) === '3'); actions.clearKanbanFilters();
actions.setKanbanFilterScheduled('unscheduled'); t('filter unscheduled', ids(selectors.getKanbanFilteredTasks()) === '2,6'); actions.clearKanbanFilters();
const g = selectors.groupKanbanTasks(selectors.getActiveTasks(), 'area');
t('group by area', g.find(x => x.key === 'area-work').tasks.length === 1 && g.find(x => x.key === '_no_area').tasks.length === 3);

// Saved views
actions.applyKanbanSavedView('today');
t('Today = scheduled today + in progress', ids(selectors.getKanbanFilteredTasks()) === '1,3,6');
t('Today counts as 1 active filter', selectors.countActiveKanbanFilters() === 1);
actions.applyKanbanSavedView('this-week');
t('This week', ids(selectors.getKanbanFilteredTasks()) === '1');
t('This week counts as 1 active filter', selectors.countActiveKanbanFilters() === 1);
actions.applyKanbanSavedView('urgent'); t('Urgent', ids(selectors.getKanbanFilteredTasks()) === '1');
actions.applyKanbanSavedView('unscheduled'); t('Unscheduled', ids(selectors.getKanbanFilteredTasks()) === '2,6');
actions.clearKanbanSavedView(); actions.clearKanbanFilters();
t('filter count back to 0', selectors.countActiveKanbanFilters() === 0);

// Areas
actions.deleteArea('area-work'); t('deleted area hidden', !selectors.getAreaById('area-work'));
t('task of deleted area -> No area', selectors.groupKanbanTasks(selectors.getActiveTasks(), 'area').find(x => x.key === '_no_area').tasks.length === 4);
actions.restoreArea('area-work'); t('area restored', !!selectors.getAreaById('area-work'));
actions.setKanbanFilterArea('area-work'); actions.deleteArea('area-work');
t('deleting the filtered area resets filter', getState().ui.kanbanFilterArea === 'all');
t('...and all tasks show again', ids(selectors.getKanbanFilteredTasks()) === '1,2,3,5,6');
actions.restoreArea('area-work');

// Task actions
actions.addTask({ title: 'N', areaId: 'area-health' });
t('addTask keeps areaId', getState().tasks.find(x => x.title === 'N').areaId === 'area-health');
actions.moveTask('1', 'done'); t('completedAt set', !!getState().tasks.find(x => x.id === '1').completedAt);
actions.moveTask('1', 'todo'); t('completedAt cleared', getState().tasks.find(x => x.id === '1').completedAt === null);

// ============================================================================
// M2: TIMER, FOCUS LOG, HABITS  (uses a fake clock so no waiting is needed)
// ============================================================================
t('formatClock', formatClock(1500000) === '25:00' && formatClock(61000) === '01:01' && formatClock(0) === '00:00' && formatClock(999) === '00:01');
t('formatMinutes', formatMinutes(25) === '25m' && formatMinutes(75) === '1h 15m' && formatMinutes(120) === '2h 00m');
t('elapsed while running', getTimerElapsedMs({ status: 'running', accumulatedMs: 60000, startedAt: 1000 }, 11000) === 70000);
t('elapsed while paused', getTimerElapsedMs({ status: 'paused', accumulatedMs: 60000, startedAt: null }, 99999) === 60000);
t('remaining never negative', getTimerRemainingMs({ status: 'running', accumulatedMs: 0, startedAt: 1, presetMin: 1 }, 999999) === 0);
t('preset modes', getTimerModeForPreset(5) === 'break' && getTimerModeForPreset(25) === 'focus' && getTimerModeForPreset(50) === 'focus');

localStorage.removeItem(STORAGE_KEY); initState();
const realNow = Date.now;
let FAKE = new Date(2026, 10, 3, 10, 0, 0).getTime();   // Tue 3 Nov 2026, 10:00
Date.now = () => FAKE;
const MIN = 60000;

getState().tasks = [mk({ id: 'tk', title: 'Write report', status: 'inprogress' })];
timerService.linkTask('tk');
t('link a real task', getState().timer.linkedTaskId === 'tk');
timerService.linkTask('nope');
t('linking a missing task clears the link', getState().timer.linkedTaskId === null);
timerService.linkTask('tk');

timerService.start();
t('start -> running focus', getState().timer.status === 'running' && getState().timer.mode === 'focus');
FAKE += 10 * 1000; timerService.pause();
t('pause stores elapsed', getState().timer.status === 'paused' && getState().timer.accumulatedMs === 10000);
FAKE += 60 * MIN;                                        // an hour passes while paused
t('time does not advance while paused', getTimerElapsedMs(getState().timer) === 10000);
timerService.start();
t('resume keeps elapsed', getState().timer.status === 'running' && getTimerElapsedMs(getState().timer) === 10000);
timerService.setPreset(50);
t('preset cannot change while running', getState().timer.presetMin === 25);

FAKE += 25 * MIN;                                        // well past the 25 min mark
timerService.tick();
t('completes and goes idle', getState().timer.status === 'idle');
t('logs exactly one 25 min session to the linked task',
  getState().focusLog.length === 1 && getState().focusLog[0].minutes === 25 && getState().focusLog[0].taskId === 'tk' && getState().focusLog[0].kind === 'focus');
timerService.tick(); timerService.tick();
t('no double logging', getState().focusLog.length === 1);
t('task logged minutes derive from the log', selectors.getTaskLoggedMinutes('tk') === 25);
t('daily total', selectors.getFocusMinutesOn('2026-11-03') === 25);

// Closing the app mid-session and reopening later
timerService.setPreset(15); timerService.start();
FAKE += 20 * MIN;                                        // app closed for 20 min
initState();                                             // "reload": state comes back from localStorage
t('running timer survives a reload', getState().timer.status === 'running');
timerService.tick(true);
t('finished-while-closed session logged once', getState().focusLog.length === 2 && getState().focusLog[1].minutes === 15);
timerService.tick(true);
t('...and not again', getState().focusLog.length === 2);

// +Log
timerService.setPreset(25); timerService.start();
FAKE += 12.5 * MIN; timerService.logElapsed();
t('+Log records rounded minutes and stops', getState().focusLog.length === 3 && getState().focusLog[2].minutes === 13 && getState().timer.status === 'idle');
timerService.start(); FAKE += 20 * 1000; timerService.logElapsed();
t('+Log under 30s logs nothing and keeps running', getState().focusLog.length === 3 && getState().timer.status === 'running');
timerService.reset();
t('reset -> idle, nothing logged', getState().timer.status === 'idle' && getState().timer.accumulatedMs === 0 && getState().focusLog.length === 3);

// Breaks are never logged as focus
timerService.setPreset(5); timerService.start();
t('5m preset is a break', getState().timer.mode === 'break');
timerService.logElapsed();
t('+Log ignored during a break', getState().focusLog.length === 3);
FAKE += 6 * MIN; timerService.tick();
t('break completes without logging', getState().focusLog.length === 3 && getState().timer.status === 'idle');

// Linked task deleted mid-session: time is still kept, just unlinked
timerService.setPreset(25); timerService.linkTask('tk'); timerService.start();
actions.deleteTask('tk');
FAKE += 26 * MIN; timerService.tick();
t('deleted linked task -> session logged with no task', getState().focusLog.length === 4 && getState().focusLog[3].taskId === null);
t('timer task options exclude deleted tasks', !selectors.getTimerTaskOptions().some(x => x.id === 'tk'));

const soundBefore = getState().settings.soundEnabled;
actions.toggleSound();
t('toggleSound flips setting', getState().settings.soundEnabled === !soundBefore);
actions.toggleSound();

// Habits (2026-11-03 is a Tuesday)
const TUE = '2026-11-03';
const hAll = actions.addHabit({ title: 'Read', targetDays: [0, 1, 2, 3, 4, 5, 6] });
t('addHabit', !!hAll && getState().habits.some(x => x.id === hAll.id));
t('addHabit rejects blank title', actions.addHabit({ title: '   ' }) === null);
t('normalizeHabitDays', normalizeHabitDays([]) === null && normalizeHabitDays([1, 1, 9, 'x', 3]).join() === '1,3');
t('addHabit falls back to Mon-Fri', actions.addHabit({ title: 'X', targetDays: [] }).targetDays.join() === '1,2,3,4,5');

actions.toggleHabit(hAll.id, TUE);
t('toggle on', selectors.isHabitDone(hAll.id, TUE));
actions.toggleHabit(hAll.id, TUE);
t('toggle off', !selectors.isHabitDone(hAll.id, TUE));
t('toggle reuses one log row per day', getState().habitLog.filter(l => l.habitId === hAll.id && l.date === TUE).length === 1);

['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-29'].forEach(d => actions.toggleHabit(hAll.id, d));
t('streak: today not done yet does not break it, a gap does', selectors.getHabitStreak(hAll.id, getState(), TUE) === 3);
actions.toggleHabit(hAll.id, TUE);
t('streak grows when today is done', selectors.getHabitStreak(hAll.id, getState(), TUE) === 4);

const hWeek = actions.addHabit({ title: 'Deep work', targetDays: [1, 2, 3, 4, 5] });
['2026-11-02', '2026-10-30'].forEach(d => actions.toggleHabit(hWeek.id, d));   // Mon, previous Fri (weekend skipped)
t('streak skips days the habit is not scheduled', selectors.getHabitStreak(hWeek.id, getState(), TUE) === 2);
t('isHabitDue by weekday', selectors.isHabitDue(hWeek, '2026-11-03') && !selectors.isHabitDue(hWeek, '2026-11-01'));
t('habits due today', selectors.getHabitsDueOn(TUE).some(x => x.id === hWeek.id));

actions.updateHabit(hWeek.id, { title: 'Deep work 90m', targetDays: [1, 3, 5] });
t('updateHabit renames and changes days', getState().habits.find(x => x.id === hWeek.id).title === 'Deep work 90m' && getState().habits.find(x => x.id === hWeek.id).targetDays.join() === '1,3,5');
actions.updateHabit(hWeek.id, { targetDays: [] });
t('updateHabit ignores an empty day list', getState().habits.find(x => x.id === hWeek.id).targetDays.join() === '1,3,5');
actions.deleteHabit(hWeek.id);
t('deleted habit hidden but history kept', !selectors.getActiveHabits().some(x => x.id === hWeek.id) && getState().habitLog.some(l => l.habitId === hWeek.id));
actions.restoreHabit(hWeek.id);
t('restored habit back', selectors.getActiveHabits().some(x => x.id === hWeek.id));
actions.toggleHabit('does-not-exist', TUE);
t('toggling an unknown habit is a no-op', !getState().habitLog.some(l => l.habitId === 'does-not-exist'));

Date.now = realNow;


// ============================================================================
// M3: WEEKLY PLANNER
// ============================================================================
t('addDaysStr across month/year/leap', addDaysStr('2026-11-02', 7) === '2026-11-09' && addDaysStr('2026-12-31', 1) === '2027-01-01' && addDaysStr('2028-02-28', 1) === '2028-02-29' && addDaysStr('2026-03-01', -1) === '2026-02-28');
t('addDaysStr is safe around daylight-saving changes', addDaysStr('2026-03-07', 1) === '2026-03-08' && addDaysStr('2026-03-08', 1) === '2026-03-09' && addDaysStr('2026-10-31', 2) === '2026-11-02' && addDaysStr('2026-11-01', 1) === '2026-11-02');
t('getDayKey', getDayKey('2026-11-02') === 'Mon' && getDayKey('2026-11-08') === 'Sun');
const wk = selectors.getWeekDates('2026-11-04');
t('getWeekDates starts on Monday', wk.length === 7 && wk[0].key === 'Mon' && wk[0].date === '2026-11-02' && wk[6].key === 'Sun' && wk[6].date === '2026-11-08');

localStorage.removeItem(STORAGE_KEY); initState();
getState().tasks = [
  mk({ id: 'p1', status: 'todo', priority: 'low', estMin: 60, scheduledDate: '2026-11-03', order: 1000 }),
  mk({ id: 'p2', status: 'done', priority: 'urgent', estMin: 60, scheduledDate: '2026-11-03', order: 2000 }),
  mk({ id: 'p3', status: 'todo', priority: 'urgent', estMin: 120, scheduledDate: '2026-11-03', order: 3000 }),
  mk({ id: 'p4', status: 'todo', priority: 'high', estMin: 30, scheduledDate: null }),
  mk({ id: 'p5', status: 'done', priority: 'high', scheduledDate: null }),
  mk({ id: 'p6', status: 'todo', scheduledDate: '2026-11-03', deletedAt: 1 }),
  mk({ id: 'p7', status: 'inprogress', priority: 'medium', estMin: 45, scheduledDate: '2026-10-30' }),
  mk({ id: 'p8', status: 'done', scheduledDate: '2026-10-29' }),
];
t('day tasks: open first, by priority, done last, deleted hidden', ids(selectors.getTasksOnDate('2026-11-03')) === 'p3,p1,p2');
t('unscheduled: open and not deleted only', ids(selectors.getUnscheduledTasks()) === 'p4');
t('carry-over: unfinished before today only', ids(selectors.getCarryOverTasks('2026-11-03')) === 'p7');
t('carry-over: nothing when today is the day', selectors.getCarryOverTasks('2026-10-30').length === 0);

// Load meter states (Tuesday default capacity is 6h = 360m, planned 240m)
let L = selectors.getDayLoad('2026-11-03');
t('load ok (67%)', L.state === 'ok' && L.plannedMin === 240 && L.capacityMin === 360 && L.percent === 67 && L.taskCount === 3 && L.doneCount === 1);
t('empty day', selectors.getDayLoad('2026-11-04').state === 'empty');
t('day off with nothing planned', selectors.getDayLoad('2026-11-08').state === 'off');
actions.setCapacity('Tue', 4);  L = selectors.getDayLoad('2026-11-03');
t('exactly full counts as near limit', L.state === 'near' && L.percent === 100 && L.overByMin === 0);
actions.setCapacity('Tue', 3);  L = selectors.getDayLoad('2026-11-03');
t('over capacity', L.state === 'over' && L.overByMin === 60 && L.percent === 100);
actions.setCapacity('Tue', 0);
t('work on a 0h day is overloaded', selectors.getDayLoad('2026-11-03').state === 'over');
t('setCapacity rejects out-of-range and unknown days', actions.setCapacity('Tue', 20) === false && actions.setCapacity('Foo', 3) === false && actions.setCapacity('Tue', -1) === false && getState().settings.capacityByWeekday.Tue === 0);
actions.setCapacity('Tue', 3.3);
t('setCapacity rounds to 15 minutes', getState().settings.capacityByWeekday.Tue === 3.25);
actions.setCapacity('Tue', 6);
const sum = selectors.getWeekSummary('2026-11-02');
t('week summary', sum.plannedMin === 240 && sum.capacityMin === 1920 && sum.taskCount === 3 && sum.doneCount === 1 && sum.overDays === 0);

// Scheduling
actions.scheduleTask('p4', '2026-11-05');
t('scheduleTask puts a task on a day', getState().tasks.find(x => x.id === 'p4').scheduledDate === '2026-11-05' && selectors.getUnscheduledTasks().length === 0);
actions.shiftTaskDay('p4', 1);
t('shiftTaskDay +1', getState().tasks.find(x => x.id === 'p4').scheduledDate === '2026-11-06');
actions.shiftTaskDay('p4', -2);
t('shiftTaskDay -2', getState().tasks.find(x => x.id === 'p4').scheduledDate === '2026-11-04');
actions.scheduleTask('p4', null);
t('scheduleTask(null) unschedules', getState().tasks.find(x => x.id === 'p4').scheduledDate === null && ids(selectors.getUnscheduledTasks()) === 'p4');
actions.shiftTaskDay('p4', 1);
t('shiftTaskDay on an unscheduled task is a no-op', getState().tasks.find(x => x.id === 'p4').scheduledDate === null);
actions.scheduleTask('nope', '2026-11-05');
t('scheduling an unknown task is a no-op', getState().tasks.length === 8);
actions.toggleTaskDone('p1');
t('toggleTaskDone completes', getState().tasks.find(x => x.id === 'p1').status === 'done' && !!getState().tasks.find(x => x.id === 'p1').completedAt);
actions.toggleTaskDone('p1');
t('toggleTaskDone reopens', getState().tasks.find(x => x.id === 'p1').status === 'todo' && getState().tasks.find(x => x.id === 'p1').completedAt === null);

// Carry over (uses the real clock for "today")
const realToday = getLocalDateString(new Date());
const yday = addDaysStr(realToday, -1);
actions.carryOverTask('p7', 'none');
t('carry over -> unschedule', getState().tasks.find(x => x.id === 'p7').scheduledDate === null);
actions.scheduleTask('p7', yday);
actions.carryOverTask('p7', 'today');
t('carry over -> today', getState().tasks.find(x => x.id === 'p7').scheduledDate === realToday);
actions.scheduleTask('p7', yday);
getState().tasks.push(mk({ id: 'p9', status: 'todo', scheduledDate: addDaysStr(realToday, -3) }));
const expectedMoved = selectors.getCarryOverTasks(realToday).length;   // independent of the real date
t('carryOverAll moves every overdue task', expectedMoved >= 2 && actions.carryOverAll() === expectedMoved && getState().tasks.find(x => x.id === 'p9').scheduledDate === realToday && getState().tasks.find(x => x.id === 'p7').scheduledDate === realToday && selectors.getCarryOverTasks(realToday).length === 0);
t('carryOverAll with nothing overdue', actions.carryOverAll() === 0);

// Intentions
actions.setDayIntention('2026-11-03', 'Ship the report');
actions.setDayIntention('2026-11-03', 'Ship the report v2');
t('intention upserts one row per date', getState().dayIntentions.filter(d => d.date === '2026-11-03').length === 1 && selectors.getDayIntention('2026-11-03') === 'Ship the report v2');
t('intention for an empty day is blank', selectors.getDayIntention('2026-11-04') === '');
actions.setDayIntention('2026-11-05', 'x'.repeat(500));
t('intention is capped at 200 characters', selectors.getDayIntention('2026-11-05').length === 200);

// Week navigation
actions.setPlannerWeek('2026-11-04');
t('setPlannerWeek stores the Monday', getState().ui.plannerWeek === '2026-11-02');
actions.shiftPlannerWeek(1);
t('next week', getState().ui.plannerWeek === '2026-11-09');
actions.shiftPlannerWeek(-2);
t('two weeks back', getState().ui.plannerWeek === '2026-10-26');

// Weekly habit matrix (default habit h-1 is Mon-Fri). Viewing week of 2 Nov with "today" = Wed 4 Nov.
actions.toggleHabit('h-1', '2026-11-02');
let row = selectors.getWeekHabitMatrix('2026-11-02', getState(), '2026-11-04')[0];
t('matrix: cells for the week', row.cells.length === 7 && row.cells[0].done && row.cells[0].due && !row.cells[5].due && row.cells[3].future && !row.cells[2].future);
t('matrix: rate counts scheduled days up to today only', row.dueCount === 3 && row.doneCount === 1 && row.rate === 33);
actions.toggleHabit('h-1', '2026-11-03');
row = selectors.getWeekHabitMatrix('2026-11-02', getState(), '2026-11-04')[0];
t('matrix: rate updates', row.rate === 67 && row.streak === 2);
t('matrix: future week has no rate yet', selectors.getWeekHabitMatrix('2026-11-09', getState(), '2026-11-04')[0].rate === null);
t('matrix: deleted habits are not shown', (() => { actions.deleteHabit('h-1'); const n = selectors.getWeekHabitMatrix('2026-11-02', getState(), '2026-11-04').length; actions.restoreHabit('h-1'); return n === 0; })());


// ============================================================================
// M4: JOURNAL
// ============================================================================
t('normalizeNoteLine strips bullets, arrows, case and spacing', normalizeNoteLine('  • Ship   the REPORT ') === 'ship the report' && normalizeNoteLine('→ - done') === 'done' && normalizeNoteLine('[x] Call mum') === 'call mum' && normalizeNoteLine('2) Plan') === 'plan' && normalizeNoteLine(null) === '');
const parsed = parseNoteLines('- Email Sam\n\n  * Book flights  \n1. Pay rent\n[ ] Water plants\n→ already sent\n   \nPlain line');
t('parseNoteLines: titles cleaned, blanks and sent lines skipped', parsed.map(l => l.title).join('|') === 'Email Sam|Book flights|Pay rent|Water plants|Plain line');
t('parseNoteLines keeps original line numbers', parsed.map(l => l.lineIndex).join() === '0,2,3,4,7');
t('parseNoteLines caps title length', parseNoteLines('x'.repeat(300))[0].title.length === 140);
t('parseNoteLines on empty input', parseNoteLines('').length === 0 && parseNoteLines(null).length === 0);
t('markLinesSent marks only the chosen lines, once', markLinesSent('a\nb\n\nc', [0, 3]) === '→ a\nb\n\n→ c' && markLinesSent('→ a\nb', [0, 1]) === '→ a\n→ b');
t('a sent bullet still matches its task title when deduplicating', normalizeNoteLine('→ • Review PR') === 'review pr');
t('marked lines are not offered again', parseNoteLines(markLinesSent('a\nb', [0])).map(l => l.title).join() === 'b');

localStorage.removeItem(STORAGE_KEY); initState();
const J1 = '2026-11-03', J0 = '2026-11-02', JM1 = '2026-11-01';
actions.setJournalText(J1, 'wins', '   ');
t('blank text does not create an entry', !selectors.getJournalEntry(J1));
actions.setJournalText(J1, 'wins', 'Shipped the planner');
t('typing creates the entry', !!selectors.getJournalEntry(J1) && selectors.getJournalEntry(J1).wins === 'Shipped the planner' && selectors.getJournalEntry(J1).id === 'j-2026-11-03');
actions.setJournalText(J1, 'bogus', 'x');
t('unknown field ignored', selectors.getJournalEntry(J1).bogus === undefined);
actions.setJournalMood(J1, 4);
t('mood set', selectors.getJournalEntry(J1).mood === 4);
actions.setJournalMood(J1, 4);
t('same mood again clears it', selectors.getJournalEntry(J1).mood === null);
actions.setJournalMood(J1, 9);
t('out-of-range mood is stored as unset', selectors.getJournalEntry(J1).mood === null);
actions.setJournalEnergy(J1, '7');  t('energy set from a string', selectors.getJournalEntry(J1).energy === 7);
actions.setJournalEnergy(J1, 11);   t('energy above 10 rejected', selectors.getJournalEntry(J1).energy === null);
actions.setJournalEnergy(J1, 0);    t('energy below 1 rejected', selectors.getJournalEntry(J1).energy === null);
actions.setJournalEnergy(J1, 3);
actions.setJournalText(J1, 'wins', 'y'.repeat(6000));
t('text capped at 5000 characters', selectors.getJournalEntry(J1).wins.length === 5000);
actions.setJournalText(J1, 'wins', 'Shipped the planner');
t('hasJournalContent', selectors.hasJournalContent(selectors.getJournalEntry(J1)) && !selectors.hasJournalContent(null) && !selectors.hasJournalContent({ mood: null, energy: null, wins: ' ', blockers: '', notes: '' }));

// Timeline, search, streak, trend
actions.updateJournalEntry(J0, { wins: 'Fixed the login bug', mood: 5, energy: 9, tagId: 'tag-1' });
actions.updateJournalEntry(JM1, { notes: 'Rest day, long walk', mood: 3 });
actions.updateJournalEntry('2026-10-28', { blockers: 'Slow wifi' });
t('timeline is newest first', selectors.getJournalEntriesFiltered('').map(e => e.date).join() === '2026-11-03,2026-11-02,2026-11-01,2026-10-28');
t('search finds text in any box, ignoring case', selectors.getJournalEntriesFiltered('LOGIN').map(e => e.date).join() === '2026-11-02' && selectors.getJournalEntriesFiltered('wifi').length === 1 && selectors.getJournalEntriesFiltered('walk').length === 1);
t('search by tag name and by date', selectors.getJournalEntriesFiltered('deep work').length === 1 && selectors.getJournalEntriesFiltered('2026-10-28').length === 1);
t('search with no match', selectors.getJournalEntriesFiltered('zzzz').length === 0);
t('streak counts consecutive days ending today', selectors.getJournalStreak(J1) === 3);
t('streak survives an unwritten today', selectors.getJournalStreak('2026-11-04') === 3);
t('streak breaks on a gap', selectors.getJournalStreak('2026-10-29') === 1 && selectors.getJournalStreak('2026-10-31') === 0 && selectors.getJournalStreak('2026-11-10') === 0);
const trend = selectors.getJournalTrend(J1, 14);
t('trend: 14 days oldest first, nulls for unlogged days', trend.length === 14 && trend[13].date === J1 && trend[0].date === '2026-10-21' && trend[13].energy === 3 && trend[12].mood === 5 && trend[11].mood === 3 && trend[5].mood === null);
t('sparkline draws with gaps and a text summary', (() => { const svg = buildJournalSparkline(trend); return /<svg/.test(svg) && /aria-label="Last 14 days: 3 logged/.test(svg) && /Average mood 4.0 of 5/.test(svg); })());
t('sparkline handles an empty period', /No mood or energy logged/.test(buildJournalSparkline(selectors.getJournalTrend('2025-01-01', 14))));

// Date navigation
actions.setJournalDate('2999-01-01');
t('future dates clamp to today', getState().ui.journalDate === getLocalDateString(new Date()));
actions.setJournalDate('not a date');
t('invalid dates fall back to today', getState().ui.journalDate === getLocalDateString(new Date()));
actions.setJournalDate('2026-11-03'); actions.shiftJournalDate(-1);
t('previous day', getState().ui.journalDate === '2026-11-02');
actions.shiftJournalDate(-3);
t('across a month boundary', getState().ui.journalDate === '2026-10-30');
actions.shiftJournalDate(1000);
t('cannot move past today', getState().ui.journalDate === getLocalDateString(new Date()));

// Pull done tasks (completedAt falls on the selected LOCAL date)
const doneToday = new Date(2026, 10, 3, 23, 30).getTime();      // late evening still counts as the 3rd
const doneNext = new Date(2026, 10, 4, 0, 10).getTime();        // just after midnight is the 4th
getState().tasks = [
  mk({ id: 'd1', title: 'Write report', status: 'done', completedAt: doneToday }),
  mk({ id: 'd2', title: 'Review PR', status: 'done', completedAt: new Date(2026, 10, 3, 9, 0).getTime() }),
  mk({ id: 'd3', title: 'After midnight', status: 'done', completedAt: doneNext }),
  mk({ id: 'd4', title: 'Deleted one', status: 'done', completedAt: doneToday, deletedAt: 1 }),
  mk({ id: 'd5', title: 'Not done', status: 'todo', completedAt: null }),
];
t('getDoneTasksOnDate: that day only, in order finished', selectors.getDoneTasksOnDate(J1).map(x => x.id).join() === 'd2,d1');
t('midnight boundary uses local time', selectors.getDoneTasksOnDate('2026-11-04').map(x => x.id).join() === 'd3');
actions.setJournalText(J1, 'wins', '• write report');          // already listed, different case
t('pull adds only what is missing', actions.pullDoneTasks(J1) === 1 && /• Review PR/.test(selectors.getJournalEntry(J1).wins) && selectors.getJournalEntry(J1).wins.split('\n').length === 2);
t('pulling twice never duplicates', actions.pullDoneTasks(J1) === 0 && selectors.getJournalEntry(J1).wins.split('\n').length === 2);
t('pull creates the entry on a fresh day', actions.pullDoneTasks('2026-11-04') === 1 && selectors.getJournalEntry('2026-11-04').wins === '• After midnight');
t('pull with nothing completed', actions.pullDoneTasks('2026-10-01') === 0 && !selectors.getJournalEntry('2026-10-01'));

// Send note lines to Kanban
getState().tasks = [];
actions.setJournalText(J0, 'notes', '- Call the bank\n\n* Book dentist\nPlain thing\n→ already sent');
const sendLines = parseNoteLines(selectors.getJournalEntry(J0).notes);
t('three sendable lines', sendLines.length === 3);
const made = actions.sendLinesToKanban({ date: J0, source: 'notes', lines: sendLines.slice(0, 2), status: 'todo', schedule: 'tomorrow', mark: true });
t('creates one card per chosen line', made === 2 && getState().tasks.length === 2);
t('cards land in To Do, planned for the next day, 30 min', getState().tasks.every(x => x.status === 'todo' && x.scheduledDate === '2026-11-03' && x.estMin === 30 && x.priority === 'medium') && getState().tasks.map(x => x.title).join('|') === 'Call the bank|Book dentist');
t('cards remember where they came from', /From journal/.test(getState().tasks[0].desc));
t('sent lines are marked, the rest untouched', selectors.getJournalEntry(J0).notes === '→ - Call the bank\n\n→ * Book dentist\nPlain thing\n→ already sent');
t('only the unsent line remains', parseNoteLines(selectors.getJournalEntry(J0).notes).map(l => l.title).join() === 'Plain thing');
const made2 = actions.sendLinesToKanban({ date: J0, source: 'notes', lines: parseNoteLines(selectors.getJournalEntry(J0).notes), status: 'backlog', schedule: 'none', mark: false });
t('backlog with no day, no marking', made2 === 1 && getState().tasks[2].status === 'backlog' && getState().tasks[2].scheduledDate === null && selectors.getJournalEntry(J0).notes.includes('\nPlain thing'));
t('sending nothing creates nothing', actions.sendLinesToKanban({ date: J0, source: 'notes', lines: [] }) === 0 && getState().tasks.length === 3);

// Delete and undo
actions.deleteJournalEntry(J0);
t('deleted entry leaves the timeline', !selectors.getJournalEntry(J0) && !selectors.getJournalEntriesFiltered('').some(e => e.date === J0));
actions.restoreJournalEntry(J0);
t('undo brings it back with its text', !!selectors.getJournalEntry(J0) && /Plain thing/.test(selectors.getJournalEntry(J0).notes));
actions.deleteJournalEntry(J0);
actions.setJournalText(J0, 'wins', 'Fresh start');
t('writing on a deleted day starts clean', selectors.getJournalEntry(J0).wins === 'Fresh start' && selectors.getJournalEntry(J0).notes === '' && selectors.getJournalEntry(J0).mood === null);
t('one entry per date (no duplicates)', getState().journalEntries.filter(e => e.date === J0).length === 1);

// ============================================================================
// M6: IMPORT VALIDATION, CSV, SNAPSHOTS, SETTINGS, SAMPLE DATA
// ============================================================================
const bigJson = o => JSON.stringify(o);
const bad = txt => validateImportData(txt);

// ---- files that must be refused, with nothing changed ----
t('import: empty text refused', !bad('').ok && !bad('   ').ok && !bad(null).ok);
t('import: not JSON refused', !bad('{ nope').ok && /not a valid JSON/.test(bad('{ nope').errors[0]));
t('import: arrays and primitives refused', !bad('[1,2]').ok && !bad('42').ok && !bad('"hi"').ok && !bad('null').ok);
t('import: unrelated JSON refused', !bad('{"hello":"world"}').ok && /none of the data/.test(bad('{"hello":"world"}').errors[0]));
t('import: newer format refused', !bad('{"schemaVersion":99,"tasks":[]}').ok && /newer version/.test(bad('{"schemaVersion":99,"tasks":[]}').errors[0]));
t('import: a list that is not a list refused', !bad('{"tasks":"lots"}').ok && !bad('{"tasks":{"a":1}}').ok);
t('import: giant files refused before parsing', !bad('x'.repeat(10 * 1024 * 1024 + 1)).ok && /10 MB/.test(bad('x'.repeat(10 * 1024 * 1024 + 1)).errors[0]));
t('import: too many records refused', (() => { const r = bad(bigJson({ tasks: Array.from({ length: IMPORT_LIMITS.tasks + 1 }, (_, i) => ({ id: 'a' + i, title: 't' })) })); return !r.ok && /too many tasks/.test(r.errors[0]); })());
t('import: refusing leaves no state to apply', bad('{ nope').state === null && bad('{ nope').summary === null);

// ---- a good round trip ----
localStorage.removeItem(STORAGE_KEY); initState();
const sampleToday = '2026-11-03';
const S = buildSampleState(sampleToday);
const roundTrip = validateImportData(bigJson({ ...S, exportInfo: { app: 'FlowBoard Work OS', version: '0.6.0', exportedAt: '2026-11-03T10:00:00.000Z' } }));
t('import: a full export validates with no warnings', roundTrip.ok && roundTrip.warnings.length === 0 && roundTrip.errors.length === 0);
t('import: counts survive the round trip', roundTrip.summary.tasks === 10 && roundTrip.summary.habits === 3 && roundTrip.summary.journalEntries === 4 && roundTrip.summary.tags === 3 && roundTrip.summary.areas === 4);
t('import: content survives the round trip', JSON.stringify(roundTrip.state.tasks.map(x => [x.id, x.title, x.status, x.priority, x.tagIds, x.areaId, x.scheduledDate, x.estMin, x.completedAt, x.subtasks.length])) === JSON.stringify(S.tasks.map(x => [x.id, x.title, x.status, x.priority, x.tagIds, x.areaId, x.scheduledDate, x.estMin, x.completedAt, x.subtasks.length])));
t('import: export details are read, then stripped', roundTrip.info.exportedAt === '2026-11-03T10:00:00.000Z' && roundTrip.info.appVersion === '0.6.0' && !('exportInfo' in roundTrip.state));
t('import: this device keeps its own id', roundTrip.state.deviceId === getState().deviceId);
t('import: result is the current format', roundTrip.state.schemaVersion === CURRENT_SCHEMA_VERSION && !roundTrip.info.migrated);

// ---- hostile and broken records are cleaned or skipped, never trusted ----
const nasty = validateImportData(bigJson({
  schemaVersion: 3,
  tags: [{ id: 'tg', name: 'Real', color: 'neon' }, { id: 'tg', name: 'Dup' }, { id: 'bad id!', name: 'x' }, { id: 'noname', name: '   ' }, 'junk', null, 7],
  tasks: [
    { id: 'ok1', title: '<script>alert(1)</script>', desc: 5, status: 'bogus', priority: 5, estMin: '1e99', scheduledDate: '2026-13-45', tagIds: ['nope', 'tg', 'tg'], areaId: 'ghost', subtasks: 'x', completedAt: 'soon' },
    { id: 'ok1', title: 'duplicate id' },
    { id: 'x y', title: 'bad id' },
    { title: 'no id' },
    { id: 'notitle', title: '   ' },
    { id: 'done1', title: 'finished', status: 'done', completedAt: 1700000000000, estMin: -50, order: 'abc' },
    { id: 'long', title: 'T'.repeat(500), desc: 'D'.repeat(9000), subtasks: [{ text: 'a', done: 'yes' }, { text: '' }, null, { id: 's9', text: 'b', done: true }] },
    'string', 42, [], null
  ],
  focusLog: [{ id: 'f1', date: '2026-11-03', taskId: 'ghost', minutes: 25.4 }, { id: 'f2', date: 'nope', minutes: 25 }, { id: 'f3', date: '2026-11-03', minutes: 0 }, { id: 'f4', date: '2026-11-03', minutes: 99999 }],
  habits: [{ id: 'h1', title: 'Walk', targetDays: [9, 'x'] }, { id: 'h2', title: 'Read', targetDays: [0, 6], archived: 'yes' }],
  habitLog: [{ habitId: 'h1', date: '2026-11-03', done: true, updatedAt: 1 }, { habitId: 'h1', date: '2026-11-03', done: false, updatedAt: 5 }, { habitId: 'ghost', date: '2026-11-03' }, { habitId: 'h2', date: 'bad' }],
  journalEntries: [
    { date: '2026-11-03', mood: 0, energy: 11, wins: 'old', updatedAt: 1 },
    { date: '2026-11-03', mood: '4', energy: '7', wins: 'newer', tagId: 'Real', updatedAt: 9 },
    { date: '2026-02-30', wins: 'impossible date' },
    { mood: 3 }
  ],
  dayIntentions: [{ date: '2026-11-03', text: 'x'.repeat(500) }, { date: 'bad', text: 'y' }],
  settings: { theme: 'neon', compactCards: 'yes', wipLimit: 0, dailyCapacityHours: 99, capacityByWeekday: { Mon: 99, Tue: -3, Wed: 'abc', Thu: 2.5 }, timerPresets: [10, 10, 5, 5], soundEnabled: 1 },
  ui: { activeView: 'planner', journalSearch: 'leak' },
  timer: { status: 'running', startedAt: 1, presetMin: 7, linkedTaskId: 'ok1' }
}));
t('hostile file: still importable, with warnings', nasty.ok && nasty.warnings.length >= 4);
const nt = id => nasty.state.tasks.find(x => x.id === id);
t('hostile: only readable tasks are kept', nasty.state.tasks.map(x => x.id).join() === 'ok1,done1,long');
t('hostile: odd values are repaired', nt('ok1').status === 'todo' && nt('ok1').priority === 'medium' && nt('ok1').estMin === 100000 && nt('ok1').scheduledDate === null && nt('ok1').desc === '5' && nt('ok1').subtasks.length === 0 && nt('ok1').completedAt === null);
t('hostile: markup stays as plain text (escaped when shown)', nt('ok1').title === '<script>alert(1)</script>');
t('hostile: references to missing items are dropped', nt('ok1').areaId === null && JSON.stringify(nt('ok1').tagIds) === '["tg"]');
t('hostile: numbers clamped, done tasks keep their time', nt('done1').estMin === 0 && nt('done1').completedAt === 1700000000000 && nt('done1').order > 0);
t('hostile: text lengths capped', nt('long').title.length === 200 && nt('long').desc.length === 5000);
t('hostile: subtasks cleaned', nt('long').subtasks.length === 2 && nt('long').subtasks[0].done === false && nt('long').subtasks[1].id === 's9' && nt('long').subtasks[1].done === true);
t('hostile: tags de-duplicated, bad colour fixed', nasty.state.tags.length === 1 && nasty.state.tags[0].color === 'indigo' && nasty.state.tags[0].name === 'Real');
t('hostile: focus log cleaned', nasty.state.focusLog.length === 2 && nasty.state.focusLog[0].taskId === null && nasty.state.focusLog[0].minutes === 25 && nasty.state.focusLog[1].minutes === 1440);
t('hostile: habits cleaned', nasty.state.habits.length === 2 && nasty.state.habits[0].targetDays.join() === '1,2,3,4,5' && nasty.state.habits[1].targetDays.join() === '0,6' && nasty.state.habits[1].archived === false);
t('hostile: habit log keeps the newest per day and drops orphans', nasty.state.habitLog.length === 1 && nasty.state.habitLog[0].done === false);
t('hostile: journal merged per day, bad dates dropped, tag found by name', nasty.state.journalEntries.length === 1 && nasty.state.journalEntries[0].wins === 'newer' && nasty.state.journalEntries[0].mood === 4 && nasty.state.journalEntries[0].energy === 7 && nasty.state.journalEntries[0].tagId === 'tg');
t('hostile: out-of-range mood/energy become unset', (() => { const r = validateImportData(bigJson({ journalEntries: [{ date: '2026-11-03', mood: 0, energy: 11, wins: 'x' }] })); return r.state.journalEntries[0].mood === null && r.state.journalEntries[0].energy === null; })());
t('hostile: intentions capped and checked', nasty.state.dayIntentions.length === 1 && nasty.state.dayIntentions[0].text.length === 200);
t('hostile: settings repaired', nasty.state.settings.theme === 'dark' && nasty.state.settings.compactCards === false && nasty.state.settings.wipLimit === 1 && nasty.state.settings.dailyCapacityHours === 16 && nasty.state.settings.capacityByWeekday.Mon === 16 && nasty.state.settings.capacityByWeekday.Tue === 0 && nasty.state.settings.capacityByWeekday.Wed === 6 && nasty.state.settings.capacityByWeekday.Thu === 2.5 && nasty.state.settings.timerPresets.join() === '25,50,15,5' && nasty.state.settings.soundEnabled === true);
t('hostile: screen state and a running timer are not imported', nasty.state.ui.activeView === 'kanban' && nasty.state.ui.journalSearch === '' && nasty.state.timer.status === 'idle' && nasty.state.timer.linkedTaskId === null);
t('hostile: the result is safe to load as-is', JSON.stringify(migrate(JSON.parse(JSON.stringify(nasty.state)))) === JSON.stringify(nasty.state) || migrate(JSON.parse(JSON.stringify(nasty.state))).tasks.length === nasty.state.tasks.length);
t('hostile: __proto__ tricks do nothing', (() => { const r = validateImportData('{"__proto__":{"polluted":true},"tasks":[],"constructor":{"prototype":{"polluted2":true}}}'); return r.ok && ({}).polluted === undefined && ({}).polluted2 === undefined && r.state.polluted === undefined; })());
t('import: no areas in the file -> the default areas are kept', validateImportData('{"tasks":[]}').state.areas.length === 4);

// ---- an old v1 file is upgraded ----
const v1 = validateImportData(bigJson({
  theme: 'light', todayFocusMinutes: 75,
  tags: [{ id: 'tag-1', name: 'Deep Work', color: 'indigo' }],
  tasks: [{ id: 't-1', title: 'Old task', status: 'inprogress', priority: 'high', tags: ['Deep Work'], day: 'Mon', estMin: 60, subtasks: [{ id: 'st-1', text: 'Step', done: true }] }],
  habits: [{ id: 'h-1', title: 'Deep work', days: { Mon: true, Tue: false, Wed: true } }],
  journalEntries: [{ date: '2026-10-26', mood: 4, energy: 8, tag: 'Deep Work', wins: 'ok', blockers: '', notes: '' }]
}));
t('v1 file: accepted and flagged as upgraded', v1.ok && v1.info.migrated && v1.info.fileVersion === 1 && v1.state.schemaVersion === CURRENT_SCHEMA_VERSION);
t('v1 file: tag names turned into tag ids', v1.state.tasks.length === 1 && JSON.stringify(v1.state.tasks[0].tagIds) === '["tag-1"]' && v1.state.tasks[0].areaId === null);
t('v1 file: habit weekdays recovered, journal tag by name', v1.state.habits[0].targetDays.join() === '1,2,3' && v1.state.journalEntries[0].tagId === 'tag-1');
t('v1 file: warns about what cannot be carried over', v1.warnings.some(w => /[Hh]abit check-marks/.test(w)) && v1.warnings.some(w => /focus totals/.test(w)));
t('v2 file: upgraded without warnings', (() => { const r = validateImportData(bigJson({ schemaVersion: 2, tasks: [{ id: 'a', title: 'x', status: 'todo', priority: 'low', tagIds: [] }] })); return r.ok && r.info.migrated && r.state.tasks[0].areaId === null && r.warnings.length === 0; })());

// ---- CSV ----
t('csvCell: plain, commas, quotes, newlines', csvCell('plain') === 'plain' && csvCell('a,b') === '"a,b"' && csvCell('say "hi"') === '"say ""hi"""' && csvCell('line1\nline2') === '"line1\nline2"' && csvCell(null) === '' && csvCell(undefined) === '' && csvCell(42) === '42');
t('csvCell: spreadsheet formulas are neutralised', csvCell('=SUM(A1:A9)') === "'=SUM(A1:A9)" && csvCell('+1+1') === "'+1+1" && csvCell('@cmd') === "'@cmd" && csvCell('-5 degrees') === "'-5 degrees" && csvCell('\tx') === "'\tx" && csvCell('safe=1') === 'safe=1');
const parseCsv = (text) => { const rows = []; let row = [], cell = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; } else cell += c; } row.push(cell); rows.push(row); return rows; };
const csvState = buildSampleState(sampleToday);
csvState.tasks.push({ ...csvState.tasks[0], id: 'tricky', title: 'Say "hello", then\nstop', desc: '=HYPERLINK("http://x")', status: 'backlog', subtasks: [], tagIds: ['tag-1', 'tag-admin'], areaId: null });
csvState.tasks.push({ ...csvState.tasks[0], id: 'gone', title: 'deleted one', deletedAt: 5 });
const csvRows = parseCsv(buildTasksCsv(csvState));
t('csv: header and one row per live task', csvRows[0].join() === 'id,title,description,status,priority,area,tags,scheduled_date,estimated_min,logged_min,completed_at,subtasks_done,subtasks_total,created_at,updated_at' && csvRows.length === 1 + 11);
t('csv: deleted tasks left out', !csvRows.some(r => r[0] === 'gone'));
const trow = csvRows.find(r => r[0] === 'tricky');
t('csv: awkward text round-trips exactly (quotes, comma, newline)', trow[1] === 'Say "hello", then\nstop' && trow.length === 15);
t('csv: formula text is defused', trow[2] === `'=HYPERLINK("http://x")`);
t('csv: tags joined by semicolons', trow[6] === 'Deep Work; Admin');
const prow = csvRows.find(r => r[0] === 's-1');
t('csv: area, logged minutes and subtask counts', prow[5] === 'Work' && prow[9] === '50' && prow[11] === '1' && prow[12] === '3' && prow[7] === sampleToday);
t('csv: rows ordered by column then board order', csvRows.slice(1).map(r => r[3]).join() === 'backlog,backlog,backlog,todo,todo,todo,todo,inprogress,inprogress,done,done');
t('csv: done tasks carry an ISO completion time', /^\d{4}-\d{2}-\d{2}T/.test(csvRows.find(r => r[0] === 's-9')[10]));

// ---- sample data ----
const sd = buildSampleState(sampleToday);
const idSet = a => new Set(a.map(x => x.id));
t('sample: valid against its own checker with no warnings', (() => { const r = validateImportData(bigJson(sd)); return r.ok && r.warnings.length === 0 && r.summary.tasks === 10; })());
t('sample: every reference points at something real', sd.tasks.every(x => x.tagIds.every(g => idSet(sd.tags).has(g)) && (x.areaId === null || idSet(sd.areas).has(x.areaId))) && sd.focusLog.every(f => idSet(sd.tasks).has(f.taskId)) && sd.habitLog.every(l => idSet(sd.habits).has(l.habitId)) && sd.journalEntries.every(e => e.tagId === null || idSet(sd.tags).has(e.tagId)));
t('sample: has every column, finished tasks have completion times', ['backlog', 'todo', 'inprogress', 'done'].every(st => sd.tasks.some(x => x.status === st)) && sd.tasks.filter(x => x.status === 'done').every(x => x.completedAt > 0));
t('sample: planned relative to the given day', sd.tasks.find(x => x.id === 's-1').scheduledDate === sampleToday && sd.tasks.find(x => x.id === 's-9').scheduledDate === '2026-11-02' && sd.dayIntentions[0].date === sampleToday);
t('sample: journal days are consecutive-ish and in the past', sd.journalEntries.every(e => e.date < sampleToday));

// ---- snapshots ----
localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SNAPSHOT_KEY); initState();
const realToday2 = getLocalDateString(new Date());
t('snapshots: none to begin with', readSnapshots().length === 0);
const first = ensureDailySnapshot();
t('daily snapshot taken on first open', !!first && first.kind === 'daily' && first.date === realToday2 && readSnapshots().length === 1);
t('...but only once a day', ensureDailySnapshot() === null && readSnapshots().length === 1);
getState().settings.autoBackup = false; localStorage.removeItem(SNAPSHOT_KEY);
t('automatic backups can be switched off', ensureDailySnapshot() === null && readSnapshots().length === 0);
getState().settings.autoBackup = true;
getState().tasks = [mk({ id: 'k1', title: 'keep me' })];
const manual = takeSnapshot('manual');
t('manual snapshot is a safety copy with counts', manual.kind === 'safety' && manual.counts.tasks === 1 && typeof manual.data === 'string');
t('snapshots list newest first', readSnapshots()[0].id === manual.id);
const many = Array.from({ length: 9 }, (_, i) => ({ id: 'd' + i, kind: 'daily', label: 'daily', date: '2026-01-0' + (i + 1), createdAt: 1000 + i, counts: {}, data: '{}' }))
  .concat(Array.from({ length: 7 }, (_, i) => ({ id: 's' + i, kind: 'safety', label: 'manual', date: '2026-01-01', createdAt: 5000 + i, counts: {}, data: '{}' })));
writeSnapshots(many);
takeSnapshot('daily');
const afterPrune = readSnapshots();
t('pruning keeps 7 daily and 5 safety', afterPrune.filter(x => x.kind === 'daily').length === 7 && afterPrune.filter(x => x.kind === 'safety').length === 5);
t('pruning drops the oldest, keeps the newest', !afterPrune.some(x => x.id === 'd0') && !afterPrune.some(x => x.id === 's0') && afterPrune.some(x => x.id === 's6'));
t('deleteSnapshot removes just that one', deleteSnapshot('s6') && !readSnapshots().some(x => x.id === 's6') && readSnapshots().length === 11 && !deleteSnapshot('nope'));
// storage full: oldest copies are dropped until the new one fits
const realSet = localStorage.setItem;
localStorage.setItem = (k, v) => { if (k === SNAPSHOT_KEY && v.length > 3000) throw new Error('QuotaExceeded'); return realSet.call(localStorage, k, v); };
localStorage.removeItem(SNAPSHOT_KEY);
writeSnapshots(Array.from({ length: 5 }, (_, i) => ({ id: 'q' + i, kind: 'daily', label: 'daily', date: '2026-01-01', createdAt: 100 + i, counts: {}, data: 'x'.repeat(400) })));
const squeezed = takeSnapshot('manual');
t('storage full: oldest copies make room for the new one', !!squeezed && readSnapshots().some(x => x.id === squeezed.id) && readSnapshots().length < 6);
getState().tasks = Array.from({ length: 200 }, (_, i) => mk({ id: 'big' + i, title: 'T'.repeat(50) }));
t('storage full: gives up cleanly when even one copy cannot fit', takeSnapshot('manual') === null);
localStorage.setItem = realSet;
t('...and nothing was damaged', Array.isArray(readSnapshots()));

// ---- replacing everything, undo, start blank, sample data ----
localStorage.removeItem(SNAPSHOT_KEY);
const quiet = console.error; console.error = () => {};
getState().tasks = [mk({ id: 'mine1', title: 'My real task' })];
getState().settings.theme = 'light'; getState().settings.compactCards = true;
const myDevice = getState().deviceId;
const incoming = validateImportData(bigJson({ ...buildSampleState(sampleToday), settings: { theme: 'dark', wipLimit: 5 } })).state;
const undoId = actions.replaceAllData(incoming, 'import');
t('replace: data swapped, this device keeps its id', getState().tasks.length === 10 && getState().deviceId === myDevice);
t('replace: screen reset to Settings, timer idle', getState().ui.activeView === 'settings' && getState().timer.status === 'idle');
t('replace: written to storage', JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks.length === 10);
t('replace: safety copy of the old data was kept', readSnapshots().some(x => x.id === undoId && x.label === 'before-import' && x.counts.tasks === 1));
t('undo: restoring that copy brings the old data back', actions.restoreSnapshot(undoId) && getState().tasks.length === 1 && getState().tasks[0].title === 'My real task' && getState().settings.theme === 'light');
t('undo: ...and keeps a copy of what was undone', readSnapshots().some(x => x.label === 'before-restore' && x.counts.tasks === 10));
t('restore: unknown copy handled', actions.restoreSnapshot('nope') === false);

const blankSettingsBefore = JSON.stringify(getState().settings);
t('start blank: works', actions.startBlank() === true);
t('start blank: content gone, settings and device kept', getState().tasks.length === 0 && getState().journalEntries.length === 0 && JSON.stringify(getState().settings) === blankSettingsBefore && getState().deviceId === myDevice);
t('start blank: undo copy holds the old task', readSnapshots().some(x => x.label === 'before-reset' && x.counts.tasks === 1) && actions.restoreSnapshot(readSnapshots().find(x => x.label === 'before-reset').id) && getState().tasks[0].title === 'My real task');
t('sample data: loads, keeps your settings', actions.loadSampleData() === true && getState().tasks.length === 10 && getState().settings.theme === 'light' && readSnapshots().some(x => x.label === 'before-sample'));
actions.restoreSnapshot(readSnapshots().find(x => x.label === 'before-sample').id);

// writing fails (storage full): nothing is replaced
const heldState = getState();
const realSet2 = localStorage.setItem;
localStorage.setItem = (k, v) => { if (k === STORAGE_KEY) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); return realSet2.call(localStorage, k, v); };
t('replace: a failed write puts everything back', actions.replaceAllData(validateImportData(bigJson(buildSampleState(sampleToday))).state, 'import') === null && getState() === heldState);
localStorage.setItem = realSet2;
console.error = quiet;

// ---- settings ----
t('setSetting: switches', actions.setSetting('compactCards', false) && getState().settings.compactCards === false && actions.setSetting('soundEnabled', false) && getState().settings.soundEnabled === false && actions.setSetting('autoBackup', false) && getState().settings.autoBackup === false);
actions.setSetting('soundEnabled', true); actions.setSetting('autoBackup', true);
t('setSetting: WIP limit accepts 1 to 50', actions.setSetting('wipLimit', '4') && getState().settings.wipLimit === 4 && actions.setSetting('wipLimit', 50) && getState().settings.wipLimit === 50);
t('setSetting: WIP limit rejects nonsense', actions.setSetting('wipLimit', 0) === false && actions.setSetting('wipLimit', 51) === false && actions.setSetting('wipLimit', 'abc') === false && actions.setSetting('wipLimit', '') === false && getState().settings.wipLimit === 50);
t('setSetting: unknown keys cannot be written', actions.setSetting('deviceId', 'x') === false && actions.setSetting('__proto__', 1) === false && actions.setSetting('hasOwnProperty', 1) === false);
actions.setSetting('wipLimit', 3);

t('timer lengths: default slots', getTimerPresetList().join() === '25,50,15,5' && getTimerPresetMeta(25).label === 'Focus' && getTimerPresetMeta(15).label === 'Sprint' && getTimerModeForPreset(5) === 'break');
t('timer lengths: valid change saved', actions.setTimerPresets([30, 60, 20, 10]) && getState().settings.timerPresets.join() === '30,60,20,10');
t('timer lengths: the last slot is the break', getTimerModeForPreset(10) === 'break' && getTimerModeForPreset(30) === 'focus' && getTimerModeForPreset(5) === 'focus' && getTimerPresetMeta(60).label === 'Deep work' && getTimerPresetMeta(10).label === 'Break');
t('timer lengths: idle timer moves to a valid length', getState().timer.presetMin === 30 && getState().timer.mode === 'focus');
t('timer lengths: rejects duplicates, decimals, zero, huge, wrong count', actions.setTimerPresets([25, 25, 15, 5]) === false && actions.setTimerPresets([25, 50, 15.5, 5]) === false && actions.setTimerPresets([0, 50, 15, 5]) === false && actions.setTimerPresets([25, 50, 15, 601]) === false && actions.setTimerPresets([25, 50, 15]) === false && actions.setTimerPresets(null) === false && getState().settings.timerPresets.join() === '30,60,20,10');
timerService.setPreset(10); timerService.start();
t('timer: the new break length behaves as a break', getState().timer.mode === 'break' && getState().timer.status === 'running');
actions.setTimerPresets([40, 70, 25, 12]);
t('timer lengths: a running session is never disturbed', getState().timer.presetMin === 10 && getState().timer.mode === 'break' && getState().timer.status === 'running');
timerService.reset();
t('timer lengths: after reset the next session uses the new lengths', (() => { actions.setTimerPresets([40, 70, 25, 12]); return getState().timer.presetMin === 40; })());
actions.setTimerPresets([25, 50, 15, 5]);

// ============================================================================
// M7: FIRST-RUN WELCOME, FOCUS HELPERS, POLISH
// ============================================================================
localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SNAPSHOT_KEY); initState();
t('first run: a brand-new browser is not onboarded yet', getState().meta.onboarded === false);
t('first run: that is remembered across a reload', JSON.parse(localStorage.getItem(STORAGE_KEY)).meta.onboarded === false && (initState(), getState().meta.onboarded === false));
const defaultHabitTitle = getState().habits[0].title;
t('skip: marks onboarded and changes nothing else', actions.completeOnboarding({ skipped: true }) === true && getState().meta.onboarded === true && getState().habits.length === 1 && getState().habits[0].title === defaultHabitTitle && getState().tasks.length === 0);
t('skip: the welcome never comes back', (initState(), getState().meta.onboarded === true));

localStorage.removeItem(STORAGE_KEY); initState();
const obDevice = getState().deviceId;
getState().settings.theme = 'light';
t('welcome, blank start: saved', actions.completeOnboarding({ start: 'blank', weekdayHours: '5', saturdayHours: 0, sundayHours: '', habitTitle: '  Stretch  ', habitDays: [1, 3, 5, 9] }) === true);
t('blank start: empty board, onboarded, same device, theme kept', getState().tasks.length === 0 && getState().meta.onboarded === true && getState().deviceId === obDevice && getState().settings.theme === 'light');
t('blank start: hours applied to weekdays and weekend', DAY_KEYS.slice(0, 5).every(k => getState().settings.capacityByWeekday[k] === 5) && getState().settings.capacityByWeekday.Sat === 0 && getState().settings.capacityByWeekday.Sun === 0 && getState().settings.dailyCapacityHours === 5);
t('blank start: the one habit is yours, cleaned up', getState().habits.length === 1 && getState().habits[0].title === 'Stretch' && getState().habits[0].targetDays.join() === '1,3,5');
t('blank start: written to storage', JSON.parse(localStorage.getItem(STORAGE_KEY)).meta.onboarded === true && JSON.parse(localStorage.getItem(STORAGE_KEY)).habits[0].title === 'Stretch');
t('blank start: the planner uses the new hours', selectors.getDayLoad('2026-11-03').capacityMin === 300);

localStorage.removeItem(STORAGE_KEY); initState();
actions.completeOnboarding({ start: 'blank', weekdayHours: 99, saturdayHours: -1, sundayHours: 'abc', habitTitle: '   ' });
t('welcome: bad hours fall back to the defaults', getState().settings.capacityByWeekday.Mon === 6 && getState().settings.capacityByWeekday.Sat === 2 && getState().settings.capacityByWeekday.Sun === 0);
t('welcome: no habit name means no habit', getState().habits.length === 0 && selectors.getHabitsDueOn('2026-11-03').length === 0);
actions.completeOnboarding({ start: 'blank', weekdayHours: 7.3 });
t('welcome: hours round to 15 minutes', getState().settings.capacityByWeekday.Mon === 7.25);

localStorage.removeItem(STORAGE_KEY); initState();
actions.completeOnboarding({ start: 'sample', weekdayHours: 4, saturdayHours: 1, sundayHours: 0, habitTitle: 'Stretch', habitDays: [0, 6] });
t('sample start: example workspace loaded and onboarded', getState().tasks.length === 10 && getState().journalEntries.length === 4 && getState().meta.onboarded === true);
t('sample start: your habit is added to the examples', getState().habits.length === 4 && getState().habits[3].title === 'Stretch' && getState().habits[3].targetDays.join() === '0,6');
t('sample start: hours applied', getState().settings.capacityByWeekday.Wed === 4 && getState().settings.capacityByWeekday.Sat === 1);
t('sample start: the result passes the import checker', (() => { const r = validateImportData(JSON.stringify(getState())); return r.ok && r.warnings.length === 0 && r.summary.habits === 4; })());
localStorage.removeItem(STORAGE_KEY); initState();
actions.completeOnboarding({ start: 'sample', habitTitle: 'read 20 PAGES' });
t('sample start: a habit that already exists is not duplicated', getState().habits.length === 3);

// storage refuses the write: stay on the untouched workspace
localStorage.removeItem(STORAGE_KEY); initState();
const obHeld = getState();
const obQuiet = console.error; console.error = () => {};
const obSet = localStorage.setItem;
localStorage.setItem = (k, v) => { if (k === STORAGE_KEY) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); return obSet.call(localStorage, k, v); };
t('welcome: a failed save changes nothing', actions.completeOnboarding({ start: 'sample' }) === false && getState() === obHeld && getState().meta.onboarded === false);
localStorage.setItem = obSet; console.error = obQuiet;

// existing users never see the welcome
t('existing data without the flag counts as onboarded', migrate({ schemaVersion: 3, tasks: [], meta: { lastBackupAt: 5 } }).meta.onboarded === true && migrate({ schemaVersion: 2, tasks: [] }).meta.onboarded === true);
t('imported backups count as onboarded', validateImportData('{"tasks":[],"meta":{"onboarded":false}}').state.meta.onboarded === true);
actions.completeOnboarding({ skipped: true });
t('Start blank and sample data do not bring the welcome back', (actions.startBlank(), getState().meta.onboarded === true) && (actions.loadSampleData(), getState().meta.onboarded === true));

// Board: 'Clear filters' also clears a quick view, and the board knows when cards are hidden
actions.applyKanbanSavedView('today');
t('isKanbanFiltering: a quick view hides cards', selectors.isKanbanFiltering() === true);
actions.clearKanbanFilters();
t('Clear filters also clears the quick view', getState().ui.kanbanSavedView === null && selectors.countActiveKanbanFilters() === 0 && selectors.isKanbanFiltering() === false);
actions.setSearchQuery('zzz'); t('isKanbanFiltering: search', selectors.isKanbanFiltering()); actions.setSearchQuery('   '); t('isKanbanFiltering: blank search does not count', !selectors.isKanbanFiltering());
actions.setActiveTagFilter('tag-1'); t('isKanbanFiltering: tag', selectors.isKanbanFiltering()); actions.clearKanbanFilters();
actions.setKanbanGroupBy('area'); actions.setKanbanSortBy('priority');
t('isKanbanFiltering: Group and Sort hide nothing', !selectors.isKanbanFiltering());
actions.clearKanbanFilters();
t('empty column text: filtered vs truly empty', /matches/.test(renderEmptyState({ id: 'todo', title: 'To Do' }, true)) && /clear-kanban-filters/.test(renderEmptyState({ id: 'todo', title: 'To Do' }, true)) && /No tasks in To Do/.test(renderEmptyState({ id: 'todo', title: 'To Do' })) && /quick-add-to-column/.test(renderEmptyState({ id: 'todo', title: 'To Do' })));

// Focus helpers (fake elements)
const fakeEl = (tag, attrs, id) => ({ id: id || '', tagName: tag, disabled: false, getAttribute: n => attrs[n], attributes: Object.keys(attrs).map(n => ({ name: n, value: attrs[n] })), focus() {} });
t('describeFocusTarget: by id when there is one', describeFocusTarget(fakeEl('INPUT', { 'data-x': '1' }, 'kanban-search-input')).id === 'kanban-search-input');
const fd = describeFocusTarget(fakeEl('BUTTON', { type: 'button', 'data-action': 'move-task-next', 'data-task-id': 't-1', 'class': 'x' }));
t('describeFocusTarget: by data attributes otherwise', fd.selector === 'button[data-action="move-task-next"][data-task-id="t-1"]' && fd.fallback === '[data-task-id="t-1"]');
t('describeFocusTarget: quotes in values are escaped', describeFocusTarget(fakeEl('BUTTON', { 'data-date': 'a"b' })).selector === 'button[data-date="a' + String.fromCharCode(92) + '"b"]');
t('describeFocusTarget: nothing to go on', describeFocusTarget(fakeEl('BUTTON', { 'class': 'x' })) === null && describeFocusTarget(null) === null);
const sameBtn = fakeEl('BUTTON', {}), otherBtn = fakeEl('BUTTON', {}), cardDiv = fakeEl('DIV', {});
const rootWith = (hit, all) => ({ querySelector: sel => (sel === fd.selector ? hit : null), querySelectorAll: () => all });
t('findFocusTarget: the same control after a re-draw', findFocusTarget(fd, rootWith(sameBtn, [])) === sameBtn);
t('findFocusTarget: control disabled -> another button of the same task', findFocusTarget(fd, rootWith({ ...sameBtn, disabled: true }, [cardDiv, { ...otherBtn, disabled: true }, otherBtn])) === otherBtn);
t('findFocusTarget: control gone and no sibling -> nothing', findFocusTarget(fd, rootWith(null, [cardDiv])) === null && findFocusTarget(null) === null);
t('findFocusTarget: a bad selector never throws', findFocusTarget({ selector: 'x', fallback: null }, { querySelector() { throw new Error('bad'); }, querySelectorAll() { return []; } }) === null);

// Version, changelog, shortcut list
t('the version tops the changelog', /^\d+\.\d+\.\d+$/.test(APP_VERSION) && APP_CHANGELOG[0].version === APP_VERSION && APP_CHANGELOG.every(c => c.title && Array.isArray(c.notes) && c.notes.length > 0));
t('shortcut list covers the real shortcuts', ['N', '/', 'U', '?', 'Esc'].every(k => KEYBOARD_SHORTCUTS.some(sc => sc.keys.includes(k))));
t('triggerLatestUndo: nothing to undo', triggerLatestUndo() === false);
t('offline check is safe without a browser', typeof updateOfflineIndicator() === 'boolean');

// ============================================================================
// M5: INSIGHTS (pure numbers; no chart library needed)
// ============================================================================
localStorage.removeItem(STORAGE_KEY); initState(); actions.completeOnboarding({ skipped: true });
const IT = '2026-11-04';                                   // a Wednesday
const iAt = (d, h) => { const [y, mo, da] = d.split('-').map(Number); return new Date(y, mo - 1, da, h, 0, 0).getTime(); };
let ir = insightsSelectors.getRange('this-week', IT);
t('range: this week runs Monday to today, compared with the same days last week', ir.start === '2026-11-02' && ir.end === IT && ir.prevStart === '2026-10-26' && ir.prevEnd === '2026-10-28' && ir.days === 3);
ir = insightsSelectors.getRange('last-7', IT);
t('range: last 7 days and the 7 before', ir.start === '2026-10-29' && ir.end === IT && ir.prevStart === '2026-10-22' && ir.prevEnd === '2026-10-28' && ir.days === 7);
ir = insightsSelectors.getRange('last-30', IT);
t('range: last 30 days', ir.start === '2026-10-06' && ir.days === 30 && ir.prevEnd === '2026-10-05' && ir.prevStart === '2026-09-06');
t('range: unknown key falls back to last 7 days', insightsSelectors.getRange('bogus', IT).key === 'last-7');
t('correlation helper', insightsPearson([1, 2, 3], [2, 4, 6]) > 0.999 && insightsPearson([1, 2, 3], [6, 4, 2]) < -0.999 && insightsPearson([1, 1, 1], [1, 2, 3]) === null && insightsPearson([1], [1]) === null);

getState().habits = []; getState().habitLog = [];
getState().tags = [{ id: 'ta', name: 'Alpha', color: 'indigo', deletedAt: null }, { id: 'tb', name: 'Beta', color: 'rose', deletedAt: null }];
getState().tasks = [
  mk({ id: 'i1', status: 'done', priority: 'urgent', estMin: 60, tagIds: ['ta'], completedAt: iAt('2026-11-03', 15), scheduledDate: '2026-11-03' }),
  mk({ id: 'i2', status: 'done', priority: 'low', estMin: 30, tagIds: ['ta', 'tb'], completedAt: iAt('2026-11-04', 9), scheduledDate: '2026-11-04' }),
  mk({ id: 'i3', status: 'done', priority: 'high', estMin: 45, completedAt: iAt('2026-10-27', 9) }),            // previous period
  mk({ id: 'i4', status: 'todo', priority: 'high', estMin: 30, scheduledDate: '2026-11-05' }),
  mk({ id: 'i5', status: 'inprogress', priority: 'medium', estMin: 30 }),
  mk({ id: 'i6', status: 'done', priority: 'urgent', completedAt: iAt('2026-11-03', 10), deletedAt: 1 }),      // deleted: ignored
];
const fl = (id, date, taskId, minutes) => ({ id, date, taskId, minutes, kind: 'focus', startedAt: 0, createdAt: 0, updatedAt: 0, deletedAt: null });
getState().focusLog = [fl('g1', '2026-11-03', 'i1', 50), fl('g2', '2026-11-04', 'i2', 45), fl('g3', '2026-11-04', null, 10), fl('g4', '2026-11-04', 'i5', 20), fl('g5', '2026-10-27', 'i3', 30), { ...fl('g6', '2026-11-04', 'i1', 99), deletedAt: 5 }];
const ik = insightsSelectors.getKpis('last-7', getState(), IT);
t('KPI velocity: finished in the period vs the one before', ik.velocity.count === 2 && ik.velocity.prev === 1 && ik.velocity.delta === 1 && ik.velocity.deltaPct === 100);
t('KPI focus: logged minutes, deleted sessions ignored', ik.focus.loggedMin === 125 && ik.focus.prevLoggedMin === 30 && ik.focus.deltaMin === 95 && ik.focus.estMinCompleted === 90);
t('KPI high priority: cleared in period vs still open', ik.highPriority.cleared === 1 && ik.highPriority.open === 1 && ik.highPriority.percent === 50);
t('KPI habits: no habits means no percentage', ik.habits.percent === null && ik.habits.habitCount === 0);
const ite = insightsSelectors.getTagEffort('last-7', getState(), IT);
t('tag effort: shared between tags, parts add up to the total', ite.reduce((a, x) => a + x.minutes, 0) === 125 && ite.find(x => x.key === 'ta').minutes + ite.find(x => x.key === 'tb').minutes === 95 && ite.find(x => x.key === '_unlinked').minutes === 10 && ite.find(x => x.key === '_none').minutes === 20);
t('tag effort: largest first', ite[0].key === 'ta');
const ip = insightsSelectors.getPriorityPipeline('last-7', getState(), IT);
t('pipeline: open tasks plus Done from this period only', ip.total === 4 && ip.matrix.done.urgent === 1 && ip.matrix.done.low === 1 && ip.matrix.done.high === 0 && ip.matrix.todo.high === 1 && ip.matrix.inprogress.medium === 1);
const iw = insightsSelectors.getWeeklyPlannedVsLogged(8, getState(), IT);
t('weekly: 8 weeks, oldest first, this week last', iw.length === 8 && iw[7].weekStart === '2026-11-02' && iw[7].plannedMin === 120 && iw[7].loggedMin === 125 && iw[6].loggedMin === 30 && iw[0].weekStart === '2026-09-14');
const hNow = Date.now;
getState().habits = [{ id: 'ih', title: 'Daily', targetDays: [0, 1, 2, 3, 4, 5, 6], archived: false, createdAt: iAt('2026-11-02', 8), updatedAt: 0, deletedAt: null }];
getState().habitLog = [{ id: 'x1', habitId: 'ih', date: '2026-11-02', done: true, updatedAt: 0 }, { id: 'x2', habitId: 'ih', date: '2026-11-03', done: true, updatedAt: 0 }, { id: 'x3', habitId: 'ih', date: '2026-11-04', done: false, updatedAt: 0 }];
const ihs = insightsSelectors.habitStats('2026-10-29', IT, getState(), IT);
t('habit consistency counts only days since the habit began', ihs.scheduled === 3 && ihs.done === 2 && ihs.percent === 67);
getState().settings.wipLimit = 1; getState().tasks.push(mk({ id: 'i7', status: 'inprogress', priority: 'low', scheduledDate: '2026-11-01' }));
const idg = insightsSelectors.getDiagnostics('last-7', getState(), IT);
t('diagnostics: warnings first, with WIP and overdue', idg[0].level === 'warn' && idg.some(d => d.id === 'wip') && idg.some(d => d.id === 'overdue') && idg.some(d => d.id === 'energy') && !idg.some(d => d.id === 'healthy'));
getState().tasks = []; getState().settings.wipLimit = 3;
t('diagnostics: a quiet board is called healthy', insightsSelectors.getDiagnostics('last-7', getState(), IT)[0].id === 'healthy');
t('empty workspace: every number is safe', (() => { getState().focusLog = []; getState().habits = []; const k = insightsSelectors.getKpis('last-30', getState(), IT); return k.velocity.count === 0 && k.velocity.deltaPct === null && k.focus.loggedMin === 0 && k.highPriority.percent === null && insightsSelectors.getTagEffort('last-30', getState(), IT).length === 0 && insightsSelectors.getPriorityPipeline('last-30', getState(), IT).total === 0; })());
const ith = { text: '#000', strong: '#000', grid: '#000', surface: '#fff' };
t('chart configs build without the chart library', buildTagChartConfig(ite, ith).type === 'doughnut' && buildTagChartConfig(ite, ith).data.datasets[0].data.length === ite.length && buildPipelineChartConfig(ip, ith).data.datasets.length === 4 && buildWeeklyChartConfig(iw, ith).data.labels.length === 8);
t('Insights period: saved, unknown values ignored', getState().ui.insightsRange === 'last-7' && actions.setInsightsRange('last-30') === true && getState().ui.insightsRange === 'last-30' && actions.setInsightsRange('forever') === false && getState().ui.insightsRange === 'last-30');
t('Insights tables switch', getState().ui.insightsTables === false && actions.toggleInsightsTables() === true && actions.toggleInsightsTables() === false);
t('older saved data gets the Insights defaults', migrate({ schemaVersion: 3, tasks: [], ui: { activeView: 'insights' } }).ui.insightsRange === 'last-7');

// ============================================================================
// M8: DATE EDGES, v1 MIGRATION, ERROR PANEL, LARGE DATA
// ============================================================================
// ---- dates: week start, midnight, month, year and leap boundaries ----
t('week start: every day of a week maps to its Monday', ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].every(d => getWeekMonday(d) === '2026-11-02'));
t('week start: Sunday belongs to the week that began six days earlier', getWeekMonday('2026-11-01') === '2026-10-26' && getWeekMonday('2026-11-09') === '2026-11-09');
t('week start: across a year boundary', getWeekMonday('2027-01-01') === '2026-12-28' && getWeekMonday('2026-12-31') === '2026-12-28' && getWeekMonday('2027-01-03') === '2026-12-28' && getWeekMonday('2027-01-04') === '2027-01-04');
t('week start: across a leap day', getWeekMonday('2028-02-29') === '2028-02-28' && getWeekMonday('2028-03-01') === '2028-02-28');
t('week start: accepts a Date as well as text', getWeekMonday(new Date(2026, 10, 5, 23, 59, 59)) === '2026-11-02' && getWeekMonday(new Date(2026, 10, 2, 0, 0, 0)) === '2026-11-02');
t('week start: clock-change weekends (US and EU dates)', getWeekMonday('2026-03-08') === '2026-03-02' && getWeekMonday('2026-03-09') === '2026-03-09' && getWeekMonday('2026-03-29') === '2026-03-23' && getWeekMonday('2026-10-25') === '2026-10-19' && getWeekMonday('2026-11-01') === '2026-10-26');
t('local date: one second before and after midnight', getLocalDateString(new Date(2026, 11, 31, 23, 59, 59)) === '2026-12-31' && getLocalDateString(new Date(2027, 0, 1, 0, 0, 0)) === '2027-01-01' && getLocalDateString(new Date(2026, 1, 28, 23, 59, 59)) === '2026-02-28' && getLocalDateString(new Date(2026, 2, 1, 0, 0, 1)) === '2026-03-01');
t('local date: text and back is lossless for a whole leap year', (() => { let d = '2028-01-01'; for (let i = 0; i < 366; i++) { if (getLocalDateString(parseLocalDate(d)) !== d) return false; d = addDaysStr(d, 1); } return d === '2029-01-01'; })());
t('local date: every step of a year is exactly one day (no skipped or repeated day at clock changes)', (() => { let d = '2026-01-01'; const seen = new Set(); for (let i = 0; i < 365; i++) { seen.add(d); const n = addDaysStr(d, 1); if (n <= d || addDaysStr(n, -1) !== d) return false; d = n; } return seen.size === 365 && d === '2027-01-01'; })());
t('local date: bad input never throws', /^\d{4}-\d{2}-\d{2}$/.test(getLocalDateString('nonsense')) && parseLocalDate('nope') instanceof Date && parseLocalDate(null) instanceof Date && parseLocalDate('2026-13') instanceof Date);
t('weekday keys across month ends', getDayKey('2026-11-30') === 'Mon' && getDayKey('2026-12-01') === 'Tue' && getDayKey('2028-02-29') === 'Tue' && getDayKey('2027-01-01') === 'Fri');
t('week dates across a year end', (() => { const w = selectors.getWeekDates('2026-12-31'); return w[0].date === '2026-12-28' && w[3].date === '2026-12-31' && w[4].date === '2027-01-01' && w[6].date === '2027-01-03'; })());
t('insights period across a year end', (() => { const r = insightsSelectors.getRange('last-7', '2027-01-02'); return r.start === '2026-12-27' && r.prevStart === '2026-12-20' && r.prevEnd === '2026-12-26'; })());

// ---- a task finished just before midnight counts for that day, everywhere ----
localStorage.removeItem(STORAGE_KEY); initState(); actions.completeOnboarding({ skipped: true });
getState().habits = []; getState().habitLog = [];
getState().tasks = [
  mk({ id: 'n1', status: 'done', priority: 'high', completedAt: new Date(2026, 11, 31, 23, 59, 59).getTime() }),
  mk({ id: 'n2', status: 'done', priority: 'high', completedAt: new Date(2027, 0, 1, 0, 0, 1).getTime() })
];
t('midnight: journal pull and insights agree on the day', selectors.getDoneTasksOnDate('2026-12-31').map(x => x.id).join() === 'n1' && selectors.getDoneTasksOnDate('2027-01-01').map(x => x.id).join() === 'n2' && insightsSelectors.completedIn('2026-12-31', '2026-12-31').length === 1 && insightsSelectors.completedIn('2027-01-01', '2027-01-07').length === 1);

// ---- streak across a month and year end ----
const hY = actions.addHabit({ title: 'Year end', targetDays: [0, 1, 2, 3, 4, 5, 6] });
['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'].forEach(d => actions.toggleHabit(hY.id, d));
t('habit streak runs across the year end', selectors.getHabitStreak(hY.id, getState(), '2027-01-02') === 4 && selectors.getHabitStreak(hY.id, getState(), '2027-01-03') === 4 && selectors.getHabitStreak(hY.id, getState(), '2027-01-04') === 0);

// ---- v1 -> v2 -> v3 migration, step by step ----
const v1raw = {
  settings: { dailyCapacityHours: 5 },
  tags: [{ id: 'tag-1', name: 'Deep Work', color: 'indigo' }],
  tasks: [
    { id: 'o1', title: 'Old open', status: 'todo', priority: 'high', day: 'Mon', tags: ['tag-1'] },
    { id: 'o2', title: 'Old done', status: 'done', priority: 'low' },
    { id: 'o3', title: 'No day', status: 'backlog', priority: 'medium', subtasks: 'broken' }
  ]
};
const v1m = migrate(JSON.parse(JSON.stringify(v1raw)));
t('v1 migration: reaches the current format with every list present', v1m.schemaVersion === CURRENT_SCHEMA_VERSION && ['tags', 'tasks', 'focusLog', 'dayIntentions', 'habits', 'habitLog', 'journalEntries', 'areas'].every(k => Array.isArray(v1m[k])));
t('v1 migration: weekday capacity built from the old single number', v1m.settings.capacityByWeekday.Mon === 5 && v1m.settings.capacityByWeekday.Fri === 5 && v1m.settings.capacityByWeekday.Sat === 2 && v1m.settings.capacityByWeekday.Sun === 0 && v1m.settings.wipLimit === 3 && v1m.settings.timerPresets.join() === '25,50,15,5');
t('v1 migration: a task with a weekday gets a real date, one without stays unscheduled', /^\d{4}-\d{2}-\d{2}$/.test(v1m.tasks[0].scheduledDate) && v1m.tasks[2].scheduledDate === null);
t('v1 migration: done tasks get a completion time, open ones do not', v1m.tasks[1].completedAt > 0 && v1m.tasks[0].completedAt === null);
t('v1 migration: tags carried over, broken subtasks repaired, area added', v1m.tasks[0].tagIds.join() === 'tag-1' && Array.isArray(v1m.tasks[2].subtasks) && v1m.tasks[2].subtasks.length === 0 && v1m.tasks.every(x => x.areaId === null) && v1m.areas.length === 4);
t('v1 migration: device id, timer, screen state and meta filled in', typeof v1m.deviceId === 'string' && v1m.timer.status === 'idle' && v1m.ui.kanbanGroupBy === 'none' && v1m.ui.insightsRange === 'last-7' && v1m.meta.onboarded === true);
t('migration: running it twice changes nothing more', JSON.stringify(migrate(JSON.parse(JSON.stringify(v1m)))) === JSON.stringify(v1m));
t('migration: nonsense input gives a clean workspace', migrate(null).schemaVersion === CURRENT_SCHEMA_VERSION && migrate('text').tasks.length === 0 && migrate(42).schemaVersion === CURRENT_SCHEMA_VERSION);
t('migration: a current file is left as it is', (() => { const cur = buildSampleState('2026-11-03'); const out = migrate(JSON.parse(JSON.stringify(cur))); return out.tasks.length === 10 && out.schemaVersion === 3 && out.habits.length === 3; })());

// ---- error panel ----
const errHtml = buildViewErrorHtml('planner', new Error('<img src=x onerror=alert(1)> boom'));
t('error panel: names the screen and offers ways out', /Weekly planner could not be shown/.test(errHtml) && /data-action="retry-view"/.test(errHtml) && /data-action="download-json-backup"/.test(errHtml) && /data-view="kanban"/.test(errHtml) && /role="alert"/.test(errHtml));
t('error panel: the error text is escaped', !/<img/.test(errHtml) && /&lt;img/.test(errHtml));
t('error panel: on the board the way out is Settings', /data-view="settings"/.test(buildViewErrorHtml('kanban', new Error('x'))));
t('error panel: odd inputs are safe', /could not be shown/.test(buildViewErrorHtml('nope', null)) && /could not be shown/.test(buildViewErrorHtml(undefined, 'plain text')) && buildViewErrorHtml('journal', new Error('z'.repeat(5000))).length < 3500);
const errQuiet = console.error; console.error = () => {};
const realPlanner = VIEW_RENDERERS.planner;
VIEW_RENDERERS.planner = () => { throw new Error('planner broke'); };
const fakeMain = { innerHTML: 'old', textContent: '' };
t('error boundary: a failing screen shows the panel and does not throw', renderViewSafely(fakeMain, 'planner') === false && /could not be shown/.test(fakeMain.innerHTML) && /planner broke/.test(fakeMain.innerHTML));
const stateBeforeErr = JSON.stringify(getState());
renderViewSafely(fakeMain, 'planner');
t('error boundary: nothing in the data changes', JSON.stringify(getState()) === stateBeforeErr);
VIEW_RENDERERS.planner = realPlanner;
t('error boundary: a healthy screen draws normally', (() => { const c = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null }; return renderViewSafely(c, 'settings') === true && /Settings/.test(c.innerHTML) && renderViewSafely(c, 'unknown-view') === true; })());
const realTimerBar = renderTimerBar, realStrip = renderHabitStrip;
renderTimerBar = () => { throw new Error('timer bar broke'); };
renderHabitStrip = () => { throw new Error('strip broke'); };
t('error boundary: a broken header piece never stops an action', (() => { try { actions.addTask({ title: 'Still saved' }); return getState().tasks.some(x => x.title === 'Still saved'); } catch (e) { return false; } })());
renderTimerBar = realTimerBar; renderHabitStrip = realStrip;
console.error = errQuiet;

// ---- every screen draws, with empty data and with sample data ----
const drawAll = () => Object.keys(VIEW_RENDERERS).every(v => { const c = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null }; return renderViewSafely(c, v) === true && c.innerHTML.length > 200; });
localStorage.removeItem(STORAGE_KEY); initState(); actions.completeOnboarding({ start: 'blank' });
t('every screen draws on an empty workspace', drawAll());
actions.loadSampleData();
t('every screen draws with sample data', drawAll());
getState().tasks.push({ id: 'odd', title: 'Odd task', status: 'todo', priority: 'medium' });   // a task missing most fields
t('every screen draws when a task is missing optional fields', drawAll());

// ---- long lists are shortened, never lost ----
const manyTasks = Array.from({ length: 75 }, (_, i) => mk({ id: 'lt' + i, status: 'todo', priority: 'medium', order: (i + 1) * 1000 }));
kanbanShowAllCards = {};
t('long column: first cards shown, the rest counted', limitKanbanCards(manyTasks, 'todo').shown.length === KANBAN_CARD_LIMIT && limitKanbanCards(manyTasks, 'todo').hidden === 75 - KANBAN_CARD_LIMIT && limitKanbanCards(manyTasks, 'todo').shown[0].id === 'lt0');
t('short column: untouched', limitKanbanCards(manyTasks.slice(0, KANBAN_CARD_LIMIT), 'todo').hidden === 0 && limitKanbanCards([], 'todo').shown.length === 0);
t('grouped board uses the smaller group limit', limitKanbanCards(manyTasks, 'todo__g', KANBAN_GROUP_CARD_LIMIT).shown.length === KANBAN_GROUP_CARD_LIMIT);
t('Show more button says how many', /Show 45 more/.test(renderKanbanShowMore('todo', 45, 75)) && /kanban-show-more/.test(renderKanbanShowMore('todo', 45, 75)) && renderKanbanShowMore('todo', 0, 20) === '');
kanbanShowAllCards.todo = true;
t('after Show more: everything is shown, with a way back', limitKanbanCards(manyTasks, 'todo').shown.length === 75 && limitKanbanCards(manyTasks, 'todo').hidden === 0 && /kanban-show-fewer/.test(renderKanbanShowMore('todo', 0, 75)));
kanbanShowAllCards = {};
localStorage.removeItem(STORAGE_KEY); initState(); actions.completeOnboarding({ start: 'blank' });
getState().tasks = manyTasks;
t('board with a long column: counter shows the full number, cards are limited', (() => { const c = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null }; renderViewSafely(c, 'kanban'); return (c.innerHTML.match(/class="task-card/g) || []).length === KANBAN_CARD_LIMIT && />75</.test(c.innerHTML) && /Show 45 more/.test(c.innerHTML); })());
t('search still finds a card that was held back', (() => { actions.setSearchQuery('lt74'); const c = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null }; renderViewSafely(c, 'kanban'); actions.setSearchQuery(''); return /data-task-id="lt74"/.test(c.innerHTML); })());
plannerTrayShowAll = false;
t('planner tray: shortened with a Show all button', (() => { const c = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null }; renderViewSafely(c, 'planner'); return (c.innerHTML.match(/data-action="planner-unschedule"/g) || []).length === 0 && (c.innerHTML.match(/data-planner-task=/g) || []).length === PLANNER_TRAY_LIMIT && /Show all 75/.test(c.innerHTML) && />75</.test(c.innerHTML); })());

const summary = 'Passed ' + pass + ', failed ' + fail;
if (typeof window !== 'undefined' && typeof window.__flowboardTestsDone === 'function') window.__flowboardTestsDone(pass, fail, failures);
else console.log(summary);
if (typeof process !== 'undefined' && process.versions && process.versions.node) process.exitCode = fail ? 1 : 0;
}
