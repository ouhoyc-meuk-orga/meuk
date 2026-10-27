// Dépenses : chargement, ajout, modification, suppression, dépenses prévues.
//
// Chaque fiche de la base (magasin « records ») est chiffrée :
//   en clair : { id, box }            (identifiant aléatoire + contenu chiffré)
//   chiffré  : une dépense            { type: 'expense', v: 1, amount, label, at, planned?, recurringId?, month? }
//              ou une récurrente       { type: 'recurring', v: 1, amount, label, day, start, last, category? }  (voir recurring.js)
//              ou une règle de catégorie { type: 'rule', v: 1, key, category }  (correction apprise, voir plus bas)
//              ou un réglage de catégorie { type: 'category', v: 1, catId, color, name?, icon?, custom? }
//                (couleur choisie, ou catégorie créée par l'utilisateur ; voir categories.js)
//     amount : centimes entiers > 0
//     label  : texte libre, obligatoire
//     at     : date et heure locales « 2026-10-04T10:24:37 »
//     planned: true pour une dépense « prévue » (hors de tous les totaux) jusqu'à confirmation « Payée »
//     card   : 'debit' = « déjà réglé » (vert) ; 'credit' = à régler (rouge, par défaut).
//              Absent (anciennes fiches) : « déjà réglé » pour une dépense de récurrente, à régler sinon.
//     category: catégorie choisie à la main (voir categories.js). Absente : catégorie devinée d'après le libellé.
// Les données déchiffrées ne vivent qu'en mémoire, tant que l'app est déverrouillée.

import * as db from './db.js';
import { encryptRecord, decryptRecord, newId } from './crypto.js';
import { getDataKey } from './vault.js';
import { dayOf, today, MAX_CENTS } from './format.js';
import * as cats from './categories.js';
import { normalizeLabel, guessFromKeywords } from './categories.js';

export const MAX_LABEL = 100;

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

let expenses = new Map();
let recurrings = new Map();
let rules = new Map();      // libellé normalisé → { id, category }
let unreadable = 0;

function validAmountLabel(v) {
  return Number.isInteger(v.amount) && v.amount > 0 && v.amount <= MAX_CENTS &&
    typeof v.label === 'string' && v.label.trim() !== '' && v.label.length <= MAX_LABEL;
}

// Une catégorie inconnue (ex. catégorie personnelle supprimée) reste valide : la dépense est alors
// classée automatiquement, comme si elle n'en avait pas.
const validCategory = (c) => c === undefined || cats.isCategoryId(c);

function validCategorySetting(v) {
  if (!cats.isCategoryId(v.catId) || !cats.isPaletteKey(v.color)) return false;
  if (v.custom === undefined) return v.name === undefined && v.icon === undefined;
  return v.custom === true && typeof v.name === 'string' && v.name.trim() !== '' &&
    v.name.length <= cats.MAX_CATEGORY_NAME && cats.isIconKey(v.icon);
}

