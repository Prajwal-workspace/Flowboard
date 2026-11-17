// ============================================================================
// VIEW: WEEKLY PLANNER (05-view-planner.js)  Milestone M3
// 7-day grid with load meters, daily #1 intention, carry-over, unscheduled tray
// and the weekly habit matrix. All data comes from selectors; changes go
// through actions (scheduleTask, setDayIntention, ...).
// ============================================================================

let plannerDragTaskId = null;

// The Unscheduled tray draws its first cards only, with a 'Show all' button (M8)
const PLANNER_TRAY_LIMIT = 30;
let plannerTrayShowAll = false;

const PLANNER_STATUS_LABEL = { backlog: 'Backlog', todo: 'To do', inprogress: 'In progress', done: 'Done' };
const PLANNER_PRIORITY_ICON = { urgent: '🔥', high: '⚡', medium: '◈', low: '▽' };
const PLANNER_LOAD_META = {
  off:   { label: 'Day off',    bar: 'bg-neutral-500', text: 'text-[var(--text-secondary)]' },
  empty: { label: 'Free',       bar: 'bg-neutral-500', text: 'text-[var(--text-secondary)]' },
  ok:    { label: 'On track',   bar: 'bg-emerald-500', text: 'text-emerald-500' },
  near:  { label: 'Near limit', bar: 'bg-amber-500',   text: 'text-amber-500' },
  over:  { label: 'Overloaded', bar: 'bg-rose-500',    text: 'text-rose-500' }
};

function plannerShortDate(dateStr) {
  return formatDisplayDate(dateStr, { day: 'numeric', month: 'short' });
}

