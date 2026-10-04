// Service worker de Meuk.
// Rôle unique : garder une copie des fichiers de l'app pour qu'elle marche hors connexion.
// Il ne lit, ne stocke et ne transmet JAMAIS de données de dépenses, et ne contacte aucun autre domaine.
// Une nouvelle version n'est appliquée que lorsque l'utilisateur le demande (bouton « Mettre à jour »).
'use strict';

// Doit être identique à js/version.js.
const VERSION = '1.4.0';
const CACHE = 'meuk-' + VERSION;

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/auth.js',
  'js/backup.js',
  'js/crypto.js',
  'js/db.js',
  'js/expenses.js',
  'js/format.js',
  'js/lock.js',
  'js/recurring.js',
  'js/update.js',
  'js/vault.js',
  'js/version.js',
  'js/views/common.js',
  'js/views/history.js',
  'js/views/recap.js',
  'js/views/recurring.js',
  'js/views/security.js',
  'js/views/settings.js',
  'js/views/today.js',
  'js/wordlist-fr.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  // cache: 'reload' : on prend les fichiers sur le serveur, jamais une ancienne copie du navigateur.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  // Pas de skipWaiting() ici : la nouvelle version attend l'accord de l'utilisateur.
});

self.addEventListener('activate', (event) => {
  // Supprime les copies des anciennes versions.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('meuk-') && key !== CACHE).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'APPLY_UPDATE') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // On ne s'occupe que des lectures de fichiers de l'app elle-même.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match('index.html', { cacheName: CACHE }).then((cached) => cached || fetch(request)));
    return;
  }
  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((cached) => cached || fetch(request))
  );
});
