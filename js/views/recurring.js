// Écran « Récurrentes » : créer, modifier, supprimer les dépenses récurrentes.

import * as recurring from '../recurring.js';
import { formatAmount, parseAmount, centsToInput } from '../format.js';
import { $, attachAmountFilter, AMOUNT_ERROR, LABEL_ERROR, errorText } from './common.js';

let editingId = null;
let onChange = () => {};

export function render() {
  const ul = $('recurring-list');
  ul.textContent = '';
  const items = recurring.list();
  for (const rec of items) {
    const li = document.createElement('li');
    li.className = 'kind-recurring';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'expense-row';
    const main = document.createElement('span');
    main.className = 'expense-main';
    const label = document.createElement('span');
    label.className = 'expense-label';
    label.textContent = rec.label;
    const when = document.createElement('span');
    when.className = 'expense-time';
    when.textContent = 'Le ' + (rec.day === 1 ? '1er' : rec.day) + ' de chaque mois';
    main.append(label, when);
    const amount = document.createElement('span');
    amount.className = 'expense-amount';
    amount.textContent = formatAmount(rec.amount);
    button.append(main, amount);
    button.addEventListener('click', () => openSheet(rec.id));
    li.appendChild(button);
    ul.appendChild(li);
  }
  $('recurring-empty').hidden = items.length > 0;
}

function openSheet(id) {
  editingId = id || null;
  const rec = id ? recurring.list().find((r) => r.id === id) : null;
  $('rec-title').textContent = rec ? 'Modifier la récurrente' : 'Nouvelle récurrente';
  $('rec-amount').value = rec ? centsToInput(rec.amount) : '';
  $('rec-label').value = rec ? rec.label : '';
  $('rec-day').value = rec ? String(rec.day) : '';
  $('rec-error').textContent = '';
  $('rec-edit-note').hidden = !rec;
  $('btn-rec-delete').hidden = !rec;
  $('rec-sheet').hidden = false;
}

export function closeSheet() {
  editingId = null;
  $('rec-sheet').hidden = true;
  $('rec-form').reset();
}

async function onSave(event) {
  event.preventDefault();
  const error = $('rec-error');
  const amount = parseAmount($('rec-amount').value);
  const label = $('rec-label').value.trim();
  const day = parseInt($('rec-day').value, 10);
  if (amount === null) { error.textContent = AMOUNT_ERROR; return; }
  if (!label) { error.textContent = LABEL_ERROR; return; }
  if (!(day >= 1 && day <= 31)) { error.textContent = 'Choisis le jour du mois (1 à 31).'; return; }
  try {
    if (editingId) await recurring.update(editingId, { amount, label, day });
    else await recurring.create({ amount, label, day });
    closeSheet();
    onChange();
  } catch (err) {
    error.textContent = errorText("La récurrente n'a pas pu être enregistrée : ", err);
  }
}

async function onDelete() {
  const rec = recurring.list().find((r) => r.id === editingId);
  if (!rec) return closeSheet();
  if (!window.confirm('Supprimer la récurrente « ' + rec.label + ' » ?\nLes dépenses déjà créées sont conservées.')) return;
  try {
    await recurring.remove(editingId);
    closeSheet();
    onChange();
  } catch (err) {
    $('rec-error').textContent = errorText("La suppression n'a pas pu être faite : ", err);
  }
}

export function init(callbacks) {
  onChange = callbacks.onChange;
  const select = $('rec-day');
  for (let d = 1; d <= 31; d++) {
    const option = document.createElement('option');
    option.value = String(d);
    option.textContent = d === 1 ? '1er' : String(d);
    select.appendChild(option);
  }
  attachAmountFilter($('rec-amount'));
  $('btn-rec-add').addEventListener('click', () => openSheet(null));
  $('rec-form').addEventListener('submit', onSave);
  $('btn-rec-cancel').addEventListener('click', closeSheet);
  $('btn-rec-delete').addEventListener('click', onDelete);
}
