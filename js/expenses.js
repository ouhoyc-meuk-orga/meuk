// Dépenses : chargement, ajout, modification, suppression.
//
// Chaque dépense est une fiche chiffrée de la base (magasin « records ») :
//   en clair : { id }            (identifiant aléatoire)
//   chiffré  : { type: 'expense', v: 1, amount, label, at }
//     amount : centimes entiers > 0
//     label  : texte libre, obligatoire
//     at     : date et heure locales « 2026-10-04T10:24:37 »
// Les dépenses déchiffrées ne vivent qu'en mémoire, tant que l'app est déverrouillée.

import * as db from './db.js';
import { encryptRecord, decryptRecord, newId } from './crypto.js';
import { getDataKey } from './vault.js';
import { dayOf, MAX_CENTS } from './format.js';

export const MAX_LABEL = 100;

let expenses = new Map();
let unreadable = 0;

function isValid(e) {
  return e && e.type === 'expense' &&
    Number.isInteger(e.amount) && e.amount > 0 && e.amount <= MAX_CENTS &&
    typeof e.label === 'string' && e.label.trim() !== '' &&
    typeof e.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(e.at);
}

// Déchiffre toutes les fiches (au déverrouillage).
export async function load() {
  const key = getDataKey();
  const records = await db.getAllRecords();
  expenses = new Map();
  unreadable = 0;
  for (const record of records) {
    try {
      const value = await decryptRecord(key, record.id, record.box);
      if (value.type === 'expense' && isValid(value)) expenses.set(record.id, { id: record.id, ...value });
    } catch (err) {
      unreadable++;
    }
  }
}

// Nombre de fiches impossibles à déchiffrer (ne devrait jamais arriver).
export function unreadableCount() {
  return unreadable;
}

export function clear() {
  expenses = new Map();
}

async function save(expense) {
  const { id, ...value } = expense;
  if (!isValid(value)) throw new Error('Dépense invalide.');
  const box = await encryptRecord(getDataKey(), id, value);
  await db.putRecord({ id, box });
  expenses.set(id, expense);
  return expense;
}

export function add({ amount, label, at }) {
  return save({ id: newId(), type: 'expense', v: 1, amount, label: label.trim(), at });
}

export function update(id, { amount, label, at }) {
  const current = expenses.get(id);
  if (!current) throw new Error('Dépense introuvable.');
  return save({ ...current, amount, label: label.trim(), at });
}

export async function remove(id) {
  await db.deleteRecord(id);
  expenses.delete(id);
}

export function get(id) {
  return expenses.get(id);
}

// Dépenses d'un jour, de la plus récente à la plus ancienne.
export function forDay(day) {
  return [...expenses.values()]
    .filter((e) => dayOf(e.at) === day)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function total(list) {
  return list.reduce((sum, e) => sum + e.amount, 0);
}
