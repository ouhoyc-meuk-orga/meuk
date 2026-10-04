// Verrouillage automatique : dès que l'app passe en arrière-plan, et après 5 minutes sans utilisation.

const INACTIVITY_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart'];

let onLock = null;
let lastActivity = 0;
let timer = null;
let paused = false;

function markActivity() {
  lastActivity = Date.now();
}

function lockNow() {
  if (!onLock || paused) return;
  const callback = onLock;
  stopAutoLock();
  callback();
}

function onVisibility() {
  if (document.visibilityState === 'hidden') lockNow();
}

function check() {
  if (Date.now() - lastActivity >= INACTIVITY_MS) lockNow();
}

export function startAutoLock(callback) {
  stopAutoLock();
  onLock = callback;
  markActivity();
  ACTIVITY_EVENTS.forEach((type) => document.addEventListener(type, markActivity, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', lockNow);
  timer = setInterval(check, 10000);
}

export function stopAutoLock() {
  onLock = null;
  ACTIVITY_EVENTS.forEach((type) => document.removeEventListener(type, markActivity, { capture: true }));
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', lockNow);
  if (timer) clearInterval(timer);
  timer = null;
}

// Pendant une demande Face ID, iOS peut brièvement masquer l'app : on ne verrouille pas à ce moment-là.
export async function withoutAutoLock(action) {
  paused = true;
  try {
    return await action();
  } finally {
    paused = false;
    markActivity();
  }
}
