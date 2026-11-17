/* =============================================================================
   check.mjs — the checks this repository can run on itself.

     node tools/check.mjs

   No browser, no dependencies. It loads js/store.js the way the app does —
   through fetch, here answered from disk — and asserts what every view takes
   for granted: that the fixtures are whole, that the derived figures are the
   sums they claim to be, that an edit moves them, and that the URL reads back
   what it wrote. It also reads the modules as text for the two mistakes a
   static site has nobody else to catch: a German string with no translation
   entry, and a control whose action does not exist.

   Node 22.7 or later: js/ is ES modules in plain .js files with no
   package.json, which older versions refuse to import.
   ============================================================================= */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');

/* The three globals store.js touches, and only when called. */
globalThis.fetch = async url => ({ ok: true, status: 200, json: async () => JSON.parse(read(url)) });
globalThis.location = { hash: '' };
globalThis.history = {
  replaceState: (_state, _title, hash) => { location.hash = hash; },
  pushState: (_state, _title, hash) => { location.hash = hash; }
};

const store = await import('../js/store.js').catch(error => {
  console.error('js/store.js could not be imported — this check needs Node 22.7 or later.\n', error.message);
  process.exit(2);
});
const { data, state } = store;

let failed = 0;
let section = '';
const group = name => { section = name; };
function check(what, ok, detail = '') {
  if (ok) return;
  failed++;
  console.error(`✗ ${section}: ${what}${detail ? ` — ${detail}` : ''}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

await store.load();
const Q = data.quarters.length;

/* -----------------------------------------------------------------------------
   The fixtures
   -------------------------------------------------------------------------- */

group('data');
check('quarters', Q > 0 && data.quarterIndex[data.meta.todayQuarter] !== undefined, 'todayQuarter is not in meta.quarters');
for (const key of ['gross', 'absence', 'external']) {
  check(`capacity.${key} has one figure per quarter`, data.capacity[key].length === Q, `${data.capacity[key].length} ≠ ${Q}`);
}
check('roles: at least one can carry a project', store.roleCatalog().some(r => r.lead));
for (const o of data.meta.organisations) {
  check(`organisation ${o.id} names the role its people hold`, !!data.rolesById[o.role], String(o.role));
}
for (const person of data.people) {
  check(`${person.id} belongs to a known organisation`, !!data.organisationsById[person.organisation], person.organisation);
  /* The function a person works in is the role of their unit, by its label. */
  check(`${person.id}: the function is the unit's role`,
    person.role === data.rolesById[data.organisationsById[person.organisation]?.role]?.label, person.role);
  check(`${person.id} has a contract`, person.employment > 0 && person.employment <= 100, String(person.employment));
}
for (const p of data.projects) {
  const seen = new Set();
  check(`${p.id} is in a known portfolio`, !!data.portfoliosById[p.portfolio], p.portfolio);
  check(`${p.id} is in a known phase`, data.phases.eppm.some(e => e.id === p.phase), p.phase);
  for (const a of p.assignees) {
    const key = store.laneKey(a);
    check(`${p.id} ${key}: role exists`, !!data.rolesById[a.role], a.role);
    check(`${p.id} ${key}: person exists or is null`, a.person === null || !!data.peopleById[a.person], String(a.person));
    check(`${p.id} ${key}: one row per role and person`, !seen.has(key));
    seen.add(key);
    check(`${p.id} ${key}: a pensum per quarter`, a.demand.length === Q, `${a.demand.length} ≠ ${Q}`);
    check(`${p.id} ${key}: pensa are whole steps of five, not negative`, a.demand.every(v => Number.isInteger(v) && v >= 0 && v % 5 === 0));
    check(`${p.id} ${key}: the row says something`, !!a.person || a.demand.some(v => v > 0), 'nobody and nothing');
    /* A role is a function of the house: whoever holds it sits in a unit that does that work. */
    check(`${p.id} ${key}: held by somebody of the role's own units`,
      !a.person || data.organisationsById[data.peopleById[a.person]?.organisation]?.role === a.role);
  }
  const order = p.assignees.map(a => store.roleCatalog().findIndex(r => r.id === a.role));
  check(`${p.id}: rows in the catalogue's order`, order.every((v, i) => i === 0 || order[i - 1] <= v));
}
for (const m of data.milestones.items) {
  check(`milestone ${m.id} belongs to a project`, !!data.projectsById[m.projectId], m.projectId);
  check(`milestone ${m.id} is in the catalogue`, !!data.milestoneCatalog[m.code], m.code);
  /* The tooltip reads the plan quarter's label without asking whether there is one. */
  check(`milestone ${m.id} is planned in a known quarter`, data.quarterIndex[m.plan] !== undefined, m.plan);
  check(`milestone ${m.id} is forecast in a known quarter, or open`, m.forecast === null || data.quarterIndex[m.forecast] !== undefined, String(m.forecast));
  check(`milestone ${m.id}: open means pending`, (m.forecast === null) === (m.status === 'pending'));
  check(`milestone ${m.id}: a gate that is held has one date`, m.status !== 'ok' || m.forecastDate === m.planDate, `${m.planDate} / ${m.forecastDate}`);
  check(`milestone ${m.id}: forecast not before plan`, !m.forecastDate || m.forecastDate >= m.planDate, `${m.planDate} / ${m.forecastDate}`);
}
check('milestones: ids are unique', new Set(data.milestones.items.map(m => m.id)).size === data.milestones.items.length);
for (const c of data.changes) {
  check(`change ${c.id} belongs to a project or to none`, c.projectId == null || !!data.projectsById[c.projectId], String(c.projectId));
}
check('changes: ids are unique', new Set(data.changes.map(c => c.id)).size === data.changes.length);
/* Verlauf prints the file's order. */
check('changes: newest first', data.changes.every((c, i) => i === 0 || data.changes[i - 1].date >= c.date));
check('changes: an entry changes something', !data.changes.some(c => /^(\d+) % → \1 %$/.test(c.value)));

