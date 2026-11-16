// ============================================================================
// TIMER & HABITS STRIP (03-timer.js)
// Focus timer (timestamp based), chime, task linking, today's habit strip,
// and the habit manager modal. Milestone M2.
// ============================================================================

// The four timer lengths are slots, in this order: Focus, Deep work, Sprint, Break.
// Their minutes are editable in Settings; the Break slot is never logged as focus time.
const TIMER_PRESET_ROLES = [
  { label: 'Focus' },
  { label: 'Deep work' },
  { label: 'Sprint' },
  { label: 'Break', mode: 'break' }
];

let lastTimerBarHtml = '';
let lastHabitStripHtml = '';

// ----------------------------------------------------------------------------
// PURE HELPERS (unit tested)
// ----------------------------------------------------------------------------

/** The current timer lengths in slot order, from Settings */
function getTimerPresetList() {
  const s = (typeof getState === 'function') ? getState() : null;
  const p = s && s.settings && s.settings.timerPresets;
  return (Array.isArray(p) && p.length === 4 ? p : [25, 50, 15, 5]).map(Number);
}

function getTimerPresetMeta(min) {
  const i = getTimerPresetList().indexOf(Number(min));
  return TIMER_PRESET_ROLES[i] || { label: `${min} min` };
}

function getTimerModeForPreset(min) {
  return getTimerPresetMeta(Number(min)).mode === 'break' ? 'break' : 'focus';
}

/** Elapsed ms, always derived from timestamps (never from counting ticks). */
function getTimerElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const acc = Number(timer.accumulatedMs) || 0;
  if (timer.status === 'running' && timer.startedAt) {
    return acc + Math.max(0, now - timer.startedAt);
  }
  return acc;
}

function getTimerDurationMs(timer) {
  return (Number(timer && timer.presetMin) || 25) * 60000;
}

function getTimerRemainingMs(timer, now = Date.now()) {
  return Math.max(0, getTimerDurationMs(timer) - getTimerElapsedMs(timer, now));
}

