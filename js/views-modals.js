/* =============================================================================
   views-modals.js — the dialogs: a project's detail sheet, a phase, a gate,
   sharing the view, the account, and the office's settings.

   They share one shell (scrim, role="dialog", one close button) and differ
   only in their body, so they live together and away from the grid.
   ============================================================================= */

import {
  data, state, t, num, fmt, fmtFte, unitSuffix, projectDemand, heatStep, phaseOf, eppmOf,
  nowIndex, deDate,
  settingText, settingTyped, settingValue, settingChanges,
  roleOf, holdersAt, unstaffedAt
} from './store.js';

import { html, icons, attr } from './ui.js';

/**
 * One dialog head for all four: the same close button was written out four
 * times, so it could drift four ways.
 */
/*
 * What the application would send by e-mail. Three switches rather than one,
 * because the three differ in how often they fire: a gate on your own project
 * is rare and worth an interruption, somebody else's edit is not, and the
 * digest is what somebody who wants neither still wants once a week.
 */
const MAIL_PREFS = [
  { key: 'milestones', label: 'Meilensteine meiner Projekte',
    note: 'Sobald ein Termin verschoben wird oder ein Auftrag hängig bleibt.' },
  { key: 'changes', label: 'Änderungen durch andere',
    note: 'Umbuchungen und Pensumsänderungen an Projekten, die ich führe.' },
  { key: 'digest', label: 'Wöchentliche Zusammenfassung',
    note: 'Montags: Auslastung, überfällige Meilensteine, offene Zuweisungen.' }
];

/*
 * Account settings. Two things, and a sentence about the third.
 *
 * There is no password field and no permissions tab, because there is nothing
 * here to change: access is federated through eIAM, and a dialog that offered
 * to change a password would be lying about where the account lives. Saying so
 * costs one line and stops the question being asked.
 */
function settingsModal() {
  const m = data.meta;
  const langs = data.i18n.languages;

  return html`
    ${modalHead(t('Konto'), m.user.name, `${t(m.user.role)} · ${t(m.org.unit)}`)}

    <div class="settings">
      <section class="settings__block">
        <h3 class="settings__title">${t('E-Mail-Benachrichtigungen')}</h3>
        ${MAIL_PREFS.map(pref => html`<label class="settings__row">
          <input type="checkbox" data-act="mail-pref" data-val="${pref.key}"
                 ${attr(state.account.mail[pref.key], 'checked')}>
          <span>
            <span class="settings__label">${t(pref.label)}</span>
            <span class="settings__note">${t(pref.note)}</span>
          </span>
        </label>`)}
      </section>

      <section class="settings__block">
        <h3 class="settings__title">${t('Sprache')}</h3>
        <p class="settings__note settings__note--lead">${t('Gilt für diese Anwendung und für E-Mails.')}</p>
        <div class="settings__langs" role="radiogroup" aria-label="${t('Sprache')}">
          ${langs.map(l => html`<label class="settings__row settings__row--inline">
            <input type="radio" name="account-lang" data-act="account-lang" data-val="${l.code}"
                   ${attr(state.account.lang === l.code, 'checked')}
                   ${attr(!l.available, 'disabled')}>
            <span>
              <span class="settings__label">${l.label}</span>
              ${l.available ? '' : html`<span class="settings__note">${t('noch nicht übersetzt')}</span>`}
            </span>
          </label>`)}
        </div>
      </section>

      <p class="settings__eiam">${t('Berechtigungen, Kennwort und Zwei-Faktor-Anmeldung werden über eIAM verwaltet.')}</p>
    </div>

    <footer class="modal__foot">
      <button type="button" class="btn btn--primary" data-act="close-modal">${t('Fertig')}</button>
    </footer>`;
}

/* -----------------------------------------------------------------------------
   The office's settings — the dialog behind the gear in the header
   -------------------------------------------------------------------------- */

/*
 * Not the account dialog above. That one is the reader's own — their mail,
 * their language. These are the office's: how much of a contract a unit may
 * spend on projects, and where a small project ends. Nobody expects them to
 * change — moving a project share means moving contracts — so the dialog is a
 * place to look the rule up first, and a form second. It saves all its fields
 * at once, and closing it any other way leaves the rules as they were.
 */

