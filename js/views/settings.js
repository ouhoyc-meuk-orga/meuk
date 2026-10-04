// Réglages : export chiffré, import (fusion / remplacement), export CSV, effacement total, version.

import * as backup from '../backup.js';
import * as vault from '../vault.js';
import { VERSION } from '../version.js';
import { withoutAutoLock } from '../lock.js';
import { $, errorText } from './common.js';

let preparedFile = null;
let pendingBackup = null;
let pendingItems = null;
let onChange = () => {};
let onErased = () => {};

function importMessage(err) {
  switch (err && err.code) {
    case 'invalid-file': return "Ce fichier n'est pas une sauvegarde Meuk.";
    case 'wrong-phrase': return 'Cette phrase ne correspond pas à cette sauvegarde.';
    case 'corrupted': return 'La sauvegarde est endommagée : rien n\'a été importé.';
    case 'word-count': return 'Il faut exactement 12 mots (' + err.detail + ' saisis).';
    case 'unknown-word': return 'Mot n° ' + err.detail.position + ' inconnu : « ' + err.detail.word + ' ».';
    case 'checksum': return "La phrase n'est pas valable : vérifie l'ordre et l'orthographe.";
    default: return errorText('Erreur : ', err);
  }
}

export async function open() {
  $('settings').hidden = false;
  $('app-version').textContent = VERSION;
  $('settings-message').textContent = '';
  $('storage-status').textContent = '…';
  const persisted = await vault.persistenceStatus();
  $('storage-status').textContent = persisted === true ? 'protégé' : persisted === false ? 'non protégé' : 'inconnu';
}

export function closeAll() {
  ['settings', 'file-sheet', 'import-sheet'].forEach((id) => { $(id).hidden = true; });
  preparedFile = null;
  pendingBackup = null;
  pendingItems = null;
  $('import-phrase').value = '';
}

// --- Partage d'un fichier préparé (feuille de partage iOS, ou téléchargement) ---

function showFile(file, title, text) {
  preparedFile = file;
  $('file-title').textContent = title;
  $('file-text').textContent = text;
  $('file-name').textContent = file.name;
  $('file-error').textContent = '';
  const canShare = navigator.canShare && navigator.canShare({ files: [file] });
  $('btn-file-share').hidden = !canShare;
  $('file-sheet').hidden = false;
}

async function shareFile() {
  if (!preparedFile) return;
  try {
    // L'appel se fait directement dans l'appui (exigence d'iOS).
    await withoutAutoLock(() => navigator.share({ files: [preparedFile], title: preparedFile.name }));
  } catch (err) {
    if (err && err.name !== 'AbortError') $('file-error').textContent = errorText('Partage impossible : ', err);
  }
}

