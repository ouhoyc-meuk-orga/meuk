// Le coffre de Meuk : création, déverrouillage (Face ID ou phrase de secours), verrouillage.
// La clé de données n'existe qu'en mémoire, et seulement quand le coffre est déverrouillé.

import * as db from './db.js';
import * as c from './crypto.js';
import { createPasskey, getPrfSecret, AuthError } from './auth.js';

const FORMAT = 1;
const CANARY = 'meuk';

let vault = null;     // fiche du coffre, telle qu'enregistrée (tout y est chiffré ou non sensible)
let dataKey = null;   // clé de données utilisable (non extractible), seulement si déverrouillé
let pending = null;   // étapes en cours (création, ou nouvelle passkey après la phrase de secours)

export class VaultError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function init() {
  vault = (await db.getVault()) || null;
  return vault ? 'locked' : 'setup';
}

export function isUnlocked() {
  return dataKey !== null;
}

export function getDataKey() {
  if (!dataKey) throw new VaultError('locked');
  return dataKey;
}

export function lock() {
  dataKey = null;
  // Une nouvelle passkey en cours après la phrase de secours est abandonnée : on efface la clé brute.
  if (pending && pending.kind === 'recovery') {
    c.wipe(pending.keyBytes);
    pending = null;
  }
}

async function checkCanary(key, box) {
  try {
    return (await c.decryptJSON(key, box)) === CANARY;
  } catch (err) {
    return false;
  }
}

// --- Création ---

// Étape 1 (bouton) : création de la passkey.
export async function setupCreatePasskey() {
  const credentialId = await createPasskey();
  pending = { kind: 'setup', credentialId };
}

// Étape 2 (bouton) : Face ID → secret PRF → toutes les clés. Rien n'est encore enregistré.
export async function setupActivate() {
  if (!pending || pending.kind !== 'setup') throw new VaultError('no-pending');
  const prfSalt = c.randomBytes(32);
  const secret = await getPrfSecret(pending.credentialId, prfSalt);

  const keyBytes = c.newDataKeyBytes();
  const { entropy, words } = await c.newPhrase();
  try {
    const kekPrf = await c.kekFromPrf(secret, prfSalt);
    const phraseSalt = c.randomBytes(16);
    const kekPhrase = await c.kekFromPhrase(entropy, phraseSalt, c.PBKDF2_ITERATIONS);
    const key = await c.importDataKey(keyBytes);
    pending.record = {
      format: FORMAT,
      credentialId: pending.credentialId,
      prfSalt,
      wrappedByPrf: await c.wrapWithPrf(kekPrf, keyBytes),
      phraseSalt,
      phraseIterations: c.PBKDF2_ITERATIONS,
      wrappedByPhrase: await c.wrapWithPhrase(kekPhrase, keyBytes),
      canary: await c.encryptJSON(key, CANARY)
    };
    pending.key = key;
    pending.words = words;
    return words;
  } finally {
    c.wipe(secret);
    c.wipe(keyBytes);
    c.wipe(entropy);
  }
}

// Positions (1 à 12) des mots à faire retaper.
export function pickVerification(count) {
  const positions = [];
  while (positions.length < count) {
    const p = 1 + (crypto.getRandomValues(new Uint8Array(1))[0] % 12);
    if (!positions.includes(p)) positions.push(p);
  }
  return positions.sort((a, b) => a - b);
}

export function checkWords(answers) {
  if (!pending || !pending.words) return false;
  return answers.every(({ position, word }) => c.sameWord(word, pending.words[position - 1]));
}

// Étape 3 : la phrase a été vérifiée → on enregistre le coffre et on déverrouille.
export async function setupFinish() {
  if (!pending || pending.kind !== 'setup' || !pending.record) throw new VaultError('no-pending');
  await db.putVault(pending.record);
  vault = pending.record;
  dataKey = pending.key;
  pending = null;
  await requestPersistence();
}

export function setupAbort() {
  pending = null;
}

// --- Déverrouillage ---

export async function unlockWithPasskey() {
  if (!vault) throw new VaultError('no-vault');
  const secret = await getPrfSecret(vault.credentialId, vault.prfSalt);
  let keyBytes;
  try {
    const kek = await c.kekFromPrf(secret, vault.prfSalt);
    keyBytes = await c.unwrapWithPrf(kek, vault.wrappedByPrf);
  } catch (err) {
    throw new VaultError('wrong-passkey');
  } finally {
    c.wipe(secret);
  }
  try {
    const key = await c.importDataKey(keyBytes);
    if (!(await checkCanary(key, vault.canary))) throw new VaultError('corrupted');
    dataKey = key;
  } finally {
    c.wipe(keyBytes);
  }
}

// Déverrouille avec la phrase de secours. La clé brute est gardée en mémoire le temps de proposer
// une nouvelle passkey (effacée ensuite, ou au verrouillage).
export async function unlockWithPhrase(text) {
  if (!vault) throw new VaultError('no-vault');
  const entropy = await c.wordsToEntropy(c.splitPhrase(text));
  let keyBytes;
  try {
    const kek = await c.kekFromPhrase(entropy, vault.phraseSalt, vault.phraseIterations);
    keyBytes = await c.unwrapWithPhrase(kek, vault.wrappedByPhrase);
  } catch (err) {
    throw new VaultError('wrong-phrase');
  } finally {
    c.wipe(entropy);
  }
  const key = await c.importDataKey(keyBytes);
  if (!(await checkCanary(key, vault.canary))) {
    c.wipe(keyBytes);
    throw new VaultError('corrupted');
  }
  dataKey = key;
  pending = { kind: 'recovery', keyBytes };
}

// Après la phrase de secours, étape 1 (bouton) : nouvelle passkey (remplace l'ancienne).
export async function recoveryCreatePasskey() {
  if (!pending || pending.kind !== 'recovery') throw new VaultError('no-pending');
  pending.credentialId = await createPasskey();
}

// Après la phrase de secours, étape 2 (bouton) : Face ID → la clé de données est rechiffrée pour la
// nouvelle passkey. La partie « phrase de secours » du coffre ne change pas.
export async function recoveryActivate() {
  if (!pending || pending.kind !== 'recovery' || !pending.credentialId) throw new VaultError('no-pending');
  const prfSalt = c.randomBytes(32);
  const secret = await getPrfSecret(pending.credentialId, prfSalt);
  try {
    const kek = await c.kekFromPrf(secret, prfSalt);
    const updated = {
      ...vault,
      credentialId: pending.credentialId,
      prfSalt,
      wrappedByPrf: await c.wrapWithPrf(kek, pending.keyBytes)
    };
    await db.putVault(updated);
    vault = updated;
  } finally {
    c.wipe(secret);
  }
  recoveryFinish();
}

export function recoveryFinish() {
  if (pending && pending.kind === 'recovery') {
    c.wipe(pending.keyBytes);
    pending = null;
  }
}

// --- Stockage persistant ---

async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch (err) {
    // Sans conséquence immédiate : l'état est affiché dans Réglages.
  }
}

export async function persistenceStatus() {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      if (!(await navigator.storage.persisted())) await requestPersistence();
      return await navigator.storage.persisted();
    }
  } catch (err) {
    // ignoré
  }
  return null;
}

export { AuthError };
