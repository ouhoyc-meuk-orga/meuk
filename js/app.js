// Démarrage de Meuk et navigation entre les onglets.

import { VERSION } from './version.js';
import { formatLongDate } from './format.js';
import { initUpdates } from './update.js';

const title = document.getElementById('view-title');
const views = document.querySelectorAll('.view');
const tabs = document.querySelectorAll('.tab');
const settings = document.getElementById('settings');

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

tabs.forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));

document.getElementById('btn-settings').addEventListener('click', () => {
  settings.hidden = false;
});
document.getElementById('btn-settings-close').addEventListener('click', () => {
  settings.hidden = true;
});

document.getElementById('app-version').textContent = VERSION;
document.getElementById('today-date').textContent = formatLongDate(new Date());

// L'app s'ouvre toujours sur Aujourd'hui.
showView('view-today');

initUpdates();
