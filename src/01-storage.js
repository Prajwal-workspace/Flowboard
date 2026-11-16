// ============================================================================
// STORAGE (01-storage.js)
// ============================================================================

const STORAGE_KEY = 'flowboard_work_os_v1';

// While the recovery screen is showing, FlowBoard is running on a blank stand-in state.
// Nothing may be saved over the user's unreadable data until they choose what to do.
let storageRecoveryActive = false;
const CURRENT_SCHEMA_VERSION = 3;

/**
 * Default area seed data for schema v3
 */
const DEFAULT_AREAS = [
  { id: 'area-work',     name: 'Work',     color: 'blue',    icon: '💼', order: 1000 },
  { id: 'area-personal', name: 'Personal', color: 'emerald', icon: '🏠', order: 2000 },
  { id: 'area-health',   name: 'Health',   color: 'rose',    icon: '❤️', order: 3000 },
  { id: 'area-learning', name: 'Learning', color: 'amber',   icon: '📚', order: 4000 }
];

/**
 * Generates the default blank state conforming to schemaVersion: 3
 * @returns {Object} Default State
 */
function getDefaultState() {
  const today = getLocalDateString(new Date());
  const monday = getWeekMonday(today);
  const now = Date.now();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    deviceId: generateId('dev'),
    settings: {
      theme: 'dark', // 'dark' | 'light' | 'system'
      compactCards: false,
      soundEnabled: true,
      dailyCapacityHours: 6,
      capacityByWeekday: {
        Mon: 6,
        Tue: 6,
        Wed: 6,
        Thu: 6,
        Fri: 6,
        Sat: 2,
        Sun: 0
      },
      wipLimit: 3,
      weekStartsOn: 1, // 1 = Monday
      timerPresets: [25, 50, 15, 5],
      autoBackup: true
    },
    ui: {
      activeView: 'kanban', // 'kanban' | 'planner' | 'journal' | 'insights' | 'settings'
      activeTagFilter: 'all',
      searchQuery: '',
      plannerWeek: monday,
      journalDate: today,
      journalSearch: '',
      insightsRange: 'last-7',        // 'this-week' | 'last-7' | 'last-30' (M5)
      insightsTables: false,          // show the chart numbers as tables (M5)
      showOlderDone: false,
      // M1.1 toolbar state
      kanbanGroupBy: 'none',          // 'none' | 'area' | 'priority' | 'tag'
      kanbanSortBy: 'manual',         // 'manual' | 'priority' | 'estimate' | 'scheduled'
      kanbanFilterArea: 'all',        // 'all' | area id
      kanbanFilterPriority: 'all',    // 'all' | 'urgent' | 'high' | 'medium' | 'low'
      kanbanFilterScheduled: 'all',   // 'all' | 'scheduled' | 'unscheduled'
      kanbanCollapsedColumns: {},     // { [status]: true }
      kanbanCollapsedGroups: {},      // { [groupKey]: true }
      kanbanFiltersOpen: false,       // mobile filter panel open
      kanbanSavedView: null           // null | 'today' | 'this-week' | 'urgent' | 'unscheduled'
    },
    areas: DEFAULT_AREAS.map(a => ({
      ...a,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })),
    timer: {
      status: 'idle', // 'idle' | 'running' | 'paused'
      mode: 'focus', // 'focus' | 'break'
      presetMin: 25,
      startedAt: null, // epoch ms when the current run began
      sessionStartedAt: null, // epoch ms when the whole session first started (survives pauses)
      accumulatedMs: 0,
      linkedTaskId: null
    },
    tags: [
      {
        id: 'tag-1',
        name: 'Deep Work',
        color: 'indigo',
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
    ],
    tasks: [],
    focusLog: [],
    dayIntentions: [],
    habits: [
      {
        id: 'h-1',
        title: '90m Morning Deep Work',
        targetDays: [1, 2, 3, 4, 5],
        archived: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
    ],
    habitLog: [],
    journalEntries: [],
    meta: {
      lastBackupAt: 0,
      lastSyncAt: 0,
      onboarded: true
    }
  };
}

/**
 * Migration rule: Upgrades raw state from earlier versions to CURRENT_SCHEMA_VERSION
 * @param {Object} rawState
 * @returns {Object} Migrated state
 */
function migrate(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return getDefaultState();
  }

  let state = { ...rawState };
  const v = state.schemaVersion || 1;

  if (v < 2) {
    // Migration from v1 to v2
    // v1 had day: 'Mon', habits with days, todayFocusMinutes
    state.schemaVersion = 2;
    if (!state.deviceId) state.deviceId = generateId('dev');
    if (!state.settings) state.settings = {};
    if (!state.settings.capacityByWeekday) {
      state.settings.capacityByWeekday = {
        Mon: state.settings.dailyCapacityHours || 6,
        Tue: state.settings.dailyCapacityHours || 6,
        Wed: state.settings.dailyCapacityHours || 6,
        Thu: state.settings.dailyCapacityHours || 6,
        Fri: state.settings.dailyCapacityHours || 6,
        Sat: 2,
        Sun: 0
      };
    }
    if (!state.settings.timerPresets) state.settings.timerPresets = [25, 50, 15, 5];
    if (state.settings.wipLimit === undefined) state.settings.wipLimit = 3;
    if (state.settings.weekStartsOn === undefined) state.settings.weekStartsOn = 1;

    if (!state.ui) state.ui = {};
    if (!state.ui.plannerWeek) state.ui.plannerWeek = getWeekMonday(new Date());
    if (!state.ui.journalDate) state.ui.journalDate = getLocalDateString(new Date());
    if (state.ui.showOlderDone === undefined) state.ui.showOlderDone = false;

    if (!Array.isArray(state.tags)) state.tags = [];
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.focusLog)) state.focusLog = [];
    if (!Array.isArray(state.dayIntentions)) state.dayIntentions = [];
    if (!Array.isArray(state.habits)) state.habits = [];
    if (!Array.isArray(state.habitLog)) state.habitLog = [];
    if (!Array.isArray(state.journalEntries)) state.journalEntries = [];
    if (!state.meta) state.meta = { lastBackupAt: 0, lastSyncAt: 0, onboarded: true };

    // Migrate tasks if needed
    state.tasks = state.tasks.map(t => {
      return {
        ...t,
        scheduledDate: t.scheduledDate || (t.day ? getLocalDateString(new Date()) : null),
        order: t.order || 1000,
        completedAt: t.completedAt || (t.status === 'done' ? Date.now() : null),
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        tagIds: Array.isArray(t.tagIds) ? t.tagIds : (t.tags || [])
      };
    });
  }

  // ── v2 → v3: Areas + areaId on tasks + new ui toolbar fields ───────────────
  if (state.schemaVersion < 3) {
    state.schemaVersion = 3;
    const now3 = Date.now();

    // Seed default areas if none exist
    if (!Array.isArray(state.areas) || state.areas.length === 0) {
      state.areas = DEFAULT_AREAS.map(a => ({
        ...a,
        createdAt: now3,
        updatedAt: now3,
        deletedAt: null
      }));
    }

    // Add areaId: null to every existing task
    if (Array.isArray(state.tasks)) {
      state.tasks = state.tasks.map(t => ({
        areaId: null,
        ...t
      }));
    }

    // Patch new ui toolbar fields with defaults
    if (!state.ui) state.ui = {};
    if (state.ui.kanbanGroupBy === undefined) state.ui.kanbanGroupBy = 'none';
    if (state.ui.kanbanSortBy === undefined) state.ui.kanbanSortBy = 'manual';
    if (state.ui.kanbanFilterArea === undefined) state.ui.kanbanFilterArea = 'all';
    if (state.ui.kanbanFilterPriority === undefined) state.ui.kanbanFilterPriority = 'all';
    if (state.ui.kanbanFilterScheduled === undefined) state.ui.kanbanFilterScheduled = 'all';
    if (!state.ui.kanbanCollapsedColumns) state.ui.kanbanCollapsedColumns = {};
    if (!state.ui.kanbanCollapsedGroups) state.ui.kanbanCollapsedGroups = {};
    if (state.ui.kanbanFiltersOpen === undefined) state.ui.kanbanFiltersOpen = false;
    if (state.ui.kanbanSavedView === undefined) state.ui.kanbanSavedView = null;
  }

  // Ensure default structures exist
  const defaults = getDefaultState();
  state.settings = { ...defaults.settings, ...(state.settings || {}) };
  state.ui = { ...defaults.ui, ...(state.ui || {}) };
  state.timer = { ...defaults.timer, ...(state.timer || {}) };
  state.meta = { ...defaults.meta, ...(state.meta || {}) };
  if (!Array.isArray(state.areas)) state.areas = defaults.areas;

  return state;
}

