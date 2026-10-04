// Écran « Historique » : tous les jours jusqu'à aujourd'hui, du plus récent au plus ancien,
// groupés par jour avec le total (réel) de chaque jour ; « À venir » en haut s'il y a des prévues futures.

import * as expenses from '../expenses.js';
import { formatAmount, formatDayHeader, dayOf } from '../format.js';
import { $, expenseRow } from './common.js';

function group(title, total, items, mode) {
  const section = document.createElement('section');
  section.className = 'day-group';
  const header = document.createElement('div');
  header.className = 'day-group-header';
  const name = document.createElement('span');
  name.textContent = title;
  header.appendChild(name);
  if (total !== null) {
    const sum = document.createElement('span');
    sum.className = 'day-group-total';
    sum.textContent = formatAmount(total);
    header.appendChild(sum);
  }
  const ul = document.createElement('ul');
  ul.className = 'list expense-list';
  items.forEach((e) => ul.appendChild(expenseRow(e, mode)));
  section.append(header, ul);
  return section;
}

export function render() {
  const box = $('history-content');
  box.textContent = '';

  const upcoming = expenses.upcoming();
  if (upcoming.length) box.appendChild(group('À VENIR', null, upcoming, 'upcoming'));

  const days = new Map();
  for (const e of expenses.untilToday()) {
    const day = dayOf(e.at);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(e);
  }
  for (const [day, items] of days) {
    // Un jour qui n'a que des prévues n'affiche pas de total (elles n'entrent dans aucun total).
    const total = expenses.realCount(items) > 0 ? expenses.total(items) : null;
    box.appendChild(group(formatDayHeader(day), total, items, 'history'));
  }
  $('history-empty').hidden = days.size > 0 || upcoming.length > 0;
}
