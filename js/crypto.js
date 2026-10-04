// Chiffrement de Meuk (WebCrypto uniquement, aucune bibliothèque).
//
// Principe « en enveloppe » :
// - une clé de données aléatoire (AES-GCM 256) chiffre les données ;
// - cette clé est elle-même chiffrée deux fois :
//   1. par une clé dérivée du secret Face ID (PRF de la passkey) via HKDF ;
//   2. par une clé dérivée de la phrase de secours via PBKDF2-SHA256 (600 000 itérations).
// Chaque chiffrement utilise un IV aléatoire unique de 12 octets.

import { WORDLIST_FR } from './wordlist-fr.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 600000;

// Étiquettes liées à chaque chiffrement (données additionnelles authentifiées) :
// un contenu chiffré pour un usage ne peut pas être réutilisé pour un autre.
const AAD_KEY_PRF = enc.encode('meuk/data-key/prf/v1');
const AAD_KEY_PHRASE = enc.encode('meuk/data-key/phrase/v1');
const AAD_RECORD = enc.encode('meuk/record/v1');
const HKDF_INFO = enc.encode('meuk/kek/prf/v1');

export class CryptoError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

export function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function wipe(bytes) {
  if (bytes) new Uint8Array(bytes.buffer || bytes).fill(0);
}

async function aesEncrypt(key, data, aad) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, data);
  return { iv, ct: new Uint8Array(ct) };
}

async function aesDecrypt(key, box, aad) {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv, additionalData: aad }, key, box.ct);
    return new Uint8Array(plain);
  } catch (err) {
    // Mauvaise clé ou données modifiées : AES-GCM refuse de déchiffrer.
    throw new CryptoError('decrypt-failed');
  }
}

// --- Clés de chiffrement de la clé de données (non extractibles) ---

export async function kekFromPrf(prfSecret, salt) {
  const base = await crypto.subtle.importKey('raw', prfSecret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function kekFromPhrase(entropy, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', entropy, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- Clé de données ---

export function newDataKeyBytes() {
  return randomBytes(32);
}

export function wrapWithPrf(kek, keyBytes) {
  return aesEncrypt(kek, keyBytes, AAD_KEY_PRF);
}

export function unwrapWithPrf(kek, box) {
  return aesDecrypt(kek, box, AAD_KEY_PRF);
}

export function wrapWithPhrase(kek, keyBytes) {
  return aesEncrypt(kek, keyBytes, AAD_KEY_PHRASE);
}

export function unwrapWithPhrase(kek, box) {
  return aesDecrypt(kek, box, AAD_KEY_PHRASE);
}

// La clé utilisable n'est jamais extractible : elle ne peut que chiffrer et déchiffrer.
export function importDataKey(keyBytes) {
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// --- Données ---

export function encryptJSON(key, value) {
  return aesEncrypt(key, enc.encode(JSON.stringify(value)), AAD_RECORD);
}

export async function decryptJSON(key, box) {
  return JSON.parse(dec.decode(await aesDecrypt(key, box, AAD_RECORD)));
}

// --- Phrase de secours (BIP39 français, 12 mots = 128 bits + 4 bits de contrôle) ---

// « Élève » → « eleve » : accents et majuscules facultatifs à la saisie.
export function normalizeWord(word) {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

let wordIndex = null;
function indexOfWord(word) {
  if (!wordIndex) {
    wordIndex = new Map();
    WORDLIST_FR.forEach((w, i) => wordIndex.set(normalizeWord(w), i));
  }
  const i = wordIndex.get(normalizeWord(word));
  return i === undefined ? -1 : i;
}

async function checksumBits(entropy) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropy));
  return hash[0] >> 4; // 4 premiers bits
}

export async function newPhrase() {
  const entropy = randomBytes(16);
  const words = await entropyToWords(entropy);
  return { entropy, words };
}

export async function entropyToWords(entropy) {
  let bits = '';
  entropy.forEach((b) => { bits += b.toString(2).padStart(8, '0'); });
  bits += (await checksumBits(entropy)).toString(2).padStart(4, '0');
  const words = [];
  for (let i = 0; i < 12; i++) words.push(WORDLIST_FR[parseInt(bits.slice(i * 11, i * 11 + 11), 2)]);
  return words;
}

export function splitPhrase(text) {
  return text.split(/[\s,;.]+/).filter(Boolean);
}

// Retrouve les 16 octets d'origine à partir des 12 mots, en vérifiant le contrôle.
export async function wordsToEntropy(words) {
  if (words.length !== 12) throw new CryptoError('word-count', words.length);
  let bits = '';
  for (let i = 0; i < words.length; i++) {
    const index = indexOfWord(words[i]);
    if (index < 0) throw new CryptoError('unknown-word', { position: i + 1, word: words[i] });
    bits += index.toString(2).padStart(11, '0');
  }
  const entropy = new Uint8Array(16);
  for (let i = 0; i < 16; i++) entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  if (parseInt(bits.slice(128), 2) !== (await checksumBits(entropy))) {
    wipe(entropy);
    throw new CryptoError('checksum');
  }
  return entropy;
}

export function sameWord(a, b) {
  return normalizeWord(a) === normalizeWord(b);
}
