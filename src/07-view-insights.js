// ============================================================================
// VIEW: INSIGHTS (07-view-insights.js)  Milestone M5
// Four KPI cards, three Chart.js charts (each with an accessible data table),
// and plain-language diagnostics. All numbers come from the pure functions in
// `insightsSelectors`, which are unit tested without any browser or chart library.
// ============================================================================

const INSIGHT_RANGES = [
  { key: 'this-week', label: 'This week' },
  { key: 'last-7', label: 'Last 7 days' },
  { key: 'last-30', label: 'Last 30 days' }
];

const INSIGHT_STATUSES = [
  { key: 'backlog', label: 'Backlog', color: '#94a3b8' },
  { key: 'todo', label: 'To Do', color: '#38bdf8' },
  { key: 'inprogress', label: 'In Progress', color: '#f59e0b' },
  { key: 'done', label: 'Done', color: '#10b981' }
];
const INSIGHT_PRIORITIES = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' }
];
const INSIGHT_TAG_COLORS = {
  indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e', sky: '#0ea5e9', purple: '#a855f7'
};

let insightsCharts = [];

/** Pearson correlation of two equal-length lists, or null when it cannot be computed */
function insightsPearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

const insightsSelectors = {
  /**
   * The chosen period and the one before it, as 'YYYY-MM-DD' strings (inclusive).
   * 'This week' runs Monday to today and is compared with the same days last week.
   */
  getRange(key, todayStr = getLocalDateString(new Date())) {
    const dayCount = (a, b) => Math.round((parseLocalDate(b) - parseLocalDate(a)) / 86400000) + 1;
    let start, end, prevStart, prevEnd, label, prevLabel, k = key;
    if (k === 'this-week') {
      start = getWeekMonday(todayStr); end = todayStr;
      prevStart = addDaysStr(start, -7); prevEnd = addDaysStr(end, -7);
      label = 'this week'; prevLabel = 'the same days last week';
    } else if (k === 'last-30') {
      end = todayStr; start = addDaysStr(end, -29);
      prevEnd = addDaysStr(start, -1); prevStart = addDaysStr(prevEnd, -29);
      label = 'the last 30 days'; prevLabel = 'the 30 days before';
    } else {
      k = 'last-7';
      end = todayStr; start = addDaysStr(end, -6);
      prevEnd = addDaysStr(start, -1); prevStart = addDaysStr(prevEnd, -6);
      label = 'the last 7 days'; prevLabel = 'the 7 days before';
    }
    return { key: k, start, end, prevStart, prevEnd, days: dayCount(start, end), label, prevLabel };
  },

  completedIn(start, end, s = getState()) {
    return (s?.tasks || []).filter(t => {
      if (t.deletedAt || t.status !== 'done' || !t.completedAt) return false;
      const d = getLocalDateString(new Date(t.completedAt));
      return d >= start && d <= end;
    });
  },

  focusMinutesIn(start, end, s = getState()) {
    return (s?.focusLog || [])
      .filter(f => !f.deletedAt && f.kind === 'focus' && f.date >= start && f.date <= end)
      .reduce((sum, f) => sum + (Number(f.minutes) || 0), 0);
  },

  /** Scheduled habit-days and how many were done, from when each habit began until today */
  habitStats(start, end, s = getState(), todayStr = getLocalDateString(new Date())) {
    let scheduled = 0, done = 0;
    const habits = selectors.getActiveHabits(s);
    habits.forEach(h => {
      const logDates = (s.habitLog || []).filter(l => l.habitId === h.id).map(l => l.date).sort();
      const began = [h.createdAt ? getLocalDateString(new Date(h.createdAt)) : null, logDates[0] || null].filter(Boolean).sort()[0] || start;
      let d = began > start ? began : start;
      const last = end < todayStr ? end : todayStr;
      for (let guard = 0; d <= last && guard < 800; guard++) {
        if (selectors.isHabitDue(h, d)) {
          scheduled++;
          if (selectors.isHabitDone(h.id, d, s)) done++;
        }
        d = addDaysStr(d, 1);
      }
    });
    return { scheduled, done, percent: scheduled > 0 ? Math.round((done / scheduled) * 100) : null, habitCount: habits.length };
  },

  getKpis(rangeKey, s = getState(), todayStr = getLocalDateString(new Date())) {
    const r = insightsSelectors.getRange(rangeKey, todayStr);
    const doneNow = insightsSelectors.completedIn(r.start, r.end, s);
    const donePrev = insightsSelectors.completedIn(r.prevStart, r.prevEnd, s);
    const loggedMin = insightsSelectors.focusMinutesIn(r.start, r.end, s);
    const prevLoggedMin = insightsSelectors.focusMinutesIn(r.prevStart, r.prevEnd, s);
    const estMinCompleted = doneNow.reduce((sum, t) => sum + (Number(t.estMin) || 0), 0);

    const isHigh = t => t.priority === 'urgent' || t.priority === 'high';
    const clearedHigh = doneNow.filter(isHigh).length;
    const openHigh = (s?.tasks || []).filter(t => !t.deletedAt && t.status !== 'done' && isHigh(t)).length;
    const totalHigh = clearedHigh + openHigh;

    const hNow = insightsSelectors.habitStats(r.start, r.end, s, todayStr);
    const hPrev = insightsSelectors.habitStats(r.prevStart, r.prevEnd, s, todayStr);

    return {
      range: r,
      velocity: {
        count: doneNow.length, prev: donePrev.length, delta: doneNow.length - donePrev.length,
        deltaPct: donePrev.length > 0 ? Math.round(((doneNow.length - donePrev.length) / donePrev.length) * 100) : null,
        perDay: Math.round((doneNow.length / r.days) * 10) / 10
      },
      focus: {
        loggedMin, prevLoggedMin, deltaMin: loggedMin - prevLoggedMin,
        estMinCompleted, completedCount: doneNow.length,
        perDayMin: Math.round(loggedMin / r.days)
      },
      highPriority: {
        cleared: clearedHigh, open: openHigh, total: totalHigh,
        percent: totalHigh > 0 ? Math.round((clearedHigh / totalHigh) * 100) : null
      },
      habits: {
        done: hNow.done, scheduled: hNow.scheduled, percent: hNow.percent, habitCount: hNow.habitCount,
        prevPercent: hPrev.percent,
        deltaPoints: (hNow.percent !== null && hPrev.percent !== null) ? hNow.percent - hPrev.percent : null
      }
    };
  },

  /** Focus minutes by tag. Time on a task with several tags is shared equally between them. */
  getTagEffort(rangeKey, s = getState(), todayStr = getLocalDateString(new Date())) {
    const r = insightsSelectors.getRange(rangeKey, todayStr);
    const tasksById = new Map((s?.tasks || []).map(t => [t.id, t]));
    const totals = new Map();
    const add = (key, label, color, minutes) => {
      const cur = totals.get(key) || { key, label, color, minutes: 0 };
      cur.minutes += minutes;
      totals.set(key, cur);
    };
    (s?.focusLog || []).filter(f => !f.deletedAt && f.kind === 'focus' && f.date >= r.start && f.date <= r.end).forEach(f => {
      const mins = Number(f.minutes) || 0;
      const task = f.taskId ? tasksById.get(f.taskId) : null;
      if (!task) { add('_unlinked', 'No task linked', '#6b7280', mins); return; }
      const tags = (task.tagIds || []).map(id => selectors.getTagById(id, s)).filter(Boolean);
      if (tags.length === 0) { add('_none', 'No tag', '#9ca3af', mins); return; }
      tags.forEach(tag => add(tag.id, tag.name, INSIGHT_TAG_COLORS[tag.color] || '#6366f1', mins / tags.length));
    });
    // Shared time can be fractional (22.5 + 22.5). Round with "largest remainder" so the parts always add up to the true total.
    const parts = [...totals.values()].map(x => ({ ...x, exact: x.minutes, minutes: Math.floor(x.minutes + 1e-9) }));
    let remaining = Math.round(parts.reduce((a, x) => a + x.exact, 0)) - parts.reduce((a, x) => a + x.minutes, 0);
    parts.slice()
      .sort((a, b) => ((b.exact - b.minutes) - (a.exact - a.minutes)) || (b.exact - a.exact))
      .forEach(x => { if (remaining > 0) { x.minutes++; remaining--; } });
    return parts.filter(x => x.minutes > 0)
      .map(({ exact, ...rest }) => rest)
      .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));
  },

  /** Tasks by priority and stage. Done only counts what was finished in the chosen period. */
  getPriorityPipeline(rangeKey, s = getState(), todayStr = getLocalDateString(new Date())) {
    const r = insightsSelectors.getRange(rangeKey, todayStr);
    const matrix = {};
    INSIGHT_STATUSES.forEach(st => { matrix[st.key] = {}; INSIGHT_PRIORITIES.forEach(p => { matrix[st.key][p.key] = 0; }); });
    let total = 0;
    (s?.tasks || []).filter(t => !t.deletedAt).forEach(t => {
      if (!matrix[t.status] || matrix[t.status][t.priority] === undefined) return;
      if (t.status === 'done') {
        const d = t.completedAt ? getLocalDateString(new Date(t.completedAt)) : null;
        if (!d || d < r.start || d > r.end) return;
      }
      matrix[t.status][t.priority]++;
      total++;
    });
    return { matrix, total, range: r };
  },

  /** Planned (estimates of tasks scheduled that week) vs logged focus minutes, last N weeks */
  getWeeklyPlannedVsLogged(weeks = 8, s = getState(), todayStr = getLocalDateString(new Date())) {
    const thisMonday = getWeekMonday(todayStr);
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = addDaysStr(thisMonday, -7 * i), end = addDaysStr(start, 6);
      const plannedMin = (s?.tasks || [])
        .filter(t => !t.deletedAt && t.scheduledDate && t.scheduledDate >= start && t.scheduledDate <= end)
        .reduce((sum, t) => sum + (Number(t.estMin) || 0), 0);
      out.push({ weekStart: start, label: formatDisplayDate(start, { day: 'numeric', month: 'short' }), plannedMin, loggedMin: insightsSelectors.focusMinutesIn(start, end, s) });
    }
    return out;
  },

  /** Plain-language observations, most important first */
  getDiagnostics(rangeKey, s = getState(), todayStr = getLocalDateString(new Date())) {
    const r = insightsSelectors.getRange(rangeKey, todayStr);
    const tasks = (s?.tasks || []).filter(t => !t.deletedAt);
    const out = [];

    const wipLimit = Number(s?.settings?.wipLimit) || 3;
    const wip = tasks.filter(t => t.status === 'inprogress').length;
    if (wip > wipLimit) out.push({ id: 'wip', level: 'warn', title: `${wip} tasks are in progress (your limit is ${wipLimit})`, detail: 'Too many open tasks slows everything down. Finish one, or move something back to To Do, before starting more.', action: { label: 'Open the board', view: 'kanban' } });

    const overdue = selectors.getCarryOverTasks(todayStr, s);
    if (overdue.length > 0) out.push({ id: 'overdue', level: 'warn', title: `${overdue.length} unfinished task${overdue.length > 1 ? 's' : ''} from earlier days`, detail: 'They are still planned for a day that has passed. Move them to today or take them off the plan.', action: { label: 'Open the planner', view: 'planner' } });

    const noDay = tasks.filter(t => !t.scheduledDate && (t.status === 'todo' || t.status === 'inprogress')).length;
    if (noDay > 0) out.push({ id: 'unscheduled', level: noDay > 3 ? 'warn' : 'info', title: `${noDay} active task${noDay > 1 ? 's have' : ' has'} no day planned`, detail: 'Tasks without a day tend to slip. Give each one a day in the planner.', action: { label: 'Open the planner', view: 'planner' } });

    const logged = t => selectors.getTaskLoggedMinutes(t.id, s);
    const measured = insightsSelectors.completedIn(r.start, r.end, s).filter(t => (Number(t.estMin) || 0) > 0 && logged(t) > 0);
    if (measured.length >= 3) {
      const est = measured.reduce((a, t) => a + t.estMin, 0), act = measured.reduce((a, t) => a + logged(t), 0);
      const ratio = act / est;
      const over = measured.filter(t => logged(t) > t.estMin * 1.5 && logged(t) - t.estMin >= 15).length;
      if (ratio > 1.25) out.push({ id: 'estimates', level: 'warn', title: `Tasks are taking about ${Math.round(ratio * 100)}% of their estimate`, detail: `${over ? `${over} of ${measured.length} finished tasks ran well over. ` : ''}Try padding your estimates, or splitting big tasks into smaller steps.` });
      else if (ratio < 0.75) out.push({ id: 'estimates', level: 'info', title: `Tasks are finishing in about ${Math.round(ratio * 100)}% of their estimate`, detail: 'You are estimating high. Tighter estimates will make the planner\'s load bars more honest.' });
    }

    // Does energy track focus? last 30 days, same day
    const xs = [], ys = [];
    for (let i = 0; i < 30; i++) {
      const d = addDaysStr(todayStr, -i);
      const e = selectors.getJournalEntry(d, s);
      if (e && e.energy != null) { xs.push(e.energy); ys.push(insightsSelectors.focusMinutesIn(d, d, s)); }
    }
    if (xs.length < 5) {
      out.push({ id: 'energy', level: 'info', title: 'Energy and focus: not enough data yet', detail: `Rate your energy in the journal on at least 5 days (${xs.length} so far) and FlowBoard will show whether it affects your focus time.`, action: { label: 'Open the journal', view: 'journal' } });
    } else {
      const rr = insightsPearson(xs, ys);
      if (rr === null) out.push({ id: 'energy', level: 'info', title: 'Energy and focus: no pattern to measure yet', detail: 'Either your energy or your logged focus time is the same every day so far.' });
      else if (rr >= 0.4) out.push({ id: 'energy', level: 'info', title: 'You focus more on high-energy days', detail: `Over ${xs.length} journal days, higher energy goes with more focus time (correlation ${rr.toFixed(2)}). Put your hardest work on the days and hours you feel best.` });
      else if (rr <= -0.4) out.push({ id: 'energy', level: 'info', title: 'You focus more on low-energy days', detail: `Over ${xs.length} journal days, lower energy goes with more focus time (correlation ${rr.toFixed(2)}). You may be pushing through tiredness, so watch for burnout.` });
      else out.push({ id: 'energy', level: 'info', title: 'No clear link between energy and focus yet', detail: `Over ${xs.length} journal days the two do not move together (correlation ${rr.toFixed(2)}).` });
    }

    if (out.every(x => x.level === 'info')) {
      out.unshift({ id: 'healthy', level: 'good', title: 'The board looks healthy', detail: 'No overloaded In Progress column and nothing overdue.' });
    }
    const rank = { warn: 0, good: 1, info: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }
};

