// Détection et application des mises à jour, via le service worker.
//
// Fonctionnement (choix A du cahier des charges) :
// - tant que l'app est ouverte, une nouvelle version attend : un message propose « Mettre à jour » ou
//   « Plus tard », et revient à chaque retour dans l'app ;
// - si l'app est complètement fermée, iOS installe la nouvelle version à la réouverture (impossible à
//   empêcher simplement) : l'app l'indique alors par « L'app a été mise à jour ».

import { VERSION } from './version.js';
import { getMeta, setMeta } from './db.js';

const banner = document.getElementById('update-banner');
const updatedBanner = document.getElementById('updated-banner');
let registration = null;
let reloadRequested = false;

function waitingWorker() {
  // Une nouvelle version n'est « en attente » que si une version tourne déjà.
  return registration && registration.waiting && navigator.serviceWorker.controller ? registration.waiting : null;
}

function refreshBanner() {
  banner.hidden = !waitingWorker();
}

function watchInstalling(worker) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') refreshBanner();
  });
}

// Signale une version différente de la dernière vue (mise à jour demandée ou appliquée par iOS).
async function announceNewVersion() {
  try {
    const lastVersion = await getMeta('lastVersion');
    if (lastVersion && lastVersion !== VERSION) {
      document.getElementById('updated-text').textContent = 'L\'app a été mise à jour (version ' + VERSION + ').';
      updatedBanner.hidden = false;
    }
    if (lastVersion !== VERSION) await setMeta('lastVersion', VERSION);
  } catch (err) {
    console.error('Version précédente illisible :', err);
  }
}

export async function initUpdates() {
  document.getElementById('btn-updated-ok').addEventListener('click', () => {
    updatedBanner.hidden = true;
  });
  announceNewVersion();

  if (!('serviceWorker' in navigator)) return;

  document.getElementById('btn-update-apply').addEventListener('click', () => {
    const worker = waitingWorker();
    if (!worker) return;
    reloadRequested = true;
    worker.postMessage({ type: 'APPLY_UPDATE' });
  });

  document.getElementById('btn-update-later').addEventListener('click', () => {
    banner.hidden = true;
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // On ne recharge que si l'utilisateur l'a demandé.
    if (reloadRequested) window.location.reload();
  });

  try {
    registration = await navigator.serviceWorker.register('sw.js', { scope: './' });
  } catch (err) {
    console.error('Service worker non enregistré :', err);
    return;
  }

  refreshBanner();
  watchInstalling(registration.installing);
  registration.addEventListener('updatefound', () => watchInstalling(registration.installing));

  // À chaque retour dans l'app : réaffiche le message si une version attend, et cherche une nouvelle version.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    refreshBanner();
    registration.update().catch(() => {});
  });
}
