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

function onLocked() {
  vault.lock();
  // Les données affichées disparaissent de l'écran (et de la mémoire avec la clé).
  app.hidden = true;
  settings.hidden = true;
  security.showLock();
}

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
  security.start(state);
}

start();
initUpdates();
