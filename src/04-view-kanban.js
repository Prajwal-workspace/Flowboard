// ============================================================================
// VIEW: KANBAN (04-view-kanban.js)
// ============================================================================

/**
 * Active dragging state
 */
let draggedTaskId = null;
let lastActiveElementBeforeModal = null;
let lastFocusTargetBeforeModal = null; // describes that element, in case it is re-rendered while the dialog is open
let activeMoveMenuTaskId = null;
// Long columns draw their first cards only, with a 'Show more' button (M8). Keeps the board quick with
// hundreds of cards (the column counter still shows the full number). Remembered until the page is reloaded; keys are column ids or column__group keys.
const KANBAN_CARD_LIMIT = 30;         // per column
const KANBAN_GROUP_CARD_LIMIT = 12;   // per group inside a column, when the board is grouped
let kanbanShowAllCards = {};

/** The cards to draw for one list, and how many are held back */
function limitKanbanCards(tasks, key, limit = KANBAN_CARD_LIMIT) {
  if (kanbanShowAllCards[key] || tasks.length <= limit) return { shown: tasks, hidden: 0 };
  return { shown: tasks.slice(0, limit), hidden: tasks.length - limit };
}

function renderKanbanShowMore(key, hidden, total, limit = KANBAN_CARD_LIMIT) {
  if (hidden <= 0) {
    return (kanbanShowAllCards[key] && total > limit)
      ? `<button type="button" data-action="kanban-show-fewer" data-list-key="${esc(key)}" class="btn-secondary text-xs w-full">Show fewer</button>`
      : '';
  }
  return `<button type="button" data-action="kanban-show-more" data-list-key="${esc(key)}" class="btn-secondary text-xs w-full">Show ${hidden} more</button>`;
}

let openKanbanMenu = null; // which toolbar dropdown is open: 'group' | 'sort' | 'area' | 'priority' | 'scheduled' | null

/**
 * Status column definitions
 */
const KANBAN_COLUMNS = [
  { id: 'backlog', title: 'Backlog', dotClass: 'bg-indigo-500' },
  { id: 'todo', title: 'To Do', dotClass: 'bg-blue-500' },
  { id: 'inprogress', title: 'In Progress', dotClass: 'bg-amber-500' },
  { id: 'done', title: 'Done', dotClass: 'bg-emerald-500' }
];

/**
 * Priority metadata: icons and styles
 */
const PRIORITY_META = {
  urgent: { label: 'Urgent', class: 'priority-urgent', icon: '🔥' },
  high: { label: 'High', class: 'priority-high', icon: '⚡' },
  medium: { label: 'Medium', class: 'priority-medium', icon: '◈' },
  low: { label: 'Low', class: 'priority-low', icon: '▽' }
};

/**
 * Render the complete Kanban view
 * @param {HTMLElement} container
 */
