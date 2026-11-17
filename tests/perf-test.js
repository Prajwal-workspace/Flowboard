// Speed check with a large workspace.  Run from the project root:  node tests/perf-test.js
// 1,000 tasks, 365 journal days, 5,000 focus sessions. Target: every step under 100 ms.
// This measures the app's own work (reading the data and building each screen). Drawing on
// screen is extra and is measured in a real browser; see Progress.md for those numbers.
const fs = require('fs'), path = require('path');
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, addEventListener() {}, appendChild() {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null, innerHTML: '', style: {} });
global.document = { readyState: 'complete', getElementById: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
global.window = global; global.matchMedia = () => ({ matches: true, addEventListener() {} });
global.requestAnimationFrame = f => f(); global.Blob = class {}; global.URL = {};
global.FLOWBOARD_NO_BOOT = true;
const order = ['00-utils','01-storage','02-state','03-timer','04-view-kanban','05-view-planner','06-view-journal','07-view-insights','08-view-settings','09-sync','10-app'];
const read = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const src = order.map(f => read('..', 'src', f + '.js')).join('\n');
new Function('performance', src + '\n' + read('stress-data.js') + `
const LIMIT = 100;
initState();
const big = buildStressState();
Object.assign(getState(), big);
const s = getState();
console.log('Workspace: ' + s.tasks.length + ' tasks, ' + s.journalEntries.length + ' journal days, ' + s.focusLog.length + ' focus sessions, ' + s.habitLog.length + ' habit check-ins');
const rows = [];
const time = (name, fn, runs = 5) => {
  fn();                                             // warm up once
  const samples = [];
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); fn(); samples.push(performance.now() - t0); }
  samples.sort((a, b) => a - b);
  rows.push({ name, ms: samples[Math.floor(samples.length / 2)] });
};
const box = () => ({ innerHTML: '', querySelectorAll: () => [], querySelector: () => null });
const today = getLocalDateString(new Date());
Object.keys(VIEW_RENDERERS).forEach(v => time('Build the ' + v + ' screen', () => { if (!renderViewSafely(box(), v)) throw new Error(v + ' failed to render'); }));
time('Board: search', () => { s.ui.searchQuery = 'report'; renderViewSafely(box(), 'kanban'); s.ui.searchQuery = ''; });
time('Board: group by area, sort by priority', () => { s.ui.kanbanGroupBy = 'area'; s.ui.kanbanSortBy = 'priority'; renderViewSafely(box(), 'kanban'); s.ui.kanbanGroupBy = 'none'; s.ui.kanbanSortBy = 'manual'; });
time('Board: show older done tasks', () => { s.ui.showOlderDone = true; renderViewSafely(box(), 'kanban'); s.ui.showOlderDone = false; });
time('Insights: last 30 days', () => { s.ui.insightsRange = 'last-30'; renderViewSafely(box(), 'insights'); s.ui.insightsRange = 'last-7'; });
time('Journal: search the timeline', () => selectors.getJournalEntriesFiltered('report', s));
time('Habit streaks (all habits)', () => s.habits.forEach(h => selectors.getHabitStreak(h.id, s, today)));
time('Timer task list', () => buildTaskOptionsHtml(s));
time('Save to storage', () => saveStateImmediate(s));
time('Check a backup file of this size', () => { if (!validateImportData(JSON.stringify(s)).ok) throw new Error('import check failed'); }, 3);
time('Export tasks as CSV', () => buildTasksCsv(s));
const pad = (t, n) => (t + ' '.repeat(n)).slice(0, n);
let slow = 0;
rows.forEach(r => { const over = r.ms > LIMIT; if (over) slow++; console.log(pad(r.name, 44) + pad(r.ms.toFixed(1) + ' ms', 12) + (over ? 'SLOW (over ' + LIMIT + ' ms)' : 'ok')); });
console.log(slow ? slow + ' step(s) over ' + LIMIT + ' ms' : 'All steps under ' + LIMIT + ' ms');
process.exitCode = slow ? 1 : 0;
`)(require('perf_hooks').performance);