/**
 * Safely loads state from localStorage with migration and corruption recovery
 * @returns {Object} Application state
 */
function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Nothing saved yet: a brand-new browser. The welcome screen (M7) shows until it is finished or skipped.
      const fresh = getDefaultState();
      fresh.meta.onboarded = false;
      saveStateImmediate(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (err) {
    console.error('[Storage] Error loading state from localStorage:', err);
    showCorruptedStateModal(raw, err);
    return getDefaultState();
  }
}

/**
 * Saves state to localStorage with debouncing
 */
const saveStateDebounced = debounce((stateToSave) => {
  saveStateImmediate(stateToSave);
}, 300);

/**
 * Saves state immediately (synchronously) to localStorage with error handling
 * @param {Object} stateToSave
 * @returns {boolean} Success
 */
function saveStateImmediate(stateToSave) {
  try {
    if (!stateToSave || storageRecoveryActive) return false;
    const serialized = JSON.stringify(stateToSave);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    console.error('[Storage] Error saving state to localStorage:', err);
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      showToast('Storage quota exceeded! Export a backup from Settings.', {
        type: 'error',
        duration: 8000,
        actionText: 'Backup',
        onAction: () => exportBackupFile(stateToSave)
      });
    } else {
      showToast('Failed to save changes locally.', { type: 'error' });
    }
    return false;
  }
}

/**
 * Master save function
 * @param {Object} stateObj
 * @param {boolean} [immediate=false]
 */
function saveState(stateObj, immediate = false) {
  if (immediate) {
    saveStateImmediate(stateObj);
  } else {
    saveStateDebounced(stateObj);
  }
}

/**
 * Downloads a state object as a JSON file
 * @param {Object|string} data
 * @param {string} [filename]
 */
