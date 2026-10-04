// Écran « Récapitulatif » : total du mois (dépenses réelles), nombre de dépenses, jours avec leur total ;
// les prévues du mois apparaissent grisées, sans total. Pour les mois à venir, les récurrentes sont
// montrées à l'avance (et peuvent être payées d'avance).

import * as expenses from '../expenses.js';
import { formatAmount, formatMonth, formatDayOfMonth, dayOf } from '../format.js';
import { currentMonth, nextMonth, previousMonth, projected } from '../recurring.js';
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
  // Prévues du mois + (mois à venir) récurrentes montrées à l'avance, de la plus proche à la plus lointaine.
  const planned = list.filter((e) => e.planned).concat(projected(month))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
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
