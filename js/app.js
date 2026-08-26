/* =============================================================================
   app.js — bootstrap, routing and event dispatch.

   Rendering is a full re-render of #app into innerHTML. It keeps the views
   pure functions of state, at a measured ~46 ms for the 111-row grid — of
   which ~11 ms is building and parsing the markup and the rest is the browser
   rebuilding 5 400 nodes. That is why search is debounced rather than rendered
   per keystroke. Focus, caret position and scroll offset are restored
   afterwards so typing and tabbing survive.
   ============================================================================= */

import {
  data, state, load, subscribe, setState, syncFromUrl, closeOverlays,
  cellValue, toggleIn, removeFilter, resetFilters, defaultDir, t, columnSetKey
} from './store.js';
import { loadIcons } from './icons.js';
import { html, appHeader, appFooter, toast } from './ui.js';
import { renderLanding, renderOverview, editPopover } from './views-overview.js';
import { renderModal } from './views-modals.js';
import { renderSchedule } from './views-schedule.js';
import { renderDashboard, renderHistory } from './views-analysis.js';
import { renderApi, renderExport, mountSwagger } from './views-docs.js';
import { exportCsv, exportXlsx } from './export.js';

const root = document.getElementById('app');

/* -----------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

const VIEWS = {
  start: renderLanding,
  overview: renderOverview,
  schedule: renderSchedule,
  dashboard: renderDashboard,
  history: renderHistory,
  api: renderApi,
  export: renderExport
};

function render() {
  const focus = captureFocus();
  const scrollY = window.scrollY;

  const view = VIEWS[state.tab] ?? renderLanding;

  /*
   * Before the view runs, not after: the stylesheet widens the shell for the
   * two planning grids, and those grids measure that width while they build
   * their column template. Set afterwards, the first render of a tab laid
   * itself out against the previous tab's width.
   */
  document.documentElement.dataset.tab = state.tab;

  root.innerHTML = String(html`
    ${appHeader()}
    <main id="main">${view()}</main>
    ${appFooter()}
    ${state.editing ? editPopover() : ''}
    ${renderModal()}
    ${toast()}
  `);

  document.documentElement.lang = state.lang;
  if (state.tab === 'api') mountSwagger();
  root.querySelectorAll('[data-scroll]').forEach(syncScrollFades);
  positionMenu();
  syncPageSize();
  syncZoom();
  restoreFocus(focus);
  syncModalFocus();
  if (Math.abs(window.scrollY - scrollY) > 1) window.scrollTo({ top: scrollY });
  lastRenderAt = performance.now();
}

/*
 * The page box the browser prints onto, kept the same size as the sheet.
 *
 * `@page` is a document-level rule, so it cannot be a class on the sheet — but
 * the millimetres belong in the stylesheet with the rest of the paper, so they
 * are read back off a rendered sheet rather than written down a second time.
 *
 * Without this the print stylesheet let an A4 sheet reflow to whatever width
 * the print container had (measured: 1440 x 962px), and the row budget worked
 * out for 210 x 297mm no longer described the page it landed on.
 */
const pageStyle = document.head.appendChild(document.createElement('style'));

function syncPageSize() {
  const sheet = root.querySelector('.sheet');
  if (!sheet) { pageStyle.textContent = ''; return; }
  const cs = getComputedStyle(sheet);
  const short = cs.getPropertyValue('--paper-short').trim();
  const long = cs.getPropertyValue('--paper-long').trim();
  if (!short || !long) return;
  const size = sheet.classList.contains('sheet--landscape') ? `${long} ${short}` : `${short} ${long}`;
  pageStyle.textContent = `@page { size: ${size}; margin: 0; }`;
}

/*
 * The preview scale. `zoom` rather than a transform, because the mount has to
 * know how much room the sheet takes: a transform leaves the layout box at the
 * unscaled size, so a magnified A0 would have nothing to scroll.
 *
 * «Anpassen» is measured, not declared — it is the pane's width over the
 * sheet's own, so it has to be read after the sheet is in the document.
 */
