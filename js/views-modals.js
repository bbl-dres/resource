/* =============================================================================
   views-modals.js — the four dialogs: a project's detail sheet, giving a
   project a lead, moving a pensum to somebody else, and sharing the view.

   They share one shell (scrim, role="dialog", one close button) and differ
   only in their body, so they live together and away from the grid.
   ============================================================================= */

import {
  data, state, t, num, fmt, unitSuffix, cellValue, projectDemand, heatStep, personUtilisation
} from './store.js';

import { html, icons, phaseOf, attr } from './ui.js';

/**
 * One dialog head for all four: the same close button was written out four
 * times, so it could drift four ways.
 */
function modalHead(kicker, title, meta = '') {
  return html`<header class="modal__head">
    <div>
      <p class="modal__kicker">${kicker}</p>
      <h2 class="modal__title" id="modal-title">${title}</h2>
      ${meta ? html`<p class="modal__meta-line">${meta}</p>` : ''}
    </div>
    <button type="button" class="modal__close" data-act="close-modal"
            aria-label="${t('Schliessen')}">${icons.close(15)}</button>
  </header>`;
}

export function renderModal() {
  if (!state.modal) return '';
  const body = state.modal.type === 'phase' ? phaseModal(state.modal)
    : state.modal.type === 'milestone' ? milestoneModal(state.modal)
    : state.modal.type === 'project' ? projectModal(state.modal)
    : state.modal.type === 'share' ? shareModal(state.modal)
      : state.modal.type === 'assign' ? assignModal(state.modal)
        : rebookModal(state.modal);
  return html`<div class="scrim" data-act="close-modal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop>${body}</div>
  </div>`;
}

/**
 * The URL already carries tab, view, filters, grouping, unit and search, so the
 * share dialog only has to show it and make it easy to take.
 */
/** Give a project a lead, or hand it to somebody else. */
function assignModal({ projectId, search = '', targetId }) {
  const project = data.projectsById[projectId];
  const current = project.leadId ? data.peopleById[project.leadId] : null;
  const query = search.trim().toLowerCase();
  const candidates = data.people.filter(x => !query || x.name.toLowerCase().includes(query));

  return html`
    ${modalHead(t('Projektleitung'), project.title, current
      ? `${t('Aktuell')}: ${current.name} · ${personUtilisation(current.id, 0)} %`
      : t('Aktuell nicht zugewiesen'))}

    <div class="rebook__to">
      <label class="dd__searchfield">
        ${icons.search(15)}
        <input type="search" role="combobox" aria-expanded="true" aria-controls="assign-list"
               data-act="assign-search" data-fk="assign-search" value="${search}"
               placeholder="${t('Person suchen')}" aria-label="${t('Person suchen')}" autocomplete="off">
      </label>
      <ul class="rebook__list" id="assign-list" role="listbox" aria-label="${t('Person wählen')}">
        ${candidates.length ? candidates.map(c => html`<li role="option" tabindex="-1"
            aria-selected="${c.id === targetId}" class="${c.id === targetId ? 'is-on' : ''}"
            data-act="assign-target" data-val="${c.id}">
          <span>${c.name}</span>
          <span class="rebook__role">${c.role} · ${personUtilisation(c.id, 0)} %</span>
        </li>`) : html`<li class="rebook__empty">${t('Keine Person gefunden.')}</li>`}
      </ul>
    </div>

    <footer class="modal__foot">
      ${current && html`<button type="button" class="btn btn--danger modal__foot-left"
        data-act="assign-clear">${t('Zuweisung aufheben')}</button>`}
      <button type="button" class="btn" data-act="close-modal">${t('Abbrechen')}</button>
      <button type="button" class="btn btn--primary" data-act="assign-apply" ${attr(!targetId, 'disabled')}>${t('Zuweisen')}</button>
    </footer>`;
}

