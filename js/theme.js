// Thème jour / nuit.
// Par défaut, l'app suit le réglage de l'iPhone. Un appui sur le bouton lune / soleil force le mode jour
// ou le mode nuit ; ce choix (« light » ou « dark », non sensible) est retenu dans le magasin « meta ».

import { getMeta, setMeta } from './db.js';

const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
const BAR = { light: '#f2f2f7', dark: '#000000' };
let statusOverride = null;

function effective() {
  return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
}

// Couleur de la barre d'état d'iOS : celle du thème, sauf pendant les écrans d'ouverture (anthracite).
function paintStatusBar() {
  const color = statusOverride || BAR[effective()];
  metas.forEach((m) => { m.content = color; });
}

export function setStatusBarOverride(color) {
  statusOverride = color;
  paintStatusBar();
}

function refreshButton() {
  const dark = effective() === 'dark';
  // Icônes SVG : la propriété « hidden » n'existe pas sur elles, on pose l'attribut directement.
  document.getElementById('theme-icon-moon').toggleAttribute('hidden', dark);
  document.getElementById('theme-icon-sun').toggleAttribute('hidden', !dark);
  document.getElementById('btn-theme').setAttribute('aria-label', dark ? 'Passer en mode jour' : 'Passer en mode nuit');
}

function apply(theme) {
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  paintStatusBar();
  refreshButton();
}

export async function initTheme() {
  let saved = null;
  try {
    saved = await getMeta('theme');
  } catch (err) {
    // Sans préférence lisible, on suit l'iPhone.
  }
  apply(saved);
  darkQuery.addEventListener('change', () => { paintStatusBar(); refreshButton(); });
  document.getElementById('btn-theme').addEventListener('click', async () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      await setMeta('theme', next);
    } catch (err) {
      // Le thème reste appliqué pour cette fois.
    }
  });
}
