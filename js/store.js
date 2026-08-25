/* =============================================================================
   store.js — data loading, application state, URL sync and all derived figures.

   The prototype keeps one rule: nothing that can be computed is hard-coded.
   Demand, net capacity, utilisation, free capacity, per-person load, budget
   roll-ups and milestone counts are all derived from the JSON in /data, so
   editing a pensum cell moves every number that depends on it.
   ============================================================================= */

const DATA_FILES = [
  'meta', 'phases', 'people', 'capacity', 'projects',
  'milestones', 'changes', 'dashboard', 'i18n', 'api'
];

/** Raw data, populated by load(). */
export const data = {};

/* -----------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

const DEFAULT_STATE = {
  tab: 'start',            // start | uebersicht | termine | dashboard | verlauf | api | export
  view: 'gantt',           // termine sub-view: gantt | liste | kalender
  sheet: 'hoch',           // print layout: hoch | quer
  lang: 'de',              // de | en
  scale: 'quartal',        // jahr | quartal | monat
  unit: 'pct',             // pct | fte
  sort: 'projekt',         // any key in SORT_KEYS, or q0…q7 for one quarter
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
  searchOpen: { header: false, toolbar: false },   // the two fields open independently
  collapsedGroups: {},
  toast: null,
  narrow: false          // < 900px: planning grids are not usable
};

export const state = {
  ...DEFAULT_STATE,
  cols: { ...DEFAULT_STATE.cols },
  searchOpen: { ...DEFAULT_STATE.searchOpen }
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


export function readUrl() {
  const raw = location.hash.replace(/^#\/?\??/, '');
  const p = new URLSearchParams(raw);
  const list = k => (p.get(k) || '').split(',').filter(Boolean);
  const patch = {};
  if (p.get('tab')) patch.tab = p.get('tab');
  if (p.get('view')) patch.view = p.get('view');
  if (p.get('sheet')) patch.sheet = p.get('sheet');
  if (p.get('lang')) patch.lang = p.get('lang');
  if (p.get('unit')) patch.unit = p.get('unit');
  if (p.get('scale')) patch.scale = p.get('scale');
  if (p.get('sort')) patch.sort = p.get('sort');
  if (p.get('dir')) patch.sortDir = p.get('dir');
  if (p.get('group')) patch.group = p.get('group');
  if (p.has('q')) patch.search = p.get('q');
  if (p.has('phase')) patch.phases = list('phase');
  if (p.has('lead')) patch.leads = list('lead');
  if (p.has('teilportfolio')) patch.portfolios = list('teilportfolio');
  if (p.get('ueberlast') === '1') patch.overloadOnly = true;
  if (p.get('edit') === '1') patch.edit = true;
  return patch;
}

let suppressUrl = false;

export function writeUrl() {
  if (suppressUrl) return;
  const p = new URLSearchParams();
  p.set('tab', state.tab);
  if (state.tab === 'termine') p.set('view', state.view);
  if (state.tab === 'export') p.set('sheet', state.sheet);
  if (state.lang !== 'de') p.set('lang', state.lang);
  if (state.unit !== 'pct') p.set('unit', state.unit);
  if (state.scale !== 'quartal') p.set('scale', state.scale);
  if (state.sort !== 'projekt') p.set('sort', state.sort);
  if (state.sortDir !== 'asc') p.set('dir', state.sortDir);
  if (state.group !== 'portfolio') p.set('group', state.group);
  if (state.search) p.set('q', state.search);
  if (state.phases.length) p.set('phase', state.phases.join(','));
  if (state.leads.length) p.set('lead', state.leads.join(','));
  if (state.portfolios.length) p.set('teilportfolio', state.portfolios.join(','));
  if (state.overloadOnly) p.set('ueberlast', '1');
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
  return data;
}

/* -----------------------------------------------------------------------------
   i18n — the mockup translates by looking up the German string.
   -------------------------------------------------------------------------- */

export function t(de) {
  if (state.lang === 'de' || !data.i18n) return de;
  return data.i18n[state.lang]?.[de] ?? de;
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
  for (const p of data.projects) {
    if (p.leadId !== personId) continue;
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

export function totals(projects = filteredProjects()) {
  const qs = data.quarters.map((_, i) => i);
  const demand = qs.map(q => projects.reduce((a, p) => a + cellValue(p, q), 0));
  const preCredit = qs.map(q => projects.filter(p => p.preCredit).reduce((a, p) => a + cellValue(p, q), 0));
  const external = data.capacity.external;
  const net = qs.map(netCapacity);
  const booked = qs.map(q => demand[q] - external[q]);
  const utilisation = qs.map(q => Math.round(booked[q] / net[q] * 100));
  const free = qs.map(q => net[q] - booked[q]);
  return { demand, preCredit, external, net, booked, utilisation, free };
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
  if (!personId) return { key: 'none', title: 'Keine Projektleitung zugewiesen — keine Ampel' };
  const person = data.peopleById[personId];
  const pct = personUtilisation(personId, q);
  const key = pct > 100 ? 'over' : pct >= 95 ? 'tight' : 'ok';
  const word = key === 'over' ? 'Überlast' : key === 'tight' ? 'knapp' : 'im Rahmen';
  const label = data.quarters[q].label;
  return { key, pct, title: `${person.name}: ${pct} % der Anstellung in ${label} — ${word}` };
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

/**
 * One sort key per column, so the header and the dropdown drive the same state.
 * A quarter is addressed as q0…q7.
 */
export const SORT_KEYS = {
  id:        { label: 'ID', numeric: false, value: p => p.number },
  projekt:   { label: 'Projekt', numeric: false, value: p => p.title },
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
  return SORT_KEYS[key] ?? SORT_KEYS.projekt;
}

/** Numbers read high-to-low by default, names A–Z. */
export const defaultDir = key => (sortKey(key).numeric ? 'desc' : 'asc');

export function sortProjects(list) {
  const { numeric, value } = sortKey();
  const sign = state.sortDir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    const cmp = numeric ? x - y : String(x).localeCompare(String(y), 'de');
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
      return key === 'none' ? '(nicht zugewiesen)' : data.peopleById[key].name;
    }
    if (state.group === 'phase') {
      return data.phases.main.find(m => m.id === key)?.label ?? key;
    }
    return data.portfoliosById[key]?.label ?? key;
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
      const cat = data.milestones.catalog.find(c => c.code === m.code);
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

export function kpis() {
  const list = filteredProjects();
  const tot = totals(list);
  const credit = list.reduce((a, p) => a + (p.credit ?? 0), 0);
  const peak = data.dashboard.creditByYear.rows.reduce((a, r) => (r.value > a.value ? r : a));
  const over = data.people.filter(p => personLoad(p.id, 0) > 100);
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
      note: `${tot.demand[0]} % Bedarf auf ${tot.net[0]} % netto · ` + (lastOver >= 0
        ? `Überlast bis ${data.quarters[lastOver].label}`
        : 'keine Überlast im Zeitraum'),
      alert: tot.utilisation[0] > 100
    },
    people: {
      label: 'Personen über 100 %',
      value: `${over.length} von ${data.people.length}`,
      note: over.length
        ? '▲ ' + over.map(p => `${p.shortName} ${personLoad(p.id, 0)}`).join(' · ')
        : 'alle innerhalb der Anstellung',
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