export function isValid(v) {
  if (!v || typeof v !== 'object') return false;
  if (v.type === 'category') return validCategorySetting(v);
  if (!validCategory(v.category)) return false;
  if (v.type === 'rule') {
    return typeof v.key === 'string' && v.key !== '' && v.key.length <= MAX_LABEL && v.category !== undefined;
  }
  if (v.type === 'expense') {
    return validAmountLabel(v) && typeof v.at === 'string' && STAMP.test(v.at) &&
      (v.planned === undefined || typeof v.planned === 'boolean') &&
      (v.card === undefined || v.card === 'credit' || v.card === 'debit') &&
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
  else if (value.type === 'rule') rules.set(value.key, { id, category: value.category });
  else if (value.type === 'category') cats.applySetting(id, value);
}

// Déchiffre toutes les fiches (au déverrouillage).
export async function load() {
  const key = getDataKey();
  const records = await db.getAllRecords();
  expenses = new Map();
  recurrings = new Map();
  rules = new Map();
  cats.resetSettings();
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
  rules = new Map();
  cats.resetSettings();
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
  for (const [key, rule] of rules) if (rule.id === id) rules.delete(key);
  cats.forgetSetting(id);
}

// --- Dépenses ---

// Une dépense créée sur une date future est « prévue ».
// paid : dépense déjà réglée même si sa date est future (récurrente payée d'avance).
export function add({ amount, label, at, planned, paid, recurringId, month, card, category }) {
  const item = { id: newId(), type: 'expense', v: 1, amount, label: label.trim(), at };
  if (card) item.card = card;
  if (category) item.category = category;
  if (!paid && (planned || dayOf(at) > today())) item.planned = true;
  if (recurringId) item.recurringId = recurringId;
  if (month) item.month = month;
  return saveValue(item);
}

// Modifier la date vers le futur rend la dépense « prévue » ; une prévue le reste jusqu'à « Payée ».
// category : catégorie choisie à la main (absente : celle de la fiche est conservée).
export function update(id, { amount, label, at, card, category }) {
  const current = expenses.get(id);
  if (!current) throw new Error('Dépense introuvable.');
  const item = { ...current, amount, label: label.trim(), at };
  if (card) item.card = card;
  if (category) item.category = category;
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

// Historique : toutes les dépenses jusqu'à aujourd'hui, plus les dépenses futures DÉJÀ PAYÉES
// (ex. récurrente payée d'avance), de la plus récente à la plus ancienne. Les prévues futures n'y sont pas.
export function forHistory() {
  const t = today();
  return all().filter((e) => dayOf(e.at) <= t || !e.planned).sort(byTimeDesc);
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

// « Déjà réglé » (vert) ? Sinon à régler (rouge).
export function isDebit(e) {
  return e.card ? e.card === 'debit' : Boolean(e.recurringId);
}

// --- Catégories ---

// Catégorie devinée pour un libellé : d'abord les corrections de l'utilisateur, puis les mots-clés.
export function guessCategory(label) {
  const rule = rules.get(normalizeLabel(label));
  return rule && cats.isCategory(rule.category) ? rule.category : guessFromKeywords(label);
}

// Catégorie affichée : choisie à la main, sinon devinée.
export function categoryOf(item) {
  return item.category && cats.isCategory(item.category) ? item.category : guessCategory(item.label);
}

// L'utilisateur a choisi une catégorie à la main : elle est retenue pour ce libellé. Les dépenses de même
// libellé sans catégorie choisie la prennent aussi. La règle est chiffrée comme les dépenses.
export async function learnCategory(label, category) {
  const key = normalizeLabel(label);
  if (!key || !cats.isCategory(category)) return;
  const current = rules.get(key);
  if (current && current.category === category) return;
  if (!current && guessFromKeywords(label) === category) return;
  await saveValue({ id: current ? current.id : newId(), type: 'rule', v: 1, key: key.slice(0, MAX_LABEL), category });
}

// --- Réglages des catégories ---

// Couleur d'une catégorie intégrée, ou création / modification d'une catégorie personnelle.
// Renvoie l'identifiant de la catégorie.
export async function saveCategory({ catId, color, name, icon }) {
  const current = catId ? cats.settingFor(catId) : undefined;
  const existing = catId ? cats.getCategory(catId) : undefined;
  if (catId && !existing) throw new Error('Catégorie introuvable.');
  if (!existing && cats.customCount() >= cats.MAX_CUSTOM_CATEGORIES) {
    throw new Error('Nombre maximal de catégories atteint (' + cats.MAX_CUSTOM_CATEGORIES + ').');
  }
  let value;
  if (existing && !existing.custom) {
    value = { type: 'category', v: 1, catId, color };
  } else {
    const clean = String(name || '').trim().slice(0, cats.MAX_CATEGORY_NAME);
    if (!clean) throw new Error('Indique un nom.');
    value = { type: 'category', v: 1, catId: catId || 'perso-' + newId().slice(0, 16), color, name: clean, icon, custom: true };
  }
  await saveValue({ id: current ? current.recordId : newId(), ...value });
  return value.catId;
}

// Supprime une catégorie personnelle (ou remet la couleur d'origine d'une catégorie intégrée).
// Les dépenses et les règles qui y menaient sont classées automatiquement à nouveau.
export async function deleteCategorySetting(catId) {
  const current = cats.settingFor(catId);
  if (current) await deleteValue(current.recordId);
}
