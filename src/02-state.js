// ============================================================================
// STATE & ACTIONS & SELECTORS (02-state.js)
// ============================================================================

/**
 * Single source of truth for the application
 */
let state = null;

/**
 * Initialize state from storage
 */
function initState() {
  state = loadState();
  return state;
}

/**
 * Accessor for the active state
 * @returns {Object} Current state
 */
function getState() {
  if (!state) {
    state = loadState();
  }
  return state;
}

function safeRender() {
  if (typeof renderActiveView === 'function') {
    renderActiveView();          // has its own error panel (M8), never throws
  }
  // Top command bar pieces (M2). Both skip the DOM update when nothing changed.
  // Each is guarded so a fault in one can never stop the other, or the screen below, from updating.
  try { if (typeof renderTimerBar === 'function') renderTimerBar(); } catch (e) { console.error('[FlowBoard] Timer bar failed to render:', e); }
  try { if (typeof renderHabitStrip === 'function') renderHabitStrip(); } catch (e) { console.error('[FlowBoard] Habit strip failed to render:', e); }
}

/**
 * Clean a list of weekdays (0 = Sunday ... 6 = Saturday, matching Date.getDay()).
 * Returns a sorted, de-duplicated array, or null if nothing valid was given.
 */
function normalizeHabitDays(days) {
  if (!Array.isArray(days)) return null;
  const clean = [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  return clean.length > 0 ? clean : null;
}

// ----------------------------------------------------------------------------
// ACTIONS
// Named functions: update updatedAt, call saveState(), and trigger render
// ----------------------------------------------------------------------------

const actions = {
  /**
   * Switch the active view
   * @param {'kanban'|'planner'|'journal'|'insights'|'settings'} viewName
   */
  switchView(viewName) {
    const s = getState();
    const validViews = ['kanban', 'planner', 'journal', 'insights', 'settings'];
    if (!validViews.includes(viewName)) return;

    s.ui.activeView = viewName;
    saveState(s);
    if (typeof renderAppShell === 'function') renderAppShell();
    if (typeof renderActiveView === 'function') renderActiveView();
  },

  /**
   * Set application theme
   * @param {'dark'|'light'|'system'} theme
   */
  setTheme(theme) {
    const s = getState();
    if (!['dark', 'light', 'system'].includes(theme)) return;
    s.settings.theme = theme;
    saveState(s);
    if (typeof applyCurrentTheme === 'function') applyCurrentTheme();
    if (typeof renderAppShell === 'function') renderAppShell();
    // Settings shows the chosen theme; Insights charts take their colours from it
    if ((s.ui.activeView === 'settings' || s.ui.activeView === 'insights') && typeof renderActiveView === 'function') {
      renderActiveView();
    }
  },

  // --------------------------------------------------------------------------
  // M5: INSIGHTS
  // --------------------------------------------------------------------------

  /** Choose the Insights period. Unknown values are ignored. */
  setInsightsRange(key) {
    if (!['this-week', 'last-7', 'last-30'].includes(key)) return false;
    const s = getState();
    s.ui.insightsRange = key;
    saveState(s);
    safeRender();
    return true;
  },

  /** Show or hide the data tables under the Insights charts */
  toggleInsightsTables() {
    const s = getState();
    s.ui.insightsTables = !s.ui.insightsTables;
    saveState(s);
    safeRender();
    return s.ui.insightsTables;
  },

  /**
   * Toggle between dark and light theme
   */
  toggleTheme() {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    actions.setTheme(isCurrentlyDark ? 'light' : 'dark');
  },

  // --------------------------------------------------------------------------
  // TASK ACTIONS
  // --------------------------------------------------------------------------

  /**
   * Add a new task
   * @param {Object} taskData
   * @returns {Object} Created task
   */
  addTask(taskData = {}) {
    const s = getState();
    const status = taskData.status || 'todo';
    const now = Date.now();

    // Determine order: place at end of target column
    const existingColTasks = s.tasks.filter(t => !t.deletedAt && t.status === status);
    const maxOrder = existingColTasks.length > 0
      ? Math.max(...existingColTasks.map(t => Number(t.order) || 0))
      : 0;

    const newTask = {
      id: generateId('t'),
      title: (taskData.title || '').trim(),
      desc: (taskData.desc || '').trim(),
      status: status,
      priority: taskData.priority || 'medium', // 'urgent' | 'high' | 'medium' | 'low'
      tagIds: Array.isArray(taskData.tagIds) ? taskData.tagIds : [],
      areaId: taskData.areaId || null,
      scheduledDate: taskData.scheduledDate || null,
      estMin: Number(taskData.estMin) >= 0 ? Number(taskData.estMin) : 60,
      order: maxOrder + 1000,
      completedAt: status === 'done' ? now : null,
      subtasks: Array.isArray(taskData.subtasks)
        ? taskData.subtasks.map(st => ({
            id: st.id || generateId('st'),
            text: (st.text || '').trim(),
            done: Boolean(st.done)
          }))
        : [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    s.tasks.push(newTask);
    saveState(s);
    safeRender();
    return newTask;
  },

  /**
   * Update an existing task
   * @param {string} taskId
   * @param {Object} updates
   * @returns {Object|null} Updated task
   */
  updateTask(taskId, updates = {}) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId);
    if (!task) return null;

    const now = Date.now();
    const oldStatus = task.status;
    const newStatus = updates.status !== undefined ? updates.status : oldStatus;

    // Handle completedAt timestamp transitions
    if (newStatus === 'done' && oldStatus !== 'done') {
      task.completedAt = now;
    } else if (newStatus !== 'done' && oldStatus === 'done') {
      task.completedAt = null;
    }

    if (updates.title !== undefined) task.title = updates.title.trim();
    if (updates.desc !== undefined) task.desc = updates.desc.trim();
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.tagIds !== undefined) task.tagIds = updates.tagIds;
    if (updates.areaId !== undefined) task.areaId = updates.areaId || null;
    if (updates.scheduledDate !== undefined) task.scheduledDate = updates.scheduledDate || null;
    if (updates.estMin !== undefined) task.estMin = Number(updates.estMin) >= 0 ? Number(updates.estMin) : task.estMin;
    if (updates.subtasks !== undefined) {
      task.subtasks = updates.subtasks.map(st => ({
        id: st.id || generateId('st'),
        text: (st.text || '').trim(),
        done: Boolean(st.done)
      }));
    }

    task.updatedAt = now;
    saveState(s);
    safeRender();
    return task;
  },

  /**
   * Move task to a different status and optional order position
   * @param {string} taskId
   * @param {'backlog'|'todo'|'inprogress'|'done'} newStatus
   * @param {number|null} [newOrder=null]
   */
  moveTask(taskId, newStatus, newOrder = null) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId);
    if (!task) return;

    const now = Date.now();
    const oldStatus = task.status;
    task.status = newStatus;

    // CompletedAt logic
    if (newStatus === 'done' && oldStatus !== 'done') {
      task.completedAt = now;
    } else if (newStatus !== 'done' && oldStatus === 'done') {
      task.completedAt = null;
    }

    if (newOrder !== null && typeof newOrder === 'number') {
      task.order = newOrder;
    } else {
      // Place at end of column if no order specified
      const colTasks = s.tasks.filter(t => !t.deletedAt && t.status === newStatus && t.id !== taskId);
      const maxOrder = colTasks.length > 0 ? Math.max(...colTasks.map(t => Number(t.order) || 0)) : 0;
      task.order = maxOrder + 1000;
    }

    task.updatedAt = now;
    saveState(s);
    safeRender();
  },

  /**
   * Re-normalize column order sequence
   * @param {'backlog'|'todo'|'inprogress'|'done'} status
   * @param {string[]} orderedTaskIds
   */
  reorderColumn(status, orderedTaskIds) {
    const s = getState();
    const now = Date.now();
    orderedTaskIds.forEach((id, index) => {
      const task = s.tasks.find(t => t.id === id);
      if (task) {
        task.order = (index + 1) * 1000;
        task.updatedAt = now;
      }
    });
    saveState(s);
    safeRender();
  },

  /**
   * Soft delete a task with Undo toast
   * @param {string} taskId
   */
  deleteTask(taskId) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId);
    if (!task) return;

    const now = Date.now();
    task.deletedAt = now;
    task.updatedAt = now;
    saveState(s);
    safeRender();

    showToast('Task deleted', {
      duration: 6000,
      actionText: 'Undo',
      onAction: () => actions.restoreTask(taskId)
    });
  },

  /**
   * Restore a soft-deleted task
   * @param {string} taskId
   */
  restoreTask(taskId) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.deletedAt = null;
    task.updatedAt = Date.now();
    saveState(s);
    safeRender();
    showToast('Task restored', { type: 'success' });
  },

  /**
   * Toggle completion state of a subtask
   * @param {string} taskId
   * @param {string} subtaskId
   */
  toggleSubtask(taskId, subtaskId) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const st = task.subtasks.find(s => s.id === subtaskId);
    if (st) {
      st.done = !st.done;
      task.updatedAt = Date.now();
      saveState(s);
      renderActiveView();
    }
  },

  // --------------------------------------------------------------------------
  // TAG ACTIONS
  // --------------------------------------------------------------------------

  /**
   * Add a new tag
   * @param {Object} tagData
   * @returns {Object} Created tag
   */
  addTag(tagData = {}) {
    const s = getState();
    const validColors = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'];
    const color = validColors.includes(tagData.color) ? tagData.color : 'indigo';
    const name = (tagData.name || '').trim();
    if (!name) return null;

    const now = Date.now();
    const newTag = {
      id: generateId('tag'),
      name: name,
      color: color,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    s.tags.push(newTag);
    saveState(s);
    safeRender();
    return newTag;
  },

  /**
   * Soft delete tag and reset filter if active
   * @param {string} tagId
   */
  deleteTag(tagId) {
    const s = getState();
    const tag = s.tags.find(t => t.id === tagId);
    if (!tag) return;

    const now = Date.now();
    tag.deletedAt = now;
    tag.updatedAt = now;

    // Reset filter to 'all' if the deleted tag was active (SPEC Addition 2)
    if (s.ui.activeTagFilter === tagId) {
      s.ui.activeTagFilter = 'all';
    }

    saveState(s);
    safeRender();
    showToast(`Tag "${tag.name}" removed`, { type: 'info' });
  },

  /**
   * Set tag filter pill
   * @param {string} tagId - 'all' or specific tagId
   */
  setActiveTagFilter(tagId) {
    const s = getState();
    s.ui.activeTagFilter = tagId || 'all';
    saveState(s);
    safeRender();
  },

  /**
   * Set live search query
   * @param {string} query
   */
  setSearchQuery(query) {
    const s = getState();
    s.ui.searchQuery = query || '';
    saveState(s);
    safeRender();
  },

  /**
   * Toggle Done column "Show older" state (SPEC Addition 1)
   */
  toggleShowOlderDone() {
    const s = getState();
    s.ui.showOlderDone = !s.ui.showOlderDone;
    saveState(s);
    safeRender();
  },

  // --------------------------------------------------------------------------
  // AREA ACTIONS (M1.1)
  // --------------------------------------------------------------------------

  /**
   * Add a new area
   * @param {Object} areaData - { name, color, icon }
   * @returns {Object|null} Created area
   */
  addArea(areaData = {}) {
    const s = getState();
    const validColors = ['blue', 'emerald', 'amber', 'rose', 'sky', 'purple', 'indigo', 'violet'];
    const color = validColors.includes(areaData.color) ? areaData.color : 'blue';
    const name = (areaData.name || '').trim();
    if (!name) return null;

    const activeAreas = (s.areas || []).filter(a => !a.deletedAt);
    const maxOrder = activeAreas.length > 0
      ? Math.max(...activeAreas.map(a => Number(a.order) || 0))
      : 0;

    const now = Date.now();
    const newArea = {
      id: generateId('area'),
      name,
      color,
      icon: (areaData.icon || '📁').trim() || '📁',
      order: maxOrder + 1000,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    if (!Array.isArray(s.areas)) s.areas = [];
    s.areas.push(newArea);
    saveState(s);
    safeRender();
    return newArea;
  },

  /**
   * Update an existing area (rename, recolor, re-icon)
   * @param {string} areaId
   * @param {Object} updates - { name?, color?, icon? }
   */
  updateArea(areaId, updates = {}) {
    const s = getState();
    const area = (s.areas || []).find(a => a.id === areaId);
    if (!area) return;

    const validColors = ['blue', 'emerald', 'amber', 'rose', 'sky', 'purple', 'indigo', 'violet'];
    if (updates.name !== undefined) area.name = updates.name.trim() || area.name;
    if (updates.color !== undefined && validColors.includes(updates.color)) area.color = updates.color;
    if (updates.icon !== undefined) area.icon = updates.icon.trim() || area.icon;
    area.updatedAt = Date.now();
    saveState(s);
    safeRender();
  },

  /**
   * Reorder areas by providing an ordered list of IDs
   * @param {string[]} orderedIds
   */
  reorderAreas(orderedIds) {
    const s = getState();
    const now = Date.now();
    orderedIds.forEach((id, index) => {
      const area = (s.areas || []).find(a => a.id === id);
      if (area) {
        area.order = (index + 1) * 1000;
        area.updatedAt = now;
      }
    });
    saveState(s);
    safeRender();
  },

  /**
   * Soft delete an area with Undo toast
   * @param {string} areaId
   */
  deleteArea(areaId) {
    const s = getState();
    const area = (s.areas || []).find(a => a.id === areaId);
    if (!area) return;

    const now = Date.now();
    area.deletedAt = now;
    area.updatedAt = now;
    // If the board is currently filtered to this area, reset the filter
    if (s.ui && s.ui.kanbanFilterArea === areaId) {
      s.ui.kanbanFilterArea = 'all';
    }
    saveState(s);
    safeRender();

    showToast(`Area "${area.name}" deleted`, {
      duration: 6000,
      actionText: 'Undo',
      onAction: () => actions.restoreArea(areaId)
    });
  },

  /**
   * Restore a soft-deleted area
   * @param {string} areaId
   */
  restoreArea(areaId) {
    const s = getState();
    const area = (s.areas || []).find(a => a.id === areaId);
    if (!area) return;

    area.deletedAt = null;
    area.updatedAt = Date.now();
    saveState(s);
    safeRender();
    showToast('Area restored', { type: 'success' });
  },

  // --------------------------------------------------------------------------
  // KANBAN TOOLBAR ACTIONS (M1.1)
  // --------------------------------------------------------------------------

  /** Set kanban group-by */
  setKanbanGroupBy(value) {
    const valid = ['none', 'area', 'priority', 'tag'];
    if (!valid.includes(value)) return;
    const s = getState();
    s.ui.kanbanGroupBy = value;
    saveState(s);
    safeRender();
  },

  /** Set kanban sort-by */
  setKanbanSortBy(value) {
    const valid = ['manual', 'priority', 'estimate', 'scheduled'];
    if (!valid.includes(value)) return;
    const s = getState();
    s.ui.kanbanSortBy = value;
    saveState(s);
    safeRender();
  },

  /** Set kanban area filter */
  setKanbanFilterArea(areaId) {
    const s = getState();
    s.ui.kanbanFilterArea = areaId || 'all';
    saveState(s);
    safeRender();
  },

  /** Set kanban priority filter */
  setKanbanFilterPriority(priority) {
    const valid = ['all', 'urgent', 'high', 'medium', 'low'];
    const s = getState();
    s.ui.kanbanFilterPriority = valid.includes(priority) ? priority : 'all';
    saveState(s);
    safeRender();
  },

  /** Set kanban scheduled filter */
  setKanbanFilterScheduled(value) {
    const valid = ['all', 'scheduled', 'unscheduled'];
    const s = getState();
    s.ui.kanbanFilterScheduled = valid.includes(value) ? value : 'all';
    saveState(s);
    safeRender();
  },

  /** Clear all kanban filters/group/sort to defaults */
  clearKanbanFilters() {
    const s = getState();
    s.ui.kanbanGroupBy = 'none';
    s.ui.kanbanSortBy = 'manual';
    s.ui.kanbanFilterArea = 'all';
    s.ui.kanbanFilterPriority = 'all';
    s.ui.kanbanFilterScheduled = 'all';
    s.ui.searchQuery = '';
    s.ui.activeTagFilter = 'all';
    s.ui.kanbanSavedView = null;       // a quick view is a filter too: 'Clear filters' really clears everything
    saveState(s);
    safeRender();
  },

  /** Toggle collapse state of a kanban column */
  toggleKanbanColumn(status) {
    const s = getState();
    if (!s.ui.kanbanCollapsedColumns) s.ui.kanbanCollapsedColumns = {};
    s.ui.kanbanCollapsedColumns[status] = !s.ui.kanbanCollapsedColumns[status];
    saveState(s);
    safeRender();
  },

  /** Toggle collapse state of a kanban group */
  toggleKanbanGroup(groupKey) {
    const s = getState();
    if (!s.ui.kanbanCollapsedGroups) s.ui.kanbanCollapsedGroups = {};
    s.ui.kanbanCollapsedGroups[groupKey] = !s.ui.kanbanCollapsedGroups[groupKey];
    saveState(s);
    safeRender();
  },

  /** Toggle the mobile filter panel */
  toggleKanbanFiltersPanel() {
    const s = getState();
    s.ui.kanbanFiltersOpen = !s.ui.kanbanFiltersOpen;
    saveState(s);
    safeRender();
  },

  /**
   * Apply a named saved view preset (sets filters but does not overwrite group/sort)
   * @param {'today'|'this-week'|'urgent'|'unscheduled'} viewId
   */
  applyKanbanSavedView(viewId) {
    const s = getState();
    // First reset filters to defaults
    s.ui.kanbanFilterArea = 'all';
    s.ui.kanbanFilterPriority = 'all';
    s.ui.kanbanFilterScheduled = 'all';
    s.ui.searchQuery = '';
    s.ui.activeTagFilter = 'all';
    s.ui.kanbanGroupBy = 'none';
    s.ui.kanbanSortBy = 'manual';

    // Saved views are evaluated at read time (see getKanbanFilteredTasks),
    // so 'Today' and 'This week' stay correct if the app is left open past midnight.
    switch (viewId) {
      case 'today':
      case 'this-week':
        s.ui.kanbanSavedView = viewId;
        break;
      case 'urgent':
        s.ui.kanbanFilterPriority = 'urgent';
        s.ui.kanbanSortBy = 'priority';
        s.ui.kanbanSavedView = 'urgent';
        break;
      case 'unscheduled':
        s.ui.kanbanFilterScheduled = 'unscheduled';
        s.ui.kanbanSavedView = 'unscheduled';
        break;
      default:
        s.ui.kanbanSavedView = null;
        break;
    }
    saveState(s);
    safeRender();
  },

  /** Clear the active saved view (return to manual filters) */
  clearKanbanSavedView() {
    const s = getState();
    s.ui.kanbanSavedView = null;
    saveState(s);
    safeRender();
  },

  // --------------------------------------------------------------------------
  // M2: SOUND, FOCUS LOG, HABITS
  // --------------------------------------------------------------------------

  /** Turn the timer chime on or off */
  toggleSound() {
    const s = getState();
    s.settings.soundEnabled = !s.settings.soundEnabled;
    saveState(s, true);
    safeRender();
  },

  /**
   * Append a focus session to the log. Task minutes are derived from this log.
   * @param {{taskId?:string|null, minutes:number, date?:string, startedAt?:number}} data
   * @returns {Object|null} the new record, or null if minutes < 1
   */
  logFocus(data = {}) {
    const minutes = Math.round(Number(data.minutes));
    if (!minutes || minutes < 1) return null;
    const s = getState();
    const now = Date.now();
    const record = {
      id: generateId('f'),
      date: data.date || getLocalDateString(new Date(now)),
      taskId: data.taskId || null,
      minutes,
      kind: 'focus',
      startedAt: data.startedAt || now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    if (!Array.isArray(s.focusLog)) s.focusLog = [];
    s.focusLog.push(record);
    saveState(s, true);
    safeRender();
    return record;
  },

  /** Add a habit. targetDays use Date.getDay() numbers (0 = Sunday). */
  addHabit(data = {}) {
    const title = String(data.title || '').trim().slice(0, 60);
    if (!title) return null;
    const days = normalizeHabitDays(data.targetDays) || [1, 2, 3, 4, 5];
    const s = getState();
    const now = Date.now();
    const habit = {
      id: generateId('h'),
      title,
      targetDays: days,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    if (!Array.isArray(s.habits)) s.habits = [];
    s.habits.push(habit);
    saveState(s);
    safeRender();
    return habit;
  },

  /** Rename a habit and/or change its days */
  updateHabit(habitId, updates = {}) {
    const s = getState();
    const habit = (s.habits || []).find(h => h.id === habitId && !h.deletedAt);
    if (!habit) return;
    if (updates.title !== undefined) {
      const title = String(updates.title).trim().slice(0, 60);
      if (title) habit.title = title;
    }
    if (updates.targetDays !== undefined) {
      const days = normalizeHabitDays(updates.targetDays);
      if (days) habit.targetDays = days;
    }
    habit.updatedAt = Date.now();
    saveState(s);
    safeRender();
  },

  /** Soft-delete a habit (its history stays in habitLog) with Undo */
  deleteHabit(habitId) {
    const s = getState();
    const habit = (s.habits || []).find(h => h.id === habitId && !h.deletedAt);
    if (!habit) return;
    const now = Date.now();
    habit.deletedAt = now;
    habit.updatedAt = now;
    saveState(s);
    safeRender();
    if (typeof refreshHabitManagerIfOpen === 'function') refreshHabitManagerIfOpen();
    showToast(`Habit “${habit.title}” deleted`, {
      duration: 6000,
      actionText: 'Undo',
      onAction: () => actions.restoreHabit(habitId)
    });
  },

  restoreHabit(habitId) {
    const s = getState();
    const habit = (s.habits || []).find(h => h.id === habitId);
    if (!habit) return;
    habit.deletedAt = null;
    habit.updatedAt = Date.now();
    saveState(s);
    safeRender();
    if (typeof refreshHabitManagerIfOpen === 'function') refreshHabitManagerIfOpen();
    showToast('Habit restored', { type: 'success' });
  },

  /** Check or uncheck a habit for a date (defaults to today) */
  toggleHabit(habitId, date) {
    const s = getState();
    const habit = (s.habits || []).find(h => h.id === habitId && !h.deletedAt);
    if (!habit) return;
    const day = date || getLocalDateString(new Date());
    const now = Date.now();
    if (!Array.isArray(s.habitLog)) s.habitLog = [];
    const entry = s.habitLog.find(l => l.habitId === habitId && l.date === day);
    if (entry) {
      entry.done = !entry.done;
      entry.updatedAt = now;
    } else {
      s.habitLog.push({ id: `hl-${habitId}-${day}`, habitId, date: day, done: true, updatedAt: now });
    }
    saveState(s);
    safeRender();
  },

  // --------------------------------------------------------------------------
  // M3: WEEKLY PLANNER
  // --------------------------------------------------------------------------

  /** Show the week containing the given date (stored as that week's Monday) */
  setPlannerWeek(dateStr) {
    const s = getState();
    s.ui.plannerWeek = getWeekMonday(dateStr || new Date());
    saveState(s);
    safeRender();
  },

  /** Move the planner by whole weeks (+1 next, -1 previous) */
  shiftPlannerWeek(deltaWeeks) {
    const s = getState();
    const current = s.ui.plannerWeek || getWeekMonday(new Date());
    s.ui.plannerWeek = addDaysStr(current, 7 * Number(deltaWeeks || 0));
    saveState(s);
    safeRender();
  },

  /** Put a task on a day, or pass null to move it back to Unscheduled */
  scheduleTask(taskId, dateStr) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId && !t.deletedAt);
    if (!task) return;
    const date = dateStr || null;
    if ((task.scheduledDate || null) === date) return;
    actions.updateTask(taskId, { scheduledDate: date });
  },

  /** Move a scheduled task one day earlier (-1) or later (+1) */
  shiftTaskDay(taskId, deltaDays) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId && !t.deletedAt);
    if (!task || !task.scheduledDate) return;
    actions.scheduleTask(taskId, addDaysStr(task.scheduledDate, Number(deltaDays) || 0));
  },

  /** Tick a task done (or back to To Do) from the planner */
  toggleTaskDone(taskId) {
    const s = getState();
    const task = s.tasks.find(t => t.id === taskId && !t.deletedAt);
    if (!task) return;
    actions.moveTask(taskId, task.status === 'done' ? 'todo' : 'done');
  },

  /** Carry over one unfinished task from an earlier day: to today, or unscheduled (null) */
  carryOverTask(taskId, target) {
    actions.scheduleTask(taskId, target === 'today' ? getLocalDateString(new Date()) : null);
  },

  /** Move every unfinished task from earlier days to today. Returns how many moved. */
  carryOverAll() {
    const s = getState();
    const today = getLocalDateString(new Date());
    const overdue = selectors.getCarryOverTasks(today, s);
    if (overdue.length === 0) return 0;
    const now = Date.now();
    overdue.forEach(t => { t.scheduledDate = today; t.updatedAt = now; });
    saveState(s);
    safeRender();
    showToast(`Moved ${overdue.length} task${overdue.length > 1 ? 's' : ''} to today`, { type: 'success' });
    return overdue.length;
  },

  /** Save the daily #1 intention. Saves quietly (no re-render) so typing never loses focus. */
  setDayIntention(dateStr, text) {
    if (!dateStr) return;
    const s = getState();
    if (!Array.isArray(s.dayIntentions)) s.dayIntentions = [];
    const value = String(text || '').slice(0, 200);
    let entry = s.dayIntentions.find(d => d.date === dateStr);
    if (entry) {
      entry.text = value;
      entry.updatedAt = Date.now();
    } else {
      entry = { id: `di-${dateStr}`, date: dateStr, text: value, updatedAt: Date.now() };
      s.dayIntentions.push(entry);
    }
    saveState(s);
  },

  /** Set the planned capacity (in hours, 0 to 16) for a weekday key like 'Mon' */
  setCapacity(dayKey, hours) {
    if (!DAY_KEYS.includes(dayKey)) return false;
    const value = Number(hours);
    if (!isFinite(value) || value < 0 || value > 16) {
      showToast('Capacity must be between 0 and 16 hours.', { type: 'warning' });
      safeRender();
      return false;
    }
    const s = getState();
    if (!s.settings.capacityByWeekday) s.settings.capacityByWeekday = {};
    s.settings.capacityByWeekday[dayKey] = Math.round(value * 4) / 4;   // nearest 15 minutes
    saveState(s);
    safeRender();
    return true;
  },

  // --------------------------------------------------------------------------
  // M4: JOURNAL
  // --------------------------------------------------------------------------

  /** Show a journal day. Future dates and invalid values fall back to today. */
  setJournalDate(dateStr) {
    const today = getLocalDateString(new Date());
    const s = getState();
    let day = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || '')) ? dateStr : today;
    if (day > today) day = today;
    s.ui.journalDate = day;
    saveState(s);
    safeRender();
  },

  shiftJournalDate(deltaDays) {
    const s = getState();
    const current = s.ui.journalDate || getLocalDateString(new Date());
    actions.setJournalDate(addDaysStr(current, Number(deltaDays) || 0));
  },

  /**
   * Create or update the entry for a date. Quiet: it saves but does not re-render,
   * so typing never loses focus. An entry is only created when there is something to store.
   */
  updateJournalEntry(dateStr, fields = {}) {
    const s = getState();
    const now = Date.now();
    if (!Array.isArray(s.journalEntries)) s.journalEntries = [];
    let entry = s.journalEntries.find(e => e.date === dateStr);
    if (!entry) {
      entry = { id: `j-${dateStr}`, date: dateStr, mood: null, energy: null, tagId: null, wins: '', blockers: '', notes: '', createdAt: now, updatedAt: now, deletedAt: null };
      s.journalEntries.push(entry);
    } else if (entry.deletedAt) {
      // Writing on a deleted day starts a clean entry
      Object.assign(entry, { mood: null, energy: null, tagId: null, wins: '', blockers: '', notes: '', deletedAt: null, createdAt: now });
    }
    ['wins', 'blockers', 'notes'].forEach(k => {
      if (fields[k] !== undefined) entry[k] = String(fields[k]).slice(0, 5000);
    });
    if (fields.mood !== undefined) {
      const m = Number(fields.mood);
      entry.mood = (m >= 1 && m <= 5) ? Math.round(m) : null;
    }
    if (fields.energy !== undefined) {
      const e = Number(fields.energy);
      entry.energy = (e >= 1 && e <= 10) ? Math.round(e) : null;
    }
    if (fields.tagId !== undefined) entry.tagId = fields.tagId || null;
    entry.updatedAt = now;
    saveState(s);
    return entry;
  },

  /** Pick a mood (1 to 5). Picking the same mood again clears it. */
  setJournalMood(dateStr, mood) {
    const current = selectors.getJournalEntry(dateStr);
    const next = (current && current.mood === Number(mood)) ? null : Number(mood);
    actions.updateJournalEntry(dateStr, { mood: next });
    safeRender();
  },

  setJournalEnergy(dateStr, value) {
    actions.updateJournalEntry(dateStr, { energy: value });
  },

  setJournalText(dateStr, field, text) {
    if (!['wins', 'blockers', 'notes'].includes(field)) return;
    // Do not create an empty entry just because a box was clicked
    if (!selectors.getJournalEntry(dateStr) && !String(text || '').trim()) return;
    actions.updateJournalEntry(dateStr, { [field]: text });
  },

  setJournalTag(dateStr, tagId) {
    if (!selectors.getJournalEntry(dateStr) && !tagId) return;
    actions.updateJournalEntry(dateStr, { tagId: tagId || null });
  },

  /** Filter the timeline. Updates only the timeline, so the search box keeps focus. */
  setJournalSearch(query) {
    const s = getState();
    s.ui.journalSearch = String(query || '').slice(0, 100);
    saveState(s);
    if (typeof refreshJournalSideRegions === 'function') refreshJournalSideRegions();
  },

  /**
   * Add the titles of tasks completed on this date to Key Wins, skipping any already listed.
   * @returns {number} how many lines were added
   */
  pullDoneTasks(dateStr) {
    const s = getState();
    const entry = selectors.getJournalEntry(dateStr, s);
    const existingText = entry ? String(entry.wins || '') : '';
    const seen = new Set(existingText.split(/\r?\n/).map(normalizeNoteLine).filter(Boolean));
    const toAdd = selectors.getDoneTasksOnDate(dateStr, s).filter(t => !seen.has(normalizeNoteLine(t.title)));
    if (toAdd.length === 0) {
      showToast('No new completed tasks for this day.', { type: 'info' });
      return 0;
    }
    const base = existingText.replace(/\s+$/, '');
    const wins = (base ? base + '\n' : '') + toAdd.map(t => `• ${t.title}`).join('\n');
    actions.updateJournalEntry(dateStr, { wins });
    safeRender();
    showToast(`Added ${toAdd.length} completed task${toAdd.length > 1 ? 's' : ''} to Key Wins`, { type: 'success' });
    return toAdd.length;
  },

  /**
   * Turn note lines into task cards.
   * @param {{date:string, source:'wins'|'blockers'|'notes', lines:{lineIndex:number,title:string}[],
   *          status:'todo'|'backlog', schedule:'tomorrow'|'none', mark:boolean}} data
   * @returns {number} tasks created
   */
  sendLinesToKanban(data = {}) {
    const date = data.date || getLocalDateString(new Date());
    const field = ['wins', 'blockers', 'notes'].includes(data.source) ? data.source : 'notes';
    const status = data.status === 'backlog' ? 'backlog' : 'todo';
    const lines = (data.lines || []).filter(l => l && String(l.title || '').trim());
    if (lines.length === 0) return 0;
    const scheduledDate = data.schedule === 'none' ? null : addDaysStr(date, 1);
    const note = `From journal, ${formatDisplayDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}`;
    lines.forEach(l => actions.addTask({
      title: String(l.title).trim().slice(0, 140), desc: note, status, priority: 'medium', estMin: 30, scheduledDate
    }));
    if (data.mark !== false) {
      const entry = selectors.getJournalEntry(date);
      if (entry) actions.updateJournalEntry(date, { [field]: markLinesSent(entry[field], lines.map(l => l.lineIndex)) });
    }
    safeRender();
    return lines.length;
  },

  /** Soft-delete a day's entry, with Undo */
  deleteJournalEntry(dateStr) {
    const s = getState();
    const entry = (s.journalEntries || []).find(e => e.date === dateStr && !e.deletedAt);
    if (!entry) return;
    entry.deletedAt = Date.now();
    entry.updatedAt = entry.deletedAt;
    saveState(s);
    safeRender();
    showToast('Journal entry deleted', {
      duration: 6000, actionText: 'Undo', onAction: () => actions.restoreJournalEntry(dateStr)
    });
  },

  restoreJournalEntry(dateStr) {
    const s = getState();
    const entry = (s.journalEntries || []).find(e => e.date === dateStr);
    if (!entry) return;
    entry.deletedAt = null;
    entry.updatedAt = Date.now();
    saveState(s);
    safeRender();
  },

  // --------------------------------------------------------------------------
  // M6: SETTINGS AND DATA SAFETY
  // --------------------------------------------------------------------------

  /** Change one simple setting (validated). Returns true if it was applied. */
  setSetting(key, value) {
    const rules = {
      compactCards: v => Boolean(v),
      soundEnabled: v => Boolean(v),
      autoBackup: v => Boolean(v),
      wipLimit: v => { const n = Math.round(Number(v)); return (isFinite(n) && n >= 1 && n <= 50) ? n : undefined; }
    };
    if (!Object.prototype.hasOwnProperty.call(rules, key)) return false;
    const next = rules[key](value);
    if (next === undefined) {
      showToast('The WIP limit must be a whole number from 1 to 50.', { type: 'warning' });
      safeRender();
      return false;
    }
    const s = getState();
    s.settings[key] = next;
    saveState(s, true);
    if (typeof applyDisplaySettings === 'function') applyDisplaySettings();
    safeRender();
    return true;
  },

  /**
   * Set the four timer lengths in minutes: [Focus, Deep work, Sprint, Break].
   * They must be whole numbers from 1 to 600 and all different.
   */
  setTimerPresets(values) {
    const list = Array.isArray(values) ? values.map(Number) : [];
    const valid = list.length === 4 && list.every(n => Number.isInteger(n) && n >= 1 && n <= 600) && new Set(list).size === 4;
    if (!valid) {
      showToast('Timer lengths must be four different whole numbers of minutes (1 to 600).', { type: 'warning' });
      safeRender();
      return false;
    }
    const s = getState();
    s.settings.timerPresets = list;
    const t = s.timer;
    if (t.status === 'idle') {          // never disturb a session that is running or paused
      if (!list.includes(Number(t.presetMin))) t.presetMin = list[0];
      t.mode = getTimerModeForPreset(t.presetMin);
    }
    saveState(s, true);
    safeRender();
    if (typeof timerService !== 'undefined') timerService.updateDisplay();
    return true;
  },

  /** Save a restorable copy right now */
  snapshotNow() {
    const snap = takeSnapshot('manual');
    if (!snap) {
      showToast('There is not enough browser storage for another copy. Export a file instead.', { type: 'error' });
      return null;
    }
    showToast('Backup copy saved in this browser', { type: 'success' });
    safeRender();
    return snap;
  },

  /**
   * Replace ALL data with a validated state (import, restore, sample data, start blank).
   * A safety copy of the current data is saved first. Returns the safety copy's id, or null on failure.
   */
  replaceAllData(newState, reason = 'import') {
    const old = getState();
    const safety = takeSnapshot(`before-${reason}`, old);
    const next = newState;
    next.deviceId = old.deviceId || next.deviceId;
    next.ui = { ...getDefaultState().ui, activeView: 'settings' };
    next.timer = { ...getDefaultState().timer, presetMin: (next.settings.timerPresets || [25])[0], mode: 'focus' };
    state = next;
    if (!saveStateImmediate(next)) {      // could not write (storage full): put everything back
      state = old;
      return null;
    }
    if (typeof applyDisplaySettings === 'function') applyDisplaySettings();
    if (typeof applyCurrentTheme === 'function') applyCurrentTheme();
    if (typeof renderAppShell === 'function') renderAppShell();
    safeRender();
    if (typeof timerService !== 'undefined') timerService.updateDisplay();
    return safety ? safety.id : 'none';
  },

  /** Put back a saved snapshot (checked like any imported file) */
  restoreSnapshot(snapId) {
    const snap = readSnapshots().find(x => x.id === snapId);
    if (!snap) { showToast('That backup copy no longer exists.', { type: 'error' }); return false; }
    const result = validateImportData(snap.data);
    if (!result.ok) { showToast('That backup copy could not be read.', { type: 'error' }); return false; }
    const undoId = actions.replaceAllData(result.state, 'restore');
    if (!undoId) { showToast('Restore failed: not enough browser storage.', { type: 'error' }); return false; }
    showToast('Backup restored', {
      type: 'success', duration: 12000,
      actionText: undoId === 'none' ? null : 'Undo',
      onAction: undoId === 'none' ? null : () => actions.restoreSnapshot(undoId)
    });
    return true;
  },

  /** Wipe tasks, habits, journal... but keep your settings. Safety copy first, with Undo. */
  startBlank() {
    const old = getState();
    const fresh = getDefaultState();
    fresh.settings = { ...old.settings };
    const undoId = actions.replaceAllData(fresh, 'reset');
    if (!undoId) { showToast('Could not start blank: not enough browser storage.', { type: 'error' }); return false; }
    showToast('Workspace is blank. Your settings were kept.', {
      type: 'success', duration: 15000,
      actionText: undoId === 'none' ? null : 'Undo',
      onAction: undoId === 'none' ? null : () => actions.restoreSnapshot(undoId)
    });
    return true;
  },

  /** Replace everything with the sample workspace (settings kept). Safety copy first, with Undo. */
  loadSampleData() {
    const old = getState();
    const sample = buildSampleState();
    sample.settings = { ...old.settings };
    const undoId = actions.replaceAllData(sample, 'sample');
    if (!undoId) { showToast('Could not load sample data: not enough browser storage.', { type: 'error' }); return false; }
    showToast('Sample data loaded. Explore, then use Start Blank when you are ready.', {
      type: 'success', duration: 15000,
      actionText: undoId === 'none' ? null : 'Undo',
      onAction: undoId === 'none' ? null : () => actions.restoreSnapshot(undoId)
    });
    return true;
  },

  // --------------------------------------------------------------------------
  // M7: FIRST-RUN WELCOME
  // --------------------------------------------------------------------------

  /**
   * Finish (or skip) the first-run welcome. Only meant for a brand-new workspace: it builds a
   * fresh blank or sample workspace, applies the chosen hours and first habit, and marks
   * meta.onboarded so the welcome never shows again.
   * Skipping changes nothing except meta.onboarded.
   * @param {{skipped?:boolean, start?:'blank'|'sample', weekdayHours?:number|string, saturdayHours?:number|string,
   *          sundayHours?:number|string, habitTitle?:string, habitDays?:number[]}} data
   * @returns {boolean} true when saved
   */
  completeOnboarding(data = {}) {
    const current = getState();
    if (!current.meta) current.meta = { lastBackupAt: 0, lastSyncAt: 0 };
    if (data.skipped) {
      current.meta.onboarded = true;
      saveState(current, true);
      safeRender();
      return true;
    }

    const hours = (v, fallback) => {
      if (v === '' || v === null || v === undefined || typeof v === 'boolean') return fallback;
      const n = Number(v);
      return (isFinite(n) && n >= 0 && n <= 16) ? Math.round(n * 4) / 4 : fallback;
    };
    const sample = data.start === 'sample';
    const next = sample ? buildSampleState() : getDefaultState();
    next.deviceId = current.deviceId || next.deviceId;

    // Keep any setting already chosen (for example the theme), then apply the hours
    const weekday = hours(data.weekdayHours, 6);
    next.settings = {
      ...current.settings,
      dailyCapacityHours: weekday,
      capacityByWeekday: {
        Mon: weekday, Tue: weekday, Wed: weekday, Thu: weekday, Fri: weekday,
        Sat: hours(data.saturdayHours, 2),
        Sun: hours(data.sundayHours, 0)
      }
    };

    // One habit. Blank start: it is the only habit (or none if left empty). Sample: it is added to the examples.
    const title = String(data.habitTitle || '').trim().slice(0, 60);
    const now = Date.now();
    const habit = title ? {
      id: generateId('h'), title, targetDays: normalizeHabitDays(data.habitDays) || [1, 2, 3, 4, 5],
      archived: false, createdAt: now, updatedAt: now, deletedAt: null
    } : null;
    if (!sample) next.habits = habit ? [habit] : [];
    else if (habit && !next.habits.some(h => h.title.toLowerCase() === title.toLowerCase())) next.habits.push(habit);

    next.meta = { ...next.meta, onboarded: true };
    state = next;
    if (!saveStateImmediate(next)) {      // could not write: stay on the untouched workspace
      state = current;
      return false;
    }
    if (typeof applyDisplaySettings === 'function') applyDisplaySettings();
    if (typeof applyCurrentTheme === 'function') applyCurrentTheme();
    if (typeof renderAppShell === 'function') renderAppShell();
    safeRender();
    if (typeof timerService !== 'undefined') timerService.updateDisplay();
    return true;
  }
};

