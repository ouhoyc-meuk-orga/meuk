// Écran « Historique » : tous les jours jusqu'à aujourd'hui, du plus récent au plus ancien,
// groupés par jour avec le total (réel) de chaque jour. En haut, « À venir ce mois-ci » : le montant
// cumulé des dépenses prévues restantes du mois. Glisser une dépense vers la gauche → poubelle.

import * as expenses from '../expenses.js';
import { formatAmount, formatDayHeader, dayOf, today } from '../format.js';
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
  items.forEach((e) => ul.appendChild(expenseRow(e, mode, { swipe: true })));
  section.append(header, ul);
  return section;
}

export function render() {
  const box = $('history-content');
  box.textContent = '';

  const month = today().slice(0, 7);
  const upcoming = expenses.upcoming().filter((e) => e.at.startsWith(month + '-'));
  if (upcoming.length) {
    const card = document.createElement('div');
    card.className = 'upcoming-summary';
    const name = document.createElement('span');
    name.textContent = 'À venir ce mois-ci';
    const sum = document.createElement('span');
    sum.className = 'upcoming-total';
    sum.textContent = formatAmount(upcoming.reduce((total, e) => total + e.amount, 0));
    card.append(name, sum);
    box.appendChild(card);
  }

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
