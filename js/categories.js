// Catégories des dépenses : liste, couleurs, icônes, et reconnaissance automatique à partir du libellé.
//
// Tout se passe sur le téléphone, sans aucun service en ligne : une liste de mots-clés (ci-dessous) et
// les corrections de l'utilisateur (« règles », chiffrées comme les dépenses, voir expenses.js).
// Une dépense sans catégorie choisie à la main prend la catégorie devinée, recalculée à chaque affichage.
//
// L'utilisateur peut changer la couleur de toute catégorie et créer ses propres catégories. Ces réglages
// sont des fiches chiffrées { type: 'category', v: 1, catId, color, name?, icon?, custom? } (expenses.js),
// appliquées ici au chargement.

// Palette : couleurs vives, ajustées pour le mode nuit dans css/app.css (--pal-<clé>).
export const PALETTE = [
  { key: 'vert', name: 'Vert' },
  { key: 'emeraude', name: 'Émeraude' },
  { key: 'turquoise', name: 'Turquoise' },
  { key: 'bleu', name: 'Bleu' },
  { key: 'indigo', name: 'Indigo' },
  { key: 'violet', name: 'Violet' },
  { key: 'pourpre', name: 'Pourpre' },
  { key: 'rose', name: 'Rose' },
  { key: 'rouge', name: 'Rouge' },
  { key: 'bordeaux', name: 'Bordeaux' },
  { key: 'orange', name: 'Orange' },
  { key: 'jaune', name: 'Jaune' },
  { key: 'marron', name: 'Marron' },
  { key: 'gris', name: 'Gris' },
  { key: 'graphite', name: 'Graphite' }
];
const PALETTE_KEYS = new Set(PALETTE.map((p) => p.key));

// Catégories intégrées, dans l'ordre d'affichage (« Autre » toujours en dernier).
const BUILTIN = [
  { id: 'alimentation', name: 'Alimentation', icon: 'alimentation', color: 'vert' },
  { id: 'restaurants', name: 'Restaurants', icon: 'restaurants', color: 'orange' },
  { id: 'loisirs', name: 'Loisirs', icon: 'loisirs', color: 'violet' },
  { id: 'transport', name: 'Transport', icon: 'transport', color: 'bleu' },
  { id: 'logement', name: 'Logement', icon: 'logement', color: 'indigo' },
  { id: 'abonnements', name: 'Abonnements', icon: 'abonnements', color: 'turquoise' },
  { id: 'sante', name: 'Santé', icon: 'sante', color: 'rouge' },
  { id: 'shopping', name: 'Shopping', icon: 'shopping', color: 'rose' },
  { id: 'enfants', name: 'Enfants', icon: 'enfants', color: 'jaune' },
  { id: 'cadeaux', name: 'Cadeaux', icon: 'cadeaux', color: 'marron' },
  { id: 'pokemon', name: 'Pokémon', icon: 'masterball', color: 'pourpre' },
  { id: 'autre', name: 'Autre', icon: 'autre', color: 'gris' }
];
const BUILTIN_IDS = new Set(BUILTIN.map((c) => c.id));

export const DEFAULT_CATEGORY = 'autre';
export const MAX_CATEGORY_NAME = 30;
export const MAX_CUSTOM_CATEGORIES = 40;

// Identifiant d'une catégorie (intégrée, ou « perso-… » pour celles de l'utilisateur).
const ID_FORMAT = /^[a-z0-9-]{1,48}$/;
export function isCategoryId(id) {
  return typeof id === 'string' && ID_FORMAT.test(id);
}
export function isPaletteKey(key) {
  return PALETTE_KEYS.has(key);
}
export function isIconKey(key) {
  return Object.prototype.hasOwnProperty.call(ICONS, key);
}

// Réglages de l'utilisateur : catId → { recordId, color, name?, icon?, custom? }
let settings = new Map();

export function resetSettings() {
  settings = new Map();
}

export function applySetting(recordId, value) {
  settings.set(value.catId, { recordId, ...value });
}

export function forgetSetting(recordId) {
  for (const [catId, setting] of settings) if (setting.recordId === recordId) settings.delete(catId);
}

export function settingFor(catId) {
  return settings.get(catId);
}

