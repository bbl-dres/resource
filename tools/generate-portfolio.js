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

/*
 * The seed is the hand-written core the wireframe tells its story with; this
 * fills the portfolio out around it. It is read from tools/seed, never from
 * data/ — reading its own output made a second run append another hundred
 * projects to the hundred already there, so the file was not reproducible.
 */
const core = n => JSON.parse(fs.readFileSync(`tools/seed/${n}.json`, 'utf8'));
const read = n => JSON.parse(fs.readFileSync(`data/${n}.json`, 'utf8'));
/* CRLF, like every other file here — otherwise a run shows up as a rewrite of
   every line in every data file it touched. */
const write = (n, v) => fs.writeFileSync(`data/${n}.json`,
  (JSON.stringify(v, null, 2) + '\n').replace(/\n/g, '\r\n'));

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

/*
 * The chain every project walks: the six Teilphasen as ePPM names them —
 * Vorstudien, 22, 31, 32, 53, 61. ePPM's full list reads Vorstudien, 1, 22,
 * 2, 31, 3, 32, 4, 53, 5, 61, 6: phase, gate, phase, gate. The Hauptphasen
 * 1 to 6 are the gates between the Teilphasen, and are the milestone
 * catalogue (tools/seed/milestones.json); the Teilphasen are read from
 * phases.json, the one place their order lives.
 */
const EPPM = read('phases').eppm;
const SEQ = EPPM.map(e => e.id);
const LABEL = Object.fromEntries(EPPM.map(e => [e.id, e.label]));
/*
 * What a phase asks of the office, in per cent of one person. Operation asks
 * little and asks it for years, which is why it is on the list at all.
 */
const WEIGHT = { 'Vorstudien': 15, '22': 30, '31': 45, '32': 60, '53': 85, '61': 10 };
/*
 * Quarters per phase, before the project's own pace is applied. A Teilphase
 * runs up to its gate, so it carries the work SIA files under the main phase
 * it sits in:
 *
 *   22  an open design competition runs about twelve months, and the award
 *       follows it.
 *   32  the Bauprojekt, and with it the permit: 140–160 days on average in
 *       2023, a year in the cities, much longer with an objection.
 *   53  from tender to commissioning — a Teilsanierung inside two years, a
 *       Gesamtsanierung of a building that stays in use, four or more.
 *   61  Betrieb is what happens to the building afterwards; the chain carries
 *       it so a finished project still has a phase, at next to no demand.
 */
const DURATION = {
  'Vorstudien': [1, 3], '22': [3, 5], '31': [2, 4], '32': [4, 8], '53': [6, 16], '61': [4, 8]
};

/*
 * How fast this particular project moves. Money is the first half of it — a
 * three-million Instandsetzung is decided and built while a thirty-million
 * Gesamtsanierung is still in the permit procedure. The second half is
 * everything money does not explain: a listed façade, a site that stays in
 * operation through the work, an objection that goes to court.
 */
const COMPLEXITY = [[0.7, 24], [1, 42], [1.45, 24], [2.2, 10]];
const paceOf = (size) => Math.max(0.55, size * weighted(COMPLEXITY));


/* -----------------------------------------------------------------------------
   Generating a project
   -------------------------------------------------------------------------- */

/*
 * Q3/2026 to Q2/2036. A federal building project runs six to twelve years from
 * the first Bedürfnisabklärung to the handover, so a plan that means to show a
 * project whole has to be about that long. At eighteen quarters the far end was
 * not a forecast at all: forty-two of a hundred and eleven projects simply ran
 * off the edge, and the load curve fell away in 2030 because the paper stopped,
 * not because the work did.
 */
const QUARTERS = 40;

/*
 * Q1/2027 — the last quarter a project may begin in. Anything later exists only
 * on paper: it has no Auftrag, no lead and no pensum, so this tool has nothing
 * to plan with.
 */
const LAST_START = 2;
const FIRST_QUARTER = { year: 2026, q: 3 };

