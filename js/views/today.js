// Écran « Aujourd'hui » : saisie rapide, liste et total du jour, modification et suppression.

import * as expenses from '../expenses.js';
import {
  formatAmount, formatLongDate, cleanAmountInput, parseAmount, centsToInput,
  toLocalStamp, dayToDate, today, dayOf, timeOf
} from '../format.js';

const $ = (id) => document.getElementById(id);

let currentDay = today();
let editingId = null;

const AMOUNT_ERROR = 'Montant invalide : chiffres uniquement, 2 décimales au plus, plus grand que zéro.';
const LABEL_ERROR = 'Indique un libellé.';

function attachAmountFilter(input) {
  input.addEventListener('input', () => {
    const cleaned = cleanAmountInput(input.value);
    if (cleaned !== input.value) input.value = cleaned;
  });
}

function row(expense, isNew) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'expense-row' + (isNew ? ' is-new' : '');
  button.dataset.id = expense.id;

  const main = document.createElement('span');
  main.className = 'expense-main';
  const label = document.createElement('span');
  label.className = 'expense-label';
  label.textContent = expense.label;
  const time = document.createElement('span');
  time.className = 'expense-time';
  time.textContent = timeOf(expense.at);
  main.append(label, time);

  const amount = document.createElement('span');
  amount.className = 'expense-amount';
  amount.textContent = formatAmount(expense.amount);

  button.append(main, amount);
  button.addEventListener('click', () => openEdit(expense.id));
  li.appendChild(button);
  return li;
}

export function render(newId) {
  // Si minuit est passé pendant l'utilisation, on revient sur le nouveau jour.
  currentDay = today();
  $('today-date').textContent = formatLongDate(dayToDate(currentDay));
  const list = expenses.forDay(currentDay);
  const ul = $('day-list');
  ul.textContent = '';
  list.forEach((e) => ul.appendChild(row(e, e.id === newId)));
  $('day-total').textContent = formatAmount(expenses.total(list));
  $('day-empty').hidden = list.length > 0;
}

async function onAdd(event) {
  event.preventDefault();
  const amountInput = $('add-amount');
  const labelInput = $('add-label');
  const error = $('add-error');
  const amount = parseAmount(amountInput.value);
  const label = labelInput.value.trim();
  if (amount === null) {
    error.textContent = AMOUNT_ERROR;
    amountInput.focus();
    return;
  }
  if (!label) {
    error.textContent = LABEL_ERROR;
    labelInput.focus();
    return;
  }
  error.textContent = '';
  try {
    // Date et heure exactes du téléphone, à la seconde, au moment de la validation.
    const saved = await expenses.add({ amount, label, at: toLocalStamp(new Date()) });
    amountInput.value = '';
    labelInput.value = '';
    if (document.activeElement) document.activeElement.blur();
    render(saved.id);
  } catch (err) {
    error.textContent = "La dépense n'a pas pu être enregistrée : " + (err && err.message ? err.message : err);
  }
}

// --- Modification ---

function openEdit(id) {
  const expense = expenses.get(id);
  if (!expense) return;
  editingId = id;
  $('edit-amount').value = centsToInput(expense.amount);
  $('edit-label').value = expense.label;
  $('edit-date').value = dayOf(expense.at);
  $('edit-date').max = today(); // les dates futures (dépenses prévues) arrivent à l'étape 4
  $('edit-time').value = timeOf(expense.at);
  $('edit-error').textContent = '';
  $('edit-sheet').hidden = false;
}

export function closeEdit() {
  editingId = null;
  $('edit-sheet').hidden = true;
  $('edit-form').reset();
}

async function onSave(event) {
  event.preventDefault();
  const expense = expenses.get(editingId);
  if (!expense) return closeEdit();
  const error = $('edit-error');
  const amount = parseAmount($('edit-amount').value);
  const label = $('edit-label').value.trim();
  const day = $('edit-date').value;
  let time = $('edit-time').value;
  if (amount === null) { error.textContent = AMOUNT_ERROR; return; }
  if (!label) { error.textContent = LABEL_ERROR; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { error.textContent = 'Indique une date.'; return; }
  if (day > today()) { error.textContent = 'Les dates futures arriveront avec les dépenses prévues.'; return; }
  if (/^\d{2}:\d{2}$/.test(time)) {
    // L'iPhone ne propose souvent que les heures et minutes : on garde les secondes d'origine
    // si l'heure n'a pas changé, sinon :00.
    time += timeOf(expense.at).startsWith(time) ? timeOf(expense.at).slice(5) : ':00';
  }
  if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) { error.textContent = 'Indique une heure.'; return; }
  try {
    await expenses.update(editingId, { amount, label, at: day + 'T' + time });
    closeEdit();
    render();
  } catch (err) {
    error.textContent = "La modification n'a pas pu être enregistrée : " + (err && err.message ? err.message : err);
  }
}

async function onDelete() {
  const expense = expenses.get(editingId);
  if (!expense) return closeEdit();
  const ok = window.confirm('Supprimer « ' + expense.label + ' » (' + formatAmount(expense.amount) + ') ?');
  if (!ok) return;
  try {
    await expenses.remove(editingId);
    closeEdit();
    render();
  } catch (err) {
    $('edit-error').textContent = "La suppression n'a pas pu être faite : " + (err && err.message ? err.message : err);
  }
}

export function init() {
  attachAmountFilter($('add-amount'));
  attachAmountFilter($('edit-amount'));
  $('add-form').addEventListener('submit', onAdd);
  // « Suivant » sur le clavier du montant passe au libellé.
  $('add-amount').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('add-label').focus();
    }
  });
  $('edit-form').addEventListener('submit', onSave);
  $('btn-edit-cancel').addEventListener('click', closeEdit);
  $('btn-edit-delete').addEventListener('click', onDelete);
}
