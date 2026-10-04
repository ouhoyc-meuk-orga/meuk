// Écran « Récapitulatif » : total du mois (dépenses réelles), nombre de dépenses, jours avec leur total ;
// les prévues du mois apparaissent grisées, sans total.

import * as expenses from '../expenses.js';
import { formatAmount, formatMonth, formatDayOfMonth, dayOf } from '../format.js';
import { currentMonth, nextMonth, previousMonth } from '../recurring.js';
import { $, expenseRow } from './common.js';

let month = currentMonth();
let onOpenDay = () => {};

export function showCurrentMonth() {
  month = currentMonth();
  render();
}

export function render() {
  $('recap-month').textContent = formatMonth(month);
  $('recap-next').disabled = false;

  const list = expenses.forMonth(month);
  const real = list.filter((e) => !e.planned);
  const planned = list.filter((e) => e.planned).reverse();
  $('recap-total').textContent = formatAmount(expenses.total(real));
  $('recap-count').textContent = real.length === 0 ? 'Aucune dépense'
    : real.length === 1 ? '1 dépense' : real.length + ' dépenses';

  const days = new Map();
  for (const e of real) {
    const day = dayOf(e.at);
    days.set(day, (days.get(day) || 0) + e.amount);
  }
  const ul = $('recap-days');
  ul.textContent = '';
  for (const [day, sum] of days) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'expense-row';
    const name = document.createElement('span');
    name.className = 'expense-label';
    name.textContent = formatDayOfMonth(day);
    const amount = document.createElement('span');
    amount.className = 'expense-amount';
    amount.textContent = formatAmount(sum);
    button.append(name, amount);
    button.addEventListener('click', () => onOpenDay(day));
    li.appendChild(button);
    ul.appendChild(li);
  }

  const pl = $('recap-planned');
  pl.textContent = '';
  planned.forEach((e) => pl.appendChild(expenseRow(e, 'upcoming')));
  $('recap-planned-title').hidden = planned.length === 0;
}

export function init(callbacks) {
  onOpenDay = callbacks.onOpenDay;
  $('recap-prev').addEventListener('click', () => { month = previousMonth(month); render(); });
  $('recap-next').addEventListener('click', () => { month = nextMonth(month); render(); });
}