function resolve(base, setting) {
  if (!setting) return { ...base, custom: false };
  return { ...base, color: isPaletteKey(setting.color) ? setting.color : base.color, custom: false };
}

// Toutes les catégories, prêtes à afficher : intégrées, puis celles de l'utilisateur (par nom), puis Autre.
export function allCategories() {
  const builtins = BUILTIN.map((c) => resolve(c, settings.get(c.id)));
  const customs = [...settings.values()].filter((s) => s.custom && !BUILTIN_IDS.has(s.catId))
    .map((s) => ({ id: s.catId, name: s.name, icon: isIconKey(s.icon) ? s.icon : 'etoile', color: s.color, custom: true }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const other = builtins.pop();
  return [...builtins, ...customs, other];
}

export function getCategory(id) {
  return allCategories().find((c) => c.id === id);
}

export function isCategory(id) {
  return Boolean(getCategory(id));
}

export function customCount() {
  return [...settings.values()].filter((s) => s.custom).length;
}

export function categoryName(id) {
  return (getCategory(id) || getCategory(DEFAULT_CATEGORY)).name;
}

// Classe CSS de couleur d'une catégorie (« pal-<clé> »).
export function colorClass(id) {
  return 'pal-' + (getCategory(id) || getCategory(DEFAULT_CATEGORY)).color;
}

// Icônes au trait (24 × 24), dessinées pour l'app : [élément SVG, attributs].
const ICONS = {
  alimentation: [
    ['path', { d: 'M3 4h2.2l2.3 10.5h10.3L20 7.5H6.3' }],
    ['circle', { cx: '9', cy: '19', r: '1.4' }],
    ['circle', { cx: '16.5', cy: '19', r: '1.4' }]
  ],
  restaurants: [['path', { d: 'M6.5 3v6.5a2.5 2.5 0 0 0 5 0V3M9 3v18M17.5 21V3c-2 1.4-3 4-3 7.3V13h3' }]],
  loisirs: [
    ['path', { d: 'M3.5 7.5h17v3a1.8 1.8 0 0 0 0 3.6v3h-17v-3a1.8 1.8 0 0 0 0-3.6z' }],
    ['path', { d: 'M14.5 7.5v1.8M14.5 11.1v1.8M14.5 14.7v1.8' }]
  ],
  transport: [
    ['path', { d: 'M4.5 16.5V12l2-5h11l2 5v4.5z' }],
    ['path', { d: 'M4.5 12h15M7 16.5v2.3M17 16.5v2.3' }],
    ['circle', { cx: '8', cy: '14.2', r: '.6' }],
    ['circle', { cx: '16', cy: '14.2', r: '.6' }]
  ],
  logement: [
    ['path', { d: 'M3.5 11L12 3.8l8.5 7.2M5.8 9.2V20h12.4V9.2' }],
    ['path', { d: 'M10 20v-5.5h4V20' }]
  ],
  abonnements: [
    ['rect', { x: '3', y: '4.5', width: '18', height: '12.5', rx: '2.5' }],
    ['path', { d: 'M8.5 20.5h7M10.3 8.3v5l4.2-2.5z' }]
  ],
  sante: [
    ['path', { d: 'M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.9-8 10.6-8 10.6z' }],
    ['path', { d: 'M7.5 12.3h2.3l1.4-2.3 1.8 4.3 1.3-2h2.2' }]
  ],
  shopping: [
    ['path', { d: 'M5.2 8h13.6l-1 12.5H6.2z' }],
    ['path', { d: 'M9 10.5V7a3 3 0 0 1 6 0v3.5' }]
  ],
  enfants: [
    ['circle', { cx: '12', cy: '13', r: '7.5' }],
    ['path', { d: 'M12 5.5c0-1.6 1-2.6 2.6-2.4' }],
    ['circle', { cx: '9.3', cy: '12.2', r: '.5' }],
    ['circle', { cx: '14.7', cy: '12.2', r: '.5' }],
    ['path', { d: 'M9.6 15.6c1.4 1.2 3.4 1.2 4.8 0' }]
  ],
  cadeaux: [
    ['rect', { x: '3.5', y: '8.5', width: '17', height: '4', rx: '1' }],
    ['path', { d: 'M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10.5 4 6.5 4.4 7.3 6.8 7.9 8.5 12 8.5 12 8.5zM12 8.5c1.5-4.5 5.5-4.1 4.7-1.7-.6 1.7-4.7 1.7-4.7 1.7z' }]
  ],
  masterball: [
    ['path', { d: 'M3 12a9 9 0 0 1 18 0z', fill: 'currentColor', 'fill-opacity': '.3', stroke: 'none' }],
    ['circle', { cx: '12', cy: '12', r: '9' }],
    ['path', { d: 'M3 12h6.6M14.4 12H21' }],
    ['circle', { cx: '12', cy: '12', r: '2.4' }],
    ['path', { d: 'M9.4 9.3V6.4l2.6 2.2 2.6-2.2v2.9' }],
    ['circle', { cx: '6.2', cy: '8.6', r: '1.1', fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: '17.8', cy: '8.6', r: '1.1', fill: 'currentColor', stroke: 'none' }]
  ],
  patte: [
    ['circle', { cx: '6.6', cy: '10', r: '1.7' }],
    ['circle', { cx: '10.1', cy: '6.4', r: '1.7' }],
    ['circle', { cx: '13.9', cy: '6.4', r: '1.7' }],
    ['circle', { cx: '17.4', cy: '10', r: '1.7' }],
    ['path', { d: 'M12 11.5c-2.6 0-5 3.3-5 5.4 0 1.6 1.3 2.4 2.7 2.1 1-.2 1.5-.6 2.3-.6s1.3.4 2.3.6c1.4.3 2.7-.5 2.7-2.1 0-2.1-2.4-5.4-5-5.4z' }]
  ],
  ballon: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M12 8l3.3 2.4-1.3 3.9h-4l-1.3-3.9z' }],
    ['path', { d: 'M12 3.5V8M15.3 10.4l4.3-1.4M14 14.3l2.6 3.6M10 14.3l-2.6 3.6M8.7 10.4L4.4 9' }]
  ],
  avion: [['path', { d: 'M10.5 13.5L4 11l1.5-1.5 7.5.5 4-4c1-1 2.6-1.2 3.2-.6s.4 2.2-.6 3.2l-4 4 .5 7.5L14.5 21 12 14.5l-3 3v2.5l-1.5 1.5-1-3.5-3.5-1L4.5 15.5H7z' }]],
  tasse: [
    ['path', { d: 'M5 9h11v5.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5z' }],
    ['path', { d: 'M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5c-.6.9.6 1.6 0 2.5M12.5 3.5c-.6.9.6 1.6 0 2.5' }]
  ],
  musique: [
    ['path', { d: 'M9 18V5.5l11-2V16' }],
    ['circle', { cx: '6.5', cy: '18', r: '2.5' }],
    ['circle', { cx: '17.5', cy: '16', r: '2.5' }]
  ],
  manette: [
    ['path', { d: 'M7 8h10a4 4 0 0 1 4 4l.5 4a2.6 2.6 0 0 1-4.6 2L15 16H9l-1.9 2a2.6 2.6 0 0 1-4.6-2L3 12a4 4 0 0 1 4-4z' }],
    ['path', { d: 'M7.5 10.5v3.5M5.8 12.2h3.4' }],
    ['circle', { cx: '15.5', cy: '11.3', r: '.8' }],
    ['circle', { cx: '17.5', cy: '13.3', r: '.8' }]
  ],
  livre: [['path', { d: 'M4.5 19V5a1.5 1.5 0 0 1 1.5-1.5h13.5v14H6a1.5 1.5 0 0 0 0 3h13.5M8.5 7.5h7' }]],
  beaute: [
    ['rect', { x: '6', y: '10', width: '12', height: '11', rx: '2.5' }],
    ['path', { d: 'M10 10V7h4v3M9.5 3.5h5V7h-5zM9.5 15h5' }]
  ],
  outil: [['path', { d: 'M14.7 6.3a4.5 4.5 0 0 0 5.6 5.6L18 9.6l.4-2.9-2.9.4zM15.5 10.5L5.6 20.4a1.9 1.9 0 0 1-2.7-2.7L12.8 7.8' }]],
  travail: [
    ['rect', { x: '3', y: '7.5', width: '18', height: '12.5', rx: '2' }],
    ['path', { d: 'M8.5 7.5V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5v2M3 13h18M10.5 12v2.5h3V12' }]
  ],
  plante: [['path', { d: 'M12 21v-9M12 12c0-4 2.5-7 7-7 0 4.5-3 7-7 7zM12 15.5c0-3-2-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5zM8 21h8' }]],
  verre: [['path', { d: 'M7.5 3.5h9l-.6 5.2a3.9 3.9 0 0 1-7.8 0zM12 12.5v8M8.5 20.5h7M7.9 7h8.2' }]],
  coeur: [['path', { d: 'M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.9-8 10.6-8 10.6z' }]],
  etoile: [['path', { d: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z' }]],
  argent: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M14.8 8.8a4 4 0 1 0 0 6.4M7.8 11h5M7.8 13.2h5' }]
  ],
  photo: [
    ['path', { d: 'M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z' }],
    ['circle', { cx: '12', cy: '13.5', r: '3.5' }]
  ],
  autre: [
    ['circle', { cx: '6', cy: '12', r: '1.3' }],
    ['circle', { cx: '12', cy: '12', r: '1.3' }],
    ['circle', { cx: '18', cy: '12', r: '1.3' }]
  ]
};

// Icônes proposées pour une catégorie créée par l'utilisateur.
export const ICON_CHOICES = Object.keys(ICONS);

const SVG_NS = 'http://www.w3.org/2000/svg';

export function iconSvg(key, label) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const [tag, attrs] of ICONS[isIconKey(key) ? key : 'autre']) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}

// Pastille de couleur avec l'icône de la catégorie.
export function categoryBadge(id, className = '') {
  const cat = getCategory(id) || getCategory(DEFAULT_CATEGORY);
  return badge(cat.icon, cat.color, cat.name, className);
}

// Pastille quelconque (aperçu pendant la création d'une catégorie).
export function badge(icon, color, label, className = '') {
  const el = document.createElement('span');
  el.className = 'cat-badge pal-' + color + (className ? ' ' + className : '');
  el.appendChild(iconSvg(icon, label));
  return el;
}

// --- Reconnaissance par mots-clés ---

// « Café Crème » → « cafe creme » : minuscules, sans accents, ponctuation remplacée par des espaces.
export function normalizeLabel(label) {
  return String(label).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Mots-clés (déjà « normalisés »). Un mot-clé reconnaît un mot entier du libellé ; terminé par « * »,
// il reconnaît aussi les mots qui commencent par lui (« boulang* » → boulangerie, boulanger…).
// Plusieurs mots (« super u ») : la suite exacte.
const KEYWORDS = [
  ['pokemon', [
    'pokemon*', 'pikachu', 'dracaufeu', 'booster*', 'display', 'etb', 'coffret pokemon', 'tcg', 'pokeball',
    'carte pokemon', 'cartes pokemon', 'pokemon center', 'ultra premium', 'tripack', 'mini tin', 'tin pokemon'
  ]],
  ['enfants', [
    'creche*', 'nounou', 'nourrice', 'garderie', 'babysit*', 'baby sitting', 'baby sitter', 'ecole', 'cantine',
    'centre de loisirs', 'periscolaire', 'couche', 'couches', 'pampers', 'bebe', 'bebes', 'jouet*', 'king jouet',
    'la grande recre', 'toys r us', 'vertbaudet', 'okaidi', 'sergent major', 'dpam', 'du pareil au meme',
    'jacadi', 'tape a l oeil', 'cartable', 'fournitures scolaires', 'enfant*', 'fille', 'fils', 'doudou'
  ]],
  ['cadeaux', [
    'cadeau*', 'anniv*', 'noel', 'fleur*', 'interflora', 'cagnotte', 'leetchi', 'lydia cagnotte', 'don', 'dons',
    'mariage', 'naissance', 'fete des meres', 'fete des peres', 'saint valentin', 'carte cadeau', 'smartbox',
    'wonderbox', 'offert', 'offrir', 'pot de depart'
  ]],
  ['sante', [
    'pharma*', 'medecin*', 'docteur', 'dr', 'generaliste', 'dentist*', 'ophtalmo*', 'opticien*', 'lunettes',
    'lentilles', 'kine*', 'osteo*', 'hopital', 'clinique', 'urgences', 'analyse*', 'laboratoire', 'labo',
    'mutuelle', 'psy*', 'medicament*', 'doliprane', 'vaccin*', 'radiologie', 'irm', 'sage femme', 'pediatre',
    'dermato*', 'gyneco*', 'orthodont*', 'orthophon*', 'podolog*', 'infirmi*', 'sante', 'consultation'
  ]],
  ['abonnements', [
    'netflix', 'spotify', 'deezer', 'disney', 'canal', 'mycanal', 'amazon prime', 'prime video', 'youtube',
    'apple music', 'apple tv', 'icloud', 'apple one', 'google one', 'dropbox', 'chatgpt', 'openai',
    'abonnement*', 'abo', 'forfait', 'telephone', 'mobile', 'free mobile', 'sosh', 'bouygues', 'sfr', 'orange',
    'red by sfr', 'b and you', 'presse', 'journal', 'magazine', 'audible', 'kindle', 'ps plus', 'game pass',
    'molotov', 'paramount', 'crunchyroll', 'dazn', 'bein'
  ]],
  ['logement', [
    'loyer', 'electricite', 'edf', 'engie', 'totalenergies electricite', 'gaz', 'eau', 'veolia', 'suez',
    'internet', 'box', 'freebox', 'livebox', 'bbox', 'fibre', 'charges', 'copro*', 'syndic', 'assurance habitation',
    'habitation', 'taxe fonciere', 'taxe d habitation', 'credit immo*', 'pret immo*', 'emprunt', 'bricolage',
    'leroy merlin', 'castorama', 'brico*', 'mr bricolage', 'menage', 'femme de menage', 'jardin*', 'travaux',
    'plombier', 'electricien', 'serrurier', 'chauffage', 'fioul', 'demenagement', 'maison', 'appartement'
  ]],
  ['transport', [
    'essence', 'carburant', 'gasoil', 'gazole', 'diesel', 'sp95', 'sp98', 'e10', 'e85', 'plein', 'total',
    'totalenergies', 'esso', 'shell', 'bp', 'avia', 'station', 'peage*', 'autoroute', 'parking', 'stationnement',
    'sncf', 'train', 'tgv', 'ouigo', 'ter', 'inoui', 'ratp', 'metro', 'navigo', 'bus', 'tram', 'tramway',
    'uber', 'taxi', 'g7', 'bolt', 'heetch', 'blablacar', 'avion', 'vol', 'air france', 'easyjet', 'ryanair',
    'transavia', 'vueling', 'garage', 'vidange', 'pneu*', 'controle technique', 'lavage', 'carrosserie',
    'velo', 'trottinette', 'lime', 'location voiture', 'assurance auto', 'assurance voiture', 'voiture', 'moto',
    'norauto', 'feu vert', 'speedy', 'midas', 'amende', 'pv', 'transport*'
  ]],
  ['restaurants', [
    'restaurant*', 'resto*', 'restau*', 'mcdo', 'macdo', 'mc do', 'mcdonald*', 'burger*', 'burger king', 'bk', 'kfc',
    'quick', 'subway', 'five guys', 'pizza*', 'sushi*', 'kebab*', 'tacos', 'o tacos', 'brasserie', 'bistrot',
    'bistro', 'cafe', 'bar', 'starbucks', 'columbus', 'uber eats', 'ubereats', 'deliveroo', 'just eat',
    'dejeuner', 'diner', 'brunch', 'snack*', 'creperie', 'crepe*', 'traiteur', 'thai', 'chinois', 'japonais',
    'indien', 'libanais', 'italien', 'pret a manger', 'apero', 'verre', 'biere*'
  ]],
  ['alimentation', [
    'course*', 'supermarche*', 'hypermarche*', 'carrefour', 'carrefour market', 'carrefour city', 'leclerc',
    'e leclerc', 'lidl', 'aldi', 'auchan', 'intermarche', 'inter', 'super u', 'hyper u', 'u express', 'casino',
    'monoprix', 'monop', 'franprix', 'picard', 'grand frais', 'biocoop', 'naturalia', 'la vie claire', 'netto',
    'cora', 'spar', 'g20', 'proxi', 'vival', 'leader price', 'costco', 'metro cash', 'boulang*', 'pain',
    'baguette', 'patisserie', 'viennoiserie*', 'croissant*', 'boucher*', 'charcuterie', 'fromager*', 'fromage',
    'primeur', 'marche', 'epicerie', 'drive', 'fruits', 'legumes', 'lait', 'viande', 'poisson*', 'alimentation',
    'nourriture', 'bouffe', 'cave', 'vin', 'nicolas'
  ]],
  ['loisirs', [
    'cinema', 'cine', 'ugc', 'pathe', 'gaumont', 'mk2', 'concert*', 'theatre', 'spectacle', 'musee', 'expo*',
    'bowling', 'piscine', 'parc', 'zoo', 'aquarium', 'disneyland', 'parc asterix', 'sport', 'salle de sport',
    'basic fit', 'fitness', 'fitness park', 'neoness', 'jeu', 'jeux', 'jeux video', 'steam', 'playstation', 'ps5',
    'nintendo', 'switch', 'xbox', 'livre*', 'librairie', 'fnac', 'cultura', 'vacances', 'hotel', 'airbnb',
    'booking', 'voyage', 'sortie', 'loisir*', 'ski', 'golf', 'escape game', 'karting', 'laser game', 'billet*',
    'match foot', 'stade', 'festival', 'camping', 'club', 'boite', 'discotheque', 'loto', 'pmu', 'fdj', 'tabac'
  ]],
  ['shopping', [
    'amazon', 'zara', 'h m', 'hm', 'primark', 'uniqlo', 'kiabi', 'celio', 'jules', 'decathlon', 'go sport',
    'intersport', 'vetement*', 'habit*', 'chaussure*', 'basket*', 'sephora', 'nocibe', 'marionnaud', 'darty',
    'boulanger', 'ikea', 'action', 'gifi', 'la foir fouille', 'stokomani', 'centrakor', 'shein', 'temu',
    'aliexpress', 'vinted', 'leboncoin', 'apple store', 'apple', 'coiffeur', 'coiffure', 'barbier', 'parfum*',
    'maquillage', 'cosmetique*', 'bijou*', 'montre', 'sac', 'jean', 'pull', 'manteau', 'robe', 'nike', 'adidas',
    'jd sports', 'courir', 'galeries lafayette', 'printemps', 'but', 'conforama', 'maisons du monde',
    'electromenager', 'telephone neuf', 'iphone', 'ordinateur', 'zalando', 'asos', 'mango', 'bershka',
    'pull and bear', 'hema', 'manucure', 'onglerie', 'esthetique*', 'pressing', 'cordonnier', 'shopping'
  ]]
];

// Mots-clés compilés une seule fois : [catégorie, [{ words, prefix }]].
const RULES = KEYWORDS.map(([id, list]) => [id, list.map((kw) => {
  const prefix = kw.endsWith('*');
  return { words: (prefix ? kw.slice(0, -1) : kw).split(' '), prefix };
})]);

function matches(words, rule) {
  const n = rule.words.length;
  for (let i = 0; i + n <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < n && ok; j++) {
      const w = words[i + j];
      const k = rule.words[j];
      // « * » : préfixe, seulement pour le dernier mot du mot-clé.
      ok = (rule.prefix && j === n - 1) ? w.startsWith(k) : w === k;
    }
    if (ok) return true;
  }
  return false;
}

// Catégorie devinée d'après les mots-clés seuls (sans les corrections de l'utilisateur).
// Le mot-clé le plus long l'emporte (« uber eats » → Restaurants, et non « uber » → Transport) ;
// à égalité, l'ordre des catégories ci-dessus.
export function guessFromKeywords(label) {
  const words = normalizeLabel(label).split(' ').filter(Boolean);
  let best = DEFAULT_CATEGORY;
  let bestLength = 0;
  for (const [id, rules] of RULES) {
    for (const rule of rules) {
      if (rule.words.length > bestLength && matches(words, rule)) {
        best = id;
        bestLength = rule.words.length;
      }
    }
  }
  return best;
}