function syncZoom() {
  const mount = root.querySelector('.mount');
  if (!mount) return;
  const sheet = mount.querySelector('.sheet');
  if (!sheet) return;

  if (state.zoom !== 'fit') {
    mount.style.setProperty('--sheet-zoom', Number(state.zoom) / 100);
    return;
  }
  mount.style.setProperty('--sheet-zoom', 1);
  const paper = sheet.getBoundingClientRect().width;
  const room = mount.clientWidth;
  // Never magnify to fill: a sheet smaller than the pane stays its own size.
  mount.style.setProperty('--sheet-zoom', paper > room ? room / paper : 1);
}

/** Programmatic scroll restoration must not read as a user scroll. */
let lastRenderAt = 0;

/**
 * Keep the open menu inside the window: cap its height at the space below the
 * trigger, and pull it back from the right edge when it would run off-screen.
 */
const MENU_EDGE = 12;     // how close a panel may come to the window edge

function positionMenu() {
  const panel = root.querySelector('.dd__panel');
  if (!panel) return;
  panel.style.removeProperty('--dd-max-h');
  panel.style.removeProperty('left');
  panel.style.removeProperty('right');
  panel.style.removeProperty('margin-left');

  const box = panel.getBoundingClientRect();
  panel.style.setProperty('--dd-max-h', `${Math.max(160, window.innerHeight - box.top - 16)}px`);

  /*
   * Clamp in window coordinates, then state the result as a `left` against the
   * panel's own containing block.
   *
   * The earlier version nudged with margin-left, which is only half a lever: on
   * a right-anchored panel the margin enters the same equation `right` does, so
   * a 376px correction moved the box 188px and the Attribute menu still hung
   * 176px off the left edge of a phone.
   */
  const room = window.innerWidth - 2 * MENU_EDGE;
  const width = Math.min(box.width, room);
  const want = Math.min(Math.max(box.left, MENU_EDGE), window.innerWidth - MENU_EDGE - width);
  const origin = (panel.offsetParent ?? panel.parentElement).getBoundingClientRect().left;
  panel.style.left = `${Math.round(want - origin)}px`;
  panel.style.right = 'auto';

  /* Landscape phones have no room below the trigger; open upwards instead. */
  const below = window.innerHeight - box.top;
  panel.classList.toggle('dd__panel--up', below < 200 && box.top > below);
  if (panel.classList.contains('dd__panel--up')) {
    panel.style.setProperty('--dd-max-h', `${Math.max(160, box.bottom - 16)}px`);
  }
}

/*
 * A full re-render replaces every node, so focus has to be found again by
 * identity rather than by reference. Only nine controls carry an explicit
 * data-fk; for the rest the dispatch attributes already form a unique name, so
 * the two are looked up the same way. Without this, nine of ten activations
 * dropped focus to <body> and the next Tab restarted at the skip link.
 */
const focusKey = (el) => {
  if (!el || !el.dataset) return null;
  if (el.dataset.fk) return { by: 'fk', key: el.dataset.fk };
  if (!el.dataset.act) return null;
  return { by: 'act', key: [el.dataset.act, el.dataset.val ?? '', el.dataset.q ?? ''].join('\u0001') };
};

const focusSelector = (found) => {
  if (found.by === 'fk') return `[data-fk="${CSS.escape(found.key)}"]`;
  const [act, val, q] = found.key.split('\u0001');
  return `[data-act="${CSS.escape(act)}"]`
    + (val ? `[data-val="${CSS.escape(val)}"]` : '')
    + (q ? `[data-q="${CSS.escape(q)}"]` : '');
};

function captureFocus() {
  const found = focusKey(document.activeElement);
  if (!found) return null;
  return {
    ...found,
    start: document.activeElement.selectionStart ?? null,
    end: document.activeElement.selectionEnd ?? null
  };
}

