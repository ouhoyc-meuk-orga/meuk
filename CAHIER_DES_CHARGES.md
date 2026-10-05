# Cahier des charges — Carnet de dépenses (PWA)

Ce document rassemble TOUTES les décisions prises avec l'utilisateur avant le début du code.
Toute session qui travaille sur ce projet doit le lire en entier avant d'agir.

## 0. Règles de travail

- L'utilisateur n'est pas développeur : expliquer les choix simplement, **en français**.
- **Ne rien coder sans son feu vert explicite.** Avancer par petites étapes testables sur son iPhone.
- Si une exigence est impossible ou risquée sur iOS : le dire, ne jamais contourner discrètement.
- Chaque ajout de bibliothèque ou de ressource externe doit être justifié et validé.
- Rappeler d'activer / garder la double authentification sur le compte GitHub et l'organisation.

## 1. Contexte

- Appareil : iPhone 14 Pro, iOS 27, app installée via Safari > « Ajouter à l'écran d'accueil » (standalone).
- Priorité absolue : **confidentialité. Les dépenses ne quittent JAMAIS le téléphone.**

## 2. Hébergement

- Repo public `ouhoyc-meuk-orga/meuk`, publié sur GitHub Pages : `https://ouhoyc-meuk-orga.github.io/meuk/`.
- L'organisation `ouhoyc-meuk-orga` est **dédiée à cette app** : elle donne à l'app son propre domaine
  (origine), séparé des autres sites GitHub Pages de l'utilisateur (`ouhoyc.github.io`), qui sinon
  partageraient la même base IndexedDB. **Ne jamais publier d'autre site dans cette organisation.**
- Le domaine sert d'identifiant à la passkey (RP ID = `ouhoyc-meuk-orga.github.io`) : il ne doit plus
  changer une fois la passkey créée (sinon seule la phrase de secours permet de récupérer les données).
  ⚠️ L'utilisateur peut encore renommer l'organisation **avant** l'étape 2 — lui redemander de confirmer le nom.
- Le code ne contient aucune donnée personnelle. Aucun serveur, backend, compte ou base en ligne.

## 3. Stack

- HTML, CSS, JavaScript simples, sans framework, sans étape de build si possible.
- Zéro ressource chargée depuis Internet : pas de CDN, pas de Google Fonts (police système `-apple-system`),
  pas d'analytics, pas de pub, pas de tracker.
- Seul ajout externe prévu (validé dans le plan) : la **liste de mots BIP39 française** (2048 mots, licence MIT),
  copiée dans le repo, pour la phrase de secours. Aucune bibliothèque de code.

## 4. Stockage

- Un seul emplacement : une base **IndexedDB** dédiée.
- Rien dans localStorage, sessionStorage, cookies, ni dans le cache du service worker
  (sauf préférences non sensibles, à signaler à l'utilisateur avant — aucune prévue).
- Demander le stockage persistant (`navigator.storage.persist()`).
- **Tout est chiffré, y compris les dates** : seul un identifiant aléatoire est en clair. Les données sont
  déchiffrées en mémoire au déverrouillage.
- Montants stockés en **centimes (entiers)**.
- Bouton « Effacer toutes mes données » avec double confirmation : supprime la base et tout ce que l'app a stocké
  (+ désinscription du service worker et vidage de son cache). Expliquer comment supprimer la passkey dans
  l'app Mots de passe d'iOS.

## 5. Chiffrement et Face ID

- WebCrypto, **AES-GCM 256 bits**, IV unique et aléatoire à chaque chiffrement.
- Déverrouillage par **Face ID via une passkey WebAuthn** : authenticator de plateforme,
  `userVerification: "required"`.
- **Extension WebAuthn PRF** → secret → **HKDF** → clé qui déchiffre la clé de données.
- Chiffrement **en enveloppe** : une clé de données aléatoire chiffre les dépenses ; elle est chiffrée deux fois :
  1. par la clé dérivée de Face ID (PRF) ;
  2. par une **phrase de secours** générée à la création (12 mots BIP39 FR), dérivation **PBKDF2-SHA256**
     avec un nombre élevé d'itérations, notée sur papier par l'utilisateur.
- La phrase de secours permet de tout récupérer si la passkey est perdue.
- Clés non extractibles quand c'est possible, uniquement en mémoire pendant l'utilisation.
- **Verrouillage automatique** : passage en arrière-plan (`visibilitychange`) et après quelques minutes
  d'inactivité ; la clé est effacée de la mémoire. (L'utilisateur sait que Face ID sera demandé à chaque ouverture.)