/* -----------------------------------------------------------------------------
   What is derived from them
   -------------------------------------------------------------------------- */

group('derived');
const now = store.nowIndex();
for (const p of data.projects) {
  const sum = data.quarters.map((_, q) => p.assignees.reduce((a, x) => a + x.demand[q], 0));
  check(`${p.id}: demand is the sum over its rows`, same(p.demand, sum));
  /* The lead is on the row of a carrying role — PPE or PM — with the largest
     pensum now; nobody of another role is ever it. */
  const carrying = p.assignees.filter(a => store.roleOf(a.role).lead);
  const top = Math.max(0, ...carrying.map(a => a.demand[now]));
  const lane = store.leadLane(p);
  check(`${p.id}: the lead is on a carrying role`, carrying.length ? carrying.includes(lane) : lane === null);
  if (top > 0) check(`${p.id}: the lead has the largest pensum of the carrying roles now`, lane.demand[now] === top, `${lane.demand[now]} ≠ ${top}`);
  check(`${p.id}: leadId is the person on that row`, p.leadId === (lane?.person ?? null));
  check(`${p.id}: unassigned says there is no lead`, p.unassigned === !p.leadId);
  check(`${p.id}: its organisation is the lead's, a unit that carries projects`,
    p.organisation === (data.peopleById[p.leadId]?.organisation ?? null) && (!p.organisation || store.carriesProjects(p.organisation)));
}
/* A role is written out as its name and its short form — «Projektmanagement
   PM» — whether a row hands it over or the data carries its label. */
