// Base IndexedDB de Meuk : le SEUL endroit où l'app enregistre quelque chose.
// Pour l'instant, elle ne contient que des informations techniques non sensibles (magasin « meta »),
// par exemple le numéro de la dernière version vue. Les dépenses chiffrées arriveront à l'étape 2.

const DB_NAME = 'meuk';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function run(mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('meta', mode);
    const request = action(tx.objectStore('meta'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export function getMeta(key) {
  return run('readonly', (store) => store.get(key));
}

export function setMeta(key, value) {
  return run('readwrite', (store) => store.put(value, key));
}
