// Fenêtres de confirmation et d'information assorties à l'app (à la place de celles de Safari),
// et bandeau « Annuler » temporaire.

const $ = (id) => document.getElementById(id);

let pending = null; // { resolve }

function close(result) {
  $('dialog').hidden = true;
  if (pending) {
    const { resolve } = pending;
    pending = null;
    resolve(result);
  }
}

// Demande une confirmation. Renvoie true si l'utilisateur confirme.
// destructive : bouton de confirmation en rouge (suppression, effacement…).
export function confirmDialog({ title, message = '', confirmLabel = 'Confirmer', cancelLabel = 'Annuler', destructive = false }) {
  if (pending) close(false);
  $('dialog-title').textContent = title;
  $('dialog-message').textContent = message;
  $('dialog-message').hidden = !message;
  const confirm = $('dialog-confirm');
  confirm.textContent = confirmLabel;
  confirm.className = destructive ? 'button-destructive button-wide' : 'button-primary button-wide';
  $('dialog-cancel').textContent = cancelLabel;
  $('dialog-cancel').hidden = cancelLabel === null;
  $('dialog').hidden = false;
  return new Promise((resolve) => { pending = { resolve }; });
}

// Simple information, avec un seul bouton « OK ».
export function alertDialog(title, message = '') {
  return confirmDialog({ title, message, confirmLabel: 'OK', cancelLabel: null });
}

// Ferme une fenêtre ouverte (au verrouillage par exemple), comme un « Annuler ».
export function cancelDialog() {
  if (!$('dialog').hidden) close(false);
}

// --- Bandeau temporaire avec action (« Dépense supprimée — Annuler ») ---

let toastTimer = null;
let toastAction = null;

export function hideToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  toastAction = null;
  $('toast').hidden = true;
}

export function showToast(text, actionLabel, onAction, durationMs) {
  hideToast();
  $('toast-text').textContent = text;
  $('toast-action').textContent = actionLabel;
  toastAction = onAction;
  $('toast').hidden = false;
  toastTimer = setTimeout(hideToast, durationMs);
}

export function initDialogs() {
  $('dialog-confirm').addEventListener('click', () => close(true));
  $('dialog-cancel').addEventListener('click', () => close(false));
  // Un appui à côté de la fenêtre vaut « Annuler ».
  $('dialog').addEventListener('click', (event) => {
    if (event.target === $('dialog')) close(false);
  });
  $('toast-action').addEventListener('click', () => {
    const action = toastAction;
    hideToast();
    if (action) action();
  });
}
