// Mise en forme en français (dates ; les montants arriveront à l'étape 3).

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Ex. : « Samedi 4 octobre 2026 »
export function formatLongDate(date) {
  return capitalize(longDate.format(date));
}
