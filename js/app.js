// Démarrage de Meuk, navigation entre les onglets, et passage verrouillé / déverrouillé.

import { initUpdates } from './update.js';
import * as vault from './vault.js';
import * as expenses from './expenses.js';
import { generate } from './recurring.js';
import * as security from './views/security.js';
import { initCommon, closeEdit } from './views/common.js';
import * as todayView from './views/today.js';
import * as historyView from './views/history.js';
import * as recapView from './views/recap.js';
import * as recurringView from './views/recurring.js';
import * as settingsView from './views/settings.js';
import { startAutoLock, stopAutoLock } from './lock.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const title = $('view-title');
const views = document.querySelectorAll('.view');
const tabs = document.querySelectorAll('.tab');

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

// Après chaque changement de données : tous les écrans sont redessinés (rapide, tout est en mémoire).
function refresh(newId) {
  todayView.render(newId);
  historyView.render();
  recapView.render();
  recurringView.render();
}

function closeSheets() {
  closeEdit();
  recurringView.closeSheet();
  settingsView.closeAll();
  $('due-sheet').hidden = true;
}

async function showApp(notice) {
  security.hide();
  closeSheets();
  const notices = notice ? [notice] : [];
  try {
    await expenses.load();
    // Récurrentes : création des dépenses prévues des mois écoulés et du mois en cours.
    const created = await generate();
    if (created > 0) {
      notices.push(created === 1 ? '1 dépense prévue créée par une récurrente.'
        : created + ' dépenses prévues créées par les récurrentes.');
    }
  } catch (err) {
    notices.push('Les dépenses n\'ont pas pu être lues : ' + (err && err.message ? err.message : err));
  }
  if (expenses.unreadableCount() > 0) {
    notices.push(expenses.unreadableCount() + ' fiche(s) illisible(s) ignorée(s).');
  }
  // L'app s'ouvre toujours sur Aujourd'hui, à la date du jour.
  todayView.showToday();
  recapView.showCurrentMonth();
  refresh();
  $('app-notice').textContent = notices.join(' ');
  $('app-notice').hidden = notices.length === 0;
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
  expenses.clear();
  app.hidden = true;
  closeSheets();
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

function onErased() {
  stopAutoLock();
  vault.lock();
  expenses.clear();
  app.hidden = true;
  closeSheets();
  $('erased').hidden = false;
}

tabs.forEach((tab) => tab.addEventListener('click', () => {
  if (tab.dataset.view === 'view-today') todayView.showToday();
  showView(tab.dataset.view);
}));
initCommon({ onChange: () => refresh() });
todayView.init({ onChange: refresh });
recapView.init({
  onOpenDay: (day) => {
    todayView.setDay(day);
    showView('view-today');
  }
});
recurringView.init({ onChange: () => refresh() });
settingsView.init({ onChange: () => refresh(), onErased });
$('btn-settings').addEventListener('click', () => settingsView.open());
$('btn-lock-now').addEventListener('click', () => {
  stopAutoLock();
  onLocked();
});
$('btn-restart').addEventListener('click', () => window.location.replace(window.location.pathname));

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
