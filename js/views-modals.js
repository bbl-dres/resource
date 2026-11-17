/* =============================================================================
   views-modals.js — the dialogs: a project's detail sheet, a phase, a gate,
   sharing the view, the account, and the office's settings.

   They share one shell (scrim, role="dialog", one close button) and differ
   only in their body, so they live together and away from the grid.
   ============================================================================= */

import {
  data, state, t, num, fmtFte, unitSuffix, projectDemand, phaseOf, eppmOf, deDate,
  settingText, settingTyped, settingValue, settingChanges, peopleOn, projectShare, assignmentsOf
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
   Setting a pensum is not one of them: it is typed into the grid's own
   cells, see laneCell() in views-overview.js. */
const MODALS = {
  settings: settingsModal,     // the account: the reader's own mail and language
  rules: rulesModal,           // the office's settings, behind the gear
  phase: phaseModal,
  milestone: milestoneModal,
  project: projectModal,
  person: personModal,
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
      ${eppmButton()}
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
      ${eppmButton()}
    </footer>`;
}

/*
 * The way to the system that knows the rest: SAP ePPM for a project, the
 * federal directory for a person. These dialogs end on it. It opens nothing
 * yet — the prototype has neither system behind it, and the action says so.
 */
const externalButton = label => html`<button type="button" class="btn btn--primary" data-act="noop">
  ${icons.externalLink(15)}${t(label)}</button>`;
const eppmButton = () => externalButton('In SAP ePPM öffnen');

/** The rows of a dialog's facts: a term, its value, and a line under it where there is one. */
const factList = facts => html`<dl class="facts">
  ${facts.map(f => html`<div class="facts__row">
    <dt>${t(f.term)}</dt>
    <dd>${f.value}${f.sub && html`<span class="facts__sub">${f.sub}</span>`}</dd>
  </div>`)}
</dl>`;

/*
 * A project at a glance, and nothing more: what it is called, where it sits,
 * which phase it is in, what it is worth and how many people are on it.
 *
 * It was a sheet of its own once — five facts, a band per role over ten
 * years, forty quarters of pensum and the change log — and the users found
 * it stood between them and the grid, so for a while a click on a project
 * opened nothing at all. This is what they asked back: the name is a link
 * again, and behind it are four lines and the button to SAP ePPM, where the
 * project is kept. The figures are in the row; the history is on Verlauf.
 */
function projectModal({ projectId }) {
  const p = data.projectsById[projectId];
  if (!p) return '';
  const people = peopleOn(p).map(id => data.peopleById[id]?.name).filter(Boolean);

  const facts = [
    { term: 'Teilportfolio', value: t(data.portfoliosById[p.portfolio]?.label ?? p.portfolio) },
    { term: 'Phase (ePPM)', value: t(eppmOf(p.phase).label) },
    { term: 'Kredit CHF', value: t(p.creditLabel) },
    {
      term: 'Bearbeitende',
      value: people.length ? `${people.length} ${t(people.length === 1 ? 'Person' : 'Personen')}` : t('nicht zugewiesen'),
      sub: people.join(', ')
    }
  ];

  return html`
    ${modalHead(`${t('Projekt')} ${p.number}`, p.title)}
    ${factList(facts)}
    <footer class="modal__foot">${eppmButton()}</footer>`;
}

/*
 * A person at a glance, the way the project's dialog shows a project: where
 * they sit, what they are contracted for, how much of that may go to
 * projects, and how many they are on — and the way to their page in the
 * federal directory, where the rest about a person is kept.
 *
 * There was a larger one, with the load of forty quarters and two fields to
 * change the contract. It went when the users asked for a click on a person
 * to do nothing but fold the row; this is what they asked back, for the name
 * alone. It edits nothing.
 */
function personModal({ personId }) {
  const person = data.peopleById[personId];
  if (!person) return '';
  const org = data.organisationsById[person.organisation];
  const projects = new Set(assignmentsOf(person.id).map(a => a.project.id)).size;

  const facts = [
    { term: 'Organisation', value: org ? t(org.label) : '—' },
    { term: 'Anstellung', value: `${person.employment} %` },
    { term: 'Projektanteil', value: `${projectShare(person)} %` },
    { term: 'Projekte', value: String(projects) }
  ];

  return html`
    ${modalHead(t(person.role), person.name)}
    ${factList(facts)}
    <footer class="modal__foot">${externalButton('Im Admin-Verzeichnis öffnen')}</footer>`;
}
