/* =============================================================================
   store.js — data loading, application state, URL sync and all derived figures.

   The prototype keeps one rule: nothing that can be computed is hard-coded.
   Demand, net capacity, utilisation, free capacity, per-person load, budget
   roll-ups and milestone counts are all derived from the JSON in /data, so
   editing a pensum cell moves every number that depends on it.
   ============================================================================= */

const DATA_FILES = [
  'meta', 'phases', 'people', 'capacity', 'projects',
  'milestones', 'changes', 'dashboard', 'i18n', 'print'
];

/** Raw data, populated by load(). */
export const data = {};

/* -----------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

/*
 * The closed sets the URL and the state share. readUrl() accepts nothing else,
 * so a hand-edited hash cannot put the app into a state a view has no branch
 * for — `#?group=colour` used to reach the toolbar and throw.
 */
export const VOCAB = {
  tab:     ['start', 'overview', 'schedule', 'dashboard', 'history', 'api', 'export'],
  lang:    ['de', 'en', 'fr', 'it'],
  scale:   ['year', 'quarter', 'month'],
  unit:    ['pct', 'fte'],
  sortDir: ['asc', 'desc'],
  group:   ['portfolio', 'lead', 'phase', 'none'],
  bi:      ['general', 'people'],
  report:  ['demand', 'schedule'],
  paper:   ['a4', 'a3'],
  sheet:   ['portrait', 'landscape']
};

const DEFAULT_STATE = {
  tab: 'start',
  paper: 'a4',             // ISO size, see VOCAB.paper
  sheet: 'portrait',       // orientation, see VOCAB.sheet
  report: 'demand',        // which printed report, see VOCAB.report
  lang: 'de',
  scale: 'quarter',
  periodOffset: 0,         // how far the visible window has been stepped
  unit: 'pct',             // pct | fte
  sort: 'project',         // any key in SORT_KEYS, or q0…q7 for one quarter
  sortDir: 'asc',          // asc | desc
  group: 'portfolio',      // portfolio | lead | phase | none
  search: '',
  phases: [],              // selected SIA main phase ids, e.g. ['3','5']
  leads: [],               // selected person ids
  portfolios: [],          // selected portfolio ids
  overloadOnly: false,
  // column / attribute toggles
  cols: { id: true, phase: true, lead: true, credit: true, portfolio: false, priority: false, nextMs: false },
  ampel: true,
  trend: false,
  target: false,
  hideZeros: false,
  // editing
  edit: false,
  editing: null,           // { projectId, q }
  draft: 0,
  reason: '',
  overrides: {},           // 'projectId:q' -> value
  // transient ui
  menu: null,              // id of the open dropdown
  menuSearch: '',          // filter inside the open dropdown
  modal: null,             // { type: 'project'|'rebook', ... }
  footDetails: false,
  bi: 'general',           // dashboard section, see VOCAB.bi
  pSort: 'peak',           // person table: name | role | employment | projects | peak | q0…q7
  pDir: 'desc',
  showAll: { attention: false, milestones: false },   // landing cards, expanded
  searchOpen: false,
  collapsedGroups: {},
  toast: null
};

export const state = {
  ...DEFAULT_STATE,
  cols: { ...DEFAULT_STATE.cols },
  showAll: { ...DEFAULT_STATE.showAll }
};

const listeners = new Set();

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Merge a patch into state and re-render.
 * Pass { silent: true } as second argument to skip the URL write
 * (used by the popstate handler so we don't fight the browser).
 */
export function setState(patch, opts = {}) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  if (!opts.silent) writeUrl();
  listeners.forEach(fn => fn(state));
}

/** Close every transient overlay. Used by Escape and by outside-clicks. */
export function closeOverlays() {
  if (state.menu === null && state.modal === null && state.editing === null) return false;
  setState({ menu: null, modal: null, editing: null });
  return true;
}

/* -----------------------------------------------------------------------------
   URL <-> state.  Everything lives in the hash so the prototype works as a
   static GitHub Page: shareable, bookmarkable, and the back button behaves.
   -------------------------------------------------------------------------- */


