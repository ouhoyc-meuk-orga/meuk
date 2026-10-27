// Écran « Récapitulatif » : total du mois (dépenses réelles), nombre de dépenses, jours avec leur total
// (un appui sur un jour déplie ses opérations) ;
// les prévues du mois apparaissent grisées, sans total : « Date passée — à confirmer » puis « Prévues ce mois-ci ». Pour les mois à venir, les récurrentes sont
// montrées à l'avance (et peuvent être payées d'avance).

import * as expenses from '../expenses.js';
import { formatAmount, formatMonth, formatDayOfMonth, dayOf, today } from '../format.js';
import { currentMonth, nextMonth, previousMonth, projected } from '../recurring.js';
import { $, expenseRow } from './common.js';
import { CATEGORIES, categoryBadge, categoryName } from '../categories.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let openCategory = null;   // catégorie affichée dans la feuille de détail (ou null)

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
  openCategory = null;
  $('cat-sheet').hidden = true;
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
  renderCategories(real);

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

// --- Par catégorie : camembert (anneau) + liste ---

function byCategory(real) {
  const sums = new Map();
  for (const e of real) {
    const id = expenses.categoryOf(e);
    sums.set(id, (sums.get(id) || 0) + e.amount);
  }
  const order = CATEGORIES.map((c) => c.id);
  return [...sums].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]));
}

function percent(part, whole) {
  const p = Math.round((part / whole) * 100);
  return p === 0 ? '< 1 %' : p + ' %';
}

function renderCategories(real) {
  const total = expenses.total(real);
  const parts = byCategory(real);
  $('recap-cats').hidden = total === 0;
  const svg = $('recap-donut');
  svg.textContent = '';
  const ul = $('recap-cat-list');
  ul.textContent = '';
  if (openCategory) renderCategorySheet();
  if (total === 0) return;

  // Anneau : un arc par catégorie, dans sa couleur, séparés par un petit espace.
  const r = 62;
  const circumference = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 2.5 : 0;
  let offset = 0;
  for (const [id, sum] of parts) {
    const length = (sum / total) * circumference;
    const arc = document.createElementNS(SVG_NS, 'circle');
    arc.setAttribute('class', 'donut-arc cat-' + id);
    arc.setAttribute('cx', '80');
    arc.setAttribute('cy', '80');
    arc.setAttribute('r', String(r));
    arc.setAttribute('stroke-dasharray', Math.max(length - gap, 1.5) + ' ' + circumference);
    arc.setAttribute('stroke-dashoffset', String(-offset));
    arc.setAttribute('transform', 'rotate(-90 80 80)');
    arc.addEventListener('click', () => openCategorySheet(id));
    svg.appendChild(arc);
    offset += length;
  }
  $('recap-cat-count').textContent = String(parts.length);
  $('recap-cat-unit').textContent = parts.length === 1 ? 'catégorie' : 'catégories';

  for (const [id, sum] of parts) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cat-legend-row';
    const name = document.createElement('span');
    name.className = 'cat-legend-name';
    name.textContent = categoryName(id);
    const amount = document.createElement('span');
    amount.className = 'cat-legend-amount';
    amount.textContent = formatAmount(sum);
    const pct = document.createElement('span');
    pct.className = 'cat-legend-pct';
    pct.textContent = percent(sum, total);
    button.append(categoryBadge(id), name, amount, pct, chevronRight());
    button.addEventListener('click', () => openCategorySheet(id));
    li.appendChild(button);
    ul.appendChild(li);
  }
}

function chevronRight() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'cat-legend-chevron');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M9 5l7 7-7 7');
  svg.appendChild(path);
  return svg;
}

// Feuille de détail : les dépenses réelles du mois dans cette catégorie.
function openCategorySheet(id) {
  openCategory = id;
  renderCategorySheet();
  $('cat-sheet').hidden = false;
}

function renderCategorySheet() {
  const id = openCategory;
  const list = expenses.forMonth(month).filter((e) => !e.planned && expenses.categoryOf(e) === id);
  $('cat-title').textContent = categoryName(id);
  const badge = $('cat-sheet-badge');
  badge.textContent = '';
  badge.appendChild(categoryBadge(id, 'cat-badge-large'));
  $('cat-sheet-month').textContent = formatMonth(month) + ' · ' +
    (list.length === 1 ? '1 dépense' : list.length + ' dépenses');
  $('cat-sheet-total').textContent = formatAmount(expenses.total(list));
  const ul = $('cat-sheet-list');
  ul.textContent = '';
  list.forEach((e) => ul.appendChild(expenseRow(e, 'upcoming', { swipe: true })));
}

export function closeCategorySheet() {
  openCategory = null;
  $('cat-sheet').hidden = true;
}

export function init() {
  $('btn-cat-close').addEventListener('click', closeCategorySheet);
  $('recap-prev').addEventListener('click', () => changeMonth(previousMonth(month)));
  $('recap-next').addEventListener('click', () => changeMonth(nextMonth(month)));
}
