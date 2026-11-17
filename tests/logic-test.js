// Run from the project root:  node tests/logic-test.js
// Loads src/*.js in build order with a tiny fake browser, then runs tests/cases.js.
// (The same cases also run in a real browser: open tests/smoke.html.)
const fs = require('fs'), path = require('path');
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, addEventListener() {}, appendChild() {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null, innerHTML: '', style: {} });
global.document = { readyState: 'complete', getElementById: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
global.window = global; global.matchMedia = () => ({ matches: true, addEventListener() {} });
global.requestAnimationFrame = f => f(); global.Blob = class {}; global.URL = {};
global.FLOWBOARD_NO_BOOT = true;   // load the app code without starting the app
const order = ['00-utils','01-storage','02-state','03-timer','04-view-kanban','05-view-planner','06-view-journal','07-view-insights','08-view-settings','09-sync','10-app'];
const read = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const src = order.map(f => read('..', 'src', f + '.js')).join('\n');
new Function(src + '\n' + read('cases.js'))();