function exportBackupFile(data, filename) {
  try {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `flowboard_backup_${getLocalDateString(new Date())}_v${CURRENT_SCHEMA_VERSION}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[Storage] Failed to download backup:', err);
    showToast('Failed to generate backup download.', { type: 'error' });
  }
}

/**
 * Displays the storage recovery screen.
 *
 * Real use (FlowBoard cannot read the saved data): the user can download the unreadable data,
 * or reset. Reset needs a second confirmation, and a safety copy of the unreadable data is
 * kept in localStorage so nothing is lost by a mis-click.
 *
 * Preview (options.preview, from Settings > Test): shows the same screen with no destructive
 * button at all, and can be closed.
 *
 * @param {string} rawCorruptedData
 * @param {Error} error
 * @param {{preview?: boolean}} [options]
 */
function showCorruptedStateModal(rawCorruptedData, error, options = {}) {
  const preview = Boolean(options && options.preview);
  const backupKey = STORAGE_KEY + '_corrupted_backup';

  if (!preview) storageRecoveryActive = true;
  if (!preview && rawCorruptedData) {
    try { localStorage.setItem(backupKey, rawCorruptedData); } catch (e) { /* storage may be full */ }
  }

  const previouslyFocused = document.activeElement;
  let modal = document.getElementById('corrupted-state-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'corrupted-state-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm';
    document.body.appendChild(modal);
  }

  const close = () => {
    modal.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
  };
  const download = () => exportBackupFile(
    rawCorruptedData || '{}',
    preview ? 'flowboard_recovery_preview.json' : `flowboard_corrupted_recovery_${Date.now()}.json`
  );
  const focusFirst = (id) => setTimeout(() => { const el = document.getElementById(id); if (el) el.focus(); }, 0);

  const warnIcon = `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>`;

  const renderMain = () => {
    modal.innerHTML = `
      <div class="bg-neutral-900 border ${preview ? 'border-amber-500/50' : 'border-red-500/50'} rounded-2xl p-6 max-w-md w-full shadow-2xl text-neutral-100" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title">
        <div class="flex items-center gap-3 mb-4 ${preview ? 'text-amber-400' : 'text-red-400'}">
          ${warnIcon}
          <h2 id="recovery-title" class="text-xl font-bold">Storage Recovery Alert${preview ? ' (preview)' : ''}</h2>
        </div>
        ${preview ? `
          <p class="text-sm text-neutral-300 mb-4 leading-relaxed">
            This is only a preview of the screen you would see if FlowBoard could not read your saved data.
            <strong class="text-amber-300">Nothing has been changed or deleted.</strong>
          </p>
          <div class="flex flex-col sm:flex-row gap-3 mt-6">
            <button type="button" id="btn-download-corrupted" class="flex-1 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium border border-neutral-700 text-neutral-200 transition-colors">Download sample file</button>
            <button type="button" id="btn-close-preview" class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors">Close preview</button>
          </div>` : `
          <p class="text-sm text-neutral-300 mb-4 leading-relaxed">
            FlowBoard could not read your saved data (${esc(error?.message || 'Invalid JSON format')}).
            Download the unreadable data first so nothing is lost, then reset to start clean.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 mt-6">
            <button type="button" id="btn-download-corrupted" class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors">Download Raw Backup</button>
            <button type="button" id="btn-reset-clean" class="flex-1 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium border border-neutral-700 text-red-300 transition-colors">Reset to Clean State…</button>
          </div>`}
      </div>`;
    document.getElementById('btn-download-corrupted')?.addEventListener('click', download);
    document.getElementById('btn-close-preview')?.addEventListener('click', close);
    document.getElementById('btn-reset-clean')?.addEventListener('click', renderConfirm);
    focusFirst(preview ? 'btn-close-preview' : 'btn-download-corrupted');
  };

  // Real use only: second step before anything is deleted
  const renderConfirm = () => {
    modal.innerHTML = `
      <div class="bg-neutral-900 border border-red-500/60 rounded-2xl p-6 max-w-md w-full shadow-2xl text-neutral-100" role="alertdialog" aria-modal="true" aria-labelledby="recovery-confirm-title">
        <div class="flex items-center gap-3 mb-4 text-red-400">
          ${warnIcon}
          <h2 id="recovery-confirm-title" class="text-xl font-bold">Delete all FlowBoard data?</h2>
        </div>
        <p class="text-sm text-neutral-300 mb-4 leading-relaxed">
          This starts FlowBoard from scratch in this browser and cannot be undone. A safety copy of the unreadable data is kept in this browser,
          but please use <strong>Go back</strong> and download it first if you have not.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 mt-6">
          <button type="button" id="btn-reset-back" class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors">Go back</button>
          <button type="button" id="btn-reset-confirm" class="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors">Yes, delete everything</button>
        </div>
      </div>`;
    document.getElementById('btn-reset-back')?.addEventListener('click', renderMain);
    document.getElementById('btn-reset-confirm')?.addEventListener('click', () => {
      try {
        localStorage.removeItem(STORAGE_KEY);   // the *_corrupted_backup copy is deliberately kept
        storageRecoveryActive = false;
        saveStateImmediate(getDefaultState());
        modal.remove();
        window.location.reload();
      } catch (e) {
        alert('Unable to clear localStorage automatically. Please clear browser storage manually.');
      }
    });
    focusFirst('btn-reset-back');
  };

  // Preview can be dismissed with Escape or by clicking outside; the real screen cannot
  modal.onkeydown = (e) => { if (preview && e.key === 'Escape') { e.preventDefault(); close(); } };
  modal.onclick = (e) => { if (preview && e.target === modal) close(); };

  renderMain();
}

// ============================================================================
// DATA PORTABILITY (M6): validate imports, CSV export, snapshots, sample data
// ============================================================================

const IMPORT_MAX_CHARS = 10 * 1024 * 1024;
const IMPORT_LIMITS = {
  tasks: 20000, tags: 500, areas: 200, habits: 500,
  habitLog: 100000, focusLog: 100000, journalEntries: 20000, dayIntentions: 20000
};
const IMPORT_KNOWN_KEYS = ['tasks', 'tags', 'areas', 'habits', 'habitLog', 'focusLog', 'journalEntries', 'dayIntentions', 'settings'];
const TASK_STATUSES = ['backlog', 'todo', 'inprogress', 'done'];
const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const TAG_COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'];
const AREA_COLORS = ['blue', 'emerald', 'amber', 'rose', 'sky', 'purple', 'indigo', 'violet'];

// ---- tiny sanitizers: take anything, return something safe ----
function impStr(v, max, fallback = '') {
  if (typeof v === 'string') return v.slice(0, max);
  if (typeof v === 'number' && isFinite(v)) return String(v).slice(0, max);
  return fallback;
}
function impNum(v, min, max, fallback) {
  if (v === null || v === '' || v === undefined || typeof v === 'boolean') return fallback;
  const n = Number(v);
  return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
/** Whole number inside a range, otherwise the fallback (no squeezing into range) */
function impIntIn(v, min, max, fallback) {
  if (v === null || v === '' || v === undefined || typeof v === 'boolean') return fallback;
  const n = Number(v);
  return (isFinite(n) && Math.round(n) >= min && Math.round(n) <= max) ? Math.round(n) : fallback;
}
function impEnum(v, list, fallback) { return list.includes(v) ? v : fallback; }
function impBool(v, fallback) { return typeof v === 'boolean' ? v : fallback; }
function impTs(v, fallback) {
  const n = Number(v);
  return (v !== null && v !== '' && isFinite(n) && n >= 0 && n <= 8.64e15) ? Math.floor(n) : fallback;
}
function impId(v) {
  return (typeof v === 'string' && v.length >= 1 && v.length <= 80 && /^[\w.:\-]+$/.test(v)) ? v : null;
}
function impDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) ? v : null;
}

/** Short counts used to compare "what you have" with "what is in the file / snapshot" */
function summarizeState(s) {
  const live = arr => (Array.isArray(arr) ? arr : []).filter(x => x && !x.deletedAt);
  const hasContent = e => e && (e.mood != null || e.energy != null || ['wins', 'blockers', 'notes'].some(k => String(e[k] || '').trim()));
  return {
    tasks: live(s && s.tasks).length,
    tags: live(s && s.tags).length,
    areas: live(s && s.areas).length,
    habits: live(s && s.habits).length,
    journalEntries: live(s && s.journalEntries).filter(hasContent).length,
    focusMinutes: live(s && s.focusLog).reduce((a, f) => a + (Number(f.minutes) || 0), 0)
  };
}

/**
 * Check and clean backup text before it is allowed anywhere near the real data.
 * Nothing is trusted: records that cannot be read are skipped (and counted), values are
 * range-checked, text is length-capped, and references to missing items are dropped.
 * Older formats (v1, v2) are upgraded first.
 * @returns {{ok:boolean, errors:string[], warnings:string[], state:Object|null, summary:Object|null, info:Object}}
 */
function validateImportData(text) {
  const errors = [], warnings = [];
  const fail = (msg) => ({ ok: false, errors: [msg, ...errors], warnings, state: null, summary: null, info: {} });

  if (typeof text !== 'string' || text.trim() === '') return fail('The file is empty.');
  if (text.length > IMPORT_MAX_CHARS) return fail('The file is larger than 10 MB, which is too big to be a FlowBoard backup.');

  let raw;
  try { raw = JSON.parse(text); } catch (e) { return fail('This is not a valid JSON file.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('This does not look like a FlowBoard backup.');
  if (!IMPORT_KNOWN_KEYS.some(k => k in raw)) return fail('This file has none of the data FlowBoard stores (tasks, tags, habits, journal...).');

  const fileVersion = Number(raw.schemaVersion) || 1;
  if (fileVersion > CURRENT_SCHEMA_VERSION) {
    return fail(`This backup was made by a newer version of FlowBoard (format v${fileVersion}). Update FlowBoard first.`);
  }
  for (const key of Object.keys(IMPORT_LIMITS)) {
    if (key in raw && raw[key] !== null && !Array.isArray(raw[key])) return fail(`"${key}" in this file is not a list, so the file is damaged.`);
    if (Array.isArray(raw[key]) && raw[key].length > IMPORT_LIMITS[key]) return fail(`The file has too many ${key} (${raw[key].length}).`);
  }

  const exportInfo = raw.exportInfo && typeof raw.exportInfo === 'object' ? raw.exportInfo : null;
  const info = {
    fileVersion,
    migrated: fileVersion < CURRENT_SCHEMA_VERSION,
    exportedAt: exportInfo && typeof exportInfo.exportedAt === 'string' ? exportInfo.exportedAt.slice(0, 40) : null,
    appVersion: exportInfo && typeof exportInfo.version === 'string' ? exportInfo.version.slice(0, 20) : null
  };

  // Upgrade old formats to the current shape, then clean everything
  let migrated;
  try {
    const copy = JSON.parse(text);
    delete copy.exportInfo;
    migrated = migrate(copy);
  } catch (e) {
    return fail('This backup could not be upgraded to the current format.');
  }

  const def = getDefaultState();
  const now = Date.now();
  const skipped = (n, what) => { if (n > 0) warnings.push(`${n} ${what} could not be read and ${n === 1 ? 'was' : 'were'} skipped.`); };
  const list = k => (Array.isArray(raw[k]) ? migratedList(k) : []);
  const migratedList = k => (Array.isArray(migrated[k]) ? migrated[k] : []);
  const stamps = r => ({ createdAt: impTs(r.createdAt, now), updatedAt: impTs(r.updatedAt, impTs(r.createdAt, now)), deletedAt: r.deletedAt ? impTs(r.deletedAt, now) : null });
  const seen = new Set();
  const unique = (id, bucket) => { const key = bucket + ':' + id; if (seen.has(key)) return false; seen.add(key); return true; };
  const isRec = r => r && typeof r === 'object' && !Array.isArray(r);

  // ---- tags ----
  let bad = 0;
  const tags = [];
  list('tags').forEach(r => {
    const id = isRec(r) ? impId(r.id) : null, name = isRec(r) ? impStr(r.name, 40).trim() : '';
    if (!id || !name || !unique(id, 'tag')) { bad++; return; }
    tags.push({ id, name, color: impEnum(r.color, TAG_COLORS, 'indigo'), ...stamps(r) });
  });
  skipped(bad, 'tags');
  const tagIdSet = new Set(tags.map(t => t.id));
  const tagByName = new Map(tags.map(t => [t.name.toLowerCase(), t.id]));
  const resolveTag = ref => {
    if (typeof ref !== 'string') return null;
    if (tagIdSet.has(ref)) return ref;
    return tagByName.get(ref.trim().toLowerCase()) || null;     // older files referred to tags by name
  };

  // ---- areas ----
  bad = 0;
  const areas = [];
  list('areas').forEach((r, i) => {
    const id = isRec(r) ? impId(r.id) : null, name = isRec(r) ? impStr(r.name, 40).trim() : '';
    if (!id || !name || !unique(id, 'area')) { bad++; return; }
    areas.push({ id, name, color: impEnum(r.color, AREA_COLORS, 'blue'), icon: impStr(r.icon, 8, '📁') || '📁', order: impNum(r.order, 0, 1e9, (i + 1) * 1000), ...stamps(r) });
  });
  skipped(bad, 'areas');
  const areaIdSet = new Set(areas.map(a => a.id));

  // ---- tasks ----
  bad = 0;
  const tasks = [];
  list('tasks').forEach((r, i) => {
    const id = isRec(r) ? impId(r.id) : null, title = isRec(r) ? impStr(r.title, 200).trim() : '';
    if (!id || !title || !unique(id, 'task')) { bad++; return; }
    const st = stamps(r);
    const status = impEnum(r.status, TASK_STATUSES, 'todo');
    const subtasks = (Array.isArray(r.subtasks) ? r.subtasks : []).slice(0, 100).map((x, j) => {
      const text = isRec(x) ? impStr(x.text, 200).trim() : '';
      return text ? { id: impId(x.id) || `st-${i}-${j}`, text, done: impBool(x.done, false) } : null;
    }).filter(Boolean);
    tasks.push({
      id, title, desc: impStr(r.desc, 5000), status,
      priority: impEnum(r.priority, TASK_PRIORITIES, 'medium'),
      tagIds: [...new Set((Array.isArray(r.tagIds) ? r.tagIds : []).map(resolveTag).filter(Boolean))],
      areaId: areaIdSet.has(r.areaId) ? r.areaId : null,
      scheduledDate: impDate(r.scheduledDate),
      estMin: Math.round(impNum(r.estMin, 0, 100000, 60)),
      order: impNum(r.order, 0, 1e12, (i + 1) * 1000),
      completedAt: status === 'done' ? impTs(r.completedAt, st.updatedAt) : null,
      subtasks, ...st
    });
  });
  skipped(bad, 'tasks');
  const taskIdSet = new Set(tasks.map(t => t.id));

  // ---- focus log ----
  bad = 0;
  const focusLog = [];
  list('focusLog').forEach(r => {
    const id = isRec(r) ? impId(r.id) : null, date = isRec(r) ? impDate(r.date) : null;
    const minutes = isRec(r) ? Math.round(impNum(r.minutes, 0, 1440, 0)) : 0;
    if (!id || !date || minutes < 1 || !unique(id, 'focus')) { bad++; return; }
    focusLog.push({ id, date, taskId: taskIdSet.has(r.taskId) ? r.taskId : null, minutes, kind: 'focus', startedAt: impTs(r.startedAt, impTs(r.createdAt, now)), ...stamps(r) });
  });
  skipped(bad, 'focus sessions');

  // ---- day intentions ----
  bad = 0;
  const dayIntentions = [];
  list('dayIntentions').forEach(r => {
    const date = isRec(r) ? impDate(r.date) : null;
    if (!date || !unique(date, 'intention')) { bad++; return; }
    dayIntentions.push({ id: `di-${date}`, date, text: impStr(r.text, 200), updatedAt: impTs(r.updatedAt, now) });
  });
  skipped(bad, 'daily intentions');

  // ---- habits (older files kept a weekly checklist in habit.days) ----
  bad = 0;
  let oldStyleHabitChecks = false;
  const DAY_TO_GETDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const habits = [];
  list('habits').forEach(r => {
    const id = isRec(r) ? impId(r.id) : null, title = isRec(r) ? impStr(r.title, 60).trim() : '';
    if (!id || !title || !unique(id, 'habit')) { bad++; return; }
    let days = normalizeHabitDays(r.targetDays);
    if (!days && isRec(r.days)) {
      oldStyleHabitChecks = true;
      days = normalizeHabitDays(Object.keys(DAY_TO_GETDAY).filter(k => k in r.days).map(k => DAY_TO_GETDAY[k]));
    }
    habits.push({ id, title, targetDays: days || [1, 2, 3, 4, 5], archived: impBool(r.archived, false), ...stamps(r) });
  });
  skipped(bad, 'habits');
  if (oldStyleHabitChecks) warnings.push('Habit check-marks from the old weekly format have no dates, so only the habits themselves were imported.');
  const habitIdSet = new Set(habits.map(h => h.id));

  // ---- habit log ----
  bad = 0;
  const habitLogMap = new Map();
  list('habitLog').forEach(r => {
    const date = isRec(r) ? impDate(r.date) : null;
    if (!date || !habitIdSet.has(r.habitId)) { bad++; return; }
    const key = r.habitId + '|' + date;
    const entry = { id: `hl-${r.habitId}-${date}`, habitId: r.habitId, date, done: impBool(r.done, true), updatedAt: impTs(r.updatedAt, now) };
    const prev = habitLogMap.get(key);
    if (!prev || entry.updatedAt >= prev.updatedAt) habitLogMap.set(key, entry);
  });
  skipped(bad, 'habit check-ins');
  const habitLog = [...habitLogMap.values()];

  // ---- journal ----
  bad = 0;
  const journalMap = new Map();
  list('journalEntries').forEach(r => {
    const date = isRec(r) ? impDate(r.date) : null;
    if (!date) { bad++; return; }
    const entry = {
      id: `j-${date}`, date,
      mood: impIntIn(r.mood, 1, 5, null), energy: impIntIn(r.energy, 1, 10, null),
      tagId: resolveTag(r.tagId || r.tag),
      wins: impStr(r.wins, 5000), blockers: impStr(r.blockers, 5000), notes: impStr(r.notes, 5000), ...stamps(r)
    };
    const prev = journalMap.get(date);
    if (!prev || entry.updatedAt >= prev.updatedAt) journalMap.set(date, entry);
  });
  skipped(bad, 'journal entries');
  const journalEntries = [...journalMap.values()];

  // ---- settings (only known keys, range-checked) ----
  const rs = isRec(migrated.settings) ? migrated.settings : {};
  const capacityByWeekday = {};
  DAY_KEYS.forEach(k => { capacityByWeekday[k] = impNum(isRec(rs.capacityByWeekday) ? rs.capacityByWeekday[k] : undefined, 0, 16, def.settings.capacityByWeekday[k]); });
  const presets = Array.isArray(rs.timerPresets) ? rs.timerPresets.map(Number) : [];
  const presetsOk = presets.length === 4 && presets.every(n => Number.isInteger(n) && n >= 1 && n <= 600) && new Set(presets).size === 4;
  const settings = {
    ...def.settings,
    theme: impEnum(rs.theme, ['dark', 'light', 'system'], def.settings.theme),
    compactCards: impBool(rs.compactCards, false),
    soundEnabled: impBool(rs.soundEnabled, true),
    autoBackup: impBool(rs.autoBackup, true),
    dailyCapacityHours: impNum(rs.dailyCapacityHours, 0, 16, 6),
    capacityByWeekday,
    wipLimit: Math.round(impNum(rs.wipLimit, 1, 50, 3)),
    timerPresets: presetsOk ? presets : def.settings.timerPresets
  };

  // ---- assemble: fresh ui/timer/meta, this device keeps its own id ----
  const state = {
    ...def,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    deviceId: (typeof getState === 'function' && getState() && getState().deviceId) || def.deviceId,
    settings,
    tags: tags.length ? tags : def.tags,
    areas: areas.length ? areas : def.areas,
    tasks, focusLog, dayIntentions, habits, habitLog, journalEntries,
    meta: { lastBackupAt: 0, lastSyncAt: 0, onboarded: true }
  };

  if ('todayFocusMinutes' in raw && fileVersion < 2) warnings.push('Old daily focus totals have no dates, so they were not imported.');
  return { ok: true, errors, warnings, state, summary: summarizeState(state), info };
}

// ---------------------------------------------------------------------------
// CSV EXPORT
// ---------------------------------------------------------------------------

/** One CSV cell: quotes doubled, quoted when needed, formula characters neutralised for Excel/Sheets */
function csvCell(value) {
  let v = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** All non-deleted tasks as CSV text (without the Excel BOM) */
function buildTasksCsv(s = getState()) {
  const header = ['id', 'title', 'description', 'status', 'priority', 'area', 'tags', 'scheduled_date',
    'estimated_min', 'logged_min', 'completed_at', 'subtasks_done', 'subtasks_total', 'created_at', 'updated_at'];
  const rank = { backlog: 0, todo: 1, inprogress: 2, done: 3 };
  const iso = ts => (ts ? new Date(ts).toISOString() : '');
  const rows = (s.tasks || [])
    .filter(t => !t.deletedAt)
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (Number(a.order) || 0) - (Number(b.order) || 0))
    .map(t => {
      const area = t.areaId ? selectors.getAreaById(t.areaId, s) : null;
      const tagNames = (t.tagIds || []).map(id => selectors.getTagById(id, s)).filter(Boolean).map(x => x.name);
      const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
      return [t.id, t.title, t.desc, t.status, t.priority, area ? area.name : '', tagNames.join('; '),
        t.scheduledDate || '', t.estMin ?? '', selectors.getTaskLoggedMinutes(t.id, s), iso(t.completedAt),
        subs.filter(x => x.done).length, subs.length, iso(t.createdAt), iso(t.updatedAt)];
    });
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

function downloadTextFile(text, filename, mime) {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[Export] Download failed:', err);
    showToast('The download could not be created.', { type: 'error' });
    return false;
  }
}

function exportTasksCsv() {
  const ok = downloadTextFile('\uFEFF' + buildTasksCsv(getState()), `flowboard_tasks_${getLocalDateString(new Date())}.csv`, 'text/csv;charset=utf-8');
  if (ok) showToast('Tasks exported as CSV', { type: 'success' });
}

/** Full JSON backup of everything, stamped with version and date. Remembers when you last did it. */
function exportFullBackup() {
  const s = getState();
  s.meta.lastBackupAt = Date.now();
  saveState(s, true);
  const payload = { ...s, exportInfo: { app: 'FlowBoard Work OS', version: APP_VERSION, exportedAt: new Date().toISOString() } };
  const ok = downloadTextFile(JSON.stringify(payload, null, 2), `flowboard_backup_${getLocalDateString(new Date())}_v${CURRENT_SCHEMA_VERSION}.json`, 'application/json');
  if (ok) showToast('Backup downloaded. Keep the file somewhere safe.', { type: 'success' });
  if (typeof safeRender === 'function') safeRender();
}

// ---------------------------------------------------------------------------
// SNAPSHOTS: automatic local copies you can restore from Settings
// ---------------------------------------------------------------------------

const SNAPSHOT_KEY = STORAGE_KEY + '_snapshots';
const SNAPSHOT_LIMITS = { daily: 7, safety: 5 };
const SNAPSHOT_LABELS = {
  daily: 'Daily', manual: 'Saved by you', 'before-import': 'Before an import', 'before-restore': 'Before a restore',
  'before-reset': 'Before Start Blank', 'before-sample': 'Before sample data'
};

function readSnapshots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
    return (Array.isArray(parsed) ? parsed : []).filter(x => x && typeof x.id === 'string' && typeof x.data === 'string')
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    return [];
  }
}

function writeSnapshots(list) {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}

/** Keep the newest 7 daily and the newest 5 safety copies */
function pruneSnapshots(list) {
  const out = [];
  const count = { daily: 0, safety: 0 };
  [...list].sort((a, b) => b.createdAt - a.createdAt).forEach(sn => {
    const kind = sn.kind === 'daily' ? 'daily' : 'safety';
    if (count[kind] < SNAPSHOT_LIMITS[kind]) { count[kind]++; out.push(sn); }
  });
  return out;
}

/**
 * Save a restorable copy of the current data. If the browser is short of space, the oldest
 * copies are dropped until it fits. Returns the snapshot, or null if there was no room at all.
 */
function takeSnapshot(label = 'manual', stateObj) {
  if (storageRecoveryActive) return null;
  const source = stateObj || getState();
  const now = Date.now();
  const snap = {
    id: generateId('snap'),
    kind: label === 'daily' ? 'daily' : 'safety',
    label,
    date: getLocalDateString(new Date(now)),
    createdAt: now,
    counts: summarizeState(source),
    data: JSON.stringify(source)
  };
  let list = pruneSnapshots([snap, ...readSnapshots()]);
  while (!writeSnapshots(list)) {
    if (list.length <= 1) return null;
    const oldestFirst = [...list].sort((a, b) => a.createdAt - b.createdAt).filter(x => x.id !== snap.id);
    list = list.filter(x => x.id !== oldestFirst[0].id);
  }
  return snap;
}

/** Once per day, when FlowBoard opens, copy yesterday's finished state (if automatic backups are on) */
function ensureDailySnapshot() {
  try {
    const s = getState();
    if (!s || !s.settings || s.settings.autoBackup === false || storageRecoveryActive) return null;
    const today = getLocalDateString(new Date());
    if (readSnapshots().some(x => x.kind === 'daily' && x.date === today)) return null;
    return takeSnapshot('daily', s);
  } catch (e) {
    console.error('[Snapshot] Daily backup failed:', e);
    return null;
  }
}

function deleteSnapshot(id) {
  const list = readSnapshots();
  const next = list.filter(x => x.id !== id);
  if (next.length === list.length) return false;
  return writeSnapshots(next);
}

/** How full the browser storage is. Browsers allow roughly 5 million characters per site. */
function getStorageUsage() {
  const LIMIT = 5000000;
  let appChars = 0, totalChars = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const n = key.length + (localStorage.getItem(key) || '').length;
      totalChars += n;
      if (key.startsWith(STORAGE_KEY)) appChars += n;
    }
  } catch (e) { /* storage unavailable */ }
  const percent = Math.min(100, Math.round((totalChars / LIMIT) * 100));
  return { appChars, totalChars, limitChars: LIMIT, percent, level: percent >= 90 ? 'critical' : percent >= 70 ? 'warning' : 'ok' };
}

// ---------------------------------------------------------------------------
// SAMPLE DATA: a small, believable workspace relative to today
// ---------------------------------------------------------------------------

function buildSampleState(todayStr = getLocalDateString(new Date())) {
  const base = getDefaultState();
  const now = Date.now();
  const day = n => addDaysStr(todayStr, n);
  const at = (dateStr, hour) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d, hour, 0, 0).getTime(); };
  const stamp = { createdAt: now, updatedAt: now, deletedAt: null };

  const tags = [
    { id: 'tag-1', name: 'Deep Work', color: 'indigo', ...stamp },
    { id: 'tag-admin', name: 'Admin', color: 'amber', ...stamp },
    { id: 'tag-learn', name: 'Learning', color: 'sky', ...stamp }
  ];
  const mk = (id, title, status, priority, extra = {}) => ({
    id, title, desc: '', status, priority, tagIds: [], areaId: null, scheduledDate: null, estMin: 60,
    order: 0, completedAt: null, subtasks: [], ...stamp, ...extra
  });
  const tasks = [
    mk('s-1', 'Draft the project proposal', 'inprogress', 'urgent', { tagIds: ['tag-1'], areaId: 'area-work', scheduledDate: day(0), estMin: 120, desc: 'Outline, first draft, then a read-through.',
      subtasks: [{ id: 's-1a', text: 'Outline the sections', done: true }, { id: 's-1b', text: 'Write the first draft', done: false }, { id: 's-1c', text: 'Read it aloud and trim', done: false }] }),
    mk('s-2', 'Reply to client emails', 'todo', 'high', { tagIds: ['tag-admin'], areaId: 'area-work', scheduledDate: day(0), estMin: 30 }),
    mk('s-3', 'Prepare the weekly review', 'todo', 'high', { tagIds: ['tag-admin'], areaId: 'area-work', scheduledDate: day(2), estMin: 45 }),
    mk('s-4', 'Quarterly report', 'inprogress', 'high', { tagIds: ['tag-1'], areaId: 'area-work', scheduledDate: day(1), estMin: 180 }),
    mk('s-5', '30 minute walk', 'todo', 'medium', { areaId: 'area-health', scheduledDate: day(1), estMin: 30 }),
    mk('s-6', 'Plan the weekend trip', 'todo', 'medium', { areaId: 'area-personal', scheduledDate: day(3), estMin: 45 }),
    mk('s-7', 'Read chapter 4', 'backlog', 'low', { tagIds: ['tag-learn'], areaId: 'area-learning', estMin: 60 }),
    mk('s-8', 'Book a dentist appointment', 'backlog', 'medium', { areaId: 'area-personal', estMin: 15 }),
    mk('s-9', 'Fix the login bug', 'done', 'high', { tagIds: ['tag-1'], areaId: 'area-work', scheduledDate: day(-1), estMin: 90, completedAt: at(day(-1), 16) }),
    mk('s-10', 'Set up automatic backups', 'done', 'medium', { areaId: 'area-personal', scheduledDate: day(-2), estMin: 30, completedAt: at(day(-2), 11) })
  ].map((t, i) => ({ ...t, order: (i + 1) * 1000 }));

  const log = (id, date, taskId, minutes) => ({ id, date, taskId, minutes, kind: 'focus', startedAt: at(date, 10), ...stamp });
  const focusLog = [
    log('sf-1', day(-1), 's-9', 50), log('sf-2', day(-1), 's-9', 25), log('sf-3', day(-2), 's-10', 25),
    log('sf-4', day(-3), 's-4', 50), log('sf-5', day(-3), 's-1', 25), log('sf-6', day(0), 's-1', 25)
  ];

  const habits = [
    { id: 'h-1', title: '90m Morning Deep Work', targetDays: [1, 2, 3, 4, 5], archived: false, ...stamp },
    { id: 'h-read', title: 'Read 20 pages', targetDays: [0, 1, 2, 3, 4, 5, 6], archived: false, ...stamp },
    { id: 'h-walk', title: 'Evening walk', targetDays: [1, 3, 5], archived: false, ...stamp }
  ];
  const habitLog = [];
  for (let i = 1; i <= 12; i++) {
    const d = day(-i);
    if (i % 4 !== 0) habitLog.push({ id: `hl-h-1-${d}`, habitId: 'h-1', date: d, done: true, updatedAt: now });
    if (i % 3 !== 0) habitLog.push({ id: `hl-h-read-${d}`, habitId: 'h-read', date: d, done: true, updatedAt: now });
    if (i % 2 === 0) habitLog.push({ id: `hl-h-walk-${d}`, habitId: 'h-walk', date: d, done: true, updatedAt: now });
  }

  const entry = (offset, mood, energy, wins, blockers, notes, tagId) => {
    const date = day(offset);
    return { id: `j-${date}`, date, mood, energy, tagId, wins, blockers, notes, ...stamp };
  };
  const journalEntries = [
    entry(-1, 4, 7, '• Fix the login bug\nShipped a clean fix before lunch.', 'Too many meetings in the afternoon.', 'Protect mornings for deep work.', 'tag-1'),
    entry(-2, 3, 5, '• Set up automatic backups', 'Slow start, low energy.', 'Go to bed earlier.', null),
    entry(-3, 5, 9, 'Best focus day this week.', '', 'Two long focus blocks made the difference.', 'tag-1'),
    entry(-5, 3, 6, 'Steady progress on the report.', 'Context switching.', '', null)
  ];

  const dayIntentions = [
    { id: `di-${day(0)}`, date: day(0), text: 'Finish the proposal draft', updatedAt: now },
    { id: `di-${day(1)}`, date: day(1), text: 'Quarterly report first, then admin', updatedAt: now }
  ];

  return { ...base, tags, tasks, focusLog, habits, habitLog, journalEntries, dayIntentions };
}