// ----------------------------------------------------------------------------
// SELECTORS
// Pure query functions on state (testable and side-effect free)
// ----------------------------------------------------------------------------

const selectors = {
  /**
   * Get active view name
   */
  getActiveView(s = getState()) {
    return s?.ui?.activeView || 'kanban';
  },

  /**
   * Get effective theme (resolves 'system' to 'dark' or 'light')
   */
  getEffectiveTheme(s = getState()) {
    const setting = s?.settings?.theme || 'dark';
    if (setting === 'system') {
      return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    return setting;
  },

  /**
   * Get all active (non-deleted) tasks
   */
  getActiveTasks(s = getState()) {
    return (s?.tasks || []).filter(t => !t.deletedAt);
  },

  /**
   * Get all active tags (non-deleted)
   */
  getActiveTags(s = getState()) {
    return (s?.tags || []).filter(t => !t.deletedAt);
  },

  /**
   * Get tag by ID (only returns active tags)
   */
  getTagById(tagId, s = getState()) {
    return (s?.tags || []).find(t => t.id === tagId && !t.deletedAt) || null;
  },

  /**
   * Filter active tasks by search query and tag filter pill
   */
  getFilteredTasks(s = getState()) {
    let tasks = selectors.getActiveTasks(s);
    const activeTag = s?.ui?.activeTagFilter || 'all';
    const query = (s?.ui?.searchQuery || '').trim().toLowerCase();

    // 1. Tag filter
    if (activeTag !== 'all') {
      tasks = tasks.filter(t => Array.isArray(t.tagIds) && t.tagIds.includes(activeTag));
    }

    // 2. Search query filter
    if (query) {
      tasks = tasks.filter(t => {
        const titleMatch = (t.title || '').toLowerCase().includes(query);
        const descMatch = (t.desc || '').toLowerCase().includes(query);
        const tagNames = (t.tagIds || [])
          .map(id => selectors.getTagById(id, s)?.name || '')
          .join(' ')
          .toLowerCase();
        const tagMatch = tagNames.includes(query);
        return titleMatch || descMatch || tagMatch;
      });
    }

    return tasks;
  },

  /**
   * Get sorted tasks for a specific column
   * Handles 7-day filter for 'done' column unless showOlderDone is true
   * @param {'backlog'|'todo'|'inprogress'|'done'} status
   * @param {Object} [s]
   * @param {boolean} [applyFilters=true]
   * @returns {Array} Sorted task array
   */
  getTasksByStatus(status, s = getState(), applyFilters = true) {
    const baseTasks = applyFilters ? selectors.getFilteredTasks(s) : selectors.getActiveTasks(s);
    let columnTasks = baseTasks.filter(t => t.status === status);

    // Done column: 7-day default filter (Addition 1)
    if (status === 'done' && applyFilters && !s?.ui?.showOlderDone) {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      columnTasks = columnTasks.filter(t => {
        const ts = t.completedAt || t.updatedAt || t.createdAt || 0;
        return ts >= sevenDaysAgo;
      });
    }

    // Sort ascending by order
    return columnTasks.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  },

  /**
   * Get count of Done tasks older than 7 days
   */
  getDoneOlderCount(s = getState()) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const baseTasks = selectors.getFilteredTasks(s).filter(t => t.status === 'done');
    return baseTasks.filter(t => {
      const ts = t.completedAt || t.updatedAt || t.createdAt || 0;
      return ts < sevenDaysAgo;
    }).length;
  },

  /**
   * Get count of active tasks currently In Progress (WIP count)
   * Note: WIP count evaluates ALL active in-progress tasks regardless of search filters
   */
  getWipCount(s = getState()) {
    return selectors.getActiveTasks(s).filter(t => t.status === 'inprogress').length;
  },

  /**
   * Check if WIP limit is exceeded
   */
  isWipExceeded(s = getState()) {
    const limit = s?.settings?.wipLimit ?? 3;
    return selectors.getWipCount(s) > limit;
  },

  /**
   * Get total logged focus minutes for a task from focusLog
   */
  getTaskLoggedMinutes(taskId, s = getState()) {
    return (s?.focusLog || [])
      .filter(f => f.taskId === taskId && f.kind === 'focus' && !f.deletedAt)
      .reduce((sum, f) => sum + (Number(f.minutes) || 0), 0);
  },

  // --------------------------------------------------------------------------
  // AREA SELECTORS (M1.1)
  // --------------------------------------------------------------------------

  /** Get all active (non-deleted) areas sorted by order */
  getActiveAreas(s = getState()) {
    return (s?.areas || [])
      .filter(a => !a.deletedAt)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  },

  /** Get a single area by ID (only active) */
  getAreaById(areaId, s = getState()) {
    if (!areaId) return null;
    return (s?.areas || []).find(a => a.id === areaId && !a.deletedAt) || null;
  },

  // --------------------------------------------------------------------------
  // KANBAN FILTERED + GROUPED + SORTED SELECTORS (M1.1)
  // --------------------------------------------------------------------------

  /**
   * Extends getFilteredTasks with area, priority, scheduled, and saved-view filters.
   * @param {Object} [s]
   * @returns {Array} Filtered tasks
   */
  getKanbanFilteredTasks(s = getState()) {
    let tasks = selectors.getFilteredTasks(s); // already applies search + tag filter

    const filterArea = s?.ui?.kanbanFilterArea || 'all';
    const filterPriority = s?.ui?.kanbanFilterPriority || 'all';
    const filterScheduled = s?.ui?.kanbanFilterScheduled || 'all';
    const savedView = s?.ui?.kanbanSavedView || null;

    if (filterArea !== 'all') {
      tasks = tasks.filter(t => t.areaId === filterArea);
    }
    if (filterPriority !== 'all') {
      tasks = tasks.filter(t => t.priority === filterPriority);
    }
    if (filterScheduled === 'scheduled') {
      tasks = tasks.filter(t => Boolean(t.scheduledDate));
    } else if (filterScheduled === 'unscheduled') {
      tasks = tasks.filter(t => !t.scheduledDate);
    }

    // Saved views: dates are computed now, so they never go stale
    if (savedView === 'today') {
      const today = getLocalDateString(new Date());
      // Spec: scheduled today OR currently in progress
      tasks = tasks.filter(t => t.scheduledDate === today || t.status === 'inprogress');
    } else if (savedView === 'this-week') {
      const monday = getWeekMonday(new Date());
      const sunday = getLocalDateString(new Date(parseLocalDate(monday).getTime() + 6 * 86400000 + 3600000));
      tasks = tasks.filter(t => t.scheduledDate && t.scheduledDate >= monday && t.scheduledDate <= sunday);
    }

    return tasks;
  },

  /**
   * Apply sort to a tasks array.  Pure — returns new sorted array.
   * @param {Array} tasks
   * @param {string} sortBy  'manual' | 'priority' | 'estimate' | 'scheduled'
   * @returns {Array}
   */
  applyKanbanSort(tasks, sortBy) {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const arr = [...tasks];
    switch (sortBy) {
      case 'priority':
        return arr.sort((a, b) =>
          (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
        );
      case 'estimate':
        return arr.sort((a, b) => (Number(a.estMin) || 0) - (Number(b.estMin) || 0));
      case 'scheduled':
        return arr.sort((a, b) => {
          if (!a.scheduledDate && !b.scheduledDate) return 0;
          if (!a.scheduledDate) return 1;
          if (!b.scheduledDate) return -1;
          return a.scheduledDate.localeCompare(b.scheduledDate);
        });
      case 'manual':
      default:
        return arr.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    }
  },

  /**
   * Group a tasks array.  Pure — returns array of group descriptors.
   * @param {Array} tasks
   * @param {string} groupBy  'none' | 'area' | 'priority' | 'tag'
   * @param {Object} [s]
   * @returns {Array<{key:string, label:string, color:string, icon:string, tasks:Array}>}
   */
  groupKanbanTasks(tasks, groupBy, s = getState()) {
    if (groupBy === 'none') {
      return [{ key: '_all', label: '', color: '', icon: '', tasks }];
    }

    const groups = new Map();

    if (groupBy === 'area') {
      const areas = selectors.getActiveAreas(s);
      areas.forEach(a => groups.set(a.id, { key: a.id, label: a.name, color: a.color, icon: a.icon, tasks: [] }));
      groups.set('_no_area', { key: '_no_area', label: 'No area', color: 'neutral', icon: '—', tasks: [] });
      tasks.forEach(t => {
        const bucket = t.areaId && groups.has(t.areaId) ? t.areaId : '_no_area';
        groups.get(bucket).tasks.push(t);
      });
    } else if (groupBy === 'priority') {
      const priorities = [
        { key: 'urgent', label: 'Urgent',  color: 'red',    icon: '🔥' },
        { key: 'high',   label: 'High',    color: 'amber',  icon: '⚡' },
        { key: 'medium', label: 'Medium',  color: 'blue',   icon: '◈'  },
        { key: 'low',    label: 'Low',     color: 'neutral',icon: '▽'  }
      ];
      priorities.forEach(p => groups.set(p.key, { ...p, tasks: [] }));
      tasks.forEach(t => {
        const bucket = groups.has(t.priority) ? t.priority : 'medium';
        groups.get(bucket).tasks.push(t);
      });
    } else if (groupBy === 'tag') {
      groups.set('_no_tag', { key: '_no_tag', label: 'No tag', color: 'neutral', icon: '—', tasks: [] });
      tasks.forEach(t => {
        const tagId = (t.tagIds || [])[0];
        if (tagId) {
          if (!groups.has(tagId)) {
            const tag = selectors.getTagById(tagId, s);
            groups.set(tagId, { key: tagId, label: tag ? tag.name : tagId, color: tag ? tag.color : 'neutral', icon: '', tasks: [] });
          }
          groups.get(tagId).tasks.push(t);
        } else {
          groups.get('_no_tag').tasks.push(t);
        }
      });
    }

    return [...groups.values()].filter(g => g.tasks.length > 0);
  },

  /**
   * Count how many Kanban filters are non-default (for badge display).
   * Does not count search or tag filter (shown separately).
   * @param {Object} [s]
   * @returns {number}
   */
  countActiveKanbanFilters(s = getState()) {
    let count = 0;
    if ((s?.ui?.kanbanGroupBy || 'none') !== 'none') count++;
    if ((s?.ui?.kanbanSortBy || 'manual') !== 'manual') count++;
    if ((s?.ui?.kanbanFilterArea || 'all') !== 'all') count++;
    if ((s?.ui?.kanbanFilterPriority || 'all') !== 'all') count++;
    if ((s?.ui?.kanbanFilterScheduled || 'all') !== 'all') count++;
    if (s?.ui?.kanbanSavedView) count++;
    return count;
  },

  /**
   * Get filtered+sorted tasks for a specific kanban column (M1.1 version).
   * @param {string} status
   * @param {Object} [s]
   * @param {boolean} [applyFilters=true]
   * @returns {Array}
   */
  getKanbanTasksByStatus(status, s = getState(), applyFilters = true) {
    const baseTasks = applyFilters
      ? selectors.getKanbanFilteredTasks(s)
      : selectors.getActiveTasks(s);
    let columnTasks = baseTasks.filter(t => t.status === status);

    // Done column: 7-day default filter
    if (status === 'done' && applyFilters && !s?.ui?.showOlderDone) {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      columnTasks = columnTasks.filter(t => {
        const ts = t.completedAt || t.updatedAt || t.createdAt || 0;
        return ts >= sevenDaysAgo;
      });
    }

    const sortBy = s?.ui?.kanbanSortBy || 'manual';
    return selectors.applyKanbanSort(columnTasks, sortBy);
  },

  // --------------------------------------------------------------------------
  // M2: TIMER + HABIT SELECTORS
  // --------------------------------------------------------------------------

  /** Total focus minutes logged on a date ('YYYY-MM-DD') */
  getFocusMinutesOn(dateStr, s = getState()) {
    return (s?.focusLog || [])
      .filter(f => f.date === dateStr && f.kind === 'focus' && !f.deletedAt)
      .reduce((sum, f) => sum + (Number(f.minutes) || 0), 0);
  },

  /** Tasks that can be linked to the timer: not deleted, not done (plus the currently linked one) */
  getTimerTaskOptions(s = getState()) {
    const rank = { inprogress: 0, todo: 1, backlog: 2, done: 3 };
    const linkedId = s?.timer?.linkedTaskId || null;
    return (s?.tasks || [])
      .filter(t => !t.deletedAt && (t.status !== 'done' || t.id === linkedId))
      .sort((a, b) =>
        (rank[a.status] ?? 4) - (rank[b.status] ?? 4) ||
        (Number(a.order) || 0) - (Number(b.order) || 0));
  },

  getActiveHabits(s = getState()) {
    return (s?.habits || [])
      .filter(h => !h.deletedAt && !h.archived)
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  },

  /** Is this habit scheduled on this date? (targetDays use Date.getDay()) */
  isHabitDue(habit, dateStr) {
    if (!habit) return false;
    return (habit.targetDays || []).includes(parseLocalDate(dateStr).getDay());
  },

  getHabitsDueOn(dateStr, s = getState()) {
    return selectors.getActiveHabits(s).filter(h => selectors.isHabitDue(h, dateStr));
  },

  isHabitDone(habitId, dateStr, s = getState()) {
    return (s?.habitLog || []).some(l => l.habitId === habitId && l.date === dateStr && l.done);
  },

  /**
   * Current streak: consecutive scheduled days completed, counting back from today.
   * Days the habit isn't scheduled are skipped. Today not being done yet does not break it.
   */
  getHabitStreak(habitId, s = getState(), todayStr = getLocalDateString(new Date())) {
    const habit = (s?.habits || []).find(h => h.id === habitId && !h.deletedAt);
    if (!habit) return 0;
    let streak = 0;
    let d = parseLocalDate(todayStr);
    for (let i = 0; i < 400; i++) {
      const ds = getLocalDateString(d);
      if (selectors.isHabitDue(habit, ds)) {
        if (selectors.isHabitDone(habitId, ds, s)) streak++;
        else if (i !== 0) break;
      }
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    }
    return streak;
  },

  // --------------------------------------------------------------------------
  // M3: PLANNER SELECTORS
  // --------------------------------------------------------------------------

  /** The 7 days of the week starting at the given Monday */
  getWeekDates(mondayStr) {
    const monday = getWeekMonday(mondayStr || new Date());
    return DAY_KEYS.map((key, i) => ({ key, date: addDaysStr(monday, i) }));
  },

  /** Tasks scheduled on a date: open ones first, then by priority, then board order */
  getTasksOnDate(dateStr, s = getState()) {
    const prio = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (s?.tasks || [])
      .filter(t => !t.deletedAt && t.scheduledDate === dateStr)
      .sort((a, b) =>
        (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
        (prio[a.priority] ?? 4) - (prio[b.priority] ?? 4) ||
        (Number(a.order) || 0) - (Number(b.order) || 0));
  },

  /** Open tasks with no day yet */
  getUnscheduledTasks(s = getState()) {
    const prio = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (s?.tasks || [])
      .filter(t => !t.deletedAt && !t.scheduledDate && t.status !== 'done')
      .sort((a, b) =>
        (prio[a.priority] ?? 4) - (prio[b.priority] ?? 4) ||
        (Number(a.order) || 0) - (Number(b.order) || 0));
  },

  /**
   * True when search, a tag, a filter or a quick view is hiding cards on the board.
   * (Group and Sort do not hide anything, so they do not count.)
   */
  isKanbanFiltering(s = getState()) {
    const ui = (s && s.ui) || {};
    return Boolean(String(ui.searchQuery || '').trim()) ||
      (ui.activeTagFilter || 'all') !== 'all' ||
      (ui.kanbanFilterArea || 'all') !== 'all' ||
      (ui.kanbanFilterPriority || 'all') !== 'all' ||
      (ui.kanbanFilterScheduled || 'all') !== 'all' ||
      Boolean(ui.kanbanSavedView);
  },

  /** Unfinished tasks scheduled before today (the 'Carry over' list), oldest first */
  getCarryOverTasks(todayStr = getLocalDateString(new Date()), s = getState()) {
    return (s?.tasks || [])
      .filter(t => !t.deletedAt && t.scheduledDate && t.scheduledDate < todayStr && t.status !== 'done')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  },

  getDayIntention(dateStr, s = getState()) {
    const entry = (s?.dayIntentions || []).find(d => d.date === dateStr);
    return entry ? entry.text : '';
  },

  /**
   * Planned minutes vs capacity for one day.
   * state: 'off' (0h capacity, nothing planned), 'empty', 'ok', 'near' (80% or more), 'over'
   */
  getDayLoad(dateStr, s = getState()) {
    const key = getDayKey(dateStr);
    let hours = Number(s?.settings?.capacityByWeekday?.[key]);
    if (!isFinite(hours) || hours < 0) hours = Number(s?.settings?.dailyCapacityHours) || 6;
    const capacityMin = Math.round(hours * 60);
    const tasks = selectors.getTasksOnDate(dateStr, s);
    const plannedMin = tasks.reduce((sum, t) => sum + (Number(t.estMin) || 0), 0);
    let state;
    if (capacityMin === 0) state = plannedMin > 0 ? 'over' : 'off';
    else if (plannedMin === 0) state = 'empty';
    else if (plannedMin > capacityMin) state = 'over';
    else if (plannedMin >= capacityMin * 0.8) state = 'near';
    else state = 'ok';
    const percent = capacityMin > 0 ? Math.min(100, Math.round((plannedMin / capacityMin) * 100)) : (plannedMin > 0 ? 100 : 0);
    return {
      date: dateStr, key, plannedMin, capacityMin, state, percent,
      overByMin: Math.max(0, plannedMin - capacityMin),
      taskCount: tasks.length,
      doneCount: tasks.filter(t => t.status === 'done').length
    };
  },

  /** Week totals for the planner header */
  getWeekSummary(mondayStr, s = getState()) {
    const days = selectors.getWeekDates(mondayStr).map(d => selectors.getDayLoad(d.date, s));
    return {
      plannedMin: days.reduce((a, d) => a + d.plannedMin, 0),
      capacityMin: days.reduce((a, d) => a + d.capacityMin, 0),
      taskCount: days.reduce((a, d) => a + d.taskCount, 0),
      doneCount: days.reduce((a, d) => a + d.doneCount, 0),
      overDays: days.filter(d => d.state === 'over').length
    };
  },

  /**
   * Habit grid for one week. Each row has 7 cells ({date, due, done, future}),
   * a completion rate over scheduled days up to today (null if none yet), and the current streak.
   */
  getWeekHabitMatrix(mondayStr, s = getState(), todayStr = getLocalDateString(new Date())) {
    const dates = selectors.getWeekDates(mondayStr);
    return selectors.getActiveHabits(s).map(habit => {
      const cells = dates.map(({ key, date }) => ({
        key, date,
        due: selectors.isHabitDue(habit, date),
        done: selectors.isHabitDone(habit.id, date, s),
        future: date > todayStr
      }));
      const counted = cells.filter(c => c.due && !c.future);
      const doneCount = counted.filter(c => c.done).length;
      return {
        habit,
        cells,
        doneCount,
        dueCount: counted.length,
        rate: counted.length > 0 ? Math.round((doneCount / counted.length) * 100) : null,
        streak: selectors.getHabitStreak(habit.id, s, todayStr)
      };
    });
  },

  // --------------------------------------------------------------------------
  // M4: JOURNAL SELECTORS
  // --------------------------------------------------------------------------

  getJournalEntry(dateStr, s = getState()) {
    return (s?.journalEntries || []).find(e => e.date === dateStr && !e.deletedAt) || null;
  },

  /** An entry counts once it has a mood, an energy level or any text */
  hasJournalContent(entry) {
    if (!entry || entry.deletedAt) return false;
    return entry.mood != null || entry.energy != null ||
      ['wins', 'blockers', 'notes'].some(k => String(entry[k] || '').trim() !== '');
  },

  /** Entries with content, newest first, optionally filtered by a search phrase */
  getJournalEntriesFiltered(query = '', s = getState()) {
    const q = String(query || '').trim().toLowerCase();
    return (s?.journalEntries || [])
      .filter(e => selectors.hasJournalContent(e))
      .filter(e => {
        if (!q) return true;
        const tag = e.tagId ? (selectors.getTagById(e.tagId, s)?.name || '') : '';
        const hay = [e.date, formatDisplayDate(e.date, { weekday: 'long', month: 'long', day: 'numeric' }), e.wins, e.blockers, e.notes, tag]
          .join('\n').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  /** Consecutive days with an entry, ending today. Today not written yet does not break it. */
  getJournalStreak(todayStr = getLocalDateString(new Date()), s = getState()) {
    const days = new Set((s?.journalEntries || []).filter(e => selectors.hasJournalContent(e)).map(e => e.date));
    let d = todayStr;
    if (!days.has(d)) d = addDaysStr(d, -1);
    let streak = 0;
    while (days.has(d)) { streak++; d = addDaysStr(d, -1); }
    return streak;
  },

  /** Mood and energy for the N days ending at endDateStr, oldest first (null when not logged) */
  getJournalTrend(endDateStr, days = 14, s = getState()) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysStr(endDateStr, -i);
      const e = selectors.getJournalEntry(date, s);
      out.push({ date, mood: e && e.mood != null ? e.mood : null, energy: e && e.energy != null ? e.energy : null });
    }
    return out;
  },

  /** Tasks completed on a calendar day (by local date of completedAt), in the order finished */
  getDoneTasksOnDate(dateStr, s = getState()) {
    return (s?.tasks || [])
      .filter(t => !t.deletedAt && t.status === 'done' && t.completedAt && getLocalDateString(new Date(t.completedAt)) === dateStr)
      .sort((a, b) => a.completedAt - b.completedAt);
  }
};

// Export for global access & testing
if (typeof window !== 'undefined') {
  window.actions = actions;
  window.selectors = selectors;
  window.getState = getState;
  window.initState = initState;
}
