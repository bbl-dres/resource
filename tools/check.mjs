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
for (const person of data.people) {
  check(`${person.id} belongs to a known organisation`, !!data.organisationsById[person.organisation], person.organisation);
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
  }
  const order = p.assignees.map(a => store.roleCatalog().findIndex(r => r.id === a.role));
  check(`${p.id}: rows in the catalogue's order`, order.every((v, i) => i === 0 || order[i - 1] <= v));
}
for (const m of data.milestones.items) {
  check(`milestone ${m.id} belongs to a project`, !!data.projectsById[m.projectId], m.projectId);
  check(`milestone ${m.id} is in the catalogue`, !!data.milestoneCatalog[m.code], m.code);
}
for (const c of data.changes) {
  check(`change ${c.id} belongs to a project or to none`, c.projectId == null || !!data.projectsById[c.projectId], String(c.projectId));
}

/* -----------------------------------------------------------------------------
   What is derived from them
   -------------------------------------------------------------------------- */

group('derived');
const now = store.nowIndex();
for (const p of data.projects) {
  const sum = data.quarters.map((_, q) => p.assignees.reduce((a, x) => a + x.demand[q], 0));
  check(`${p.id}: demand is the sum over its rows`, same(p.demand, sum));
  const lead = p.assignees.find(a => a.role === store.roleCatalog()[0].id && a.demand[now] > 0);
  if (lead) check(`${p.id}: the lead holds the first role now`, p.leadId === lead.person, `${p.leadId} ≠ ${lead.person}`);
  check(`${p.id}: unassigned says there is no lead`, p.unassigned === !p.leadId);
}
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
   Edits — the three writes the grid makes
   -------------------------------------------------------------------------- */

group('edits');
{
  const p = data.projects.find(x => x.assignees.length >= 2 && x.assignees[0].person);
  const before = structuredClone(p.assignees);
  const total = p.demand.reduce((a, v) => a + v, 0);
  const [first, second] = p.assignees;
  const somebody = data.people.find(x => !store.assignedTo(p, x.id)).id;

  /* A new row goes where its role belongs. */
  const row = store.addLane(p, first.role, somebody);
  check('addLane: under the last row of its role', p.assignees.indexOf(row) === store.lanesOf(p, first.role).length - 1 + p.assignees.indexOf(first));
  check('addLane: found again by role and person', store.laneOf(p, first.role, somebody) === row);

  /* A person with no figures stays; nobody with no figures goes. */
  store.pruneLanes(p);
  check('pruneLanes: keeps a person without pensum', p.assignees.includes(row));
  row.person = null;
  store.pruneLanes(p);
  check('pruneLanes: drops a row with neither', !p.assignees.includes(row));

  /* A typed figure moves the sum and the person's load. */
  const was = store.personLoad(first.person, now);
  first.demand[now] += 10;
  store.recomputeDemand(p);
  store.touch();
  check('a typed figure moves the project\'s demand', p.demand.reduce((a, v) => a + v, 0) === total + 10);
  check('…and the person\'s load', store.personLoad(first.person, now) === was + 10);

  /* Giving a row to somebody who has one for the role merges the two. */
  const twin = store.addLane(p, second.role, somebody);
  twin.demand[now] = 5;
  const kept = second.demand[now];
  const merged = store.reassignLane(p, second, somebody);
  check('reassignLane: merges into the row that person has', merged === twin && twin.demand[now] === kept + 5 && !p.assignees.includes(second));
  const moved = store.reassignLane(p, twin, null);
  check('reassignLane: «nicht zugewiesen» takes the person off', moved.person === null && store.holderKey(moved) === 'none');
  store.recomputeDemand(p);
  check('a reassignment leaves the sum alone', p.demand.reduce((a, v) => a + v, 0) === total + 10 + 5);
  check('unstaffedAt: sees the open row', store.unstaffedAt(p, now));

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

  store.setState({ ...store.noFilters(), scale: 'quarter', unit: 'pct', sort: 'project', sortDir: 'asc', hideZeros: false });
  check('no filter set: nothing filtered', store.filteredProjects().length === data.projects.length);
  check('…and no chips', store.activeFilters().length === 0);
  for (const f of store.FILTERS) {
    const id = f.ids()[0];
    store.setState({ [f.key]: [id] });
    const chips = store.activeFilters();
    check(`filter ${f.kind}: one chip, and it has a label`, chips.length === 1 && chips[0].kind === f.kind && !!chips[0].label && chips[0].label !== 'undefined');
    store.removeFilter(f.kind, id);
    check(`filter ${f.kind}: the chip removes it`, state[f.key].length === 0);
  }
}

/* -----------------------------------------------------------------------------
   The modules, read as text
   -------------------------------------------------------------------------- */

group('source');
{
  const files = readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
  const source = Object.fromEntries(files.map(f => [f, read(`js/${f}`)]));
  const all = Object.values(source).join('\n');

  /* Every German string handed to t() as a literal has its entry. */
  const terms = data.i18n.terms;
  const missing = new Set();
  for (const m of all.matchAll(/\bt\('([^']+)'\)/g)) if (!(m[1] in terms)) missing.add(m[1]);
  check('every t(\'…\') literal is in data/i18n.json', missing.size === 0, [...missing].join(' | '));
  /* …and so has every label the data carries into the interface. */
  /* The short forms — «BL», «PPE I» — are the house's own and read the same
     in every language; they fall back to themselves. */
  const labels = [
    ...data.roles.roles.map(r => r.label),
    ...data.phases.eppm.map(e => e.label),
    ...data.meta.portfolios.map(x => x.label),
    ...data.meta.organisations.map(o => o.label)
  ].filter(label => !(label in terms));
  check('every label in the data is in data/i18n.json', labels.length === 0, labels.join(' | '));

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