/*
 * One field. Text with a numeric keyboard rather than type="number": the
 * dialog re-renders as it is typed in, and a number input refuses the caret
 * position the render loop hands back to it.
 */
function settingField(key, { label, unit }) {
  const typed = settingTyped(key);
  const invalid = typed === null;
  const changed = !invalid && typed !== settingValue(key);
  return html`<span class="setfield ${invalid ? 'is-invalid' : ''} ${changed ? 'is-changed' : ''}">
    <input type="text" inputmode="decimal" autocomplete="off" value="${settingText(key)}"
           data-act="setting-input" data-val="${key}" data-fk="setting:${key}"
           aria-label="${label}" aria-invalid="${invalid}">
    <span>${unit}</span>
  </span>`;
}

function rulesModal() {
  const changes = settingChanges();
  const invalid = changes === null;
  const pending = !invalid && changes.length > 0;

  return html`
    ${modalHead(t(data.meta.org.app), t('Einstellungen'),
      t('Diese Regeln gelten für alle. Eine Änderung bewertet die Auslastung aller Personen und Quartale neu und wird im Verlauf festgehalten.'))}

    <section class="modal__section">
      <h3>${t('Projektanteil je Organisation')}</h3>
      <p class="settings__note settings__note--lead">${t('Anteil der Anstellung, der für Projekte eingesetzt werden darf')}.
        ${t('Der Rest ist Linien- und Administrationsarbeit.')}</p>
      <div class="settable">
        <div class="settable__row settable__row--head">
          <span>${t('Organisation')}</span>
          <span class="settable__num">${t('Personen')}</span>
          <span class="settable__num">${t('Projektanteil')}</span>
          <span class="settable__num settable__extra">${t('Für Projekte verfügbar')}</span>
        </div>
        ${data.meta.organisations.map(o => {
          const people = data.people.filter(p => p.organisation === o.id);
          const share = settingTyped(`share:${o.id}`);
          /* What the unit could then carry, as the field is typed. A person with
             a share of their own keeps it, whatever the unit's becomes. */
          const available = share === null ? null
            : people.reduce((a, p) => a + p.employment * (p.projectShare ?? share) / 100, 0);
          return html`<div class="settable__row">
            <span class="settable__name">${t(o.label)} <span class="settable__short">(${t(o.short)})</span></span>
            <span class="settable__num">${people.length}</span>
            <span class="settable__num">${settingField(`share:${o.id}`, { label: `${t('Projektanteil')} ${t(o.label)}`, unit: '%' })}</span>
            <span class="settable__num settable__extra">${available === null ? '—' : `${fmtFte(available)} FTE`}</span>
          </div>`;
        })}
      </div>
    </section>

    <section class="modal__section">
      <h3>${t('Projektgrösse')}</h3>
      <p class="settings__note settings__note--lead">${t('Darüber gilt ein Projekt als Grossprojekt.')}</p>
      <div class="settable">
        <!-- The same table as above — a head and a row, in the same columns, with
             the count's left empty — so this field stands under theirs. -->
        <div class="settable__row settable__row--head">
          <span>${t('Kategorie')}</span>
          <span></span>
          <span class="settable__num">${t('Kredit')} ${t('bis')}</span>
        </div>
        <div class="settable__row">
          <span class="settable__name">${t('Kleinprojekte')}</span>
          <span></span>
          <span class="settable__num">${settingField('small', { label: `${t('Kleinprojekte')}: ${t('Kredit')} ${t('bis')}`, unit: t('Mio. CHF') })}</span>
        </div>
      </div>
    </section>

    <footer class="modal__foot">
      <span class="setnote ${invalid ? 'is-invalid' : ''}" role="status">${invalid
        ? t('Ungültiger Wert: Projektanteil 1 – 100 %, Schwelle grösser als 0.')
        : pending ? `${changes.length} ${t(changes.length === 1 ? 'ungespeicherte Änderung' : 'ungespeicherte Änderungen')}` : ''}</span>
      <button type="button" class="btn" data-act="close-modal">${t('Abbrechen')}</button>
      <button type="button" class="btn btn--primary" data-act="settings-save"
              ${attr(!pending, 'disabled')}>${t('Speichern')}</button>
    </footer>`;
}

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

