/* =============================================================================
   ui.js — rendering primitives, icons and the shared application shell.

   Views are pure functions returning HTML. All interaction happens through
   `data-act` attributes that app.js dispatches, so nothing here touches state.
   ============================================================================= */

import {
  data, state, t, activeFilters, kpis, filteredProjects, canStep, notifications,
  columnSet, coloured
} from './store.js';
import { toggleableColumns } from './columns.js';
import { icon } from './icons.js';

/* -----------------------------------------------------------------------------
   Templating — html`` escapes interpolations unless they are already Html.
   -------------------------------------------------------------------------- */

class Html {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stringify(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Html) return v.value;
  if (Array.isArray(v)) return v.map(stringify).join('');
  return esc(v);
}

/*
 * An ARIA state wants the word "false", not the empty string a boolean renders
 * to everywhere else: aria-expanded="" is not "collapsed", it is invalid. So a
 * boolean landing in an ARIA slot spells itself out, and every other slot keeps
 * the conditional idiom where false means "render nothing".
 */
const ARIA_SLOT = /\saria-[a-z]+="$/;

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out += (typeof v === 'boolean' && ARIA_SLOT.test(strings[i]) ? String(v) : stringify(v))
      + strings[i + 1];
  }
  return new Html(out);
}

/**
 * Emit a bare attribute fragment (`disabled`, `data-x="1"`, …) unescaped.
 * Interpolating such a string directly would be escaped and silently ignored.
 */
export const attr = (on, fragment) => (on ? raw(fragment) : '');

/** Opt out of escaping for a string you built yourself. */
export const raw = s => new Html(String(s));


/* -----------------------------------------------------------------------------
   Icons — Lucide, loaded from assets/icons and referenced through the sprite
   -------------------------------------------------------------------------- */

const ico = (name, size, opts) => raw(icon(name, size, opts));

export const icons = {
  search: (s = 15) => ico('search', s),
  chevronDown: (s = 13) => ico('chevron-down', s),
  chevronLeft: (s = 15) => ico('chevron-left', s),
  chevronRight: (s = 15) => ico('chevron-right', s),
  arrowRight: (s = 15) => ico('arrow-right', s),
  close: (s = 15) => ico('x', s),
  bell: (s = 15) => ico('bell', s),
  kebab: (s = 15) => ico('ellipsis-vertical', s),
  check: (s = 13) => ico('check', s),
  plus: (s = 15) => ico('plus', s),
  minus: (s = 15) => ico('minus', s),
  warn: (s = 13) => ico('triangle-alert', s),
  info: (s = 15) => ico('info', s),
  pencil: (s = 15) => ico('pencil', s),
  share: (s = 15) => ico('share-2', s),
  sortAsc: (s = 15) => ico('arrow-up-narrow-wide', s),
  sortDesc: (s = 15) => ico('arrow-down-wide-narrow', s),
  grid: (s = 15) => ico('layout-grid', s),
  filter: (s = 15) => ico('funnel', s),
  download: (s = 15) => ico('download', s),
  externalLink: (s = 13) => ico('external-link', s)
};

/**
 * Only http(s) and mailto leave the app. Escaping keeps markup out of an href
 * but says nothing about the scheme, and `javascript:` in a data file would
 * still run — this is the one place a JSON value becomes a navigation.
 */
export function safeHref(href) {
  return /^(https?:|mailto:)/i.test(String(href ?? '')) ? href : '#';
}

/* -----------------------------------------------------------------------------
   Shared measurements and mappings
   -------------------------------------------------------------------------- */

/**
 * A design token read as a number. Tokens are the single source for the column
 * widths, and the grid template and the frozen offsets must agree to the pixel.
 * A stylesheet does not change under us, so one read per token is enough.
 */
const pxCache = new Map();
export function tokenPx(name) {
  if (!pxCache.has(name)) {
    pxCache.set(name, parseInt(getComputedStyle(document.documentElement).getPropertyValue(name), 10));
  }
  return pxCache.get(name);
}

/*
 * Some of these tokens depend on the time scale, so the cache cannot outlive a
 * change of it. It nearly did: after switching from Jahr to Quartal the grids
 * went on laying out quarters at a year's width, three thousand pixels of track
 * for sixteen columns, and only a reload put it right.
 */
export function forgetTokens() {
  pxCache.clear();
}

/** The rule that separates one year from the next, drawn on its first column. */
export const yearRule = period => (period.yearStart ? 'is-yearstart' : '');

/*
 * How wide a string sets, in the app's own font at a given size token. Measured
 * once per string and cached: the bar plan asks about the same dozen phase
 * names for every one of five hundred bars.
 */
const textCache = new Map();
let measure = null;

export function textWidth(text, sizeToken = '--text-xs') {
  const key = `${sizeToken}|${text}`;
  const hit = textCache.get(key);
  if (hit !== undefined) return hit;

  if (!measure) measure = document.createElement('canvas').getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  measure.font = `${cs.getPropertyValue(sizeToken).trim()} ${cs.getPropertyValue('--font-sans').trim()}`;
  const width = measure.measureText(text).width;
  textCache.set(key, width);
  return width;
}

