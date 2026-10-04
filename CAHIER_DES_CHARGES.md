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
