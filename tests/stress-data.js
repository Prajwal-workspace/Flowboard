// Large test workspace for the speed check: 1,000 tasks, 365 journal days, 5,000 focus sessions,
// 6 habits with a year of check-ins. Same result every time (no real randomness).
// Used by tests/perf-test.js. Needs the app code loaded first.
function buildStressState(todayStr = getLocalDateString(new Date())) {
  const base = getDefaultState();
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const at = (dateStr, hour) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d, hour, 0, 0).getTime(); };
  const now = Date.now();
  const stamp = { createdAt: now, updatedAt: now, deletedAt: null };
  const words = ['report', 'review', 'draft', 'call', 'plan', 'fix', 'email', 'budget', 'design', 'test', 'client', 'invoice', 'notes', 'research', 'update'];

  const tags = ['Deep Work', 'Admin', 'Learning', 'Meetings', 'Writing', 'Errands', 'Health', 'Finance']
    .map((name, i) => ({ id: 'stg-' + i, name, color: ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'][i % 6], ...stamp }));

  const statuses = ['backlog', 'todo', 'todo', 'inprogress', 'done', 'done', 'done', 'done'];
  const tasks = [];
  for (let i = 0; i < 1000; i++) {
    const status = pick(statuses);
    const offset = Math.floor(rnd() * 120) - 100;                      // from 100 days ago to 20 days ahead
    const scheduledDate = rnd() < 0.7 ? addDaysStr(todayStr, status === 'done' ? -Math.abs(offset) : offset) : null;
    const doneDate = addDaysStr(todayStr, -Math.floor(rnd() * 100));
    tasks.push({
      id: 'stk-' + i,
      title: `${pick(words)} ${pick(words)} ${i}`,
      desc: rnd() < 0.4 ? 'A longer description with a few words to make the card taller.' : '',
      status, priority: pick(['urgent', 'high', 'medium', 'medium', 'low']),
      tagIds: rnd() < 0.8 ? [pick(tags).id].concat(rnd() < 0.2 ? [tags[0].id] : []).filter((v, k, a) => a.indexOf(v) === k) : [],
      areaId: rnd() < 0.7 ? pick(base.areas).id : null,
      scheduledDate, estMin: pick([15, 30, 45, 60, 90, 120]), order: (i + 1) * 1000,
      completedAt: status === 'done' ? at(doneDate, 9 + Math.floor(rnd() * 9)) : null,
      subtasks: rnd() < 0.3 ? [0, 1, 2].map(k => ({ id: `sst-${i}-${k}`, text: `Step ${k + 1}`, done: rnd() < 0.5 })) : [],
      ...stamp
    });
  }

  const focusLog = [];
  for (let i = 0; i < 5000; i++) {
    const date = addDaysStr(todayStr, -Math.floor(rnd() * 365));
    focusLog.push({ id: 'sfl-' + i, date, taskId: rnd() < 0.9 ? 'stk-' + Math.floor(rnd() * 1000) : null, minutes: pick([15, 25, 25, 50]), kind: 'focus', startedAt: at(date, 10), ...stamp });
  }

  const journalEntries = [];
  for (let i = 0; i < 365; i++) {
    const date = addDaysStr(todayStr, -i);
    journalEntries.push({
      id: 'j-' + date, date, mood: 1 + Math.floor(rnd() * 5), energy: 1 + Math.floor(rnd() * 10),
      tagId: rnd() < 0.5 ? pick(tags).id : null,
      wins: `• ${pick(words)} ${pick(words)}\n• ${pick(words)} done`, blockers: rnd() < 0.5 ? `Too many ${pick(words)}s` : '',
      notes: `Tomorrow: ${pick(words)} and ${pick(words)}.`, ...stamp
    });
  }

  const habits = ['Deep work', 'Read', 'Walk', 'Stretch', 'Plan the day', 'No phone'].map((title, i) => ({
    id: 'shb-' + i, title, targetDays: i % 2 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6], archived: false,
    createdAt: at(addDaysStr(todayStr, -365), 8), updatedAt: now, deletedAt: null
  }));
  const habitLog = [];
  habits.forEach(h => {
    for (let i = 0; i < 365; i++) {
      const date = addDaysStr(todayStr, -i);
      if (rnd() < 0.75) habitLog.push({ id: `hl-${h.id}-${date}`, habitId: h.id, date, done: true, updatedAt: now });
    }
  });

  const dayIntentions = [];
  for (let i = -7; i < 60; i++) { const date = addDaysStr(todayStr, -i); dayIntentions.push({ id: 'di-' + date, date, text: `${pick(words)} first`, updatedAt: now }); }

  return { ...base, tags, tasks, focusLog, journalEntries, habits, habitLog, dayIntentions, meta: { ...base.meta, onboarded: true } };
}
