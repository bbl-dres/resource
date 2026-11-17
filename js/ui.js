/* =============================================================================
   ui.js — rendering primitives, icons and the shared application shell.

   Views are pure functions returning HTML. All interaction happens through
   `data-act` attributes that app.js dispatches, so nothing here touches state.
   ============================================================================= */

import {
  data, state, t, FILTERS, filtersHere, selectedHere, idsHere, activeFilters, kpis, filteredProjects, canStep, todayOffset, notifications,
  columnSet, coloured, figuresShown, searchMatcher
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

const ico = (name, size) => raw(icon(name, size));

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
  info: (s = 15) => ico('info', s),
  share: (s = 15) => ico('share-2', s),
  filter: (s = 15) => ico('funnel', s),
  download: (s = 15) => ico('download', s),
  printer: (s = 15) => ico('printer', s),
  eye: (s = 15) => ico('eye', s),
  settings: (s = 15) => ico('settings', s),
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
    const px = parseInt(getComputedStyle(document.documentElement).getPropertyValue(name), 10);
    /* A misspelled token used to cache NaN for the life of the page and hand
       it to a grid template, where it is silently invalid. */
    if (Number.isNaN(px)) throw new Error(`Unknown design token ${name}`);
    pxCache.set(name, px);
  }
  return pxCache.get(name);
}

/*
 * Some of these tokens change under a media query — the shell's inset below
 * 1440px — so the cache cannot outlive a resize: app.js clears it there.
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

/**
 * A string with the search hits marked. The segments go through the template
 * and are escaped there — nothing typed reaches raw() — and the ranges come
 * from the matcher the filter uses, so a row cannot match with nothing
 * marked. Without a query, or without a hit, the string comes back as it was.
 */
export function highlight(text) {
  const s = String(text ?? '');
  const match = searchMatcher();
  const ranges = match ? match.ranges(s) : [];
  if (!ranges.length) return s;
  const parts = [];
  let at = 0;
  for (const [from, to] of ranges) {
    if (from > at) parts.push(s.slice(at, from));
    parts.push(html`<mark class="hit">${s.slice(from, to)}</mark>`);
    at = to;
  }
  if (at < s.length) parts.push(s.slice(at));
  return html`${parts}`;
}

/** The project cell of a change row: a link when the entry names a project. */
export const changeProject = (c) => (c.projectId
  ? html`<button type="button" class="linkbtn" data-act="open-project" data-val="${c.projectId}">${highlight(c.projectLabel)}</button>`
  : highlight(c.projectLabel));

/*
 * Only the time axis scrolls; the master data stays where it is. A pinned
 * column therefore needs the running offset of the ones before it, which the
 * view's layout function has already worked out.
 */
export const pinCls = (s, k, extra = '') =>
  `${extra} ${s[k] === undefined ? '' : `is-frozen ${k === s.last ? 'is-frozen-last' : ''}`}`.trim();
export const pinLeft = (s, k) => (s[k] === undefined ? '' : `left:${s[k]}px`);

/**
 * A registry column's value for a project, as a table cell prints it: the
 * short form with the full one as its hint where the column has one, the
 * plain text otherwise, and a dash for nothing. The planning grid and the
 * bar plan each had this, and disagreed about the dash.
 */
export const plainCell = (col, p) => (col.short
  ? html`<span title="${col.text(p)}">${col.short(p) || '—'}</span>`
  : col.text(p) || '—');

/**
 * The first cell of every row in the two folding tables: a narrow frozen
 * track of its own, in front of the columns, that holds the caret on a row
 * that folds and nothing on any other. The caret used to sit inside the
 * first column's cell, which tied it to whichever column that was.
 */
export const caretCell = (body = '') => html`<span role="cell" class="pcell pcell--caret is-frozen" style="left:0">${body}</span>`;

/**
 * The caret itself: the row's switch, for the keyboard and for the eye. It
 * carries a focus key of its own: the row around it dispatches the same
 * action with the same value, and found by those the row came first — a div,
 * which cannot take focus, so folding a row by keyboard dropped it to <body>.
 */
export const rowCaret = ({ act, val, open, label }) => html`<button type="button" class="rowcaret"
    data-act="${act}" data-val="${val}" data-fk="caret:${val}" aria-expanded="${open}" aria-label="${label}">
  <span class="caret ${open ? '' : 'is-collapsed'}" aria-hidden="true">${icons.chevronDown()}</span>
</button>`;

