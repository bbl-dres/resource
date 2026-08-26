/* =============================================================================
   portfolio.js — grow the mock portfolio from 11 to 111 projects.

   The eleven wireframe projects stay exactly as they are. A hundred more are
   generated around them, and then the things that depend on them are derived
   rather than invented: each person's booked load is the sum of the projects
   they lead, and capacity is set so that portfolio utilisation follows the same
   curve the wireframe tells its story with.

   Deterministic: one seeded generator, so re-running produces the same file.
   ============================================================================= */

const fs = require('fs');
process.chdir(require('path').join(__dirname, '..'));

const read = n => JSON.parse(fs.readFileSync(`data/${n}.json`, 'utf8'));
const write = (n, v) => fs.writeFileSync(`data/${n}.json`, JSON.stringify(v, null, 2) + '\n');

/* mulberry32 — small, seeded, and good enough for mock data */
let seed = 0x5bb1e1d;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = list => list[Math.floor(rnd() * list.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/* -----------------------------------------------------------------------------
   Vocabulary — fictional throughout, in the style the wireframe set
   -------------------------------------------------------------------------- */

const PLACES = [
  'Musterlingen', 'Musterbiel', 'Musterthal', 'Musterberg', 'Mustersee', 'Musterau',
  'Musterbach', 'Musterwil', 'Musteregg', 'Musterdorf', 'Musterried', 'Musterhofen',
  'Beispielstadt', 'Beispielgrund', 'Beispielhofen', 'Beispielbach', 'Beispielheim',
  'Beispielwil', 'Beispielegg', 'Beispielried', 'Beispielau', 'Beispielbrunn'
];

const STREETS = [
  'Ahornweg', 'Industriestrasse', 'Seestrasse', 'Hauptstrasse', 'Mühleweg',
  'Bahnhofstrasse', 'Lindenweg', 'Schulhausplatz', 'Zollstrasse', 'Kasernenstrasse',
  'Alte Landstrasse', 'Ringstrasse', 'Feldweg', 'Talstrasse', 'Werkhof Ost',
  'Werkhof West', 'Rebbergweg', 'Sonnhalde', 'Amtshausgasse', 'Postplatz',
  'Via Motta', 'Via Sempione', 'Via Cantonale', 'Place de l’Avenir', 'Rue des Alpes',
  'Chemin du Parc', 'Avenue de la Gare', 'Quai du Lac'
];

const KINDS = [
  ['Instandsetzung', 9], ['Gesamtsanierung', 7], ['Unterhalt', 6], ['Teilsanierung', 6],
  ['Umbau', 5], ['Erweiterung', 4], ['Ersatzneubau', 4], ['Neubau', 4],
  ['Fassadensanierung', 4], ['Energetische Sanierung', 4], ['Haustechnik', 3],
  ['Statik / Erdbeben', 3], ['Brandschutz', 3], ['Dachsanierung', 3],
  ['Arealentwicklung', 2], ['Aussenanlagen', 2], ['Barrierefreiheit', 2],
  ['Mehrzweckbau', 2], ['Badanlage', 1], ['Alternativobjekt', 1], ['Kauf', 1]
];

const PORTFOLIOS = [
  ['verwaltung', 26], ['zoll', 15], ['justiz', 14], ['bildung', 13],
  ['ausland', 12], ['kultur', 11], ['sport', 9]
];

const PRIORITIES = [['hoch', 26], ['mittel', 52], ['tief', 22]];

/* The SIA 112 chain, and how much of a lead a phase typically takes. */
const SEQ = ['11', '21', '22', '31', '32', '33', '41', '51', '52', '53'];
const WEIGHT = {
  '11': 10, '21': 25, '22': 30, '31': 45, '32': 60, '33': 35,
  '41': 55, '51': 70, '52': 85, '53': 45
};
const DURATION = {
  '11': [1, 2], '21': [1, 2], '22': [1, 2], '31': [1, 2], '32': [2, 3],
  '33': [1, 2], '41': [1, 2], '51': [1, 2], '52': [2, 4], '53': [1, 1]
};

const SUB = read('phases').sub;

/* -----------------------------------------------------------------------------
   Generating a project
   -------------------------------------------------------------------------- */

const QUARTERS = 8;

/**
 * A project is a walk along the SIA chain. Where it stands today decides both
 * its phase label and its demand curve — the two can never drift apart.
 */
function chain(startPhase, startQuarter) {
  const bars = [];
  let at = SEQ.indexOf(startPhase);
  let q = startQuarter;
  // The current phase is normally already under way, so it starts before today.
  let firstOffset = startQuarter === 0 ? -between(0, 2) : 0;
  q += firstOffset;

  while (at < SEQ.length && q < QUARTERS) {
    const phase = SEQ[at];
    const [lo, hi] = DURATION[phase];
    const span = between(lo, hi);
    bars.push({ phase, from: q, to: q + span });
    q += span;
    at++;
  }
  return bars;
}

function demandFrom(bars, size) {
  const out = Array(QUARTERS).fill(0);
  for (const bar of bars) {
    for (let q = Math.max(0, bar.from); q < Math.min(QUARTERS, bar.to); q++) {
      out[q] = Math.max(out[q], Math.round(WEIGHT[bar.phase] * size / 5) * 5);
    }
  }
  return out;
}

function creditFor(phase, size) {
  // Nothing is committed before the project has been through Vorstudien.
  if (phase === '11' || phase === '21') return null;
  const base = 1.2 + rnd() * 9;
  const value = Math.round(base * size * (phase >= '41' ? 2.4 : 1.6) * 100) / 100;
  return Math.min(value, 128);
}

const mio = v => v.toFixed(2).replace('.', ',') + ' Mio.';

function makeProject(n, usedNumbers, usedAddresses) {
  let place, street, house, address;
  do {
    place = pick(PLACES);
    street = pick(STREETS);
    house = weighted([[String(between(1, 96)), 7], [`${between(1, 40)}+${between(41, 60)}`, 1]]);
    address = `${place}, ${street} ${house}`;
  } while (usedAddresses.has(address));
  usedAddresses.add(address);

  let number;
  do { number = '…' + String(between(1, 9998)).padStart(4, '0'); } while (usedNumbers.has(number));
  usedNumbers.add(number);

  const kind = weighted(KINDS);
  // Where the portfolio sits today: a pipeline, weighted towards the middle.
  const phase = weighted([
    ['11', 6], ['21', 9], ['22', 7], ['31', 11], ['32', 14], ['33', 8],
    ['41', 10], ['51', 11], ['52', 17], ['53', 7]
  ]);
  const size = weighted([[0.35, 18], [0.6, 30], [0.9, 30], [1.3, 16], [1.7, 6]]);
  // A sixth of the portfolio has not started yet — the pipeline behind today.
  const startQuarter = weighted([[0, 84], [1, 6], [2, 5], [3, 3], [4, 2]]);

  const bars = chain(phase, startQuarter);
  const demand = demandFrom(bars, size);
  const credit = creditFor(phase, size);
  const peak = Math.max(...demand);

  return {
    id: 'pr' + String(100 + n),
    number,
    title: `${address}, ${kind}`,
    location: address,
    kind,
    phase,
    leadId: null,                       // assigned below, once the team is known
    portfolio: weighted(PORTFOLIOS),
    priority: weighted(PRIORITIES),
    credit,
    creditLabel: credit === null ? 'offen' : mio(credit),
    // The construction credit is released at MS4, between phases 3 and 4.
    preCredit: SEQ.indexOf(phase) < SEQ.indexOf('41'),
    demand,
    // The agreed pensum: usually what is planned, sometimes less than reality.
    target: Math.max(5, Math.round((peak * weighted([[1, 62], [0.85, 26], [0.7, 12]])) / 5) * 5),
    bars: bars
      .filter(b => b.to > 0)
      .map((b, i, list) => {
        const span = Math.min(QUARTERS, b.to) - Math.max(0, b.from);
        const bar = {
          phase: b.phase,
          from: b.from,
          to: b.to,
          label: span >= 2 ? SUB[b.phase].label : b.phase
        };
        if (b.to > QUARTERS && i === list.length - 1) bar.continues = true;
        return bar;
      })
  };
}

/* -----------------------------------------------------------------------------
   The team
   -------------------------------------------------------------------------- */

const FIRST = ['Anna', 'Beat', 'Chiara', 'Daniel', 'Elena', 'Fabio', 'Gina', 'Hans',
  'Irene', 'Jonas', 'Karin', 'Luca', 'Marta', 'Nico', 'Olivia', 'Peter', 'Rahel',
  'Simon', 'Tanja', 'Urs', 'Vera', 'Walter', 'Yara', 'Zeno', 'Andrea', 'Bruno',
  'Carla', 'Dario', 'Eva', 'Felix', 'Greta', 'Heinz', 'Ines', 'Jan', 'Katja',
  'Leon', 'Mia', 'Noah', 'Petra', 'Reto', 'Sara', 'Timo', 'Ursina', 'Vito',
  'Yves', 'Zoe', 'Aline', 'Bernhard', 'Corina', 'Damian'];
const LAST = ['Muster', 'Beispiel', 'Musterli', 'Beispieler', 'Mustermann', 'Beispielmann'];

function makeTeam(rosterTarget) {
  const people = read('people');
  const taken = new Set(people.map(p => p.name));
  let total = people.reduce((a, p) => a + p.employment, 0);

  for (let i = 0; total < rosterTarget; i++) {
    let name, id, guard = 0;
    do {
      const first = FIRST[(i * 7 + guard) % FIRST.length];
      const last = LAST[(i + guard) % LAST.length];
      name = `${first} ${last}`;
      id = (first + last).toLowerCase().replace(/[^a-z]/g, '');
      guard++;
    } while (taken.has(name) && guard < 400);
    taken.add(name);

    // The last hire takes whatever is left, so the roster adds up exactly.
    const wanted = weighted([[100, 62], [90, 8], [80, 18], [70, 5], [60, 7]]);
    const employment = Math.min(wanted, Math.max(40, rosterTarget - total));

    people.push({
      id, name,
      initials: name.split(' ').map(w => w[0]).join(''),
      shortName: `${name.split(' ')[0]} ${name.split(' ')[1][0]}.`,
      role: 'Projektleitung',
      employment,
      baseLoad: Array(QUARTERS).fill(0)   // derived below
    });
    total += employment;
  }
  return people;
}

/* -----------------------------------------------------------------------------
   Milestones
   -------------------------------------------------------------------------- */

const GATE = { '11': 'MS1', '21': 'MS2', '31': 'MS3', '33': 'MS4', '41': 'MS5', '53': 'MS6' };
const META = read('meta');
const QUARTER_IDS = META.quarters.map(q => q.id);
const QUARTER_END = ['2026-09-30', '2026-12-31', '2027-03-31', '2027-06-30',
  '2027-09-30', '2027-12-31', '2028-03-31', '2028-06-30'];

const REASONS = [
  'Verzug durch Einsprache', 'Verzug durch Statikprüfung', 'Vergabe verschoben',
  'Bewilligung ausstehend', 'Abstimmung mit Nutzer offen', 'Kreditfreigabe verschoben',
  'Lieferfristen Haustechnik'
];

/*
 * Every gate the project passes inside the window, not just the next one — a
 * project in Realisierung has Vergabe behind it and Abnahme ahead, and a
 * portfolio view that shows one gate per project hides the clustering that
 * makes approval bodies the bottleneck.
 */
function makeMilestones(projects) {
  const items = [];
  for (const p of projects) {
    for (const bar of p.bars) {
      const code = GATE[bar.phase];
      if (!code || bar.to < 1 || bar.to > QUARTERS) continue;

      const planIdx = Math.max(0, bar.to - 1);
      // The further out a gate sits, the less anyone knows about it yet.
      const near = planIdx <= 2;
      const late = weighted(near ? [[0, 62], [1, 24], [2, 14]] : [[0, 84], [1, 12], [2, 4]]);
      const forecastIdx = Math.min(QUARTERS - 1, planIdx + late);
      const pending = late === 0 && rnd() < (near ? 0.08 : 0.04);

      items.push({
        id: `ms-${p.id.slice(2)}-${code.slice(2)}`,
        code,
        projectId: p.id,
        subPhase: bar.phase,
        plan: QUARTER_IDS[planIdx],
        planDate: QUARTER_END[planIdx],
        forecast: pending ? null : QUARTER_IDS[forecastIdx],
        forecastDate: pending ? null : QUARTER_END[forecastIdx],
        status: pending ? 'pending' : late ? 'late' : 'ok',
        statusLabel: pending ? '▲ Auftrag noch hängig'
          : late ? `▲ ${late} Quartal${late > 1 ? 'e' : ''} verspätet`
            : 'Termin gehalten',
        ...(late ? { impact: pick(REASONS) } : {})
      });
    }
  }
  return items;
}

/* -----------------------------------------------------------------------------
   Assemble
   -------------------------------------------------------------------------- */

const existing = read('projects');
const usedNumbers = new Set(existing.map(p => p.number));
const usedAddresses = new Set(existing.map(p => p.location));

const generated = [];
for (let i = 0; i < 100; i++) generated.push(makeProject(i, usedNumbers, usedAddresses));

const projects = [...existing, ...generated];

/*
 * The team is solved for, not guessed. Sizing it against the first quarter
 * leaves the peak two quarters later far over the top, so it is sized against
 * the peak: at full stretch the portfolio runs at 112 %, which is the number
 * the wireframe tells its story with.
 */
const ABSENCE_RATIO = [0.111, 0.055, 0.045, 0.054, 0.107, 0.054, 0.045, 0.054];
const HIRE = [1, 1, 1.03, 1.03, 1.03, 1.03, 1.03, 1.03];
const PEAK_UTILISATION = 1.12;

const demandTotal = Array.from({ length: QUARTERS }, (_, q) =>
  projects.reduce((a, p) => a + p.demand[q], 0));
const external = demandTotal.map((d, q) => Math.round(d * (0.06 + q * 0.002) / 5) * 5);

const roster = Math.round(Math.max(...demandTotal.map((d, q) =>
  (d - external[q]) / PEAK_UTILISATION / (1 - ABSENCE_RATIO[q]) / HIRE[q])) / 10) * 10;

const people = makeTeam(roster);
// The wireframe hands projects to Projektentwicklung as well; Bauleitung
// carries site work this table does not model, so it leads nothing.
const LEAD_ROLES = new Set(['Projektleitung', 'Projektentwicklung']);
const leads = people.filter(p => LEAD_ROLES.has(p.role));

/* Existing assignments stay; the rest are spread over the team, and a handful
   are deliberately left open because that case has to stay visible. */
/*
 * Assignment minimises the peak a person would end up carrying, quarter by
 * quarter and against their own contract. Balancing on a total — or on the
 * current quarter — lets a project that peaks later slip past the check, and a
 * 40 % contract ends up leading an 85 % project. What is displayed is the peak,
 * so the peak is what the assignment optimises.
 */
const loadQ = Object.fromEntries(people.map(p => [p.id, Array(QUARTERS).fill(0)]));
for (const p of existing) {
  if (p.leadId) p.demand.forEach((v, q) => { loadQ[p.leadId][q] += v; });
}

const peakWith = (person, project) => Math.max(...loadQ[person.id]
  .map((v, q) => (v + (project ? project.demand[q] : 0)) / person.employment));

for (const p of generated) {
  if (rnd() < 0.05) continue;                        // ohne Projektleitung
  // The three who would carry it most lightly; one of them at random, so the
  // team does not come out identical.
  const pool = [...leads].sort((a, b) => peakWith(a, p) - peakWith(b, p)).slice(0, 3);
  const to = pick(pool);
  p.leadId = to.id;
  p.demand.forEach((v, q) => { loadQ[to.id][q] += v; });
}

/*
 * A person who leads projects has their booked load from those projects, so an
 * edit to a pensum moves it. Somebody who leads none — Bauleitung, say — still
 * has work; it is simply not in this table, so their authored figure stands.
 */
for (const person of people) {
  const mine = projects.filter(p => p.leadId === person.id);
  if (!mine.length) continue;
  person.baseLoad = Array.from({ length: QUARTERS }, (_, q) =>
    mine.reduce((a, p) => a + p.demand[q], 0));
}

/* -----------------------------------------------------------------------------
   Capacity — a team is a team. It does not grow to meet a falling demand curve,
   so gross capacity is flat apart from one planned hire, and the utilisation
   curve is whatever falls out of it. That is the whole point of the view.
   -------------------------------------------------------------------------- */

const capacity = read('capacity');
const actualRoster = people.reduce((a, p) => a + p.employment, 0);

capacity.external = external;
capacity.gross = HIRE.map(f => Math.round(actualRoster * f / 5) * 5);
capacity.gross[0] = actualRoster;
capacity.gross[1] = actualRoster;
capacity.absence = capacity.gross.map((g, q) => Math.round(g * ABSENCE_RATIO[q] / 5) * 5);

/* -----------------------------------------------------------------------------
   The things that quote the portfolio
   -------------------------------------------------------------------------- */

const milestones = read('milestones');
const existingIds = new Set(milestones.items.map(m => m.projectId));
milestones.items = [...milestones.items,
  ...makeMilestones(generated).filter(m => !existingIds.has(m.projectId))];

/*
 * A change log for a portfolio this size. The nine hand-written entries stay at
 * the top — they are the ones the landing page tells its story with — and the
 * generated history sits behind them, over the ten weeks before today.
 */
const CHANGE_DAYS = 70;
const WORDS = {
  Pensum: [
    'Bauleitung Etappe 2 vorgezogen', 'Pensum nach Rückmeldung Nutzer erhöht',
    'Aufwand Submission nach unten korrigiert', 'Zusatzaufwand Schadstoffsanierung',
    'Begleitung Bauherr reduziert', 'Mehraufwand Koordination Haustechnik',
    'Aufwand Ausschreibung neu geschätzt', 'Betreuung nach Vergabe reduziert',
    'Aufwand nach Einsprache erhöht', 'Planungsaufwand nach Vorprojekt angepasst'
  ],
  Meilenstein: [
    'MS3 Vorprojekt neu terminiert', 'MS4 Baukredit neu terminiert',
    'MS5 Vergabe neu terminiert', 'MS2 Machbarkeit bestätigt',
    'MS6 Abnahme neu terminiert'
  ],
  Termin: [
    'Bauende verschoben', 'Baubeginn vorgezogen', 'Bezug neu terminiert',
    'Etappierung angepasst', 'Submissionsfrist verlängert'
  ],
  Projektleitung: ['Übergabe nach Pensionierung', 'Übergabe wegen Überlast', 'Neuzuteilung Teilportfolio'],
  'Begründung': [
    'Überlast freigegeben', 'Abweichung dokumentiert', 'Freigabe Bereichsleitung erfasst'
  ],
  Abwesenheiten: ['Ferien erfasst', 'Weiterbildung erfasst', 'Militärdienst erfasst']
};

function changeLog() {
  const out = [];
  const today = new Date(META.today + 'T00:00:00');
  const stamp = (back) => {
    const d = new Date(today.getTime() - back * 86400000);
    // The federal administration does not book changes at the weekend.
    if (d.getDay() === 0) d.setDate(d.getDate() - 2);
    if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    const iso = d.toISOString().slice(0, 10);
    const [y, m, dd] = iso.split('-');
    return { date: iso, dateLabel: `${dd}.${m}.${y}` };
  };

  const withLead = projects.filter(p => p.leadId);
  for (let i = 0; i < 240; i++) {
    const p = pick(withLead);
    const lead = people.find(x => x.id === p.leadId);
    const field = weighted([['Pensum', 46], ['Meilenstein', 16], ['Termin', 12],
      ['Begründung', 12], ['Projektleitung', 7], ['Abwesenheiten', 7]]);
    const when = stamp(4 + Math.floor(rnd() * CHANGE_DAYS));

    let value;
    if (field === 'Pensum') {
      const from = Math.max(5, Math.round(Math.max(...p.demand) * (0.5 + rnd() * 0.5) / 5) * 5);
      const to = Math.max(5, from + (rnd() < 0.55 ? 1 : -1) * (5 + Math.floor(rnd() * 4) * 5));
      value = `${from} % → ${to} %`;
    } else if (field === 'Meilenstein' || field === 'Termin') {
      const a = between(0, 5);
      value = `${QUARTER_IDS[a].slice(4)}/${QUARTER_IDS[a].slice(2, 4)} → ${QUARTER_IDS[a + 1].slice(4)}/${QUARTER_IDS[a + 1].slice(2, 4)}`;
    } else if (field === 'Projektleitung') {
      value = `${pick(people).shortName} → ${lead ? lead.shortName : '—'}`;
    } else if (field === 'Abwesenheiten') {
      value = `+${between(1, 4) * 5} %`;
    } else {
      value = 'erfasst';
    }

    out.push({
      id: `c-gen-${i}`,
      date: when.date,
      dateLabel: when.dateLabel,
      actor: lead ? lead.name : META.user.name,
      projectId: p.id,
      projectLabel: p.location,
      field,
      change: pick(WORDS[field]),
      value,
      onLanding: false
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const changes = read('changes');
write('changes', [...changes, ...changeLog()]);

/* Committed credit by year of realisation, derived rather than asserted. */
const dashboard = read('dashboard');
const YEAR_OF = ['2026', '2026', '2027', '2027', '2027', '2027', '2028', '2028'];
const buckets = { 2026: [0, 0], 2027: [0, 0], 2028: [0, 0], later: [0, 0] };
for (const p of projects) {
  if (p.credit === null) continue;
  const build = p.bars.find(b => b.phase === '52') ?? p.bars.find(b => b.phase === '51');
  const key = !build ? 'later' : (YEAR_OF[Math.min(QUARTERS - 1, Math.max(0, build.from))] ?? 'later');
  const bucket = buckets[key] ?? buckets.later;
  bucket[0] += p.credit;
  bucket[1] += 1;
}
dashboard.creditByYear.rows = [
  ['2026', buckets['2026']], ['2027', buckets['2027']], ['2028', buckets['2028']],
  ['2029 und später', buckets.later]
].map(([label, [sum, count]]) => ({
  label,
  value: Math.round(sum * 10) / 10,
  valueLabel: (Math.round(sum * 10) / 10).toFixed(1).replace('.', ',') + ' Mio.',
  note: `${count} Projekte`
}));

write('projects', projects);
write('people', people);
write('capacity', capacity);

write('milestones', milestones);
write('dashboard', dashboard);

/* -----------------------------------------------------------------------------
   Report
   -------------------------------------------------------------------------- */

const utilisation = demandTotal.map((d, q) =>
  Math.round((d - capacity.external[q]) / (capacity.gross[q] - capacity.absence[q]) * 100));
const unassigned = projects.filter(p => !p.leadId).length;
const over = people.filter(p => p.baseLoad[0] / p.employment * 100 > 100).length;

console.log('projects   ', projects.length, '(' + existing.length + ' kept, 100 generated)');
console.log('people     ', people.length, '· roster', people.reduce((a, p) => a + p.employment, 0), '%');
console.log('demand     ', demandTotal.join('  '));
console.log('gross      ', capacity.gross.join('  '));
console.log('absence    ', capacity.absence.join('  '));
console.log('external   ', capacity.external.join('  '));
console.log('utilisation', utilisation.join('  '));
console.log('milestones ', milestones.items.length,
  '· late', milestones.items.filter(m => m.status === 'late').length,
  '· ok', milestones.items.filter(m => m.status === 'ok').length,
  '· offen', milestones.items.filter(m => m.forecast === null).length);
console.log('ohne Projektleitung', unassigned, '· Personen über 100 %', over);
console.log('projects per lead  ', (projects.filter(p => p.leadId).length / people.length).toFixed(1));