function renderKanbanView(container) {
  const s = getState();
  const activeTags = selectors.getActiveTags(s);
  const activeAreas = selectors.getActiveAreas(s);
  const activeTagFilter = s?.ui?.activeTagFilter || 'all';
  const searchQuery = s?.ui?.searchQuery || '';
  const wipLimit = s?.settings?.wipLimit ?? 3;
  const isWipOver = selectors.isWipExceeded(s);
  const wipCount = selectors.getWipCount(s);
  const olderDoneCount = selectors.getDoneOlderCount(s);
  const showOlderDone = s?.ui?.showOlderDone || false;

  // Toolbar state
  const groupBy = s?.ui?.kanbanGroupBy || 'none';
  const sortBy = s?.ui?.kanbanSortBy || 'manual';
  const filterArea = s?.ui?.kanbanFilterArea || 'all';
  const filterPriority = s?.ui?.kanbanFilterPriority || 'all';
  const filterScheduled = s?.ui?.kanbanFilterScheduled || 'all';
  const savedView = s?.ui?.kanbanSavedView || null;
  const filtersOpen = s?.ui?.kanbanFiltersOpen || false;
  const collapsedCols = s?.ui?.kanbanCollapsedColumns || {};
  const collapsedGroups = s?.ui?.kanbanCollapsedGroups || {};
  const activeFilterCount = selectors.countActiveKanbanFilters(s);
  const dragEnabled = (sortBy === 'manual' && groupBy === 'none');

  // Saved view chip labels
  const SAVED_VIEWS = [
    { id: 'today',      label: 'Today' },
    { id: 'this-week',  label: 'This Week' },
    { id: 'urgent',     label: 'Urgent Only' },
    { id: 'unscheduled',label: 'Unscheduled' }
  ];

  // ── Toolbar HTML helpers ────────────────────────────────────────────────────

  const savedViewChips = SAVED_VIEWS.map(v => {
    const isActive = savedView === v.id;
    return `<button type="button" data-action="apply-kanban-saved-view" data-view-id="${esc(v.id)}"
      class="px-3 py-1 rounded-lg text-xs font-medium border transition-all min-h-[36px] inline-flex items-center whitespace-nowrap
        ${isActive ? 'bg-indigo-600 text-white border-transparent shadow-sm' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}"
      aria-pressed="${isActive ? 'true' : 'false'}">${esc(v.label)}</button>`;
  }).join('');

  const groupByOptions = [
    { value: 'none', label: 'None' },
    { value: 'area', label: 'Area' },
    { value: 'priority', label: 'Priority' },
    { value: 'tag', label: 'Tag' }
  ];
  const sortByOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'priority', label: 'Priority' },
    { value: 'estimate', label: 'Estimate' },
    { value: 'scheduled', label: 'Date' }
  ];
  const priorityOptions = [
    { value: 'all', label: 'All' },
    { value: 'urgent', label: '🔥 Urgent' },
    { value: 'high', label: '⚡ High' },
    { value: 'medium', label: '◈ Medium' },
    { value: 'low', label: '▽ Low' }
  ];
  const scheduledOptions = [
    { value: 'all', label: 'All' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'unscheduled', label: 'Unscheduled' }
  ];
  const areaFilterOptions = [
    { value: 'all', label: 'All' },
    ...activeAreas.map(a => ({ value: a.id, label: `${a.icon} ${a.name}` }))
  ];

  /**
   * One toolbar control: a button that opens its own dropdown menu when clicked.
   * Highlighted when it is changed from its default so you can see what is active.
   */
  function makeMenuButton(key, prefix, dataAction, options, currentValue, defaultValue) {
    const isOpen = openKanbanMenu === key;
    const current = options.find(o => o.value === currentValue) || options[0];
    const changed = currentValue !== defaultValue;
    const items = options.map(o => {
      const selected = o.value === currentValue;
      return `<button type="button" role="menuitemradio" aria-checked="${selected ? 'true' : 'false'}"
        data-action="${esc(dataAction)}" data-value="${esc(o.value)}"
        class="w-full flex items-center justify-between gap-3 px-3 min-h-[44px] text-sm text-left rounded-lg transition-colors
          ${selected ? 'bg-indigo-600/15 text-indigo-400 font-semibold' : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}">
        <span class="truncate">${esc(o.label)}</span>
        <span aria-hidden="true" class="${selected ? '' : 'invisible'}">✓</span>
      </button>`;
    }).join('');
    return `<div class="relative" data-kanban-menu="${esc(key)}">
      <button type="button" id="kanban-menu-btn-${esc(key)}" data-action="toggle-kanban-menu" data-menu="${esc(key)}"
        aria-haspopup="menu" aria-expanded="${isOpen ? 'true' : 'false'}"
        class="inline-flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium whitespace-nowrap transition-colors
          ${changed ? 'border-indigo-500/60 bg-indigo-600/10 text-indigo-400' : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}">
        <span class="text-[var(--text-secondary)]">${esc(prefix)}:</span>
        <span class="max-w-[9rem] truncate">${esc(current.label)}</span>
        <svg class="w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      ${isOpen ? `<div role="menu" aria-label="${esc(prefix)}"
        class="fixed inset-x-3 bottom-3 z-50 max-h-[60vh] overflow-y-auto p-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl
          sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:mt-1 sm:bottom-auto sm:min-w-[13rem] sm:max-h-[50vh] sm:z-30">${items}</div>` : ''}
    </div>`;
  }

  const toolbarInner = `
    <div class="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Group, sort and filter the board">
      ${makeMenuButton('group', 'Group', 'set-kanban-group-by', groupByOptions, groupBy, 'none')}
      ${makeMenuButton('sort', 'Sort', 'set-kanban-sort-by', sortByOptions, sortBy, 'manual')}
      ${makeMenuButton('area', 'Area', 'set-kanban-filter-area', areaFilterOptions, filterArea, 'all')}
      ${makeMenuButton('priority', 'Priority', 'set-kanban-filter-priority', priorityOptions, filterPriority, 'all')}
      ${makeMenuButton('scheduled', 'Schedule', 'set-kanban-filter-scheduled', scheduledOptions, filterScheduled, 'all')}
      ${activeFilterCount > 0 ? `
        <button type="button" data-action="clear-kanban-filters"
          class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 min-h-[36px] inline-flex items-center gap-1.5 transition-colors"
          aria-label="Clear ${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          Clear filters <span class="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">${activeFilterCount}</span>
        </button>
      ` : ''}
    </div>
  `;

  // ── Main render ─────────────────────────────────────────────────────────────

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Top Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Kanban Board</h1>
          <p class="text-sm text-[var(--text-secondary)] mt-0.5">Organize, filter and focus your work</p>
        </div>
        <div class="flex items-center gap-2.5">
          <!-- Area Manager Button -->
          <button type="button" class="btn-secondary text-sm" data-action="open-area-manager" title="Manage areas">
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            Areas
          </button>
          <!-- New Task Button -->
          <button type="button" class="btn-primary" data-action="open-new-task-modal" aria-keyshortcuts="N">
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
            </svg>
            <span>New Task <kbd class="ml-1 text-xs px-1.5 py-0.5 rounded bg-black/20 font-mono">N</kbd></span>
          </button>
        </div>
      </div>

      <!-- Saved View Chips Row -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <span class="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">Quick views:</span>
        ${savedViewChips}
        ${savedView ? `<button type="button" data-action="clear-kanban-saved-view"
          class="px-2.5 py-1 rounded-lg text-xs border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[36px] inline-flex items-center"
          aria-label="Clear saved view">✕ Clear</button>` : ''}
      </div>

      <!-- Group / Sort / filter dropdown buttons: click one to open its menu -->
      ${toolbarInner}

      <!-- Search + Tag pills bar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        <!-- Search -->
        <div class="relative flex-1 max-w-md">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-secondary)]">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
          <input
            id="kanban-search-input"
            type="text"
            placeholder="Search tasks, descriptions, tags... (/)"
            value="${esc(searchQuery)}"
            class="w-full pl-9 pr-9 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
            aria-label="Search Kanban tasks"
          />
          ${searchQuery ? `
            <button type="button" data-action="clear-search" class="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Clear search">
              &times;
            </button>
          ` : ''}
        </div>

        <!-- Tag Pills -->
        <div class="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
          <button type="button" data-action="filter-tag" data-tag-id="all"
            class="px-3 py-1.5 rounded-lg text-xs font-medium border min-h-[44px] inline-flex items-center transition-all
              ${activeTagFilter === 'all' ? 'bg-indigo-600 text-white border-transparent shadow-sm' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}">
            All (${selectors.getActiveTasks(s).length})
          </button>
          ${activeTags.map(tag => {
            const count = selectors.getActiveTasks(s).filter(t => (t.tagIds || []).includes(tag.id)).length;
            const isSel = activeTagFilter === tag.id;
            return `<button type="button" data-action="filter-tag" data-tag-id="${esc(tag.id)}"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border min-h-[44px] inline-flex items-center gap-1.5 transition-all
                ${isSel ? 'bg-indigo-600 text-white border-transparent shadow-sm' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}">
              <span class="w-2 h-2 rounded-full tag-${esc(tag.color)}"></span>
              <span>${esc(tag.name)}</span>
              <span class="opacity-75">(${count})</span>
            </button>`;
          }).join('')}
          <button type="button" data-action="open-tag-manager"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] min-h-[44px] inline-flex items-center gap-1 transition-colors ml-1"
            title="Manage tags">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            <span>Tags</span>
          </button>
        </div>
      </div>

      ${!dragEnabled ? `
        <div class="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] flex items-center gap-2" role="note">
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Drag disabled — switch to <strong class="mx-0.5 text-[var(--text-primary)]">Manual</strong> sort with <strong class="mx-0.5 text-[var(--text-primary)]">No grouping</strong> to drag cards.
        </div>
      ` : ''}

      <!-- 4 Columns Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        ${KANBAN_COLUMNS.map(col => renderKanbanColumn(col, s, {
          wipLimit, isWipOver, wipCount, olderDoneCount, showOlderDone,
          groupBy, sortBy, dragEnabled, collapsedCols, collapsedGroups
        })).join('')}
      </div>
    </div>
  `;

  // Attach search listener
  const searchInput = document.getElementById('kanban-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      actions.setSearchQuery(e.target.value);
    });
  }

  // Attach toolbar select change listeners

  // Setup drag-and-drop
  if (dragEnabled) {
    setupKanbanDragAndDrop(container);
  }
}