function plannerLongDate(dateStr) {
  return formatDisplayDate(dateStr, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** A task card used inside a day column */
function renderPlannerDayCard(task) {
  const done = task.status === 'done';
  const title = esc(task.title);
  return `
    <div class="planner-card rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2 cursor-grab" draggable="true" data-planner-task="${esc(task.id)}">
      <div class="flex items-start gap-1.5">
        <button type="button" data-action="planner-toggle-done" data-task-id="${esc(task.id)}"
          aria-pressed="${done ? 'true' : 'false'}" aria-label="${done ? 'Mark not done' : 'Mark done'}: ${title}"
          class="planner-mini flex-shrink-0 flex items-center justify-center rounded-md border text-xs font-bold
            ${done ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}">
          <span aria-hidden="true">${done ? '✓' : '○'}</span>
        </button>
        <div class="min-w-0 flex-1 pt-1">
          <p class="text-xs font-medium leading-snug break-words ${done ? 'line-through opacity-60' : 'text-[var(--text-primary)]'}">
            <span aria-hidden="true">${PLANNER_PRIORITY_ICON[task.priority] || ''}</span> ${title}
          </p>
          <p class="text-[10px] text-[var(--text-secondary)] mt-0.5">${esc(PLANNER_STATUS_LABEL[task.status] || task.status)} · ${esc(formatMinutes(task.estMin))}</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-0.5 mt-1" role="group" aria-label="Actions for ${title}">
        <button type="button" data-action="planner-shift" data-delta="-1" data-task-id="${esc(task.id)}" class="planner-mini rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]" aria-label="Move ${title} to the previous day" title="Previous day"><span aria-hidden="true">‹</span></button>
        <button type="button" data-action="planner-shift" data-delta="1" data-task-id="${esc(task.id)}" class="planner-mini rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]" aria-label="Move ${title} to the next day" title="Next day"><span aria-hidden="true">›</span></button>
        <button type="button" data-action="focus-task" data-task-id="${esc(task.id)}" class="planner-mini rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-indigo-400" aria-label="Link ${title} to the focus timer" title="Focus on this"><span aria-hidden="true">▶</span></button>
        <button type="button" data-action="planner-unschedule" data-task-id="${esc(task.id)}" class="planner-mini rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-red-400" aria-label="Unschedule ${title}" title="Remove from this day"><span aria-hidden="true">✕</span></button>
      </div>
    </div>`;
}

/** A task card used in the Unscheduled tray: one tap on a day schedules it */
function renderPlannerTrayCard(task, weekDates, todayStr) {
  const title = esc(task.title);
  const dayButtons = weekDates.map(({ key, date, longLabel }) => `
    <button type="button" data-action="planner-schedule" data-task-id="${esc(task.id)}" data-date="${esc(date)}"
      class="planner-mini px-2 rounded-md border text-xs font-medium transition-colors ${date === todayStr
        ? 'border-indigo-500/60 text-indigo-400 bg-indigo-600/10'
        : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'}"
      aria-label="Schedule ${title} on ${esc(longLabel || plannerLongDate(date))}">${key}</button>`).join('');
  return `
    <div class="planner-card rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2.5 cursor-grab" draggable="true" data-planner-task="${esc(task.id)}">
      <p class="text-sm font-medium leading-snug break-words text-[var(--text-primary)]">
        <span aria-hidden="true">${PLANNER_PRIORITY_ICON[task.priority] || ''}</span> ${title}
      </p>
      <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">${esc(PLANNER_STATUS_LABEL[task.status] || task.status)} · ${esc(formatMinutes(task.estMin))}</p>
      <div class="flex flex-wrap gap-1 mt-2" role="group" aria-label="Schedule ${title}">${dayButtons}</div>
    </div>`;
}

function renderPlannerDay({ key, date }, s, todayStr) {
  const load = selectors.getDayLoad(date, s);
  const meta = PLANNER_LOAD_META[load.state];
  const tasks = selectors.getTasksOnDate(date, s);
  const isToday = date === todayStr;
  const intention = selectors.getDayIntention(date, s);
  const label = `${key} ${plannerShortDate(date)}`;

  return `
    <section class="rounded-xl border bg-[var(--bg-card)] flex flex-col min-h-[220px] transition-colors
      ${isToday ? 'border-indigo-500/60 ring-1 ring-indigo-500/40' : 'border-[var(--border-color)]'}"
      data-drop-date="${esc(date)}" aria-label="${esc(label)}">
      <div class="p-2.5 border-b border-[var(--border-color)]">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-[var(--text-primary)]">${esc(key)} <span class="font-normal text-[var(--text-secondary)]">${esc(plannerShortDate(date))}</span></h2>
          ${isToday ? '<span class="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide">Today</span>' : ''}
        </div>

        <div class="mt-2">
          <div class="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden" role="progressbar"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow="${load.percent}" aria-label="Planned load for ${esc(key)}: ${esc(meta.label)}">
            <div class="h-full rounded-full ${meta.bar}" style="width:${load.percent}%"></div>
          </div>
          <div class="flex items-center justify-between gap-1 mt-1 text-[11px]">
            <span class="font-mono text-[var(--text-secondary)]">${esc(formatMinutes(load.plannedMin))} / ${esc(formatMinutes(load.capacityMin))}</span>
            <span class="font-semibold ${meta.text}">${esc(meta.label)}${load.state === 'over' && load.overByMin > 0 ? ` +${esc(formatMinutes(load.overByMin))}` : ''}</span>
          </div>
        </div>

        <label class="sr-only" for="intention-${esc(date)}">#1 focus for ${esc(plannerLongDate(date))}</label>
        <input id="intention-${esc(date)}" type="text" maxlength="200" data-intention-date="${esc(date)}"
          value="${esc(intention)}" placeholder="#1 focus for the day"
          class="mt-2 w-full px-2 py-1.5 min-h-[36px] text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70">
      </div>

      <div class="p-2 space-y-2 flex-1">
        ${tasks.length > 0
          ? tasks.map(renderPlannerDayCard).join('')
          : '<p class="text-xs text-[var(--text-secondary)] opacity-70 text-center py-6">Nothing planned.<br>Drop a task here.</p>'}
      </div>
    </section>`;
}

function renderPlannerHabitMatrix(weekDates, s, todayStr) {
  const rows = selectors.getWeekHabitMatrix(weekDates[0].date, s, todayStr);
  if (rows.length === 0) {
    return `<p class="text-sm text-[var(--text-secondary)]">No habits yet. Use the + button in the habits bar above to add one.</p>`;
  }
  const head = weekDates.map(({ key, date }) => `
    <th scope="col" class="px-1 py-1 text-center text-xs font-medium ${date === todayStr ? 'text-indigo-400' : 'text-[var(--text-secondary)]'}">
      ${esc(key)}<br><span class="font-normal opacity-80">${esc(formatDisplayDate(date, { day: 'numeric' }))}</span>
    </th>`).join('');
  const body = rows.map(r => `
    <tr class="border-t border-[var(--border-color)]">
      <th scope="row" class="py-1.5 pr-3 text-left text-sm font-medium text-[var(--text-primary)] max-w-[12rem] truncate">${esc(r.habit.title)}</th>
      ${r.cells.map(c => {
        if (!c.due) return `<td class="text-center text-[var(--text-secondary)] opacity-40" aria-label="Not scheduled">–</td>`;
        if (c.future) return `<td class="text-center text-[var(--text-secondary)] opacity-50" aria-label="Upcoming">·</td>`;
        return `<td class="text-center"><button type="button" data-action="toggle-habit-date" data-habit-id="${esc(r.habit.id)}" data-date="${esc(c.date)}"
          aria-pressed="${c.done ? 'true' : 'false'}" aria-label="${esc(r.habit.title)} on ${esc(plannerLongDate(c.date))}: ${c.done ? 'done' : 'not done'}"
          class="planner-mini rounded-lg border text-sm font-bold ${c.done
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500'
            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}"><span aria-hidden="true">${c.done ? '✓' : ''}</span></button></td>`;
      }).join('')}
      <td class="pl-3 text-right text-sm font-mono ${r.rate === null ? 'text-[var(--text-secondary)]' : (r.rate >= 80 ? 'text-emerald-500' : r.rate >= 50 ? 'text-amber-500' : 'text-rose-500')}">${r.rate === null ? '–' : r.rate + '%'}</td>
      <td class="pl-3 text-right text-sm text-[var(--text-secondary)] whitespace-nowrap">${r.streak >= 2 ? `<span aria-hidden="true">🔥</span> ${r.streak}` : (r.streak === 1 ? '1' : '–')}</td>
    </tr>`).join('');
  return `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[520px]">
        <thead><tr><th scope="col" class="text-left text-xs font-medium text-[var(--text-secondary)] py-1">Habit</th>${head}
          <th scope="col" class="pl-3 text-right text-xs font-medium text-[var(--text-secondary)]">Rate</th>
          <th scope="col" class="pl-3 text-right text-xs font-medium text-[var(--text-secondary)]">Streak</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