/** A sort key is a column name or a quarter, addressed as q0…q7. */
const isSortKey = v => v in SORT_KEYS || /^q\d+$/.test(v);

export function readUrl() {
  const raw = location.hash.replace(/^#\/?\??/, '');
  const p = new URLSearchParams(raw);
  const list = k => (p.get(k) || '').split(',').filter(Boolean);
  const patch = {};

  // An unknown value is dropped rather than passed on: the default it falls
  // back to is always renderable.
  for (const [key, allowed] of Object.entries(VOCAB)) {
    const v = p.get(key === 'sortDir' ? 'dir' : key);
    if (v && allowed.includes(v)) patch[key] = v;
  }
  if (isSortKey(p.get('sort'))) patch.sort = p.get('sort');
  if (p.get('from')) patch.periodOffset = Math.max(0, Number(p.get('from')) || 0);
  if (p.has('q')) patch.search = p.get('q');
  if (p.has('phase')) patch.phases = list('phase');
  if (p.has('lead')) patch.leads = list('lead');
  if (p.has('portfolio')) patch.portfolios = list('portfolio');
  if (p.get('overload') === '1') patch.overloadOnly = true;
  if (p.get('edit') === '1') patch.edit = true;
  return patch;
}

let suppressUrl = false;

export function writeUrl() {
  if (suppressUrl) return;
  const p = new URLSearchParams();
  p.set('tab', state.tab);
  if (state.tab === 'export') p.set('sheet', state.sheet);
  if (state.tab === 'export' && state.paper !== 'a4') p.set('paper', state.paper);
  if (state.tab === 'export' && state.report !== 'demand') p.set('report', state.report);
  if (state.lang !== 'de') p.set('lang', state.lang);
  if (state.unit !== 'pct') p.set('unit', state.unit);
  if (state.scale !== 'quarter') p.set('scale', state.scale);
  if (state.periodOffset) p.set('from', String(state.periodOffset));
  if (state.sort !== 'project') p.set('sort', state.sort);
  if (state.sortDir !== 'asc') p.set('dir', state.sortDir);
  if (state.group !== 'portfolio') p.set('group', state.group);
  if (state.tab === 'dashboard' && state.bi !== 'general') p.set('bi', state.bi);
  if (state.search) p.set('q', state.search);
  if (state.phases.length) p.set('phase', state.phases.join(','));
  if (state.leads.length) p.set('lead', state.leads.join(','));
  if (state.portfolios.length) p.set('portfolio', state.portfolios.join(','));
  if (state.overloadOnly) p.set('overload', '1');
  if (state.edit) p.set('edit', '1');
  const next = '#?' + p.toString();
  if (next !== location.hash) history.replaceState(null, '', next);
}

/** Apply the URL to state without writing it back. */
export function syncFromUrl() {
  suppressUrl = true;
  setState(readUrl(), { silent: true });
  suppressUrl = false;
}

/* -----------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

export async function load() {
  const loaded = await Promise.all(
    DATA_FILES.map(async name => {
      const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`data/${name}.json — HTTP ${res.status}`);
      return [name, await res.json()];
    })
  );
  loaded.forEach(([name, json]) => { data[name] = json; });

  // Index lookups used all over the views.
  data.peopleById = Object.fromEntries(data.people.map(p => [p.id, p]));
  data.projectsById = Object.fromEntries(data.projects.map(p => [p.id, p]));
  data.portfoliosById = Object.fromEntries(data.meta.portfolios.map(p => [p.id, p]));
  data.quarters = data.meta.quarters;
  data.quarterIndex = Object.fromEntries(data.quarters.map((q, i) => [q.id, i]));

  // Grouped once here rather than scanned per row in four different views.
  data.milestonesByProject = groupBy(data.milestones.items, m => m.projectId);
  data.projectsByLead = groupBy(data.projects, p => p.leadId ?? 'none');
  data.milestoneCatalog = Object.fromEntries(data.milestones.catalog.map(c => [c.code, c]));
  return data;
}

/** Bucket a list by a key, preserving the order within each bucket. */
function groupBy(list, keyOf) {
  const out = {};
  for (const item of list) (out[keyOf(item)] ??= []).push(item);
  return out;
}

/* -----------------------------------------------------------------------------
   i18n — the mockup translates by looking up the German string.
   -------------------------------------------------------------------------- */

/*
 * The German string is the key and its own source; the file stores one entry
 * per term with every target beside it, so a translator never holds four files
 * open at once. An untranslated term falls back to the German rather than to a
 * blank or a key.
 */
export function t(de) {
  if (state.lang === 'de' || !data.i18n) return de;
  return data.i18n.terms?.[de]?.[state.lang] ?? de;
}

/* -----------------------------------------------------------------------------
   Number formatting.  Swiss convention: a space before the percent sign,
   comma as the decimal separator.
   -------------------------------------------------------------------------- */

export function num(v) {
  return state.unit === 'fte' ? (v / 100).toFixed(2).replace('.', ',') : String(Math.round(v));
}

export function unitSuffix() {
  return state.unit === 'fte' ? ' FTE' : ' %';
}

export function fmt(v) {
  return num(v) + unitSuffix();
}

export function fmtMio(v) {
  return v == null ? '—' : v.toFixed(1).replace('.', ',') + ' Mio.';
}

/* -----------------------------------------------------------------------------
   Derived: pensum values with pending edits applied
   -------------------------------------------------------------------------- */

export function cellValue(project, q) {
  const o = state.overrides[`${project.id}:${q}`];
  return o === undefined ? project.demand[q] : o;
}

export function projectDemand(project) {
  return project.demand.map((_, q) => cellValue(project, q));
}

export function isEdited(project, q) {
  return state.overrides[`${project.id}:${q}`] !== undefined;
}

/** Total pensum delta a person carries from unsaved edits, in load points. */
export function loadDelta(personId, q) {
  const person = data.peopleById[personId];
  if (!person) return 0;
  let delta = 0;
  for (const p of data.projectsByLead[personId] ?? []) {
    const o = state.overrides[`${p.id}:${q}`];
    if (o !== undefined) delta += (o - p.demand[q]) / person.employment * 100;
  }
  return delta;
}

/** A person's booked pensum in a quarter, including unsaved edits. */
export function personLoad(personId, q) {
  const person = data.peopleById[personId];
  if (!person) return null;
  return Math.round(person.baseLoad[q] + loadDelta(personId, q));
}

/** A person's utilisation against their own contracted percentage. */
export function personUtilisation(personId, q) {
  const person = data.peopleById[personId];
  if (!person) return null;
  return Math.round(personLoad(personId, q) / person.employment * 100);
}

/* -----------------------------------------------------------------------------
   Derived: capacity roll-ups over the currently filtered project set
   -------------------------------------------------------------------------- */

export function netCapacity(q) {
  return data.capacity.gross[q] - data.capacity.absence[q];
}

/**
 * Demand is a property of the selection; capacity is a property of the
 * department. A ratio of one against the other only means something when both
 * describe the same people — so utilisation, free capacity and everything else
 * on the capacity side is always the whole portfolio. Filtering the view does
 * not change how busy the division is, and a filtered numerator over an
 * unfiltered denominator produced figures like «−2 %».
 */
export function totals(projects = filteredProjects()) {
  const qs = data.quarters.map((_, i) => i);
  const sum = (list, q) => list.reduce((a, p) => a + cellValue(p, q), 0);

  const demand = qs.map(q => sum(projects, q));
  const preCredit = qs.map(q => sum(projects.filter(p => p.preCredit), q));

  const external = data.capacity.external;
  const net = qs.map(netCapacity);
  const portfolio = qs.map(q => sum(data.projects, q));
  const booked = qs.map(q => portfolio[q] - external[q]);
  const utilisation = qs.map(q => Math.round(booked[q] / net[q] * 100));
  const free = qs.map(q => net[q] - booked[q]);

  return {
    demand, preCredit, external, net, booked, utilisation, free, portfolio,
    // True when the demand row describes fewer projects than the capacity row.
    scoped: projects.length !== data.projects.length
  };
}

/**
 * Capacity status, identical wording in every tab.
 * The four words frei / ok / knapp / Überlast are part of the design system.
 */
export function loadStatus(pct) {
  if (pct > 100) return { key: 'danger', label: 'Überlast' };
  if (pct >= 95) return { key: 'warn', label: 'knapp' };
  if (pct >= 80) return { key: 'ok', label: 'ok' };
  return { key: 'neutral', label: 'frei' };
}

/** Heat step for a pensum value — blue encodes size only, never status. */
export function heatStep(v) {
  if (v == null) return 'null';
  if (v < 0) return 'neg';
  if (v === 0) return '0';
  if (v < 40) return '1';
  if (v < 80) return '2';
  if (v < 120) return '3';
  return '4';
}

/** Traffic light for the row's project lead, based on the current quarter. */
export function ampel(personId, q = 0) {
  const person = data.peopleById[personId];
  if (!person) {
    return { key: 'none', word: 'ohne Projektleitung', title: 'Keine Projektleitung zugewiesen — keine Ampel' };
  }
  const pct = personUtilisation(personId, q);
  const key = pct > 100 ? 'over' : pct >= 95 ? 'tight' : 'ok';
  const word = key === 'over' ? 'Überlast' : key === 'tight' ? 'knapp' : 'im Rahmen';
  const label = data.quarters[q].label;
  return { key, pct, word, title: `${person.name}: ${pct} % der Anstellung in ${label} — ${word}` };
}

/**
 * A SIA sub-phase by its code. An unknown code returns a stand-in rather than
 * undefined, so one bad record cannot take a whole view down.
 */
export function phaseOf(subCode) {
  return data.phases.sub[subCode] ?? { label: String(subCode ?? '—'), main: null };
}

/* -----------------------------------------------------------------------------
   Derived: filtering, sorting, grouping
   -------------------------------------------------------------------------- */

export function filteredProjects() {
  const q = state.search.trim().toLowerCase();
  let list = data.projects.filter(p => {
    if (state.phases.length && !state.phases.includes(p.phase[0])) return false;
    if (state.leads.length) {
      const key = p.leadId ?? 'none';
      if (!state.leads.includes(key)) return false;
    }
    if (state.portfolios.length && !state.portfolios.includes(p.portfolio)) return false;
    if (state.overloadOnly) {
      if (!p.leadId) return false;
      const over = data.quarters.some((_, i) => personUtilisation(p.leadId, i) > 100);
      if (!over) return false;
    }
    if (q) {
      const lead = p.leadId ? data.peopleById[p.leadId].name : 'nicht zugewiesen';
      const hay = `${p.title} ${p.number} ${lead} ${p.kind}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return sortProjects(list);
}

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/**
 * The columns the grid actually shows.
 *
 * A pensum is a *rate*, not a total: 80 % in Q3 means 80 % of that person's
 * time throughout Q3. So a month inside a quarter carries the same number, and
 * a year is the average of its quarters — never their sum.
 *
 * Every column also carries `from` and `to`: the slice of the quarter axis it
 * covers, as a fractional quarter index. At month scale three columns share one
 * quarter and each covers a third of it, which `quarters` alone cannot say —
 * and without it the today marker cannot be placed.
 */
export function periods() {
  return markYears(buildPeriods());
}

/**
 * A year starts wherever a column's year differs from the one before it. Both
 * grids draw their separator from this, so they cannot disagree — and it stays
 * right at every scale and wherever the window has been stepped to.
 */
function markYears(cols) {
  let previous = null;
  return cols.map(col => {
    const year = data.quarters[col.quarters[0]].year;
    const yearStart = previous === null || year !== previous;
    previous = year;
    return { ...col, year, yearStart };
  });
}

function buildPeriods() {
  const qs = data.quarters;
  const off = state.periodOffset;

  if (state.scale === 'year') {
    const years = [...new Set(qs.map(q => q.year))];
    return years.map(year => {
      const idx = qs.map((q, i) => (q.year === year ? i : -1)).filter(i => i >= 0);
      return {
        id: String(year), label: String(year), short: String(year),
        quarters: idx, isNow: idx.includes(0),
        from: idx[0], to: idx[idx.length - 1] + 1
      };
    });
  }

  if (state.scale === 'month') {
    const out = [];
    // Twelve months, stepped a quarter at a time.
    const start = Math.max(0, Math.min(off, qs.length - 4));
    for (let n = 0; n < 12; n++) {
      const qi = start + Math.floor(n / 3);
      if (qi >= qs.length) break;
      const q = qs[qi];
      const month = (Number(q.short.slice(1)) - 1) * 3 + (n % 3);
      const slice = n % 3;
      out.push({
        id: `${q.year}-${month + 1}`,
        label: `${MONTHS_DE[month]} ${q.year}`,
        short: `${MONTHS_DE[month]} ${String(q.year).slice(2)}`,
        quarters: [qi],
        isNow: qi === 0 && month === new Date(data.meta.today + 'T00:00:00').getMonth(),
        from: qi + slice / 3, to: qi + (slice + 1) / 3
      });
    }
    return out;
  }

  const start = Math.max(0, Math.min(off, qs.length - 1));
  return qs.slice(start).map((q, n) => ({
    id: q.id, label: q.label,
    short: `${q.short} ${String(q.year).slice(2)}`,
    quarters: [start + n], isNow: start + n === 0,
    from: start + n, to: start + n + 1
  }));
}

/**
 * Period objects for an arbitrary run of quarters. The printed sheets work in
 * quarter blocks rather than in the window the toolbar has scrolled to, and
 * everything that draws a time axis expects periods, not indices.
 */
export function quarterPeriods(from, count) {
  const cols = data.quarters.slice(from, from + count).map((q, n) => ({
    id: q.id, label: q.label,
    short: `${q.short} ${String(q.year).slice(2)}`,
    quarters: [from + n], isNow: from + n === 0,
    from: from + n, to: from + n + 1
  }));
  return markYears(cols);
}

/** A rate over several quarters is their average, rounded. */
export function periodValue(values, period) {
  const picked = period.quarters.map(i => values[i]).filter(v => v != null);
  if (!picked.length) return 0;
  return Math.round(picked.reduce((a, b) => a + b, 0) / picked.length);
}

/**
 * Is there time outside the visible window, and on which side? The arrows move
 * the window and the card scrolls inside it; both hide periods, and the reader
 * is owed the same signal either way.
 *
 * Returned as an attribute fragment so a card can carry it without the view
 * having to spell the two flags out.
 */
export function windowEdges(cols = periods()) {
  const first = cols[0]?.quarters[0] ?? 0;
  const last = cols.at(-1)?.quarters.at(-1) ?? 0;
  return { before: first > 0, after: last < data.quarters.length - 1 };
}

/** How many quarters the window can still be stepped. */
export function canStep(dir) {
  const max = data.quarters.length - (state.scale === 'year' ? data.quarters.length : 1);
  return dir < 0 ? state.periodOffset > 0 : state.periodOffset < max;
}

/**
 * One sort key per column, so the header and the dropdown drive the same state.
 * A quarter is addressed as q0…q7.
 */
export const SORT_KEYS = {
  id:        { label: 'ID', numeric: false, value: p => p.number },
  project:   { label: 'Projekt', numeric: false, value: p => p.title },
  phase:     { label: 'SIA-Phase', numeric: false, value: p => p.phase },
  lead:      { label: 'Projektleitung', numeric: false, value: p => (p.leadId ? data.peopleById[p.leadId].name : '\uffff') },
  portfolio: { label: 'Teilportfolio', numeric: false, value: p => data.portfoliosById[p.portfolio].label },
  priority:  { label: 'Priorität', numeric: true, value: p => ({ hoch: 3, mittel: 2, tief: 1 })[p.priority] ?? 0 },
  credit:    { label: 'Kredit CHF', numeric: true, value: p => p.credit ?? -1 },
  target:    { label: 'Soll-Pensum', numeric: true, value: p => p.target }
};

/** Resolve a sort key, including the per-quarter ones. */
export function sortKey(key = state.sort) {
  const q = /^q(\d+)$/.exec(key);
  if (q) {
    const i = Number(q[1]);
    return { label: data.quarters[i]?.label ?? key, numeric: true, value: p => cellValue(p, i) };
  }
  return SORT_KEYS[key] ?? SORT_KEYS.project;
}

/** Numbers read high-to-low by default, names A–Z. */
export const defaultDir = key => (sortKey(key).numeric ? 'desc' : 'asc');

/** One collator for the whole app: localeCompare builds a fresh one per call. */
const collator = new Intl.Collator('de');

export function sortProjects(list) {
  const { numeric, value } = sortKey();
  const sign = state.sortDir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    const cmp = numeric ? x - y : collator.compare(String(x), String(y));
    return cmp * sign;
  });
}

/** Group the filtered projects for the grid and the gantt. */
export function groupProjects(list = filteredProjects()) {
  if (state.group === 'none') return [{ key: 'all', label: null, projects: list }];

  const keyOf = p => {
    if (state.group === 'lead') return p.leadId ?? 'none';
    if (state.group === 'phase') return p.phase[0];
    return p.portfolio;
  };
  const labelOf = key => {
    if (state.group === 'lead') {
      return key === 'none' ? `(${t('nicht zugewiesen')})` : (data.peopleById[key]?.name ?? key);
    }
    if (state.group === 'phase') {
      return t(data.phases.main.find(m => m.id === key)?.label ?? key);
    }
    return t(data.portfoliosById[key]?.label ?? key);
  };

  const buckets = new Map();
  for (const p of list) {
    const k = keyOf(p);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p);
  }
  // Keep people in roster order, phases in SIA order, portfolios in data order.
  const order = state.group === 'lead'
    ? [...data.people.map(p => p.id), 'none']
    : state.group === 'phase'
      ? data.phases.main.map(m => m.id)
      : data.meta.portfolios.map(p => p.id);

  return order
    .filter(k => buckets.has(k))
    .map(k => ({ key: k, label: labelOf(k), projects: buckets.get(k) }));
}

/** Active filter chips, in the order the toolbar declares them. */
export function activeFilters() {
  const chips = [];
  state.phases.forEach(id => {
    const m = data.phases.main.find(x => x.id === id);
    if (m) chips.push({ kind: 'phase', id, label: `Phase ${m.label}` });
  });
  state.leads.forEach(id => {
    const label = id === 'none' ? 'nicht zugewiesen' : data.peopleById[id]?.name;
    if (label) chips.push({ kind: 'lead', id, label });
  });
  state.portfolios.forEach(id => {
    const p = data.portfoliosById[id];
    if (p) chips.push({ kind: 'portfolio', id, label: p.label });
  });
  if (state.overloadOnly) chips.push({ kind: 'overload', id: '1', label: 'Nur Überlast' });
  if (state.search) chips.push({ kind: 'search', id: '1', label: `Suche: ${state.search}` });
  return chips;
}

export function removeFilter(kind, id) {
  const drop = arr => arr.filter(x => x !== id);
  if (kind === 'phase') setState({ phases: drop(state.phases) });
  else if (kind === 'lead') setState({ leads: drop(state.leads) });
  else if (kind === 'portfolio') setState({ portfolios: drop(state.portfolios) });
  else if (kind === 'overload') setState({ overloadOnly: false });
  else if (kind === 'search') setState({ search: '' });
}

export function resetFilters() {
  setState({ phases: [], leads: [], portfolios: [], overloadOnly: false, search: '' });
}

export function toggleIn(key, id) {
  const arr = state[key];
  setState({ [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] });
}

/* -----------------------------------------------------------------------------
   Derived: milestones
   -------------------------------------------------------------------------- */

export function milestones() {
  const projectIds = new Set(filteredProjects().map(p => p.id));
  return data.milestones.items
    .filter(m => projectIds.has(m.projectId))
    .map(m => {
      const project = data.projectsById[m.projectId];
      const cat = data.milestoneCatalog[m.code];
      return {
        ...m,
        project,
        name: cat?.name ?? m.code,
        short: cat?.short ?? m.code,
        lead: project.leadId ? data.peopleById[project.leadId] : null,
        planIdx: data.quarterIndex[m.plan],
        forecastIdx: m.forecast ? data.quarterIndex[m.forecast] : null
      };
    })
    .sort((a, b) => a.planDate.localeCompare(b.planDate) || a.code.localeCompare(b.code));
}

export function milestoneStats() {
  const all = data.milestones.items;
  return {
    total: all.length,
    onTime: all.filter(m => m.status === 'ok').length,
    late: all.filter(m => m.status === 'late').length,
    open: all.filter(m => m.forecast === null).length
  };
}

/* -----------------------------------------------------------------------------
   Derived: the KPI strip, shared by every tab
   -------------------------------------------------------------------------- */

/**
 * Everything the person table shows, in one place: the load a person carries in
 * each period against their own contract, plus the peak — which is the answer a
 * single quarter cannot give.
 */
export function personRows() {
  const cols = periods();
  return data.people.map(person => {
    const values = cols.map(col =>
      Math.round(periodValue(person.baseLoad, col) / person.employment * 100));
    const leads = data.projectsByLead[person.id]?.length ?? 0;
    return {
      person, values, leads,
      peak: leads ? Math.max(...values) : null,
      now: values[0]
    };
  });
}

/** Sorters for the person table, one per column the header offers. */
export const P_SORTS = {
  name: r => r.person.name,
  role: r => r.person.role,
  employment: r => r.person.employment,
  projects: r => r.leads,
  peak: r => r.peak ?? -1
};

export function sortPersonRows(rows) {
  const q = /^q(\d+)$/.exec(state.pSort);
  const value = q ? (r => r.values[Number(q[1])] ?? -1) : (P_SORTS[state.pSort] ?? P_SORTS.peak);
  const dir = state.pDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b);
    return (typeof x === 'string' ? collator.compare(x, y) : x - y) * dir;
  });
}

export function kpis() {
  const list = filteredProjects();
  const tot = totals(list);
  const credit = list.reduce((a, p) => a + (p.credit ?? 0), 0);
  const peak = data.dashboard.creditByYear.rows.reduce((a, r) => (r.value > a.value ? r : a));
  const over = data.people.filter(p => personLoad(p.id, 0) > 100)
    .sort((a, b) => personUtilisation(b.id, 0) - personUtilisation(a.id, 0));
  const overQuarters = tot.utilisation.filter(v => v > 100).length;
  const lastOver = tot.utilisation.reduce((last, v, i) => (v > 100 ? i : last), -1);
  const unassigned = list.filter(p => !p.leadId);
  const unassignedDemand = unassigned.reduce((a, p) => a + Math.max(...projectDemand(p)), 0);
  const unassignedStart = unassigned.length
    ? data.quarters[projectDemand(unassigned[0]).findIndex(v => v > 0)]?.label
    : null;

  return {
    credit: {
      label: 'Gebundene Kredite CHF',
      value: fmtMio(credit).replace(' Mio.', ' Mio.'),
      note: `Spitzenjahr ${peak.label}: ${peak.valueLabel} — trifft die Überlastquartale`,
      alert: false
    },
    utilisation: {
      label: 'Auslastung',
      value: `${tot.utilisation[0]} %`,
      note: `${tot.portfolio[0]} % Bedarf auf ${tot.net[0]} % netto · ` + (lastOver >= 0
        ? `Überlast bis ${data.quarters[lastOver].label}`
        : 'keine Überlast im Zeitraum'),
      alert: tot.utilisation[0] > 100
    },
    people: {
      label: 'Personen über 100 %',
      value: `${over.length} von ${data.people.length}`,
      // Three names give the note a face; a list of twenty is a wall.
      note: over.length
        ? '▲ ' + over.slice(0, 3).map(p => `${p.shortName} ${personLoad(p.id, 0)}`).join(' · ')
        : 'alle innerhalb der Anstellung',
      more: over.length > 3
        ? { label: `${over.length - 3} weitere`, act: 'scroll-to', val: 'card-people' }
        : null,
      alert: over.length > 0
    },
    unassigned: {
      label: 'Nicht zugewiesener Bedarf',
      value: `${unassignedDemand} %`,
      note: unassigned.length
        ? `${unassigned[0].location.split(',').pop().trim()}, ab ${unassignedStart}`
        : 'alles zugewiesen',
      alert: false
    },
    overQuarters,
    overPeople: over
  };
}