function shareModal({ copied }) {
  return html`
    ${modalHead(t('Teilen'), t('Diese Ansicht teilen'))}

    <div class="share">
      <label class="share__field">
        <span class="sr-only">${t('Link')}</span>
        <input type="text" readonly value="${location.href}" data-fk="share-url"
               data-act="share-select" aria-label="${t('Link')}">
      </label>
      <button type="button" class="btn btn--primary" data-act="share-copy">
        ${copied ? icons.check(15) : icons.externalLink(15)}${copied ? t('Kopiert') : t('Link kopieren')}
      </button>
    </div>`;
}

/**
 * A gate is a date and a consequence, so the dialog stays at that: what it is,
 * when it was planned, when it is now expected, and why if those differ.
 */
function milestoneModal({ milestoneId }) {
  const m = data.milestones.items.find(x => x.id === milestoneId);
  if (!m) return '';
  const p = data.projectsById[m.projectId];
  const cat = data.milestones.catalog.find(c => c.code === m.code);
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const planQ = data.quarters[data.quarterIndex[m.plan]];
  const foreQ = m.forecast ? data.quarters[data.quarterIndex[m.forecast]] : null;
  const moved = m.forecast && m.forecast !== m.plan;

  const facts = [
    { term: 'Projekt', value: p.title, sub: `${p.number} · ${t(data.portfoliosById[p.portfolio].label)}` },
    { term: 'SIA-Teilphase', value: phaseOf(m.subPhase).label },
    { term: 'Plantermin', value: `${planQ.label} · ${deDate(m.planDate)}` },
    {
      term: 'Prognose',
      value: foreQ ? `${foreQ.label} · ${deDate(m.forecastDate)}` : t('offen'),
      sub: m.impact ? t(m.impact) : null,
      tone: moved || !foreQ ? 'danger' : null
    },
    { term: 'Projektleitung', value: lead ? lead.name : t('nicht zugewiesen') }
  ];

  return html`
    ${modalHead(`${m.code} · ${t(m.statusLabel)}`, cat ? t(cat.name) : m.code)}

    <dl class="facts">
      ${facts.map(f => html`<div class="facts__row">
        <dt>${t(f.term)}</dt>
        <dd class="${f.tone ? `is-${f.tone}` : ''}">${f.value}
          ${f.sub ? html`<span class="facts__sub">${f.sub}</span>` : ''}</dd>
      </div>`)}
    </dl>

    <footer class="modal__foot">
      <button type="button" class="btn" data-act="open-project" data-val="${p.id}">${t('Projekt öffnen')}</button>
      <button type="button" class="btn btn--primary" data-act="noop">${t('Im ePPM öffnen')}</button>
    </footer>`;
}

/**
 * A phase is a stretch of time with a workload attached, so the dialog answers
 * exactly that — and says plainly when the stretch is a delay rather than work.
 */
function phaseModal({ projectId, from }) {
  const p = data.projectsById[projectId];
  const bar = p?.bars.find(x => x.from === from);
  if (!bar) return '';
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const sub = data.phases.sub[bar.phase];
  const cells = projectDemand(p);

  const first = Math.max(0, bar.from);
  const last = Math.min(data.quarters.length - 1, bar.to - 1);
  const within = cells.slice(first, last + 1);
  const peak = within.length ? Math.max(...within) : 0;
  const quarters = bar.to - bar.from;

  const facts = [
    { term: 'Projekt', value: p.title, sub: `${p.number} · ${t(data.portfoliosById[p.portfolio].label)}` },
    {
      term: 'Zeitraum',
      value: `${data.quarters[first].label} – ${data.quarters[last].label}`,
      sub: `${quarters} ${t(quarters === 1 ? 'Quartal' : 'Quartale')}${bar.continues ? ` · ${t('läuft weiter')}` : ''}`
    },
    {
      term: 'Pensum in dieser Phase',
      value: within.length ? `${t('Spitze')} ${num(peak)}${unitSuffix()}` : '—',
      sub: within.length ? within.map(v => num(v)).join(' · ') : null
    },
    { term: 'Projektleitung', value: lead ? lead.name : t('nicht zugewiesen') }
  ];

  // The number is already in the title; the kicker names the kind of thing.
  const kicker = bar.delay ? t('Verzug') : t('SIA-Teilphase');
  const title = bar.delay ? bar.label : (sub ? t(sub.label) : bar.label);

  return html`
    ${modalHead(kicker, title)}

    <dl class="facts">
      ${facts.map(f => html`<div class="facts__row">
        <dt>${t(f.term)}</dt>
        <dd>${f.value}${f.sub ? html`<span class="facts__sub">${f.sub}</span>` : ''}</dd>
      </div>`)}
    </dl>

    <footer class="modal__foot">
      <button type="button" class="btn" data-act="open-project" data-val="${p.id}">${t('Projekt öffnen')}</button>
      <button type="button" class="btn btn--primary" data-act="noop">${t('Im ePPM öffnen')}</button>
    </footer>`;
}