/*
 * A whole project: Vorstudien through to Betrieb, every phase in
 * between, at this project's own pace. Every project has all of them — what
 * differs is how long each takes and when the first one began.
 *
 * `startQuarter` is where the first phase starts, counted from today. Negative for a
 * project already under way, positive for one still to begin. Phases before the
 * window are dropped when the bars are written.
 */
function chain(startQuarter, pace) {
  const bars = [];
  let q = startQuarter;
  for (const phase of SEQ) {
    const span = Math.max(1, Math.round(between(...DURATION[phase]) * pace));
    bars.push({ phase, from: q, to: q + span });
    q += span;
  }
  return bars;
}

/** How long the whole chain runs, at this pace — the sum of its phases. */
const chainLength = (bars) => bars.at(-1).to - bars[0].from;

/*
 * The same chain, moved along the axis. Drawing it a second time would draw new
 * durations with it: a chain measured at thirty quarters and then rebuilt at
 * twenty would be placed as though it were long, and could be shifted clear off
 * the near edge — which left one project in the portfolio with no bars at all.
 */
const shifted = (bars, by) => bars.map(b => ({ ...b, from: b.from + by, to: b.to + by }));

/** The phase a project is in today; the first one, if it has not begun. */
function phaseAt(bars, q = 0) {
  const now = bars.find(b => b.from <= q && q < b.to);
  if (now) return now.phase;
  return q < bars[0].from ? bars[0].phase : bars.at(-1).phase;
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

/** Where a phase stands in the chain. */
const stage = phase => SEQ.indexOf(phase);

function creditFor(phase, size) {
  // Nothing is committed before the project has been through Vorstudien.
  if (stage(phase) <= stage('Vorstudien')) return null;
  const base = 1.2 + rnd() * 9;
  const value = Math.round(base * size * (stage(phase) >= stage('53') ? 2.4 : 1.6) * 100) / 100;
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
  // A complete number, not an abbreviation: the leading … was mockup shorthand
  // and read on screen as a column too narrow to show the whole thing.
  do { number = String(between(1, 9998)).padStart(4, '0'); } while (usedNumbers.has(number));
  usedNumbers.add(number);

  const kind = weighted(KINDS);
  const size = weighted([[0.35, 18], [0.6, 30], [0.9, 30], [1.3, 16], [1.7, 6]]);

  /*
   * Where this project stands. The chain is built first, because how far back it
   * may have started depends on how long it runs; then phase 11 is placed
   * anywhere from a whole chain-length ago to LAST_START. That gives the
   * portfolio every stage at once — one project's Ausführung, the next one's
   * Machbarkeit, a third not yet begun.
   *
   * Nothing starts later than that: a project two years out is not in this tool
   * yet, it is a line in a Botschaft. The plan thins towards its far end for
   * that reason, and it should.
   */
  const pace = paceOf(size);
  const shape = chain(0, pace);
  const bars = shifted(shape, between(1 - chainLength(shape), LAST_START));

  const phase = phaseAt(bars);
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
    // The construction credit is released at gate 4, which closes the Bauprojekt.
    preCredit: stage(phase) <= stage('32'),
    demand,
    // The agreed pensum: usually what is planned, sometimes less than reality.
    target: Math.max(5, Math.round((peak * weighted([[1, 62], [0.85, 26], [0.7, 12]])) / 5) * 5),
    bars: barsFor(bars)
  };
}

