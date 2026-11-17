// ============================================================================
// APP ENTRY & ROUTER (10-app.js)
// ============================================================================

/**
 * Apply the effective theme to the HTML element
 */
/** Display preferences that live on the page itself (compact cards) */
function applyDisplaySettings() {
  const s = getState();
  document.documentElement.classList.toggle('compact-cards', Boolean(s && s.settings && s.settings.compactCards));
}

function applyCurrentTheme() {
  const effective = selectors.getEffectiveTheme();
  if (effective === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  // Browser chrome (phone address bar) follows the theme
  const themeMeta = document.getElementById('meta-theme-color');
  if (themeMeta) themeMeta.setAttribute('content', effective === 'dark' ? '#0b0f19' : '#f8fafc');
}

const VIEW_LABELS = { kanban: 'Kanban board', planner: 'Weekly planner', journal: 'Journal', insights: 'Insights', settings: 'Settings' };

/**
 * Render the Top Command Bar and Navigation Bar
 */
function renderAppShell() {
  const s = getState();
  const activeView = selectors.getActiveView(s);
  const effectiveTheme = selectors.getEffectiveTheme(s);

  // Update tabs active state
  const tabButtons = document.querySelectorAll('[data-view-tab]');
  tabButtons.forEach(btn => {
    const viewName = btn.getAttribute('data-view-tab');
    const isActive = viewName === activeView;
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      btn.className = 'tab-btn tab-btn-active';
    } else {
      btn.className = 'tab-btn tab-btn-inactive';
    }
  });

  // Name the main region after the screen it is showing (for screen readers)
  const mainEl = document.getElementById('main-content');
  if (mainEl) mainEl.setAttribute('aria-label', VIEW_LABELS[activeView] || 'FlowBoard');

  // Update Theme Toggle Button Icon
  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.setAttribute('aria-label', `Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`);
    themeBtn.innerHTML = effectiveTheme === 'dark'
      ? `<svg class="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
         </svg>`
      : `<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
         </svg>`;
  }
}

/**
 * Render the currently active view into #main-content
 */
/**
 * Re-rendering replaces the page content, which would normally drop the cursor out of a text
 * box after every keystroke and throw keyboard focus off the button that was just pressed.
 * These two helpers remember the focused control (by id, or by its data-* attributes) and the
 * caret position, and put them back on the re-drawn control.
 */
function captureFocusSnapshot(container) {
  const el = document.activeElement;
  if (!el || el === document.body || !container.contains(el)) return null;
  const snap = describeFocusTarget(el);
  if (!snap) return null;
  try { snap.start = el.selectionStart; snap.end = el.selectionEnd; snap.dir = el.selectionDirection; } catch (e) { /* not a text field */ }
  return snap;
}

function restoreFocusSnapshot(snap, container) {
  if (!snap) return;
  const el = findFocusTarget(snap, container || document);
  if (!el || typeof el.focus !== 'function') return;
  try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  try {
    if (typeof snap.start === 'number') el.setSelectionRange(snap.start, snap.end, snap.dir || 'none');
  } catch (e) { /* number and date inputs have no caret */ }
}

// ----------------------------------------------------------------------------
// ERROR BOUNDARY (M8)
// If one screen fails to draw, show a panel with ways out instead of a blank page.
// The header, timer and the other screens keep working, and nothing is saved or changed.
// ----------------------------------------------------------------------------

const VIEW_RENDERERS = {
  kanban: (c) => renderKanbanView(c),
  planner: (c) => renderPlannerView(c),
  journal: (c) => renderJournalView(c),
  insights: (c) => renderInsightsView(c),
  settings: (c) => renderSettingsView(c)
};

/** HTML for the panel shown when a screen cannot be drawn (pure: tested without a browser) */
function buildViewErrorHtml(viewName, err) {
  const label = VIEW_LABELS[viewName] || 'This screen';
  const message = (err && (err.message || String(err))) || 'Unknown error';
  const escape = viewName === 'kanban'
    ? { view: 'settings', label: 'Open Settings' }
    : { view: 'kanban', label: 'Go to the board' };
  return `
    <section class="max-w-xl mx-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6" role="alert" aria-labelledby="view-error-title">
      <h1 id="view-error-title" class="text-xl font-bold text-[var(--text-primary)]">${esc(label)} could not be shown</h1>
      <p class="text-sm text-[var(--text-secondary)] mt-2">Something went wrong while drawing this screen. <strong class="text-[var(--text-primary)]">Your data has not been changed</strong>, and the other screens still work.</p>
      <div class="flex flex-wrap gap-2 mt-4">
        <button type="button" id="view-error-retry" data-action="retry-view" class="btn-primary">Try again</button>
        <button type="button" data-action="switch-view" data-view="${escape.view}" class="btn-secondary">${escape.label}</button>
        <button type="button" data-action="download-json-backup" class="btn-secondary">Download a backup file</button>
      </div>
      <details class="mt-4">
        <summary class="text-xs text-[var(--text-secondary)] cursor-pointer min-h-[44px] flex items-center">Technical details</summary>
        <p class="text-xs font-mono text-[var(--text-secondary)] break-words">${esc(String(viewName))}: ${esc(message.slice(0, 500))}</p>
        <p class="text-xs text-[var(--text-secondary)] mt-1">FlowBoard v${esc(APP_VERSION)}. If this keeps happening, download a backup file and reload the page.</p>
      </details>
    </section>`;
}