/**
 * Render the Weekly Planner view
 * @param {HTMLElement} container
 */
function renderPlannerView(container) {
  const s = getState();
  const todayStr = getLocalDateString(new Date());
  const monday = getWeekMonday(s?.ui?.plannerWeek || new Date());
  const weekDates = selectors.getWeekDates(monday).map(d => ({ ...d, longLabel: plannerLongDate(d.date) }));   // formatted once, reused on every tray card
  const sunday = weekDates[6].date;
  const isThisWeek = monday === getWeekMonday(todayStr);
  const summary = selectors.getWeekSummary(monday, s);
  const unscheduled = selectors.getUnscheduledTasks(s);
  const trayShown = (plannerTrayShowAll || unscheduled.length <= PLANNER_TRAY_LIMIT) ? unscheduled : unscheduled.slice(0, PLANNER_TRAY_LIMIT);
  const trayHidden = unscheduled.length - trayShown.length;
  const carryOver = selectors.getCarryOverTasks(todayStr, s);

  const weekLabel = `${formatDisplayDate(monday, { day: 'numeric', month: 'short' })} – ${formatDisplayDate(sunday, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const carryHtml = carryOver.length === 0 ? '' : `
    <section class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3" aria-label="Carry over unfinished tasks">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-amber-500"><span aria-hidden="true">⚠</span> ${carryOver.length} unfinished task${carryOver.length > 1 ? 's' : ''} from earlier days</h2>
        <button type="button" data-action="carry-over-all" class="btn-secondary">Move all to today</button>
      </div>
      <ul class="mt-2 space-y-1">
        ${carryOver.slice(0, 8).map(t => `
          <li class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm text-[var(--text-primary)] min-w-0 break-words">${esc(t.title)} <span class="text-xs text-[var(--text-secondary)]">(was ${esc(formatDisplayDate(t.scheduledDate))})</span></span>
            <span class="flex items-center gap-1">
              <button type="button" data-action="carry-over-task" data-target="today" data-task-id="${esc(t.id)}" class="planner-mini px-3 rounded-lg border border-amber-500/50 text-xs font-semibold text-amber-500 hover:bg-amber-500/10" aria-label="Move ${esc(t.title)} to today">Today</button>
              <button type="button" data-action="carry-over-task" data-target="none" data-task-id="${esc(t.id)}" class="planner-mini px-3 rounded-lg border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]" aria-label="Unschedule ${esc(t.title)}">Unschedule</button>
            </span>
          </li>`).join('')}
      </ul>
      ${carryOver.length > 8 ? `<p class="mt-1 text-xs text-[var(--text-secondary)]">+ ${carryOver.length - 8} more</p>` : ''}
    </section>`;

  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Weekly Planner</h1>
          <p class="text-sm text-[var(--text-secondary)] mt-0.5">${esc(weekLabel)}${isThisWeek ? ' · <strong class="text-indigo-400">This week</strong>' : ''}</p>
        </div>
        <div class="flex items-center gap-2" role="group" aria-label="Choose week">
          <button type="button" data-action="planner-prev" class="btn-secondary" aria-label="Previous week"><span aria-hidden="true">‹</span>&nbsp;Prev</button>
          <button type="button" data-action="planner-today" class="btn-secondary" ${isThisWeek ? 'aria-current="date"' : ''}>This week</button>
          <button type="button" data-action="planner-next" class="btn-secondary" aria-label="Next week">Next&nbsp;<span aria-hidden="true">›</span></button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-secondary)]" aria-label="Week summary">
        <span><strong class="text-[var(--text-primary)]">${esc(formatMinutes(summary.plannedMin))}</strong> planned of ${esc(formatMinutes(summary.capacityMin))}</span>
        <span><strong class="text-[var(--text-primary)]">${summary.doneCount}/${summary.taskCount}</strong> tasks done</span>
        ${summary.overDays > 0 ? `<span class="font-semibold text-rose-500"><span aria-hidden="true">⚠</span> ${summary.overDays} overloaded day${summary.overDays > 1 ? 's' : ''}</span>` : ''}
      </div>

      ${carryHtml}

      <section class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]" data-drop-unscheduled aria-label="Unscheduled tasks">
        <div class="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-[var(--border-color)]">
          <h2 class="text-sm font-semibold text-[var(--text-primary)]">Unscheduled <span class="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)] text-xs font-bold">${unscheduled.length}</span></h2>
          <p class="text-xs text-[var(--text-secondary)]">Tap a day to schedule a task, or drag it onto a day.</p>
        </div>
        <div class="p-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 max-h-80 overflow-y-auto">
          ${unscheduled.length > 0
            ? trayShown.map(t => renderPlannerTrayCard(t, weekDates, todayStr)).join('')
            : '<p class="text-sm text-[var(--text-secondary)] sm:col-span-2 xl:col-span-3">Every open task has a day. Nice.</p>'}
        </div>
        ${unscheduled.length > PLANNER_TRAY_LIMIT ? `<div class="px-3 pb-3"><button type="button" data-action="planner-tray-toggle" class="btn-secondary text-xs">${trayHidden > 0 ? `Show all ${unscheduled.length}` : 'Show fewer'}</button></div>` : ''}
      </section>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        ${weekDates.map(d => renderPlannerDay(d, s, todayStr)).join('')}
      </div>

      <section class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3" aria-label="Weekly habit consistency">
        <h2 class="text-sm font-semibold text-[var(--text-primary)] mb-2">Habit consistency</h2>
        ${renderPlannerHabitMatrix(weekDates, s, todayStr)}
      </section>
    </div>
  `;

  setupPlannerDragAndDrop(container);
}

