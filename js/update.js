// Détection et application des mises à jour, via le service worker.
// Rien n'est appliqué en silence : l'utilisateur choisit quand mettre à jour.

const banner = document.getElementById('update-banner');
let waitingWorker = null;
let reloadRequested = false;

function showBanner(worker) {
  waitingWorker = worker;
  banner.hidden = false;
}

function watchInstalling(worker) {
  worker.addEventListener('statechange', () => {
    // « installed » alors qu'une version tourne déjà = une nouvelle version attend.
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      showBanner(worker);
    }
  });
}

export async function initUpdates() {
  if (!('serviceWorker' in navigator)) return;

  document.getElementById('btn-update-apply').addEventListener('click', () => {
    if (!waitingWorker) return;
    reloadRequested = true;
    waitingWorker.postMessage({ type: 'APPLY_UPDATE' });
  });

  document.getElementById('btn-update-later').addEventListener('click', () => {
    banner.hidden = true;
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // On ne recharge que si l'utilisateur l'a demandé.
    if (reloadRequested) window.location.reload();
  });

  let registration;
  try {
    registration = await navigator.serviceWorker.register('sw.js', { scope: './' });
  } catch (err) {
    console.error("Service worker non enregistré :", err);
    return;
  }

  if (registration.waiting && navigator.serviceWorker.controller) {
    showBanner(registration.waiting);
  }
  if (registration.installing) watchInstalling(registration.installing);
  registration.addEventListener('updatefound', () => watchInstalling(registration.installing));

  // Vérifie s'il existe une nouvelle version à chaque retour dans l'app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update().catch(() => {});
  });
}