// ----------------------------------------------------------------------------
// COLUMN + GROUP RENDERING (M1.1)
// ----------------------------------------------------------------------------

/**
 * Render a single Kanban column with collapsible support and grouping.
 * @param {Object} col  - { id, title, dotClass }
 * @param {Object} s    - app state
 * @param {Object} opts - { wipLimit, isWipOver, wipCount, olderDoneCount, showOlderDone, groupBy, sortBy, dragEnabled, collapsedCols, collapsedGroups }
 * @returns {string}
 */
function renderKanbanColumn(col, s, opts) {
  const { wipLimit, isWipOver, wipCount, olderDoneCount, showOlderDone,
          groupBy, sortBy, dragEnabled, collapsedCols, collapsedGroups } = opts;

  const isWipCol = col.id === 'inprogress';
  const isDoneCol = col.id === 'done';
  const isCollapsed = Boolean(collapsedCols[col.id]);

  // Get filtered+sorted tasks for this column
  const colTasks = selectors.getKanbanTasksByStatus(col.id, s, true);
  const totalCount = colTasks.length;
  // Empty because of search / filters / a quick view, not because the column has no cards
  const hiddenByFilters = totalCount === 0 && selectors.isKanbanFiltering(s) &&
    selectors.getTasksByStatus(col.id, s, false).length > 0;

  const collapseChevron = `
    <svg class="w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
    </svg>`;

  const headerHtml = `
    <div class="flex items-center justify-between pb-3 border-b border-[var(--border-color)] mb-3">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full ${col.dotClass}"></span>
        <h2 class="font-semibold text-sm text-[var(--text-primary)]">${esc(col.title)}</h2>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium">${totalCount}</span>
        <button type="button" data-action="quick-add-to-column" data-status="${esc(col.id)}"
          class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          aria-label="Add task to ${esc(col.title)}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
          </svg>
        </button>
        <button type="button" data-action="toggle-kanban-column" data-col-status="${esc(col.id)}"
          class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          aria-label="${isCollapsed ? 'Expand' : 'Collapse'} ${esc(col.title)} column"
          aria-expanded="${isCollapsed ? 'false' : 'true'}">
          ${collapseChevron}
        </button>
      </div>
    </div>`;

  if (isCollapsed) {
    return `
      <div class="column-card rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-colors" data-column-status="${esc(col.id)}">
        ${headerHtml}
      </div>`;
  }

  // ── Groups ─────────────────────────────────────────────────────────────────
  const groups = selectors.groupKanbanTasks(colTasks, groupBy, s);

  let bodyHtml;
  if (groupBy === 'none') {
    // Flat list
    const page = limitKanbanCards(colTasks, col.id);
    const dropZoneHtml = colTasks.length === 0
      ? renderEmptyState(col, hiddenByFilters)
      : page.shown.map(t => renderTaskCard(t, col.id, s, dragEnabled)).join('');
    bodyHtml = `
      <div class="column-drop-zone flex-1 flex flex-col gap-3 min-h-[200px]" data-drop-status="${esc(col.id)}" ${page.hidden > 0 ? 'data-shortened="true"' : ''}>
        ${dropZoneHtml}
      </div>
      ${renderKanbanShowMore(col.id, page.hidden, colTasks.length) ? `<div class="mt-3">${renderKanbanShowMore(col.id, page.hidden, colTasks.length)}</div>` : ''}`;
  } else {
    // Grouped list — no drop zone (drag disabled in group mode)
    bodyHtml = groups.map(group => {
      const gKey = `${col.id}__${group.key}`;
      const isGroupCollapsed = Boolean(collapsedGroups[gKey]);
      const gPage = isGroupCollapsed ? { shown: [], hidden: 0 } : limitKanbanCards(group.tasks, gKey, KANBAN_GROUP_CARD_LIMIT);
      const groupChevron = `
        <svg class="w-3.5 h-3.5 transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>`;
      return `
        <div class="mb-2">
          <button type="button" data-action="toggle-kanban-group" data-group-key="${esc(gKey)}"
            class="w-full flex items-center gap-2 px-1 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-secondary)] min-h-[36px]"
            aria-expanded="${isGroupCollapsed ? 'false' : 'true'}">
            ${groupChevron}
            <span class="flex-1 text-left">${esc(group.icon)} ${esc(group.label)}</span>
            <span class="px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[10px] font-bold">${group.tasks.length}</span>
          </button>
          ${isGroupCollapsed ? '' : `
            <div class="mt-1 space-y-2 pl-2 border-l-2 border-[var(--border-color)]">
              ${gPage.shown.map(t => renderTaskCard(t, col.id, s, false)).join('')}
              ${renderKanbanShowMore(gKey, gPage.hidden, group.tasks.length, KANBAN_GROUP_CARD_LIMIT)}
            </div>
          `}
        </div>`;
    }).join('') || renderEmptyState(col, hiddenByFilters);
    bodyHtml = `<div class="flex-1">${bodyHtml}</div>`;
  }

  const wipWarning = isWipCol && isWipOver ? `
    <div class="mb-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 text-xs font-medium flex items-center gap-2" role="alert">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <span>WIP warning: limit is <strong>${wipLimit}</strong> (currently ${wipCount} tasks).</span>
    </div>` : '';

  const doneToggle = isDoneCol && olderDoneCount > 0 ? `
    <div class="mb-3 flex items-center justify-between text-xs text-[var(--text-secondary)] px-1">
      <span>${showOlderDone ? 'Showing all completed' : 'Showing last 7 days'}</span>
      <button type="button" data-action="toggle-show-older-done"
        class="text-indigo-400 hover:text-indigo-300 font-medium underline min-h-[44px] flex items-center">
        ${showOlderDone ? 'Hide older' : `Show older (${olderDoneCount})`}
      </button>
    </div>` : '';

  return `
    <div class="column-card rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 flex flex-col min-h-[400px] transition-colors" data-column-status="${esc(col.id)}">
      ${headerHtml}
      ${wipWarning}
      ${doneToggle}
      ${bodyHtml}
    </div>`;
}

/**
 * Render an empty-state placeholder for a column.
 * @param {Object} col
 * @param {boolean} [filtered=false] - the column has cards, but search or filters are hiding them all
 * @returns {string}
 */
