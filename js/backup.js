// Sauvegardes : export chiffré, import (fusion ou remplacement), export CSV en clair, effacement total.
//
// Fichier de sauvegarde (.meuk, texte JSON) : il ne contient QUE des données chiffrées et ce qu'il faut pour
// les déchiffrer avec la phrase de secours (sel, nombre d'itérations, clé de données chiffrée par la phrase).
// Il ne contient ni la phrase, ni la clé Face ID, ni aucune donnée en clair (seulement les identifiants).

import * as db from './db.js';
import * as c from './crypto.js';
import * as store from './expenses.js';
import { generate } from './recurring.js';
import { getDataKey } from './vault.js';
import { VERSION } from './version.js';
import { dayOf, timeOf, today, centsToInput } from './format.js';

const KIND = 'meuk-sauvegarde-chiffree';

export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function toB64(bytes) {
  let s = '';
  new Uint8Array(bytes).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function fromB64(text) {
  if (typeof text !== 'string') throw new BackupError('invalid-file');
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const boxToB64 = (box) => ({ iv: toB64(box.iv), ct: toB64(box.ct) });
const boxFromB64 = (box) => {
  if (!box || typeof box !== 'object') throw new BackupError('invalid-file');
  return { iv: fromB64(box.iv), ct: fromB64(box.ct) };
};

// --- Export chiffré ---

export async function buildEncryptedExport() {
  const vault = await db.getVault();
  const records = await db.getAllRecords();
  const content = {
    kind: KIND,
    format: 1,
    appVersion: VERSION,
    phraseSalt: toB64(vault.phraseSalt),
    phraseIterations: vault.phraseIterations,
    wrappedByPhrase: boxToB64(vault.wrappedByPhrase),
    canary: boxToB64(vault.canary),
    records: records.map((r) => ({ id: r.id, ...boxToB64(r.box) }))
  };
  const name = 'meuk-sauvegarde-' + today() + '.meuk';
  return new File([JSON.stringify(content)], name, { type: 'application/json' });
}

// --- Import ---

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new BackupError('invalid-file');
  }
  if (!data || data.kind !== KIND || data.format !== 1 || !Array.isArray(data.records)) {
    throw new BackupError('invalid-file');
  }
  return {
    phraseSalt: fromB64(data.phraseSalt),
    phraseIterations: data.phraseIterations,
    wrappedByPhrase: boxFromB64(data.wrappedByPhrase),
    canary: boxFromB64(data.canary),
    records: data.records.map((r) => {
      if (typeof r.id !== 'string' || !/^[0-9a-f]{32}$/.test(r.id)) throw new BackupError('invalid-file');
      return { id: r.id, box: { iv: fromB64(r.iv), ct: fromB64(r.ct) } };
    })
  };
}

async function canaryOk(key, box) {
  try {
    return (await c.decryptJSON(key, box)) === 'meuk';
  } catch (err) {
    return false;
  }
}

// Une sauvegarde de ce même coffre se déchiffre directement ; sinon, la phrase de secours de la sauvegarde
// est nécessaire.
export async function needsPhrase(backup) {
  return !(await canaryOk(getDataKey(), backup.canary));
}

export async function decryptBackup(backup, phraseText) {
  let key = getDataKey();
  if (phraseText !== undefined) {
    const entropy = await c.wordsToEntropy(c.splitPhrase(phraseText));
    let keyBytes;
    try {
      const kek = await c.kekFromPhrase(entropy, backup.phraseSalt, backup.phraseIterations);
      keyBytes = await c.unwrapWithPhrase(kek, backup.wrappedByPhrase);
    } catch (err) {
      throw new BackupError('wrong-phrase');
    } finally {
      c.wipe(entropy);
    }
    key = await c.importDataKey(keyBytes);
    c.wipe(keyBytes);
  }
  if (!(await canaryOk(key, backup.canary))) throw new BackupError('wrong-phrase');
  const items = [];
  for (const record of backup.records) {
    let value;
    try {
      value = await c.decryptRecord(key, record.id, record.box);
    } catch (err) {
      throw new BackupError('corrupted');
    }
    if (!store.isValid(value)) throw new BackupError('corrupted');
    items.push({ id: record.id, ...value });
  }
  return items;
}

// mode « merge »   : ajoute les fiches absentes, garde les fiches actuelles en cas de doublon ;
// mode « replace » : les données actuelles sont remplacées par celles de la sauvegarde.
// Tout est d'abord déchiffré et vérifié, et les nouvelles fiches sont écrites AVANT de supprimer les anciennes.
export async function applyImport(items, mode) {
  const existing = new Set((await db.getAllRecords()).map((r) => r.id));
  let added = 0;
  for (const item of items) {
    if (mode === 'merge' && existing.has(item.id)) continue;
    await store.saveValue(item);
    added++;
  }
  let removed = 0;
  if (mode === 'replace') {
    const keepIds = new Set(items.map((i) => i.id));
    for (const id of existing) {
      if (!keepIds.has(id)) {
        await store.deleteValue(id);
        removed++;
      }
    }
  }
  await store.load();
  await generate();
  return { added, removed };
}

// --- Export CSV (en clair) ---

function csvCell(text) {
  let value = String(text);
  // Empêche un tableur d'interpréter un libellé comme une formule.
  if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;
  return '"' + value.replace(/"/g, '""') + '"';
}

export function buildCsv() {
  const rows = [['Date', 'Heure', 'Libellé', 'Montant (€)', 'Statut', 'Carte']];
  const list = store.all().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const e of list) {
    const day = dayOf(e.at);
    rows.push([
      day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(0, 4),
      timeOf(e.at),
      e.label,
      centsToInput(e.amount),
      e.planned ? 'Prévue' : 'Payée',
      store.isDebit(e) ? 'Débit' : 'Crédit'
    ]);
  }
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
  return new File([text], 'meuk-depenses-' + today() + '.csv', { type: 'text/csv' });
}

// --- Effacement total ---

export async function eraseEverything() {
  await db.destroy();
  try {
    for (const key of await caches.keys()) await caches.delete(key);
  } catch (err) { /* pas de cache */ }
  try {
    if ('serviceWorker' in navigator) {
      for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    }
  } catch (err) { /* pas de service worker */ }
}
