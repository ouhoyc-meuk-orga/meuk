// Catégories des dépenses : liste, icônes, et reconnaissance automatique à partir du libellé.
//
// Tout se passe sur le téléphone, sans aucun service en ligne : une liste de mots-clés (ci-dessous) et
// les corrections de l'utilisateur (« règles », chiffrées comme les dépenses, voir expenses.js).
// Une dépense sans catégorie choisie à la main prend la catégorie devinée, recalculée à chaque affichage.

// Ordre d'affichage (grille de choix). Les couleurs sont dans css/app.css (--cat-<id>).
export const CATEGORIES = [
  { id: 'alimentation', name: 'Alimentation' },
  { id: 'restaurants', name: 'Restaurants' },
  { id: 'loisirs', name: 'Loisirs' },
  { id: 'transport', name: 'Transport' },
  { id: 'logement', name: 'Logement' },
  { id: 'abonnements', name: 'Abonnements' },
  { id: 'sante', name: 'Santé' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'enfants', name: 'Enfants' },
  { id: 'cadeaux', name: 'Cadeaux' },
  { id: 'autre', name: 'Autre' }
];

export const DEFAULT_CATEGORY = 'autre';
const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function isCategory(id) {
  return BY_ID.has(id);
}

export function categoryName(id) {
  return (BY_ID.get(id) || BY_ID.get(DEFAULT_CATEGORY)).name;
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
  autre: [
    ['circle', { cx: '6', cy: '12', r: '1.3' }],
    ['circle', { cx: '12', cy: '12', r: '1.3' }],
    ['circle', { cx: '18', cy: '12', r: '1.3' }]
  ]
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// Pastille de couleur avec l'icône de la catégorie (classe « cat-<id> » : couleur définie en CSS).
export function categoryBadge(id, className = '') {
  const cat = BY_ID.get(id) || BY_ID.get(DEFAULT_CATEGORY);
  const badge = document.createElement('span');
  badge.className = 'cat-badge cat-' + cat.id + (className ? ' ' + className : '');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', cat.name);
  for (const [tag, attrs] of ICONS[cat.id]) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  badge.appendChild(svg);
  return badge;
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
