# Meuk

Carnet de dépenses privé pour iPhone. **Les dépenses ne quittent jamais le téléphone** :
pas de serveur, pas de compte, rien n'est chargé depuis Internet.

Le détail des décisions est dans [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md).

## Publication (GitHub Pages)

Une seule fois : sur GitHub, **Settings → Pages → Source : « Deploy from a branch »**,
branche **`main`**, dossier **`/ (root)`**, puis **Save**.
L'app est alors en ligne à l'adresse : <https://ouhoyc-meuk-orga.github.io/meuk/>

Ne jamais publier d'autre site dans l'organisation `ouhoyc-meuk-orga`.

## Installation sur l'iPhone

1. Ouvrir l'adresse ci-dessus dans **Safari**, dans un onglet **normal** (pas en navigation privée).
2. Bouton **Partager** → **« Sur l'écran d'accueil »** → **Ajouter**.
3. Ouvrir **Meuk** depuis l'écran d'accueil (et non plus depuis Safari).

## Mises à jour

Quand une nouvelle version est publiée, Meuk affiche un message en ouvrant l'app.
La mise à jour ne s'applique que si l'on appuie sur **« Mettre à jour »**.
La version installée est visible dans **Réglages** (roue dentée).

Pour publier une nouvelle version : changer le numéro dans `js/version.js` **et** dans `sw.js`
(les deux doivent être identiques), et ajouter dans la liste `FILES` de `sw.js` tout nouveau fichier.

## Supprimer la passkey (Face ID)

App **Mots de passe** d'iOS → rechercher `ouhoyc-meuk-orga.github.io` → choisir la passkey →
**Supprimer**. ⚠️ Pour la vraie passkey (à partir de l'étape 2), seule la phrase de secours
permettra ensuite de récupérer les données.