for (const role of store.roleCatalog()) {
  check(`role ${role.id} is written out with its short form`,
    store.roleName(role) === `${role.label} ${role.short}` && store.labelName(role.label) === store.roleName(role), store.roleName(role));
}
check('a label that is not a role stays the plain word', store.labelName('Pensum') === 'Pensum');
{
  const load = Object.fromEntries(data.people.map(x => [x.id, data.quarters.map(() => 0)]));
  for (const p of data.projects) for (const a of p.assignees) if (a.person) a.demand.forEach((v, q) => { load[a.person][q] += v; });
  check('personLoad is the sum of a person\'s rows',
    data.people.every(x => data.quarters.every((_, q) => store.personLoad(x.id, q) === load[x.id][q])));
  const tot = store.totals();
  check('totals: demand is the portfolio when nothing is filtered', same(tot.demand, tot.portfolio));
  check('totals: utilisation is a number in every quarter', tot.utilisation.every(Number.isFinite));
}
{
  const groups = store.groupProjects();
  const ids = groups.flatMap(g => g.projects.map(p => p.id));
  check('groups: every project in exactly one', ids.length === data.projects.length && new Set(ids).size === ids.length);
  check('groups: small before large before open',
    same(groups.map(g => g.key), ['small', 'large', 'open'].filter(k => groups.some(g => g.key === k))));
  const line = data.meta.settings.smallProjectMio;
  check('groups: split on the credit',
    groups.every(g => g.projects.every(p => (g.key === 'open' ? p.credit == null : g.key === 'small' ? p.credit <= line : p.credit > line))));
}
for (const scale of ['year', 'quarter', 'month']) {
  store.setState({ scale, periodOffset: 0 });
  const cols = store.periods();
  check(`${scale}: there are columns, and one of them is now`, cols.length > 0 && cols.filter(c => c.isNow).length === 1);
  check(`${scale}: every column names real quarters`, cols.every(c => c.quarters.every(q => q >= 0 && q < Q)));
}
store.setState({ scale: 'quarter' });

/* -----------------------------------------------------------------------------
   Edits — the one write the grid makes: a pensum typed into a cell
   -------------------------------------------------------------------------- */

group('edits');
{
  const p = data.projects.find(x => x.assignees.length >= 2 && x.assignees[0].person);
  const before = structuredClone(p.assignees);
  const rows = p.assignees.length;
  const total = p.demand.reduce((a, v) => a + v, 0);
  const [first] = p.assignees;

  /* A typed figure moves the sum and the person's load. */
  const was = store.personLoad(first.person, now);
  first.demand[now] += 10;
  store.recomputeDemand(p);
  store.touch();
  check('a typed figure moves the project\'s demand', p.demand.reduce((a, v) => a + v, 0) === total + 10);
  check('…and the person\'s load', store.personLoad(first.person, now) === was + 10);
  check('…and is found again by role and person', store.laneOf(p, first.role, store.holderKey(first)) === first);

  /* A row emptied to the last quarter is still a row: the roles are ePPM's. */
  first.demand.fill(0);
  store.recomputeDemand(p);
  store.touch();
  check('an emptied row stays', p.assignees.length === rows && store.assignedTo(p, first.person));

  /* Nothing in the store adds a row, removes one or gives it to somebody else. */
  check('the store has no write but the pensum',
    !['addLane', 'reassignLane', 'pruneLanes', 'setHolder', 'addRole'].some(name => name in store));

  p.assignees = before;
  store.recomputeDemand(p);
  store.touch();
}

/* -----------------------------------------------------------------------------
   The URL — what is written is what is read
   -------------------------------------------------------------------------- */