/**
 * Say what had to give. A window too narrow for every column is a reason to
 * show fewer, not a reason to refuse to draw — but the reader has to know that
 * what they are looking at is not the whole table.
 */
export function droppedNote(hidden) {
  if (!hidden.length) return '';
  return html`<p class="dropped-note">
    ${icons.info()}
    ${hidden.length} ${t(hidden.length === 1 ? 'Spalte ausgeblendet' : 'Spalten ausgeblendet')},
    ${t('das Fenster ist zu schmal')}: ${hidden.map(c => t(c.label)).join(', ')}.
  </p>`;
}

/** The project cell of a change row: a link when the entry names a project. */
export const changeProject = (c) => (c.projectId
  ? html`<button type="button" class="linkbtn" data-act="open-project" data-val="${c.projectId}">${c.projectLabel}</button>`
  : c.projectLabel);

/*
 * Only the time axis scrolls; the master data stays where it is. A pinned
 * column therefore needs the running offset of the ones before it, which the
 * view's layout function has already worked out.
 */
export const pinCls = (s, k, extra = '') =>
  `${extra} ${s[k] === undefined ? '' : `is-frozen ${k === s.last ? 'is-frozen-last' : ''}`}`.trim();
export const pinLeft = (s, k) => (s[k] === undefined ? '' : `left:${s[k]}px`);

/**
 * A sortable column header. Both grids use it; they differ only in which pair
 * of state fields they sort by and which action they dispatch.
 */
export function sortableHead({ key, label, act, active, ascending, cls = '', style = '', title = '' }) {
  const name = typeof label === 'string' ? label : key;
  return html`<span class="pcell--text ${cls} ${active ? 'is-sorted' : ''}" style="${style}">
    <button type="button" class="sorthead" data-act="${act}" data-val="${key}"
            title="${title || `${t('Sortieren nach')} ${name}`}"
            aria-label="${t('Sortieren nach')} ${name}">
      <span class="sorthead__label">${label}</span>
      <span class="sorthead__dir" aria-hidden="true">${active ? (ascending ? '↑' : '↓') : ''}</span>
    </button>
  </span>`;
}

/* -----------------------------------------------------------------------------
   Small shared controls
   -------------------------------------------------------------------------- */

export function pillSwitch(on, tone = '') {
  return html`<span class="switch ${on ? 'is-on' : ''} ${tone}" aria-hidden="true"><span class="switch__knob"></span></span>`;
}

export function chip(label, { kind, id, removable = true } = {}) {
  return html`<span class="chip">${label}${removable && html`<button type="button" class="chip__x"
      data-act="filter-remove" data-kind="${kind}" data-val="${id}"
      aria-label="${t('Filter entfernen')}: ${label}">${icons.close()}</button>`}</span>`;
}

export function badge(n) {
  return html`<span class="badge-count">${n}</span>`;
}

/**
 * A dropdown trigger + panel. `body` is the panel content.
 * `id` doubles as the state.menu key.
 */
export function dropdown({ id, label, lead, count, width = 244, align = 'left', body, cls = '', title = '' }) {
  const open = state.menu === id;
  return html`<div class="dd ${cls}" data-menu="${id}">
    <button type="button" class="btn ${open ? 'is-open' : ''}" data-act="menu" data-val="${id}"
            aria-expanded="${open}" aria-haspopup="menu" ${title && raw(`title="${esc(title)}"`)}>
      ${lead ?? ''}${label}${count ? badge(count) : ''}${icons.chevronDown()}
    </button>
    ${open && menuPanel({ align, width, body })}
  </div>`;
}

/**
 * The panel itself. `--dd-w` lets the stylesheet clamp the width to the
 * viewport, and `max-height` keeps a long list reachable near the bottom edge.
 */
export function menuPanel({ align = 'left', width = 244, body, label }) {
  return html`<div class="dd__panel dd__panel--${align}" role="menu"
      ${label ? raw(`aria-label="${esc(label)}"`) : ''} style="--dd-w:${width}px">${body}</div>`;
}

/*
 * The one line that names a whole dropdown, at the top of its panel. A filter
 * menu never carries a second one: labelled runs made it read as a form with
 * headings rather than as a list of choices, so where a run needed naming the
 * items were renamed instead — «Daten als CSV» rather than «Daten» above
 * «CSV». The Ansicht menu is the exception, and deliberately so: it holds
 * four subjects that used to be four controls, and the label is what keeps
 * «Termine» the view apart from «Meilensteine» the layer.
 */
export function menuGroupLabel(text) {
  return html`<div class="dd__grouplabel">${text}</div>`;
}

export function menuRadio(label, checked, act, val, meta) {
  return html`<button type="button" class="dd__item ${checked ? 'is-checked' : ''}" role="menuitemradio"
      aria-checked="${checked}" data-act="${act}" data-val="${val}">
    <span>${label}</span>${meta && html`<span class="dd__meta">${meta}</span>`}${checked && html`<span class="dd__check">${icons.check()}</span>`}
  </button>`;
}