/** 1500000 -> '25:00'. Rounds up so the clock never shows 00:00 while time remains. */
function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** 75 -> '1h 15m', 25 -> '25m' */
function formatMinutes(n) {
  const mins = Math.max(0, Math.round(Number(n) || 0));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function truncateText(str, max) {
  const text = String(str || '');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** Returns the linked task id only if that task still exists and is not deleted. */
function resolveLinkedTaskId(s) {
  const id = s && s.timer && s.timer.linkedTaskId;
  if (!id) return null;
  const task = (s.tasks || []).find(t => t.id === id && !t.deletedAt);
  return task ? task.id : null;
}

function getFirstFocusPreset(s) {
  const presets = (s.settings && s.settings.timerPresets) || [25, 50, 15, 5];
  return Number(presets.find(p => getTimerModeForPreset(p) === 'focus')) || 25;
}

// ----------------------------------------------------------------------------
// TIMER SERVICE
// ----------------------------------------------------------------------------

const timerService = {
  _interval: null,
  _audioCtx: null,
  _lastDate: null,

  /** Start the 1-second display loop. Safe to call more than once. */
  init() {
    if (this._interval) return;
    this._interval = setInterval(() => this.tick(), 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.tick();
    });
    this.tick(true);
  },

  /**
   * Called every second and when the tab becomes visible again.
   * Only updates the clock text; the time itself always comes from timestamps.
   */
  tick(fromLoad = false) {
    const s = getState();
    const t = s.timer;
    if (t.status === 'running' && getTimerRemainingMs(t) <= 0) {
      this.complete({ fromLoad });
    }
    // Midnight rollover: refresh "today" totals and today's habits
    const today = getLocalDateString(new Date());
    if (this._lastDate && this._lastDate !== today) {
      renderTimerBar();
      renderHabitStrip();
    }
    this._lastDate = today;
    this.updateDisplay();
  },

  updateDisplay() {
    const s = getState();
    const t = s.timer;
    const text = formatClock(t.status === 'idle' ? getTimerDurationMs(t) : getTimerRemainingMs(t));
    const el = document.getElementById('timer-display');
    if (el && el.textContent !== text) el.textContent = text;

    let title = 'FlowBoard Work OS';
    if (t.status !== 'idle') {
      const label = t.mode === 'break' ? 'Break' : 'Focus';
      title = `${t.status === 'paused' ? '⏸ ' : ''}${text} ${label} · FlowBoard`;
    }
    if (document.title !== title) document.title = title;
  },

  // ---- Audio (created on the first user gesture, per browser autoplay rules) ----
  ensureAudio() {
    try {
      if (!this._audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this._audioCtx = new Ctx();
      }
      if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
      return this._audioCtx;
    } catch (e) {
      return null;
    }
  },

  playChime() {
    const s = getState();
    if (!s.settings.soundEnabled) return;
    const ctx = this.ensureAudio();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + 0.02;
      [[880, 0], [1108.73, 0.18], [1318.51, 0.36]].forEach(([freq, offset]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, t0 + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.7);
      });
    } catch (e) {
      // Audio is a nice-to-have; never break the app because of it
    }
  },

  // ---- Controls ----
  toggle() {
    const status = getState().timer.status;
    if (status === 'running') this.pause();
    else this.start();
  },

  start() {
    this.ensureAudio();
    const s = getState();
    const t = s.timer;
    if (t.status === 'running') return;
    const now = Date.now();
    if (t.status === 'idle') {
      t.accumulatedMs = 0;
      t.sessionStartedAt = now;
      t.mode = getTimerModeForPreset(t.presetMin);
    }
    t.startedAt = now;
    t.status = 'running';
    saveState(s, true);
    renderTimerBar();
    this.updateDisplay();
  },

  pause() {
    const s = getState();
    const t = s.timer;
    if (t.status !== 'running') return;
    t.accumulatedMs = getTimerElapsedMs(t);
    t.startedAt = null;
    t.status = 'paused';
    saveState(s, true);
    renderTimerBar();
    this.updateDisplay();
  },

  reset() {
    const s = getState();
    this._clearTimer(s.timer);
    saveState(s, true);
    renderTimerBar();
    this.updateDisplay();
  },

  _clearTimer(t) {
    t.status = 'idle';
    t.startedAt = null;
    t.accumulatedMs = 0;
    t.sessionStartedAt = null;
  },

  /** Change the length. Only allowed while idle so a running session is never lost. */
  setPreset(min) {
    const s = getState();
    const t = s.timer;
    if (t.status !== 'idle') return;
    const allowed = (s.settings.timerPresets || []).map(Number);
    const value = Number(min);
    if (!allowed.includes(value)) return;
    t.presetMin = value;
    t.mode = getTimerModeForPreset(value);
    saveState(s, true);
    renderTimerBar();
    this.updateDisplay();
  },

  linkTask(taskId) {
    const s = getState();
    const task = taskId ? (s.tasks || []).find(x => x.id === taskId && !x.deletedAt) : null;
    s.timer.linkedTaskId = task ? task.id : null;
    saveState(s, true);
    renderTimerBar();
  },

  /** Kanban card "Focus" button: link the task, and offer to start. */
  focusOnTask(taskId) {
    const s = getState();
    const task = (s.tasks || []).find(x => x.id === taskId && !x.deletedAt);
    if (!task) return;
    const t = s.timer;
    if (t.status === 'idle' && t.mode === 'break') {
      t.presetMin = getFirstFocusPreset(s);
      t.mode = 'focus';
    }
    t.linkedTaskId = task.id;
    saveState(s, true);
    renderTimerBar();
    this.updateDisplay();
    if (t.status === 'idle') {
      showToast(`Linked to timer: ${truncateText(task.title, 40)}`, {
        duration: 6000,
        actionText: 'Start',
        onAction: () => this.start()
      });
    } else {
      showToast(`Timer now linked to: ${truncateText(task.title, 40)}`, { duration: 4000 });
    }
  },

  /** "+Log": record the minutes elapsed so far to the linked task, then stop. */
  logElapsed() {
    const s = getState();
    const t = s.timer;
    if (t.status === 'idle') {
      showToast('Start the timer first, then log your time.', { type: 'info' });
      return;
    }
    if (t.mode === 'break') {
      showToast('Breaks are not logged as focus time.', { type: 'info' });
      return;
    }
    const elapsed = getTimerElapsedMs(t);
    const minutes = Math.round(elapsed / 60000);
    if (minutes < 1) {
      showToast('Less than 30 seconds so far, nothing to log yet.', { type: 'info' });
      return;
    }
    const taskId = resolveLinkedTaskId(s);
    const task = taskId ? s.tasks.find(x => x.id === taskId) : null;
    const startedAt = t.sessionStartedAt || (Date.now() - elapsed);

    this._clearTimer(t);                 // stop first, so this session can never be logged twice
    saveState(s, true);
    actions.logFocus({
      taskId,
      minutes,
      date: getLocalDateString(new Date(startedAt)),
      startedAt
    });
    this.updateDisplay();
    showToast(`Logged ${minutes} min${task ? ` to “${truncateText(task.title, 40)}”` : ' (no task linked)'}`, {
      type: 'success',
      duration: 5000
    });
  },

  /** Called when a running timer reaches zero. Guarded so it can only fire once. */
  complete({ fromLoad = false } = {}) {
    const s = getState();
    const t = s.timer;
    if (t.status !== 'running') return;

    const wasBreak = t.mode === 'break';
    const minutes = Number(t.presetMin) || 25;
    const startedAt = t.sessionStartedAt || (Date.now() - minutes * 60000);
    const taskId = resolveLinkedTaskId(s);
    const task = taskId ? s.tasks.find(x => x.id === taskId) : null;

    // Stop and persist BEFORE logging, so a reload can never log the same session twice
    this._clearTimer(t);
    saveState(s, true);

    if (wasBreak) {
      renderTimerBar();
      if (!fromLoad) this.playChime();
      showToast(fromLoad ? 'Your break finished while FlowBoard was closed.' : 'Break over. Ready for the next focus session?', {
        type: 'info',
        duration: 6000
      });
      return;
    }

    actions.logFocus({
      taskId,
      minutes,
      date: getLocalDateString(new Date(startedAt)),
      startedAt
    });
    if (!fromLoad) this.playChime();
    const where = task ? ` to “${truncateText(task.title, 40)}”` : '';
    showToast(
      fromLoad
        ? `Your timer finished while FlowBoard was closed. ${minutes} min logged${where}.`
        : `Focus session complete: ${minutes} min logged${where}`,
      { type: 'success', duration: 7000 }
    );
  }
};

