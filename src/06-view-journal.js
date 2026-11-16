// ============================================================================
// VIEW: JOURNAL (06-view-journal.js)  Milestone M4
// Daily reflection: mood, energy, wins, blockers, notes. Autosaves as you type,
// pulls done tasks, sends note lines to the Kanban board, and keeps a searchable
// timeline with a 14-day mood/energy trend and a journaling streak.
// ============================================================================

const JOURNAL_MOODS = [
  { v: 1, emoji: '😞', label: 'Rough' },
  { v: 2, emoji: '😕', label: 'Low' },
  { v: 3, emoji: '😐', label: 'Okay' },
  { v: 4, emoji: '🙂', label: 'Good' },
  { v: 5, emoji: '😄', label: 'Great' }
];

// ----------------------------------------------------------------------------
// PURE HELPERS (unit tested)
// ----------------------------------------------------------------------------

/** Lowercase, trim and strip bullets/arrows so '• Ship it' and 'ship it' compare equal */
function normalizeNoteLine(line) {
  return String(line || '')
    .replace(/^\s*(?:(?:→|[-*•✓☐☑]|\[[ xX]?\]|\d+[.)])\s*)+/, '')   // stacked markers such as '→ • '
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Lines of a note that can become tasks: non-empty, not already sent (marked with →).
 * Bullets, numbers and checkboxes are stripped from the title.
 * @returns {{lineIndex:number, title:string}[]}
 */
function parseNoteLines(text) {
  return String(text || '').split(/\r?\n/).map((raw, lineIndex) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('→')) return null;
    const title = trimmed.replace(/^(?:[-*•✓☐☑]|\[[ xX]?\]|\d+[.)])\s*/, '').trim().slice(0, 140);
    return title ? { lineIndex, title } : null;
  }).filter(Boolean);
}

/** Prefix the given lines with '→ ' so they are not sent twice. Other lines are untouched. */
function markLinesSent(text, lineIndexes) {
  const marked = new Set(lineIndexes || []);
  return String(text || '').split(/\r?\n/).map((line, i) => {
    const trimmed = line.trim();
    return (marked.has(i) && trimmed && !trimmed.startsWith('→')) ? `→ ${trimmed}` : line;
  }).join('\n');
}

function journalViewDate(s) {
  const today = getLocalDateString(new Date());
  const d = (s && s.ui && s.ui.journalDate) || today;
  return d > today ? today : d;
}

function journalSnippet(entry) {
  const text = [entry.wins, entry.notes, entry.blockers].find(t => String(t || '').trim()) || '';
  const first = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean).join(' · ');
  return first.length > 120 ? first.slice(0, 119) + '…' : first;
}

// ----------------------------------------------------------------------------
// RENDER PIECES
// ----------------------------------------------------------------------------