/*
 * A switch that cannot apply right now is greyed rather than hidden, so the
 * reader can see what would come back — «Pensum einfärben» while the figures
 * are off. Disabled for real: a greyed control that still answers is worse
 * than one that ignores you.
 */
export function menuCheckbox(label, on, act, val, meta, { disabled = false } = {}) {
  return html`<button type="button" class="dd__item" role="menuitemcheckbox" aria-checked="${on}"
      data-act="${act}" data-val="${val}" ${attr(disabled, 'aria-disabled="true" disabled')}>
    <span>${label}</span>${meta && html`<span class="dd__meta">${meta}</span>`}${pillSwitch(on)}
  </button>`;
}

export function menuTick(label, on, act, val, meta) {
  return html`<button type="button" class="dd__item ${on ? 'is-checked' : ''}" role="menuitemcheckbox"
      aria-checked="${on}" data-act="${act}" data-val="${val}">
    <span class="dd__tickbox ${on ? 'is-on' : ''}" aria-hidden="true"></span>
    <span class="dd__label">${label}</span>${meta && html`<span class="dd__meta">${meta}</span>`}
  </button>`;
}

export function segmented(options, value, act) {
  return html`<div class="segmented" role="group">
    ${options.map(o => html`<button type="button" class="${o.value === value ? 'is-on' : ''}"
      aria-pressed="${o.value === value}" data-act="${act}" data-val="${o.value}">${t(o.label)}</button>`)}
  </div>`;
}


export function divider() { return html`<div class="dd__divider"></div>`; }

/* -----------------------------------------------------------------------------
   Application shell
   -------------------------------------------------------------------------- */

/*
 * «Übersicht» and «Termine» were two tabs over the same rows. They are one tab
 * now, and the bar plan is a view of it — see VIEW_PRESETS in store.js.
 */
const TABS = [
  { id: 'overview', label: 'Planung' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'Verlauf' }
];

export function appHeader() {
  const m = data.meta;
  const langs = data.i18n.languages;
  const open = state.menu === 'lang';
  return html`<header class="shell-header">
    <div class="wrap shell-header__inner">
      <a class="brand" href="#?tab=overview" data-act="home">
        <img src="assets/swiss-logo-flag.svg" alt="" width="22" height="24">
        <span class="brand__text">${m.org.name}<span class="brand__sub">${t(m.org.app)}</span></span>
      </a>

      <p class="proto-pill">${t(m.prototypeNotice)}</p>

      <!-- Signed out, the header carries the wordmark and nothing else: a
           language switch and a bell would both be promising something the
           page cannot deliver without a session. -->
      ${state.signedIn ? html`<div class="shell-header__actions">
        <div class="dd">
          <button type="button" class="hdr-btn" data-act="menu" data-val="lang"
                  aria-expanded="${open}" aria-haspopup="menu" aria-label="${t('Sprache wählen')}">
            ${state.lang.toUpperCase()}${icons.chevronDown()}
          </button>
          ${open && html`<div class="dd__panel dd__panel--right" role="menu" style="width:216px">
            ${langs.map(l => html`<button type="button" class="dd__item ${state.lang === l.code ? 'is-checked' : ''}"
                role="menuitemradio" aria-checked="${state.lang === l.code}"
                ${attr(!l.available, 'aria-disabled="true" disabled')}
                data-act="lang" data-val="${l.code}">
              <span>${l.label} <span class="dd__meta">${l.tag}</span></span>
              ${state.lang === l.code ? html`<span class="dd__check">${icons.check()}</span>` : l.note ? html`<span class="dd__meta">${l.note}</span>` : ''}
            </button>`)}
          </div>`}
        </div>

        ${notifyBell()}

        ${accountMenu()}
      </div>` : ''}
    </div>
  </header>`;
}

/*
 * The account. Who is signed in, the two things they can change about that, and
 * the way out.
 *
 * Nothing here changes a permission: the federal login (eIAM) decides what this
 * person may see, and the application only reports the name it was handed. Which
 * is exactly why the menu says so — a settings dialog with no password field
 * looks like an omission until it explains itself.
 */
function accountMenu() {
  const m = data.meta;
  const open = state.menu === 'user';
  return html`<div class="dd">
    <button type="button" class="avatar ${open ? 'is-open' : ''}" data-act="menu" data-val="user"
            aria-expanded="${open}" aria-haspopup="menu"
            aria-label="${t('Konto')}: ${m.user.name}">${m.user.initials}</button>
    ${open && html`<div class="dd__panel dd__panel--right" role="menu"
        aria-label="${t('Konto')}" style="--dd-w:260px">
      <div class="account">
        <span class="avatar avatar--lg" aria-hidden="true">${m.user.initials}</span>
        <div>
          <p class="account__name">${m.user.name}</p>
          <p class="account__meta">${t(m.user.role)} · ${t(m.org.unit)}</p>
        </div>
      </div>
      <p class="account__note">${t('Angemeldet über eIAM')}</p>
      <div class="dd__sep" role="separator"></div>
      <button type="button" class="dd__item" role="menuitem" data-act="settings">
        <span>${t('Einstellungen')}</span>
      </button>
      <button type="button" class="dd__item" role="menuitem" data-act="signout">
        <span>${t('Abmelden')}</span>
      </button>
    </div>`}
  </div>`;
}