/**
 * Draw one screen. Returns true when it drew, false when the error panel was shown instead.
 * Never throws.
 */
function renderViewSafely(container, viewName) {
  const draw = VIEW_RENDERERS[viewName] || VIEW_RENDERERS.kanban;
  try {
    draw(container);
    return true;
  } catch (err) {
    console.error(`[FlowBoard] The ${viewName} screen failed to render:`, err);
    try { if (typeof destroyInsightsCharts === 'function') destroyInsightsCharts(); } catch (e) { /* nothing to release */ }
    try {
      container.innerHTML = buildViewErrorHtml(viewName, err);
    } catch (e) {
      container.textContent = 'This screen could not be shown. Your data has not been changed. Please reload the page.';
    }
    return false;
  }
}

function renderActiveView() {
  const container = document.getElementById('main-content');
  if (!container) return;
  const focusSnap = captureFocusSnapshot(container);

  const s = getState();
  const activeView = selectors.getActiveView(s);

  // Leaving Insights: release its charts (the Insights view re-creates them each time it draws)
  if (activeView !== 'insights' && typeof destroyInsightsCharts === 'function') destroyInsightsCharts();

  renderViewSafely(container, activeView);
  restoreFocusSnapshot(focusSnap, container);
}

/** A button press failed part-way: say so, and re-draw from the saved state so the screen is not left half-updated */
function reportActionError(err) {
  console.error('[FlowBoard] An action failed:', err);
  try { showToast('That did not work. Nothing was lost. Please try again.', { type: 'error', duration: 6000 }); } catch (e) { /* toast is best effort */ }
  try { safeRender(); } catch (e) { /* the error panel covers this */ }
}

/**
 * Global Event Delegation Dispatcher
 * @param {Event} e
 */