- **Si PRF n'est pas supporté : NE PAS improviser.** Prévenir l'utilisateur et proposer des alternatives
  (ex. Face ID comme simple verrou + phrase de passe pour le chiffrement).
- Synchronisation de la passkey : sur iOS, un site ne peut pas empêcher la synchro iCloud de la passkey.
  **Décision : on garde la synchro iCloud** (trousseau chiffré de bout en bout ; les données restent sur
  le téléphone ; la passkey revient automatiquement en cas de changement d'iPhone).

## 6. Content Security Policy

GitHub Pages n'envoie pas d'en-têtes : CSP en `<meta>` dans chaque page HTML, au minimum :

```
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; manifest-src 'self'; worker-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'
```

- Pas de script inline, pas d'eval, pas de style inline (ni attribut `style=`).
- Vérifier que WebAuthn, IndexedDB, export et import fonctionnent avec cette CSP.
- Limites connues (expliquées à l'utilisateur) : la CSP en `<meta>` ne s'applique pas au service worker
  (donc `sw.js` doit rester minimal et lisible) ; `frame-ancestors` n'est pas supporté en `<meta>`.
- `connect-src 'none'` : la page ne fait aucune requête ; la détection de mise à jour passe par le
  mécanisme natif du service worker (`registration.update()`).
- Le service worker ne fait que mettre en cache les fichiers statiques de l'app. Il ne lit ni ne transmet
  jamais de données, et ne fait jamais de requête vers un autre domaine.

## 7. Mises à jour

- Pas de mise à jour silencieuse : quand une nouvelle version est détectée, l'app affiche un message et
  l'utilisateur choisit de l'appliquer.
- Numéro de version visible dans l'app (Réglages).

## 8. Sauvegardes

- **Export chiffré** (déchiffrable avec la phrase de secours), via la feuille de partage iOS
  (Web Share API avec fichier) ou un téléchargement.
- **Import** : choix d'un fichier, déchiffrement, puis **fusion ou remplacement** au choix, avec confirmation.
- **Export CSV en clair**, précédé d'un avertissement clair.

## 9. Spécificités iOS

- Manifest + balises Apple (apple-touch-icon, apple-mobile-web-app-capable, status bar), icônes.
- Safe areas (encoche / Dynamic Island).
- Mobile d'abord, utilisable d'une main, **mode sombre automatique**.
- Pas de notifications push (elles nécessitent un serveur).

## 10. Fonctionnalités

Objectif : noter une dépense en quelques secondes, puis consulter facilement jour par jour et mois par mois.
Interface très simple, propre, moderne, minimaliste, premium. Pas de fonctionnalités inutiles.
L'information la plus importante : **montant, libellé, date/heure**.

### Navigation (barre d'onglets)
- **Aujourd'hui** · **Historique** · **Récapitulatif** · **Récurrentes**
- **Réglages** : petite roue dentée en haut (export, import, CSV, effacement, version) — pas un 5e onglet.

### Aujourd'hui (écran d'ouverture)
- L'app s'ouvre toujours sur la date du jour.
- Formulaire à deux champs :
  - **Montant** : chiffres et décimales seulement, symbole **€** affiché, clavier numérique iOS
    (`inputmode="decimal"`), virgule ET point acceptés, max 2 décimales, ni zéro ni négatif.
  - **Libellé** : texte libre, **obligatoire**. Pas de suggestions automatiques.
- À la validation sur **aujourd'hui** : date ET heure exacte du téléphone (heures, minutes, secondes),
  sans saisie manuelle. Ex. : « Essence — 50,00 € — 04/10/2026 à 10:24:37 ».
- Sur **un autre jour** que aujourd'hui : un **champ heure** apparaît, pré-rempli avec l'heure actuelle,
  modifiable par l'utilisateur.
- Liste des dépenses du jour affiché, de la plus récente à la plus ancienne, avec **total du jour**.
- Navigation ‹ › entre les jours ; toucher la date ouvre un calendrier pour choisir n'importe quel jour
  passé ou **futur**.
- Rappel discret « N dépenses prévues à confirmer » s'il y en a.

### Dépenses prévues (futures)
- Une dépense créée sur une date future est **« prévue »**, clairement identifiable (visuellement distincte,
  grisée), pour ne pas la confondre avec une dépense réelle.
- Elle reste « prévue » **jusqu'à confirmation manuelle** par l'utilisateur (un tap « Payée »),
  même quand sa date est passée.
- Les prévues sont **anecdotiques** : pas de total séparé ; elles n'entrent dans **aucun total**.

### Modification et suppression
- Chaque dépense est modifiable (montant, libellé, date et heure) et supprimable (avec confirmation).

### Historique
- Tous les jours à la suite, du plus récent au plus ancien, groupés par jour avec le total de chaque jour.
  Format :
  ```
  SAMEDI 4 OCTOBRE
  10:24:37 — Essence — 50,00 €
  08:51:12 — Courses — 73,42 €
  ```

### Récapitulatif (mois sélectionné)
- Total dépensé du mois (**dépenses réelles uniquement**), nombre de dépenses, liste des jours avec leur total.
- Navigation facile entre les mois (précédent / suivant).
- Les prévues apparaissent grisées dans la liste, sans total séparé.

### Dépenses récurrentes
- Section dédiée pour créer / modifier / supprimer des récurrentes (loyer, abonnement, assurance…).
- **Toutes les récurrentes sont automatiques** (pas de récurrentes « non automatiques » — supprimé à la demande
  de l'utilisateur). Champs : montant, libellé, **jour du mois**.
- Chaque mois, la récurrente génère une dépense **« prévue »**, qui doit être **confirmée** manuellement
  comme toute prévue.
- Jour inexistant dans le mois (ex. 31 en février) → dernier jour du mois.
- Pas de traitement en arrière-plan possible : la génération se fait à l'ouverture de l'app (après
  déverrouillage), avec **rattrapage des mois manqués**, sans jamais créer de doublon.
- Modifier une récurrente n'affecte que les mois à venir ; la supprimer ne supprime pas les dépenses déjà créées.

## 11. Plan par étapes (l'utilisateur teste sur iPhone après chacune)

0. **Test PRF** : page minimale pour vérifier Face ID + PRF sur l'iPhone. Si échec → s'arrêter et en parler.
1. **Socle** : structure, CSP, manifest, icônes, service worker, bannière de mise à jour, version.
2. **Sécurité** : création passkey + phrase de secours, déverrouillage, verrouillage auto, base chiffrée.
3. **Aujourd'hui** : saisie, liste du jour, total, modification et suppression.
4. **Navigation entre les jours** : passé, futur, dépenses prévues et confirmation.
5. **Historique**.
6. **Récapitulatif** mensuel.
7. **Dépenses récurrentes**.
8. **Réglages** : export chiffré, import (fusion / remplacement), CSV avec avertissement, effacement total.
9. **Finitions** : design, mode sombre, relecture de sécurité.

Expliquer aussi à l'utilisateur comment activer GitHub Pages et installer l'app sur l'iPhone.

## 12. Arborescence prévue

```
index.html              page unique, CSP en <meta>
manifest.webmanifest
sw.js                   service worker : cache des fichiers + mises à jour
css/app.css
icons/                  icônes de l'app (dont apple-touch-icon)
js/
  app.js                démarrage, navigation entre onglets
  db.js                 IndexedDB
  crypto.js             AES-GCM, HKDF, PBKDF2, enveloppe
  auth.js               passkey, Face ID, PRF
  lock.js               verrouillage automatique
  wordlist-fr.js        liste de mots BIP39 FR pour la phrase de secours
  expenses.js           dépenses (ajout, modification, prévues)
  recurring.js          récurrentes + rattrapage des mois
  backup.js             export, import, CSV, effacement
  update.js             détection et application des mises à jour
  format.js             euros, dates en français
  views/                today.js, history.js, recap.js, recurring.js, settings.js
README.md               installation, GitHub Pages, suppression de la passkey
```

## 13. Décisions complémentaires (4 octobre 2026)

- Nom de l'organisation **confirmé** : `ouhoyc-meuk-orga` (RP ID définitif : `ouhoyc-meuk-orga.github.io`).
- Publication : GitHub Pages publie la branche **`main`** (racine). Chaque étape arrive par une demande de
  fusion que l'utilisateur valide. Recommander une protection de `main` (aucune modification sans son accord).
- La passkey créée à l'étape 0 est **jetable** (aucune donnée protégée) : aider l'utilisateur à la supprimer
  dans l'app Mots de passe, puis à créer la vraie à l'étape 2. Toujours prévenir avant toute action
  irréversible (la suppression de la vraie passkey rend la phrase de secours indispensable).
- Verrouillage automatique après **5 minutes** d'inactivité (en plus du passage en arrière-plan).
- Nom affiché sous l'icône : **Meuk**. Icône : **symbole dollar ($) vert sur fond noir** (choix assumé,
  même si les montants sont en euros).
- Phrase de secours : **une seule vérification** à la création (retaper quelques mots tirés au hasard).
- Historique : s'arrête à **aujourd'hui**. Les dépenses prévues futures apparaissent dans une partie
  **« À venir »**, affichée seulement s'il y en a (emplacement exact à décider à l'étape 5).
- **Mises à jour — choix A** (validé après test sur l'iPhone) : iOS installe automatiquement une version en
  attente quand l'app est complètement fermée puis rouverte ; un site ne peut pas l'empêcher simplement.
  Donc : app ouverte → bannière « Mettre à jour / Plus tard », réaffichée à chaque retour dans l'app ;
  après une installation (demandée ou faite par iOS) → message « Meuk a été mis à jour (version X) ».
  Le choix B (bloquer toute mise à jour sans accord) a été écarté : complexe, fragile, et incomplet (`sw.js`
  se met de toute façon à jour seul) ; la vraie protection est la demande de fusion validée par l'utilisateur.
- Stockage technique en clair (signalé et accepté) : magasin `meta` de la base IndexedDB `meuk`, contenant
  uniquement `lastVersion` (numéro de la dernière version vue).
- **Reportés** (à trancher plus tard avec l'utilisateur) :
  - à la confirmation « Payée », la prévue garde-t-elle sa date ou prend-elle l'heure de confirmation ? (étape 4)
  - récurrentes : heure des dépenses générées, prise en compte ou non du mois en cours à la création. (étape 7)

## 14. État actuel

- **Étape 0 validée** (4 octobre 2026) sur l'iPhone : Face ID demandé, PRF fourni (256 bits), même clé
  d'un onglet à l'autre (empreinte identique), chaîne HKDF → AES-GCM OK. Le plan est confirmé, pas
  d'alternative nécessaire.
  - Un essai en navigation privée a renvoyé « opération annulée » (Face ID non abouti) : iOS ne précise
    jamais la raison ; prévoir un simple message « Déverrouillage annulé — réessayer ».
  - La passkey de test « Meuk (test) » existe encore : la faire supprimer au début de l'étape 2.
  - Rappeler de ne jamais utiliser l'app en navigation privée (données effacées à la fermeture).
- **Étape 1 validée sur l'iPhone** (installation écran d'accueil, plein écran, hors connexion / mode avion OK).
  Fichiers : `index.html`, `manifest.webmanifest`, `sw.js`, `css/app.css`, `js/app.js`,
  `js/format.js`, `js/update.js`, `js/version.js`, `icons/` (dont `icon.svg`, source des PNG).
  La version est dupliquée dans `js/version.js` et `sw.js` (doivent rester identiques).
  - `main` protégée par un ruleset (pas de suppression, pas de force push, demande de fusion obligatoire).
  - Version 0.1.1 publiée pour tester la bannière : le message ne revenait pas après « Plus tard » (corrigé),
    et la version s'est installée seule après fermeture complète (comportement iOS → choix A).
  - Version 0.1.2 : correctifs du choix A + `js/db.js` (base IndexedDB, magasin `meta`). À valider sur
    l'iPhone, puis une version 0.1.3 servira à tester le message « Meuk a été mis à jour ».
  - Leçon : une correction du mécanisme de mise à jour ne peut se tester qu'à la version SUIVANTE (pendant
    l'attente, c'est l'ancien code qui tourne). Le test de la 0.1.2 a donc échoué normalement ; la 0.1.3
    (seul le numéro change) sert à tester « Plus tard » + retour, et le message après fermeture complète.
- **Étape 1 terminée** (mises à jour testées sur l'iPhone jusqu'à la 0.1.3 : message réaffiché après
  « Plus tard », message « Meuk a été mis à jour » après fermeture complète).
- **Étape 2 validée sur l'iPhone** (version 0.2.0) : création, phrase vérifiée, verrouillage (arrière-plan,
  fermeture, 5 min), Face ID, récupération par la phrase + nouvelle passkey : tout fonctionne.
- Version 0.2.1 (demande de l'utilisateur) : **Face ID automatique** à l'ouverture et au retour dans l'app,
  sans appui. iOS peut refuser une demande Face ID sans appui : dans ce cas, aucun message, le bouton
  « Déverrouiller avec Face ID » reste disponible (un appui annule un essai automatique resté en suspens).
  Aucun changement de sécurité (Face ID toujours exigé).
  Résultat sur l'iPhone : à l'ouverture, iOS affiche sa propre fenêtre « Se connecter… Utiliser la clé
  d'accès » (confirmation imposée par iOS pour toute demande sans appui : impossible à supprimer) ;
  au retour d'une autre app, rien (iOS refuse sans message sur une page déjà ouverte).
- Version 0.2.2 : **verrouiller = recharger la page** (efface toute la mémoire de l'app). Arrière-plan →
  contenu masqué et clé oubliée tout de suite, rechargement au retour → Face ID automatique comme à
  l'ouverture. Inactivité / « Verrouiller maintenant » → rechargement immédiat SANS Face ID automatique
  (marqueur `#verrouille` dans l'adresse, retiré au démarrage). Une saisie non validée est perdue au
  verrouillage. **Validé sur l'iPhone** : la fenêtre Face ID s'ouvre seule à l'ouverture ET au retour.
- **Étape 3 en cours** (version 0.3.0) — Aujourd'hui : saisie, liste du jour, total, modification, suppression.
  - Fiche chiffrée (magasin `records`) : `{ id, box: { iv, ct } }` ; contenu chiffré
    `{ type: 'expense', v: 1, amount, label, at }` ; l'`id` est lié au chiffrement (données additionnelles
    authentifiées) : une fiche échangée ou recopiée devient illisible (signalée, ignorée).
  - `amount` en centimes entiers (1 à 99 999 999, soit 999 999,99 € au plus) ; `at` = heure locale du
    téléphone « AAAA-MM-JJTHH:MM:SS » (insensible aux fuseaux horaires).
  - Saisie du montant filtrée à la frappe (chiffres, une virgule ou un point, 2 décimales, 6 chiffres
    avant la virgule) ; libellé obligatoire, 100 caractères au plus.
  - Modification : montant, libellé, date, heure (si l'iPhone ne propose que HH:MM, les secondes d'origine
    sont gardées quand l'heure ne change pas, sinon :00). Dates futures refusées jusqu'à l'étape 4.
  - Suppression avec confirmation (fenêtre native d'iOS).
  - Les dépenses déchiffrées ne vivent qu'en mémoire ; vidées au verrouillage.
- Choix techniques de l'étape 2 :
  - Face ID n'est déclenché que par un appui de bouton (exigence iOS) : la création demande donc deux
    appuis + Face ID (créer la passkey, puis activer le chiffrement), le déverrouillage un appui.
  - Identifiant utilisateur WebAuthn **fixe** (`meuk-user-v1`) : recréer une passkey (phrase de secours,
    réinstallation) remplace l'ancienne dans Mots de passe au lieu d'en accumuler. Conséquence : ne jamais
    créer un 2e coffre Meuk sur un autre appareil Apple (il remplacerait la passkey du premier, qui devrait
    alors passer par la phrase de secours).
  - Phrase : 12 mots BIP39 FR standard (128 bits + contrôle), vérifiés identiques à la bibliothèque de
    référence ; saisie sans accents ni majuscules acceptée ; la clé « phrase » dérive des 16 octets
    retrouvés (PBKDF2-SHA256, 600 000 itérations, sel aléatoire).
  - Vérification : 3 mots tirés au hasard, une seule fois ; rien n'est enregistré avant.
  - Coffre (IndexedDB `meuk` v2, magasin `vault`) : identifiant de passkey, sels, nombre d'itérations,
    clé de données chiffrée par PRF et par la phrase, témoin chiffré. Aucun mot de la phrase stocké.
    Magasin `records` créé (vide) pour les dépenses.
  - Après la phrase de secours : déverrouillage, puis proposition d'une nouvelle passkey (remplace l'ancienne).
  - Verrouillage : arrière-plan (`visibilitychange`, `pagehide`), 5 min d'inactivité, bouton « Verrouiller
    maintenant » dans Réglages ; suspendu pendant une demande Face ID.
  - Safari et l'app de l'écran d'accueil ont des stockages SÉPARÉS : la création affiche un avertissement
    hors écran d'accueil.
  - Réglages affiche l'état du stockage persistant (« protégé » / « non protégé »).
  - Fichiers ajoutés hors arborescence prévue : `js/vault.js` (logique du coffre), `js/views/security.js`.
- **Étape 3 validée sur l'iPhone.** À la demande de l'utilisateur (« trop lent »), **étapes 4 à 9 livrées
  ensemble** (version 1.0.0) pour une vérification globale.
- Décisions reportées, prises par défaut (modifiables si l'utilisateur le demande) :
  - « Payée » : la dépense garde sa date et son heure prévues.
  - Récurrente : dépense prévue à 00:00:00 le jour choisi (heure non affichée : « Récurrente ») ; le mois
    de création compte si ce jour n'est pas encore passé, sinon début le mois suivant.
  - « À venir » : en haut de l'Historique. Rappel « N dépenses prévues à confirmer » = prévues dont la date
    est arrivée ; un appui ouvre leur liste avec « Payée ».
  - Modifier la date d'une dépense vers le futur la rend « prévue » ; une prévue peut être confirmée même
    avant sa date (payée en avance).
- Étape 4 : ‹ › entre les jours, appui sur la date = calendrier iOS (champ date transparent), « Revenir à
  aujourd'hui », champ heure (pré-rempli, modifiable) pour un autre jour, prévues grisées + badge.
- Étape 5 : Historique groupé par jour (« DIMANCHE 4 OCTOBRE », année ajoutée si ≠ année en cours), lignes
  « 10:24:37 — Essence — 50,00 € », total réel par jour (pas de total pour un jour sans dépense réelle).
- Étape 6 : Récap mensuel (total réel, nombre, jours avec total ; prévues grisées) ; appui sur un jour →
  ce jour dans Aujourd'hui.
- Étape 7 : `js/recurring.js` : fiche chiffrée `{ type: 'recurring', v: 1, amount, label, day, start, last }` ;
  génération au déverrouillage du premier mois non généré au mois en cours ; anti-doublon par
  `recurringId` + `month` sur la dépense ; jour 31 → dernier jour du mois.
- Étape 8 : `js/backup.js`, `js/views/settings.js` :
  - Sauvegarde `.meuk` (JSON) : sel + itérations + clé de données chiffrée par la phrase + témoin + fiches
    chiffrées (id en clair). Aucune donnée en clair. Même coffre → import direct ; autre coffre → phrase
    de la sauvegarde demandée.
  - Import : tout est déchiffré et vérifié avant d'écrire ; fusion (ajoute les absentes) ou remplacement
    (écrit d'abord, supprime ensuite), avec confirmation.
  - CSV : avertissement « non chiffré » ; `;`, virgule décimale, BOM (Excel FR) ; protection contre
    l'injection de formules.
  - Partage : fichier préparé, puis bouton « Partager / Enregistrer… » (feuille de partage iOS, appel
    direct dans l'appui) ou « Télécharger ».
  - Effacement : double confirmation ; base supprimée, cache vidé, service worker désinscrit ; écran
    expliquant la suppression de la passkey dans Mots de passe.
- Étape 9 : relecture de sécurité (aucune requête réseau hors service worker, aucun stockage hors
  IndexedDB, aucun innerHTML/eval, aucun style ou script en ligne, aucune ressource externe) ; textes
  affichés uniquement via `textContent`.
- **Version 1.1.0** (retours de l'utilisateur après la 1.0.0) :
  - Historique : **glisser une dépense vers la gauche** fait apparaître une poubelle rouge ; un appui dessus
    supprime **sans autre confirmation** (le geste vaut confirmation). Un appui sur une ligne ouverte la
    referme ; un simple appui ouvre toujours la modification.
  - **Couleurs** (libellé + montant), partout : dépenses issues d'une récurrente (et modèles de récurrentes)
    en **vert**, autres dépenses en **rouge**. Les prévues restent atténuées + badge.
  - Aujourd'hui : **total du mois** (réel) du jour affiché, sous le total du jour (« Total d'octobre »).
  - Historique : la liste détaillée « À venir » est remplacée par une ligne **« À venir ce mois-ci »** =
    montant cumulé des prévues restantes du mois en cours, tout en haut (au-dessus du jour).
- **Version 1.2.0** (retours de l'utilisateur sur la 1.1.0) :
  - Aujourd'hui : le **total du mois passe au-dessus** du total du jour.
  - Récap des **mois à venir** : les récurrentes y sont montrées à l'avance (prévues « virtuelles », non
    enregistrées, non modifiables). « Payée » sur l'une d'elles crée tout de suite la dépense, déjà payée
    (paiement d'avance) ; la génération du mois, le moment venu, ne la recrée pas (même récurrente + mois).
  - Historique : les dépenses **déjà payées apparaissent même si leur date est future** (en tête, jours
    futurs d'abord) ; « À venir ce mois-ci » se place juste au-dessus d'aujourd'hui. Les prévues futures
    non payées n'y figurent toujours pas (seulement dans le cumul « À venir ce mois-ci »).
- **Version 1.3.0** — signification des couleurs précisée par l'utilisateur : **rouge = carte de crédit**
  (solde à régler en fin de période, mode de paiement principal, choix par défaut), **vert = carte de
  débit** (déjà réglé).
  - Nouveau champ chiffré `card: 'credit' | 'debit'` sur la dépense. Fiches sans ce champ : débit si elle
    vient d'une récurrente, crédit sinon (comportement inchangé pour l'existant).
  - Saisie : case **« Déjà réglé (carte de débit) »**, décochée par défaut, décochée de nouveau après
    chaque ajout. Même case dans la modification (pour corriger après coup).
  - Dépenses des récurrentes : débit (vert) par défaut ; modifiables une par une.
  - CSV : colonne « Carte » (Crédit / Débit).
- **Version 1.4.0** :
  - L'utilisateur ne veut **aucune mention de carte** dans l'app : l'option s'appelle simplement
    **« Déjà réglé »** (facultative, désactivée par défaut), présentée en **interrupteur iOS**. Vert = déjà
    réglé, rouge = à régler. CSV : colonne « Déjà réglé » (Oui / Non). (Le champ interne reste `card`.)
  - **Refonte du design**, plus premium et épuré : interface monochrome (boutons pleins noirs en clair,
    blancs en sombre), vert / rouge réservés aux montants ; chiffres en SF Pro Rounded (`ui-rounded`,
    police système, rien de téléchargé) ; cartes arrondies (20 px) avec ombres légères en mode clair ;
    totaux du mois et du jour réunis dans une carte ; montant de saisie centré, en grand ; boutons ronds
    pour la navigation ; badges en pastille ; barre d'onglets floutée ; écrans de sécurité aérés.
- **Version 1.5.0** — l'app s'appelle désormais **« Dépenses »** (nom sous l'icône, titre, textes,
  passkey créée sous ce nom). **Nouvelle icône** : carnet noir à élastique, vu en plongée, stylo plume
  dessus et billets verts qui dépassent, sur fond anthracite (générée par l'utilisateur avec Higgsfield ;
  source recadrée : `icons/icon-1024.png`, l'ancien `icon.svg` est supprimé).
  - L'adresse (`ouhoyc-meuk-orga.github.io/meuk`) et les identifiants internes (base `meuk`, étiquettes
    de chiffrement, `meuk-user-v1`) **ne changent pas** : la passkey et les données en dépendent.
  - iOS fige nom et icône à l'ajout sur l'écran d'accueil : il faut supprimer l'ancienne icône et
    ré-ajouter l'app (l'utilisateur n'a encore aucune donnée : pas de sauvegarde à transférer ; un nouveau
    coffre et une nouvelle phrase de secours seront créés, la nouvelle passkey remplace l'ancienne).
  - Fichiers exportés renommés : `depenses-sauvegarde-AAAA-MM-JJ.json`, `depenses-AAAA-MM-JJ.csv`
    (l'import accepte toujours `.meuk` et `.json`).
- **Version 1.5.1** : écrans d'ouverture (verrouillage, bienvenue, phrase de secours…) **toujours sur le
  gris anthracite de l'icône** (`#1F1D22`), en mode clair comme sombre, barre d'état iOS assortie
  (`theme-color` modifié pendant ces écrans) ; **carnet affiché en grand** (`icons/logo-720.jpg`, recadrage
  serré de l'image d'origine, 52 Ko), fondu dans le fond sans carré visible.
- **Version 1.6.0** :
  - **Zoom désactivé** partout (écrans d'ouverture compris) : `maximum-scale=1, user-scalable=no` dans le
    viewport, `touch-action: manipulation` (double-tap), et blocage du pincement (`gesturestart/change/end`
    et `touchmove` à plusieurs doigts, `js/nozoom.js`). Limite : iOS ne garantit pas le blocage total ; le
    Zoom d'accessibilité d'iOS reste toujours possible (voulu par Apple).
  - Aujourd'hui : ligne **« Crédit »** entre le total du mois et le total du jour = total des dépenses
    réelles (non prévues) du mois affiché **non « déjà réglées »** (en rouge), montant en rouge. Le mot
    « Crédit » est demandé explicitement par l'utilisateur (seule mention de ce type dans l'app).
- Version 1.6.0 validée et en ligne. **L'utilisateur utilise l'app quelques semaines sans modification**
  pour repérer ce qui pêche à l'usage.

## 15. Pistes pour plus tard (notées le 4 octobre 2026, rien de décidé)

Idées de l'utilisateur, à rediscuter après sa période d'utilisation :

- **Réunir Récap et Historique** en un seul onglet.
- **Libérer l'onglet Récurrentes** : déplacer la gestion des récurrentes dans un autre menu (par exemple
  Réglages), et utiliser l'onglet libéré pour une nouvelle section, peut-être une catégorie « Chrome »
  (mot à faire préciser par l'utilisateur : dictée possible de « Crédit » ?) qui suivra des consignes
  qu'il donnera.
- **Vue d'ensemble du mois par catégories**, les catégories devant se faire **« un peu toutes seules »**.
  Contrainte de confidentialité : le classement automatique doit se faire **sur le téléphone**, sans
  service en ligne (par exemple des règles par mots-clés du libellé : « essence », « Carrefour »… →
  catégorie), éventuellement apprises à partir des corrections de l'utilisateur.

- ~~Bouton discret mode jour / mode nuit~~ → **fait en version 1.7.0** (voir ci-dessous).

Autres idées proposées par Claude (à valider) :

- **Rappel de sauvegarde** : afficher la date de la dernière sauvegarde dans Réglages, et un rappel au-delà
  d'un certain délai (les données n'existent que sur le téléphone).
- **« Solde réglé »** : un bouton pour passer d'un coup toutes les dépenses rouges du mois en vert une fois
  la carte remboursée.
- **Crédit mois par mois dans le Récap**.
- **Budget du mois** avec une jauge.
- **Recherche par libellé** dans l'Historique.
- Textes « Face ID » rendus neutres si l'app est utilisée sur Android (un ami de l'utilisateur pourrait
  l'installer depuis la même adresse : coffre séparé, aucune donnée partagée ; non testé sur Android).

## 16. Version 1.7.0 — mode jour / mode nuit (5 octobre 2026)

- Bouton discret dans la barre du haut, à gauche de la roue dentée : **lune** en mode jour, **soleil** en
  mode nuit ; un appui bascule.
- Par défaut (jamais touché), l'app **suit le réglage de l'iPhone**. Une fois choisi, le thème est forcé.
- Choix retenu dans le magasin `meta` de la base (`theme` = `light` / `dark`, **en clair, non sensible** —
  signalé à l'utilisateur, conformément au §4). « Effacer toutes mes données » le supprime aussi.
- Barre d'état iOS assortie au thème choisi (`theme-color`) ; les écrans d'ouverture restent anthracite.
- `js/theme.js` ; CSS : variables du mode nuit appliquées par `prefers-color-scheme` sauf si
  `data-theme="light"`, ou forcées par `data-theme="dark"`.

## 17. Version 1.8.0 — suite de l'audit UI/UX (5 octobre 2026)

Audit réalisé avec la compétence « UI/UX Pro Max » (liste de vérification mobile, contrastes mesurés).
Retenus par l'utilisateur :
- **Bandeau « Dépense supprimée — Annuler »** après une suppression par glissement dans l'Historique,
  **3 secondes** (choix de l'utilisateur) ; « Annuler » réenregistre la dépense à l'identique (même id).
- **Fenêtres de confirmation assorties à l'app** (feuille qui monte du bas, bouton dangereux en rouge,
  appui à côté = Annuler) à la place des `confirm()` / `alert()` de Safari : suppression d'une dépense ou
  d'une récurrente, export CSV, import (fusion / remplacement), effacement total (2 étapes). `js/views/dialog.js`.

**Refusés par l'utilisateur** (ne pas reproposer sans raison nouvelle) : signe en plus de la couleur
vert / rouge, contrastes du gris et du vert en mode clair, agrandissement des zones tactiles (« Payée »,
« Revenir à aujourd'hui », boutons ronds), « Réduire les animations », taille de texte iOS (Dynamic Type),
fermeture des feuilles en glissant, titres visibles au-dessus des champs, réactivation du zoom.