/* One entry per dialog; app.js sets state.modal.type to one of these keys.
   Setting a pensum or choosing a person is not one of them — both are typed
   or picked in the grid's own cells, see laneRow() in views-overview.js —
   and neither is a person: the Personen table folds open and says the rest. */
const MODALS = {
  settings: settingsModal,     // the account: the reader's own mail and language
  rules: rulesModal,           // the office's settings, behind the gear
  phase: phaseModal,
  milestone: milestoneModal,
  project: projectModal,
  share: shareModal
};

export function renderModal() {
  if (!state.modal) return '';
  const build = MODALS[state.modal.type];
  if (!build) return '';
  const body = build(state.modal);
  /* A builder that found nothing to show returns nothing; an empty dialog
     with a label pointing nowhere is not a fallback. */
  if (!body) return '';
  return html`<div class="scrim" data-act="close-modal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop>${body}</div>
  </div>`;
}

/**
 * The URL already carries tab, view, filters, grouping, unit and search, so the
 * share dialog only has to show it and make it easy to take.
 */
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
  const cat = data.milestoneCatalog[m.code];
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const planQ = data.quarters[data.quarterIndex[m.plan]];
  const foreQ = m.forecast ? data.quarters[data.quarterIndex[m.forecast]] : null;
  const moved = m.forecast && m.forecast !== m.plan;

  const facts = [
    { term: 'Projekt', value: p.title, sub: `${p.number} · ${t(data.portfoliosById[p.portfolio].label)}` },
    { term: 'Phase (ePPM)', value: t(phaseOf(m.subPhase).label) },
    { term: 'Plantermin', value: `${planQ.label} · ${deDate(m.planDate)}` },
    {
      term: 'Prognose',
      value: foreQ ? `${foreQ.label} · ${deDate(m.forecastDate)}` : t('offen'),
      sub: m.impact ? t(m.impact) : null,
      tone: moved || !foreQ ? 'danger' : null
    },
    { term: 'Bearbeitender', value: lead ? lead.name : t('nicht zugewiesen') }
  ];

  return html`
    ${modalHead(t(m.statusLabel), cat ? t(cat.name) : m.code)}

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
  const sub = phaseOf(bar.phase);
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
    { term: 'Bearbeitender', value: lead ? lead.name : t('nicht zugewiesen') }
  ];

  // The number is already in the title; the kicker names the kind of thing.
  const kicker = bar.delay ? t('Verzug') : t('Phase (ePPM)');
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
  const cells = projectDemand(p);
  const now = nowIndex();
  const q0 = data.quarters[now];
  const n = data.quarters.length;
  const nextMs = data.milestones.items
    .filter(m => m.projectId === p.id)
    .sort((a, b) => a.planDate.localeCompare(b.planDate))[0];
  const nextName = nextMs && data.milestoneCatalog[nextMs.code]?.name;
  const log = data.changes.filter(c => c.projectId === p.id);

  /*
   * Who is on the project this quarter, role by role and with how much, and
   * who is still to come: somebody whose part starts later.
   */
  const active = holdersAt(p, now);
  const nameOf = a => (a.person ? data.peopleById[a.person]?.name : t('offen'));
  const firstOf = a => a.demand.findIndex(v => v > 0);
  const staffed = p.assignees.filter(a => a.demand[now] > 0)
    .map(a => `${nameOf(a)} (${t(roleOf(a.role).label)})`);
  const ahead = p.assignees.filter(a => !(a.demand[now] > 0) && firstOf(a) > now)
    .map(a => `${t(roleOf(a.role).label)} ${t('ab')} ${data.quarters[firstOf(a)].label}: ${
      a.person ? data.peopleById[a.person]?.shortName : t('offen')}`);

  /* The runs of quarters somebody carries a pensum in, as [from, to) pairs. */
  const runsOf = demand => {
    const out = [];
    let start = -1;
    demand.forEach((v, q) => {
      if (v > 0 && start < 0) start = q;
      if (!(v > 0) && start >= 0) { out.push([start, q]); start = -1; }
    });
    if (start >= 0) out.push([start, demand.length]);
    return out;
  };

  // The wireframe is explicit: five facts, always the same, in this order.
  const facts = [
    {
      term: 'Phase (ePPM)',
      value: t(eppmOf(p.phase).label),
      sub: `${t('Phase')} ${data.phases.eppm.findIndex(e => e.id === p.phase) + 1} ${t('von')} ${data.phases.eppm.length}`
    },
    {
      term: `${t('Bearbeitende')} ${q0.label}`,
      value: `${active.size} ${t(active.size === 1 ? 'Person' : 'Personen')}`,
      sub: [...staffed, ...ahead].join(' · ') || t('Pensum offen'),
      tone: unstaffedAt(p, now) ? 'warn' : null
    },
    {
      term: `${t('Pensum')} ${q0.label}`,
      value: fmt(cells[now]),
      sub: `${t('Soll')} ${fmt(p.target)} · ${cells[now] > p.target ? t('über Soll') : t('im Soll')} · ${t('Summe über alle Rollen')}`,
      tone: cells[now] > p.target ? 'danger' : null
    },
    {
      term: 'Kredit CHF',
      value: t(p.creditLabel),
      sub: p.preCredit ? t('Freigabe steht aus') : t('Kredit freigegeben')
    },
    {
      term: 'Nächster Meilenstein',
      value: nextMs ? `${t(nextName ?? nextMs.code)} · ${deDate(nextMs.planDate)}` : '—',
      sub: nextMs ? t(nextMs.statusLabel).replace('▲ ', '') : t('kein Gate im Zeitraum'),
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

    <!-- One line per role and person: the pensum this quarter, and under it
         the band of when they hold the role, over the whole window. -->
    <section class="modal__section">
      <h3>${t('Bearbeitende')}</h3>
      ${p.assignees.length ? html`<div class="rolelist">
        ${p.assignees.map(a => {
          const name = a.person ? data.peopleById[a.person]?.name : t('nicht zugewiesen');
          return html`<div class="rolelist__row">
            <div class="rolelist__head">
              <span class="rolelist__role">${t(roleOf(a.role).label)}</span>
              <span class="rolelist__holder ${a.person ? '' : 'is-open'}">${name}</span>
              <span class="rolelist__now">${t('Pensum')} ${q0.short}: ${fmt(a.demand[now])}</span>
            </div>
            <div class="roleband" aria-hidden="true">
              ${runsOf(a.demand).map(([from, to]) => {
                const span = to - from === 1 ? data.quarters[from].label
                  : `${data.quarters[from].label} – ${data.quarters[to - 1].label}`;
                return html`<span class="roleband__seg ${a.person ? '' : 'is-open'}"
                  style="left:${(from / n * 100).toFixed(2)}%;width:${((to - from) / n * 100).toFixed(2)}%"
                  title="${name} · ${span}">${span}</span>`;
              })}
            </div>
          </div>`;
        })}
        <div class="roleband__axis" aria-hidden="true">
          ${data.quarters.map((q, i) => (q.short === 'Q1'
            ? html`<span style="left:${(i / n * 100).toFixed(2)}%">${q.year}</span>` : ''))}
        </div>
      </div>` : html`<p class="settings__note">${t('Keine Rollen geplant.')}</p>`}
    </section>

    <section class="modal__section">
      <h3>${t('Pensum je Quartal')} · ${t('Summe über alle Rollen')}</h3>
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
      <button type="button" class="btn" data-act="open-schedule" data-val="${p.id}">${t('Termine anzeigen')}</button>
      <button type="button" class="btn btn--primary" data-act="noop">${t('Im ePPM öffnen')}</button>
    </footer>`;
}