function buildJournalSparkline(trend) {
  const W = 280, H = 64, padX = 6, padY = 6;
  const n = trend.length;
  const stepX = (W - padX * 2) / Math.max(1, n - 1);
  const yOf = (v, max) => H - padY - ((v - 1) / (max - 1)) * (H - padY * 2);
  const xOf = i => padX + i * stepX;
  const pathFor = (key, max) => {
    let d = '', pen = false;
    trend.forEach((p, i) => {
      if (p[key] == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(p[key], max).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  const dotsFor = (key, max, color) => trend.map((p, i) => p[key] == null ? '' :
    `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p[key], max).toFixed(1)}" r="2.5" fill="${color}"/>`).join('');

  const moods = trend.filter(p => p.mood != null).map(p => p.mood);
  const energies = trend.filter(p => p.energy != null).map(p => p.energy);
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const avgMood = avg(moods), avgEnergy = avg(energies);
  const logged = trend.filter(p => p.mood != null || p.energy != null).length;
  const summary = logged === 0
    ? `No mood or energy logged in the last ${n} days.`
    : `Last ${n} days: ${logged} logged. Average mood ${avgMood === null ? 'not set' : avgMood.toFixed(1) + ' of 5'}, average energy ${avgEnergy === null ? 'not set' : avgEnergy.toFixed(1) + ' of 10'}.`;

  return `
    <svg viewBox="0 0 ${W} ${H}" class="w-full h-16" role="img" aria-label="${esc(summary)}">
      <line x1="${padX}" y1="${H / 2}" x2="${W - padX}" y2="${H / 2}" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3 4"/>
      <path d="${pathFor('energy', 10)}" fill="none" stroke="#34d399" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${pathFor('mood', 5)}" fill="none" stroke="#818cf8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dotsFor('energy', 10, '#34d399')}${dotsFor('mood', 5, '#818cf8')}
    </svg>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
      <span><span aria-hidden="true" style="color:#818cf8">●</span> Mood${avgMood === null ? '' : ` avg ${avgMood.toFixed(1)}`}</span>
      <span><span aria-hidden="true" style="color:#34d399">●</span> Energy${avgEnergy === null ? '' : ` avg ${avgEnergy.toFixed(1)}`}</span>
      <span>${logged}/${n} days logged</span>
    </div>`;
}

function renderJournalStreakHtml(s) {
  const streak = selectors.getJournalStreak(getLocalDateString(new Date()), s);
  return streak >= 1
    ? `<span class="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-full bg-amber-500/15 border border-amber-500/40 text-sm font-semibold text-amber-500"><span aria-hidden="true">🔥</span>${streak}-day streak</span>`
    : `<span class="inline-flex items-center px-3 min-h-[36px] rounded-full border border-[var(--border-color)] text-sm text-[var(--text-secondary)]">Write today to start a streak</span>`;
}

function renderJournalStatsHtml(s, selectedDate) {
  return `
    <h2 class="text-sm font-semibold text-[var(--text-primary)] mb-2">Last 14 days</h2>
    ${buildJournalSparkline(selectors.getJournalTrend(selectedDate, 14, s))}`;
}

function renderJournalTimelineHtml(s, selectedDate) {
  const query = (s.ui && s.ui.journalSearch) || '';
  const total = selectors.getJournalEntriesFiltered('', s).length;
  const entries = selectors.getJournalEntriesFiltered(query, s);
  if (total === 0) {
    return `<p class="text-sm text-[var(--text-secondary)] p-3">No entries yet. Your past days will appear here.</p>`;
  }
  if (entries.length === 0) {
    return `<p class="text-sm text-[var(--text-secondary)] p-3">No entries match “${esc(query)}”.</p>`;
  }
  const shown = entries.slice(0, 100);
  const rows = shown.map(e => {
    const mood = JOURNAL_MOODS.find(m => m.v === e.mood);
    const tag = e.tagId ? selectors.getTagById(e.tagId, s) : null;
    const selected = e.date === selectedDate;
    const snippet = journalSnippet(e);
    return `
      <li>
        <button type="button" data-action="journal-open-date" data-date="${esc(e.date)}" aria-current="${selected ? 'date' : 'false'}"
          class="w-full text-left p-3 rounded-xl border transition-colors ${selected
            ? 'border-indigo-500/60 bg-indigo-600/10'
            : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)]'}">
          <span class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold text-[var(--text-primary)]">${esc(formatDisplayDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
            <span class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              ${mood ? `<span title="Mood: ${esc(mood.label)}"><span aria-hidden="true">${mood.emoji}</span><span class="sr-only">Mood ${esc(mood.label)}</span></span>` : ''}
              ${e.energy != null ? `<span class="font-mono" title="Energy ${e.energy} of 10"><span aria-hidden="true">⚡</span>${e.energy}<span class="sr-only"> energy of 10</span></span>` : ''}
            </span>
          </span>
          ${snippet ? `<span class="block text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 break-words">${esc(snippet)}</span>` : ''}
          ${tag ? `<span class="inline-block mt-1.5 tag-badge tag-${esc(tag.color)}">${esc(tag.name)}</span>` : ''}
        </button>
      </li>`;
  }).join('');
  return `
    <p class="px-1 pb-2 text-xs text-[var(--text-secondary)]">${query ? `${entries.length} of ${total} entries match` : `${total} ${total === 1 ? 'entry' : 'entries'}`}${entries.length > 100 ? ' (showing the latest 100)' : ''}</p>
    <ul class="space-y-2">${rows}</ul>`;
}

/** Re-draw only the side column pieces, so the editor and the search box keep focus */
function refreshJournalSideRegions() {
  const list = document.getElementById('journal-timeline-list');
  const stats = document.getElementById('journal-stats');
  const streak = document.getElementById('journal-streak');
  if (!list || !stats) return;
  const s = getState();
  const date = journalViewDate(s);
  stats.innerHTML = renderJournalStatsHtml(s, date);
  list.innerHTML = renderJournalTimelineHtml(s, date);
  if (streak) streak.innerHTML = renderJournalStreakHtml(s);
}

/** "Saving…" then "All changes saved" a moment after you stop typing; also refreshes the side column */
const journalAfterEdit = (() => {
  const setStatus = (text) => {
    const el = document.getElementById('journal-save-status');
    if (el) el.textContent = text;
  };
  const refresh = debounce(() => refreshJournalSideRegions(), 250);
  const saved = debounce(() => setStatus('All changes saved'), 600);
  return function journalAfterEdit() {
    setStatus('Saving…');
    refresh();
    saved();
  };
})();

// ----------------------------------------------------------------------------
// MAIN VIEW
// ----------------------------------------------------------------------------

/**
 * Render the Journal & Reflection view
 * @param {HTMLElement} container
 */
function renderJournalView(container) {
  const s = getState();
  const today = getLocalDateString(new Date());
  const date = journalViewDate(s);
  const isToday = date === today;
  const entry = selectors.getJournalEntry(date, s);
  const mood = entry && entry.mood != null ? entry.mood : null;
  const energy = entry && entry.energy != null ? entry.energy : null;
  const tags = selectors.getActiveTags(s);
  const wins = entry ? entry.wins : '', blockers = entry ? entry.blockers : '', notes = entry ? entry.notes : '';
  const search = (s.ui && s.ui.journalSearch) || '';
  const dateLabel = formatDisplayDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const moodButtons = JOURNAL_MOODS.map(m => `
    <button type="button" data-action="journal-mood" data-mood="${m.v}" data-journal-date="${esc(date)}"
      aria-pressed="${mood === m.v ? 'true' : 'false'}" aria-label="${esc(m.label)}"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] rounded-xl border transition-colors ${mood === m.v
        ? 'border-indigo-500 bg-indigo-600/15 text-[var(--text-primary)]'
        : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}">
      <span class="text-2xl leading-none" aria-hidden="true">${m.emoji}</span>
      <span class="text-[11px] font-medium">${esc(m.label)}</span>
    </button>`).join('');

  const textArea = (id, field, label, hint, value, extra = '') => `
    <div>
      <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <label for="${id}" class="text-sm font-semibold text-[var(--text-primary)]">${label}</label>
        ${extra}
      </div>
      <textarea id="${id}" rows="4" maxlength="5000" data-journal-field="${field}" data-journal-date="${esc(date)}"
        placeholder="${esc(hint)}"
        class="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 resize-y">${esc(value)}</textarea>
    </div>`;

  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Daily Reflection</h1>
          <p class="text-sm text-[var(--text-secondary)] mt-0.5">${esc(dateLabel)}${isToday ? ' · <strong class="text-indigo-400">Today</strong>' : ''}</p>
        </div>
        <div id="journal-streak">${renderJournalStreakHtml(s)}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Choose day">
        <button type="button" data-action="journal-prev" class="btn-secondary" aria-label="Previous day"><span aria-hidden="true">‹</span>&nbsp;Prev</button>
        <label class="sr-only" for="journal-date-input">Jump to a date</label>
        <input id="journal-date-input" type="date" max="${esc(today)}" value="${esc(date)}" data-journal-date-input
          class="px-3 min-h-[44px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)]">
        <button type="button" data-action="journal-next" class="btn-secondary" aria-label="Next day" ${isToday ? 'disabled' : ''}>Next&nbsp;<span aria-hidden="true">›</span></button>
        <button type="button" data-action="journal-today" class="btn-secondary" ${isToday ? 'disabled' : ''}>Today</button>
      </div>

      <div class="grid lg:grid-cols-5 gap-5">
        <section class="lg:col-span-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 space-y-5" aria-label="Reflection for ${esc(dateLabel)}">

          <div role="group" aria-labelledby="journal-mood-label">
            <p id="journal-mood-label" class="text-sm font-semibold text-[var(--text-primary)] mb-2">How did the day feel? <span class="font-normal text-[var(--text-secondary)]">(tap again to clear)</span></p>
            <div class="flex gap-2">${moodButtons}</div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="journal-energy" class="text-sm font-semibold text-[var(--text-primary)]">Energy</label>
              <output id="journal-energy-value" for="journal-energy" class="text-sm font-mono ${energy === null ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}">${energy === null ? 'Not set' : energy + ' / 10'}</output>
            </div>
            <input id="journal-energy" type="range" min="1" max="10" step="1" value="${energy === null ? 5 : energy}"
              data-journal-energy data-journal-date="${esc(date)}" class="w-full" style="accent-color: var(--accent)"
              aria-describedby="journal-energy-hint">
            <p id="journal-energy-hint" class="flex justify-between text-[11px] text-[var(--text-secondary)] mt-0.5"><span>Drained</span><span>Move the slider to set</span><span>Charged</span></p>
          </div>

          <div>
            <label for="journal-tag" class="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">Theme of the day <span class="font-normal text-[var(--text-secondary)]">(optional)</span></label>
            <select id="journal-tag" data-journal-tag data-journal-date="${esc(date)}"
              class="w-full sm:w-auto px-3 min-h-[44px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)]">
              <option value="">No tag</option>
              ${tags.map(t => `<option value="${esc(t.id)}" ${entry && entry.tagId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
            </select>
          </div>

          ${textArea('journal-wins', 'wins', 'Key wins', 'What went well today?', wins,
            `<button type="button" data-action="journal-pull-done" data-journal-date="${esc(date)}" class="btn-secondary text-xs"><span aria-hidden="true">⚡</span>&nbsp;Pull done tasks</button>`)}
          ${textArea('journal-blockers', 'blockers', 'Friction and blockers', 'What got in the way?', blockers)}
          ${textArea('journal-notes', 'notes', 'Notes and tomorrow', 'Free notes. Write one task per line to send them to the board.', notes,
            `<button type="button" data-action="journal-send-kanban" data-journal-date="${esc(date)}" class="btn-secondary text-xs"><span aria-hidden="true">＋</span>&nbsp;Send to Kanban…</button>`)}

          <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-color)]">
            <span id="journal-save-status" role="status" aria-live="polite" class="text-xs text-[var(--text-secondary)]">${entry ? 'All changes saved' : 'Saves automatically as you type'}</span>
            ${entry ? `<button type="button" data-action="journal-delete-entry" data-journal-date="${esc(date)}" class="btn-secondary text-xs text-red-400">Delete this entry</button>` : ''}
          </div>
        </section>

        <aside class="lg:col-span-2 space-y-4" aria-label="Past entries">
          <div id="journal-stats" class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">${renderJournalStatsHtml(s, date)}</div>

          <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <h2 class="text-sm font-semibold text-[var(--text-primary)] mb-2">Timeline</h2>
            <label class="sr-only" for="journal-search">Search journal entries</label>
            <input id="journal-search" type="search" data-journal-search value="${esc(search)}" placeholder="Search your entries…" autocomplete="off"
              class="w-full px-3 min-h-[44px] mb-3 text-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70">
            <div id="journal-timeline-list" class="max-h-[32rem] overflow-y-auto">${renderJournalTimelineHtml(s, date)}</div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// SEND TO KANBAN DIALOG
// ----------------------------------------------------------------------------

const SEND_SOURCES = [
  { v: 'notes', label: 'Notes' },
  { v: 'blockers', label: 'Blockers' },
  { v: 'wins', label: 'Wins' }
];

function buildSendLinesHtml(date, source) {
  const entry = selectors.getJournalEntry(date);
  const lines = parseNoteLines(entry ? entry[source] : '');
  if (lines.length === 0) {
    return `<p class="text-sm text-[var(--text-secondary)] py-2">Nothing to send in this box yet. Write one task per line. Lines starting with → were already sent.</p>`;
  }
  return `<ul class="space-y-0.5">${lines.map(l => `
    <li><label class="flex items-start gap-2.5 min-h-[44px] py-1.5 cursor-pointer">
      <input type="checkbox" name="line" value="${l.lineIndex}" checked class="mt-1 w-4 h-4" style="accent-color: var(--accent)">
      <span class="text-sm text-[var(--text-primary)] break-words">${esc(l.title)}</span>
    </label></li>`).join('')}</ul>`;
}

function openSendToKanbanModal(date) {
  const entry = selectors.getJournalEntry(date);
  // Start on the first box that actually has sendable lines
  const firstWithLines = SEND_SOURCES.find(src => parseNoteLines(entry ? entry[src.v] : '').length > 0);
  const source = firstWithLines ? firstWithLines.v : 'notes';
  const nextDay = addDaysStr(date, 1);

  const html = `
    <form id="send-kanban-form" class="modal-dialog p-6 text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-labelledby="send-title">
      <div class="flex items-center justify-between mb-3">
        <h2 id="send-title" class="text-lg font-bold">Send to Kanban</h2>
        <button type="button" data-action="close-modal" class="btn-icon" aria-label="Close">&times;</button>
      </div>
      <p class="text-sm text-[var(--text-secondary)] mb-4">Each ticked line becomes a task card (30 min estimate, medium priority). You can edit them on the board.</p>

      <fieldset class="mb-3">
        <legend class="text-xs font-medium text-[var(--text-secondary)] mb-1">Take lines from</legend>
        <div class="flex flex-wrap gap-2">
          ${SEND_SOURCES.map(src => `
            <label class="inline-flex items-center gap-2 px-3 min-h-[44px] rounded-xl border border-[var(--border-color)] text-sm cursor-pointer">
              <input type="radio" name="source" value="${src.v}" ${src.v === source ? 'checked' : ''} style="accent-color: var(--accent)"> ${src.label}
            </label>`).join('')}
        </div>
      </fieldset>

      <div id="send-lines" class="max-h-[30vh] overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 mb-3">${buildSendLinesHtml(date, source)}</div>

      <div class="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label for="send-status" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Column</label>
          <select id="send-status" name="status" class="w-full px-3 min-h-[44px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm">
            <option value="todo">To Do</option><option value="backlog">Backlog</option>
          </select>
        </div>
        <div>
          <label for="send-schedule" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Plan for</label>
          <select id="send-schedule" name="schedule" class="w-full px-3 min-h-[44px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm">
            <option value="tomorrow">Tomorrow (${esc(formatDisplayDate(nextDay))})</option><option value="none">No day yet</option>
          </select>
        </div>
      </div>

      <label class="flex items-start gap-2.5 min-h-[44px] mb-4 cursor-pointer">
        <input type="checkbox" name="mark" checked class="mt-1 w-4 h-4" style="accent-color: var(--accent)">
        <span class="text-sm text-[var(--text-secondary)]">Mark sent lines with → in the note so they are not sent twice</span>
      </label>

      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-modal" class="btn-secondary">Cancel</button>
        <button type="submit" id="send-submit" class="btn-primary"></button>
      </div>
    </form>`;

  openModal(html, 'input[name="source"]:checked');

  const overlay = document.getElementById('app-modal-overlay');
  if (!overlay) return;
  const form = overlay.querySelector('#send-kanban-form');
  const submitBtn = overlay.querySelector('#send-submit');

  const checkedLines = () => [...form.querySelectorAll('input[name="line"]:checked')].map(i => Number(i.value));
  const updateSubmit = () => {
    const n = checkedLines().length;
    submitBtn.textContent = n === 1 ? 'Create 1 task' : `Create ${n} tasks`;
    submitBtn.disabled = n === 0;
  };
  updateSubmit();

  overlay.onchange = (e) => {
    const el = e.target;
    if (!el || !el.name) return;
    if (el.name === 'source') {
      overlay.querySelector('#send-lines').innerHTML = buildSendLinesHtml(date, el.value);
      updateSubmit();
    } else if (el.name === 'line') {
      updateSubmit();
    }
  };

  overlay.onsubmit = (e) => {
    if (!e.target || e.target.id !== 'send-kanban-form') return;
    e.preventDefault();
    const src = form.querySelector('input[name="source"]:checked').value;
    const wanted = new Set(checkedLines());
    const current = selectors.getJournalEntry(date);
    const lines = parseNoteLines(current ? current[src] : '').filter(l => wanted.has(l.lineIndex));
    if (lines.length === 0) return;
    const status = form.elements['status'].value;
    const schedule = form.elements['schedule'].value;
    const created = actions.sendLinesToKanban({
      date, source: src, lines, status, schedule, mark: form.elements['mark'].checked
    });
    closeModal();
    showToast(
      `Created ${created} task${created === 1 ? '' : 's'} in ${status === 'backlog' ? 'Backlog' : 'To Do'}${schedule === 'tomorrow' ? `, planned for ${formatDisplayDate(nextDay)}` : ''}`,
      { type: 'success', duration: 5000 }
    );
  };
}
