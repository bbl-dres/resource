/* =============================================================================
   app.js — bootstrap, routing and event dispatch.

   Rendering is a full re-render of #app into innerHTML. With eleven rows that
   is well under a frame, and it keeps the views pure. Focus, caret position
   and scroll offset are restored afterwards so typing and tabbing survive.
   ============================================================================= */

import {
  data, state, load, subscribe, setState, syncFromUrl, closeOverlays,
  cellValue, toggleIn, removeFilter, resetFilters, defaultDir, t
} from './store.js';
import { loadIcons } from './icons.js';
import { html, appHeader, appFooter, toast } from './ui.js';
import { renderLanding, renderUebersicht, renderModal } from './views-overview.js';
import { renderTermine } from './views-schedule.js';
import { renderDashboard, renderVerlauf } from './views-analysis.js';
import { renderApi, renderExport } from './views-docs.js';

const root = document.getElementById('app');

/* -----------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

const VIEWS = {
  start: renderLanding,
  uebersicht: renderUebersicht,
  termine: renderTermine,
  dashboard: renderDashboard,
  verlauf: renderVerlauf,
  api: renderApi,
  export: renderExport
};

function render() {
  const focus = captureFocus();
  const scrollY = window.scrollY;

  const view = VIEWS[state.tab] ?? renderLanding;

  root.innerHTML = String(html`
    ${appHeader()}
    <main id="main">${view()}</main>
    ${appFooter()}
    ${renderModal()}
    ${toast()}
  `);

  document.documentElement.lang = state.lang;
  positionMenu();
  restoreFocus(focus);
  if (Math.abs(window.scrollY - scrollY) > 1) window.scrollTo({ top: scrollY });
  lastRenderAt = performance.now();
}

/** Programmatic scroll restoration must not read as a user scroll. */
let lastRenderAt = 0;

/**
 * Keep the open menu inside the window: cap its height at the space below the
 * trigger, and pull it back from the right edge when it would run off-screen.
 */
function positionMenu() {
  const panel = root.querySelector('.dd__panel');
  if (!panel) return;
  panel.style.removeProperty('--dd-max-h');
  panel.style.removeProperty('margin-left');

  const box = panel.getBoundingClientRect();
  panel.style.setProperty('--dd-max-h', `${Math.max(160, window.innerHeight - box.top - 16)}px`);

  const overflowRight = box.right - (window.innerWidth - 12);
  if (overflowRight > 0) panel.style.marginLeft = `${-Math.ceil(overflowRight)}px`;
}

function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.dataset || !el.dataset.fk) return null;
  return {
    key: el.dataset.fk,
    start: el.selectionStart ?? null,
    end: el.selectionEnd ?? null
  };
}

