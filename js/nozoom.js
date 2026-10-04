// Empêche le zoom par pincement à deux doigts dans toute l'app.
// iOS ignore en partie le réglage « user-scalable=no » de la page : on bloque donc aussi les gestes.
// (Le zoom par double-tap est désactivé par « touch-action: manipulation » dans la feuille de style.)

const block = (event) => event.preventDefault();

// Pincement (événements propres à Safari).
document.addEventListener('gesturestart', block, { passive: false });
document.addEventListener('gesturechange', block, { passive: false });
document.addEventListener('gestureend', block, { passive: false });

// Pincement : tout mouvement à plusieurs doigts.
document.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1) event.preventDefault();
}, { passive: false });

