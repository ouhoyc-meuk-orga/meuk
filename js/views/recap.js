// Écran « Récapitulatif » : total du mois (dépenses réelles), nombre de dépenses, jours avec leur total
// (un appui sur un jour déplie ses opérations) ;
// les prévues du mois apparaissent grisées, sans total : « Date passée — à confirmer » puis « Prévues ce mois-ci ». Pour les mois à venir, les récurrentes sont
// montrées à l'avance (et peuvent être payées d'avance).

import * as expenses from '../expenses.js';
import { formatAmount, formatMonth, formatDayOfMonth, dayOf, today } from '../format.js';
import { currentMonth, nextMonth, previousMonth, projected } from '../recurring.js';
import { $, expenseRow } from './common.js';

let month = currentMonth();
// Jours dépliés (gardés ouverts quand on modifie une opération ; refermés en changeant de mois).
const openDays = new Set();

function chevron() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'recap-chevron');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M6 9l6 6 6-6');
  svg.appendChild(path);
  return svg;
}

function changeMonth(value) {
  month = value;
  openDays.clear();
  render();
}

export function showCurrentMonth() {
  changeMonth(currentMonth());
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
    li.className = 'recap-day';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'expense-row';
    const name = document.createElement('span');
    name.className = 'expense-label';
    name.textContent = formatDayOfMonth(day);
    const right = document.createElement('span');
    right.className = 'expense-right';
    const amount = document.createElement('span');
    amount.className = 'expense-amount';
    amount.textContent = formatAmount(sum);
    right.append(amount, chevron());
    button.append(name, right);
    li.appendChild(button);

    // Un appui déplie (ou replie) les opérations du jour, juste sous la ligne.
    const ops = document.createElement('ul');
    ops.className = 'list expense-list recap-day-ops';
    const fill = () => {
      ops.textContent = '';
      expenses.forDay(day).filter((e) => !e.planned)
        .forEach((e) => ops.appendChild(expenseRow(e, 'history', { swipe: true })));
    };
    const setOpen = (open) => {
      li.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      ops.hidden = !open;
      if (open) fill();
    };
    button.addEventListener('click', () => {
      const open = !openDays.has(day);
      if (open) openDays.add(day); else openDays.delete(day);
      setOpen(open);
    });
    li.appendChild(ops);
    setOpen(openDays.has(day));
    ul.appendChild(li);
  }

  // Prévues dont la date est passée (ou aujourd'hui) : « à confirmer », à valider d'un appui sur « Payée ».
  const t = today();
  const due = planned.filter((e) => dayOf(e.at) <= t);
  const coming = planned.filter((e) => dayOf(e.at) > t);
  const dl = $('recap-due');
  dl.textContent = '';
  due.forEach((e) => dl.appendChild(expenseRow(e, 'upcoming')));
  $('recap-due-title').hidden = due.length === 0;

  const pl = $('recap-planned');
  pl.textContent = '';
  coming.forEach((e) => pl.appendChild(expenseRow(e, 'upcoming')));
  $('recap-planned-title').hidden = coming.length === 0;
}

export function init() {
  $('recap-prev').addEventListener('click', () => changeMonth(previousMonth(month)));
  $('recap-next').addEventListener('click', () => changeMonth(nextMonth(month)));
}