function restoreFocus(focus) {
  if (!focus) return;
  const el = root.querySelector(focusSelector(focus));
  if (!el) return;
  el.focus({ preventScroll: true });
  if (focus.start != null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(focus.start, focus.end); } catch { /* number inputs refuse */ }
  }
}

/*
 * A dialog takes focus when it opens, keeps it while it is open and hands it
 * back to whatever opened it. aria-modal says all three are true, so they have
 * to be.
 */
let modalReturn = null;

function trapFocusables(scope) {
  return [...scope.querySelectorAll(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled),'
    + ' textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.offsetParent !== null);
}

let overlayWasOpen = false;

function syncModalFocus() {
  const overlay = root.querySelector('.modal') ?? root.querySelector('.pop');

  if (!overlay) {
    // Only on the render where it actually closed, so this never fights
    // restoreFocus during ordinary clicks.
    if (overlayWasOpen && modalReturn) {
      root.querySelector(focusSelector(modalReturn))?.focus({ preventScroll: true });
    }
    modalReturn = null;
    overlayWasOpen = false;
    return;
  }

  overlayWasOpen = true;
  if (overlay.contains(document.activeElement)) return;
  (trapFocusables(overlay)[0] ?? overlay.querySelector('.modal__close'))?.focus({ preventScroll: true });
}

/** Move the caret into the field the moment it expands. */
function focusSearch() {
  requestAnimationFrame(() => {
    const el = root.querySelector('[data-fk="search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
}

/** Every app-owned change lands in the log, with both sides of it. */
function logChange(project, field, change, value) {
  data.changes.unshift({
    id: `c-${project.id}-${data.changes.length}`,
    date: data.meta.today, dateLabel: data.meta.todayLabel,
    actor: data.meta.user.name, projectId: project.id, projectLabel: project.location,
    field, change, value, onLanding: true
  });
}

let toastTimer;
function flash(message) {
  clearTimeout(toastTimer);
  setState({ toast: message });
  // It arrives over 160ms; it should leave the same way rather than blink out.
  toastTimer = setTimeout(() => {
    const el = root.querySelector('.toast');
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return setState({ toast: null });
    }
    el.classList.add('is-leaving');
    setTimeout(() => setState({ toast: null }), 160);
  }, 2600);
}

/* -----------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

const actions = {
  noop: () => flash(t('Im Prototyp nicht hinterlegt.')),

  tab: (val) => setState({ tab: val, menu: null, editing: null, modal: null }),
  // The breadcrumb is a way back to a clean slate, not just to another route.
  home: () => setState({
    tab: 'start', menu: null, editing: null, modal: null,
    phases: [], leads: [], portfolios: [], overloadOnly: false, search: '',
    searchOpen: false
  }),
  lang: (val) => setState({ lang: val, menu: null }),

  menu: (val, el) => {
    const opening = state.menu !== val;
    /*
     * Ask before rendering: setState() replaces the DOM synchronously, so by the
     * time the old code tested :focus-visible the element was detached and the
     * answer was always false — which is why arrow keys never reached the panel.
     */
    const byKeyboard = el.matches(':focus-visible');
    setState({ menu: opening ? val : null, menuSearch: '' });
    if (!opening) return;
    if (byKeyboard) {
      requestAnimationFrame(() => {
        const m = root.querySelector('.dd__panel');
        (m?.querySelector('[data-act="menu-search"]') ?? m?.querySelector(MENU_ITEMS))?.focus();
      });
    }
  },

  'search-toggle': () => {
    setState({ searchOpen: true, menu: null });
    focusSearch();
  },
  'search-close': () => setState({ searchOpen: false, search: '' }),

  sort: (val) => setState({ sort: val, sortDir: defaultDir(val), menu: null }),
  'sort-dir': (val) => setState({ sortDir: val, menu: null }),
  // A header click picks the column; clicking the active one flips direction.
  'sort-col': (val) => setState(s => (
    s.sort === val
      ? { sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' }
      : { sort: val, sortDir: defaultDir(val) }
  )),
  group: (val) => setState({ group: val, menu: null }),
  unit: (val) => setState({ unit: val }),
  scale: (val) => setState({ scale: val, periodOffset: 0 }),
  period: (val) => setState(s => ({
    periodOffset: val === 'today' ? 0 : Math.max(0, s.periodOffset + Number(val))
  })),

  'my-projects': () => {
    const me = data.meta.user.personId;
    const mine = state.leads.length === 1 && state.leads[0] === me;
    setState({ leads: mine ? [] : [me] });
  },

  'toggle-phase': (val) => toggleIn('phases', val),
  'toggle-lead': (val) => toggleIn('leads', val),
  'toggle-portfolio': (val) => toggleIn('portfolios', val),

  bulk: (val, el) => {
    const kind = el.dataset.kind;
    const all = kind === 'phases' ? data.phases.main.map(m => m.id)
      : kind === 'leads' ? [...data.people.map(p => p.id), 'none']
        : data.meta.portfolios.map(p => p.id);
    setState({ [kind]: val === 'all' ? all : [] });
  },

  /* Writes into the set the visible grid is driven by, never the other one. */
  'toggle-col': (val) => setState(s => {
    const key = columnSetKey();
    return { cols: { ...s.cols, [key]: { ...s.cols[key], [val]: !s.cols[key][val] } } };
  }),
  'toggle-flag': (val) => setState(s => ({ [val]: !s[val] })),
  'overload-toggle': () => setState(s => ({ overloadOnly: !s.overloadOnly })),

  'filter-remove': (val, el) => removeFilter(el.dataset.kind, val),
  'filters-reset': () => resetFilters(),
  'filter-lead': (val) => setState({ tab: 'overview', leads: [val], menu: null }),

  'edit-toggle': () => setState(s => ({ edit: !s.edit, editing: null })),
  'show-all': (val) => setState(s => ({ showAll: { ...s.showAll, [val]: !s.showAll[val] } })),

  'foot-details': () => setState(s => ({ footDetails: !s.footDetails })),
  'toggle-group': (val) => setState(s => ({
    collapsedGroups: { ...s.collapsedGroups, [val]: !s.collapsedGroups[val] }
  })),

  cell: (val, el) => {
    const q = Number(el.dataset.q);
    if (!state.edit) return actions['open-project'](val);
    if (q === 0) return flash(t('Das laufende Quartal ist für Änderungen gesperrt.'));
    const project = data.projectsById[val];
    const r = el.getBoundingClientRect();
    setState({
      editing: { projectId: val, q, anchor: { top: r.top, bottom: r.bottom, right: r.right } },
      draft: cellValue(project, q),
      reason: '',
      menu: null
    });
  },

  draft: (val) => setState(s => ({ draft: Math.max(0, Math.min(200, s.draft + Number(val))) })),
  'cancel-edit': () => setState({ editing: null, reason: '' }),

  apply: () => {
    const { projectId, q } = state.editing;
    const key = `${projectId}:${q}`;
    const project = data.projectsById[projectId];
    const overrides = { ...state.overrides };
    if (state.draft === project.demand[q]) delete overrides[key];
    else overrides[key] = state.draft;
    setState({ overrides, editing: null, reason: '' });
    flash(`${t('Pensum übernommen')} — ${project.location}, ${data.quarters[q].label}: ${state.draft} %`);
  },

  rebook: () => {
    const { projectId, q } = state.editing;
    setState({
      modal: {
        type: 'rebook', projectId, q,
        amount: cellValue(data.projectsById[projectId], q),
        targetId: null, quarters: 2, search: '', reason: ''
      },
      editing: null
    });
  },
  'rebook-target': (val) => setState(s => ({ modal: { ...s.modal, targetId: val } })),
  'rebook-apply': () => {
    const { projectId, q, amount, targetId, quarters, reason } = state.modal;
    const project = data.projectsById[projectId];
    const target = data.peopleById[targetId];
    const from = project.leadId ? data.peopleById[project.leadId] : null;

    // The prototype moves the lead of this project; a real implementation would
    // split the allocation into two person-level rows — see docs/GAP-ANALYSIS.md.
    project.leadId = targetId;

    // One entry carrying both sides, as the wireframe asks.
    data.changes.unshift({
      id: `c-${projectId}-${q}-${data.changes.length}`,
      date: data.meta.today, dateLabel: data.meta.todayLabel,
      actor: data.meta.user.name, projectId, projectLabel: project.location,
      field: 'Projektleitung',
      change: `${t('Umgebucht')}: ${from ? from.name : t('nicht zugewiesen')} → ${target.name} · ${reason.trim()}`,
      value: `${amount} % ${t('ab')} ${data.quarters[q].label}, ${quarters} ${t('Quartale')}`,
      onLanding: true
    });

    setState({ modal: null });
    flash(`${amount} % ${t('umgebucht auf')} ${target.name} — ${project.location}, ${t('ab')} ${data.quarters[q].label}`);
  },

  assign: (val) => setState({ modal: { type: 'assign', projectId: val, search: '', targetId: null }, editing: null }),
  'assign-target': (val) => setState(s => ({ modal: { ...s.modal, targetId: val } })),
  'assign-apply': () => {
    const { projectId, targetId } = state.modal;
    const project = data.projectsById[projectId];
    const from = project.leadId ? data.peopleById[project.leadId] : null;
    const to = data.peopleById[targetId];
    project.leadId = targetId;
    project.unassigned = false;
    logChange(project, 'Projektleitung',
      from ? `${from.name} → ${to.name}` : `${t('Zugewiesen an')} ${to.name}`, to.name);
    setState({ modal: null });
    flash(`${project.location} — ${t('Projektleitung')}: ${to.name}`);
  },
  'assign-clear': () => {
    const project = data.projectsById[state.modal.projectId];
    const from = project.leadId ? data.peopleById[project.leadId] : null;
    project.leadId = null;
    project.unassigned = true;
    logChange(project, 'Projektleitung',
      from ? `${from.name} → ${t('nicht zugewiesen')}` : t('Zuweisung aufgehoben'), t('nicht zugewiesen'));
    setState({ modal: null });
    flash(`${project.location} — ${t('Zuweisung aufgehoben')}`);
  },

  'open-phase': (val) => {
    const [projectId, from] = val.split(':');
    setState({ modal: { type: 'phase', projectId, from: Number(from) }, menu: null, editing: null });
  },

  'open-milestone': (val) => setState({ modal: { type: 'milestone', milestoneId: val }, menu: null, editing: null }),

  'open-project': (val) => setState({ modal: { type: 'project', projectId: val }, menu: null, editing: null }),
  'open-schedule': (val) => setState({ tab: 'schedule', modal: null, search: data.projectsById[val].location }),

  share: () => setState({ modal: { type: 'share', copied: false }, menu: null }),
  'share-select': (val, el) => el.select(),
  'share-copy': async () => {
    try { await navigator.clipboard.writeText(location.href); }
    catch { root.querySelector('[data-fk="share-url"]')?.select(); }
    setState(s => ({ modal: { ...s.modal, copied: true } }));
    setTimeout(() => { if (state.modal?.type === 'share') setState(s => ({ modal: { ...s.modal, copied: false } })); }, 2000);
  },

  'close-modal': () => setState({ modal: null }),
  export: (val) => {
    if (val.startsWith('pdf')) {
      return setState({ tab: 'export', report: val.slice(4) || 'demand', menu: null });
    }
    setState({ menu: null });
    try {
      const name = val === 'csv' ? exportCsv() : exportXlsx();
      flash(`${name} — ${t('heruntergeladen')}`);
    } catch (error) {
      console.error(error);
      flash(t('Export fehlgeschlagen.'));
    }
  },
  /* The strip names a few; the card below carries the rest. */
  bi: (val) => setState({ bi: val }),

  /* Clicking the sorted column flips it; a new column starts on its own default. */
  'sort-person': (val) => setState(s => (s.pSort === val
    ? { pDir: s.pDir === 'asc' ? 'desc' : 'asc' }
    : { pSort: val, pDir: val === 'name' || val === 'role' ? 'asc' : 'desc' })),

  'scroll-to': (val) => root.querySelector(`#${CSS.escape(val)}`)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start'
  }),

  sheet: (val) => setState({ sheet: val }),
  paper: (val) => setState({ paper: val, menu: null }),
  zoom: (val) => setState({ zoom: val, menu: null }),
  report: (val) => setState({ report: val }),
  page: (val) => setState(s => ({ page: Math.max(1, s.page + Number(val)) })),
  'page-size': (val) => setState({ pageSize: val, page: 1, menu: null }),
  print: () => window.print(),

  /*
   * The file, not the dialog. A printer driver imposes its own paper and its
   * own unprintable margin, so an A3 sheet arrives scaled onto A4 and A0 is not
   * on offer at all. The writer is loaded on demand, like the API widget.
   */
  'export-pdf': async (val, el) => {
    const sheets = [...root.querySelectorAll('.sheet')];
    if (!sheets.length) return;
    el.disabled = true;
    try {
      const { sheetsToPdf } = await import('./pdf.js');
      const url = URL.createObjectURL(new Blob([sheetsToPdf(sheets)], { type: 'application/pdf' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: val });
      link.click();
      // Revoked on the next turn of the loop; Safari needs the URL to still be
      // there when the click is handled.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      el.disabled = false;
    }
  }
};

/* -----------------------------------------------------------------------------
   Delegated events
   -------------------------------------------------------------------------- */

root.addEventListener('click', (event) => {
  const scrim = event.target.closest('.scrim');
  if (scrim && !event.target.closest('[data-stop]')) return actions['close-modal']();

  const el = event.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;

  const act = el.dataset.act;
  const fn = actions[act];
  if (!fn) return;
  event.preventDefault();
  // Remember the opener, but only while nothing is open — so the key belongs to
  // whatever is about to open, not to a click inside an open dialog.
  if (!state.modal && !state.editing) modalReturn = focusKey(el);
  fn(el.dataset.val, el);
});

/*
 * Typing. Five of these only write one field of the open dialog, so they are a
 * table rather than a chain: the field name and how to read the value.
 */
const MODAL_FIELDS = {
  'assign-search':   { field: 'search' },
  'rebook-search':   { field: 'search' },
  'rebook-reason':   { field: 'reason' },
  'rebook-amount':   { field: 'amount', parse: v => Math.max(0, Number(v) || 0) },
  'rebook-quarters': { field: 'quarters', parse: v => Math.max(1, Number(v) || 1) }
};

let searchTimer;
root.addEventListener('input', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  const target = MODAL_FIELDS[act];
  if (target) {
    const value = target.parse ? target.parse(el.value) : el.value;
    return setState(s => ({ modal: { ...s.modal, [target.field]: value } }));
  }

  if (act === 'search') {
    state.search = el.value;                 // written directly: no re-render per keystroke
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setState({}), 180);
  } else if (act === 'menu-search') {
    setState({ menuSearch: el.value });
  } else if (act === 'reason') {
    setState({ reason: el.value });
  } else if (act === 'draft-input') {
    const n = Number(el.value);
    if (Number.isFinite(n)) setState({ draft: Math.max(0, Math.min(200, n)) });
  }
});