group('url');
{
  const person = data.people[0].id;
  const patch = {
    tab: 'overview', scale: 'year', unit: 'fte', sort: 'lead', sortDir: 'desc',
    phases: [data.phases.eppm[1].id], leads: [person, 'none'],
    portfolios: [data.meta.portfolios[0].id], organisations: [data.meta.organisations[0].id],
    search: 'Muster', hideZeros: true
  };
  store.setState(patch);
  const back = store.readUrl();
  check('a state survives the hash', Object.keys(patch).every(k => same(back[k], patch[k])),
    Object.keys(patch).filter(k => !same(back[k], patch[k])).join(', '));

  location.hash = '#?tab=nope&scale=decade&sort=toString&lead=nobody,none&phase=99&group=lead&cols=title,roles';
  const odd = store.readUrl();
  check('unknown values fall back to the defaults', odd.tab === 'overview' && odd.scale === 'quarter' && odd.sort === 'project');
  check('unknown ids are dropped from a filter', same(odd.leads, ['none']) && odd.phases.length === 0);
  check('a link from before the fixed groups still opens', !('group' in odd));
  check('a column that no longer exists is ignored', odd.cols.overview.title === true && !('roles' in odd.cols.overview));
  location.hash = '#?tab=people&psort=peak&pdir=desc';
  const old = store.readUrl();
  check('a person table sorted by a column it no longer has opens by name', old.pSort === 'name' && old.pDir === 'asc');
  location.hash = '#?tab=people&psort=projects&pdir=desc';
  check('…one sorted by «Projekte» keeps its sort', store.readUrl().pSort === 'projects');
  const counted = store.personRows();
  check('«Projekte» counts a person\'s projects once each', counted.every(r =>
    r.projects === data.projects.filter(p => p.assignees.some(a => a.person === r.person.id)).length));
  location.hash = '#?tab=people&psort=q2&pdir=desc';
  const byQuarter = store.readUrl();
  check('…and one sorted by a quarter keeps its sort', byQuarter.pSort === 'q2' && byQuarter.pDir === 'desc');

  store.setState({ ...store.noFilters(), scale: 'quarter', unit: 'pct', sort: 'project', sortDir: 'asc', hideZeros: false });

  /* The person filter — and «Mir zugewiesen», which is the same filter set to
     the reader — finds a person in any role, not only where they carry the project. */
  const ids = list => list.map(p => p.id).sort().join(',');
  for (const person of data.people) {
    store.setState({ leads: [person.id] });
    const anyRole = data.projects.filter(p => p.assignees.some(a => a.person === person.id));
    check(`filter lead: ${person.id} is found in every role`, ids(store.filteredProjects()) === ids(anyRole),
      `${store.filteredProjects().length} shown, ${anyRole.length} held`);
  }
  store.setState({ leads: ['none'] });
  check('filter lead: «nicht zugewiesen» is a role open now',
    ids(store.filteredProjects()) === ids(data.projects.filter(p => p.assignees.some(a => !a.person && a.demand[now] > 0))));
  store.setState({ leads: [] });
  check('no filter set: nothing filtered', store.filteredProjects().length === data.projects.length);
  check('…and no chips', store.activeFilters().length === 0);
  for (const f of store.FILTERS) {
    const id = store.idsHere(f)[0];
    store.setState({ [f.key]: [id] });
    const chips = store.activeFilters();
    check(`filter ${f.kind}: one chip, and it has a label`, chips.length === 1 && chips[0].kind === f.kind && !!chips[0].label && chips[0].label !== 'undefined');
    store.removeFilter(f.kind, id);
    check(`filter ${f.kind}: the chip removes it`, state[f.key].length === 0);
  }

  /*
   * Personen answers to the filters that mean something for a person. A phase
   * and a sub-portfolio belong to a project: set, they neither thin the table
   * out nor show as a chip there, and they are still in the link.
   */
  const someone = data.people[0];
  const phase = data.phases.eppm[1].id;
  store.setState({ tab: 'people', leads: [someone.id, 'none'], phases: [phase], portfolios: [data.meta.portfolios[0].id] });
  check('people: «Bearbeitende» names the person', same(store.personRows().map(r => r.person.id), [someone.id]));
  check('people: phase, sub-portfolio and «nicht zugewiesen» carry no chip there',
    same(store.activeFilters().map(c => c.id), [someone.id]));
  check('people: a file of projects still names every filter', store.activeFilters({ projects: true }).length === 4);
  check('people: the filters it does not use stay in the link', store.readUrl().phases.length === 1 && store.readUrl().leads.length === 2);
  store.setState({ leads: [], phases: [], portfolios: [], organisations: [someone.organisation] });
  check('people: «Organisation» is the person\'s own',
    same(store.personRows().map(r => r.person.id).sort(), data.people.filter(p => p.organisation === someone.organisation).map(p => p.id).sort()));
  store.setState({ organisations: [], search: someone.name });
  check('people: the search finds a person by name', store.personRows().some(r => r.person.id === someone.id));
  store.setState({ search: 'zzzz-no-such-thing' });
  check('people: …and nobody for a word nothing carries', store.personRows().length === 0);
  store.setState({ ...store.noFilters() });
  check('people: no filter, everybody', store.personRows().length === data.people.length);

  /*
   * The other way round: a unit whose people carry no project — PFM, OM — is
   * a filter for people. Where projects are listed it is neither offered nor
   * applied, and it is still in the link.
   */
  const organisation = store.FILTERS.find(f => f.kind === 'organisation');
  const aside = data.meta.organisations.find(o => !store.carriesProjects(o.id));
  const carrier = data.meta.organisations.find(o => store.carriesProjects(o.id));
  check('organisations: some carry projects and some do not', !!aside && !!carrier);
  store.setState({ tab: 'people', organisations: [aside.id] });
  check('people: a unit that carries no project is offered and applied',
    store.idsHere(organisation).includes(aside.id) && store.personRows().length > 0
    && store.personRows().every(r => r.person.organisation === aside.id));
  store.setState({ tab: 'overview' });
  check('planung: …it is not offered there', !store.idsHere(organisation).includes(aside.id) && store.idsHere(organisation).includes(carrier.id));
  check('planung: …nor applied, nor shown as a chip', store.filteredProjects().length === data.projects.length && store.activeFilters().length === 0);
  check('planung: …nor named in a file of projects', store.activeFilters({ projects: true }).length === 0);
  check('planung: …and it stays in the link', same(store.readUrl().organisations, [aside.id]));
  store.setState({ organisations: [aside.id, carrier.id] });
  check('planung: a unit that carries projects selects its own',
    same(ids(store.filteredProjects()), ids(data.projects.filter(p => p.organisation === carrier.id))));
  store.setState({ ...store.noFilters(), tab: 'people' });
  check('people: the figures are on whatever the view says', (store.setState(store.viewPatch('termine')), store.figuresShown()) && store.coloured());
  store.setState({ tab: 'overview' });
  check('planung: the bar plan has no figures to colour or to set a unit for', !store.figuresShown() && !store.coloured());
  store.setState(store.viewPatch('pensum'));

  /*
   * One rule for the link: a parameter is in it wherever it is not at its
   * default. What belongs to one tab used to be written on that tab only,
   * and was lost on Back, Forward and reload from any other.
   */
  const own = { pSort: 'q2', pDir: 'desc', page: 3, pageSize: '50', paper: 'a3', sheet: 'landscape', zoom: '200', cardSort: { 'phase-count': { by: 'value', dir: 'desc' } } };
  for (const tab of ['overview', 'people', 'dashboard', 'history', 'export']) {
    store.setState({ ...own, tab });
    const read = store.readUrl();
    check(`url: a tab's own state is in the link on «${tab}»`, Object.keys(own).every(k => same(read[k], own[k])),
      Object.keys(own).filter(k => !same(read[k], own[k])).join(', '));
  }
  store.setState({ tab: 'overview', pSort: 'name', pDir: 'asc', page: 1, pageSize: '25', paper: 'a4', sheet: 'portrait', zoom: 'fit', cardSort: {} });
  check('url: at the defaults the link is the tab and nothing else', location.hash === '#?tab=overview', location.hash);
}