function downloadFile() {
  if (!preparedFile) return;
  const url = URL.createObjectURL(preparedFile);
  const a = document.createElement('a');
  a.href = url;
  a.download = preparedFile.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function exportEncrypted() {
  try {
    const file = await backup.buildEncryptedExport();
    showFile(file, 'Sauvegarde chiffrée',
      'Fichier chiffré : il ne peut être lu qu\'avec ta phrase de secours. Range-le où tu veux (Fichiers, iCloud Drive, clé USB…).');
  } catch (err) {
    $('settings-message').textContent = errorText("L'export a échoué : ", err);
  }
}

function exportCsv() {
  const ok = window.confirm(
    'Attention : le fichier CSV n\'est PAS chiffré.\n\n' +
    'Toutes tes dépenses y seront lisibles par quiconque obtient le fichier ' +
    '(et par les apps ou services où tu l\'enregistres ou l\'envoies).\n\nContinuer ?');
  if (!ok) return;
  showFile(backup.buildCsv(), 'Export CSV (non chiffré)',
    'Fichier lisible par tous (tableur). Supprime-le quand tu n\'en as plus besoin.');
}

// --- Import ---

function pickFile() {
  const input = $('import-file');
  input.value = '';
  // Pendant le choix du fichier, iOS masque l'app : on ne verrouille pas à ce moment-là.
  return withoutAutoLock(() => new Promise((resolve) => {
    const done = () => {
      input.removeEventListener('change', done);
      input.removeEventListener('cancel', done);
      window.removeEventListener('focus', onFocus);
      resolve(input.files && input.files[0] ? input.files[0] : null);
    };
    const onFocus = () => setTimeout(() => { if (!input.files || !input.files.length) done(); }, 1500);
    input.addEventListener('change', done);
    input.addEventListener('cancel', done);
    window.addEventListener('focus', onFocus);
    input.click();
  }));
}

function showImportStep(step) {
  ['import-step-phrase', 'import-step-choice'].forEach((id) => { $(id).hidden = id !== step; });
  $('import-error').textContent = '';
}

async function startImport() {
  $('settings-message').textContent = '';
  const file = await pickFile();
  if (!file) return;
  try {
    pendingBackup = backup.parseBackup(await file.text());
  } catch (err) {
    $('settings-message').textContent = importMessage(err);
    return;
  }
  $('import-sheet').hidden = false;
  $('import-file-name').textContent = file.name + ' — ' + pendingBackup.records.length + ' fiche(s)';
  try {
    if (await backup.needsPhrase(pendingBackup)) {
      showImportStep('import-step-phrase');
    } else {
      pendingItems = await backup.decryptBackup(pendingBackup);
      showChoice();
    }
  } catch (err) {
    showImportStep('import-step-choice');
    $('import-error').textContent = importMessage(err);
  }
}

function showChoice() {
  const expenses = pendingItems.filter((i) => i.type === 'expense').length;
  const recurrings = pendingItems.length - expenses;
  $('import-summary').textContent = expenses + ' dépense(s) et ' + recurrings + ' récurrente(s) dans la sauvegarde.';
  showImportStep('import-step-choice');
}

async function decryptWithPhrase() {
  $('btn-import-decrypt').textContent = 'Vérification…';
  try {
    pendingItems = await backup.decryptBackup(pendingBackup, $('import-phrase').value);
    $('import-phrase').value = '';
    showChoice();
  } catch (err) {
    $('import-error').textContent = importMessage(err);
  } finally {
    $('btn-import-decrypt').textContent = 'Déchiffrer';
  }
}

async function applyImport(mode) {
  if (!pendingItems) return;
  const question = mode === 'merge'
    ? 'Fusionner : les dépenses de la sauvegarde absentes de Meuk seront ajoutées. Rien ne sera supprimé.\n\nContinuer ?'
    : 'Remplacer : TOUTES les données actuelles de Meuk seront remplacées par celles de la sauvegarde.\n\nContinuer ?';
  if (!window.confirm(question)) return;
  try {
    const { added, removed } = await backup.applyImport(pendingItems, mode);
    closeAll();
    onChange();
    $('settings').hidden = false;
    $('settings-message').textContent = 'Import terminé : ' + added + ' fiche(s) ajoutée(s)' +
      (mode === 'replace' ? ', ' + removed + ' supprimée(s).' : '.');
  } catch (err) {
    $('import-error').textContent = errorText("L'import a échoué : ", err);
  }
}

// --- Effacement total ---

async function eraseAll() {
  if (!window.confirm('Effacer TOUTES les données de Meuk sur ce téléphone ?\n\n' +
    'Dépenses, récurrentes et coffre chiffré seront supprimés.')) return;
  if (!window.confirm('Dernière confirmation : cette action est IRRÉVERSIBLE.\n\n' +
    'Sans sauvegarde, tes dépenses seront perdues définitivement. Effacer ?')) return;
  try {
    await backup.eraseEverything();
    onErased();
  } catch (err) {
    $('settings-message').textContent = errorText("L'effacement a échoué : ", err);
  }
}

export function init(callbacks) {
  onChange = callbacks.onChange;
  onErased = callbacks.onErased;
  $('btn-settings-close').addEventListener('click', closeAll);
  $('btn-export').addEventListener('click', exportEncrypted);
  $('btn-export-csv').addEventListener('click', exportCsv);
  $('btn-import').addEventListener('click', startImport);
  $('btn-erase').addEventListener('click', eraseAll);
  $('btn-file-share').addEventListener('click', shareFile);
  $('btn-file-download').addEventListener('click', downloadFile);
  $('btn-file-close').addEventListener('click', () => { $('file-sheet').hidden = true; preparedFile = null; });
  $('btn-import-decrypt').addEventListener('click', decryptWithPhrase);
  $('btn-import-merge').addEventListener('click', () => applyImport('merge'));
  $('btn-import-replace').addEventListener('click', () => applyImport('replace'));
  $('btn-import-cancel').addEventListener('click', () => {
    $('import-sheet').hidden = true;
    pendingBackup = null;
    pendingItems = null;
    $('import-phrase').value = '';
  });
}
