/* =============================================================================
   ui.js — rendering primitives, icons and the shared application shell.

   Views are pure functions returning HTML. All interaction happens through
   `data-act` attributes that app.js dispatches, so nothing here touches state.
   ============================================================================= */

import {
  data, state, t, activeFilters, kpis, filteredProjects
} from './store.js';
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

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += stringify(values[i]) + strings[i + 1];
  return new Html(out);
}

/** ARIA state attributes need the literal words, not the ''-for-false default. */
export const aria = v => (v ? 'true' : 'false');

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
  arrowRight: (s = 16) => ico('arrow-right', s),
  arrowUpRight: (s = 13) => ico('arrow-up-right', s),
  close: (s = 14) => ico('x', s),
  bell: (s = 16) => ico('bell', s),
  kebab: (s = 16) => ico('ellipsis-vertical', s),
  check: (s = 13) => ico('check', s),
  plus: (s = 16) => ico('plus', s),
  minus: (s = 16) => ico('minus', s),
  warn: (s = 13) => ico('triangle-alert', s),
  info: (s = 14) => ico('info', s),
  calendar: (s = 15) => ico('calendar-days', s),
  list: (s = 15) => ico('list', s),
  gantt: (s = 15) => ico('chart-gantt', s),
  pencil: (s = 15) => ico('pencil', s),
  share: (s = 15) => ico('share-2', s),
  download: (s = 15) => ico('download', s),
  users: (s = 15) => ico('users', s),
  externalLink: (s = 13) => ico('external-link', s)
};

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
export function dropdown({ id, label, hint, count, width = 244, align = 'left', body, cls = '' }) {
  const open = state.menu === id;
  return html`<div class="dd ${cls}" data-menu="${id}">
    <button type="button" class="btn ${open ? 'is-open' : ''}" data-act="menu" data-val="${id}"
            aria-expanded="${aria(open)}" aria-haspopup="menu">
      ${label}${hint && html`<span class="btn__hint">${hint}</span>`}${count ? badge(count) : ''}${icons.chevronDown()}
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

export function menuGroupLabel(text) {
  return html`<div class="dd__grouplabel">${text}</div>`;
}

export function menuRadio(label, checked, act, val, meta) {
  return html`<button type="button" class="dd__item ${checked ? 'is-checked' : ''}" role="menuitemradio"
      aria-checked="${aria(checked)}" data-act="${act}" data-val="${val}">
    <span>${label}</span>${meta && html`<span class="dd__meta">${meta}</span>`}${checked && html`<span class="dd__check">${icons.check()}</span>`}
  </button>`;
}

export function menuCheckbox(label, on, act, val, meta) {
  return html`<button type="button" class="dd__item" role="menuitemcheckbox" aria-checked="${aria(on)}"
      data-act="${act}" data-val="${val}">
    <span>${label}</span>${meta && html`<span class="dd__meta">${meta}</span>`}${pillSwitch(on)}
  </button>`;
}

export function menuTick(label, on, act, val, meta) {
  return html`<button type="button" class="dd__item ${on ? 'is-checked' : ''}" role="menuitemcheckbox"
      aria-checked="${aria(on)}" data-act="${act}" data-val="${val}">
    <span class="dd__tickbox ${on ? 'is-on' : ''}" aria-hidden="true"></span>
    <span class="dd__label">${label}</span>${meta && html`<span class="dd__meta">${meta}</span>`}
  </button>`;
}

export function segmented(options, value, act) {
  return html`<div class="segmented" role="group">
    ${options.map(o => html`<button type="button" class="${o.value === value ? 'is-on' : ''}"
      aria-pressed="${aria(o.value === value)}" data-act="${act}" data-val="${o.value}">${t(o.label)}</button>`)}
  </div>`;
}

export function menuNote(text) {
  return html`<p class="dd__note">${text}</p>`;
}

export function divider() { return html`<div class="dd__divider"></div>`; }

/* -----------------------------------------------------------------------------
   Application shell
   -------------------------------------------------------------------------- */

const TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'termine', label: 'Termine' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'verlauf', label: 'Verlauf' }
];

export function appHeader() {
  const m = data.meta;
  const langs = data.i18n.languages;
  const open = state.menu === 'lang';
  return html`<header class="shell-header">
    <div class="wrap shell-header__inner">
      <a class="brand" href="#?tab=start" data-act="tab" data-val="start">
        <img src="assets/swiss-logo-flag.svg" alt="" width="22" height="24">
        <span class="brand__text">${m.org.name}<span class="brand__sub">${t(m.org.app)}</span></span>
      </a>

      <p class="proto-pill">${t(m.prototypeNotice)}</p>

      <div class="shell-header__actions">
        ${expandableSearch({ variant: 'header', placeholder: 'Projekt, ID oder Person suchen',
                             title: 'Globale Suche über alle Portfolios' })}

        <div class="dd">
          <button type="button" class="hdr-btn" data-act="menu" data-val="lang"
                  aria-expanded="${aria(open)}" aria-haspopup="menu" aria-label="${t('Sprache wählen')}">
            ${state.lang.toUpperCase()}${icons.chevronDown()}
          </button>
          ${open && html`<div class="dd__panel dd__panel--right" role="menu" style="width:216px">
            ${langs.map(l => html`<button type="button" class="dd__item ${state.lang === l.code ? 'is-checked' : ''}"
                role="menuitemradio" aria-checked="${aria(state.lang === l.code)}"
                ${attr(!l.available, 'aria-disabled="true" disabled')}
                ${attr(l.available, `data-act="lang" data-val="${l.code}"`)}>
              <span>${l.label} <span class="dd__meta">${l.tag}</span></span>
              ${state.lang === l.code ? html`<span class="dd__check">${icons.check()}</span>` : l.note ? html`<span class="dd__meta">${l.note}</span>` : ''}
            </button>`)}
            ${menuNote(data.i18n.menuNote)}
          </div>`}
        </div>

        <div class="hdr-notify">
          <button type="button" class="hdr-btn hdr-btn--icon" title="${m.notificationsTitle}"
                  aria-label="${t('Benachrichtigungen')}, ${m.notifications} ungelesen">${icons.bell()}</button>
          <span class="hdr-notify__badge" aria-hidden="true">${m.notifications}</span>
        </div>

        <span class="avatar" title="${t('Angemeldet')}: ${m.user.name}">${m.user.initials}</span>
      </div>
    </div>
  </header>`;
}

/**
 * Icon that expands into a search field in place. The header and the toolbar
 * each render one; both drive the same query.
 */
export function expandableSearch({ variant, placeholder, title }) {
  const open = state.searchOpen[variant];
  if (!open) {
    return html`<button type="button" class="xsearch xsearch--${variant}" data-act="search-toggle"
        data-val="${variant}" aria-expanded="false"
        title="${t(title ?? placeholder)}" aria-label="${t('Suchfeld öffnen')}">
      ${icons.search()}${state.search && html`<span class="xsearch__dot" aria-hidden="true"></span>`}
    </button>`;
  }
  return html`<div class="xsearch xsearch--${variant} is-open" role="search">
    <span class="xsearch__icon" aria-hidden="true">${icons.search()}</span>
    <input type="search" data-act="search" data-fk="search-${variant}" value="${state.search}"
           placeholder="${t(placeholder)}" autocomplete="off" aria-label="${t(placeholder)}">
    <button type="button" class="xsearch__close" data-act="search-close" data-val="${variant}"
            aria-label="${t('Suche schliessen')}">${icons.close(13)}</button>
  </div>`;
}

export function pageHeader({ crumbs, title, actions = [], chrome = true }) {
  return html`<div class="band">
    <div class="wrap page-header">
      <nav class="crumbs" aria-label="Pfad">
        ${crumbs.map((c, i) => html`${i > 0 && html`<span aria-hidden="true">›</span>`}<span
          class="${i === crumbs.length - 1 ? 'crumbs__current' : ''}"
          ${attr(i === crumbs.length - 1, 'aria-current="page"')}>${t(c)}</span>`)}
      </nav>
      <div class="page-header__row">
        <h1 class="page-title">${t(title)}</h1>
        <div class="page-header__actions">${actions}</div>
      </div>
      ${chrome && kpiStrip()}
      ${chrome && tabBar()}
    </div>
  </div>`;
}

export function editToggle() {
  return html`<button type="button" class="btn btn--toggle ${state.edit ? 'is-on' : ''}"
      data-act="edit-toggle" aria-pressed="${aria(state.edit)}">
    ${pillSwitch(state.edit, 'switch--edit')}${t('Bearbeiten')}
  </button>`;
}

export function exportMenu() {
  const open = state.menu === 'export';
  return html`<div class="dd">
    <button type="button" class="btn ${open ? 'is-open' : ''}" data-act="menu" data-val="export"
            aria-expanded="${aria(open)}" aria-haspopup="menu">${t('Exportieren')}${icons.chevronDown()}</button>
    ${open && html`<div class="dd__panel dd__panel--right" role="menu" style="width:270px">
      <button type="button" class="dd__item" role="menuitem" data-act="export" data-val="csv">${t('Als CSV exportieren')}</button>
      <button type="button" class="dd__item" role="menuitem" data-act="export" data-val="xlsx">${t('Als Excel exportieren')}</button>
      ${divider()}
      <button type="button" class="dd__item" role="menuitem" data-act="export" data-val="pdf">
        <span>${t('Als PDF exportieren')}</span><span class="dd__meta">${t('Drucklayout')}</span>
      </button>
      ${menuNote(t('Der Export übernimmt Ansicht, Filter, Zeitraum und Einheit.'))}
    </div>`}
  </div>`;
}

export function tabBar() {
  return html`<div class="tabs" role="tablist">
    ${TABS.map(tab => html`<button type="button" role="tab" class="tabs__tab ${state.tab === tab.id ? 'is-active' : ''}"
      aria-selected="${aria(state.tab === tab.id)}" data-act="tab" data-val="${tab.id}">${t(tab.label)}</button>`)}
  </div>`;
}

export function kpiStrip() {
  const k = kpis();
  const cards = [k.credit, k.utilisation, k.people, k.unassigned];
  return html`<div class="kpi-strip">
    ${cards.map(c => html`<div class="kpi ${c.alert ? 'is-alert' : ''}">
      <div class="kpi__label">${t(c.label)}</div>
      <div class="kpi__value">${c.value}</div>
      <div class="kpi__note">${c.note}</div>
    </div>`)}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Toolbar — search, sort, group, filters, attributes
   -------------------------------------------------------------------------- */

const SORTS = [
  { id: 'projekt', label: 'Projekt A–Z', short: 'Projekt', hint: 'A–Z' },
  { id: 'pensum', label: 'Pensum aktuelles Quartal', short: 'Pensum', hint: 'aktuelles Quartal' },
  { id: 'kredit', label: 'Kredit', short: 'Kredit', hint: 'absteigend' }
];
const GROUPS = [
  { id: 'none', label: 'Keine' },
  { id: 'lead', label: 'Projektleitung' },
  { id: 'phase', label: 'SIA-Hauptphase' },
  { id: 'portfolio', label: 'Teilportfolio' }
];
const COLUMNS = [
  { id: 'id', label: 'ID' },
  { id: 'phase', label: 'SIA-Phase' },
  { id: 'lead', label: 'Projektleitung' },
  { id: 'credit', label: 'Kredit' },
  { id: 'portfolio', label: 'Teilportfolio' },
  { id: 'priority', label: 'Priorität' },
  { id: 'nextMs', label: 'Nächster Meilenstein' }
];

export function toolbar({ attributes = true, overdue = false } = {}) {
  const sort = SORTS.find(s => s.id === state.sort);
  const groupLabel = GROUPS.find(g => g.id === state.group).label;

  return html`<div class="toolbar">
    ${expandableSearch({ variant: 'toolbar', placeholder: 'Projekt, ID oder Person' })}

    ${dropdown({
      id: 'sort', label: `${t('Sortierung')}: ${t(sort.short)}`, hint: sort.hint, width: 244,
      body: html`${menuGroupLabel(t('Sortieren nach'))}
        ${SORTS.map(s => menuRadio(t(s.label), state.sort === s.id, 'sort', s.id))}`
    })}

    ${dropdown({
      id: 'group', label: `${t('Gruppieren nach')}: ${t(groupLabel)}`, width: 288,
      body: html`${menuGroupLabel(t('Gruppieren nach'))}
        ${GROUPS.map(g => menuRadio(t(g.label), state.group === g.id, 'group', g.id))}`
    })}

    <span class="toolbar__sep" aria-hidden="true"></span>

    ${dropdown({
      id: 'phase', label: t('Phase'), count: state.phases.length, width: 284,
      body: html`${menuGroupLabel(t('SIA 112 · Mehrfachauswahl'))}
        <div class="dd__bulk">
          <button type="button" data-act="bulk" data-kind="phases" data-val="all">${t('Alle')}</button>
          <span aria-hidden="true">·</span>
          <button type="button" data-act="bulk" data-kind="phases" data-val="none">${t('Keine')}</button>
        </div>
        ${data.phases.main.map(m => {
          const n = filteredCountBy(p => p.phase[0] === m.id);
          return menuTick(t(m.label), state.phases.includes(m.id), 'toggle-phase', m.id, `${n}`);
        })}`
    })}

    ${dropdown({
      id: 'lead', label: t('Projektleitung'), count: state.leads.length, width: 312,
      body: leadMenuBody()
    })}

    ${dropdown({
      id: 'portfolio', label: t('Teilportfolio'), count: state.portfolios.length, width: 276,
      body: html`${menuGroupLabel(`${t('Mehrfachauswahl')} · ${t('Bedarf')} ${data.quarters[0].label}`)}
        <div class="dd__bulk">
          <button type="button" data-act="bulk" data-kind="portfolios" data-val="all">${t('Alle')}</button>
          <span aria-hidden="true">·</span>
          <button type="button" data-act="bulk" data-kind="portfolios" data-val="none">${t('Keine')}</button>
        </div>
        ${data.meta.portfolios.map(pf => menuTick(t(pf.label), state.portfolios.includes(pf.id), 'toggle-portfolio', pf.id,
          `${data.projects.filter(p => p.portfolio === pf.id).reduce((a, p) => a + p.demand[0], 0)} %`))}`
    })}

    <span class="toolbar__sep" aria-hidden="true"></span>

    ${overdue
      ? html`<button type="button" class="btn btn--danger-toggle ${state.overdueOnly ? 'is-on' : ''}"
          data-act="overdue-toggle" aria-pressed="${aria(state.overdueOnly)}">${t('Nur überfällige')}</button>`
      : html`<button type="button" class="btn btn--danger-toggle ${state.overloadOnly ? 'is-on' : ''}"
          data-act="overload-toggle" aria-pressed="${aria(state.overloadOnly)}">${t('Nur Überlast')}</button>`}

    <span class="toolbar__spacer"></span>

    ${attributes && dropdown({
      id: 'attr', label: t('Attribute'), width: 296, align: 'right',
      body: html`${menuGroupLabel(t('Einheit'))}
        <div class="dd__segmented">
          ${segmented([{ value: 'pct', label: 'Pensum %' }, { value: 'fte', label: 'FTE' }], state.unit, 'unit')}
        </div>
        ${divider()}
        ${menuGroupLabel(t('Spalten'))}
        ${COLUMNS.map(c => menuCheckbox(t(c.label), state.cols[c.id], 'toggle-col', c.id))}
        ${menuCheckbox(t('Ampel Auslastung'), state.ampel, 'toggle-flag', 'ampel')}
        ${menuCheckbox(t('Verlauf'), state.trend, 'toggle-flag', 'trend')}
        ${menuCheckbox(t('Soll-Pensum'), state.target, 'toggle-flag', 'target')}
        ${divider()}
        ${menuCheckbox(t('Nullwerte ausblenden'), state.hideZeros, 'toggle-flag', 'hideZeros')}`
    })}
  </div>`;
}

/**
 * The lead menu is the one that has to survive a real directory: it filters as
 * you type, offers the signed-in user's own projects in one click, floats the
 * selected entries to the top and scrolls the rest.
 */
function leadMenuBody() {
  const q = state.menuSearch.trim().toLowerCase();
  const entries = [
    ...data.people.map(p => ({
      id: p.id, name: p.name,
      meta: `${countBy(x => x.leadId === p.id)} · ${p.employment} %`
    })),
    { id: 'none', name: t('nicht zugewiesen'), meta: `${countBy(x => !x.leadId)} · —` }
  ];
  const matches = entries.filter(e => !q || e.name.toLowerCase().includes(q));
  // Selected first, so a choice never scrolls out of sight as the list grows.
  const selected = matches.filter(e => state.leads.includes(e.id));
  const rest = matches.filter(e => !state.leads.includes(e.id));
  const mine = data.meta.user.personId;

  return html`${menuGroupLabel(t('Mehrfachauswahl · Ausgewählte oben'))}
    <div class="dd__search">
      <label class="dd__searchfield">
        ${icons.search(14)}
        <input type="search" data-act="menu-search" data-fk="menu-search" value="${state.menuSearch}"
               placeholder="${t('Person suchen')}" aria-label="${t('Person suchen')}" autocomplete="off">
      </label>
    </div>
    ${mine && html`<div class="dd__quick">
      <button type="button" class="quickchip ${state.leads.length === 1 && state.leads[0] === mine ? 'is-on' : ''}"
              data-act="my-projects">${t('Meine Projekte')}</button>
    </div>`}
    <div class="dd__bulk">
      <button type="button" data-act="bulk" data-kind="leads" data-val="all">${t('Alle')}</button>
      <span aria-hidden="true">·</span>
      <button type="button" data-act="bulk" data-kind="leads" data-val="none">${t('Keine')}</button>
    </div>
    <div class="dd__scroll">
      ${matches.length
        ? [...selected, ...rest].map(e => menuTick(e.name, state.leads.includes(e.id), 'toggle-lead', e.id, e.meta))
        : html`<p class="dd__empty">${t('Keine Person gefunden.')}</p>`}
    </div>
    ${menuNote(`${matches.length} ${t('von')} 34 ${t('Personen')} · ${t('weitere beim Scrollen')}`)}`;
}

function countBy(fn) { return data.projects.filter(fn).length; }
function filteredCountBy(fn) { return data.projects.filter(fn).length; }

export function activeFilterRow() {
  const chips = activeFilters();
  const shown = filteredProjects().length;
  return html`<div class="filterbar">
    ${chips.length
      ? html`<span class="filterbar__label">${t('Aktive Filter:')}</span>
             ${chips.map(c => chip(t(c.label), { kind: c.kind, id: c.id }))}
             <button type="button" class="linkbtn linkbtn--danger" data-act="filters-reset">${icons.close(12)} ${t('Alle Filter zurücksetzen')}</button>`
      : html`<span class="filterbar__label">${t('Aktive Filter:')} <span class="filterbar__none">${t('keine')}</span></span>`}
    <span class="toolbar__spacer"></span>
    <span class="filterbar__count">${shown} ${t('von')} ${data.meta.scope.total} ${t('Bauprojekten')} · ${data.meta.org.unit}</span>
  </div>`;
}

/* -----------------------------------------------------------------------------
   Time scale + view switcher
   -------------------------------------------------------------------------- */

export function timeControls({ views } = {}) {
  return html`<div class="timebar">
    <div class="timebar__group">
      ${segmented([
        { value: 'jahr', label: 'Jahr' },
        { value: 'quartal', label: 'Quartal' },
        { value: 'monat', label: 'Monat' }
      ], state.scale, 'scale')}
      <div class="timebar__nav">
        <button type="button" class="btn btn--square" data-act="noop" aria-label="${t('Vorheriges Quartal')}">${icons.chevronLeft()}</button>
        <button type="button" class="btn" data-act="noop">${t('Heute')}</button>
        <button type="button" class="btn btn--square" data-act="noop" aria-label="${t('Nächstes Quartal')}">${icons.chevronRight()}</button>
      </div>
    </div>
    ${views && html`<div class="timebar__group">
      ${segmented(views.map(v => ({ value: v.id, label: v.label })), state.view, 'view')}
    </div>`}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Footer + design notes
   -------------------------------------------------------------------------- */

export function appFooter() {
  const m = data.meta;
  return html`<footer class="shell-footer"><div class="wrap shell-footer__inner">
    <span>${m.version}</span>
    <span class="shell-footer__stand">${m.asOf}</span>
    <span class="shell-footer__links">
      ${m.footerLinks.map(l => html`<a href="${l.href}">${t(l.label)}</a>`)}
    </span>
  </div></footer>`;
}


/* -----------------------------------------------------------------------------
   Charts shared by the landing page and the dashboard
   -------------------------------------------------------------------------- */

/** Vertical bar chart with a 100 % reference line. */
export function columnChart(rows, { max, height = 150, refAt = 100, refLabel = '100 %', axis = true }) {
  const top = max ?? Math.max(refAt * 1.2, ...rows.map(r => r.value || 0));
  const refPct = (refAt / top) * 100;
  return html`<div class="colchart" style="--chart-h:${height}px">
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


export function phaseOf(subCode) {
  return data.phases.sub[subCode];
}

export function phaseClass(subCode) {
  const p = data.phases.sub[subCode];
  return p ? `phase-${p.main}` : 'phase-1';
}


/** Shown where a view needs more width than the window offers. */
export function tooNarrow(what) {
  return html`<div class="narrow-note">
    <p class="narrow-note__lead">${t(what)} ${t('braucht mehr Breite, als dieses Fenster bietet.')}</p>
    <p>${t('Unter 900 px ist Planung nicht sinnvoll. Die Einstiegsseite und der Verlauf sind als Lesesicht verfügbar.')}</p>
    <div class="narrow-note__actions">
      <button type="button" class="btn btn--primary" data-act="tab" data-val="start">${t('Zur Einstiegsseite')}</button>
      <button type="button" class="btn" data-act="tab" data-val="verlauf">${t('Verlauf ansehen')}</button>
    </div>
  </div>`;
}

export function toast() {
  if (!state.toast) return '';
  return html`<div class="toast" role="status">${state.toast}</div>`;
}