/* -----------------------------------------------------------------------------
   Listbox keyboard behaviour, used by the rebooking person picker.
   -------------------------------------------------------------------------- */

/**
 * Move focus along a list of controls, wrapping at both ends. `step` is 1 or
 * -1, or 'first' / 'last' to jump.
 */
function roam(items, step, from = items.indexOf(document.activeElement)) {
  if (!items.length) return null;
  const next = step === 'first' ? 0
    : step === 'last' ? items.length - 1
      : (from + step + items.length) % items.length;
  items[next]?.focus();
  return items[next] ?? null;
}

function moveOption(step) {
  const list = root.querySelector('[role="listbox"]');
  if (!list) return null;
  const options = [...list.querySelectorAll('[role="option"]')];
  const from = options.findIndex(o => o === document.activeElement || o.classList.contains('is-on'));
  return roam(options, step, from);
}

/* -----------------------------------------------------------------------------
   Menu keyboard behaviour — the standard menu-button pattern.
   Arrow keys roam, Escape closes and hands focus back to the trigger, Tab
   leaves rather than walking into a tree that is about to be re-rendered.
   -------------------------------------------------------------------------- */

const MENU_ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

function menuElements() {
  const panel = root.querySelector('.dd__panel');
  if (!panel) return null;
  const trigger = panel.closest('.dd')?.querySelector('[data-act="menu"]');
  return { panel, trigger, items: [...panel.querySelectorAll(MENU_ITEMS)] };
}