// ----------------------------------------------------------------------------
// RENDER: TIMER BAR (top command bar)
// ----------------------------------------------------------------------------

function setHtmlKeepFocus(el, html) {
  const active = document.activeElement;
  const activeId = active && el.contains(active) ? active.id : '';
  el.innerHTML = html;
  if (activeId) {
    const again = document.getElementById(activeId);
    if (again && typeof again.focus === 'function') again.focus();
  }
}

function buildTaskOptionsHtml(s) {
  const options = selectors.getTimerTaskOptions(s);
  const linkedId = resolveLinkedTaskId(s);
  const groups = [
    ['inprogress', 'In progress'],
    ['todo', 'To do'],
    ['backlog', 'Backlog'],
    ['done', 'Done']
  ];
  const groupHtml = groups.map(([status, label]) => {
    const items = options.filter(t => t.status === status);
    if (items.length === 0) return '';
    return `<optgroup label="${esc(label)}">${items.map(t =>
      `<option value="${esc(t.id)}" ${t.id === linkedId ? 'selected' : ''}>${esc(truncateText(t.title, 42))}</option>`
    ).join('')}</optgroup>`;
  }).join('');
  return `<option value="" ${linkedId ? '' : 'selected'}>No task linked</option>${groupHtml}`;
}

function renderTimerBar() {
  const el = document.getElementById('timer-bar');
  if (!el) return;

  const s = getState();
  const t = s.timer;
  const idle = t.status === 'idle';
  const running = t.status === 'running';
  const isBreak = t.mode === 'break';
  const presets = (s.settings.timerPresets || [25, 50, 15, 5]).map(Number);
  const clock = formatClock(idle ? getTimerDurationMs(t) : getTimerRemainingMs(t));
  const todayMin = selectors.getFocusMinutesOn(getLocalDateString(new Date()), s);
  const modeLabel = isBreak ? 'Break' : (t.status === 'paused' ? 'Paused' : 'Focus');
  const dotClass = running ? (isBreak ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse') : 'bg-neutral-500';
  const sound = Boolean(s.settings.soundEnabled);

  const presetBtns = presets.map(min => {
    const meta = getTimerPresetMeta(min);
    const active = Number(t.presetMin) === min;
    return `<button type="button" id="timer-preset-${min}" data-action="timer-preset" data-minutes="${min}"
      aria-pressed="${active ? 'true' : 'false'}" ${idle ? '' : 'disabled'}
      title="${esc(meta.label)} (${min} min)"
      class="px-3 rounded-xl border text-sm font-semibold transition-colors ${active
        ? 'bg-[var(--accent)] text-white border-transparent'
        : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}">${min}m</button>`;
  }).join('');

  const toggleLabel = running ? 'Pause' : (t.status === 'paused' ? 'Resume' : 'Start');
  const toggleIcon = running
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 9v6m4-6v6"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 5v14l11-7z"/>';

  const html = `
    <div class="flex flex-wrap items-center gap-2 w-full lg:justify-center" role="group" aria-label="Focus timer">
      <div class="flex items-center gap-2 px-3 min-h-[44px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span class="w-2 h-2 rounded-full ${dotClass}" aria-hidden="true"></span>
        <span id="timer-display" role="timer" aria-live="off" class="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">${esc(clock)}</span>
        <span class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">${esc(modeLabel)}</span>
      </div>

      <button type="button" id="timer-toggle-btn" data-action="timer-toggle" class="btn-primary gap-1.5">
        <svg class="w-4 h-4" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${toggleIcon}</svg>
        <span>${toggleLabel}</span>
      </button>

      <button type="button" id="timer-reset-btn" data-action="timer-reset" class="btn-icon" aria-label="Reset timer" title="Reset timer" ${idle ? 'disabled' : ''}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0018.4 9M18.4 9L20 9M5.6 15L4 15"/></svg>
      </button>

      <div class="flex items-center gap-1" role="group" aria-label="Timer length">${presetBtns}</div>

      <label for="timer-task-select" class="sr-only">Task linked to the timer</label>
      <select id="timer-task-select" class="px-3 min-h-[44px] max-w-[200px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)]">
        ${buildTaskOptionsHtml(s)}
      </select>

      <button type="button" id="timer-log-btn" data-action="timer-log" class="btn-secondary" ${(idle || isBreak) ? 'disabled' : ''} title="Log elapsed time to the linked task and stop">+ Log</button>

      <button type="button" id="timer-sound-btn" data-action="toggle-sound" class="btn-icon" aria-pressed="${sound ? 'true' : 'false'}"
        aria-label="${sound ? 'Mute timer chime' : 'Unmute timer chime'}" title="${sound ? 'Chime on' : 'Chime off'}">
        ${sound
          ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"/></svg>'
          : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 14l4-4m0 4l-4-4"/></svg>'}
      </button>

      <span class="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-sm font-medium text-[var(--text-secondary)]" title="Focus time logged today">
        <span aria-hidden="true">🎯</span><span><strong class="text-[var(--text-primary)]">${esc(formatMinutes(todayMin))}</strong> today</span>
      </span>
    </div>
  `;

  if (html === lastTimerBarHtml && el.childElementCount > 0) return;
  lastTimerBarHtml = html;
  setHtmlKeepFocus(el, html);
}

// ----------------------------------------------------------------------------
// RENDER: TODAY'S HABITS STRIP
// ----------------------------------------------------------------------------

function renderHabitStrip() {
  const el = document.getElementById('habit-strip');
  if (!el) return;

  const s = getState();
  const today = getLocalDateString(new Date());
  const due = selectors.getHabitsDueOn(today, s);
  const doneCount = due.filter(h => selectors.isHabitDone(h.id, today, s)).length;

  const chips = due.map(h => {
    const done = selectors.isHabitDone(h.id, today, s);
    const streak = selectors.getHabitStreak(h.id, s, today);
    return `<button type="button" id="habit-chip-${esc(h.id)}" data-action="toggle-habit" data-habit-id="${esc(h.id)}"
      aria-pressed="${done ? 'true' : 'false'}"
      title="${done ? 'Done today. Click to undo' : 'Mark done for today'}"
      class="inline-flex items-center gap-1.5 px-3 rounded-full border text-sm font-medium whitespace-nowrap transition-colors ${done
        ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
        : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}">
      <span aria-hidden="true" class="font-bold">${done ? '✓' : '○'}</span>
      <span>${esc(truncateText(h.title, 28))}</span>
      ${streak >= 2 ? `<span class="text-xs opacity-80" title="${streak}-day streak"><span aria-hidden="true">🔥</span>${streak}</span>` : ''}
    </button>`;
  }).join('');

  const html = `
    <div class="flex items-center gap-2 py-1.5 overflow-x-auto" role="group" aria-label="Today’s habits">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">Habits ${due.length ? `${doneCount}/${due.length}` : ''}</span>
      ${chips || '<span class="text-sm text-[var(--text-secondary)] whitespace-nowrap">None scheduled today</span>'}
      <button type="button" id="habit-manage-btn" data-action="open-habit-manager" class="btn-icon flex-shrink-0" aria-label="Manage habits" title="Manage habits">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
      </button>
    </div>
  `;

  if (html === lastHabitStripHtml && el.childElementCount > 0) return;
  lastHabitStripHtml = html;
  setHtmlKeepFocus(el, html);
}

// ----------------------------------------------------------------------------
// HABIT MANAGER MODAL
// ----------------------------------------------------------------------------

const HABIT_DAY_ORDER = [
  { v: 1, l: 'M', n: 'Monday' }, { v: 2, l: 'T', n: 'Tuesday' }, { v: 3, l: 'W', n: 'Wednesday' },
  { v: 4, l: 'T', n: 'Thursday' }, { v: 5, l: 'F', n: 'Friday' }, { v: 6, l: 'S', n: 'Saturday' },
  { v: 0, l: 'S', n: 'Sunday' }
];

function buildHabitDayChips(groupName, selected, habitId) {
  return HABIT_DAY_ORDER.map(d => `
    <label class="relative cursor-pointer" title="${d.n}">
      <input type="checkbox" class="peer sr-only" name="${esc(groupName)}" value="${d.v}" aria-label="${d.n}"
        ${habitId ? `data-habit-day-id="${esc(habitId)}"` : ''} ${selected.includes(d.v) ? 'checked' : ''}>
      <span class="flex items-center justify-center w-11 h-11 rounded-lg text-xs font-semibold border border-[var(--border-color)] text-[var(--text-secondary)] select-none
        peer-checked:bg-[var(--accent)] peer-checked:text-white peer-checked:border-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400">${d.l}</span>
    </label>`).join('');
}

function buildHabitManagerHtml() {
  const habits = selectors.getActiveHabits();
  const rows = habits.map(h => `
    <div class="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] space-y-2" data-habit-row="${esc(h.id)}">
      <div class="flex items-center gap-2">
        <input type="text" class="habit-rename-input flex-1 min-w-0 px-3 py-2 min-h-[44px] text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
          value="${esc(h.title)}" data-habit-id="${esc(h.id)}" maxlength="60" aria-label="Habit name">
        <button type="button" data-action="delete-habit" data-habit-id="${esc(h.id)}"
          class="btn-icon hover:bg-red-500/10 hover:text-red-400" aria-label="Delete habit ${esc(h.title)}" title="Delete habit">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
      <div class="flex flex-wrap gap-1" role="group" aria-label="Days for ${esc(h.title)}">${buildHabitDayChips('days-' + h.id, h.targetDays || [], h.id)}</div>
    </div>`).join('');

  return `
    <div class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="modal-habit-title">
      <div class="flex items-center justify-between mb-4">
        <h2 id="modal-habit-title" class="text-lg font-bold">Habits</h2>
        <button type="button" data-action="close-modal" class="btn-icon" aria-label="Close">&times;</button>
      </div>

      <form id="habit-create-form" class="space-y-3 mb-5 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div>
          <label for="new-habit-name" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">New habit</label>
          <input id="new-habit-name" name="title" type="text" required maxlength="60" placeholder="e.g. 90m morning deep work"
            class="w-full px-3 py-2 min-h-[44px] text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]">
        </div>
        <div>
          <span class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Repeat on</span>
          <div class="flex flex-wrap gap-1" role="group" aria-label="Repeat on">${buildHabitDayChips('days', [1, 2, 3, 4, 5], null)}</div>
        </div>
        <button type="submit" class="btn-primary">Add habit</button>
      </form>

      <div class="space-y-2 max-h-[40vh] overflow-y-auto">
        ${rows || '<p class="text-sm text-[var(--text-secondary)]">No habits yet. Add your first one above.</p>'}
      </div>

      <div class="flex justify-end mt-5">
        <button type="button" data-action="close-modal" class="btn-secondary">Done</button>
      </div>
    </div>
  `;
}

function openHabitManagerModal(refresh = false) {
  const html = buildHabitManagerHtml();
  const existing = document.getElementById('app-modal-overlay');
  if (refresh && existing) {
    existing.innerHTML = html;
    const input = existing.querySelector('#new-habit-name');
    if (input) input.focus();
  } else {
    openModal(html, '#new-habit-name');
  }

  const overlay = document.getElementById('app-modal-overlay');
  if (!overlay) return;

  overlay.onsubmit = (e) => {
    if (!e.target || e.target.id !== 'habit-create-form') return;
    e.preventDefault();
    const form = e.target;
    const title = form.elements['title'].value;
    const days = [...form.querySelectorAll('input[name="days"]:checked')].map(i => Number(i.value));
    if (days.length === 0) {
      showToast('Pick at least one day for the habit.', { type: 'warning' });
      return;
    }
    if (actions.addHabit({ title, targetDays: days })) openHabitManagerModal(true);
  };

  overlay.onchange = (e) => {
    const el = e.target;
    if (!el) return;
    if (el.classList && el.classList.contains('habit-rename-input')) {
      actions.updateHabit(el.getAttribute('data-habit-id'), { title: el.value });
    } else if (el.getAttribute && el.getAttribute('data-habit-day-id')) {
      const id = el.getAttribute('data-habit-day-id');
      const days = [...overlay.querySelectorAll(`input[data-habit-day-id="${id}"]:checked`)].map(i => Number(i.value));
      if (days.length === 0) {
        showToast('A habit needs at least one day.', { type: 'warning' });
        openHabitManagerModal(true);   // restore the checkbox the user just cleared
        return;
      }
      actions.updateHabit(id, { targetDays: days });
    }
  };
}

/** Called by habit actions so an open manager never shows stale rows. */
function refreshHabitManagerIfOpen() {
  const overlay = document.getElementById('app-modal-overlay');
  if (overlay && overlay.querySelector && overlay.querySelector('#habit-create-form')) {
    openHabitManagerModal(true);
  }
}