function restoreFocus(focus) {
  if (!focus) return;
  const el = root.querySelector(`[data-fk="${CSS.escape(focus.key)}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (focus.start != null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(focus.start, focus.end); } catch { /* number inputs refuse */ }
  }
}

/** Move the caret into the field the moment it expands. */
function focusSearch(variant) {
  requestAnimationFrame(() => {
    const el = root.querySelector(`[data-fk="search-${variant}"]`);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
}

let toastTimer;
function flash(message) {
  clearTimeout(toastTimer);
  setState({ toast: message });
  toastTimer = setTimeout(() => setState({ toast: null }), 2600);
}

/* -----------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

const actions = {
  noop: () => flash(t('Im Prototyp nicht hinterlegt.')),

  tab: (val) => setState({ tab: val, menu: null, editing: null, modal: null }),
  view: (val) => setState({ view: val, menu: null }),
  lang: (val) => setState({ lang: val, menu: null }),

  menu: (val, el) => {
    const opening = state.menu !== val;
    setState({ menu: opening ? val : null, menuSearch: '' });
    if (!opening) return;
    // A pointer click leaves focus alone; a keyboard activation moves into the menu.
    if (el.matches(':focus-visible')) {
      requestAnimationFrame(() => {
        const m = root.querySelector('.dd__panel');
        (m?.querySelector('[data-act="menu-search"]') ?? m?.querySelector(MENU_ITEMS))?.focus();
      });
    }
  },

  'search-toggle': (variant) => {
    setState(s => ({ searchOpen: { ...s.searchOpen, [variant]: true }, menu: null }));
    focusSearch(variant);
  },
  'search-close': (variant) => setState(s => {
    const searchOpen = { ...s.searchOpen, [variant]: false };
    // The query is shared, so it only clears when no field is left showing it.
    return searchOpen.header || searchOpen.toolbar ? { searchOpen } : { searchOpen, search: '' };
  }),

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
  scale: () => flash(t('Der Prototyp zeigt Quartale; Jahr und Monat folgen.')),

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

  'toggle-col': (val) => setState(s => ({ cols: { ...s.cols, [val]: !s.cols[val] } })),
  'toggle-flag': (val) => setState(s => ({ [val]: !s[val] })),
  'overload-toggle': () => setState(s => ({ overloadOnly: !s.overloadOnly })),

  'filter-remove': (val, el) => removeFilter(el.dataset.kind, val),
  'filters-reset': () => resetFilters(),
  'filter-lead': (val) => setState({ tab: 'uebersicht', leads: [val], menu: null }),

  'edit-toggle': () => setState(s => ({ edit: !s.edit, editing: null })),
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

  'open-project': (val) => setState({ modal: { type: 'project', projectId: val }, menu: null, editing: null }),
  'open-termine': (val) => setState({ tab: 'termine', view: 'gantt', modal: null, search: data.projectsById[val].location }),

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
    if (val === 'pdf') return setState({ tab: 'export', menu: null });
    flash(`${t('Export')} «${val.toUpperCase()}» — ${t('im Prototyp nicht hinterlegt.')}`);
  },
  sheet: (val) => setState({ sheet: val }),
  print: () => window.print()
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
  fn(el.dataset.val, el);
});

let searchTimer;
root.addEventListener('input', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

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
  } else if (act === 'rebook-amount') {
    setState(s => ({ modal: { ...s.modal, amount: Math.max(0, Number(el.value) || 0) } }));
  } else if (act === 'rebook-quarters') {
    setState(s => ({ modal: { ...s.modal, quarters: Math.max(1, Number(el.value) || 1) } }));
  } else if (act === 'rebook-search') {
    setState(s => ({ modal: { ...s.modal, search: el.value } }));
  } else if (act === 'rebook-reason') {
    setState(s => ({ modal: { ...s.modal, reason: el.value } }));
  }
});

/* -----------------------------------------------------------------------------
   Listbox keyboard behaviour, used by the rebooking person picker.
   -------------------------------------------------------------------------- */

function moveOption(step) {
  const list = root.querySelector('[role="listbox"]');
  if (!list) return null;
  const options = [...list.querySelectorAll('[role="option"]')];
  if (!options.length) return null;
  const here = options.findIndex(o => o === document.activeElement || o.classList.contains('is-on'));
  const next = (here + step + options.length) % options.length;
  options[next].focus();
  return options[next];
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
  if (!m || !m.items.length) return;
  const here = m.items.indexOf(document.activeElement);
  const next = step === 'first' ? 0
    : step === 'last' ? m.items.length - 1
      : (here + step + m.items.length) % m.items.length;
  m.items[next]?.focus();
}

document.addEventListener('keydown', (event) => {
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

/** The frozen columns cast a shadow only once the track is scrolled. */
root.addEventListener('scroll', (event) => {
  const scroller = event.target;
  if (!scroller.classList?.contains('pgrid')) return;
  scroller.firstElementChild?.classList.toggle('is-scrolled', scroller.scrollLeft > 0);
}, true);

/** The edit popover is anchored in viewport space, so scrolling closes it. */
document.addEventListener('scroll', () => {
  if (!state.editing) return;
  if (performance.now() - lastRenderAt < 150) return;
  setState({ editing: null });
}, { capture: true, passive: true });

window.addEventListener('hashchange', () => {
  syncFromUrl();
});

/**
 * Below 900px a pensum grid or a bar plan cannot be read, let alone edited.
 * The design says so explicitly, so those views offer the reading path instead.
 */
const narrowQuery = window.matchMedia('(max-width: 899px)');
const syncNarrow = () => { if (state.narrow !== narrowQuery.matches) setState({ narrow: narrowQuery.matches }); };
narrowQuery.addEventListener('change', syncNarrow);

/* -----------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

(async function boot() {
  try {
    await Promise.all([load(), loadIcons()]);
    state.narrow = narrowQuery.matches;
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