/**
 * A sortable column header. Both grids use it; they differ only in which pair
 * of state fields they sort by and which action they dispatch.
 */
export function sortableHead({ key, label, act, active, ascending, cls = '', style = '', title = '', fk = '' }) {
  const name = typeof label === 'string' ? label : key;
  /* The direction is a glyph the reader sees; the name says it for everyone else. */
  const dir = active ? `, ${t(ascending ? 'aufsteigend' : 'absteigend')}` : '';
  /* A column heading of the table it stands in, and it says which way the
     table is sorted — the arrow beside the label is for the eye only. */
  return html`<span role="columnheader" aria-sort="${active ? (ascending ? 'ascending' : 'descending') : 'none'}"
      class="pcell--text ${cls} ${active ? 'is-sorted' : ''}" style="${style}">
    <button type="button" class="sorthead" data-act="${act}" data-val="${key}" ${attr(fk, `data-fk="${esc(fk)}"`)}
            title="${title || `${t('Sortieren nach')} ${name}`}"
            aria-label="${t('Sortieren nach')} ${name}${dir}">
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
/*
 * `body` is a function: the panel is only built while the menu is open. Given
 * as markup, every closed menu was rendered and thrown away on every render —
 * the lead menu alone filtered and drew forty rows per keystroke in the search.
 */
/*
 * The label sits in a span of its own. A plain string lands in the button as
 * a bare text node, and the anonymous flex item that makes cannot shrink
 * below its text: squeezed in the toolbar, the filter triggers kept their
 * label whole and pushed the chevron out over the border.
 */
export function dropdown({ id, label, lead, count, size = 'md', align = 'left', body }) {
  const open = state.menu === id;
  return html`<div class="dd">
    <button type="button" class="btn ${open ? 'is-open' : ''}" data-act="menu" data-val="${id}"
            aria-expanded="${open}" aria-haspopup="menu">
      ${lead ?? ''}<span>${label}</span>${count ? badge(count) : ''}${icons.chevronDown()}
    </button>
    ${open && menuPanel({ align, size, label, body: typeof body === 'function' ? body() : body })}
  </div>`;
}

/**
 * The panel itself. `--dd-w` lets the stylesheet clamp the width to the
 * viewport, and `max-height` keeps a long list reachable near the bottom edge.
 */
export function menuPanel({ align = 'left', size = 'md', body, label }) {
  return html`<div class="dd__panel dd__panel--${align} dd__panel--${size}" role="menu"
      ${label ? raw(`aria-label="${esc(label)}"`) : ''}>${body}</div>`;
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

export function menuRadio(label, checked, act, val, meta, { disabled = false } = {}) {
  return html`<button type="button" class="dd__item ${checked ? 'is-checked' : ''}" role="menuitemradio"
      aria-checked="${checked}" data-act="${act}" data-val="${val}" ${attr(disabled, 'aria-disabled="true" disabled')}>
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

/*
 * A row of exclusive choices inside a menu — the time scale, the unit. They
 * are items of the menu they sit in: as plain buttons the arrow keys passed
 * over them and Tab closes a menu, so the time scale could not be changed
 * from the keyboard at all.
 */
export function segmented(options, value, act, label = '', { disabled = false } = {}) {
  return html`<div class="segmented" role="group" ${label && raw(`aria-label="${esc(t(label))}"`)}>
    ${options.map(o => html`<button type="button" class="${o.value === value ? 'is-on' : ''}" role="menuitemradio"
      aria-checked="${o.value === value}" data-act="${act}" data-val="${o.value}"
      ${attr(disabled, 'aria-disabled="true" disabled')}>${t(o.label)}</button>`)}
  </div>`;
}


export function divider() { return html`<div class="dd__divider" role="separator"></div>`; }

/* -----------------------------------------------------------------------------
   Application shell
   -------------------------------------------------------------------------- */

/*
 * «Übersicht» and «Termine» were two tabs over the same rows. They are one tab
 * now, and the bar plan is a view of it — see VIEW_PRESETS in store.js.
 */
const TABS = [
  { id: 'overview', label: 'Planung' },
  { id: 'people', label: 'Personen' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'Verlauf' }
];

/** What the page in front of the reader is called: its tab, or the title of a page that has none. */
export const tabTitle = () => t(TABS.find(x => x.id === state.tab)?.label
  ?? { export: 'PDF-Export — Drucklayout', api: 'API-Dokumentation' }[state.tab] ?? 'Planung');

export function appHeader() {
  const m = data.meta;
  const langs = data.i18n.languages;
  const open = state.menu === 'lang';
  return html`<header class="shell-header">
    <div class="wrap shell-header__inner">
      <a class="brand" href="#?tab=overview" data-act="home">
        <!-- The federal order: the office, its division, then the application. -->
        <span class="brand__text">${t(m.org.name)}
          <span class="brand__sub brand__sub--division">${t(m.org.division)}</span>
          <span class="brand__sub">${t(m.org.app)}</span>
        </span>
      </a>

      <p class="proto-pill">${t(m.prototypeNotice)}</p>

      <!-- Signed out, the header carries the wordmark and nothing else: a
           language switch and a bell would both be promising something the
           page cannot deliver without a session. -->
      ${state.signedIn ? html`<div class="shell-header__actions">
        <div class="dd">
          <button type="button" class="hdr-btn" data-act="menu" data-val="lang"
                  aria-expanded="${open}" aria-haspopup="menu" aria-label="${t('Sprache wählen')}: ${state.lang.toUpperCase()}">
            ${state.lang.toUpperCase()}${icons.chevronDown()}
          </button>
          ${open && html`<div class="dd__panel dd__panel--right" role="menu" aria-label="${t('Sprache wählen')}">
            ${langs.map(l => html`<button type="button" class="dd__item ${state.lang === l.code ? 'is-checked' : ''}"
                role="menuitemradio" aria-checked="${state.lang === l.code}" lang="${l.code}"
                ${attr(!l.available, 'aria-disabled="true" disabled')}
                data-act="lang" data-val="${l.code}">
              <span>${l.label} <span class="dd__meta">${l.tag}</span></span>
              ${state.lang === l.code ? html`<span class="dd__check">${icons.check()}</span>` : l.note ? html`<span class="dd__meta">${l.note}</span>` : ''}
            </button>`)}
          </div>`}
        </div>

        ${notifyBell()}

        <!-- The office's rules, not the reader's own: those stay in the account menu. -->
        <button type="button" class="hdr-btn hdr-btn--icon" data-act="rules" aria-haspopup="dialog"
                title="${t('Einstellungen')}" aria-label="${t('Einstellungen')}">${icons.settings()}</button>

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
        aria-label="${t('Konto')}">
      <div class="account">
        <span class="avatar avatar--lg" aria-hidden="true">${m.user.initials}</span>
        <div>
          <p class="account__name">${m.user.name}</p>
          <p class="account__meta">${t(m.user.role)} · ${t(m.org.unit)}</p>
        </div>
      </div>
      <p class="account__note">${t('Angemeldet über eIAM')}</p>
      ${divider()}
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
      <p class="signout__lead">${t('Die Personalplanung zeigt Personendaten und Kredite; ohne Anmeldung wird nichts davon geladen.')}</p>
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
      align: 'right', size: 'xl', label: t('Benachrichtigungen'), body: notifyList(items)
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

/** Icon that expands into a search field in place, at the head of the toolbar. */
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
      ? html`<h1 class="sr-only">${tabTitle()}</h1>
          <div class="tabline">${tabBar()}<div class="page-header__actions">${actions}</div></div>`
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
    <button type="button" class="btn" data-act="print-layout">${icons.printer(15)}${t('Drucken')}</button>
    <button type="button" class="btn" data-act="share">${icons.share(15)}${t('Teilen')}</button>${extra}`;
}

/** One row of the export menu. */
const exportItem = (val, label) => html`<button type="button" class="dd__item"
    role="menuitem" data-act="export" data-val="${val}">${label}</button>`;

export function exportMenu() {
  const open = state.menu === 'export';
  return html`<div class="dd">
    <button type="button" class="btn ${open ? 'is-open' : ''}" data-act="menu" data-val="export"
            aria-expanded="${open}" aria-haspopup="menu">${icons.download(15)}${t('Exportieren')}${icons.chevronDown()}</button>
    ${open && html`<div class="dd__panel dd__panel--right dd__panel--sm" role="menu" aria-label="${t('Exportieren')}">
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

/* Neutral figures, no alert state: what the strip says is the size of the
   work, not a verdict on the people doing it. */
export function kpiStrip() {
  return html`<div class="kpi-strip">
    ${kpis().map(c => html`<div class="kpi">
      <div class="kpi__label">${t(c.label)}</div>
      <div class="kpi__value">${c.value}</div>
      <div class="kpi__note">${c.note}</div>
    </div>`)}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Toolbar — search, filters, time, view
   -------------------------------------------------------------------------- */

/*
 * A filter names its subject and prints no value: what it is holding shows
 * twice already, as the count on the button and as the named chips in the
 * «Aktive Filter» row underneath. The funnel says what kind of control it is;
 * the count says how much it is doing.
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
 * No grouping menu either. «Gruppieren nach» offered six ways to cut the
 * table, and the users asked for one that never changes: the projects stand
 * by size, small before large — see groupProjects() in store.js.
 *
 * The row has three subjects, left to right: WHICH projects (search,
 * filters), WHICH quarters (the steps beside «Zu heute») and HOW the rows are
 * drawn («Ansicht»). The time controls used to be a bar of their own under
 * this one; folded in they give back 40px above the first row.
 */
export function toolbar({ time = false, view = false, print = false } = {}) {
  const mine = data.meta.user.personId;
  const minesOnly = state.leads.length === 1 && state.leads[0] === mine;
  /* Only the filters this tab's rows answer to: a menu that changes nothing
     on the page under it reads as a broken one. */
  const here = new Set(filtersHere().map(f => f.kind));

  return html`<div class="toolbar">
    ${expandableSearch({ placeholder: 'Projekt, ID oder Person' })}

    ${here.has('portfolio') && filterMenu('portfolio', { label: 'Teilportfolio', size: 'lg' })}
    ${here.has('phase') && filterMenu('phase', { label: 'Phase (ePPM)', heading: 'Phase (ePPM) · Mehrfachauswahl', size: 'lg' })}
    ${here.has('organisation') && filterMenu('organisation', { label: 'Organisation' })}

    <span class="toolbar__sep" aria-hidden="true"></span>

    ${dropdown({
      /* The filter finds everybody on a project, not only the one name a
         folded row shows in the column. */
      id: 'lead', lead: icons.filter(), label: t('Bearbeitende'),
      count: selectedHere(FILTERS.find(f => f.kind === 'lead')).length, size: 'xl',
      body: leadMenuBody
    })}

    ${mine ? html`<label class="toolbar__check">
      <input type="checkbox" data-act="my-projects" ${attr(minesOnly, 'checked')}>
      <span>${t('Mir zugewiesen')}</span>
    </label>` : ''}

    ${(time || view) && html`<div class="toolbar__end">
      ${time && html`
      <button type="button" class="btn btn--square" data-act="period" data-val="-1"
              ${attr(!canStep(-1), 'disabled')} aria-label="${t('Zurück')}">${icons.chevronLeft()}</button>
      <button type="button" class="btn" data-act="period" data-val="today"
              ${attr(state.periodOffset === todayOffset(), 'disabled')}>${t('Zu heute')}</button>
      <button type="button" class="btn btn--square" data-act="period" data-val="1"
              ${attr(!canStep(1), 'disabled')} aria-label="${t('Weiter')}">${icons.chevronRight()}</button>
      ${view && html`<span class="toolbar__sep" aria-hidden="true"></span>`}`}

      ${view && dropdown({
        id: 'view', lead: icons.eye(), label: t('Ansicht'), size: 'lg', align: 'right', body: () => viewMenuBody({ print })
      })}
    </div>`}
  </div>`;
}

/** «Alle · Keine» at the head of a filter's menu — items of it, so the arrow keys reach them. */
const bulkLinks = kind => html`<div class="dd__bulk">
  <button type="button" role="menuitem" data-act="bulk" data-kind="${kind}" data-val="all">${t('Alle')}</button>
  <span aria-hidden="true">·</span>
  <button type="button" role="menuitem" data-act="bulk" data-kind="${kind}" data-val="none">${t('Keine')}</button>
</div>`;

/**
 * One list filter as a toolbar menu, drawn from the registry in store.js: a
 * tick per value, under «Alle · Keine». Three of these were written out in
 * full, differing in four words.
 */
function filterMenu(kind, { label, heading = 'Mehrfachauswahl', size }) {
  const f = FILTERS.find(x => x.kind === kind);
  return dropdown({
    id: kind, lead: icons.filter(), label: t(label), count: selectedHere(f).length, size,
    body: () => html`${menuGroupLabel(t(heading))}${bulkLinks(f.kind)}
      ${idsHere(f).map(id => menuTick(f.name(id), state[f.key].includes(id), `toggle-${f.kind}`, id))}`
  });
}

/* -----------------------------------------------------------------------------
   The Ansicht menu — what the planning grid draws, in one place
   -------------------------------------------------------------------------- */

const VIEWS = [
  { id: 'pensum', label: 'Pensum' },
  { id: 'pensum-termine', label: 'Pensum + Termine' },
  { id: 'termine', label: 'Termine' },
  { id: 'custom', label: 'Benutzerdefiniert' }
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

const unitSwitch = disabled => html`<div class="dd__segmented">
  ${segmented([{ value: 'pct', label: 'Pensum %' }, { value: 'fte', label: 'FTE' }], state.unit, 'unit', 'Einheit', { disabled })}
</div>`;

const columnSwitches = () => toggleableColumns()
  .map(c => menuCheckbox(t(c.label), !!columnSet()[c.id], 'toggle-col', c.id));

/*
 * Four subjects that used to be four controls, coarse to fine: the view, the
 * time scale that frames it, how the figures are set, and which columns stand
 * in front of them. The two that shape the whole grid come first; the column
 * list is longest and least often touched, so it goes last, where it pushes
 * nothing down. The layer switches show only while «Benutzerdefiniert» is chosen —
 * a named view already says what they would say — and «Pensum einfärben»
 * greys out while there are no figures to colour.
 *
 * The print layout carries the same menu, so the reader sets the paper up the
 * way they set the screen up, and every view prints: the figures, the bars,
 * or the figures with the band under them. The one switch paper has no use
 * for is «Heute» — a printed sheet carries its date in the letterhead — so
 * that one is greyed there.
 *
 * Personen carries it too, with the part that changes a table of people: the
 * time scale and how a pensum is written. It has no named view, no layers
 * and no columns to choose. The scale and the unit set on Planung always
 * applied there; without the menu they could be seen and not changed.
 *
 * All three switches under «Pensumwerte» grey out together while no figure
 * is drawn. The unit used to stay live in the bar plan, where it set nothing.
 */
function viewMenuBody({ print = false } = {}) {
  const people = state.tab === 'people';
  const noFigures = !figuresShown();
  return html`${!people && html`${menuGroupLabel(t('Ansicht'))}
    ${VIEWS.map(v => menuRadio(t(v.label), state.view === v.id, 'view', v.id))}
    ${state.view === 'custom' && html`${divider()}
      ${menuGroupLabel(t('Ebenen'))}
      ${LAYERS.map(l => menuCheckbox(t(l.label), !!state.layers[l.id], 'toggle-layer', l.id, null,
        { disabled: print && l.id === 'today' }))}`}
    ${divider()}`}
    ${menuGroupLabel(t('Zeitskala'))}
    <div class="dd__segmented">${segmented(SCALES, state.scale, 'scale', 'Zeitskala')}</div>
    ${!people && html`${divider()}
    ${menuGroupLabel(t('Spalten'))}
    ${columnSwitches()}`}
    ${divider()}
    ${menuGroupLabel(t('Pensumwerte'))}
    ${unitSwitch(noFigures)}
    ${menuCheckbox(t('Pensum einfärben'), coloured(), 'colour', 'toggle', null, { disabled: noFigures })}
    ${menuCheckbox(t('Nullwerte ausblenden'), state.hideZeros, 'toggle-flag', 'hideZeros', null, { disabled: noFigures })}`;
}

/**
 * The lead menu is the one that has to survive a real directory: it filters as
 * you type, floats the selected entries to the top and scrolls the rest. The
 * reader's own projects are one click away beside it, in «Mir zugewiesen».
 */
function leadMenuBody() {
  const f = FILTERS.find(x => x.kind === 'lead');
  const q = state.menuSearch.trim().toLowerCase();
  const entries = idsHere(f).map(id => ({ id, name: f.name(id) }));
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
    ${bulkLinks(f.kind)}
    <div class="dd__scroll">
      ${matches.length
        ? [...selected, ...rest].map(e => menuTick(e.name, state.leads.includes(e.id), 'toggle-lead', e.id))
        : html`<p class="dd__empty">${t('Keine Person gefunden.')}</p>`}
    </div>`;
}

/** «111 Bauprojekte», or «31 von 111 Bauprojekten» once something is filtered. */
export function scopeLine(shown) {
  const total = data.projects.length;
  return shown === total
    ? `${total} ${t('Bauprojekte')}`
    : `${shown} ${t('von')} ${total} ${t('Bauprojekten')}`;
}

/** «11 Bauprojekte», «1 Bauprojekt» — a count that says what it counts, on screen and on paper. */
export const projectCount = n => `${n} ${t(n === 1 ? 'Bauprojekt' : 'Bauprojekte')}`;

/** The label of the row that closes a group: the group is named in the heading above it. */
export const sumLabel = n => `${t('Summe')} (${projectCount(n)})`;

/** The same line for a table of people: «50 Personen», or «3 von 50 Personen». */
export function peopleLine(shown) {
  const total = data.people.length;
  return shown === total ? `${total} ${t('Personen')}` : `${shown} ${t('von')} ${total} ${t('Personen')}`;
}

/**
 * The chips of the filters that are set, and how much they leave. What is
 * counted is what the tab lists — projects everywhere but on Personen, which
 * hands its own line in.
 */
export function activeFilterRow({ count = scopeLine(filteredProjects().length) } = {}) {
  const chips = activeFilters();
  return html`<div class="filterbar">
    ${chips.length
      ? html`<span class="filterbar__label">${t('Aktive Filter:')}</span>
             ${chips.map(c => chip(c.label, { kind: c.kind, id: c.id }))}
             <button type="button" class="linkbtn" data-act="filters-reset">${icons.close(13)} ${t('Alle Filter zurücksetzen')}</button>`
      : html`<span class="filterbar__label">${t('Aktive Filter:')} <span class="filterbar__none">${t('keine')}</span></span>`}
    <span class="toolbar__spacer"></span>
    <span class="filterbar__count">${count}</span>
  </div>`;
}

/* -----------------------------------------------------------------------------
   Footer
   -------------------------------------------------------------------------- */

/** The line at the foot of every page: the data's date, the version, the links. */
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

/**
 * Column charts over the same periods, one above the other, in one scroller.
 * The plots and the axis are separate grids over the same columns, so a
 * scroller around only one of them would slide the bars out from under their
 * labels — and a scroller per chart gave the card two scrollbars for one axis.
 * A panel's heading sticks to the left edge so it stays readable while the
 * columns scroll under it.
 */
export function columnCharts(panels, { col } = {}) {
  const rows = panels[0].rows;
  return html`<div class="colchart" style="--chart-cols:${rows.length}${col ? `;--chart-col:${col}px` : ''}">
    <div class="colchart__scroll">
    ${panels.map(({ rows: r, height = 150, refAt = 100, refLabel = '100 %', max, title, sub }) => {
      const top = max ?? Math.max(refAt * 1.2, ...r.map(x => x.value || 0));
      const refPct = (refAt / top) * 100;
      return html`<div class="colchart__panel">
        ${title && html`<div class="colchart__panelhead">
          <h3 class="bi-card__subtitle">${t(title)}</h3>
          ${sub && html`<p class="bi-card__sub">${t(sub)}</p>`}
        </div>`}
        <div class="colchart__plot" style="--chart-h:${height}px">
          ${refAt ? html`<div class="colchart__ref" style="bottom:${refPct.toFixed(1)}%"></div>
                         <div class="colchart__refrow" style="bottom:${(refPct + 1.2).toFixed(1)}%">
                           <span class="colchart__reflabel">${refLabel}</span>
                         </div>` : ''}
          <div class="colchart__grid">
            ${r.map(x => html`<div class="colchart__col is-${x.tone}">
              <span class="colchart__val">${x.label}</span>
              <span class="colchart__bar" style="height:${x.value == null ? 8 : Math.max(2, (x.value / top) * 100).toFixed(1)}%"
                    title="${x.title ?? ''}"></span>
            </div>`)}
          </div>
        </div>
      </div>`;
    })}
    <div class="colchart__axis">${rows.map(x => html`<span>${x.axis}</span>`)}</div>
    </div>
  </div>`;
}

/** One chart on its own. */

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
    </div>`)}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Misc helpers used by more than one view
   -------------------------------------------------------------------------- */




/**
 * Nothing matched. Saying so beats a grid with no rows, and the way out is the
 * same control that got the user here.
 */
export function noResults(what = 'Projekte') {
  const text = what === 'Personen'
    ? `${t('Auf keine der')} ${data.people.length} ${t('Personen treffen die aktiven Filter zu.')}`
    : `${t('Die aktiven Filter schliessen alle')} ${data.projects.length} ${t('Projekte aus.')}`;
  return html`<div class="empty">
    <p class="empty__title">${t('Keine')} ${t(what)} ${t('im gesetzten Umfang')}</p>
    <p class="empty__text">${text}</p>
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
