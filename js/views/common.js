// Éléments partagés par les écrans : ligne de dépense, feuille de modification, petits utilitaires.

import * as expenses from '../expenses.js';
import {
  formatAmount, cleanAmountInput, parseAmount, centsToInput, dayOf, timeOf, formatShortDate, normalizeTime
} from '../format.js';

export const $ = (id) => document.getElementById(id);

export const AMOUNT_ERROR = 'Montant invalide : chiffres uniquement, 2 décimales au plus, plus grand que zéro.';
export const LABEL_ERROR = 'Indique un libellé.';

let onChange = () => {};
let editingId = null;

export function errorText(prefix, err) {
  return prefix + (err && err.message ? err.message : String(err));
}

export function attachAmountFilter(input) {
  input.addEventListener('input', () => {
    const cleaned = cleanAmountInput(input.value);
    if (cleaned !== input.value) input.value = cleaned;
  });
}

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

// Ligne de dépense.
// mode « day »      : libellé, heure dessous, montant
// mode « history »  : « 10:24:37 — Essence », montant
// mode « upcoming » : « lun. 5 oct. — Loyer », montant
export function expenseRow(expense, mode, { isNew = false } = {}) {
  const li = document.createElement('li');
  li.className = 'expense-item' + (expense.planned ? ' is-planned' : '');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'expense-row' + (isNew ? ' is-new' : '');
  button.addEventListener('click', () => openEdit(expense.id));

  // Les dépenses créées par une récurrente n'ont pas d'heure réelle (00:00:00) : on ne l'affiche pas.
  const fromRecurring = Boolean(expense.recurringId) && timeOf(expense.at) === '00:00:00';
  const main = document.createElement('span');
  main.className = 'expense-main';
  if (mode === 'day') {
    main.append(span('expense-label', expense.label),
      span('expense-time', fromRecurring ? 'Récurrente' : timeOf(expense.at)));
  } else {
    const when = mode === 'upcoming' ? formatShortDate(dayOf(expense.at)) : fromRecurring ? '' : timeOf(expense.at);
    const line = span('expense-line', '');
    if (when) line.append(span('expense-time-inline', when + ' — '));
    line.append(span('expense-label', expense.label));
    main.append(line);
  }
  if (expense.planned) main.append(span('badge', fromRecurring ? 'Prévue · récurrente' : 'Prévue'));

  const right = document.createElement('span');
  right.className = 'expense-right';
  right.append(span('expense-amount', formatAmount(expense.amount)));
  button.append(main, right);
  li.appendChild(button);

  // Une prévue se confirme d'un tap (même avant sa date, si elle est payée en avance).
  if (expense.planned) {
    const paid = document.createElement('button');
    paid.type = 'button';
    paid.className = 'paid-button';
    paid.textContent = 'Payée';
    paid.setAttribute('aria-label', 'Marquer « ' + expense.label + ' » comme payée');
    paid.addEventListener('click', () => confirmPaid(expense.id));
    li.appendChild(paid);
  }
  return li;
}

export async function confirmPaid(id) {
  try {
    await expenses.confirmPaid(id);
    onChange();
  } catch (err) {
    window.alert(errorText("La confirmation n'a pas pu être enregistrée : ", err));
  }
}

// --- Feuille de modification (commune à tous les écrans) ---

export function openEdit(id) {
  const expense = expenses.get(id);
  if (!expense) return;
  editingId = id;
  $('edit-amount').value = centsToInput(expense.amount);
  $('edit-label').value = expense.label;
  $('edit-date').value = dayOf(expense.at);
  $('edit-time').value = timeOf(expense.at);
  $('edit-error').textContent = '';
  $('edit-planned-note').hidden = !expense.planned;
  $('btn-edit-paid').hidden = !expense.planned;
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
  let raw = $('edit-time').value;
  if (amount === null) { error.textContent = AMOUNT_ERROR; return; }
  if (!label) { error.textContent = LABEL_ERROR; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { error.textContent = 'Indique une date.'; return; }
  // L'iPhone ne propose souvent que les heures et minutes : on garde les secondes d'origine
  // si l'heure n'a pas changé.
  if (/^\d{2}:\d{2}$/.test(raw) && timeOf(expense.at).startsWith(raw)) raw = timeOf(expense.at);
  const time = normalizeTime(raw);
  if (!time) { error.textContent = 'Indique une heure.'; return; }
  try {
    await expenses.update(editingId, { amount, label, at: day + 'T' + time });
    closeEdit();
    onChange();
  } catch (err) {
    error.textContent = errorText("La modification n'a pas pu être enregistrée : ", err);
  }
}

async function onPaid() {
  const id = editingId;
  closeEdit();
  await confirmPaid(id);
}

async function onDelete() {
  const expense = expenses.get(editingId);
  if (!expense) return closeEdit();
  if (!window.confirm('Supprimer « ' + expense.label + ' » (' + formatAmount(expense.amount) + ') ?')) return;
  try {
    await expenses.remove(editingId);
    closeEdit();
    onChange();
  } catch (err) {
    $('edit-error').textContent = errorText("La suppression n'a pas pu être faite : ", err);
  }
}

export function initCommon(callbacks) {
  onChange = callbacks.onChange;
  attachAmountFilter($('edit-amount'));
  $('edit-form').addEventListener('submit', onSave);
  $('btn-edit-cancel').addEventListener('click', closeEdit);
  $('btn-edit-delete').addEventListener('click', onDelete);
  $('btn-edit-paid').addEventListener('click', onPaid);
}
