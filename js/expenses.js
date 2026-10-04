// Dépenses : chargement, ajout, modification, suppression, dépenses prévues.
//
// Chaque fiche de la base (magasin « records ») est chiffrée :
//   en clair : { id, box }            (identifiant aléatoire + contenu chiffré)
//   chiffré  : une dépense            { type: 'expense', v: 1, amount, label, at, planned?, recurringId?, month? }
//              ou une récurrente       { type: 'recurring', v: 1, amount, label, day, start, last }  (voir recurring.js)
//     amount : centimes entiers > 0
//     label  : texte libre, obligatoire
//     at     : date et heure locales « 2026-10-04T10:24:37 »
//     planned: true pour une dépense « prévue » (hors de tous les totaux) jusqu'à confirmation « Payée »
// Les données déchiffrées ne vivent qu'en mémoire, tant que l'app est déverrouillée.

import * as db from './db.js';
import { encryptRecord, decryptRecord, newId } from './crypto.js';
import { getDataKey } from './vault.js';
import { dayOf, today, MAX_CENTS } from './format.js';

export const MAX_LABEL = 100;

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

let expenses = new Map();
let recurrings = new Map();
let unreadable = 0;

function validAmountLabel(v) {
  return Number.isInteger(v.amount) && v.amount > 0 && v.amount <= MAX_CENTS &&
    typeof v.label === 'string' && v.label.trim() !== '' && v.label.length <= MAX_LABEL;
}

export function isValid(v) {
  if (!v || typeof v !== 'object') return false;
  if (v.type === 'expense') {
    return validAmountLabel(v) && typeof v.at === 'string' && STAMP.test(v.at) &&
      (v.planned === undefined || typeof v.planned === 'boolean') &&
      (v.recurringId === undefined || typeof v.recurringId === 'string') &&
      (v.month === undefined || (typeof v.month === 'string' && MONTH.test(v.month)));
  }
  if (v.type === 'recurring') {
    return validAmountLabel(v) && Number.isInteger(v.day) && v.day >= 1 && v.day <= 31 &&
      typeof v.start === 'string' && MONTH.test(v.start) &&
      (v.last === null || (typeof v.last === 'string' && MONTH.test(v.last)));
  }
  return false;
}

function keep(id, value) {
  if (value.type === 'expense') expenses.set(id, { id, ...value });
  else if (value.type === 'recurring') recurrings.set(id, { id, ...value });
}

// Déchiffre toutes les fiches (au déverrouillage).
export async function load() {
  const key = getDataKey();
  const records = await db.getAllRecords();
  expenses = new Map();
  recurrings = new Map();
  unreadable = 0;
  for (const record of records) {
    try {
      const value = await decryptRecord(key, record.id, record.box);
      if (isValid(value)) keep(record.id, value);
      else unreadable++;
    } catch (err) {
      unreadable++;
    }
  }
}

// Nombre de fiches impossibles à déchiffrer ou invalides (ne devrait jamais arriver).
export function unreadableCount() {
  return unreadable;
}

export function clear() {
  expenses = new Map();
  recurrings = new Map();
}

// Enregistre une fiche (dépense ou récurrente), chiffrée.
export async function saveValue(item) {
  const { id, ...value } = item;
  if (!isValid(value)) throw new Error('Données invalides.');
  const box = await encryptRecord(getDataKey(), id, value);
  await db.putRecord({ id, box });
  keep(id, value);
  return { id, ...value };
}

export async function deleteValue(id) {
  await db.deleteRecord(id);
  expenses.delete(id);
  recurrings.delete(id);
}

// --- Dépenses ---

// Une dépense créée sur une date future est « prévue ».
export function add({ amount, label, at, planned, recurringId, month }) {
  const item = { id: newId(), type: 'expense', v: 1, amount, label: label.trim(), at };
  if (planned || dayOf(at) > today()) item.planned = true;
  if (recurringId) item.recurringId = recurringId;
  if (month) item.month = month;
  return saveValue(item);
}

// Modifier la date vers le futur rend la dépense « prévue » ; une prévue le reste jusqu'à « Payée ».
export function update(id, { amount, label, at }) {
  const current = expenses.get(id);
  if (!current) throw new Error('Dépense introuvable.');
  const item = { ...current, amount, label: label.trim(), at };
  if (dayOf(at) > today()) item.planned = true;
  return saveValue(item);
}

// Confirmation « Payée » : la dépense garde sa date et son heure prévues.
export function confirmPaid(id) {
  const current = expenses.get(id);
  if (!current) throw new Error('Dépense introuvable.');
  const { planned, ...rest } = current;
  return saveValue(rest);
}

export function remove(id) {
  return deleteValue(id);
}

export function get(id) {
  return expenses.get(id);
}

export function all() {
  return [...expenses.values()];
}

const byTimeDesc = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
const byTimeAsc = (a, b) => -byTimeDesc(a, b);

// Dépenses d'un jour, de la plus récente à la plus ancienne.
export function forDay(day) {
  return all().filter((e) => dayOf(e.at) === day).sort(byTimeDesc);
}

// Dépenses d'un mois « 2026-10 », de la plus récente à la plus ancienne.
export function forMonth(month) {
  return all().filter((e) => e.at.startsWith(month + '-')).sort(byTimeDesc);
}

// Toutes les dépenses jusqu'à aujourd'hui inclus, de la plus récente à la plus ancienne.
export function untilToday() {
  const t = today();
  return all().filter((e) => dayOf(e.at) <= t).sort(byTimeDesc);
}

// Prévues dont la date est passée ou aujourd'hui : à confirmer.
export function dueToConfirm() {
  const t = today();
  return all().filter((e) => e.planned && dayOf(e.at) <= t).sort(byTimeAsc);
}

// Prévues à venir (après aujourd'hui), de la plus proche à la plus lointaine.
export function upcoming() {
  const t = today();
  return all().filter((e) => e.planned && dayOf(e.at) > t).sort(byTimeAsc);
}

// Total des dépenses RÉELLES : les prévues n'entrent dans aucun total.
export function total(list) {
  return list.reduce((sum, e) => sum + (e.planned ? 0 : e.amount), 0);
}

export function realCount(list) {
  return list.filter((e) => !e.planned).length;
}

// --- Accès pour les récurrentes et les sauvegardes ---

export function allRecurring() {
  return [...recurrings.values()];
}

export function getRecurring(id) {
  return recurrings.get(id);
}
