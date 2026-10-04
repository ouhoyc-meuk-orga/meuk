// Base IndexedDB de Meuk : le SEUL endroit où l'app enregistre quelque chose.
//
// Magasins :
// - « meta »    : informations techniques NON sensibles, en clair (ex. numéro de la dernière version vue) ;
// - « vault »   : le coffre (une seule fiche) : clé de données chiffrée deux fois, sels, identifiant de
//                 la passkey, et un témoin chiffré servant à vérifier la clé ;
// - « records » : les données chiffrées ; seul un identifiant aléatoire est en clair.

const DB_NAME = 'meuk';
const DB_VERSION = 2;
const VAULT_KEY = 'main';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault');
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const db = request.result;
        // Si une autre version de l'app veut mettre la base à jour, on libère la place.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Base bloquée par un autre onglet de Meuk.'));
    });
  }
  return dbPromise;
}

function run(storeName, mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export function getMeta(key) {
  return run('meta', 'readonly', (store) => store.get(key));
}

export function setMeta(key, value) {
  return run('meta', 'readwrite', (store) => store.put(value, key));
}

export function getVault() {
  return run('vault', 'readonly', (store) => store.get(VAULT_KEY));
}

export function putVault(vault) {
  return run('vault', 'readwrite', (store) => store.put(vault, VAULT_KEY));
}
