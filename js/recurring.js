// Dépenses récurrentes (loyer, abonnement…) et génération des dépenses prévues de chaque mois.
//
// Fiche chiffrée : { type: 'recurring', v: 1, amount, label, day, start, last }
//   day   : jour du mois (1 à 31) ; s'il n'existe pas dans le mois (ex. 31 en février) → dernier jour
//   start : premier mois concerné « 2026-10 »
//   last  : dernier mois déjà généré (ou null)
//
// Pas de traitement en arrière-plan possible : la génération se fait à chaque déverrouillage, avec
// rattrapage des mois manqués, sans jamais créer de doublon.

import * as store from './expenses.js';
import { newId } from './crypto.js';
import { today } from './format.js';

const pad = (n) => String(n).padStart(2, '0');

export function currentMonth() {
  return today().slice(0, 7);
}

export function nextMonth(month) {
  let [y, m] = month.split('-').map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return y + '-' + pad(m);
}

export function previousMonth(month) {
  let [y, m] = month.split('-').map(Number);
  m -= 1;
  if (m < 1) { m = 12; y -= 1; }
  return y + '-' + pad(m);
}

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// Jour effectif dans un mois donné : « 31 » en février → 28 ou 29.
export function dayInMonth(month, day) {
  return month + '-' + pad(Math.min(day, daysInMonth(month)));
}

export function list() {
  return store.allRecurring().sort((a, b) => a.day - b.day || a.label.localeCompare(b.label, 'fr'));
}

// Création : le mois en cours compte si le jour n'est pas encore passé, sinon on commence le mois suivant.
export async function create({ amount, label, day }) {
  const month = currentMonth();
  const start = dayInMonth(month, day) >= today() ? month : nextMonth(month);
  const item = { id: newId(), type: 'recurring', v: 1, amount, label: label.trim(), day, start, last: null };
  await store.saveValue(item);
  await generate();
  return item;
}

// Modification : n'affecte que les mois pas encore générés.
export function update(id, { amount, label, day }) {
  const current = store.getRecurring(id);
  if (!current) throw new Error('Récurrente introuvable.');
  return store.saveValue({ ...current, amount, label: label.trim(), day });
}

// Suppression : les dépenses déjà créées sont conservées.
export function remove(id) {
  return store.deleteValue(id);
}

// Crée les dépenses prévues manquantes, du premier mois non généré jusqu'au mois en cours.
export async function generate() {
  const now = currentMonth();
  let created = 0;
  for (const rec of store.allRecurring()) {
    let month = rec.last ? nextMonth(rec.last) : rec.start;
    let last = rec.last;
    while (month <= now) {
      const exists = store.all().some((e) => e.recurringId === rec.id && e.month === month);
      if (!exists) {
        await store.add({
          amount: rec.amount,
          label: rec.label,
          at: dayInMonth(month, rec.day) + 'T00:00:00',
          planned: true,
          recurringId: rec.id,
          month
        });
        created++;
      }
      last = month;
      month = nextMonth(month);
    }
    if (last !== rec.last) await store.saveValue({ ...store.getRecurring(rec.id), last });
  }
  return created;
}

// Mois à venir (après le mois en cours) : les récurrentes y sont montrées à l'avance, comme des prévues
// « virtuelles » (pas encore enregistrées), sauf si la dépense de ce mois existe déjà (payée d'avance).
export function projected(month) {
  if (month <= currentMonth()) return [];
  const out = [];
  for (const rec of store.allRecurring()) {
    if (month < rec.start || (rec.last && month <= rec.last)) continue;
    if (store.all().some((e) => e.recurringId === rec.id && e.month === month)) continue;
    out.push({
      id: 'virtuelle-' + rec.id + '-' + month,
      virtual: true,
      type: 'expense',
      amount: rec.amount,
      label: rec.label,
      at: dayInMonth(month, rec.day) + 'T00:00:00',
      planned: true,
      recurringId: rec.id,
      month
    });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

// « Payée » sur une récurrente d'un mois à venir : la dépense est créée tout de suite, déjà payée.
// La génération du mois, le moment venu, ne la recréera pas (même récurrente, même mois).
export async function payInAdvance(virtualItem) {
  const rec = store.getRecurring(virtualItem.recurringId);
  if (!rec) throw new Error('Récurrente introuvable.');
  if (store.all().some((e) => e.recurringId === rec.id && e.month === virtualItem.month)) return;
  await store.add({
    amount: rec.amount,
    label: rec.label,
    at: dayInMonth(virtualItem.month, rec.day) + 'T00:00:00',
    paid: true,
    recurringId: rec.id,
    month: virtualItem.month
  });
}
