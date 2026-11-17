/* =============================================================================
   app.js — bootstrap, routing and event dispatch.

   Rendering is a full re-render of #app into innerHTML. It keeps the views
   pure functions of state, at a measured ~65 ms for the 111-row grid, most of
   which is the browser rebuilding some 6 300 nodes. That is why search is
   debounced rather than rendered per keystroke. What survives a render — focus,
   caret, and both scroll offsets — is listed in docs/ARCHITECTURE.md; that list
   is the contract, and it is longer than it looks.
   ============================================================================= */

import {
  data, state, load, subscribe, setState, syncFromUrl, closeOverlays, touch, OVERLAYS_CLOSED,
  toggleIn, removeFilter, resetFilters, noFilters, FILTERS, idsHere, defaultDir, t, columnSetKey, writeUrl,
  offsetForScale, maxOffset, windowStep, todayOffset, pageCount, viewPatch, layerPatch, settingChanges,
  groupProjects, personRows, roleOf, laneOf, recomputeDemand, periodValue, num
} from './store.js';
import { loadIcons } from './icons.js';
import { html, appHeader, appFooter, toast, forgetTokens, signedOutView, tabTitle } from './ui.js';
import { renderOverview } from './views-overview.js';
import { renderModal } from './views-modals.js';
import { renderPeople, renderDashboard, renderHistory } from './views-analysis.js';
import { renderApi, renderExport, mountSwagger } from './views-docs.js';
import { exportCsv, exportXlsx, download } from './export.js';

const root = document.getElementById('app');

/* -----------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

const VIEWS = {
  overview: renderOverview,
  people: renderPeople,
  dashboard: renderDashboard,
  history: renderHistory,
  api: renderApi,
  export: renderExport
};

/*
 * Where the reader had scrolled the plan to, sideways.
 *
 * Vertical scroll was already carried across a render; horizontal was not, so
 * every sort, filter, toast or resize threw the reader back to the first
 * quarter — on a ten-year plan, most of the way back to the start of the
 * decade. One value covers every card, because alignScrollers keeps them all on
 * the same part of the axis by design.
 *
 * Tied to the axis it was taken from: change the scale or step the window and
 * the same pixel offset means a different date, so it is dropped instead. The
 * comparison is against the axis the DOM is currently showing, not against
 * state — setState has already written the new scale by the time render runs,
 * so reading it here would compare the new value with itself.
 */
const axisKey = () => `${state.scale}:${state.periodOffset}`;
let renderedAxis = null;

function captureScroll() {
  const plan = root.querySelector('[data-scroll]');
  const toolbar = root.querySelector('.toolbar');
  const panel = root.querySelector('.dd__panel');
  return {
    axis: renderedAxis,
    plan: plan ? plan.scrollLeft : 0,
    toolbar: toolbar ? toolbar.scrollLeft : 0,
    /* The open menu and how far its list has been scrolled — the panel itself
       and, in the person filter, the list inside it. */
    menu: panel ? panel.closest('.dd')?.querySelector('[data-act="menu"]')?.dataset.val ?? null : null,
    panel: panel ? panel.scrollTop : 0,
    list: panel?.querySelector('.dd__scroll')?.scrollTop ?? 0
  };
}

function restoreScroll(saved) {
  if (saved.plan && saved.axis === axisKey()) {
    for (const el of root.querySelectorAll('[data-scroll]')) el.scrollLeft = saved.plan;
  }
  const toolbar = root.querySelector('.toolbar');
  if (toolbar && saved.toolbar) toolbar.scrollLeft = saved.toolbar;
}

/*
 * A menu that stays open across a render keeps its place. Ticking a name far
 * down the list of fifty people used to throw the list back to its top, for
 * every name. After positionMenu(): the panel only scrolls once its height
 * has been capped.
 */
function restoreMenuScroll(saved) {
  if (!saved.menu || saved.menu !== state.menu) return;
  const panel = root.querySelector('.dd__panel');
  if (!panel) return;
  panel.scrollTop = saved.panel;
  const list = panel.querySelector('.dd__scroll');
  if (list) list.scrollTop = saved.list;
}

/*
 * True while the page is being replaced. A browser may report the focused
 * cell as left when its node is removed; that is not the reader leaving it,
 * and must not write the cell.
 */
let rendering = false;

