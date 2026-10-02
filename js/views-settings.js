/* =============================================================================
   views-settings.js — «Einstellungen»: the few rules of the plan that hold for
   everyone, on a page of their own behind the gear in the header.

   Not the account dialog. That one is the reader's own — their mail, their
   language. These are the office's: how much of a contract a unit may spend on
   projects, and where a small project ends. Nobody expects them to change —
   moving a project share means moving contracts — so the page is a place to
   look the rule up first, and a form second. It saves all its fields at once.
   ============================================================================= */

import {
  data, state, t, settingText, settingTyped, settingValue, settingChanges, sizeOf
} from './store.js';

import { html, attr, icons, pageHeader } from './ui.js';

/** A pensum in FTE, the Swiss way round: 1,25. */
const fte = v => (v / 100).toFixed(2).replace('.', ',');

/*
 * One field. Text with a numeric keyboard rather than type="number": the page
 * re-renders as it is typed in, and a number input refuses the caret position
 * the render loop hands back to it.
 */
function field(key, { label, unit }) {
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

function shareCard() {
  return html`<section class="bi-card">
    <header class="bi-card__head"><div>
      <h2 class="bi-card__title">${t('Projektanteil je Organisation')}</h2>
      <p class="bi-card__sub">${t('Anteil der Anstellung, der für Projekte eingesetzt werden darf')}.
        ${t('Der Rest ist Linien- und Administrationsarbeit.')}</p>
    </div></header>
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
          <span class="settable__name">${t(o.label)} <span class="settable__short">${t(o.short)}</span></span>
          <span class="settable__num">${people.length}</span>
          <span class="settable__num">${field(`share:${o.id}`, { label: `${t('Projektanteil')} ${t(o.label)}`, unit: '%' })}</span>
          <span class="settable__num settable__extra">${available === null ? '—' : `${fte(available)} FTE`}</span>
        </div>`;
      })}
    </div>
  </section>`;
}

function sizeCard() {
  const line = settingTyped('small');
  const counts = { small: 0, large: 0, open: 0 };
  if (line !== null) for (const p of data.projects) counts[sizeOf(p, line)]++;
  return html`<section class="bi-card">
    <header class="bi-card__head"><div>
      <h2 class="bi-card__title">${t('Projektgrösse')}</h2>
      <p class="bi-card__sub">${t('Darüber gilt ein Projekt als Grossprojekt.')}</p>
    </div></header>
    <div class="settable">
      <div class="settable__row settable__row--single">
        <span class="settable__name">${t('Kleinprojekte')} ${t('bis')}</span>
        <span class="settable__num">${field('small', { label: `${t('Kleinprojekte')} ${t('bis')}`, unit: t('Mio. CHF') })}</span>
        <span class="settable__num settable__extra">${line === null ? '—'
          : `${counts.small} ${t('Kleinprojekte')} · ${counts.large} ${t('Grossprojekte')} · ${counts.open} ${t('Kredit offen')}`}</span>
      </div>
    </div>
  </section>`;
}

export function renderSettings() {
  const changes = settingChanges();
  const invalid = changes === null;
  const pending = invalid || changes.length > 0;
  return html`
    ${pageHeader({
      title: 'Einstellungen',
      chrome: false,
      /* In the page head, like the print layout's download: under the cards
         the button was below the fold of a small laptop, and a field changed
         in the first row gave no sign that anything was left to do. */
      actions: html`<span class="setnote ${invalid ? 'is-invalid' : ''}" role="status">${invalid
          ? t('Ungültiger Wert: Projektanteil 1 – 100 %, Schwelle grösser als 0.')
          : pending ? `${changes.length} ${t(changes.length === 1 ? 'ungespeicherte Änderung' : 'ungespeicherte Änderungen')}` : ''}</span>
        <button type="button" class="btn" data-act="tab" data-val="overview">
          ${icons.chevronLeft(15)}${t('Zurück')}</button>
        <button type="button" class="btn" data-act="settings-discard"
                ${attr(state.settingsDraft === null, 'disabled')}>${t('Änderungen verwerfen')}</button>
        <button type="button" class="btn btn--primary" data-act="settings-save"
                ${attr(invalid || !pending, 'disabled')}>${t('Speichern')}</button>`
    })}
    <div class="wrap"><div class="content setpage">
      <p class="setpage__lead">${t('Diese Regeln gelten für alle. Eine Änderung bewertet die Auslastung aller Personen und Quartale neu und wird im Verlauf festgehalten.')}</p>
      ${shareCard()}
      ${sizeCard()}
    </div></div>`;
}