/*
 * The signed-out screen. A prototype that is always signed in never has to say
 * what it is: this page is the one place the application admits that it holds
 * nothing of its own — no account, no password, no session it could restore by
 * itself — and that everything behind it belongs to the federal login.
 */
export function signedOutView() {
  return html`<div class="signout">
    <div class="signout__card">
      <h1 class="signout__title">${t('Sie sind abgemeldet')}</h1>
      <p class="signout__lead">${t('Die Ressourcenplanung zeigt Personendaten und Kredite; ohne Anmeldung wird nichts davon geladen.')}</p>
      <p class="signout__note">${t('Der Zugang wird über eIAM gesteuert. Berechtigungen, Kennwort und Zwei-Faktor-Anmeldung werden dort verwaltet, nicht in dieser Anwendung.')}</p>
      <button type="button" class="btn btn--primary btn--lg" data-act="signin">
        ${t('Mit eIAM anmelden')}
      </button>
      <p class="signout__demo">${t('Prototyp: die Anmeldung ist simuliert und lädt denselben fiktiven Datensatz wieder.')}</p>
    </div>
  </div>`;
}

/**
 * The bell. Its badge is the length of the derived list, so the number in the
 * header and the rows behind it are one fact stated twice — they cannot drift
 * apart the way the hand-written summary before them had.
 *
 * The mark on the left reuses the Ampel shapes, which carry their meaning
 * without hue: a diamond for own overload, a ring for a gate that moved, an
 * outline for a change somebody else made.
 */
export function notifyBell() {
  const items = notifications();
  const open = state.menu === 'notify';
  return html`<div class="dd hdr-notify" data-menu="notify">
    <button type="button" class="hdr-btn hdr-btn--icon ${open ? 'is-open' : ''}"
        data-act="menu" data-val="notify" aria-expanded="${open}" aria-haspopup="menu"
        aria-label="${t('Benachrichtigungen')}: ${items.length}">${icons.bell()}</button>
    ${items.length ? html`<span class="hdr-notify__badge" aria-hidden="true">${items.length}</span>` : ''}
    ${open && menuPanel({
      align: 'right', width: 348, label: t('Benachrichtigungen'), body: notifyList(items)
    })}
  </div>`;
}

function notifyList(items) {
  return html`<div class="notify__head">
    <span>${t('Benachrichtigungen')}</span>
    <span class="dd__meta">${t('seit')} ${data.meta.lastVisit}</span>
  </div>
  ${items.length
    ? items.map(n => html`<button type="button" class="dd__item notify" role="menuitem"
        data-act="${n.act}" data-val="${n.val}">
        <span class="ampel ampel--${n.mark} notify__mark"></span>
        <span class="notify__body">
          <span class="notify__line">
            <span class="notify__title">${t(n.title)}</span>
            <span class="dd__meta">${n.meta}</span>
          </span>
          <span class="notify__text">${n.text}</span>
        </span>
      </button>`)
    : html`<p class="notify__none">${t('Nichts Offenes für Sie.')}</p>`}
  <button type="button" class="dd__item notify__all" role="menuitem" data-act="tab" data-val="history">
    <span>${t('Alle Änderungen anzeigen')}</span>${icons.arrowRight()}
  </button>`;
}

/**
 * Icon that expands into a search field in place. The header and the toolbar
 * each render one; both drive the same query.
 */
export function expandableSearch({ placeholder }) {
  if (!state.searchOpen) {
    return html`<button type="button" class="xsearch" data-act="search-toggle"
        aria-expanded="false" title="${t(placeholder)}" aria-label="${t('Suchfeld öffnen')}">
      ${icons.search()}${state.search && html`<span class="xsearch__dot" aria-hidden="true"></span>`}
    </button>`;
  }
  return html`<div class="xsearch is-open" role="search">
    <span class="xsearch__icon" aria-hidden="true">${icons.search()}</span>
    <input type="search" data-act="search" data-fk="search" value="${state.search}"
           placeholder="${t(placeholder)}" autocomplete="off" aria-label="${t(placeholder)}">
    <button type="button" class="xsearch__close" data-act="search-close"
            aria-label="${t('Suche schliessen')}">${icons.close(13)}</button>
  </div>`;
}

/*
 * The head of a page: the tabs and the page actions on one line.
 *
 * The breadcrumb bar and the title band above them are gone. Measured on a
 * 1366×768 laptop, the two cost 100px of a window that has about 630 to give,
 * and said nothing the tab did not — «Bauprojekte › Übersicht» over a tab
 * called «Übersicht», and «Ressourcenplanung» under a header that already
 * carries the name. The data timestamp they held moved to the footer.
 *
 * A page without tabs — the export and the API reference — keeps a title
 * row, because there the title is the only thing that says where you are.
 */