function render() {
  const focus = captureFocus();
  const scroll = captureScroll();
  const scrollY = window.scrollY;

  const view = VIEWS[state.tab] ?? renderOverview;

  /*
   * Before the view runs, not after: the stylesheet widens the shell for the
   * two planning grids, and those grids measure that width while they build
   * their column template. Set afterwards, the first render of a tab laid
   * itself out against the previous tab's width.
   */
  document.documentElement.dataset.tab = state.tab;
  /*
   * Signed out, the application draws nothing of its own: no tabs, no toolbar,
   * no figures. The header keeps only the wordmark, so the page still says
   * whose it is.
   */
  const page = String(html`
    ${appHeader()}
    <main id="main" tabindex="-1">${state.signedIn ? view() : signedOutView()}</main>
    ${appFooter()}
    ${renderModal()}
    ${toast()}
  `);
  rendering = true;
  root.innerHTML = page;
  rendering = false;

  document.documentElement.lang = state.lang;
  /* The window's title and the link past the header are outside #app, and
     stayed German under lang="fr": said by a French voice, in German. The
     title names the tab, so six tabs are six entries in the history. */
  document.title = state.signedIn ? `${tabTitle()} · ${t('Personalplanung')} — BBL` : `${t('Personalplanung')} — BBL`;
  const skip = document.querySelector('.skip-link');
  if (skip) skip.textContent = t('Zum Inhalt springen');
  announceCount();
  if (state.tab === 'api') mountSwagger();
  /* Before the fades are read: they are computed from scrollLeft. */
  restoreScroll(scroll);
  root.querySelectorAll('[data-scroll]').forEach(syncScrollFades);
  positionMenu();
  restoreMenuScroll(scroll);
  syncPageSize();
  syncZoom();
  restoreFocus(focus);
  syncModalFocus();
  if (Math.abs(window.scrollY - scrollY) > 1) window.scrollTo({ top: scrollY });
  renderedAxis = axisKey();
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

/*
 * Place the open menu against its trigger, in window coordinates.
 *
 * The panel is `position: fixed`, so this is the only thing that positions it —
 * which is the point. Anchored by CSS to its own `.dd`, it inherited whatever
 * clipping that box lived inside, and on a phone that is a 34px sideways
 * scroller. Window coordinates have no such ancestor.
 */
const MENU_EDGE = 12;     // how close a panel may come to the window edge
const MENU_GAP = 6;       // clear of the trigger; mirrors --space-3

function positionMenu() {
  const panel = root.querySelector('.dd__panel');
  if (!panel) return;
  const trigger = panel.closest('.dd')?.querySelector('button');
  if (!trigger) return;

  panel.style.removeProperty('--dd-max-h');
  panel.classList.remove('dd__panel--up');
  panel.style.left = '0px';
  panel.style.top = '0px';

  const at = trigger.getBoundingClientRect();

  /*
   * Above or below. A landscape phone has no room under a trigger that sits
   * two thirds down the window, so the panel flips rather than being squeezed
   * into 40 pixels.
   */
  const below = window.innerHeight - at.bottom - MENU_GAP - MENU_EDGE;
  const above = at.top - MENU_GAP - MENU_EDGE;
  const up = below < 200 && above > below;
  panel.classList.toggle('dd__panel--up', up);
  panel.style.setProperty('--dd-max-h', `${Math.max(160, up ? above : below)}px`);

  /* Measured after the height cap, or a long list reports its unclamped size. */
  const box = panel.getBoundingClientRect();

  /*
   * Lined up with the edge the panel asks for, then clamped into the window.
   * A right-anchored panel used to be nudged with margin-left, which is only
   * half a lever — the margin enters the same equation `right` does, so a 376px
   * correction moved the box 188px and the Attribute menu still hung 176px off
   * the left edge of a phone.
   */
  const width = Math.min(box.width, window.innerWidth - 2 * MENU_EDGE);
  const wanted = panel.classList.contains('dd__panel--right') ? at.right - width : at.left;
  const left = Math.min(Math.max(wanted, MENU_EDGE), window.innerWidth - MENU_EDGE - width);

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(up ? at.top - MENU_GAP - box.height : at.bottom + MENU_GAP)}px`;
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
  const el = document.activeElement;
  const found = focusKey(el);
  if (!found) return null;
  return {
    ...found,
    /* Where to go if this is gone after the render: an item of a menu hands
       back to the button that opened it, a chip to the next chip. */
    opener: focusKey(el.closest('.dd')?.querySelector('[data-act="menu"]')),
    act: el.dataset.act,
    start: el.selectionStart ?? null,
    end: el.selectionEnd ?? null,
    /* A figure half typed into a cell of the grid. The render draws the cell
       from the data, which does not have it yet — a toast fading or a window
       resized mid-keystroke would otherwise take the typing with it. */
    typed: el.dataset.act === 'lane-input' && el.value !== el.defaultValue ? el.value : null
  };
}

function restoreFocus(focus) {
  if (!focus) return;
  /*
   * The thing that had focus may not have survived its own action — a chip
   * that was removed, a menu that closed on a choice, a link that reset the
   * filters. Focus used to fall to <body> then, and the next Tab began at
   * the top of the page. It goes to the menu's button, to what is left of
   * the same kind, or to the content, in that order.
   */
  let el = root.querySelector(focusSelector(focus))
    ?? (focus.opener && root.querySelector(focusSelector(focus.opener)))
    ?? (focus.act && root.querySelector(`[data-act="${CSS.escape(focus.act)}"]:not(:disabled)`))
    ?? (root.contains(document.activeElement) ? null : root.querySelector('#main'));
  if (!el) return;
  /*
   * A button whose own press disabled it — «Zu heute» at today, «Weiter» at
   * the end of the plan, the pager on its last page — cannot take focus back,
   * and it used to fall to <body>. The enabled button after it in the same
   * group takes it, or failing that the last one before.
   */
  if (el.disabled) {
    const peers = [...el.parentElement.children].filter(x => x.matches('button:not(:disabled)'));
    el = peers.find(x => el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) ?? peers.at(-1);
    if (!el) return;
  }
  el.focus({ preventScroll: true });
  if (focus.typed != null) el.value = focus.typed;
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
  const overlay = root.querySelector('.modal');

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

/**
 * Every app-owned change lands in the log, with both sides of it. A change to
 * a project is filed under the project; a changed rule has none, and is filed
 * under the area it belongs to — the entry then stays in the log under every
 * filter, which is right for a change that moved figures on projects nobody
 * touched.
 */
function logEntry({ project = null, area = t('Einstellungen'), field, change, value }) {
  data.changes.unshift({
    id: `c-${project ? project.id : 'setting'}-${data.changes.length}`,
    date: data.meta.today, dateLabel: data.meta.todayLabel,
    actor: data.meta.user.name,
    projectId: project ? project.id : null, projectLabel: project ? project.location : area,
    field, change, value
  });
}
const logChange = (project, field, change, value) => logEntry({ project, field, change, value });
const logSetting = (field, change, value) => logEntry({ field, change, value });

/*
 * A toast, and optionally the state change it reports, in one render. Both
 * timers are tracked: the exit timer used to be anonymous, so a toast arriving
 * during the previous one's fade was wiped by that fade's `toast: null`.
 */
let toastTimer;
/*
 * One live region, outside #app. Every render replaces the page, and a
 * region that is created with its text already in it is not announced —
 * which is how the toast was written. This one stays, and what changes on
 * screen without the reader having moved there is put into it: a toast, the
 * count beside the filters, a figure that was saved.
 */
function announce(text) {
  const live = document.getElementById('live');
  if (!live || !text) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 50);
}

let lastCount = null;
function announceCount() {
  const text = root.querySelector('.filterbar__count')?.textContent.trim() ?? null;
  const key = text && `${state.tab}\u0001${text}`;
  /* A change of tab reads its own heading; only a filter moving the count on the same page is news. */
  if (key && lastCount && key !== lastCount && lastCount.startsWith(`${state.tab}\u0001`)) announce(text);
  lastCount = key;
}

function flash(message, patch = {}) {
  announce(message);
  clearTimeout(toastTimer);
  setState({ ...patch, toast: message });
  // It arrives over 160ms; it should leave the same way rather than blink out.
  toastTimer = setTimeout(() => {
    const el = root.querySelector('.toast');
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return setState({ toast: null });
    }
    el.classList.add('is-leaving');
    toastTimer = setTimeout(() => {
      if (state.toast === message) setState({ toast: null });
    }, 160);
  }, 2600);
}

/* -----------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

const actions = {
  noop: () => flash(t('Im Prototyp nicht hinterlegt.')),

  tab: (val) => setState({ tab: val, ...OVERLAYS_CLOSED }),
  // The brand is a way back to a clean slate, not just to another route.
  home: () => setState({ tab: 'overview', ...OVERLAYS_CLOSED, ...noFilters(), searchOpen: false }),
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

  // A header click picks the column; clicking the active one flips direction.
  'sort-col': (val) => setState(s => (
    s.sort === val
      ? { sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' }
      : { sort: val, sortDir: defaultDir(val) }
  )),
  /* «card:by:value», «card:dir:desc» — one half of a card's sort at a time.
     The menu stays open: the other half is usually the next click. */
  'card-sort': (val) => {
    const [id, part, choice] = val.split(':');
    setState(s => ({ cardSort: { ...s.cardSort, [id]: { ...s.cardSort[id], [part]: choice } } }));
  },
  unit: (val) => setState({ unit: val }),
  scale: (val) => setState({ scale: val, periodOffset: offsetForScale(val) }),
  /* Stepped from where the window actually is — an offset that ran past the
     end would otherwise spend the first click getting back to it. */
  period: (val) => setState(s => ({
    periodOffset: val === 'today'
      ? todayOffset()
      : Math.max(0, Math.min(maxOffset(), Math.min(s.periodOffset, maxOffset()) + Number(val) * windowStep()))
  })),

  'my-projects': () => {
    const me = data.meta.user.personId;
    const mine = state.leads.length === 1 && state.leads[0] === me;
    setState({ leads: mine ? [] : [me] });
  },

  /* toggle-phase, toggle-lead, toggle-portfolio, toggle-organisation — one per filter. */
  ...Object.fromEntries(FILTERS.map(f => [`toggle-${f.kind}`, (val) => toggleIn(f.key, val)])),

  /*
   * «Alle» and «Keine» of the menu they sit in. Looked up, not defaulted: a
   * kind the registry does not know changes nothing.
   */
  bulk: (val, el) => {
    const f = FILTERS.find(x => x.kind === el.dataset.kind);
    if (f) setState({ [f.key]: val === 'all' ? idsHere(f) : [] });
  },

  /* Writes into the set the visible grid is driven by, never the other one. */
  'toggle-col': (val) => setState(s => {
    const key = columnSetKey();
    return { cols: { ...s.cols, [key]: { ...s.cols[key], [val]: !s.cols[key][val] } } };
  }),
  'toggle-flag': (val) => setState(s => ({ [val]: !s[val] })),

  /* A view is a named set of layers; a layer switch renames the view to match. */
  view: (val) => setState(viewPatch(val)),
  'toggle-layer': (val) => setState(layerPatch(val)),
  colour: () => setState(s => ({ colour: s.colour === 'pensum' ? 'none' : 'pensum' })),

  'filter-remove': (val, el) => removeFilter(el.dataset.kind, val),
  'filters-reset': () => resetFilters(),
  /* From the bell: the reader's own projects. It closes whatever is open. */
  'filter-lead': (val) => setState({ tab: 'overview', ...OVERLAYS_CLOSED, leads: [val] }),

  'foot-details': () => setState(s => ({ footDetails: !s.footDetails })),
  'toggle-group': (val) => setState(s => ({
    collapsedGroups: { ...s.collapsedGroups, [val]: !s.collapsedGroups[val] }
  })),

  /*
   * A project row folds open to its Bearbeitende — and shut again. That is
   * all a click on the row does.
   */
  'toggle-project': (val) => setState(s => ({
    openProjects: { ...s.openProjects, [val]: !s.openProjects[val] }
  })),
  /* A whole group at once: open while any row is still shut, else shut. */
  'toggle-projects-group': (val) => {
    const g = groupProjects().find(x => x.key === val);
    if (!g) return;
    const all = g.projects.every(p => state.openProjects[p.id]);
    setState(s => ({
      openProjects: { ...s.openProjects, ...Object.fromEntries(g.projects.map(p => [p.id, !all])) }
    }));
  },
  /* A person row on the Personen tab folds open to the roles they hold. */
  'toggle-person': (val) => setState(s => ({ openPeople: { ...s.openPeople, [val]: !s.openPeople[val] } })),
  /* Every person the table lists, by the rule a group on Planung goes by. */
  'toggle-people': () => {
    const ids = personRows().map(r => r.person.id);
    const all = ids.every(id => state.openPeople[id]);
    setState(s => ({ openPeople: { ...s.openPeople, ...Object.fromEntries(ids.map(id => [id, !all])) } }));
  },

  'open-phase': (val) => {
    const [projectId, from] = val.split(':');
    setState({ ...OVERLAYS_CLOSED, modal: { type: 'phase', projectId, from: Number(from) } });
  },

  'open-milestone': (val) => setState({ ...OVERLAYS_CLOSED, modal: { type: 'milestone', milestoneId: val } }),

  'open-project': (val) => setState({ ...OVERLAYS_CLOSED, modal: { type: 'project', projectId: val } }),
  'open-person': (val) => setState({ ...OVERLAYS_CLOSED, modal: { type: 'person', personId: val } }),

  share: () => setState({ ...OVERLAYS_CLOSED, modal: { type: 'share', copied: false } }),
  'share-select': (val, el) => el.select(),
  /* «Kopiert» only when it was: a denied clipboard leaves the link selected
     for the reader to copy by hand, and says nothing it cannot vouch for. */
  'share-copy': async () => {
    try {
      await navigator.clipboard.writeText(location.href);
    } catch {
      root.querySelector('[data-fk="share-url"]')?.select();
      return;
    }
    setState(s => ({ modal: { ...s.modal, copied: true } }));
    setTimeout(() => { if (state.modal?.type === 'share') setState(s => ({ modal: { ...s.modal, copied: false } })); }, 2000);
  },

  'close-modal': () => setState({ modal: null }),

  /* The account dialog — the reader's own mail and language. */
  settings: () => setState({ ...OVERLAYS_CLOSED, modal: { type: 'settings' } }),

  /*
   * The office's settings, behind the gear. The dialog opens on what is saved:
   * a draft left by closing it is dropped, so closing is the way to cancel.
   */
  rules: () => setState({ ...OVERLAYS_CLOSED, modal: { type: 'rules' }, settingsDraft: null }),

  /*
   * It saves all its fields at once. The data is changed first and the toast
   * carries the patch that closes the dialog, so it is one render — and every
   * figure that render draws is already the new one.
   */
  'settings-save': () => {
    const changes = settingChanges();
    if (!changes || !changes.length) return;
    const mio = v => `${String(v).replace('.', ',')} Mio.`;
    for (const { key, from, to } of changes) {
      if (key === 'small') {
        data.meta.settings.smallProjectMio = to;
        logSetting('Projektgrösse', `${t('Kleinprojekte')} ${t('bis')}`, `${mio(from)} → ${mio(to)}`);
      } else {
        const org = data.organisationsById[key.slice('share:'.length)];
        org.projectShare = to;
        logSetting('Projektanteil', org.label, `${from} % → ${to} %`);
      }
    }
    touch();
    flash(t('Einstellungen gespeichert'), { settingsDraft: null, modal: null });
  },

  /* Derived from state, not read back off the checkbox — the same way
     «Mir zugewiesen» does it, and independent of event ordering. */
  'mail-pref': (val) => setState(s => ({
    account: { ...s.account, mail: { ...s.account.mail, [val]: !s.account.mail[val] } }
  })),

  /* The account language is the language: a preference nobody can see applied
     is a preference nobody believes was saved. */
  'account-lang': (val) => setState(s => ({ account: { ...s.account, lang: val }, lang: val })),

  /*
   * Signing out. Edits live only in memory, so they go with the session rather
   * than waiting behind a login for somebody else — and the signed-out screen
   * says that they did. They are written into the data, so signing in loads
   * the fixtures afresh, which is what that screen promises.
   */
  signout: () => setState({
    signedIn: false, ...OVERLAYS_CLOSED, openProjects: {}, openPeople: {}, settingsDraft: null
  }),

  signin: async () => {
    try {
      await load();
    } catch (error) {
      /* The fixtures did not come back — a server stopped under the page. Said,
         not left as an unhandled rejection behind a button that did nothing. */
      console.error(error);
      return flash(t('Die Daten konnten nicht geladen werden.'));
    }
    setState({ signedIn: true });
  },
  /* The print layout prints what is on screen: the bar plan when the reader is
     looking at the bar plan, the figures otherwise — it reads the same view. */
  'print-layout': () => setState({ tab: 'export', ...OVERLAYS_CLOSED }),
  export: (val) => {
    setState({ menu: null });
    try {
      const name = val === 'csv' ? exportCsv() : exportXlsx();
      flash(`${name} — ${t('heruntergeladen')}`);
    } catch (error) {
      console.error(error);
      flash(t('Export fehlgeschlagen.'));
    }
  },
  /* Clicking the sorted column flips it; a new column starts on its own default. */
  'sort-person': (val) => setState(s => (s.pSort === val
    ? { pDir: s.pDir === 'asc' ? 'desc' : 'asc' }
    : { pSort: val, pDir: val === 'name' || val === 'organisation' ? 'asc' : 'desc' })),

  sheet: (val) => setState({ sheet: val }),
  paper: (val) => setState({ paper: val, menu: null }),
  zoom: (val) => setState({ zoom: val, menu: null }),

  /*
   * Clamped where it is written. pageOf() clamps on read, so the display was
   * always right while state.page ran on past the end: nine clicks on a
   * four-page log left it at 10, and the next six «Vorherige Seite» clicks did
   * nothing at all because they were counting back down through pages that do
   * not exist.
   */
  page: (val) => setState(s => {
    /* Step from where the reader actually is. pageOf() clamps for display but
       leaves state.page where it ran to, so stepping back from a stale 10 over
       a four-page log spent the first click getting back to 4 — the page the
       screen had been showing all along. */
    const pages = pageCount();
    const at = Math.min(Math.max(1, s.page), pages);
    return { page: Math.max(1, Math.min(pages, at + Number(val))) };
  }),
  'page-size': (val) => setState({ pageSize: val, page: 1, menu: null }),

  /*
   * The file, not the dialog. A printer driver imposes its own paper and its
   * own unprintable margin, so an A3 sheet arrives scaled onto A4 and A0 is not
   * on offer at all. The writer is loaded on demand, like the API widget.
   */
  'export-pdf': async (val) => {
    if (state.exporting) return;
    /*
     * The lock lives in state, not on the button: set as el.disabled it sat on
     * a node the next render replaces, so it protected nothing.
     */
    setState({ exporting: true });
    try {
      const { sheetsToPdf } = await import('./pdf.js');
      /*
       * Collected after the await. A render during the dynamic import — a
       * resize, a toast — detaches everything gathered before it, and the
       * writer then measured nodes with no layout: a 12 KB file with no text
       * at all and a zero-sized page box.
       */
      const sheets = [...root.querySelectorAll('.sheet')].filter(s => s.isConnected);
      if (!sheets.length) return;
      /* The same way out as the spreadsheet: one helper, one rule for when the
         object URL may go. There were two, and they disagreed — ten seconds
         there, none here, for the largest file of the three. */
      download(new Blob([sheetsToPdf(sheets)], { type: 'application/pdf' }), val);
    } catch (error) {
      /* A failed import or a writer error is said, as the spreadsheet export
         says it — not left as an unhandled rejection behind a stuck button. */
      console.error(error);
      flash(t('Export fehlgeschlagen.'));
    } finally {
      setState({ exporting: false });
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
  if (!state.modal) modalReturn = focusKey(el);
  fn(el.dataset.val, el);
});

let searchTimer;
root.addEventListener('input', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'search') {
    state.search = el.value;                 // written directly: no re-render per keystroke
    touch();                                 // but the memoised lists must know
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setState({}), 180);
  } else if (act === 'setting-input') {
    /* Kept as typed until «Speichern» — see settingsDraft in store.js. */
    setState(s => ({ settingsDraft: { ...s.settingsDraft, [el.dataset.val]: el.value } }));
  } else if (act === 'menu-search') {
    setState({ menuSearch: el.value });
  }
});

/* -----------------------------------------------------------------------------
   The rows under a project — typed into like a spreadsheet
   -------------------------------------------------------------------------- */

/*
 * There is no editor to open. A cell is a field: the figure is typed over,
 * and leaving the cell — Tab, Enter, an arrow up or down, a click anywhere
 * else — writes it. Escape puts back what was there. Every change goes into
 * the log under the role's name.
 *
 * The pensum is the one thing that is written. Roles and the people in them
 * come from SAP ePPM and are read, so nothing here adds a row, removes one
 * or changes whose it is.
 *
 * This replaced a popover with a stepper, a list of people, a reason and two
 * buttons. The users asked for the cell and nothing around it.
 */

/** What a typed figure means in pensum points, or null where it is not one. */
function typedPensum(text) {
  const raw = text.trim().replace(/[’'\s%]/g, '').replace(',', '.');
  if (raw === '') return 0;
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const points = state.unit === 'fte' ? Number(raw) * 100 : Number(raw);
  return Math.max(0, Math.min(200, Math.round(points)));
}

/** The row a cell or a list belongs to, read off its attributes. */
function laneAt(el) {
  const project = data.projectsById[el.dataset.val];
  const role = roleOf(el.dataset.role);
  return { project, role, a: laneOf(project, role.id, el.dataset.holder) };
}

const personName = id => (id ? data.peopleById[id].name : t('nicht zugewiesen'));

/*
 * Write a cell. Compared against the data, not against what the field held
 * when it was focused, so it may be called twice for one edit — by Enter and
 * again by the blur that follows — and writes once. The row stays whatever
 * is typed: emptied to the last quarter it is still the role ePPM names.
 */
function commitCell(el) {
  if (!el.isConnected) return false;
  const { project, role, a } = laneAt(el);
  if (!project || !a) return false;
  const from = Number(el.dataset.q);
  const to = Number(el.dataset.to);
  const quarters = Array.from({ length: to - from }, (_, i) => from + i);
  const before = periodValue(a.demand, { quarters });
  const typed = el.value;
  const value = typedPensum(typed);
  const range = state.unit === 'fte' ? '0 – 2,00 FTE' : '0 – 200 %';
  /*
   * Not a figure: the cell goes back to what it was, and says why. It used
   * to do so in silence — «abc» and «-20» simply vanished, and the reader
   * was left to guess whether the old figure or the new one had been kept.
   */
  if (value === null) {
    el.value = el.defaultValue;
    if (typed.trim() !== '') flash(`${t('Kein Pensum')}: «${typed.trim()}». ${t('Zulässig sind ganze Zahlen im Bereich')} ${range}.`);
    return false;
  }
  /* The figure that is there: nothing to write. */
  if (value === before) { el.value = el.defaultValue; return false; }
  /* A figure that was cut to the range or rounded is saved as something
     other than what was typed — 500 as 200, 12,5 as 13 — and has to say so. */
  const asTyped = Number(typed.trim().replace(/[’'\s%]/g, '').replace(',', '.')) * (state.unit === 'fte' ? 100 : 1);
  const adjusted = asTyped !== value;

  for (const q of quarters) a.demand[q] = value;
  recomputeDemand(project);
  /* The field now holds what was saved, not what was typed. The render that
     follows keeps a half-typed figure in the focused cell — and took «500»
     for one, so the cell went on showing it under a toast that said 200. */
  el.value = el.defaultValue = value > 0 ? num(value) : '';
  const span = from + 1 === to ? data.quarters[from].label : `${data.quarters[from].label} – ${data.quarters[to - 1].label}`;
  logChange(project, role.label, `${personName(a.person)}, ${span}: ${before} % → ${value} %`, `${value} %`);
  touch();
  if (adjusted) flash(`${t('Gespeichert als')} ${value} %. ${t('Zulässig sind ganze Zahlen im Bereich')} ${range}.`);
  else announce(`${personName(a.person)}, ${span}: ${value} % — ${t('gespeichert')}`);
  /*
   * Rendered on the next turn, not now. The blur that brought us here is
   * half of a move — the next cell is about to take focus, or the click that
   * caused it has yet to be dispatched — and replacing the page under it
   * would lose both.
   */
  setTimeout(() => setState({}), 0);
  return true;
}

/** The same column of the row above or below, where there is one. */
function cellBeside(el, step) {
  const rows = [...root.querySelectorAll('.prow--lane')];
  const next = rows[rows.indexOf(el.closest('.prow--lane')) + step];
  return next?.querySelector(`[data-act="lane-input"][data-col="${CSS.escape(el.dataset.col)}"]`) ?? null;
}

root.addEventListener('focusout', (event) => {
  if (rendering) return;
  if (event.target.matches?.('[data-act="lane-input"]')) commitCell(event.target);
});

/* A click into a cell selects the figure, as a spreadsheet does: the next
   keystroke replaces it. Only the click that brings focus — a second click
   places the caret. */
let clickedInto = null;
root.addEventListener('pointerdown', (event) => {
  const el = event.target.closest?.('[data-act="lane-input"]');
  if (el) clickedInto = document.activeElement === el ? null : el;
});
root.addEventListener('click', (event) => {
  const el = event.target.closest?.('[data-act="lane-input"]');
  if (el && el === clickedInto && el.selectionStart === el.selectionEnd) el.select();
  clickedInto = null;
});

root.addEventListener('keydown', (event) => {
  const el = event.target;
  if (!el.matches?.('[data-act="lane-input"]')) return;
  if (event.key === 'Escape') {
    /* Before the handler that closes overlays: here Escape means «not this figure». */
    event.preventDefault(); event.stopPropagation();
    el.value = el.defaultValue; el.select();
    return;
  }
  const step = event.key === 'ArrowDown' || (event.key === 'Enter' && !event.shiftKey) ? 1
    : event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey) ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const next = cellBeside(el, step);
  /* Moving on writes the cell through its blur; with nowhere to go, here. */
  if (next) { next.focus(); next.select(); } else if (!commitCell(el)) el.select();
});

/* -----------------------------------------------------------------------------
   Roaming focus along a list of controls — the menus use it
   -------------------------------------------------------------------------- */

/**
 * Move focus along a list of controls, wrapping at both ends. `step` is 1 or
 * -1, or 'first' / 'last' to jump.
 */
function roam(items, step, from = items.indexOf(document.activeElement)) {
  if (!items.length) return null;
  /* From outside the list, ArrowDown enters at the top and ArrowUp at the
     bottom; the modulo alone sent ArrowUp to the second-to-last item. */
  const next = step === 'first' ? 0
    : step === 'last' ? items.length - 1
      : from < 0 ? (step > 0 ? 0 : items.length - 1)
        : (from + step + items.length) % items.length;
  items[next]?.focus();
  return items[next] ?? null;
}

/* -----------------------------------------------------------------------------
   Menu keyboard behaviour — the standard menu-button pattern.
   Arrow keys roam, Escape closes and hands focus back to the trigger, Tab
   leaves rather than walking into a tree that is about to be re-rendered.
   -------------------------------------------------------------------------- */

/* Live items only: a greyed switch cannot take focus, so roaming onto it stalled. */
const MENU_ITEMS = '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)';

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
  const modal = state.modal && root.querySelector('.modal');
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
  if (event.key === 'Escape' && closeOverlays()) event.preventDefault();
});

/*
 * A click anywhere outside an open dropdown closes it — on click, not on
 * pointerdown.
 *
 * Closing on pointerdown re-rendered the page between the press and the
 * release, which detached the element under the finger. The browser then
 * produced no click event at all, so the delegated dispatch never ran: with a
 * menu open, the first click on a tab, a checkbox or a filter did nothing but
 * close the menu, and everything had to be clicked twice. Nine triggers shared
 * this. On click the dispatch has already run by the time we re-render.
 */
document.addEventListener('click', (event) => {
  if (state.menu === null || event.target.closest('.dd')) return;
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
  /* A fixed panel stays where it was put, so it is re-placed while its trigger
     moves — the toolbar it hangs off is itself a scroller. */
  if (state.menu !== null) positionMenu();
  if (!event.target.hasAttribute?.('data-scroll')) return;
  syncScrollFades(event.target);
  alignScrollers(event.target);
}, true);

window.addEventListener('scroll', () => {
  if (state.menu !== null) positionMenu();
}, { passive: true });

/*
 * The grid drops master-data columns to fit the window, so a resize can change
 * what it draws. Debounced, because a drag fires this dozens of times and a
 * re-render is not free.
 */
let resizeTimer;
window.addEventListener('resize', () => {
  root.querySelectorAll('[data-scroll]').forEach(syncScrollFades);
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    /* The stylesheet gives some of the layout tokens another value below a
       breakpoint — the shell's inset at 1440px — and the cache would go on
       answering with the one it read first. */
    forgetTokens();
    setState({});
  }, 150);
});

window.addEventListener('hashchange', () => {
  /*
   * An in-page anchor — the skip link's «#main» — is not an address of ours.
   * Read as one it has no parameters at all, which meant every default: the
   * skip link reset the tab, the filters, the search and the view. The state
   * is still right, so its own address goes back into the bar.
   */
  if (!location.hash.startsWith('#?')) return writeUrl();
  syncFromUrl();
});

/* -----------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

(async function boot() {
  try {
    await Promise.all([load(), loadIcons()]);
    syncFromUrl();
    /*
     * Canonicalise the entry point. The bare URL and any link still pointing at
     * a tab that no longer exists both resolve to the Übersicht, and the address
     * bar has to say so — otherwise a reader shares a hash that does not
     * describe what they are looking at. replaceState, so this is not a step
     * the Back button has to walk through.
     */
    writeUrl();
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