function renderEmptyState(col, filtered = false) {
  if (filtered) {
    return `
    <div class="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-secondary)] border-2 border-dashed border-[var(--border-color)] rounded-xl my-2">
      <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>
      </svg>
      <p class="text-xs font-semibold text-[var(--text-primary)]">Nothing in ${esc(col.title)} matches</p>
      <p class="text-[11px] mt-0.5 mb-3">Search, a tag, a filter or a quick view is hiding the cards here</p>
      <button type="button" data-action="clear-kanban-filters" data-status="${esc(col.id)}"
        class="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] border border-[var(--border-color)] min-h-[44px] inline-flex items-center gap-1 transition-colors">
        <span>Show all cards</span>
      </button>
    </div>`;
  }
  return `
    <div class="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-secondary)] border-2 border-dashed border-[var(--border-color)] rounded-xl my-2">
      <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p class="text-xs font-semibold text-[var(--text-primary)]">No tasks in ${esc(col.title)}</p>
      <p class="text-[11px] mt-0.5 mb-3">Get started by creating a card</p>
      <button type="button" data-action="quick-add-to-column" data-status="${esc(col.id)}"
        class="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] border border-[var(--border-color)] min-h-[44px] inline-flex items-center gap-1 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        <span>Add Task</span>
      </button>
    </div>`;
}



/**
 * Render single Task Card HTML
 * @param {Object} task
 * @param {string} colId
 * @param {Object} s
 * @param {boolean} [dragEnabled=true]
 * @returns {string}
 */