/** Give focus back to the button that opened the menu. */
function closeMenu({ restoreFocus = true } = {}) {
  const id = state.menu;
  setState({ menu: null, menuSearch: '' });
  if (!restoreFocus || !id) return;
  requestAnimationFrame(() => {
    root.querySelector(`[data-act="menu"][data-val="${CSS.escape(id)}"]`)?.focus();
  });
}

function moveMenuFocus(step) {
  const m = menuElements();
  if (m) roam(m.items, step);
}

document.addEventListener('keydown', (event) => {
  /*
   * A dialog owns Tab while it is open. Without this, six presses walked out of
   * an aria-modal dialog onto the brand link and the header search, behind the
   * scrim, with no way to tell you had left.
   */
  const modal = (state.modal || state.editing)
    && (root.querySelector('.modal') ?? root.querySelector('.pop'));
  if (modal && event.key === 'Tab') {
    const items = trapFocusables(modal);
    if (items.length) {
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (event.shiftKey && (at === first || !modal.contains(at))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (at === last || !modal.contains(at))) {
        event.preventDefault(); first.focus();
      }
    }
    return;
  }

  // A menu is open: it owns the arrow keys.
  if (state.menu !== null && root.contains(event.target)) {
    const inSearch = event.target.matches('[data-act="menu-search"]');
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); return moveMenuFocus(inSearch ? 'first' : 1);
      case 'ArrowUp': event.preventDefault(); return moveMenuFocus(inSearch ? 'last' : -1);
      case 'Home': if (!inSearch) { event.preventDefault(); return moveMenuFocus('first'); } break;
      case 'End': if (!inSearch) { event.preventDefault(); return moveMenuFocus('last'); } break;
      case 'Tab': event.preventDefault(); return closeMenu();
      case 'Escape': event.preventDefault(); return closeMenu();
      default: break;
    }
  }
  // The rebooking picker follows the same contract the wireframe states.
  const list = root.querySelector('[role="listbox"]');
  if (list && root.contains(event.target) && event.target.closest('.rebook__to, [role="listbox"]')) {
    if (event.key === 'ArrowDown') { event.preventDefault(); return moveOption(1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); return moveOption(-1); }
    if (event.key === 'Enter') {
      const option = document.activeElement?.closest('[role="option"]');
      if (option) { event.preventDefault(); return actions['rebook-target'](option.dataset.val); }
    }
  }

  if (event.key === 'Escape' && closeOverlays()) event.preventDefault();

  // Enter applies the pending pensum, matching the wireframe's stated contract.
  if (event.key === 'Enter' && state.editing && root.contains(event.target)
      && !event.target.matches('textarea, button')) {
    const apply = root.querySelector('.pop [data-act="apply"]');
    if (apply && !apply.disabled) { event.preventDefault(); actions.apply(); }
  }
});

