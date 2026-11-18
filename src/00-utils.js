// ============================================================================
// UTILS (00-utils.js)
// ============================================================================

/**
 * Application Version
 * Used for changelog, about display, and schema tracking.
 */
const APP_VERSION = '0.8.2';
if (typeof window !== 'undefined') {
  window.APP_VERSION = APP_VERSION;
}

/**
 * Changelog shown in Settings > About. Newest first. Add an entry with every milestone.
 */
const APP_CHANGELOG = [
  {
    version: '0.8.2', date: '2026-11-18', title: 'Click a card to edit it',
    notes: ['Click anywhere on a task card, on the board or in the planner, to open it for editing. The pencil still works, and the buttons on the card keep their own jobs.']
  },
  {
    version: '0.8.1', date: '2026-11-18', title: 'Rename tags',
    notes: ['Tags can be renamed in the Tag Manager: click the name, type, press Enter. Every task and journal entry with that tag updates, and you can undo.']
  },
  {
    version: '0.8.0', date: '2026-11-17', title: 'Tests and hardening (M8)',
    notes: [
      'If a screen fails to draw you now get a panel with Try again, a way out and a backup button, not a blank page',
      'Stays quick with 1,000 tasks: long board columns and the planner tray show their first cards with a Show more button',
      'More checks around midnight, month ends, year ends and clock changes; tests also run in the browser (tests/smoke.html)'
    ]
  },
  {
    version: '0.7.0', date: '2026-11-12', title: 'Welcome screen and polish (M7)',
    notes: [
      'Insights screen: four KPI cards, three charts with data tables, and plain-language notes (M5)',
      'First-run welcome: start blank or with sample data, set your daily hours and one habit',
      'Keyboard shortcut list (press ?), U to undo, arrow keys on the screen tabs',
      'Offline badge, loading placeholders, clearer empty states',
      'Accessibility pass: zoom allowed, focus stays put after every action, stronger contrast in both themes'
    ]
  },
  {
    version: '0.6.0', date: '2026-11-04', title: 'Settings and data safety (M6)',
    notes: [
      'JSON backup export and checked import with preview and undo',
      'CSV export, automatic daily backup copies, Start blank, sample data, storage meter'
    ]
  },
  {
    version: 'Earlier', date: '', title: 'Foundations (M0 to M4)',
    notes: ['Kanban board with tags and areas, focus timer and habits, weekly planner, journal']
  }
];

/**
 * HTML Escape Helper (XSS Protection)
 * Safely converts special characters to HTML entities.
 * @param {*} str - Input string or value to escape
 * @returns {string} Escaped string
 */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get local ISO date string 'YYYY-MM-DD'
 * NOTE: Never uses toISOString().slice for local dates, preventing UTC day shift.
 * @param {Date|number|string} [d=new Date()]
 * @returns {string} 'YYYY-MM-DD'
 */
function getLocalDateString(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return getLocalDateString(new Date());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse local date string 'YYYY-MM-DD' into a local Date object (at midnight)
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {Date}
 */
function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date();
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Get the ISO Monday 'YYYY-MM-DD' for a given date.
 * Weeks strictly start on Monday per SPEC.md.
 * @param {Date|string} dateOrStr
 * @returns {string} Monday 'YYYY-MM-DD'
 */
function getWeekMonday(dateOrStr) {
  const date = typeof dateOrStr === 'string' ? parseLocalDate(dateOrStr) : new Date(dateOrStr);
  if (isNaN(date.getTime())) return getWeekMonday(new Date());
  const day = date.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.getFullYear(), date.getMonth(), diff);
  return getLocalDateString(monday);
}

/**
 * Add (or subtract) whole calendar days to a 'YYYY-MM-DD' string.
 * Uses local calendar arithmetic, so daylight-saving changes never shift the date.
 * @param {string} dateStr
 * @param {number} n
 * @returns {string} 'YYYY-MM-DD'
 */
function addDaysStr(dateStr, n) {
  const d = parseLocalDate(dateStr);
  return getLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Weekday keys, Monday first, matching settings.capacityByWeekday */
const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEY_BY_GETDAY = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

/** 'YYYY-MM-DD' -> 'Mon' | 'Tue' ... */
function getDayKey(dateStr) {
  return DAY_KEY_BY_GETDAY[parseLocalDate(dateStr).getDay()];
}

/**
 * Format date string for human readable display
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
function formatDisplayDate(dateStr, options = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString(undefined, options);
}

/**
 * Generate unique ID with prefix
 * @param {string} [prefix='id']
 * @returns {string}
 */
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Debounce helper function
 * @param {Function} fn
 * @param {number} [waitMs=300]
 * @returns {Function}
 */
function debounce(fn, waitMs = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, waitMs);
  };
}

