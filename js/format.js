// Mise en forme en français : montants en euros, dates et heures.
//
// Les montants sont des centimes entiers (ex. 5000 = 50,00 €).
// Les dates/heures sont l'heure locale du téléphone, écrite « 2026-10-04T10:24:37 » : elles restent
// identiques même en changeant de fuseau horaire.

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export const MAX_CENTS = 99999999; // 999 999,99 €

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const pad = (n) => String(n).padStart(2, '0');

// --- Montants ---

// 5000 → « 50,00 € »
export function formatAmount(cents) {
  return euros.format(cents / 100);
}

// 5000 → « 50,00 » (pour pré-remplir un champ)
export function centsToInput(cents) {
  return Math.floor(cents / 100) + ',' + pad(cents % 100);
}

// Nettoie la frappe : chiffres et un seul séparateur décimal (virgule ou point), 2 décimales au plus.
export function cleanAmountInput(text) {
  let out = '';
  let separator = false;
  let decimals = 0;
  let integers = 0;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      if (separator) {
        if (decimals >= 2) continue;
        decimals++;
      } else {
        if (integers >= 6) continue; // 999 999 € au plus
        integers++;
      }
      out += ch;
    } else if ((ch === ',' || ch === '.') && !separator) {
      separator = true;
      out += out === '' ? '0,' : ',';
    }
  }
  return out;
}

// « 50 », « 50,5 », « 50.55 » → centimes entiers (sans calcul à virgule). null si invalide.
export function parseAmount(text) {
  const match = /^(\d{1,6})(?:[.,](\d{0,2}))?$/.exec(text.trim());
  if (!match) return null;
  const cents = parseInt(match[1], 10) * 100 + parseInt((match[2] || '').padEnd(2, '0'), 10);
  if (cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

// --- Dates et heures locales ---

// Date → « 2026-10-04T10:24:37 »
export function toLocalStamp(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

// « 2026-10-04T10:24:37 » → « 2026-10-04 »
export function dayOf(stamp) {
  return stamp.slice(0, 10);
}

// « 2026-10-04T10:24:37 » → « 10:24:37 »
export function timeOf(stamp) {
  return stamp.slice(11, 19);
}

// « 2026-10-04 » → objet Date (à midi, pour éviter les surprises de changement d'heure)
export function dayToDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function today() {
  return toLocalStamp(new Date()).slice(0, 10);
}

// Ex. : « Dimanche 4 octobre 2026 »
export function formatLongDate(date) {
  return capitalize(longDate.format(date));
}

// « 2026-10-04 » → « 04/10/2026 »
export function formatShortDay(day) {
  return day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(0, 4);
}