/* -----------------------------------------------------------------------------
   The modules, read as text
   -------------------------------------------------------------------------- */

group('source');
{
  const files = readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
  const source = Object.fromEntries(files.map(f => [f, read(`js/${f}`)]));
  const all = Object.values(source).join('\n');

  /*
   * Every German string that reaches t() has its entry — handed over as a
   * literal, as either arm of a choice, or by name: the registries write
   * `label: 'Hoch'` and translate it where it is drawn, and those were the
   * ones nobody caught. Thirty strings of the print layout had no entry.
   */
  const terms = data.i18n.terms;
  const missing = new Set();
  const want = s => { if (/\p{L}{2}/u.test(s) && !(s in terms)) missing.add(s); };
  for (const m of all.matchAll(/\bt\(\s*'([^']+)'\s*[),]/g)) want(m[1]);
  for (const m of all.matchAll(/\bt\([^)]*\?\s*'([^']+)'\s*:\s*'([^']+)'\s*\)/g)) { want(m[1]); want(m[2]); }
  for (const m of all.matchAll(/\b(?:label|sub|heading|placeholder|note|title):\s*'([^']+)'/g)) want(m[1]);
  for (const m of all.matchAll(/(?:noResults\(|legendItem\([^)]*\), )'([^']+)'\)/g)) want(m[1]);
  /* The method sheet's prose is two arrays of pairs. */
  const docs = source['views-docs.js'];
  const prose = docs.slice(docs.indexOf('const METHOD'), docs.indexOf('];', docs.indexOf('const GLOSSARY')));
  for (const m of prose.matchAll(/'([^']+)'/g)) want(m[1]);
  check('every German string that reaches t() is in data/i18n.json', missing.size === 0, [...missing].join(' | '));
  /* …and so has every label the data carries into the interface. */
  /* The short forms — «PFM», «PPE I» — are the house's own and read the same
     in every language; they fall back to themselves. */
  const labels = [
    ...data.roles.roles.flatMap(r => [r.label, r.note]),
    ...data.phases.eppm.map(e => e.label),
    ...data.meta.portfolios.map(x => x.label),
    ...data.meta.organisations.map(o => o.label),
    data.meta.org.unit, data.meta.user.role, data.meta.prototypeNotice,
    ...data.people.map(x => x.role),
    ...data.milestones.catalog.map(c => c.name),
    ...data.milestones.items.map(m => m.statusLabel),
    ...data.print.sender, data.print.classification, data.print.legend.thresholds, data.print.legend.noLead
  ].filter(label => label && !(label in terms));
  check('every label in the data is in data/i18n.json', labels.length === 0, [...new Set(labels)].join(' | '));

  /* Every control dispatches to something. Typed fields are handled by their
     own listeners in app.js, by name. */
  const app = source['app.js'];
  const table = app.slice(app.indexOf('const actions = {'), app.indexOf('Delegated events'));
  const handlers = new Set([...table.matchAll(/^ {2}'?([\w-]+)'?: /gm)].map(m => m[1]));
  for (const f of store.FILTERS) handlers.add(`toggle-${f.kind}`);
  const typed = new Set([...app.matchAll(/act === '([\w-]+)'|data-act="([\w-]+)"\]/g)].map(m => m[1] ?? m[2]));
  const acts = new Set([...all.matchAll(/data-act="([\w-]+)"/g)].map(m => m[1]));
  const orphans = [...acts].filter(a => !handlers.has(a) && !typed.has(a));
  check('every data-act in the markup has a handler', orphans.length === 0, orphans.join(', '));
}

if (failed) {
  console.error(`\n${failed} check${failed === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log(`ok — ${data.projects.length} projects, ${data.projects.reduce((a, p) => a + p.assignees.length, 0)} rows, ${data.people.length} people, ${Q} quarters`);
