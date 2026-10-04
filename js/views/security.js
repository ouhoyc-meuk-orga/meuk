// Écrans de sécurité : création du coffre, phrase de secours, déverrouillage, récupération.

import * as vault from '../vault.js';
import { passkeysSupported } from '../auth.js';
import { withoutAutoLock } from '../lock.js';

const $ = (id) => document.getElementById(id);
const screens = ['auth-welcome', 'auth-activate', 'auth-phrase', 'auth-verify', 'auth-lock', 'auth-recover', 'auth-newkey'];
const VERIFY_COUNT = 3;

let onUnlocked = () => {};
let verifyPositions = [];

function show(id) {
  $('auth').hidden = false;
  screens.forEach((s) => { $(s).hidden = s !== id; });
  document.querySelectorAll('.auth-error').forEach((el) => { el.textContent = ''; });
  window.scrollTo(0, 0);
}

export function hide() {
  $('auth').hidden = true;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function message(err) {
  switch (err && err.code) {
    case 'cancelled': return 'Face ID annulé ou non reconnu. Réessaie.';
    case 'cancelled-unlock': return 'Déverrouillage annulé — réessayer. Si ta passkey a été supprimée, utilise la phrase de secours.';
    case 'no-uv': return "Face ID n'a pas été vérifié. Réessaie.";
    case 'no-prf': return "L'iPhone n'a pas fourni la clé liée à Face ID.";
    case 'security': return 'Refusé pour raison de sécurité (adresse du site inattendue).';
    case 'not-supported': return 'Les passkeys ne sont pas disponibles ici.';
    case 'wrong-passkey': return 'Cette passkey ne correspond pas à ce coffre. Utilise la phrase de secours.';
    case 'wrong-phrase': return 'Cette phrase ne correspond pas à ce coffre.';
    case 'corrupted': return 'Le coffre semble endommagé : la vérification a échoué.';
    case 'word-count': return 'Il faut exactement 12 mots (' + err.detail + ' saisis).';
    case 'unknown-word': return 'Mot n° ' + err.detail.position + ' inconnu : « ' + err.detail.word + ' ».';
    case 'checksum': return "Tous les mots existent, mais la phrase n'est pas valable : vérifie l'ordre et l'orthographe.";
    default: return 'Erreur inattendue' + (err && err.message ? ' : ' + err.message : '.');
  }
}

// Exécute une action sur appui de bouton : bouton désactivé pendant l'action, erreur affichée.
function bind(buttonId, errorId, action) {
  const button = $(buttonId);
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    if (errorId) $(errorId).textContent = '';
    try {
      await action();
    } catch (err) {
      if (errorId) $(errorId).textContent = message(err);
      else console.error(err);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

function renderPhrase(words) {
  const list = $('phrase-words');
  list.textContent = '';
  words.forEach((word) => {
    const li = document.createElement('li');
    li.textContent = word;
    list.appendChild(li);
  });
}

function renderVerify() {
  verifyPositions = vault.pickVerification(VERIFY_COUNT);
  const box = $('verify-fields');
  box.textContent = '';
  verifyPositions.forEach((position, i) => {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.textContent = 'Mot n° ' + position;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'verify-' + i;
    input.autocomplete = 'off';
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'none');
    input.spellcheck = false;
    label.append(span, input);
    box.appendChild(label);
  });
}

function clearSecretsFromScreen() {
  $('phrase-words').textContent = '';
  $('verify-fields').textContent = '';
  $('recover-input').value = '';
}

export function showLock() {
  clearSecretsFromScreen();
  show('auth-lock');
}

export function init(callbacks) {
  onUnlocked = callbacks.onUnlocked;

  // Création
  bind('btn-setup-start', 'err-setup-start', async () => {
    if (!passkeysSupported()) throw { code: 'not-supported' };
    await vault.setupCreatePasskey();
    show('auth-activate');
  });
  $('btn-setup-anyway').addEventListener('click', () => {
    $('auth-not-standalone').hidden = true;
    $('btn-setup-start').hidden = false;
  });

  bind('btn-setup-activate', 'err-setup-activate', async () => {
    const words = await vault.setupActivate();
    renderPhrase(words);
    show('auth-phrase');
  });

  $('btn-phrase-done').addEventListener('click', () => {
    renderVerify();
    show('auth-verify');
    $('verify-0').focus();
  });

  $('btn-verify-back').addEventListener('click', () => show('auth-phrase'));

  bind('btn-verify', 'err-verify', async () => {
    const answers = verifyPositions.map((position, i) => ({ position, word: $('verify-' + i).value }));
    if (!vault.checkWords(answers)) {
      $('err-verify').textContent = 'Au moins un mot ne correspond pas. Vérifie, ou revois la phrase.';
      return;
    }
    await vault.setupFinish();
    clearSecretsFromScreen();
    onUnlocked();
  });

  // Déverrouillage
  bind('btn-unlock', 'err-unlock', async () => {
    try {
      await vault.unlockWithPasskey();
    } catch (err) {
      if (err && err.code === 'cancelled') err.code = 'cancelled-unlock';
      throw err;
    }
    onUnlocked();
  });

  $('btn-show-recover').addEventListener('click', () => {
    show('auth-recover');
    $('recover-input').focus();
  });
  $('btn-recover-back').addEventListener('click', () => {
    $('recover-input').value = '';
    show('auth-lock');
  });

  bind('btn-recover', 'err-recover', async () => {
    $('btn-recover').textContent = 'Vérification…';
    await vault.unlockWithPhrase($('recover-input').value);
    $('recover-input').value = '';
    $('btn-newkey-create').hidden = false;
    $('btn-newkey-activate').hidden = true;
    onUnlocked({ showApp: false });
    show('auth-newkey');
  });

  // Nouvelle passkey après la phrase de secours (le coffre est déjà déverrouillé)
  bind('btn-newkey-create', 'err-newkey', async () => {
    await withoutAutoLock(() => vault.recoveryCreatePasskey());
    $('btn-newkey-create').hidden = true;
    $('btn-newkey-activate').hidden = false;
  });
  bind('btn-newkey-activate', 'err-newkey', async () => {
    await withoutAutoLock(() => vault.recoveryActivate());
    hide();
    onUnlocked({ showApp: true, message: 'Nouvelle passkey enregistrée : Face ID fonctionne de nouveau.' });
  });
  $('btn-newkey-skip').addEventListener('click', () => {
    vault.recoveryFinish();
    hide();
    onUnlocked({ showApp: true });
  });
}

export function start(state) {
  if (state === 'setup') {
    const warn = !isStandalone();
    $('auth-not-standalone').hidden = !warn;
    $('btn-setup-start').hidden = warn;
    show('auth-welcome');
  } else {
    showLock();
  }
}