/**
 * Accessible Toast Notification System
 * Displays temporary message with optional action (e.g. Undo).
 * The container is a polite live region (role="status"), so ordinary toasts carry no role of
 * their own; only errors are announced assertively (role="alert").
 * The countdown pauses while the pointer or keyboard focus is on the toast.
 * @param {string} message
 * @param {Object} [options]
 * @param {number} [options.duration=4000] - Duration in ms (0 for persistent)
 * @param {string} [options.actionText] - Action button text (e.g. "Undo")
 * @param {Function} [options.onAction] - Action callback
 * @param {'info'|'success'|'warning'|'error'} [options.type='info']
 */
function showToast(message, options = {}) {
  const { duration = 4000, actionText = null, onAction = null, type = 'info' } = options;
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type} flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all transform duration-200 translate-y-2 opacity-0 select-none`;
  if (type === 'error') toast.setAttribute('role', 'alert');

  const textSpan = document.createElement('span');
  textSpan.className = 'font-medium';
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (actionText && typeof onAction === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] inline-flex items-center justify-center';
    actionBtn.textContent = actionText;
    if (actionText === 'Undo') {
      // Keyboard users cannot reach a toast in time, so U presses the newest Undo (see triggerLatestUndo)
      actionBtn.setAttribute('data-toast-undo', 'true');
      actionBtn.setAttribute('aria-keyshortcuts', 'U');
      actionBtn.title = 'Undo (press U)';
    }
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAction();
      dismissToast(toast);
    });
    toast.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ml-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg leading-none rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center';
  closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
  closeBtn.setAttribute('aria-label', 'Dismiss message');
  closeBtn.addEventListener('click', () => dismissToast(toast));
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  if (duration > 0) {
    let remaining = duration, startedAt = 0, timerId = null;
    const start = () => {
      if (timerId) return;
      startedAt = Date.now();
      timerId = setTimeout(() => dismissToast(toast), remaining);
    };
    const pause = () => {
      if (!timerId) return;
      clearTimeout(timerId);
      timerId = null;
      remaining = Math.max(1500, remaining - (Date.now() - startedAt));
    };
    toast.addEventListener('mouseenter', pause);
    toast.addEventListener('mouseleave', start);
    toast.addEventListener('focusin', pause);
    toast.addEventListener('focusout', start);
    start();
  }
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('opacity-0', 'translate-y-2');
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 220);
}

/** Press the Undo button of the newest toast that has one. Returns true if there was one. */
function triggerLatestUndo() {
  const container = document.getElementById('toast-container');
  if (!container || typeof container.querySelectorAll !== 'function') return false;
  const buttons = container.querySelectorAll('[data-toast-undo]');
  if (!buttons.length) return false;
  buttons[buttons.length - 1].click();
  return true;
}

// ----------------------------------------------------------------------------
// FOCUS HELPERS (M7)
// Re-rendering replaces the buttons on screen. These helpers describe the control that had
// keyboard focus (by id, or by its data-* attributes) and find its replacement afterwards,
// so keyboard users are not thrown back to the top of the page after every action.
// ----------------------------------------------------------------------------

/** @returns {{id:string}|{selector:string, fallback:string|null}|null} */
function describeFocusTarget(el) {
  if (!el || typeof el.getAttribute !== 'function') return null;
  if (el.id) return { id: el.id };
  const attrs = el.attributes ? Array.from(el.attributes).filter(a => a.name.indexOf('data-') === 0) : [];
  if (attrs.length === 0) return null;
  const q = v => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const taskAttr = attrs.find(a => a.name === 'data-task-id');
  return {
    selector: String(el.tagName || '').toLowerCase() + attrs.map(a => `[${a.name}="${q(a.value)}"]`).join(''),
    fallback: taskAttr ? `[data-task-id="${q(taskAttr.value)}"]` : null
  };
}

/** Find the control described by describeFocusTarget. If it is gone or disabled, try another control of the same task. */
function findFocusTarget(desc, root = document) {
  if (!desc) return null;
  if (desc.id) return document.getElementById(desc.id);
  if (!root || typeof root.querySelector !== 'function') return null;
  let el = null;
  try { el = root.querySelector(desc.selector); } catch (e) { el = null; }
  if (el && !el.disabled) return el;
  if (!desc.fallback) return null;
  try {
    return Array.from(root.querySelectorAll(desc.fallback))
      .find(x => !x.disabled && /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(String(x.tagName))) || null;
  } catch (e) {
    return null;
  }
}