export function pageHeader({ title, actions = [], chrome = true }) {
  return html`<div class="wrap page-header">
    ${chrome
      ? html`<div class="tabline">${tabBar()}<div class="page-header__actions">${actions}</div></div>`
      : html`<div class="page-header__row">
          <h1 class="page-title">${t(title)}</h1>
          <div class="page-header__actions">${actions}</div>
        </div>`}
  </div>`;
}

/**
 * The standing page-header actions. Five views built this by hand, each free to
 * forget one of them.
 */
/*
 * Printing is its own button. The PDF used to be two rows at the foot of the
 * export menu, under the spreadsheet formats, and most readers never found it
 * there — a PDF of the plan is what most of them come for, and «Exportieren»
 * did not say so. «Drucken» opens the print layout, where the report and the
 * paper are chosen; «Exportieren» keeps the data formats.
 */
export function pageActions({ extra = '' } = {}) {
  return html`${exportMenu()}
    <button type="button" class="btn" data-act="print-layout">${t('Drucken')}</button>
    <button type="button" class="btn" data-act="share">${icons.share(15)}${t('Teilen')}</button>${extra}`;
}

/** One row of the export menu. */
const exportItem = (val, label) => html`<button type="button" class="dd__item"
    role="menuitem" data-act="export" data-val="${val}">${label}</button>`;

export function exportMenu() {
  const open = state.menu === 'export';
  return html`<div class="dd">
    <button type="button" class="btn ${open ? 'is-open' : ''}" data-act="menu" data-val="export"
            aria-expanded="${open}" aria-haspopup="menu">${t('Exportieren')}${icons.chevronDown()}</button>
    ${open && html`<div class="dd__panel dd__panel--right" role="menu" style="width:190px">
      ${exportItem('csv', t('Daten als CSV'))}
      ${exportItem('xlsx', t('Daten als Excel'))}
    </div>`}
  </div>`;
}

export function tabBar() {
  return html`<nav class="tabs" aria-label="${t('Bereiche')}">
    ${TABS.map(tab => {
      const current = state.tab === tab.id;
      return html`<a class="tabs__tab ${current ? 'is-active' : ''}" href="#?tab=${tab.id}"
        ${attr(current, 'aria-current="page"')} data-act="tab" data-val="${tab.id}">${t(tab.label)}</a>`;
    })}
  </nav>`;
}

