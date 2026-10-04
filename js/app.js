// Démarrage de Meuk, navigation entre les onglets, et passage verrouillé / déverrouillé.

import { VERSION } from './version.js';
import { formatLongDate } from './format.js';
import { initUpdates } from './update.js';
import * as vault from './vault.js';
import * as security from './views/security.js';
import { startAutoLock, stopAutoLock } from './lock.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const title = $('view-title');
const views = document.querySelectorAll('.view');
const tabs = document.querySelectorAll('.tab');
const settings = $('settings');

function showView(id) {
  views.forEach((view) => {
    view.hidden = view.id !== id;
    if (view.id === id) title.textContent = view.dataset.title;
  });
  tabs.forEach((tab) => {
    if (tab.dataset.view === id) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function showApp(notice) {
  security.hide();
  settings.hidden = true;
  $('today-date').textContent = formatLongDate(new Date());
  $('app-notice').textContent = notice || '';
  $('app-notice').hidden = !notice;
  // L'app s'ouvre toujours sur Aujourd'hui.
  showView('view-today');
  app.hidden = false;
}

// Verrouillage : la clé est oubliée et le contenu masqué tout de suite, puis l'app est rechargée
// entièrement, ce qui efface TOUTE sa mémoire. Le rechargement permet aussi à iOS de proposer Face ID
// automatiquement (il ne l'accepte qu'à l'ouverture d'une page).
// - passage en arrière-plan : rechargement au retour, avec Face ID automatique ;
// - inactivité ou « Verrouiller maintenant » : rechargement immédiat, SANS Face ID automatique
//   (marqueur « #verrouille » dans l'adresse, retiré aussitôt au démarrage ; rien n'est stocké).
let reloadWhenVisible = false;

function onLocked() {
  vault.lock();
  app.hidden = true;
  settings.hidden = true;
  security.showLock({ auto: false });
  if (document.visibilityState === 'hidden') {
    reloadWhenVisible = true;
  } else {
    window.location.hash = 'verrouille';
    window.location.reload();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && reloadWhenVisible) {
    reloadWhenVisible = false;
    window.location.reload();
  }
});

function onUnlocked(options = {}) {
  startAutoLock(onLocked);
  if (options.showApp !== false) showApp(options.message);
}

async function openSettings() {
  settings.hidden = false;
  $('storage-status').textContent = '…';
  const persisted = await vault.persistenceStatus();
  $('storage-status').textContent = persisted === true ? 'protégé' : persisted === false ? 'non protégé' : 'inconnu';
}

tabs.forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));
$('btn-settings').addEventListener('click', openSettings);
$('btn-settings-close').addEventListener('click', () => { settings.hidden = true; });
$('btn-lock-now').addEventListener('click', () => {
  stopAutoLock();
  onLocked();
});
$('app-version').textContent = VERSION;

async function start() {
  security.init({ onUnlocked });
  let state;
  try {
    state = await vault.init();
  } catch (err) {
    $('fatal').hidden = false;
    $('fatal-text').textContent = 'Impossible d\'ouvrir la base de Meuk : ' + (err && err.message ? err.message : err);
    return;
  }
  const lockedByUser = window.location.hash === '#verrouille';
  if (window.location.hash) history.replaceState(null, '', window.location.pathname);
  security.start(state, { auto: !lockedByUser });
}

start();
initUpdates();