function handleGlobalClick(e) {
  // If clicking outside move menu, close open move menu
  if (!e.target.closest('[data-action="toggle-move-menu"]') && activeMoveMenuTaskId) {
    activeMoveMenuTaskId = null;
    renderActiveView();
  }

  // Clicking anywhere outside an open toolbar dropdown closes it
  if (openKanbanMenu && !e.target.closest('[data-kanban-menu]')) {
    openKanbanMenu = null;
    renderActiveView();
  }

  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.getAttribute('data-action');

  // Choosing an option in a toolbar dropdown closes it and returns focus to its button
  if (action.startsWith('set-kanban-') && openKanbanMenu) {
    const menuKey = openKanbanMenu;
    openKanbanMenu = null;
    setTimeout(() => document.getElementById(`kanban-menu-btn-${menuKey}`)?.focus(), 0);
  }

  switch (action) {
    // Navigation & Views
    case 'switch-view': {
      const viewName = target.getAttribute('data-view-tab') || target.getAttribute('data-view');
      if (viewName) {
        actions.switchView(viewName);
      }
      break;
    }
    case 'toggle-theme': {
      actions.toggleTheme();
      break;
    }
    case 'set-theme-dark': {
      actions.setTheme('dark');
      break;
    }
    case 'set-theme-light': {
      actions.setTheme('light');
      break;
    }
    case 'set-theme-system': {
      actions.setTheme('system');
      break;
    }

    // Kanban Task Modal & Creation
    case 'open-new-task-modal': {
      openTaskModal(null, 'todo');
      break;
    }
    case 'quick-add-to-column': {
      const status = target.getAttribute('data-status') || 'todo';
      openTaskModal(null, status);
      break;
    }
    case 'edit-task': {
      const taskId = target.getAttribute('data-task-id');
      if (taskId) {
        openTaskModal(taskId);
      }
      break;
    }
    case 'delete-task': {
      const taskId = target.getAttribute('data-task-id');
      if (taskId) {
        actions.deleteTask(taskId);
      }
      break;
    }
    case 'close-modal': {
      closeModal();
      break;
    }

    // Button-Based Move Actions (Touch friendly)
    case 'move-task-prev': {
      const taskId = target.getAttribute('data-task-id');
      const s = getState();
      const task = s.tasks.find(t => t.id === taskId);
      if (task) {
        const colIndex = KANBAN_COLUMNS.findIndex(c => c.id === task.status);
        if (colIndex > 0) {
          const prevStatus = KANBAN_COLUMNS[colIndex - 1].id;
          actions.moveTask(taskId, prevStatus);
        }
      }
      break;
    }
    case 'move-task-next': {
      const taskId = target.getAttribute('data-task-id');
      const s = getState();
      const task = s.tasks.find(t => t.id === taskId);
      if (task) {
        const colIndex = KANBAN_COLUMNS.findIndex(c => c.id === task.status);
        if (colIndex < KANBAN_COLUMNS.length - 1) {
          const nextStatus = KANBAN_COLUMNS[colIndex + 1].id;
          actions.moveTask(taskId, nextStatus);
        }
      }
      break;
    }
    case 'toggle-move-menu': {
      const taskId = target.getAttribute('data-task-id');
      activeMoveMenuTaskId = (activeMoveMenuTaskId === taskId) ? null : taskId;
      renderActiveView();
      break;
    }
    case 'move-task-to': {
      const taskId = target.getAttribute('data-task-id');
      const targetStatus = target.getAttribute('data-target-status');
      if (taskId && targetStatus) {
        activeMoveMenuTaskId = null;
        actions.moveTask(taskId, targetStatus);
      }
      break;
    }

    // Subtask toggle
    case 'toggle-subtask': {
      const taskId = target.getAttribute('data-task-id');
      const subtaskId = target.getAttribute('data-subtask-id');
      if (taskId && subtaskId) {
        actions.toggleSubtask(taskId, subtaskId);
      }
      break;
    }

    // Tag filtering & management
    case 'filter-tag': {
      const tagId = target.getAttribute('data-tag-id');
      actions.setActiveTagFilter(tagId);
      break;
    }
    case 'clear-search': {
      actions.setSearchQuery('');
      break;
    }
    case 'open-tag-manager': {
      openTagManagerModal();
      break;
    }
    case 'delete-tag': {
      const tagId = target.getAttribute('data-tag-id');
      if (tagId) {
        actions.deleteTag(tagId);
        openTagManagerModal(); // Refresh modal
      }
      break;
    }
    case 'kanban-show-more':
    case 'kanban-show-fewer': {
      // The pressed button is replaced by its opposite: keep keyboard focus on that one
      const listKey = target.getAttribute('data-list-key');
      if (action === 'kanban-show-more') kanbanShowAllCards[listKey] = true;
      else delete kanbanShowAllCards[listKey];
      renderActiveView();
      const swapped = [...document.querySelectorAll('[data-action="kanban-show-more"], [data-action="kanban-show-fewer"]')]
        .find(btn => btn.getAttribute('data-list-key') === listKey);
      if (swapped) swapped.focus();
      break;
    }
    case 'planner-tray-toggle': {
      plannerTrayShowAll = !plannerTrayShowAll;
      renderActiveView();
      break;
    }
    case 'toggle-show-older-done': {
      actions.toggleShowOlderDone();
      break;
    }

    // Area Manager (M1.1)
    case 'open-area-manager': {
      openAreaManagerModal();
      break;
    }
    case 'delete-area': {
      const areaId = target.getAttribute('data-area-id');
      if (areaId) {
        actions.deleteArea(areaId);
        // If modal is open, refresh it
        const overlay = document.getElementById('app-modal-overlay');
        if (overlay) openAreaManagerModal();
      }
      break;
    }

    // Kanban toolbar (M1.1)
    case 'set-kanban-group-by': {
      actions.setKanbanGroupBy(target.value || target.getAttribute('data-value'));
      break;
    }
    case 'set-kanban-sort-by': {
      actions.setKanbanSortBy(target.value || target.getAttribute('data-value'));
      break;
    }
    case 'set-kanban-filter-area': {
      actions.setKanbanFilterArea(target.value || target.getAttribute('data-value'));
      break;
    }
    case 'set-kanban-filter-priority': {
      actions.setKanbanFilterPriority(target.value || target.getAttribute('data-value'));
      break;
    }
    case 'set-kanban-filter-scheduled': {
      actions.setKanbanFilterScheduled(target.value || target.getAttribute('data-value'));
      break;
    }
    case 'clear-kanban-filters': {
      actions.clearKanbanFilters();
      break;
    }
    case 'toggle-kanban-column': {
      const colStatus = target.getAttribute('data-col-status');
      if (colStatus) actions.toggleKanbanColumn(colStatus);
      break;
    }
    case 'toggle-kanban-group': {
      const groupKey = target.getAttribute('data-group-key');
      if (groupKey) actions.toggleKanbanGroup(groupKey);
      break;
    }
    case 'toggle-kanban-menu': {
      const menuKey = target.getAttribute('data-menu');
      openKanbanMenu = (openKanbanMenu === menuKey) ? null : menuKey;
      renderActiveView();
      document.getElementById(`kanban-menu-btn-${menuKey}`)?.focus();
      break;
    }
    case 'toggle-kanban-filters-panel': {
      actions.toggleKanbanFiltersPanel();
      break;
    }
    case 'apply-kanban-saved-view': {
      const viewId = target.getAttribute('data-view-id');
      if (viewId) actions.applyKanbanSavedView(viewId);
      break;
    }
    case 'clear-kanban-saved-view': {
      actions.clearKanbanSavedView();
      break;
    }

    // Focus timer (M2)
    case 'timer-toggle': {
      timerService.toggle();
      break;
    }
    case 'timer-reset': {
      timerService.reset();
      break;
    }
    case 'timer-preset': {
      timerService.setPreset(Number(target.getAttribute('data-minutes')));
      break;
    }
    case 'timer-log': {
      timerService.logElapsed();
      break;
    }
    case 'toggle-sound': {
      actions.toggleSound();
      if (getState().settings.soundEnabled) timerService.playChime(); // short confirmation chime
      break;
    }
    case 'focus-task': {
      const taskId = target.getAttribute('data-task-id');
      if (taskId) timerService.focusOnTask(taskId);
      break;
    }

    // Habits (M2)
    case 'toggle-habit': {
      const habitId = target.getAttribute('data-habit-id');
      if (habitId) actions.toggleHabit(habitId, getLocalDateString(new Date()));
      break;
    }
    case 'open-habit-manager': {
      openHabitManagerModal();
      break;
    }
    case 'delete-habit': {
      const habitId = target.getAttribute('data-habit-id');
      if (habitId) actions.deleteHabit(habitId);
      break;
    }

    // Weekly planner (M3)
    case 'planner-prev': {
      actions.shiftPlannerWeek(-1);
      break;
    }
    case 'planner-next': {
      actions.shiftPlannerWeek(1);
      break;
    }
    case 'planner-today': {
      actions.setPlannerWeek(getLocalDateString(new Date()));
      break;
    }
    case 'planner-schedule': {
      actions.scheduleTask(target.getAttribute('data-task-id'), target.getAttribute('data-date'));
      break;
    }
    case 'planner-unschedule': {
      actions.scheduleTask(target.getAttribute('data-task-id'), null);
      break;
    }
    case 'planner-shift': {
      actions.shiftTaskDay(target.getAttribute('data-task-id'), Number(target.getAttribute('data-delta')));
      break;
    }
    case 'planner-toggle-done': {
      actions.toggleTaskDone(target.getAttribute('data-task-id'));
      break;
    }
    case 'carry-over-task': {
      actions.carryOverTask(target.getAttribute('data-task-id'), target.getAttribute('data-target'));
      break;
    }
    case 'carry-over-all': {
      actions.carryOverAll();
      break;
    }
    case 'toggle-habit-date': {
      const habitId = target.getAttribute('data-habit-id');
      const date = target.getAttribute('data-date');
      if (habitId && date) actions.toggleHabit(habitId, date);
      break;
    }

    // Journal (M4)
    case 'journal-prev': {
      actions.shiftJournalDate(-1);
      break;
    }
    case 'journal-next': {
      actions.shiftJournalDate(1);
      break;
    }
    case 'journal-today': {
      actions.setJournalDate(getLocalDateString(new Date()));
      break;
    }
    case 'journal-open-date': {
      actions.setJournalDate(target.getAttribute('data-date'));
      const main = document.getElementById('main-content');
      if (main && typeof main.scrollIntoView === 'function') main.scrollIntoView({ block: 'start' });
      break;
    }
    case 'journal-mood': {
      actions.setJournalMood(target.getAttribute('data-journal-date'), Number(target.getAttribute('data-mood')));
      break;
    }
    case 'journal-pull-done': {
      actions.pullDoneTasks(target.getAttribute('data-journal-date'));
      break;
    }
    case 'journal-send-kanban': {
      openSendToKanbanModal(target.getAttribute('data-journal-date'));
      break;
    }
    case 'journal-delete-entry': {
      actions.deleteJournalEntry(target.getAttribute('data-journal-date'));
      break;
    }

    // Settings actions
    case 'download-json-backup': {
      exportFullBackup();
      break;
    }
    case 'export-csv': {
      exportTasksCsv();
      break;
    }
    case 'toggle-setting': {
      const key = target.getAttribute('data-setting');
      if (key) actions.setSetting(key, !getState().settings[key]);
      break;
    }
    case 'snapshot-now': {
      actions.snapshotNow();
      break;
    }
    case 'settings-restore-snapshot': {
      openRestoreSnapshotModal(target.getAttribute('data-snapshot-id'));
      break;
    }
    case 'settings-delete-snapshot': {
      if (deleteSnapshot(target.getAttribute('data-snapshot-id'))) {
        showToast('Backup copy deleted', { type: 'info' });
        safeRender();
      }
      break;
    }
    case 'open-load-sample': {
      openLoadSampleModal();
      break;
    }
    case 'open-start-blank': {
      openStartBlankModal();
      break;
    }
    // Error panel (M8)
    case 'retry-view': {
      renderActiveView();
      document.getElementById('view-error-retry')?.focus();
      break;
    }

    // Insights (M5)
    case 'insights-range': {
      actions.setInsightsRange(target.getAttribute('data-range'));
      break;
    }
    case 'insights-toggle-tables': {
      actions.toggleInsightsTables();
      break;
    }

    // Welcome and help (M7)
    case 'open-shortcuts': {
      openShortcutsModal();
      break;
    }
    case 'onboarding-skip': {
      skipOnboarding();
      break;
    }

    case 'test-corrupted-recovery': {
      showCorruptedStateModal('{ "invalidJson": [bad_syntax] }', new Error('Unexpected token in JSON'), { preview: true });
      break;
    }

    default:
      break;
  }
}

