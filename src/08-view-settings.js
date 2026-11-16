// ============================================================================
// VIEW: SETTINGS (08-view-settings.js)  Milestones M6, M7 (About panel)
// Appearance, timer and planning preferences, capacity, backup / import / CSV,
// automatic snapshots, storage meter, Start Blank and sample data.
// ============================================================================

function settingsToggle(id, label, desc, checked, key) {
  return `
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p id="${id}-label" class="text-sm font-medium text-[var(--text-primary)]">${esc(label)}</p>
        <p class="text-xs text-[var(--text-secondary)] mt-0.5">${esc(desc)}</p>
      </div>
      <button type="button" id="${id}" role="switch" aria-checked="${checked ? 'true' : 'false'}" aria-labelledby="${id}-label"
        data-action="toggle-setting" data-setting="${esc(key)}" class="flex-shrink-0 flex items-center justify-center min-w-[56px] min-h-[44px]">
        <span class="relative inline-block h-7 w-12 rounded-full transition-colors ${checked ? 'bg-[var(--accent)]' : 'bg-neutral-500/60'}">
          <span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}"></span>
        </span>
      </button>
    </div>`;
}

function settingsAgo(ts) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

function settingsTime(ts) {
  return new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Render Settings View
 * @param {HTMLElement} container
 */
function renderSettingsView(container) {
  const s = getState();
  const set = s.settings || {};
  const theme = set.theme || 'dark';
  const usage = getStorageUsage();
  const snaps = readSnapshots();
  const lastBackup = settingsAgo(s.meta && s.meta.lastBackupAt);
  const backupStale = !(s.meta && s.meta.lastBackupAt) || (Date.now() - s.meta.lastBackupAt) > 7 * 86400000;
  const presets = getTimerPresetList();
  const card = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 space-y-4';
  const numInput = 'w-full px-3 py-2 min-h-[44px] text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]';
  const themeBtn = (value, label) => `
    <button type="button" data-action="set-theme-${value}" aria-pressed="${theme === value}" class="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-all ${theme === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}">${label}</button>`;

  const snapRows = snaps.map(sn => `
    <li class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div class="min-w-0">
        <p class="text-sm font-medium text-[var(--text-primary)]">${esc(SNAPSHOT_LABELS[sn.label] || sn.label)} <span class="font-normal text-[var(--text-secondary)]">· ${esc(settingsTime(sn.createdAt))}</span></p>
        <p class="text-xs text-[var(--text-secondary)]">${sn.counts ? `${sn.counts.tasks} tasks · ${sn.counts.habits} habits · ${sn.counts.journalEntries} journal entries · ${esc(formatMinutes(sn.counts.focusMinutes))} focus` : ''}</p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" data-action="settings-restore-snapshot" data-snapshot-id="${esc(sn.id)}" class="btn-secondary text-xs">Restore…</button>
        <button type="button" data-action="settings-delete-snapshot" data-snapshot-id="${esc(sn.id)}" class="btn-secondary text-xs text-red-400" aria-label="Delete this backup copy">Delete</button>
      </div>
    </li>`).join('');

  container.innerHTML = `
    <div class="space-y-6 max-w-3xl">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Settings</h1>
        <p class="text-sm text-[var(--text-secondary)] mt-0.5">Preferences, backups and your data</p>
      </div>

      <section class="${card}" aria-labelledby="set-appearance">
        <h2 id="set-appearance" class="text-base font-semibold text-[var(--text-primary)]">Appearance</h2>
        <div class="space-y-2">
          <p class="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Color theme</p>
          <div class="inline-flex p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]" role="group" aria-label="Color theme">
            ${themeBtn('dark', 'Dark')}${themeBtn('light', 'Light')}${themeBtn('system', 'System')}
          </div>
        </div>
        ${settingsToggle('set-compact', 'Compact cards', 'Smaller task cards on the board: descriptions are hidden and spacing is tighter.', Boolean(set.compactCards), 'compactCards')}
      </section>

      <section class="${card}" aria-labelledby="set-focus">
        <h2 id="set-focus" class="text-base font-semibold text-[var(--text-primary)]">Focus timer and board</h2>
        ${settingsToggle('set-sound', 'Timer chime', 'Play a short sound when a session ends.', Boolean(set.soundEnabled), 'soundEnabled')}
        <div>
          <p class="text-sm font-medium text-[var(--text-primary)] mb-1">Timer lengths (minutes)</p>
          <p class="text-xs text-[var(--text-secondary)] mb-2">Four different whole numbers. The last one is your break and is never logged as focus time.</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            ${['Focus', 'Deep work', 'Sprint', 'Break'].map((name, i) => `
              <div>
                <label for="preset-${i}" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">${name}</label>
                <input id="preset-${i}" type="number" min="1" max="600" step="1" inputmode="numeric" data-timer-preset-index="${i}" value="${presets[i]}" class="${numInput}">
              </div>`).join('')}
          </div>
        </div>
        <div class="max-w-[12rem]">
          <label for="set-wip" class="block text-sm font-medium text-[var(--text-primary)] mb-1">In Progress limit</label>
          <input id="set-wip" type="number" min="1" max="50" step="1" inputmode="numeric" data-setting-input="wipLimit" value="${Number(set.wipLimit) || 3}" class="${numInput}">
          <p class="text-xs text-[var(--text-secondary)] mt-1">A warning shows when the In Progress column gets longer than this. It never blocks you.</p>
        </div>
      </section>

      <section class="${card}" aria-labelledby="set-capacity">
        <h2 id="set-capacity" class="text-base font-semibold text-[var(--text-primary)]">Daily capacity</h2>
        <p class="text-sm text-[var(--text-secondary)]">How many hours of planned work you want on each weekday. The Weekly Planner uses this to warn you when a day is overloaded. Use 0 for a day off.</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          ${DAY_KEYS.map(key => `
            <div>
              <label for="capacity-${key}" class="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-1">${key}</label>
              <input id="capacity-${key}" type="number" min="0" max="16" step="0.25" inputmode="decimal" data-capacity-day="${key}"
                value="${esc(Number(set.capacityByWeekday?.[key] ?? set.dailyCapacityHours ?? 6))}" class="${numInput}">
            </div>`).join('')}
        </div>
        <p class="text-xs text-[var(--text-secondary)]">Hours per day, saved when you leave the box. Total: <strong class="text-[var(--text-primary)]">${DAY_KEYS.reduce((sum, k) => sum + (Number(set.capacityByWeekday?.[k]) || 0), 0)} h per week</strong></p>
      </section>

      <section class="${card}" aria-labelledby="set-data">
        <h2 id="set-data" class="text-base font-semibold text-[var(--text-primary)]">Your data and backups</h2>
        <p class="text-sm text-[var(--text-secondary)]">Everything is stored only in this browser on this device. Clearing the browser's site data would erase it, so keep a backup file somewhere safe.</p>
        <p class="text-sm ${backupStale ? 'text-amber-500 font-medium' : 'text-[var(--text-secondary)]'}" id="set-last-backup">
          ${lastBackup ? `Last backup file: <strong>${esc(lastBackup)}</strong>${backupStale ? '. It is time for a new one.' : ''}` : '<span aria-hidden="true">⚠ </span>You have never downloaded a backup file.'}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="btn-secondary" data-action="download-json-backup">
            <svg class="w-4 h-4 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export JSON backup
          </button>
          <label class="btn-secondary cursor-pointer focus-within:ring-2 focus-within:ring-indigo-400" for="import-file-input">
            <svg class="w-4 h-4 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12"/></svg>
            Import JSON backup…
            <input id="import-file-input" type="file" accept=".json,application/json" data-import-file class="sr-only">
          </label>
          <button type="button" class="btn-secondary" data-action="export-csv">Export tasks (CSV)</button>
        </div>

        <div class="pt-2">
          <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>Browser storage used</span>
            <span class="font-mono ${usage.level === 'ok' ? '' : usage.level === 'warning' ? 'text-amber-500 font-semibold' : 'text-rose-500 font-semibold'}">about ${usage.percent}%</span>
          </div>
          <div class="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${usage.percent}" aria-label="Browser storage used">
            <div class="h-full rounded-full ${usage.level === 'ok' ? 'bg-emerald-500' : usage.level === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}" style="width:${usage.percent}%"></div>
          </div>
          <p class="text-xs text-[var(--text-secondary)] mt-1">FlowBoard uses ${esc((usage.appChars / 1024).toFixed(1))} KB.${usage.level === 'ok' ? '' : usage.level === 'warning' ? ' Storage is getting full: export a backup file and delete old backup copies below.' : ' Storage is almost full! Export a backup file now and delete old backup copies below.'}</p>
        </div>
      </section>

      <section class="${card}" aria-labelledby="set-snaps">
        <h2 id="set-snaps" class="text-base font-semibold text-[var(--text-primary)]">Automatic backup copies</h2>
        ${settingsToggle('set-auto', 'Daily backup copy', 'Keeps a copy of your data each day you open FlowBoard (the last 7 days), inside this browser.', set.autoBackup !== false, 'autoBackup')}
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-[var(--text-secondary)]">These copies live in the same browser, so they protect against mistakes, not against losing the browser data. Backup files protect against both.</p>
          <button type="button" class="btn-secondary flex-shrink-0" data-action="snapshot-now">Save a copy now</button>
        </div>
        ${snaps.length ? `<ul class="space-y-2" aria-label="Backup copies">${snapRows}</ul>` : '<p class="text-sm text-[var(--text-secondary)]">No backup copies yet.</p>'}
      </section>

      <section class="${card} border-red-500/30" aria-labelledby="set-danger">
        <h2 id="set-danger" class="text-base font-semibold text-[var(--text-primary)]">Start over</h2>
        <p class="text-sm text-[var(--text-secondary)]">Both options save a backup copy first and show an Undo for 15 seconds. Your settings are kept.</p>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-secondary" data-action="open-load-sample">Load sample data…</button>
          <button type="button" class="btn-secondary text-red-400" data-action="open-start-blank">Start blank…</button>
        </div>
        <details class="pt-1">
          <summary class="text-xs text-[var(--text-secondary)] cursor-pointer min-h-[44px] flex items-center">Advanced</summary>
          <button type="button" class="btn-secondary text-xs mt-1" data-action="test-corrupted-recovery">Preview the storage recovery screen</button>
        </details>
      </section>

      <section class="${card.replace('space-y-4', 'space-y-3')}" aria-labelledby="set-about">
        <h2 id="set-about" class="text-base font-semibold text-[var(--text-primary)]">About FlowBoard Work OS</h2>
        <p class="text-sm text-[var(--text-secondary)] leading-relaxed">
          FlowBoard is a calm, fast, offline-first personal work system designed for deep execution, weekly planning, and honest analytics.
        </p>
        <dl class="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]">
          <div class="flex gap-1.5"><dt>Version</dt><dd class="font-mono font-semibold text-[var(--text-primary)]">v${esc(APP_VERSION)}</dd></div>
          <div class="flex gap-1.5"><dt>Milestone</dt><dd class="font-semibold text-[var(--text-primary)]">M5 + M7 (Insights, welcome and polish)</dd></div>
          <div class="flex gap-1.5"><dt>Data format</dt><dd class="font-mono font-semibold text-[var(--text-primary)]">v${esc(s.schemaVersion)}</dd></div>
        </dl>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-secondary text-xs" data-action="open-shortcuts">Keyboard shortcuts <kbd class="kbd ml-1.5">?</kbd></button>
        </div>
        <details>
          <summary class="text-sm font-medium text-[var(--text-primary)] cursor-pointer min-h-[44px] flex items-center">What is new</summary>
          <ol class="space-y-3 mt-1">
            ${APP_CHANGELOG.map(c => `
              <li>
                <p class="text-sm font-semibold text-[var(--text-primary)]">${esc(c.version === 'Earlier' ? c.title : `v${c.version} · ${c.title}`)}${c.date ? ` <span class="font-normal text-[var(--text-secondary)]">· ${esc(formatDisplayDate(c.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>` : ''}</p>
                <ul class="list-disc pl-5 mt-1 space-y-0.5 text-xs text-[var(--text-secondary)]">${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
              </li>`).join('')}
          </ol>
        </details>
        <details>
          <summary class="text-sm font-medium text-[var(--text-primary)] cursor-pointer min-h-[44px] flex items-center">Offline use and installing</summary>
          <div class="space-y-2 mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
            <p>Your data never leaves this browser, so everything you do works with no internet connection. An <strong class="text-[var(--text-primary)]">Offline</strong> badge appears at the top while you are disconnected.</p>
            <p>FlowBoard is one file. The styling and the font are loaded from the internet the first time and then reused from the browser's cache. If they cannot be loaded, FlowBoard still works, with a plainer look.</p>
            <p>Installing FlowBoard as an app is not available: browsers only allow that with a separate helper file (a service worker), which a single-file app cannot carry. Bookmark the page or keep the file on your desktop instead.</p>
          </div>
        </details>
      </section>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// DIALOGS
// ----------------------------------------------------------------------------

function settingsCompareTable(currentSummary, incomingSummary, incomingLabel) {
  const rows = [
    ['Tasks', currentSummary.tasks, incomingSummary.tasks],
    ['Tags', currentSummary.tags, incomingSummary.tags],
    ['Habits', currentSummary.habits, incomingSummary.habits],
    ['Journal entries', currentSummary.journalEntries, incomingSummary.journalEntries],
    ['Focus time logged', formatMinutes(currentSummary.focusMinutes), formatMinutes(incomingSummary.focusMinutes)]
  ];
  return `
    <table class="w-full text-sm mb-4">
      <thead><tr class="text-left text-xs text-[var(--text-secondary)]">
        <th scope="col" class="py-1 font-medium">&nbsp;</th>
        <th scope="col" class="py-1 font-medium text-right">Now</th>
        <th scope="col" class="py-1 pl-4 font-medium text-right">${esc(incomingLabel)}</th>
      </tr></thead>
      <tbody>${rows.map(([label, now, next]) => `
        <tr class="border-t border-[var(--border-color)]">
          <th scope="row" class="py-1.5 text-left font-normal text-[var(--text-secondary)]">${esc(label)}</th>
          <td class="py-1.5 text-right font-mono">${esc(now)}</td>
          <td class="py-1.5 pl-4 text-right font-mono font-semibold text-[var(--text-primary)]">${esc(next)}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function settingsDialog({ formId, title, titleId, body, confirmLabel, confirmId, danger = false, cancelLabel = 'Cancel' }) {
  return `
    <form id="${formId}" class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="flex items-center justify-between mb-3">
        <h2 id="${titleId}" class="text-lg font-bold">${esc(title)}</h2>
        <button type="button" data-action="close-modal" class="btn-icon" aria-label="Close">&times;</button>
      </div>
      ${body}
      <div class="flex justify-end gap-2 mt-4">
        <button type="button" data-action="close-modal" class="btn-secondary">${esc(cancelLabel)}</button>
        ${confirmLabel ? `<button type="submit" id="${confirmId}" class="${danger ? 'inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500' : 'btn-primary'}">${esc(confirmLabel)}</button>` : ''}
      </div>
    </form>`;
}

/** Tell the user an imported file could not be used, and why */
function openImportErrorModal(errors, filename) {
  openModal(settingsDialog({
    formId: 'import-error-form', titleId: 'import-error-title', title: 'This file cannot be imported',
    cancelLabel: 'OK',
    body: `<p class="text-sm text-[var(--text-secondary)] mb-3">${esc(filename || 'The file')} was not used, and <strong>nothing in FlowBoard was changed</strong>.</p>
      <ul class="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`
  }), '[data-action="close-modal"]');
}

/** Show what an import would replace, and only replace after the user confirms */
function openImportPreviewModal(result, filename) {
  const cur = summarizeState(getState());
  const when = result.info.exportedAt ? new Date(result.info.exportedAt) : null;
  const html = settingsDialog({
    formId: 'import-confirm-form', titleId: 'import-title', title: 'Replace your data with this backup?',
    confirmLabel: 'Replace my data', confirmId: 'import-confirm-btn', danger: true,
    body: `
      <p class="text-sm text-[var(--text-secondary)] mb-3">
        <strong class="text-[var(--text-primary)]">${esc(filename || 'Backup file')}</strong>${when && !isNaN(when) ? `, saved ${esc(when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}${result.info.appVersion ? ` by FlowBoard v${esc(result.info.appVersion)}` : ''}.
        ${result.info.migrated ? `It is in an older format (v${result.info.fileVersion}) and will be upgraded.` : ''}
      </p>
      ${settingsCompareTable(cur, result.summary, 'In the file')}
      ${result.warnings.length ? `<div class="mb-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm"><p class="font-semibold text-amber-500 mb-1">Heads up</p><ul class="list-disc pl-5 space-y-0.5 text-[var(--text-primary)]">${result.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      <p class="text-sm text-[var(--text-secondary)]">Everything you have now is replaced. A backup copy of your current data is saved first, and you can undo for 15 seconds. Your settings come from the file.</p>`
  });
  openModal(html, '[data-action="close-modal"]');
  const overlay = document.getElementById('app-modal-overlay');
  if (!overlay) return;
  overlay.onsubmit = (e) => {
    if (!e.target || e.target.id !== 'import-confirm-form') return;
    e.preventDefault();
    const undoId = actions.replaceAllData(result.state, 'import');
    closeModal();
    if (!undoId) { showToast('Import failed: not enough browser storage. Nothing was changed.', { type: 'error' }); return; }
    showToast(`Imported ${result.summary.tasks} tasks and ${result.summary.journalEntries} journal entries`, {
      type: 'success', duration: 15000,
      actionText: undoId === 'none' ? null : 'Undo',
      onAction: undoId === 'none' ? null : () => actions.restoreSnapshot(undoId)
    });
  };
}

/** Validate backup text and open the right dialog. Used by the file picker. */
function importFromText(text, filename) {
  const result = validateImportData(text);
  if (!result.ok) { openImportErrorModal(result.errors, filename); return null; }
  openImportPreviewModal(result, filename);
  return result;
}

function importFromFile(file) {
  if (!file) return;
  if (file.size > IMPORT_MAX_CHARS) {
    openImportErrorModal(['The file is larger than 10 MB, which is too big to be a FlowBoard backup.'], file.name);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => importFromText(String(reader.result || ''), file.name);
  reader.onerror = () => showToast('The file could not be read.', { type: 'error' });
  reader.readAsText(file);
}

function openRestoreSnapshotModal(snapId) {
  const snap = readSnapshots().find(x => x.id === snapId);
  if (!snap) { showToast('That backup copy no longer exists.', { type: 'error' }); return; }
  const cur = summarizeState(getState());
  openModal(settingsDialog({
    formId: 'restore-form', titleId: 'restore-title', title: 'Restore this backup copy?',
    confirmLabel: 'Restore', confirmId: 'restore-confirm-btn', danger: true,
    body: `<p class="text-sm text-[var(--text-secondary)] mb-3">${esc(SNAPSHOT_LABELS[snap.label] || snap.label)} copy from <strong class="text-[var(--text-primary)]">${esc(settingsTime(snap.createdAt))}</strong>.</p>
      ${settingsCompareTable(cur, snap.counts || summarizeState({}), 'In the copy')}
      <p class="text-sm text-[var(--text-secondary)]">Your current data is replaced. It is saved as a new backup copy first, and you can undo for 12 seconds.</p>`
  }), '[data-action="close-modal"]');
  const overlay = document.getElementById('app-modal-overlay');
  if (!overlay) return;
  overlay.onsubmit = (e) => {
    if (!e.target || e.target.id !== 'restore-form') return;
    e.preventDefault();
    closeModal();
    actions.restoreSnapshot(snapId);
  };
}

function openLoadSampleModal() {
  openModal(settingsDialog({
    formId: 'sample-form', titleId: 'sample-title', title: 'Load sample data?',
    confirmLabel: 'Load sample data', confirmId: 'sample-confirm-btn',
    body: `<p class="text-sm text-[var(--text-secondary)]">This replaces your tasks, habits, journal and focus history with a small example workspace so you can explore every screen. A backup copy of your current data is saved first and you can undo for 15 seconds. Your settings are kept.</p>`
  }), '[data-action="close-modal"]');
  const overlay = document.getElementById('app-modal-overlay');
  if (!overlay) return;
  overlay.onsubmit = (e) => {
    if (!e.target || e.target.id !== 'sample-form') return;
    e.preventDefault();
    closeModal();
    actions.loadSampleData();
  };
}

function openStartBlankModal() {
  const cur = summarizeState(getState());
  openModal(settingsDialog({
    formId: 'blank-form', titleId: 'blank-title', title: 'Start blank?',
    confirmLabel: 'Delete everything and start blank', confirmId: 'blank-confirm-btn', danger: true,
    body: `
      <p class="text-sm text-[var(--text-secondary)] mb-3">This removes all <strong class="text-[var(--text-primary)]">${cur.tasks} tasks</strong>, ${cur.habits} habits, ${cur.journalEntries} journal entries and your focus history. Your settings are kept.</p>
      <p class="text-sm text-[var(--text-secondary)] mb-3">A backup copy is saved first and you can undo for 15 seconds. For extra safety, download a backup file now.</p>
      <button type="button" data-action="download-json-backup" class="btn-secondary text-xs mb-4">Download a backup file first</button>
      <label for="blank-confirm-input" class="block text-sm font-medium mb-1">Type <strong class="font-mono">DELETE</strong> to confirm</label>
      <input id="blank-confirm-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
        class="w-full px-3 py-2 min-h-[44px] text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">`
  }), '#blank-confirm-input');
  const overlay = document.getElementById('app-modal-overlay');
  if (!overlay) return;
  const btn = overlay.querySelector('#blank-confirm-btn');
  const input = overlay.querySelector('#blank-confirm-input');
  const matches = () => input.value.trim().toUpperCase() === 'DELETE';
  btn.disabled = true;
  overlay.oninput = (e) => { if (e.target === input) btn.disabled = !matches(); };
  overlay.onsubmit = (e) => {
    if (!e.target || e.target.id !== 'blank-form') return;
    e.preventDefault();
    if (!matches()) return;
    closeModal();
    actions.startBlank();
  };
}
