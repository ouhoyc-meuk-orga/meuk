// Écran « Aujourd'hui » : saisie rapide, navigation entre les jours, liste et total du jour,
// dépenses prévues, rappel des prévues à confirmer.

import * as expenses from '../expenses.js';
import {
  formatAmount, formatMonthShort, formatLongDate, parseAmount, toLocalStamp, dayToDate, today, addDays, timeOf, normalizeTime
} from '../format.js';
import { $, expenseRow, attachAmountFilter, fitAmount, AMOUNT_ERROR, LABEL_ERROR, errorText } from './common.js';

let currentDay = today();
let onChange = () => {};

export function setDay(day) {
  currentDay = day;
  $('add-error').textContent = '';
  // Autre jour qu'aujourd'hui : champ heure pré-rempli avec l'heure actuelle, modifiable.
  $('add-time').value = timeOf(toLocalStamp(new Date()));
  render();
}

export function showToday() {
  setDay(today());
}

export function render(newId) {
  const t = today();
  const isToday = currentDay === t;
  $('today-date').textContent = formatLongDate(dayToDate(currentDay));
  $('day-input').value = currentDay;
  $('btn-back-today').hidden = isToday;
  $('add-time-field').hidden = isToday;
  $('add-planned-note').hidden = currentDay <= t;

  const list = expenses.forDay(currentDay);
  const ul = $('day-list');
  ul.textContent = '';
  list.forEach((e) => ul.appendChild(expenseRow(e, 'day', { isNew: e.id === newId })));
  $('day-total').textContent = formatAmount(expenses.total(list));
  // Total (réel) du mois du jour affiché.
  $('month-total').textContent = formatAmount(expenses.total(expenses.forMonth(currentDay.slice(0, 7))));
  $('month-total-label').textContent = 'Total ' + formatMonthShort(currentDay.slice(0, 7));
  $('day-empty').hidden = list.length > 0;

  const due = expenses.dueToConfirm().length;
  $('due-reminder').hidden = due === 0;
  $('due-reminder').textContent = due === 1 ? '1 dépense prévue à confirmer' : due + ' dépenses prévues à confirmer';
  renderDue();
}

function renderDue() {
  const ul = $('due-list');
  ul.textContent = '';
  const due = expenses.dueToConfirm();
  due.forEach((e) => ul.appendChild(expenseRow(e, 'upcoming')));
  $('due-empty').hidden = due.length > 0;
}

async function onAdd(event) {
  event.preventDefault();
  const amountInput = $('add-amount');
  const labelInput = $('add-label');
  const error = $('add-error');
  const amount = parseAmount(amountInput.value);
  const label = labelInput.value.trim();
  if (amount === null) { error.textContent = AMOUNT_ERROR; amountInput.focus(); return; }
  if (!label) { error.textContent = LABEL_ERROR; labelInput.focus(); return; }

  let at;
  if (currentDay === today()) {
    // Aujourd'hui : date et heure exactes du téléphone, à la seconde, au moment de la validation.
    at = toLocalStamp(new Date());
  } else {
    const time = normalizeTime($('add-time').value);
    if (!time) { error.textContent = 'Indique une heure.'; return; }
    at = currentDay + 'T' + time;
  }
  error.textContent = '';
  try {
    // Par défaut : à régler (rouge). « Déjà réglé » activé : vert.
    const saved = await expenses.add({ amount, label, at, card: $('add-debit').checked ? 'debit' : 'credit' });
    amountInput.value = '';
    labelInput.value = '';
    fitAmount(amountInput);
    $('add-debit').checked = false;
    if (document.activeElement) document.activeElement.blur();
    onChange(saved.id);
  } catch (err) {
    error.textContent = errorText("La dépense n'a pas pu être enregistrée : ", err);
  }
}

export function init(callbacks) {
  onChange = callbacks.onChange;
  attachAmountFilter($('add-amount'));
  $('add-form').addEventListener('submit', onAdd);
  // « Suivant » sur le clavier du montant passe au libellé.
  $('add-amount').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('add-label').focus();
    }
  });
  $('day-prev').addEventListener('click', () => setDay(addDays(currentDay, -1)));
  $('day-next').addEventListener('click', () => setDay(addDays(currentDay, 1)));
  $('btn-back-today').addEventListener('click', showToday);
  // Toucher la date ouvre le calendrier d'iOS (champ date transparent posé dessus).
  $('day-input').addEventListener('change', () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test($('day-input').value)) setDay($('day-input').value);
  });
  $('due-reminder').addEventListener('click', () => { $('due-sheet').hidden = false; });
  $('btn-due-close').addEventListener('click', () => { $('due-sheet').hidden = true; });
}