/**
 * Setup Keyboard Shortcuts
 */
function setupKeyboardShortcuts() {
  // Toolbar dropdowns: Escape closes, Up/Down move between options. Card 'Move to' menu: Escape closes.
  window.addEventListener('keydown', (e) => {
    // A dialog is open but keyboard focus is outside it (for example after a click on the dimmed
    // background): Escape still closes it, and Tab goes back into the dialog.
    const dialog = document.getElementById('app-modal-overlay');
    if (dialog && !dialog.contains(e.target) && (e.key === 'Escape' || e.key === 'Tab')) {
      if (e.key === 'Tab') {
        const first = dialog.querySelector('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])');
        if (first) { e.preventDefault(); first.focus(); }
      } else if (typeof dialog.onkeydown === 'function') {
        dialog.onkeydown(e);
      }
      return;
    }
    if (e.key === 'Escape' && activeMoveMenuTaskId && !openKanbanMenu && !document.getElementById('app-modal-overlay')) {
      const taskId = activeMoveMenuTaskId;
      activeMoveMenuTaskId = null;
      renderActiveView();
      const again = findFocusTarget(
        { selector: `button[data-action="toggle-move-menu"][data-task-id="${String(taskId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`, fallback: null },
        document.getElementById('main-content'));
      if (again) again.focus();
      return;
    }
    if (!openKanbanMenu) return;
    if (e.key === 'Escape') {
      const key = openKanbanMenu;
      openKanbanMenu = null;
      renderActiveView();
      document.getElementById(`kanban-menu-btn-${key}`)?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...document.querySelectorAll(`[data-kanban-menu="${openKanbanMenu}"] [role="menuitemradio"]`)];
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[next].focus();
    }
  });

  // Screen tabs: Left/Right (and Home/End) move between screens, as screen-reader users expect of tabs
  const tablist = document.getElementById('view-tablist');
  if (tablist) {
    tablist.addEventListener('keydown', (e) => {
      const tabs = [...tablist.querySelectorAll('[role="tab"]')];
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      tabs[next].focus();
      actions.switchView(tabs[next].getAttribute('data-view-tab'));
    });
  }

  window.addEventListener('keydown', (e) => {
    // Leave browser and system shortcuts (Ctrl+N, Cmd+/ ...) alone
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Ignore when focus is inside an input, textarea, or contentEditable
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
      return;
    }

    // Don't trigger if a dialog or the recovery screen is open
    if (document.getElementById('app-modal-overlay') || document.getElementById('corrupted-state-modal')) {
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      openShortcutsModal();
    } else if (e.key === 'u' || e.key === 'U') {
      if (triggerLatestUndo()) e.preventDefault();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      // Ensure we are in kanban view or switch to it
      if (selectors.getActiveView() !== 'kanban') {
        actions.switchView('kanban');
      }
      openTaskModal(null, 'todo');
    } else if (e.key === '/') {
      e.preventDefault();
      if (selectors.getActiveView() !== 'kanban') {
        actions.switchView('kanban');
      }
      const searchInput = document.getElementById('kanban-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });
}

// ----------------------------------------------------------------------------
// KEYBOARD SHORTCUT LIST (M7)
// ----------------------------------------------------------------------------

const KEYBOARD_SHORTCUTS = [
  { keys: ['N'], label: 'New task' },
  { keys: ['/'], label: 'Search the board' },
  { keys: ['U'], label: 'Undo, while an Undo message is showing' },
  { keys: ['?'], label: 'Show this list' },
  { keys: ['Esc'], label: 'Close a dialog or menu' },
  { keys: ['←', '→'], label: 'Switch screen, when a screen tab has focus' },
  { keys: ['↑', '↓'], label: 'Move through an open Group, Sort or filter menu' },
  { keys: ['Tab'], label: 'Next control (Shift + Tab goes back)' },
  { keys: ['Enter'], label: 'Press the focused button (Space also works)' }
];

function openShortcutsModal() {
  const rows = KEYBOARD_SHORTCUTS.map(sc => `
    <div class="flex items-center justify-between gap-4 py-2 border-t border-[var(--border-color)]">
      <dt class="text-sm text-[var(--text-primary)]">${esc(sc.label)}</dt>
      <dd class="flex items-center gap-1 flex-shrink-0">${sc.keys.map(k => `<kbd class="kbd">${esc(k)}</kbd>`).join('')}</dd>
    </div>`).join('');
  openModal(`
    <div class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <div class="flex items-center justify-between mb-2">
        <h2 id="shortcuts-title" class="text-lg font-bold">Keyboard shortcuts</h2>
        <button type="button" data-action="close-modal" class="btn-icon" aria-label="Close"><span aria-hidden="true">&times;</span></button>
      </div>
      <p class="text-sm text-[var(--text-secondary)] mb-2">Letter shortcuts are ignored while you are typing in a box.</p>
      <dl>${rows}</dl>
      <div class="flex justify-end mt-4">
        <button type="button" data-action="close-modal" class="btn-primary">Got it</button>
      </div>
    </div>`, '[data-action="close-modal"]');
}

// ----------------------------------------------------------------------------
// FIRST-RUN WELCOME (M7)
// Shown once, in a browser with no saved FlowBoard data. Escape or 'Skip for now' keeps the
// default workspace. Nothing here can touch existing data: it only appears before any exists.
// ----------------------------------------------------------------------------

function skipOnboarding() {
  actions.completeOnboarding({ skipped: true });
  closeModal();
  showToast('Welcome to FlowBoard. Press ? any time to see the keyboard shortcuts.', { duration: 6000 });
}

function openOnboardingModal() {
  const cap = (getState().settings && getState().settings.capacityByWeekday) || {};
  const numInput = 'w-full px-3 py-2 min-h-[44px] text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]';
  const legend = 'text-sm font-semibold text-[var(--text-primary)] mb-2';
  const choice = (value, title, desc, checked) => `
    <label class="onboard-choice flex items-start gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] cursor-pointer">
      <input type="radio" name="start" value="${value}" ${checked ? 'checked' : ''} class="mt-1 w-4 h-4 flex-shrink-0" style="accent-color: var(--accent)">
      <span>
        <span class="block text-sm font-semibold text-[var(--text-primary)]">${title}</span>
        <span class="block text-xs text-[var(--text-secondary)] mt-0.5">${desc}</span>
      </span>
    </label>`;
  const hoursBox = (id, name, label, value) => `
    <div>
      <label for="${id}" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">${label}</label>
      <input id="${id}" name="${name}" type="number" min="0" max="16" step="0.25" inputmode="decimal" value="${esc(value)}" class="${numInput}">
    </div>`;

  const html = `
    <form id="onboarding-form" class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-intro">
      <h2 id="onboarding-title" class="text-xl font-bold">Welcome to FlowBoard</h2>
      <p id="onboarding-intro" class="text-sm text-[var(--text-secondary)] mt-1 mb-5">Plan your week, focus with a timer, and reflect each day. Three quick choices and you are in. Everything can be changed later in Settings.</p>

      <fieldset class="mb-5">
        <legend class="${legend}">1. How do you want to start?</legend>
        <div class="grid sm:grid-cols-2 gap-2">
          ${choice('blank', 'Start blank', 'An empty board, ready for your own tasks.', true)}
          ${choice('sample', 'Explore with sample data', 'Ten example tasks, habits and journal days to click around. Clear them later with Start blank.', false)}
        </div>
      </fieldset>

      <fieldset class="mb-5">
        <legend class="${legend}">2. Hours of planned work per day</legend>
        <div class="grid grid-cols-3 gap-3">
          ${hoursBox('onboard-weekday', 'weekdayHours', 'Mon to Fri', Number(cap.Mon ?? 6))}
          ${hoursBox('onboard-sat', 'saturdayHours', 'Saturday', Number(cap.Sat ?? 2))}
          ${hoursBox('onboard-sun', 'sundayHours', 'Sunday', Number(cap.Sun ?? 0))}
        </div>
        <p class="text-xs text-[var(--text-secondary)] mt-1.5">The Weekly Planner warns you when a day holds more than this. Use 0 for a day off.</p>
      </fieldset>

      <fieldset class="mb-5">
        <legend class="${legend}">3. One habit to track <span class="font-normal text-[var(--text-secondary)]">(optional)</span></legend>
        <label for="onboard-habit" class="sr-only">Habit name</label>
        <input id="onboard-habit" name="habitTitle" type="text" maxlength="60" autocomplete="off" placeholder="e.g. 90m morning deep work" class="${numInput} mb-2">
        <div class="flex flex-wrap gap-1" role="group" aria-label="Repeat the habit on">${buildHabitDayChips('habitDays', [1, 2, 3, 4, 5], null)}</div>
      </fieldset>

      <p class="text-xs text-[var(--text-secondary)] mb-4">Your data is stored only in this browser, on this device. Export a backup file from Settings every week or so.</p>

      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" data-action="onboarding-skip" class="btn-secondary">Skip for now</button>
        <button type="submit" class="btn-primary">Get started</button>
      </div>
    </form>`;

  openModal(html, 'input[name="start"]:checked');
  const overlay = document.getElementById('app-modal-overlay');
  if (!overlay) return;

  // Escape counts as Skip (so the welcome never comes back); clicking outside does nothing
  const trapKeys = overlay.onkeydown;
  overlay.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); skipOnboarding(); return; }
    if (typeof trapKeys === 'function') trapKeys(e);
  };
  overlay.onclick = null;

  overlay.onsubmit = (e) => {
    if (!e.target || e.target.id !== 'onboarding-form') return;
    e.preventDefault();
    const form = e.target;
    const start = form.querySelector('input[name="start"]:checked')?.value === 'sample' ? 'sample' : 'blank';
    const ok = actions.completeOnboarding({
      start,
      weekdayHours: form.elements['weekdayHours'].value,
      saturdayHours: form.elements['saturdayHours'].value,
      sundayHours: form.elements['sundayHours'].value,
      habitTitle: form.elements['habitTitle'].value,
      habitDays: [...form.querySelectorAll('input[name="habitDays"]:checked')].map(i => Number(i.value))
    });
    if (!ok) {
      showToast('Your choices could not be saved in this browser. Check that storage is allowed, then try again.', { type: 'error', duration: 8000 });
      return;
    }
    closeModal();
    showToast(start === 'sample'
      ? 'Sample data loaded. When you are ready for your own, use Settings, Start blank.'
      : 'You are set up. Press N to add your first task, or ? for all shortcuts.', { type: 'success', duration: 8000 });
  };
}