export function kpiStrip() {
  const k = kpis();
  const cards = [k.credit, k.utilisation, k.people, k.unassigned];
  return html`<div class="kpi-strip">
    ${cards.map(c => html`<div class="kpi ${c.alert ? 'is-alert' : ''}">
      <div class="kpi__label">${t(c.label)}</div>
      <div class="kpi__value">${c.value}</div>
      <div class="kpi__note">${c.note}${c.overflow ? html`<span aria-hidden="true"> · </span><button
      type="button" class="kpi__more" data-act="bi" data-val="people"
      >${c.overflow} ${t('weitere')}</button>` : ''}</div>
    </div>`)}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Toolbar — search, sort, group, filters, attributes
   -------------------------------------------------------------------------- */

const GROUPS = [
  { id: 'none', label: 'Keine' },
  { id: 'lead', label: 'Bearbeitender' },
  { id: 'organisation', label: 'Organisation' },
  { id: 'phase', label: 'Hauptphase (ePPM)' },
  { id: 'portfolio', label: 'Teilportfolio' }
];
/*
 * Some entries are columns and some are flags of their own; that is an
 * implementation detail the menu does not expose. Order comes from the
 * registry, so the menu always reads against the table.
 */


/*
 * A control names its subject, and prints a value only where that value would
 * otherwise be invisible.
 *
 * «Gruppieren nach: Teilportfolio» prints one, because a grouping is a single
 * choice that cannot be seen until the menu is open. A filter does not: what
 * it is holding shows twice already, as the count on the button and as the
 * named chips in the «Aktive Filter» row underneath. The funnel says what kind
 * of control it is; the count says how much it is doing.
 *
 * Spelling the selection out on the button instead cost more than it returned.
 * «Teilportfolio: 2 von 7» is four words for a fact the chips state by name,
 * and four of them together overran the bar: at 1366px — the width this is
 * built for — every button in the row was clipping 10 to 16 pixels of its own
 * text, because .toolbar is nowrap and the buttons shrink to fit.
 *
 * No sort menu. The column headers sort, and a menu that said the same thing
 * a second way was 150px of the row.
 *
 * The row has three subjects, left to right: WHICH projects (search, grouping,
 * filters), WHICH quarters (the steps beside «Zu heute») and HOW the rows are
 * drawn («Ansicht»). The time controls used to be a bar of their own under
 * this one; folded in they give back 40px above the first row.
 */
export function toolbar({ time = false, view = false, columns = false, exclude = [] } = {}) {
  const groupLabel = GROUPS.find(g => g.id === state.group)?.label ?? GROUPS[0].label;
  const mine = data.meta.user.personId;
  const minesOnly = state.leads.length === 1 && state.leads[0] === mine;

  return html`<div class="toolbar">
    ${expandableSearch({ placeholder: 'Projekt, ID oder Person' })}

    ${dropdown({
      id: 'group', lead: icons.grid(), width: 288,
      /* The prefix yields on a small laptop and stays in the accessible name;
         the value is the part a reader has to see. */
      label: html`<span class="btn__prefix">${t('Gruppieren nach')}:</span><span>${t(groupLabel)}</span>`,
      title: `${t('Gruppieren nach')}: ${t(groupLabel)}`,
      body: html`${menuGroupLabel(t('Gruppieren nach'))}
        ${GROUPS.map(g => menuRadio(t(g.label), state.group === g.id, 'group', g.id))}`
    })}

    <span class="toolbar__sep" aria-hidden="true"></span>

    ${dropdown({
      id: 'portfolio', lead: icons.filter(), label: t('Teilportfolio'),
      count: state.portfolios.length, width: 276,
      body: html`${menuGroupLabel(t('Mehrfachauswahl'))}
        <div class="dd__bulk">
          <button type="button" data-act="bulk" data-kind="portfolios" data-val="all">${t('Alle')}</button>
          <span aria-hidden="true">·</span>
          <button type="button" data-act="bulk" data-kind="portfolios" data-val="none">${t('Keine')}</button>
        </div>
        ${data.meta.portfolios.map(pf => menuTick(t(pf.label), state.portfolios.includes(pf.id), 'toggle-portfolio', pf.id))}`
    })}

    ${dropdown({
      id: 'phase', lead: icons.filter(), label: t('Phase (ePPM)'),
      count: state.phases.length, width: 284,
      body: html`${menuGroupLabel(t('Phase (ePPM) · Mehrfachauswahl'))}
        <div class="dd__bulk">
          <button type="button" data-act="bulk" data-kind="phases" data-val="all">${t('Alle')}</button>
          <span aria-hidden="true">·</span>
          <button type="button" data-act="bulk" data-kind="phases" data-val="none">${t('Keine')}</button>
        </div>
        ${data.phases.eppm.map(e => menuTick(t(e.label), state.phases.includes(e.id), 'toggle-phase', e.id))}`
    })}

    ${dropdown({
      id: 'organisation', lead: icons.filter(), label: t('Organisation'),
      count: state.organisations.length, width: 244,
      body: html`${menuGroupLabel(t('Mehrfachauswahl'))}
        <div class="dd__bulk">
          <button type="button" data-act="bulk" data-kind="organisations" data-val="all">${t('Alle')}</button>
          <span aria-hidden="true">·</span>
          <button type="button" data-act="bulk" data-kind="organisations" data-val="none">${t('Keine')}</button>
        </div>
        ${data.meta.organisations.map(o => menuTick(t(o.label), state.organisations.includes(o.id), 'toggle-organisation', o.id))}`
    })}

    <span class="toolbar__sep" aria-hidden="true"></span>

    ${dropdown({
      id: 'lead', lead: icons.filter(), label: t('Bearbeitender'),
      count: state.leads.length, width: 312,
      body: leadMenuBody()
    })}

    ${mine ? html`<label class="toolbar__check">
      <input type="checkbox" data-act="my-projects" ${attr(minesOnly, 'checked')}>
      <span>${t('Mir zugewiesen')}</span>
    </label>` : ''}

    <span class="toolbar__spacer"></span>

    ${time && html`
      <button type="button" class="btn btn--square" data-act="period" data-val="-1"
              ${attr(!canStep(-1), 'disabled')} aria-label="${t('Zurück')}">${icons.chevronLeft()}</button>
      <button type="button" class="btn" data-act="period" data-val="today"
              ${attr(state.periodOffset === 0, 'disabled')}>${t('Zu heute')}</button>
      <button type="button" class="btn btn--square" data-act="period" data-val="1"
              ${attr(!canStep(1), 'disabled')} aria-label="${t('Weiter')}">${icons.chevronRight()}</button>
      <span class="toolbar__sep" aria-hidden="true"></span>`}

    ${view && dropdown({
      id: 'view', label: t('Ansicht'), width: 296, align: 'right', body: viewMenuBody(exclude)
    })}

    ${columns && dropdown({
      id: 'columns', label: t('Spalten'), width: 296, align: 'right',
      body: html`${unitSwitch()}
        ${divider()}
        ${columnSwitches(exclude)}
        ${divider()}
        ${menuCheckbox(t('Nullwerte ausblenden'), state.hideZeros, 'toggle-flag', 'hideZeros')}`
    })}
  </div>`;
}

/* -----------------------------------------------------------------------------
   The Ansicht menu — what the planning grid draws, in one place
   -------------------------------------------------------------------------- */

const VIEWS = [
  { id: 'pensum', label: 'Pensum' },
  { id: 'both', label: 'Pensum + Termine' },
  { id: 'termine', label: 'Termine' },
  { id: 'custom', label: 'Individuell' }
];
const LAYERS = [
  { id: 'values', label: 'Pensumwerte' },
  { id: 'phases', label: 'Phasenbalken' },
  { id: 'gates', label: 'Meilensteine' },
  { id: 'today', label: 'Heute' }
];
const SCALES = [
  { value: 'year', label: 'Jahr' },
  { value: 'quarter', label: 'Quartal' },
  { value: 'month', label: 'Monat' }
];

const unitSwitch = () => html`<div class="dd__segmented">
  ${segmented([{ value: 'pct', label: 'Pensum %' }, { value: 'fte', label: 'FTE' }], state.unit, 'unit')}
</div>`;

const columnSwitches = exclude => toggleableColumns().filter(c => !exclude.includes(c.id))
  .map(c => menuCheckbox(t(c.label), !!columnSet()[c.id], 'toggle-col', c.id));

/*
 * Four subjects that used to be four controls, coarse to fine: the view, the
 * time scale that frames it, how the figures are set, and which columns stand
 * in front of them. The two that shape the whole grid come first; the column
 * list is longest and least often touched, so it goes last, where it pushes
 * nothing down. The layer switches show only while «Individuell» is chosen —
 * a named view already says what they would say — and «Pensum einfärben»
 * greys out while there are no figures to colour.
 */
function viewMenuBody(exclude = []) {
  const noFigures = !state.layers.values;
  return html`${menuGroupLabel(t('Ansicht'))}
    ${VIEWS.map(v => menuRadio(t(v.label), state.view === v.id, 'view', v.id))}
    ${state.view === 'custom' && html`${divider()}
      ${menuGroupLabel(t('Ebenen'))}
      ${LAYERS.map(l => menuCheckbox(t(l.label), !!state.layers[l.id], 'toggle-layer', l.id))}`}
    ${divider()}
    ${menuGroupLabel(t('Zeitskala'))}
    <div class="dd__segmented">${segmented(SCALES, state.scale, 'scale')}</div>
    ${divider()}
    ${menuGroupLabel(t('Darstellung'))}
    ${unitSwitch()}
    ${menuCheckbox(t('Pensum einfärben'), coloured(), 'colour', 'toggle', null, { disabled: noFigures })}
    ${menuCheckbox(t('Nullwerte ausblenden'), state.hideZeros, 'toggle-flag', 'hideZeros', null, { disabled: noFigures })}
    ${divider()}
    ${menuGroupLabel(t('Spalten'))}
    ${columnSwitches(exclude)}`;
}

/**
 * The lead menu is the one that has to survive a real directory: it filters as
 * you type, offers the signed-in user's own projects in one click, floats the
 * selected entries to the top and scrolls the rest.
 */
function leadMenuBody() {
  const q = state.menuSearch.trim().toLowerCase();
  const entries = [
    ...data.people.map(p => ({ id: p.id, name: p.name })),
    { id: 'none', name: t('nicht zugewiesen') }
  ];
  const matches = entries.filter(e => !q || e.name.toLowerCase().includes(q));
  // Selected first, so a choice never scrolls out of sight as the list grows.
  const selected = matches.filter(e => state.leads.includes(e.id));
  const rest = matches.filter(e => !state.leads.includes(e.id));

  return html`${menuGroupLabel(t('Mehrfachauswahl · Ausgewählte oben'))}
    <div class="dd__search">
      <label class="dd__searchfield">
        ${icons.search(15)}
        <input type="search" data-act="menu-search" data-fk="menu-search" value="${state.menuSearch}"
               placeholder="${t('Person suchen')}" aria-label="${t('Person suchen')}" autocomplete="off">
      </label>
    </div>
    <div class="dd__bulk">
      <button type="button" data-act="bulk" data-kind="leads" data-val="all">${t('Alle')}</button>
      <span aria-hidden="true">·</span>
      <button type="button" data-act="bulk" data-kind="leads" data-val="none">${t('Keine')}</button>
    </div>
    <div class="dd__scroll">
      ${matches.length
        ? [...selected, ...rest].map(e => menuTick(e.name, state.leads.includes(e.id), 'toggle-lead', e.id))
        : html`<p class="dd__empty">${t('Keine Person gefunden.')}</p>`}
    </div>
`;
}



/** «111 Bauprojekte», or «31 von 111 Bauprojekten» once something is filtered. */
export function scopeLine(shown) {
  const total = data.projects.length;
  return shown === total
    ? `${total} ${t('Bauprojekte')}`
    : `${shown} ${t('von')} ${total} ${t('Bauprojekten')}`;
}

export function activeFilterRow() {
  const chips = activeFilters();
  const shown = filteredProjects().length;
  return html`<div class="filterbar">
    ${chips.length
      ? html`<span class="filterbar__label">${t('Aktive Filter:')}</span>
             ${chips.map(c => chip(t(c.label), { kind: c.kind, id: c.id }))}
             <button type="button" class="linkbtn" data-act="filters-reset">${icons.close(13)} ${t('Alle Filter zurücksetzen')}</button>`
      : html`<span class="filterbar__label">${t('Aktive Filter:')} <span class="filterbar__none">${t('keine')}</span></span>`}
    <span class="toolbar__spacer"></span>
    <span class="filterbar__count">${scopeLine(shown)}</span>
  </div>`;
}

/* -----------------------------------------------------------------------------
   Footer + design notes
   -------------------------------------------------------------------------- */

/**
 * The prototype notice, acknowledged once per session.
 *
 * Over the page rather than in it, so dismissing it reflows nothing — and the
 * shell carries its measured height as bottom padding while it is there, so it
 * never covers the last row of a table.
 */
export function appFooter() {
  const m = data.meta;
  return html`<footer class="shell-footer"><div class="wrap shell-footer__inner">
    <span>${t('Datenstand ePPM')}: ${m.asOf}</span><span>${m.version}</span>
    <span class="shell-footer__links">
      ${m.footerLinks.map(l => l.tab
        ? html`<a href="#?tab=${l.tab}" data-act="tab" data-val="${l.tab}">${t(l.label)}</a>`
        : html`<a href="${safeHref(l.href)}" target="_blank" rel="noopener noreferrer">${t(l.label)}</a>`)}
    </span>
  </div></footer>`;
}


/* -----------------------------------------------------------------------------
   Charts shared by the landing page and the dashboard
   -------------------------------------------------------------------------- */

/** Vertical bar chart with a 100 % reference line. */
export function columnChart(rows, { max, height = 150, refAt = 100, refLabel = '100 %', axis = true, col }) {
  const top = max ?? Math.max(refAt * 1.2, ...rows.map(r => r.value || 0));
  const refPct = (refAt / top) * 100;
  /*
    * The plot and the axis scroll as one. They are two separate grids over the
    * same columns, so a scroller around only one of them would slide the bars
    * out from under their own labels.
    */
  return html`<div class="colchart" style="--chart-h:${height}px;--chart-cols:${rows.length}${col ? `;--chart-col:${col}px` : ''}">
    <div class="colchart__scroll">
    <div class="colchart__plot">
      ${refAt ? html`<div class="colchart__ref" style="bottom:${refPct.toFixed(1)}%"></div>
                     <div class="colchart__reflabel" style="bottom:${(refPct + 1.2).toFixed(1)}%">${refLabel}</div>` : ''}
      <div class="colchart__grid">
        ${rows.map(r => html`<div class="colchart__col is-${r.tone}">
          <span class="colchart__val">${r.label}</span>
          <span class="colchart__bar" style="height:${r.value == null ? 8 : Math.max(2, (r.value / top) * 100).toFixed(1)}%"
                title="${r.title ?? ''}"></span>
        </div>`)}
      </div>
    </div>
    ${axis ? html`<div class="colchart__axis">${rows.map(r => html`<span>${r.axis}</span>`)}</div>` : ''}
    </div>
  </div>`;
}

/** Horizontal bar list used by five of the six dashboard cards. */
export function barList(rows, { max, gap = 12 } = {}) {
  const top = max ?? Math.max(1, ...rows.map(r => r.value));
  return html`<div class="barlist" style="gap:${gap}px">
    ${rows.map(r => html`<div class="barlist__row">
      <div class="barlist__head">
        <span class="barlist__label">${r.label}</span>
        <span class="barlist__value">${r.valueLabel}</span>
      </div>
      <div class="barlist__track">
        <span class="barlist__fill ${r.tone ? 'is-' + r.tone : ''}" style="width:${((r.value / top) * 100).toFixed(1)}%"></span>
      </div>
      ${r.note && html`<div class="barlist__note ${r.noteTone ? 'is-' + r.noteTone : ''}">${r.note}</div>`}
    </div>`)}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Misc helpers used by more than one view
   -------------------------------------------------------------------------- */




/** Shown where a view needs more width than the window offers. */
/**
 * Nothing matched. Saying so beats a grid with no rows, and the way out is the
 * same control that got the user here.
 */
export function noResults(what = 'Projekte') {
  return html`<div class="empty">
    <p class="empty__title">${t('Keine')} ${t(what)} ${t('im gesetzten Umfang')}</p>
    <p class="empty__text">${t('Die aktiven Filter schliessen alle')} ${data.projects.length} ${t('Projekte aus.')}</p>
    <button type="button" class="btn" data-act="filters-reset">${t('Alle Filter zurücksetzen')}</button>
  </div>`;
}

/**
 * A legend where every row says what it encodes. Rows of symbols under one
 * generic heading left the reader to guess what the blue steps measured; the
 * label is the useful word, so it replaces «Legende» rather than following it.
 */
export function legendBlock(groups, cls = '') {
  return html`<dl class="legend ${cls}">
    ${groups.filter(g => g.items).map(g => html`<div class="legend__group">
      <dt>${t(g.label)}</dt><dd>${g.items}</dd>
    </div>`)}
  </dl>`;
}

/** A swatch or mark with its caption. */
export function legendItem(mark, label) {
  return html`<span class="legend__item">${mark}${t(label)}</span>`;
}

export function toast() {
  if (!state.toast) return '';
  return html`<div class="toast" role="status">${state.toast}</div>`;
}