// ----------------------------------------------------------------------------
// CHART CONFIGS (pure: data in, Chart.js config out; tested without Chart.js)
// ----------------------------------------------------------------------------

function insightsChartTheme() {
  const dark = selectors.getEffectiveTheme() === 'dark';
  return dark
    ? { text: '#9ca3af', strong: '#f9fafb', grid: 'rgba(255,255,255,0.08)', surface: '#111827' }
    : { text: '#475569', strong: '#0f172a', grid: 'rgba(15,23,42,0.08)', surface: '#ffffff' };
}

function insightsReduceMotion() {
  try { return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}

function buildTagChartConfig(tagEffort, theme) {
  const total = tagEffort.reduce((a, x) => a + x.minutes, 0);
  return {
    type: 'doughnut',
    data: {
      labels: tagEffort.map(x => x.label),
      datasets: [{ data: tagEffort.map(x => x.minutes), backgroundColor: tagEffort.map(x => x.color), borderColor: theme.surface, borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      animation: { duration: insightsReduceMotion() ? 0 : 400 },
      plugins: {
        legend: { position: 'bottom', labels: { color: theme.text, boxWidth: 12, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatMinutes(ctx.parsed)} (${total ? Math.round((ctx.parsed / total) * 100) : 0}%)` } }
      }
    }
  };
}

function buildPipelineChartConfig(pipeline, theme) {
  return {
    type: 'bar',
    data: {
      labels: INSIGHT_PRIORITIES.map(p => p.label),
      datasets: INSIGHT_STATUSES.map(st => ({
        label: st.label, backgroundColor: st.color, borderRadius: 3,
        data: INSIGHT_PRIORITIES.map(p => pipeline.matrix[st.key][p.key])
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: insightsReduceMotion() ? 0 : 400 },
      scales: {
        x: { stacked: true, ticks: { color: theme.text }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { color: theme.text, precision: 0 }, grid: { color: theme.grid }, title: { display: true, text: 'Tasks', color: theme.text } }
      },
      plugins: { legend: { position: 'bottom', labels: { color: theme.text, boxWidth: 12, padding: 12 } } }
    }
  };
}

function buildWeeklyChartConfig(weeks, theme) {
  return {
    type: 'bar',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [
        { label: 'Planned', data: weeks.map(w => w.plannedMin), backgroundColor: '#818cf8', borderRadius: 3 },
        { label: 'Logged', data: weeks.map(w => w.loggedMin), backgroundColor: '#34d399', borderRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: insightsReduceMotion() ? 0 : 400 },
      scales: {
        x: { ticks: { color: theme.text }, grid: { display: false }, title: { display: true, text: 'Week starting', color: theme.text } },
        y: { beginAtZero: true, ticks: { color: theme.text, callback: v => formatMinutes(v) }, grid: { color: theme.grid }, title: { display: true, text: 'Time', color: theme.text } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: theme.text, boxWidth: 12, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatMinutes(ctx.parsed.y)}` } }
      }
    }
  };
}

function destroyInsightsCharts() {
  insightsCharts.forEach(c => { try { c.destroy(); } catch (e) { /* already gone */ } });
  insightsCharts = [];
}

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

function insightsDelta(n, unit, bigger = 'more', smaller = 'fewer') {
  if (n === 0) return { text: 'No change', arrow: '–', cls: 'text-[var(--text-secondary)]' };
  return n > 0
    ? { text: `${n} ${bigger}${unit ? ' ' + unit : ''}`, arrow: '▲', cls: 'text-emerald-500' }
    : { text: `${Math.abs(n)} ${smaller}${unit ? ' ' + unit : ''}`, arrow: '▼', cls: 'text-rose-500' };
}

function insightsKpiCard(id, label, valueHtml, lines) {
  return `
    <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5" role="group" aria-labelledby="${id}-label">
      <span id="${id}-label" class="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">${esc(label)}</span>
      <div class="text-3xl font-bold text-[var(--text-primary)] mt-1.5 leading-tight">${valueHtml}</div>
      ${lines.map(l => `<p class="text-sm mt-1 ${l.cls || 'text-[var(--text-secondary)]'}">${l.html}</p>`).join('')}
    </div>`;
}

function insightsTable(caption, headers, rows, visible) {
  return `
    <div class="${visible ? 'mt-3 overflow-x-auto' : 'sr-only'}">
      <table class="w-full text-sm">
        <caption class="text-left text-xs text-[var(--text-secondary)] pb-1">${esc(caption)}</caption>
        <thead><tr>${headers.map((h, i) => `<th scope="col" class="py-1 ${i ? 'text-right pl-3' : 'text-left'} text-xs font-medium text-[var(--text-secondary)]">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr class="border-t border-[var(--border-color)]">${r.map((c, i) => i === 0
          ? `<th scope="row" class="py-1 text-left font-normal text-[var(--text-primary)]">${esc(c)}</th>`
          : `<td class="py-1 pl-3 text-right font-mono text-[var(--text-primary)]">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function insightsChartCard({ id, title, subtitle, hasData, emptyText, chartAvailable, label, tableHtml, wide }) {
  return `
    <section class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 ${wide ? 'lg:col-span-2' : ''}" aria-labelledby="${id}-title">
      <h3 id="${id}-title" class="text-sm font-semibold text-[var(--text-primary)]">${esc(title)}</h3>
      <p class="text-xs text-[var(--text-secondary)] mt-0.5 mb-3">${esc(subtitle)}</p>
      ${hasData
        ? (chartAvailable
          ? `<div class="relative h-64"><canvas id="${id}" role="img" aria-label="${esc(label)}">${esc(label)}</canvas></div>`
          : `<p class="text-sm text-[var(--text-secondary)] py-6">The chart library could not load (you may be offline). The table shows the same numbers.</p>`)
        : `<p class="text-sm text-[var(--text-secondary)] py-10 text-center">${esc(emptyText)}</p>`}
      ${tableHtml}
    </section>`;
}

/**
 * Render the Insights & Analytics view
 * @param {HTMLElement} container
 */
function renderInsightsView(container) {
  destroyInsightsCharts();
  const s = getState();
  const today = getLocalDateString(new Date());
  const rangeKey = (s.ui && s.ui.insightsRange) || 'last-7';
  const showTables = Boolean(s.ui && s.ui.insightsTables);
  const kpis = insightsSelectors.getKpis(rangeKey, s, today);
  const r = kpis.range;
  const tagEffort = insightsSelectors.getTagEffort(rangeKey, s, today);
  const pipeline = insightsSelectors.getPriorityPipeline(rangeKey, s, today);
  const weeks = insightsSelectors.getWeeklyPlannedVsLogged(8, s, today);
  const diagnostics = insightsSelectors.getDiagnostics(rangeKey, s, today);
  const chartAvailable = typeof Chart !== 'undefined';
  const tablesVisible = showTables || !chartAvailable;
  const theme = insightsChartTheme();

  const nothingYet = (s.tasks || []).filter(t => !t.deletedAt).length === 0 && (s.focusLog || []).length === 0 && (s.habitLog || []).length === 0;

  // ---- KPI cards ----
  const vel = kpis.velocity, dv = insightsDelta(vel.delta, 'task' + (Math.abs(vel.delta) === 1 ? '' : 's'));
  const fo = kpis.focus, df = insightsDelta(Math.round(fo.deltaMin / 6) / 10, 'h', 'more', 'less');
  const hp = kpis.highPriority, hb = kpis.habits;
  const dh = hb.deltaPoints === null ? null : insightsDelta(hb.deltaPoints, 'points', 'higher', 'lower');
  const cards = [
    insightsKpiCard('kpi-velocity', 'Completion velocity',
      `${vel.count} <span class="text-base font-medium text-[var(--text-secondary)]">task${vel.count === 1 ? '' : 's'} done</span>`,
      [{ html: `<span aria-hidden="true">${dv.arrow}</span> <span class="font-semibold">${esc(dv.text)}</span> than ${esc(r.prevLabel)} (${vel.prev})`, cls: dv.cls },
       { html: `${vel.perDay} per day${vel.deltaPct !== null ? ` · ${vel.deltaPct > 0 ? '+' : ''}${vel.deltaPct}%` : ''}` }]),
    insightsKpiCard('kpi-focus', 'Focus time',
      `${esc(formatMinutes(fo.loggedMin))} <span class="text-base font-medium text-[var(--text-secondary)]">logged</span>`,
      [{ html: `<span aria-hidden="true">${df.arrow}</span> <span class="font-semibold">${esc(df.text)}</span> than ${esc(r.prevLabel)}`, cls: df.cls },
       { html: fo.completedCount > 0 ? `Tasks you finished were estimated at <strong class="text-[var(--text-primary)]">${esc(formatMinutes(fo.estMinCompleted))}</strong>` : 'Finish a task to compare against estimates' }]),
    insightsKpiCard('kpi-high', 'High priority cleared',
      hp.total > 0 ? `${hp.cleared} <span class="text-base font-medium text-[var(--text-secondary)]">of ${hp.total}${hp.percent !== null ? ` (${hp.percent}%)` : ''}</span>` : `<span class="text-xl font-semibold text-[var(--text-secondary)]">None yet</span>`,
      [{ html: hp.total > 0 ? `${hp.open} urgent or high task${hp.open === 1 ? '' : 's'} still open` : 'No urgent or high-priority tasks to clear' }]),
    insightsKpiCard('kpi-habits', 'Habit consistency',
      hb.percent === null ? `<span class="text-xl font-semibold text-[var(--text-secondary)]">No data</span>` : `${hb.percent}<span class="text-base font-medium text-[var(--text-secondary)]">%</span>`,
      [{ html: hb.scheduled > 0 ? `${hb.done} of ${hb.scheduled} scheduled check-ins` : (hb.habitCount ? 'No habit days scheduled in this period yet' : 'Add a habit to track consistency') },
       ...(dh ? [{ html: `<span aria-hidden="true">${dh.arrow}</span> <span class="font-semibold">${esc(dh.text)}</span> than ${esc(r.prevLabel)}`, cls: dh.cls }] : [])])
  ].join('');

  // ---- diagnostics ----
  const diagIcon = { warn: '⚠', info: 'ℹ', good: '✓' };
  const diagStyle = { warn: 'border-amber-500/40 bg-amber-500/10', good: 'border-emerald-500/40 bg-emerald-500/10', info: 'border-[var(--border-color)] bg-[var(--bg-secondary)]' };
  const diagLabel = { warn: 'Needs attention', good: 'Good', info: 'Note' };
  const diagHtml = diagnostics.map(d => `
    <li class="flex flex-wrap items-start justify-between gap-3 p-3 rounded-xl border ${diagStyle[d.level]}">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-[var(--text-primary)]"><span aria-hidden="true">${diagIcon[d.level]}</span> <span class="sr-only">${diagLabel[d.level]}: </span>${esc(d.title)}</p>
        <p class="text-sm text-[var(--text-secondary)] mt-0.5">${esc(d.detail)}</p>
      </div>
      ${d.action ? `<button type="button" data-action="switch-view" data-view="${esc(d.action.view)}" class="btn-secondary text-xs flex-shrink-0">${esc(d.action.label)}</button>` : ''}
    </li>`).join('');

  // ---- chart cards ----
  const tagTotal = tagEffort.reduce((a, x) => a + x.minutes, 0);
  const pipeTotals = INSIGHT_PRIORITIES.map(p => INSIGHT_STATUSES.map(st => pipeline.matrix[st.key][p.key]));
  const weeksHaveData = weeks.some(w => w.plannedMin > 0 || w.loggedMin > 0);
  const tagLabel = tagTotal ? `Doughnut chart of focus time by tag: ${tagEffort.map(x => `${x.label} ${formatMinutes(x.minutes)}`).join(', ')}.` : 'No focus time logged.';
  const pipeLabel = pipeline.total ? `Stacked bar chart of ${pipeline.total} tasks by priority and stage.` : 'No tasks.';
  const weekLabel = weeksHaveData ? `Bar chart comparing planned and logged time for each of the last 8 weeks.` : 'No planned or logged time.';

  const chartsHtml = [
    insightsChartCard({
      id: 'chart-tags', title: 'Where your focus time went', subtitle: `Minutes logged by tag, ${r.label}`,
      hasData: tagTotal > 0, emptyText: 'No focus time logged in this period. Start the timer on a task and your time will show up here.',
      chartAvailable, label: tagLabel,
      tableHtml: insightsTable('Focus time by tag', ['Tag', 'Time', 'Share'], tagEffort.map(x => [x.label, formatMinutes(x.minutes), `${Math.round((x.minutes / tagTotal) * 100)}%`]), tablesVisible)
    }),
    insightsChartCard({
      id: 'chart-pipeline', title: 'Priority pipeline', subtitle: `Tasks by priority and stage (Done = finished in ${r.label})`,
      hasData: pipeline.total > 0, emptyText: 'No tasks yet. Add some on the Kanban board.',
      chartAvailable, label: pipeLabel,
      tableHtml: insightsTable('Tasks by priority and stage', ['Priority', ...INSIGHT_STATUSES.map(x => x.label)], INSIGHT_PRIORITIES.map((p, i) => [p.label, ...pipeTotals[i]]), tablesVisible)
    }),
    insightsChartCard({
      id: 'chart-weekly', title: 'Planned vs logged, week by week', subtitle: 'Estimated minutes of tasks planned for each week against focus time logged (last 8 weeks)',
      hasData: weeksHaveData, emptyText: 'Plan some tasks in the Weekly Planner and log focus time to compare them here.',
      chartAvailable, label: weekLabel, wide: true,
      tableHtml: insightsTable('Planned and logged time per week', ['Week starting', 'Planned', 'Logged'], weeks.map(w => [w.label, formatMinutes(w.plannedMin), formatMinutes(w.loggedMin)]), tablesVisible)
    })
  ].join('');

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Insights &amp; Analytics</h1>
          <p class="text-sm text-[var(--text-secondary)] mt-0.5">${esc(formatDisplayDate(r.start))} to ${esc(formatDisplayDate(r.end))}, compared with ${esc(r.prevLabel)}</p>
        </div>
        <div class="inline-flex p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]" role="group" aria-label="Time period">
          ${INSIGHT_RANGES.map(x => `<button type="button" data-action="insights-range" data-range="${x.key}" aria-pressed="${x.key === r.key}"
            class="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-all ${x.key === r.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}">${esc(x.label)}</button>`).join('')}
        </div>
      </div>

      ${nothingYet ? `<div class="p-4 rounded-xl border border-indigo-500/40 bg-indigo-600/10 text-sm text-[var(--text-primary)]">
        <p class="font-semibold">Nothing to analyse yet</p>
        <p class="text-[var(--text-secondary)] mt-0.5">Complete a task, run the focus timer or tick a habit and this page fills in. Want to look around first? Load the sample workspace from Settings.</p>
        <button type="button" data-action="switch-view" data-view="settings" class="btn-secondary text-xs mt-2">Open Settings</button>
      </div>` : ''}

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">${cards}</div>

      <section aria-labelledby="insights-notes-title">
        <h2 id="insights-notes-title" class="text-sm font-semibold text-[var(--text-primary)] mb-2">What to look at</h2>
        <ul class="space-y-2">${diagHtml}</ul>
      </section>

      <section aria-labelledby="insights-charts-title">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 id="insights-charts-title" class="text-sm font-semibold text-[var(--text-primary)]">Charts</h2>
          <button type="button" data-action="insights-toggle-tables" aria-pressed="${tablesVisible}" ${chartAvailable ? '' : 'disabled'} class="btn-secondary text-xs">${tablesVisible ? 'Hide data tables' : 'Show data as tables'}</button>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${chartsHtml}</div>
      </section>
    </div>
  `;

  mountInsightsCharts({ tagEffort, pipeline, weeks, theme, tagTotal, weeksHaveData });
}

/** Draw the charts. If the chart library did not load, the tables already hold the numbers. */
function mountInsightsCharts({ tagEffort, pipeline, weeks, theme, tagTotal, weeksHaveData }) {
  if (typeof Chart === 'undefined') return false;
  try {
    if (Chart.defaults && Chart.defaults.font) Chart.defaults.font.family = "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
  } catch (e) { /* cosmetic only */ }
  const jobs = [
    ['chart-tags', tagTotal > 0 ? buildTagChartConfig(tagEffort, theme) : null],
    ['chart-pipeline', pipeline.total > 0 ? buildPipelineChartConfig(pipeline, theme) : null],
    ['chart-weekly', weeksHaveData ? buildWeeklyChartConfig(weeks, theme) : null]
  ];
  jobs.forEach(([id, config]) => {
    const canvas = document.getElementById(id);
    if (!canvas || !config) return;
    try {
      insightsCharts.push(new Chart(canvas, config));
    } catch (e) {
      console.error('[Insights] Could not draw chart', id, e);
      const holder = canvas.parentElement;
      if (holder) holder.innerHTML = '<p class="text-sm text-[var(--text-secondary)] py-6">This chart could not be drawn. The table shows the same numbers.</p>';
    }
  });
  return true;
}