/** A click anywhere outside an open dropdown closes it. */
document.addEventListener('pointerdown', (event) => {
  if (state.menu === null) return;
  if (event.target.closest('.dd')) return;
  setState({ menu: null });
});

/**
 * An edge shadow means one thing: there is more of the time axis out of view on
 * that side. It can be out of view for two reasons — the card is scrolled, or
 * the arrows beside «Heute» moved the window — and the reader should not have
 * to know which. The view says what the window hides; this adds what only the
 * DOM knows.
 */
function syncScrollFades(scroller) {
  const card = scroller.closest('.scrollbox') ?? scroller.parentElement;
  if (!card) return;
  const room = scroller.scrollWidth - scroller.clientWidth;
  card.classList.toggle('has-less', scroller.scrollLeft > 1 || card.hasAttribute('data-before'));
  card.classList.toggle('has-more',
    (room > 1 && scroller.scrollLeft < room - 1) || card.hasAttribute('data-after'));
}

/**
 * Every group is its own card with its own scroller, so they have to be told to
 * agree: two cards showing different months are not one table any more. The
 * echo events this causes settle immediately, because a scroller already at the
 * new position is skipped.
 */
function alignScrollers(source) {
  for (const other of root.querySelectorAll('[data-scroll]')) {
    if (other !== source && other.scrollLeft !== source.scrollLeft) {
      other.scrollLeft = source.scrollLeft;
    }
  }
}

