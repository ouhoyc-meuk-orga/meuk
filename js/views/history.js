// Écran « Historique » : tous les jours jusqu'à aujourd'hui (plus les dépenses futures déjà payées),
// du plus récent au plus ancien, groupés par jour avec le total (réel) de chaque jour. Au-dessus
// d'aujourd'hui, « À venir ce mois-ci » : le montant cumulé des prévues restantes du mois.
// Glisser une dépense vers la gauche → poubelle.

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

  // « À venir ce mois-ci » : montant cumulé des prévues restantes du mois, juste au-dessus d'aujourd'hui.
  const t = today();
  const month = t.slice(0, 7);
  const upcoming = expenses.upcoming().filter((e) => e.at.startsWith(month + '-'));
  let summary = null;
  if (upcoming.length) {
    summary = document.createElement('div');
    summary.className = 'upcoming-summary';
    const name = document.createElement('span');
    name.textContent = 'À venir ce mois-ci';
    const sum = document.createElement('span');
    sum.className = 'upcoming-total';
    sum.textContent = formatAmount(upcoming.reduce((total, e) => total + e.amount, 0));
    summary.append(name, sum);
  }

  const days = new Map();
  for (const e of expenses.forHistory()) {
    const day = dayOf(e.at);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(e);
  }
  for (const [day, items] of days) {
    // Les jours futurs (dépenses déjà payées d'avance) viennent en premier ; « À venir » se place
    // juste avant le premier jour qui n'est pas dans le futur.
    if (summary && day <= t) {
      box.appendChild(summary);
      summary = null;
    }
    // Un jour qui n'a que des prévues n'affiche pas de total (elles n'entrent dans aucun total).
    const total = expenses.realCount(items) > 0 ? expenses.total(items) : null;
    box.appendChild(group(formatDayHeader(day), total, items, 'history'));
  }
  if (summary) box.appendChild(summary);
  $('history-empty').hidden = days.size > 0 || upcoming.length > 0;
}