function projectModal({ projectId }) {
  const p = data.projectsById[projectId];
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const cells = projectDemand(p);
  const phase = phaseOf(p.phase);
  const q0 = data.quarters[0];
  const nextMs = data.milestones.items
    .filter(m => m.projectId === p.id)
    .sort((a, b) => a.planDate.localeCompare(b.planDate))[0];
  const nextName = nextMs && data.milestones.catalog.find(c => c.code === nextMs.code)?.name;
  const log = data.changes.filter(c => c.projectId === p.id);
  const util = lead ? personUtilisation(lead.id, 0) : null;

  // The wireframe is explicit: five facts, always the same, in this order.
  const facts = [
    {
      term: 'SIA-Phase',
      value: phase.label,
      sub: `${t('Hauptphase')} ${phase.main}`
    },
    {
      term: 'Projektleitung',
      value: lead ? lead.name : t('— nicht zugewiesen'),
      sub: lead ? `${t('Auslastung')} ${q0.short}: ${util > 100 ? '▲ ' : ''}${util} %` : t('Bedarf offen'),
      tone: lead ? (util > 100 ? 'danger' : null) : 'warn'
    },
    {
      term: `${t('Pensum')} ${q0.label}`,
      value: fmt(cells[0]),
      sub: `${t('Soll')} ${fmt(p.target)} · ${cells[0] > p.target ? t('über Soll') : t('im Soll')}`,
      tone: cells[0] > p.target ? 'danger' : null
    },
    {
      term: 'Kredit CHF',
      value: p.creditLabel,
      sub: p.preCredit ? t('Freigabe steht aus') : t('Kredit freigegeben')
    },
    {
      term: 'Nächster Meilenstein',
      value: nextMs ? `${nextMs.code} · ${deDate(nextMs.planDate)}` : '—',
      sub: nextMs ? `${nextName} · ${nextMs.statusLabel.replace('▲ ', '')}` : t('kein Gate im Zeitraum'),
      tone: nextMs && nextMs.status !== 'ok' ? 'danger' : null
    }
  ];

  return html`
    ${modalHead(`${p.number} · ${t(data.portfoliosById[p.portfolio].label)} · ${p.location.split(',')[0]}`, p.title)}

    <dl class="facts">
      ${facts.map(f => html`<div class="facts__row">
        <dt>${t(f.term)}</dt>
        <dd class="${f.tone ? 'is-' + f.tone : ''}">${f.value}<span class="facts__sub">${f.sub}</span></dd>
      </div>`)}
    </dl>

    <section class="modal__section">
      <h3>${t('Pensum je Quartal')}</h3>
      <div class="minigrid">
        ${data.quarters.map((q, i) => html`<div class="minigrid__col">
          <span class="minigrid__q">${q.short}<span>/${String(q.year).slice(2)}</span></span>
          <span class="minigrid__v heat-${heatStep(cells[i])}">${num(cells[i])}</span>
        </div>`)}
      </div>
    </section>

    ${log.length ? html`<section class="modal__section">
      <h3>${t('Letzte Änderungen')}</h3>
      <ul class="modal__log">
        ${log.map(c => html`<li><span>${c.dateLabel}</span><span>${t(c.field)}</span><span>${c.change}</span><span>${c.value}</span></li>`)}
      </ul>
    </section>` : ''}

    <footer class="modal__foot">
      <button type="button" class="btn" data-act="open-termine" data-val="${p.id}">${t('In Termine öffnen')}</button>
      <button type="button" class="btn btn--primary" data-act="noop">${t('Im ePPM öffnen')}</button>
    </footer>`;
}

function deDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function rebookModal({ projectId, q, amount, targetId, quarters = 2, search = '', reason = '' }) {
  const p = data.projectsById[projectId];
  const from = p.leadId ? data.peopleById[p.leadId] : null;
  const quarter = data.quarters[q];
  const query = search.trim().toLowerCase();
  const candidates = data.people
    .filter(x => x.id !== p.leadId)
    .filter(x => !query || x.name.toLowerCase().includes(query));
  const target = targetId ? data.peopleById[targetId] : null;
  const ready = target && amount > 0 && reason.trim();

  return html`
    ${modalHead(t('Pensum umbuchen'), p.title,
      `${t('Projektleitung')} · ${t('ab')} ${quarter.label}, ${quarters} ${t('Quartale')}`)}

    <p class="modal__lead">${t('Ein Vorgang statt zwei Transaktionen: von, an, Betrag und Zeitraum ergeben einen Verlaufseintrag mit beiden Seiten.')}</p>

    <div class="rebook">
      <div class="rebook__field">
        <span class="rebook__label">${t('Von')}</span>
        <span class="rebook__readonly">${from ? from.name : t('nicht zugewiesen')}</span>
      </div>
      <div class="rebook__field rebook__field--amount">
        <label class="rebook__label" for="rebook-amount">${t('Pensum')}</label>
        <span class="rebook__amount">
          <input id="rebook-amount" type="number" min="0" max="${cellValue(p, q)}" step="5"
                 value="${amount}" data-act="rebook-amount" data-fk="rebook-amount">
          <span>%</span>
        </span>
      </div>
      <div class="rebook__field rebook__field--quarters">
        <label class="rebook__label" for="rebook-quarters">${t('Dauer')}</label>
        <span class="rebook__amount">
          <input id="rebook-quarters" type="number" min="1" max="${data.quarters.length - q}" step="1"
                 value="${quarters}" data-act="rebook-quarters" data-fk="rebook-quarters">
          <span>${t('Quartale')}</span>
        </span>
      </div>
    </div>

    <div class="rebook__to">
      <span class="rebook__label">${t('An')}</span>
      <label class="dd__searchfield">
        ${icons.search(15)}
        <input type="search" role="combobox" aria-expanded="true" aria-controls="rebook-list"
               data-act="rebook-search" data-fk="rebook-search" value="${search}"
               placeholder="${t('Person suchen — Name oder Kürzel')}" aria-label="${t('Person suchen')}" autocomplete="off">
      </label>
      <ul class="rebook__list" id="rebook-list" role="listbox" aria-label="${t('Person wählen')}">
        ${candidates.length ? candidates.map(c => html`<li role="option" tabindex="-1"
            aria-selected="${c.id === targetId}" class="${c.id === targetId ? 'is-on' : ''}"
            data-act="rebook-target" data-val="${c.id}">
          <span>${c.name}</span><span class="rebook__role">${c.role}</span>
        </li>`) : html`<li class="rebook__empty">${t('Keine Person gefunden.')}</li>`}
      </ul>
    </div>

    <label class="pop__reason rebook__reason">
      <span class="pop__reasonlabel">${t('Begründung')}
        <span>${t('— Pflicht bei jeder Umbuchung')}</span></span>
      <textarea rows="2" data-act="rebook-reason" data-fk="rebook-reason"
        placeholder="${t('Entlastung Projektleitung gemäss Beschluss Abteilungssitzung 24.08.2026.')}">${reason}</textarea>
    </label>

    <footer class="modal__foot">
      <button type="button" class="btn" data-act="close-modal">${t('Abbrechen')}</button>
      <button type="button" class="btn btn--primary" data-act="rebook-apply" ${attr(!ready, 'disabled')}>${t('Umbuchen')}</button>
    </footer>`;
}