function renderTaskCard(task, colId, s, dragEnabled = true) {
  const priorityInfo = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const loggedMin = selectors.getTaskLoggedMinutes(task.id, s);
  const estMin = task.estMin || 60;
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedSubtasks = subtasks.filter(st => st.done).length;
  const isMoveMenuOpen = activeMoveMenuTaskId === task.id;

  // Render only active non-deleted tags
  const taskTags = (task.tagIds || [])
    .map(tagId => selectors.getTagById(tagId, s))
    .filter(Boolean);

  // Area chip
  const area = selectors.getAreaById(task.areaId, s);

  const colIndex = KANBAN_COLUMNS.findIndex(c => c.id === colId);
  const canMovePrev = colIndex > 0;
  const canMoveNext = colIndex < KANBAN_COLUMNS.length - 1;

  const AREA_COLOR_MAP = {
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    neutral: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30'
  };
  const areaColorCls = area ? (AREA_COLOR_MAP[area.color] || AREA_COLOR_MAP.neutral) : '';

  return `
    <div 
      class="task-card relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 shadow-sm hover:border-[var(--accent)] hover:shadow-md transition-all select-none"
      draggable="${dragEnabled ? 'true' : 'false'}"
      data-task-id="${esc(task.id)}"
      data-task-status="${esc(colId)}"
    >
      <!-- Card Top: Priority, Tags & Move Controls -->
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="badge-priority ${priorityInfo.class}" title="Priority: ${priorityInfo.label}">
            <span aria-hidden="true">${priorityInfo.icon}</span>
            <span>${priorityInfo.label}</span>
          </span>

          ${taskTags.map(tag => `
            <span class="tag-badge tag-${esc(tag.color)}">
              ${esc(tag.name)}
            </span>
          `).join('')}
        </div>

        <!-- Button-Based Move Controls (Touch & Mobile First) -->
        <div class="flex items-center gap-1">
          <!-- Move Previous Column -->
          <button 
            type="button" 
            data-action="move-task-prev" 
            data-task-id="${esc(task.id)}" 
            class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${!canMovePrev ? 'opacity-30 cursor-not-allowed' : ''}"
            ${!canMovePrev ? 'disabled' : ''}
            title="Move to previous column"
            aria-label="Move ${esc(task.title)} to the previous column"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <!-- Move Next Column -->
          <button 
            type="button" 
            data-action="move-task-next" 
            data-task-id="${esc(task.id)}" 
            class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${!canMoveNext ? 'opacity-30 cursor-not-allowed' : ''}"
            ${!canMoveNext ? 'disabled' : ''}
            title="Move to next column"
            aria-label="Move ${esc(task.title)} to the next column"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <!-- Move To Popover Button -->
          <div class="relative">
            <button 
              type="button" 
              data-action="toggle-move-menu" 
              data-task-id="${esc(task.id)}" 
              class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Move to specific column"
              aria-label="Move ${esc(task.title)} to a column"
              aria-haspopup="true"
              aria-expanded="${isMoveMenuOpen ? 'true' : 'false'}"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
              </svg>
            </button>

            <!-- Move To Popover Menu -->
            ${isMoveMenuOpen ? `
              <div class="absolute right-0 top-11 z-30 w-44 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl p-1.5 flex flex-col gap-1 text-xs">
                <div class="px-2 py-1 font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Move to:</div>
                ${KANBAN_COLUMNS.map(c => `
                  <button 
                    type="button" 
                    data-action="move-task-to" 
                    data-task-id="${esc(task.id)}" 
                    data-target-status="${esc(c.id)}" 
                    class="px-2.5 py-2 min-h-[44px] rounded-lg text-left flex items-center gap-2 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors ${c.id === colId ? 'font-bold text-indigo-500 bg-indigo-50/10' : ''}"
                  >
                    <span class="w-2 h-2 rounded-full ${c.dotClass}"></span>
                    <span>${esc(c.title)}</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Card Title & Description (Strictly Escaped for XSS Protection).
           The title is a button so keyboard and screen-reader users can open the card too;
           a click anywhere else on the card also opens it (see openCardFromClick). -->
      <h3 class="font-semibold text-sm text-[var(--text-primary)] leading-snug break-words">
        <button type="button" data-action="edit-task" data-task-id="${esc(task.id)}" data-edit-source="title" class="card-title-btn" title="Open to edit">${esc(task.title)}</button>
      </h3>
      ${task.desc ? `
        <p class="task-desc text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed line-clamp-3 break-words">
          ${esc(task.desc)}
        </p>
      ` : ''}

      <!-- Area Chip (M1.1) -->
      ${area ? `
        <div class="mt-1.5">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${areaColorCls}">
            <span aria-hidden="true">${esc(area.icon)}</span>
            <span>${esc(area.name)}</span>
          </span>
        </div>
      ` : ''}

      <!-- Subtasks Progress (if any) -->
      ${subtasks.length > 0 ? `
        <div class="mt-3 pt-2.5 border-t border-[var(--border-color)]/60">
          <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span class="flex items-center gap-1 font-medium">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Subtasks
            </span>
            <span class="font-mono text-[11px]">${completedSubtasks}/${subtasks.length}</span>
          </div>
          <div class="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full overflow-hidden">
            <div class="bg-indigo-500 h-full rounded-full transition-all duration-300" style="width: ${(completedSubtasks / subtasks.length) * 100}%"></div>
          </div>
          <!-- Subtasks interactive checklist -->
          <div class="mt-2 space-y-1">
            ${subtasks.map(st => `
              <label class="subtask-label flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer py-1 min-h-[44px]">
                <input 
                  type="checkbox" 
                  data-action="toggle-subtask" 
                  data-task-id="${esc(task.id)}" 
                  data-subtask-id="${esc(st.id)}" 
                  ${st.done ? 'checked' : ''} 
                  class="w-5 h-5 rounded border-[var(--border-color)] text-indigo-600 focus:ring-indigo-500"
                />
                <span class="${st.done ? 'line-through opacity-60 text-[var(--text-secondary)]' : ''} break-words leading-tight">
                  ${esc(st.text)}
                </span>
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Card Footer: Time estimate & Actions -->
      <div class="mt-3 pt-2.5 border-t border-[var(--border-color)]/60 flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <!-- Time Badge -->
        <span class="flex items-center gap-1 font-mono font-medium text-[var(--text-primary)]" title="Focus logged / Estimated">
          <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>${loggedMin}m / ${estMin}m</span>
        </span>

        <!-- Edit & Delete Buttons (Minimum 44px touch targets) -->
        <div class="flex items-center gap-1">
          <button 
            type="button" 
            data-action="focus-task" 
            data-task-id="${esc(task.id)}" 
            class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-indigo-500/10 text-[var(--text-secondary)] hover:text-indigo-400 transition-colors"
            title="Link to focus timer"
            aria-label="Link task ${esc(task.title)} to the focus timer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>

          <button 
            type="button" 
            data-action="edit-task" 
            data-task-id="${esc(task.id)}" 
            data-edit-source="pencil"
            class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Edit task"
            aria-label="Edit task ${esc(task.title)}"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
          </button>

          <button 
            type="button" 
            data-action="delete-task" 
            data-task-id="${esc(task.id)}" 
            class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
            title="Delete task"
            aria-label="Delete task ${esc(task.title)}"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// DRAG AND DROP SETUP WITH FULL-COLUMN ORDERING (SPEC Addition 3)
// ----------------------------------------------------------------------------

function setupKanbanDragAndDrop(container) {
  const cards = container.querySelectorAll('.task-card[draggable="true"]');
  const dropZones = container.querySelectorAll('.column-drop-zone');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedTaskId = card.getAttribute('data-task-id');
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedTaskId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      draggedTaskId = null;
      removeDropIndicators();
    });
  });

  dropZones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over-column');

      const afterCard = getDragAfterElement(zone, e.clientY);
      showDropIndicator(zone, afterCard);
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over-column');
        removeDropIndicators(zone);
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over-column');
      removeDropIndicators();

      const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
      if (!taskId) return;

      const targetStatus = zone.getAttribute('data-drop-status');
      if (!targetStatus) return;

      const afterCard = getDragAfterElement(zone, e.clientY);
      const targetCardId = afterCard ? afterCard.getAttribute('data-task-id') : null;

      // SPEC Addition 3: Compute order using the FULL column sequence (applyFilters=false)
      const fullColumnTasks = selectors.getTasksByStatus(targetStatus, getState(), false)
        .filter(t => t.id !== taskId);

      let newOrder;
      if (targetCardId) {
        // Dropped before targetCard
        const targetIndex = fullColumnTasks.findIndex(t => t.id === targetCardId);
        if (targetIndex >= 0) {
          const prevTask = targetIndex > 0 ? fullColumnTasks[targetIndex - 1] : null;
          const nextTask = fullColumnTasks[targetIndex];
          const prevOrder = prevTask ? (Number(prevTask.order) || 0) : 0;
          const nextOrder = Number(nextTask.order) || 1000;
          newOrder = (prevOrder + nextOrder) / 2;
        } else {
          newOrder = (fullColumnTasks.length > 0 ? Math.max(...fullColumnTasks.map(t => Number(t.order) || 0)) : 0) + 1000;
        }
      } else {
        // Dropped at the bottom of the column. In a shortened column ('Show N more'), that means
        // just after the last card on screen, not after the cards that are held back.
        const endOrder = (fullColumnTasks.length > 0 ? Math.max(...fullColumnTasks.map(t => Number(t.order) || 0)) : 0) + 1000;
        newOrder = endOrder;
        if (zone.hasAttribute('data-shortened')) {
          const visible = [...zone.querySelectorAll('.task-card')].map(c => c.getAttribute('data-task-id')).filter(id => id !== taskId);
          const lastIndex = fullColumnTasks.findIndex(t => t.id === visible[visible.length - 1]);
          if (lastIndex >= 0) {
            const lastOrder = Number(fullColumnTasks[lastIndex].order) || 0;
            const nextTask = fullColumnTasks[lastIndex + 1];
            newOrder = nextTask ? (lastOrder + (Number(nextTask.order) || lastOrder + 1000)) / 2 : endOrder;
          }
        }
      }

      actions.moveTask(taskId, targetStatus, newOrder);
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.is-dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function showDropIndicator(zone, afterCard) {
  removeDropIndicators();
  const indicator = document.createElement('div');
  indicator.className = 'drop-indicator';
  if (afterCard) {
    zone.insertBefore(indicator, afterCard);
  } else {
    zone.appendChild(indicator);
  }
}

function removeDropIndicators(root = document) {
  root.querySelectorAll('.drop-indicator').forEach(el => el.remove());
}

// ----------------------------------------------------------------------------
// MODAL MANAGEMENT & ACCESSIBILITY (SPEC Addition 4)
// Focus trap, Escape key handling, and return focus
// ----------------------------------------------------------------------------

function openModal(modalHtml, initialFocusSelector = 'input') {
  let modalOverlay = document.getElementById('app-modal-overlay');
  // Remember where focus was, unless a dialog is only being refreshed (focus is then inside it)
  const activeBefore = document.activeElement;
  if (!(modalOverlay && activeBefore && modalOverlay.contains(activeBefore))) {
    lastActiveElementBeforeModal = activeBefore;
    lastFocusTargetBeforeModal = describeFocusTarget(activeBefore);
  }

  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'app-modal-overlay';
    modalOverlay.className = 'modal-backdrop';
    document.body.appendChild(modalOverlay);
  }

  modalOverlay.innerHTML = modalHtml;
  modalOverlay.classList.remove('hidden');

  // Move focus inside
  const initialEl = modalOverlay.querySelector(initialFocusSelector) || modalOverlay.querySelector('button, input, select, textarea');
  if (initialEl) {
    try { initialEl.focus({ preventScroll: true }); } catch (e) { /* focused again just below */ }
    setTimeout(() => { if (initialEl.isConnected !== false) initialEl.focus(); }, 50);
  }

  // Keydown handler for Escape & Tab trap
  modalOverlay.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = modalOverlay.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  // Close when clicking outside dialog
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  };
}

function closeModal() {
  const modalOverlay = document.getElementById('app-modal-overlay');
  if (modalOverlay) {
    modalOverlay.remove();
  }
  activeMoveMenuTaskId = null;
  // Return focus to the control that opened the dialog. If the screen was re-drawn meanwhile,
  // that exact element is gone, so look for its replacement.
  let back = lastActiveElementBeforeModal;
  if (!back || back.isConnected === false) back = findFocusTarget(lastFocusTargetBeforeModal);
  if (back && typeof back.focus === 'function' && back !== document.body) {
    try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
  }
  lastActiveElementBeforeModal = null;
  lastFocusTargetBeforeModal = null;
}

// ----------------------------------------------------------------------------
// TASK CREATE / EDIT MODAL
// ----------------------------------------------------------------------------

function openTaskModal(taskId = null, defaultStatus = 'todo') {
  const s = getState();
  const isEdit = Boolean(taskId);
  const task = isEdit ? s.tasks.find(t => t.id === taskId) : null;
  const activeTags = selectors.getActiveTags(s);
  const activeAreas = selectors.getActiveAreas(s);

  const initialStatus = task ? task.status : defaultStatus;
  const initialPriority = task ? task.priority : 'medium';
  const initialTagIds = task ? (task.tagIds || []) : [];
  const initialEst = task ? (task.estMin || 60) : 60;
  const initialDate = task ? (task.scheduledDate || '') : '';
  const initialSubtasks = task && Array.isArray(task.subtasks) ? task.subtasks : [];
  const initialAreaId = task ? (task.areaId || '') : '';

  const html = `
    <div class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="modal-task-title">
      <div class="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-5">
        <h2 id="modal-task-title" class="text-lg font-bold">${isEdit ? 'Edit Task' : 'Create New Task'}</h2>
        <button type="button" data-action="close-modal" class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Close dialog">
          &times;
        </button>
      </div>

      <form id="task-modal-form" class="space-y-4">
        <!-- Title Input (Autofocused) -->
        <div>
          <label for="task-form-title" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
            Task Title <span class="text-red-500">*</span>
          </label>
          <input 
            id="task-form-title" 
            name="title" 
            type="text" 
            required 
            placeholder="e.g. Design weekly retrospective layout"
            value="${esc(task ? task.title : '')}"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
          />
        </div>

        <!-- Description Input -->
        <div>
          <label for="task-form-desc" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea 
            id="task-form-desc" 
            name="desc" 
            rows="3" 
            placeholder="Key details, links, or context..."
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >${esc(task ? task.desc : '')}</textarea>
        </div>

        <!-- Status & Priority Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="task-form-status" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Status</label>
            <select id="task-form-status" name="status" class="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]">
              ${KANBAN_COLUMNS.map(c => `
                <option value="${esc(c.id)}" ${initialStatus === c.id ? 'selected' : ''}>${esc(c.title)}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label for="task-form-priority" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Priority</label>
            <select id="task-form-priority" name="priority" class="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]">
              <option value="urgent" ${initialPriority === 'urgent' ? 'selected' : ''}>🔥 Urgent</option>
              <option value="high" ${initialPriority === 'high' ? 'selected' : ''}>⚡ High</option>
              <option value="medium" ${initialPriority === 'medium' ? 'selected' : ''}>◈ Medium</option>
              <option value="low" ${initialPriority === 'low' ? 'selected' : ''}>▽ Low</option>
            </select>
          </div>
        </div>

        <!-- Estimate & Scheduled Date Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="task-form-est" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Estimate (minutes)</label>
            <input 
              id="task-form-est" 
              name="estMin" 
              type="number" 
              min="0" 
              step="5" 
              value="${initialEst}"
              class="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
            />
          </div>

          <div>
            <label for="task-form-date" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Scheduled Date</label>
            <input 
              id="task-form-date" 
              name="scheduledDate" 
              type="date" 
              value="${esc(initialDate)}"
              class="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
            />
          </div>
        </div>

        <!-- Tags Selection -->
        <div>
          <span id="task-form-tags-label" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Tags</span>
          <div role="group" aria-labelledby="task-form-tags-label" class="flex flex-wrap gap-2 p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] min-h-[44px]">
            ${activeTags.length === 0 ? `
              <span class="text-xs text-[var(--text-secondary)] italic">No tags created yet.</span>
            ` : activeTags.map(tag => {
              const isChecked = initialTagIds.includes(tag.id);
              return `
                <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border border-[var(--border-color)] tag-${esc(tag.color)} transition-opacity ${isChecked ? 'ring-2 ring-indigo-500' : 'opacity-70'}">
                  <input type="checkbox" name="tags" value="${esc(tag.id)}" ${isChecked ? 'checked' : ''} class="rounded border-gray-400 text-indigo-600 focus:ring-indigo-500"/>
                  <span>${esc(tag.name)}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Area Picker (M1.1) -->
        <div>
          <label for="task-form-area" class="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Area</label>
          <select id="task-form-area" name="areaId"
            class="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
            aria-label="Area">
            <option value="" ${!initialAreaId ? 'selected' : ''}>— No area</option>
            ${activeAreas.map(a => `
              <option value="${esc(a.id)}" ${initialAreaId === a.id ? 'selected' : ''}>${esc(a.icon)} ${esc(a.name)}</option>
            `).join('')}
          </select>
        </div>

        <!-- Subtasks Checklist Builder -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span id="task-form-subtasks-label" class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Subtasks</span>
            <button type="button" id="btn-add-subtask-row" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium min-h-[44px] flex items-center">
              + Add Subtask
            </button>
          </div>
          <div id="subtasks-container" role="group" aria-labelledby="task-form-subtasks-label" class="space-y-2 max-h-40 overflow-y-auto">
            ${initialSubtasks.map((st, idx) => `
              <div class="flex items-center gap-2 subtask-row">
                <input type="checkbox" class="subtask-row-done rounded text-indigo-600 focus:ring-indigo-500" aria-label="Subtask done" ${st.done ? 'checked' : ''}/>
                <input type="text" class="subtask-row-text flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" value="${esc(st.text)}" placeholder="Subtask description..." aria-label="Subtask text"/>
                <button type="button" class="btn-remove-subtask text-[var(--text-secondary)] hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Remove subtask">&times;</button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Form Submit & Cancel Buttons -->
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
          <button type="button" data-action="close-modal" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Create Task'}</button>
        </div>
      </form>
    </div>
  `;

  openModal(html, '#task-form-title');

  // Wire Subtask Rows Builder
  const subtasksContainer = document.getElementById('subtasks-container');
  document.getElementById('btn-add-subtask-row')?.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 subtask-row';
    row.innerHTML = `
      <input type="checkbox" class="subtask-row-done rounded text-indigo-600 focus:ring-indigo-500" aria-label="Subtask done"/>
      <input type="text" class="subtask-row-text flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" placeholder="Subtask description..." aria-label="Subtask text"/>
      <button type="button" class="btn-remove-subtask text-[var(--text-secondary)] hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Remove subtask">&times;</button>
    `;
    subtasksContainer.appendChild(row);
    row.querySelector('.subtask-row-text')?.focus();
  });

  subtasksContainer?.addEventListener('click', (e) => {
    if (e.target.closest('.btn-remove-subtask')) {
      e.target.closest('.subtask-row')?.remove();
    }
  });

  // Wire Submit
  document.getElementById('task-modal-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.title.value.trim();
    if (!title) return;

    const desc = form.desc.value.trim();
    const status = form.status.value;
    const priority = form.priority.value;
    const estMin = Number(form.estMin.value) || 60;
    const scheduledDate = form.scheduledDate.value || null;

    // Collect tags
    const checkedTags = [...form.querySelectorAll('input[name="tags"]:checked')].map(cb => cb.value);

    // Collect areaId
    const areaSelectEl = form.querySelector('select[name="areaId"]');
    const areaId = areaSelectEl ? (areaSelectEl.value || null) : null;

    // Collect subtasks
    const subtaskRows = [...form.querySelectorAll('.subtask-row')];
    const subtasksList = subtaskRows.map(row => ({
      text: row.querySelector('.subtask-row-text')?.value.trim() || '',
      done: Boolean(row.querySelector('.subtask-row-done')?.checked)
    })).filter(st => st.text.length > 0);

    if (isEdit) {
      actions.updateTask(taskId, {
        title,
        desc,
        status,
        priority,
        estMin,
        scheduledDate,
        tagIds: checkedTags,
        areaId,
        subtasks: subtasksList
      });
      showToast('Task updated', { type: 'success' });
    } else {
      actions.addTask({
        title,
        desc,
        status,
        priority,
        estMin,
        scheduledDate,
        tagIds: checkedTags,
        areaId,
        subtasks: subtasksList
      });
      showToast('Task created', { type: 'success' });
    }

    closeModal();
  });
}

// ----------------------------------------------------------------------------
// TAG MANAGER MODAL (SPEC Addition 5: indigo, emerald, amber, rose, sky, purple)
// ----------------------------------------------------------------------------

function openTagManagerModal() {
  const s = getState();
  const activeTags = selectors.getActiveTags(s);
  const colors = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'];

  const html = `
    <div class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="modal-tag-title">
      <div class="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-5">
        <h2 id="modal-tag-title" class="text-lg font-bold">Tag Manager</h2>
        <button type="button" data-action="close-modal" class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Close dialog">
          &times;
        </button>
      </div>

      <!-- Add New Tag Form -->
      <form id="tag-create-form" class="space-y-4 mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Create New Tag</h3>
        <div>
          <label for="new-tag-name" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tag Name</label>
          <input 
            id="new-tag-name" 
            name="name" 
            type="text" 
            required 
            maxlength="40" 
            placeholder="e.g. Frontend, Operations, Research"
            class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
          />
        </div>

        <div>
          <span id="tag-color-label" class="block text-xs font-medium text-[var(--text-secondary)] mb-2">Color Palette</span>
          <div class="flex flex-wrap items-center gap-3" role="radiogroup" aria-labelledby="tag-color-label">
            ${colors.map((c, i) => `
              <label class="cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center">
                <input type="radio" name="color" value="${esc(c)}" aria-label="${esc(c)}" ${i === 0 ? 'checked' : ''} class="sr-only peer"/>
                <span class="w-7 h-7 rounded-full tag-${esc(c)} flex items-center justify-center peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-indigo-500 peer-checked:scale-110 transition-all"></span>
              </label>
            `).join('')}
          </div>
        </div>

        <button type="submit" class="btn-primary w-full mt-2">Add Tag</button>
      </form>

      <!-- Existing Tags List -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Existing Tags (${activeTags.length})</h3>
        ${activeTags.length ? '<p class="text-xs text-[var(--text-secondary)] mb-2">Click a name to rename it. Enter saves, Escape cancels.</p>' : ''}
        <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
          ${activeTags.length === 0 ? `
            <p class="text-xs text-[var(--text-secondary)] italic py-2">No active tags.</p>
          ` : activeTags.map(tag => `
            <div class="flex items-center justify-between gap-2 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="w-3 h-3 flex-shrink-0 rounded-full tag-${esc(tag.color)}" aria-hidden="true"></span>
                <input type="text" id="tag-rename-${esc(tag.id)}" class="tag-rename-input flex-1 min-w-0 px-2 py-1.5 min-h-[44px] text-sm font-medium rounded-lg border border-transparent hover:border-[var(--border-color)] focus:border-[var(--border-color)] bg-transparent focus:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  value="${esc(tag.name)}" data-tag-id="${esc(tag.id)}" data-original="${esc(tag.name)}" maxlength="40" autocomplete="off" spellcheck="false"
                  aria-label="Name of tag ${esc(tag.name)}" title="Click to rename. Press Enter to save, Escape to cancel.">
              </div>
              <button 
                type="button" 
                data-action="delete-tag" 
                data-tag-id="${esc(tag.id)}" 
                class="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                aria-label="Delete tag ${esc(tag.name)}"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-[var(--border-color)] flex justify-end">
        <button type="button" data-action="close-modal" class="btn-secondary">Done</button>
      </div>
    </div>
  `;

  openModal(html, '#new-tag-name');

  // Rename: saved when you press Enter or leave the box; Escape puts the old name back
  const overlay = document.getElementById('app-modal-overlay');
  if (overlay) {
    overlay.onchange = (e) => {
      const input = e.target;
      if (!input || !input.classList || !input.classList.contains('tag-rename-input')) return;
      const id = input.getAttribute('data-tag-id');
      if (actions.renameTag(id, input.value)) {
        const tag = selectors.getTagById(id);
        if (tag) { input.value = tag.name; input.setAttribute('data-original', tag.name); input.setAttribute('aria-label', `Name of tag ${tag.name}`); }
      } else {
        input.value = input.getAttribute('data-original') || '';
      }
    };
    overlay.querySelectorAll('.tag-rename-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();                       // fires 'change', which saves
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();                // cancel the edit, keep the dialog open
          input.value = input.getAttribute('data-original') || '';
          input.select();
        }
      });
    });
  }

  document.getElementById('tag-create-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const color = e.target.color.value;
    if (name) {
      actions.addTag({ name, color });
      openTagManagerModal(); // Refresh modal
    }
  });
}


/** Re-draw the tag manager if it is open (used by Undo after a rename) */
function refreshTagManagerIfOpen() {
  const overlay = document.getElementById('app-modal-overlay');
  if (overlay && overlay.querySelector && overlay.querySelector('#tag-create-form')) openTagManagerModal();
}

// ----------------------------------------------------------------------------
// AREA MANAGER MODAL (M1.1)
// ----------------------------------------------------------------------------

function openAreaManagerModal() {
  const s = getState();
  const activeAreas = selectors.getActiveAreas(s);
  const colors = ['blue', 'emerald', 'amber', 'rose', 'sky', 'purple', 'indigo', 'violet'];
  const icons = ['💼', '🏠', '❤️', '📚', '🎯', '💡', '🌱', '🔧'];

  const AREA_DOT_MAP = {
    blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
    rose: 'bg-rose-500', sky: 'bg-sky-500', purple: 'bg-purple-500',
    indigo: 'bg-indigo-500', violet: 'bg-violet-500'
  };

  const html = `
    <div class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="modal-area-title">
      <div class="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-5">
        <h2 id="modal-area-title" class="text-lg font-bold">Area Manager</h2>
        <button type="button" data-action="close-modal" class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Close dialog">
          &times;
        </button>
      </div>

      <!-- Add New Area Form -->
      <form id="area-create-form" class="space-y-3 mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Create New Area</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2">
            <label for="new-area-name" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Name</label>
            <input id="new-area-name" name="name" type="text" required placeholder="e.g. Side Projects"
              class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"/>
          </div>
          <div>
            <label for="new-area-icon" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Icon</label>
            <select id="new-area-icon" name="icon"
              class="w-full px-2 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]">
              ${icons.map(ic => `<option value="${esc(ic)}">${esc(ic)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <span id="area-color-label" class="block text-xs font-medium text-[var(--text-secondary)] mb-2">Color</span>
          <div class="flex flex-wrap items-center gap-3" role="radiogroup" aria-labelledby="area-color-label">
            ${colors.map((c, i) => `
              <label class="cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center">
                <input type="radio" name="color" value="${esc(c)}" aria-label="${esc(c)}" ${i === 0 ? 'checked' : ''} class="sr-only peer"/>
                <span class="w-7 h-7 rounded-full ${AREA_DOT_MAP[c] || 'bg-neutral-500'} flex items-center justify-center peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-indigo-500 peer-checked:scale-110 transition-all"></span>
              </label>
            `).join('')}
          </div>
        </div>
        <button type="submit" class="btn-primary w-full mt-1">Add Area</button>
      </form>

      <!-- Existing Areas List -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Areas (${activeAreas.length})</h3>
        <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
          ${activeAreas.length === 0 ? `
            <p class="text-xs text-[var(--text-secondary)] italic py-2">No areas yet. Add one above.</p>
          ` : activeAreas.map((area, idx) => `
            <div class="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]" data-area-row="${esc(area.id)}">
              <!-- Icon + Color dot -->
              <span class="text-base flex-shrink-0">${esc(area.icon)}</span>
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${AREA_DOT_MAP[area.color] || 'bg-neutral-500'}"></span>

              <!-- Inline rename input -->
              <input type="text" class="area-rename-input flex-1 px-2 py-1 text-sm rounded-lg border border-transparent bg-transparent text-[var(--text-primary)] focus:border-[var(--border-color)] focus:bg-[var(--bg-secondary)] min-h-[36px]"
                value="${esc(area.name)}" aria-label="Rename area ${esc(area.name)}"
                data-area-id="${esc(area.id)}" data-field="name"/>

              <!-- Reorder buttons -->
              <button type="button" class="area-move-up min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}"
                data-area-id="${esc(area.id)}" data-area-action="move-up" ${idx === 0 ? 'disabled' : ''}
                aria-label="Move ${esc(area.name)} up">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7"/></svg>
              </button>
              <button type="button" class="area-move-down min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${idx === activeAreas.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}"
                data-area-id="${esc(area.id)}" data-area-action="move-down" ${idx === activeAreas.length - 1 ? 'disabled' : ''}
                aria-label="Move ${esc(area.name)} down">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
              </button>

              <!-- Delete -->
              <button type="button" data-action="delete-area" data-area-id="${esc(area.id)}"
                class="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 rounded hover:bg-[var(--bg-secondary)] transition-colors"
                aria-label="Delete area ${esc(area.name)}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-[var(--border-color)] flex justify-end">
        <button type="button" data-action="close-modal" class="btn-secondary">Done</button>
      </div>
    </div>
  `;

  openModal(html, '#new-area-name');

  // Wire: create form
  document.getElementById('area-create-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const color = e.target.color.value;
    const icon = e.target.icon.value;
    if (name) {
      actions.addArea({ name, color, icon });
      openAreaManagerModal(); // Refresh
    }
  });

  // Wire: inline rename on blur
  document.querySelectorAll('.area-rename-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const areaId = e.target.getAttribute('data-area-id');
      const newName = e.target.value.trim();
      if (areaId && newName) {
        actions.updateArea(areaId, { name: newName });
      }
    });
  });

  // Wire: reorder buttons
  document.querySelectorAll('[data-area-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const areaId = btn.getAttribute('data-area-id');
      const direction = btn.getAttribute('data-area-action');
      const s = getState();
      const areas = selectors.getActiveAreas(s);
      const idx = areas.findIndex(a => a.id === areaId);
      if (idx < 0) return;

      const newAreas = [...areas];
      if (direction === 'move-up' && idx > 0) {
        [newAreas[idx - 1], newAreas[idx]] = [newAreas[idx], newAreas[idx - 1]];
      } else if (direction === 'move-down' && idx < newAreas.length - 1) {
        [newAreas[idx], newAreas[idx + 1]] = [newAreas[idx + 1], newAreas[idx]];
      }
      actions.reorderAreas(newAreas.map(a => a.id));
      openAreaManagerModal(); // Refresh
    });
  });
}