// ----------------------------------------------------------------------------
// DRAG AND DROP (mouse). The buttons on every card are the touch alternative.
// ----------------------------------------------------------------------------

function setupPlannerDragAndDrop(container) {
  container.querySelectorAll('[data-planner-task]').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      plannerDragTaskId = card.getAttribute('data-planner-task');
      card.classList.add('opacity-50');
      try {
        e.dataTransfer.setData('text/plain', plannerDragTaskId);
        e.dataTransfer.effectAllowed = 'move';
      } catch (err) { /* some browsers restrict dataTransfer; the module variable still works */ }
    });
    card.addEventListener('dragend', () => {
      plannerDragTaskId = null;
      card.classList.remove('opacity-50');
      container.querySelectorAll('.planner-drop-over').forEach(el => el.classList.remove('planner-drop-over'));
    });
  });

  container.querySelectorAll('[data-drop-date], [data-drop-unscheduled]').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      if (!plannerDragTaskId) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
      zone.classList.add('planner-drop-over');
    });
    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('planner-drop-over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const taskId = plannerDragTaskId;
      plannerDragTaskId = null;
      zone.classList.remove('planner-drop-over');
      if (!taskId) return;
      const date = zone.hasAttribute('data-drop-date') ? zone.getAttribute('data-drop-date') : null;
      actions.scheduleTask(taskId, date);
    });
  });
}