/** The bars as the view reads them: inside the window, labelled where they fit. */
function barsFor(bars) {
  return bars
    .filter(b => b.to > 0 && b.from < QUARTERS)
    .map((b, i, list) => {
      const span = Math.min(QUARTERS, b.to) - Math.max(0, b.from);
      const bar = {
        phase: b.phase,
        from: b.from,
        to: b.to,
        label: span >= 2 ? LABEL[b.phase] : b.phase
      };
      if (b.to > QUARTERS && i === list.length - 1) bar.continues = true;
      return bar;
    });
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
  /*
   * From the five named people the wireframe tells its story with, never from
   * the roster of the last run. This loop only ever adds, so reading its own
   * output meant a team that had once grown could not shrink again: a smaller
   * portfolio kept the larger team and the peak quietly dropped below the
   * number the story rests on.
   */
  const people = core('people');
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

/* The odds that a gate has no forecast at all, by gate — see makeMilestones. */
const OPEN = { '1': 0.30, '2': 0.20, '3': 0.12, '4': 0.34, '5': 0.06, '6': 0.06 };

/* The gate at the end of each Teilphase: the Hauptphase it opens. */
const GATE = { 'Vorstudien': '1', '22': '2', '31': '3', '32': '4', '53': '5', '61': '6' };
const META = read('meta');

/* The calendar follows QUARTERS, so the window has one definition. */
const QUARTER_CAL = Array.from({ length: QUARTERS }, (_, i) => {
  const n = (FIRST_QUARTER.q - 1) + i;
  return { year: FIRST_QUARTER.year + Math.floor(n / 4), q: (n % 4) + 1 };
});
const QUARTER_IDS = QUARTER_CAL.map(c => `${c.year}Q${c.q}`);
/*
 * A gate closes a phase, so its day lies in the phase's closing weeks: the
 * last three weeks of the quarter the phase ends in, never its middle. Drawn
 * to its date, a gate picked anywhere in the quarter stood up to eleven weeks
 * short of the bar it closes and read as a milestone inside the phase.
 */
function dayNearEnd(qi) {
  const c = QUARTER_CAL[qi];
  const month = c.q * 3 - 1;
  const days = [31, [28, 29][+(c.year % 4 === 0)], 31, 30, 31, 30,
    31, 31, 30, 31, 30, 31][month];
  return `${c.year}-${String(month + 1).padStart(2, '0')}-${String(between(days - 20, days - 1)).padStart(2, '0')}`;
}

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
      /*
       * A gate with no forecast at all — not late, undated. This is what
       * actually stalls a project for years: nobody has committed to a date, so
       * everything behind it waits. It clusters where the decision is not the
       * office's to make, on the Bedürfnis and on the Baukredit, and it is rare
       * close to today, where a date has usually been pinned down.
       */
      const pending = rnd() < (OPEN[code] ?? 0.10) * (near ? 0.35 : 1);

      items.push({
        id: `ms-${p.id.slice(2)}-${code}`,
        code,
        projectId: p.id,
        subPhase: bar.phase,
        plan: QUARTER_IDS[planIdx],
        planDate: dayNearEnd(planIdx),
        forecast: pending ? null : QUARTER_IDS[forecastIdx],
        forecastDate: pending ? null : dayNearEnd(forecastIdx),
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

/*
 * The hand-written core keeps its identity — name, address, lead, credit — but
 * its timeline is generated like every other, or the eleven projects the story
 * rests on would be the only ones still finishing inside a year.
 */
const existing = core('projects').map(p => {
  /*
   * The project's size, read back out of the hand-written demand curve. Against
   * the peak weight any project reaches, not against its current phase: a
   * project still in Strategische Planung is charged at 10, so dividing by that
   * turned a modest curve into a size of thirty and gave it a Planung lasting
   * thirty-eight quarters. Held inside the range generated projects draw from,
   * so the eleven stay comparable with the rest.
   */
  const peak = Math.max(...p.demand) / Math.max(...Object.values(WEIGHT));
  const size = Math.min(1.7, Math.max(0.35, peak));
  const pace = paceOf(size);

  /*
   * These eleven keep the stage they were written in — the story on the landing
   * page names them by it — so the chain is placed so that today falls inside
   * the phase the file gives them, rather than anywhere along it.
   */
  const shape = chain(0, pace);
  const at = shape[Math.max(0, stage(p.phase))];
  const bars = shifted(shape, -between(at.from, at.to - 1));
  return { ...p, bars: barsFor(bars), demand: demandFrom(bars, size), phase: phaseAt(bars) };
});
const usedNumbers = new Set(existing.map(p => p.number));
const usedAddresses = new Set(existing.map(p => p.location));

/*
 * The portfolio an office of this size carries today. Since nothing new enters
 * after Q1/2027, this is also the whole of the plan: they all finish somewhere
 * in the ten years, and the far end of the window is thin because no more work
 * has been decided on yet — not because the paper ran out.
 */
const GENERATED = 100;
const generated = [];
for (let i = 0; i < GENERATED; i++) generated.push(makeProject(i, usedNumbers, usedAddresses));

const projects = [...existing, ...generated];

/*
 * The team is solved for, not guessed. Sizing it against the first quarter
 * leaves the peak two quarters later far over the top, so it is sized against
 * the peak: at full stretch the portfolio runs at 112 %, which is the number
 * the wireframe tells its story with.
 */
/* Absence is seasonal: the summer quarter carries the holidays. */
const ABSENCE_BY_QUARTER = { 1: 0.045, 2: 0.054, 3: 0.109, 4: 0.055 };
const ABSENCE_RATIO = QUARTER_CAL.map(c => ABSENCE_BY_QUARTER[c.q]);
/*
 * The division grows about two per cent a year for as long as the posts are
 * actually budgeted, and flat after that. Carrying the growth across the whole
 * ten years added eighteen per cent of capacity nobody has approved, and the
 * utilisation curve slid downhill for that reason alone.
 */
const FUNDED_YEARS = 3;
const HIRE = QUARTER_CAL.map((_, q) =>
  Math.round((1 + 0.02 * Math.min(FUNDED_YEARS, Math.floor(q / 4))) * 100) / 100);
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
  if (mine.length) {
    person.baseLoad = Array.from({ length: QUARTERS }, (_, q) =>
      mine.reduce((a, p) => a + p.demand[q], 0));
    continue;
  }
  /*
   * Somebody who leads nothing is booked around their contract, drifting a
   * little from quarter to quarter. Leaving them at zero would be the more
   * obvious lie: the roster counts their capacity, so the division would look
   * as though it had people spare that it does not.
   */
  const occupancy = 0.85 + rnd() * 0.25;
  person.baseLoad = Array.from({ length: QUARTERS }, () =>
    Math.round(person.employment * occupancy * (0.9 + rnd() * 0.2) / 5) * 5);
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

/*
 * Every gate is generated from the bars, the eleven core projects' included.
 * Their hand-written gates used to be taken as they were, and their quarters
 * no longer matched the generated phases they close: a Vergabe drawn two
 * quarters before the Ausschreibung ended. What the seed still owns is the
 * story — which gate is late, by how much, which has no date, and why — and
 * that is laid over the generated gate of the same id.
 */
const seeded = new Map(core('milestones').items.map(m => [m.id, m]));
const milestones = { ...core('milestones') };
milestones.items = makeMilestones(projects).map(m => {
  const s = seeded.get(m.id);
  if (!s) return m;
  const planIdx = QUARTER_IDS.indexOf(m.plan);
  const late = s.forecast ? Math.max(0, QUARTER_IDS.indexOf(s.forecast) - QUARTER_IDS.indexOf(s.plan)) : 0;
  const forecastIdx = Math.min(QUARTERS - 1, planIdx + late);
  return {
    ...m,
    forecast: s.forecast === null ? null : QUARTER_IDS[forecastIdx],
    forecastDate: s.forecast === null ? null : dayNearEnd(forecastIdx),
    status: s.status, statusLabel: s.statusLabel,
    ...(s.impact ? { impact: s.impact } : {})
  };
});
/* A seed gate whose generated counterpart lies outside the window is lost with
   its story; say so rather than drop it in silence. */
for (const id of seeded.keys()) {
  if (!milestones.items.some(m => m.id === id)) console.warn(`seed milestone ${id} has no generated gate in the window`);
}

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
    'Gate 3 Projektierung neu terminiert', 'Gate 4 Ausschreibung neu terminiert',
    'Gate 5 Realisierung neu terminiert', 'Gate 2 Vorstudien bestätigt',
    'Gate 6 Bewirtschaftung neu terminiert'
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
  /* UTC throughout. The weekday was tested on the local date and the stamp
     written from the UTC one, so east of Greenwich every entry landed a day
     early — thirty-six of them on a Sunday — and the file depended on the
     time zone of the machine that ran this. */
  const today = new Date(META.today + 'T00:00:00Z');
  const stamp = (back) => {
    const d = new Date(today.getTime() - back * 86400000);
    // The federal administration does not book changes at the weekend.
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 2);
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
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

const changes = core('changes');
write('changes', [...changes, ...changeLog()]);

/* Committed credit by year of realisation, derived rather than asserted. */
const dashboard = read('dashboard');
/* Which year a quarter belongs to, derived so it cannot fall short of the window. */
const YEAR_OF = QUARTER_CAL.map(c => String(c.year));
const BUCKET_YEARS = [...new Set(YEAR_OF)].slice(0, 3);
const buckets = { later: [0, 0] };
for (const y of BUCKET_YEARS) buckets[y] = [0, 0];
for (const p of projects) {
  if (p.credit === null) continue;
  const build = p.bars.find(b => b.phase === '53');   // tender to commissioning
  const key = !build ? 'later' : (YEAR_OF[Math.min(QUARTERS - 1, Math.max(0, build.from))] ?? 'later');
  const bucket = buckets[key] ?? buckets.later;
  bucket[0] += p.credit;
  bucket[1] += 1;
}
dashboard.creditByYear.rows = [
  ...BUCKET_YEARS.map(y => [y, buckets[y]]),
  [`${Number(BUCKET_YEARS.at(-1)) + 1} und später`, buckets.later]
].map(([label, [sum, count]]) => ({
  label,
  value: Math.round(sum * 10) / 10,
  valueLabel: (Math.round(sum * 10) / 10).toFixed(1).replace('.', ',') + ' Mio.',
  note: `${count} Projekte`
}));

/*
 * Organisation — the team a piece of work sits in.
 *
 * It is really an attribute of a person: a team owns its members, not their
 * projects. The prototype carries it on the project anyway, because that is
 * what the grouping reads and what a denormalised feed would hand us; moving
 * it to the roster later is a change of source, not of shape.
 *
 * Derived, never drawn. A draw here would take a number off the shared
 * generator and reshuffle every value produced after it — the whole fixture,
 * for one new field. Deriving from the lead's place in the roster also keeps
 * the grouping honest: a project whose lead sits in Team B has no business
 * appearing under Team C. The five projects with no lead follow their own
 * position instead, so none of them is left without a team to group under.
 */
/*
 * The six organisational units as ePPM names them, in ePPM's order. Two
 * development teams, three domestic construction teams, one for abroad. The
 * ids are stable slugs so a shared link survives a renaming.
 */
const TEAMS = [
  { id: 'ppe-1', label: 'Programm- und Projektentwicklung I', short: 'PPE I' },
  { id: 'ppe-2', label: 'Programm- und Projektentwicklung II', short: 'PPE II' },
  { id: 'bpi-1', label: 'Bauprojekte Inland I', short: 'PM Inland I' },
  { id: 'bpi-2', label: 'Bauprojekte Inland II', short: 'PM Inland II' },
  { id: 'bpi-3', label: 'Bauprojekte Inland III', short: 'PM Inland III' },
  { id: 'bpa', label: 'Bauprojekte Ausland', short: 'PM Ausland' }
];
const teamOfPerson = new Map(people.map((person, i) => [person.id, TEAMS[i % TEAMS.length].id]));
/*
 * A person belongs to a team; a project does not. Its organisation is its
 * assignee's, joined in the app when it is read, so an unassigned project has
 * none and a re-assignment moves the project with the person.
 */
people.forEach(person => { person.organisation = teamOfPerson.get(person.id); });
/* The short form is the house's own — «PPE» and «PM» — and is what a
   grid column has room for; the filter and the group headings say the name. */
META.organisations = TEAMS.map(({ id, label, short }) => ({ id, label, short }));

/* The window has one definition; the app reads it from here. */
META.quarters = QUARTER_CAL.map((c, i) => ({
  id: QUARTER_IDS[i], label: `Q${c.q}/${c.year}`, short: `Q${c.q}`, year: c.year
}));
write('meta', META);
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