// ----------------------------------------------------------------------------
// OFFLINE BADGE (M7)
// ----------------------------------------------------------------------------

/** Show or hide the Offline badge. With announce=true (a real change), also say it in a toast. */
function updateOfflineIndicator(announce = false) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const badge = document.getElementById('offline-indicator');
  if (badge) badge.hidden = !offline;
  if (announce) {
    showToast(offline
      ? 'You are offline. FlowBoard keeps working and saves on this device.'
      : 'You are back online.', { type: offline ? 'warning' : 'success', duration: 5000 });
  }
  return offline;
}

/**
 * Boot the application
 */
function initApp() {
  initState();
  // A new session starts on today: the planner opens on this week and the journal on today
  const startState = getState();
  startState.ui.plannerWeek = getWeekMonday(new Date());
  startState.ui.journalDate = getLocalDateString(new Date());
  applyCurrentTheme();
  applyDisplaySettings();
  ensureDailySnapshot();      // once a day: keep a restorable copy (if automatic backups are on)

  // Scrolling over a focused number box must not silently change its value (Chrome does this by default)
  document.addEventListener('wheel', (e) => {
    const el = document.activeElement;
    if (el && el.tagName === 'INPUT' && el.type === 'number' && e.target === el) el.blur();
  }, { passive: true });

  // Watch for system color scheme changes when theme is set to 'system'
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const s = getState();
      if (s?.settings?.theme === 'system') {
        applyCurrentTheme();
        renderAppShell();
      }
    });
  }

  // Bind global event delegation
  document.addEventListener('click', (e) => {
    try { handleGlobalClick(e); } catch (err) { reportActionError(err); }
  });
  setupKeyboardShortcuts();

  // Offline badge: FlowBoard needs no connection, but it is good to know why a hosted page will not reload
  window.addEventListener('online', () => updateOfflineIndicator(true));
  window.addEventListener('offline', () => updateOfflineIndicator(true));
  updateOfflineIndicator(false);

  // Timer bar: task picker fires 'change', everything else is click delegation
  const timerBarEl = document.getElementById('timer-bar');
  if (timerBarEl) {
    timerBarEl.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'timer-task-select') {
        timerService.linkTask(e.target.value || null);
      }
    });
  }
  // Saves are normally batched for a moment; flush them when the page is hidden or closed
  const flushSave = () => { try { saveStateImmediate(getState()); } catch (e) { /* nothing to do */ } };
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

  // Planner intention boxes save as you type; Settings capacity boxes save on change
  const mainEl = document.getElementById('main-content');
  if (mainEl) {
    mainEl.addEventListener('input', (e) => {
      const el = e.target;
      if (!el || !el.hasAttribute) return;
      if (el.hasAttribute('data-intention-date')) {
        actions.setDayIntention(el.getAttribute('data-intention-date'), el.value);
      } else if (el.hasAttribute('data-journal-field')) {
        actions.setJournalText(el.getAttribute('data-journal-date'), el.getAttribute('data-journal-field'), el.value);
        journalAfterEdit();
      } else if (el.hasAttribute('data-journal-energy')) {
        actions.setJournalEnergy(el.getAttribute('data-journal-date'), el.value);
        const out = document.getElementById('journal-energy-value');
        if (out) {
          out.textContent = `${el.value} / 10`;
          out.className = 'text-sm font-mono text-[var(--text-primary)]';
        }
        journalAfterEdit();
      } else if (el.hasAttribute('data-journal-search')) {
        actions.setJournalSearch(el.value);
      }
    });
    mainEl.addEventListener('change', (e) => {
      const el = e.target;
      if (!el || !el.hasAttribute) return;
      if (el.hasAttribute('data-capacity-day')) {
        actions.setCapacity(el.getAttribute('data-capacity-day'), el.value);
      } else if (el.hasAttribute('data-import-file')) {
        const file = el.files && el.files[0];
        el.value = '';                       // allow choosing the same file again later
        importFromFile(file);
      } else if (el.hasAttribute('data-timer-preset-index')) {
        const values = [0, 1, 2, 3].map(i => document.getElementById(`preset-${i}`)?.value);
        actions.setTimerPresets(values);
      } else if (el.hasAttribute('data-setting-input')) {
        actions.setSetting(el.getAttribute('data-setting-input'), el.value);
      } else if (el.hasAttribute('data-journal-date-input')) {
        if (el.value) actions.setJournalDate(el.value);
      } else if (el.hasAttribute('data-journal-tag')) {
        actions.setJournalTag(el.getAttribute('data-journal-date'), el.value);
        journalAfterEdit();
      }
    });
  }
  // Browsers only allow audio after a user gesture: unlock it on the first click anywhere
  document.addEventListener('click', () => timerService.ensureAudio(), { once: true, capture: true });

  // Initial renders
  renderAppShell();
  renderActiveView();
  renderTimerBar();
  renderHabitStrip();
  timerService.init();

  // First run in this browser: show the welcome (never while the storage recovery screen is up)
  if (!storageRecoveryActive && getState().meta && getState().meta.onboarded === false) {
    openOnboardingModal();
  }

  console.log(`[FlowBoard Work OS] v${APP_VERSION} initialized successfully.`);
}

// Auto-boot on DOM ready
// (tests/smoke.html sets FLOWBOARD_NO_BOOT so it can load these files without starting the app)
if (typeof window !== 'undefined' && window.FLOWBOARD_NO_BOOT) {
  /* loaded for testing only */
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