root.addEventListener('scroll', (event) => {
  if (!event.target.hasAttribute?.('data-scroll')) return;
  syncScrollFades(event.target);
  alignScrollers(event.target);
}, true);

/*
 * The grid drops master-data columns to fit the window, so a resize can change
 * what it draws. Debounced, because a drag fires this dozens of times and a
 * re-render is not free.
 */
let resizeTimer;
window.addEventListener('resize', () => {
  root.querySelectorAll('[data-scroll]').forEach(syncScrollFades);
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => setState({}), 150);
});

/*
 * The popover is anchored in viewport space, so a scroll has to close it — but
 * not once there is work in it. One inertial trackpad tick used to discard a
 * typed reason with no way to get it back.
 */
document.addEventListener('scroll', () => {
  if (!state.editing) return;
  if (performance.now() - lastRenderAt < 150) return;
  const project = data.projectsById[state.editing.projectId];
  const started = state.reason.trim() !== ''
    || (project && state.draft !== cellValue(project, state.editing.q));
  if (started) return;
  setState({ editing: null });
}, { capture: true, passive: true });

window.addEventListener('hashchange', () => {
  syncFromUrl();
});

/** Moving between tabs is a navigation step, so it earns a history entry. */
let lastTab = null;
subscribe(() => {
  if (lastTab !== null && lastTab !== state.tab) history.pushState(null, '', location.hash);
  lastTab = state.tab;
});

/* -----------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

(async function boot() {
  try {
    await Promise.all([load(), loadIcons()]);
    syncFromUrl();
    subscribe(render);
    render();
  } catch (error) {
    root.innerHTML = String(html`<div class="boot boot--error">
      <strong>Die Anwendung konnte nicht geladen werden.</strong>
      <p>${error.message}</p>
      <p class="boot__hint">Der Prototyp lädt seine Daten per <code>fetch</code> aus <code>/data</code>.
        Über <code>file://</code> blockiert der Browser das — die Seite braucht einen Webserver,
        zum Beispiel <code>python -m http.server</code> im Projektordner.</p>
    </div>`);
    console.error(error);
  }
})();
