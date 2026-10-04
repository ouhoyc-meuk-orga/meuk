// Étape 0 : test Face ID (passkey WebAuthn) + extension PRF.
// Rien n'est enregistré ni envoyé : tout reste en mémoire le temps de la page.
'use strict';

(function () {
  const enc = new TextEncoder();

  // Identifiant fixe : recréer la passkey de test remplace l'ancienne au lieu d'en ajouter une.
  const TEST_USER_ID = enc.encode('meuk-test-prf');
  // Sel fixe pour PRF : même passkey + même sel => même secret à chaque fois.
  const PRF_SALT = enc.encode('meuk-test-prf-salt-v1');

  const logEl = document.getElementById('log');
  const btnCreate = document.getElementById('btn-create');
  const btnTest = document.getElementById('btn-test');
  const btnClear = document.getElementById('btn-clear');

  let previousFingerprint = null;
  let attempt = 0;

  function log(message, kind) {
    const li = document.createElement('li');
    li.textContent = message;
    li.className = kind || 'info';
    logEl.appendChild(li);
  }

  function randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function sameBytes(a, b) {
    const x = new Uint8Array(a);
    const y = new Uint8Array(b);
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function explainError(err) {
    switch (err && err.name) {
      case 'NotAllowedError':
        return 'Opération annulée ou refusée (ou délai dépassé).';
      case 'InvalidStateError':
        return 'Cette passkey existe déjà sur cet appareil.';
      case 'SecurityError':
        return "Refusé pour raison de sécurité (la page doit être ouverte en HTTPS sur le bon domaine).";
      case 'NotSupportedError':
        return 'Non supporté par cet appareil ou ce navigateur.';
      default:
        return (err && err.name ? err.name + ' : ' : '') + (err && err.message ? err.message : String(err));
    }
  }

  function setBusy(busy) {
    btnCreate.disabled = busy;
    btnTest.disabled = busy;
  }

  async function checkSupport() {
    log('Domaine : ' + location.hostname);
    if (!window.isSecureContext) {
      log('Page non sécurisée (HTTPS requis) : le test ne peut pas fonctionner.', 'ko');
      return false;
    }
    if (!window.PublicKeyCredential) {
      log('Passkeys (WebAuthn) non disponibles dans ce navigateur.', 'ko');
      return false;
    }
    try {
      const uvpa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      log(uvpa ? 'Face ID / Touch ID disponible pour les passkeys.' : 'Aucun Face ID / Touch ID disponible.', uvpa ? 'ok' : 'ko');
    } catch (e) {
      log('Impossible de vérifier Face ID : ' + explainError(e), 'ko');
    }
    if (typeof PublicKeyCredential.getClientCapabilities === 'function') {
      try {
        const caps = await PublicKeyCredential.getClientCapabilities();
        if ('extension:prf' in caps) {
          log(caps['extension:prf'] ? 'Le navigateur annonce le support de PRF.' : "Le navigateur annonce NE PAS supporter PRF.", caps['extension:prf'] ? 'ok' : 'ko');
        }
      } catch (e) {
        // Information facultative : le vrai test est plus bas.
      }
    }
    return true;
  }

  async function createPasskey() {
    setBusy(true);
    log('Création de la passkey de test…');
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          rp: { name: 'Meuk (test)' },
          user: { id: TEST_USER_ID, name: 'Meuk (test)', displayName: 'Meuk (test)' },
          challenge: randomBytes(32),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'required',
            requireResidentKey: true,
            userVerification: 'required'
          },
          attestation: 'none',
          timeout: 120000,
          extensions: { prf: {} }
        }
      });
      const prf = cred.getClientExtensionResults().prf;
      log('Passkey de test créée.', 'ok');
      if (prf && prf.enabled === true) {
        log('PRF activé sur cette passkey.', 'ok');
      } else if (prf && prf.enabled === false) {
        log('PRF NON disponible sur cette passkey.', 'ko');
      } else {
        log("PRF : pas de réponse à la création (on vérifiera à l'étape 2 du test).", 'info');
      }
      log('Passe maintenant au test Face ID (deux fois).');
    } catch (e) {
      log('Échec de la création : ' + explainError(e), 'ko');
    } finally {
      setBusy(false);
    }
  }

  // Petit test de la chaîne prévue : secret PRF -> HKDF -> clé AES-GCM 256 -> chiffrer / déchiffrer.
  async function checkCryptoChain(secret) {
    const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('meuk-test-kek') },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const iv = randomBytes(12);
    const message = enc.encode('Essence — 50,00 €');
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, message);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return sameBytes(plain, message);
  }

  async function testPasskey() {
    setBusy(true);
    attempt += 1;
    log('— Test n° ' + attempt + ' : Face ID demandé…');
    let secret = null;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          userVerification: 'required',
          timeout: 120000,
          extensions: { prf: { eval: { first: PRF_SALT } } }
        }
      });

      const flags = new Uint8Array(assertion.response.authenticatorData)[32];
      if (flags & 0x04) {
        log('Face ID confirmé (utilisateur vérifié).', 'ok');
      } else {
        log("Passkey utilisée SANS vérification Face ID : à signaler.", 'ko');
      }

      const handle = assertion.response.userHandle;
      if (handle && !sameBytes(handle, TEST_USER_ID)) {
        log("Attention : ce n'est pas la passkey « Meuk (test) » qui a été choisie.", 'ko');
      }

      const prf = assertion.getClientExtensionResults().prf;
      if (!prf || !prf.results || !prf.results.first) {
        log("ÉCHEC : l'iPhone n'a pas fourni de clé PRF. Arrête-toi là et préviens-moi.", 'ko');
        return;
      }
      secret = prf.results.first;
      log('Clé PRF reçue (' + secret.byteLength * 8 + ' bits).', 'ok');

      // On n'affiche jamais la clé : seulement une courte empreinte pour comparer deux essais.
      const fingerprint = toHex(await crypto.subtle.digest('SHA-256', secret)).slice(0, 16);
      log('Empreinte : ' + fingerprint);
      if (previousFingerprint === null) {
        log('Relance le test une seconde fois pour comparer.');
      } else if (previousFingerprint === fingerprint) {
        log('Même clé que le test précédent : PRF est fiable.', 'ok');
      } else {
        log('Clé DIFFÉRENTE du test précédent : à signaler.', 'ko');
      }
      previousFingerprint = fingerprint;

      const chainOk = await checkCryptoChain(secret);
      log(chainOk ? 'Chiffrement / déchiffrement de test : OK.' : 'Chiffrement de test : ÉCHEC.', chainOk ? 'ok' : 'ko');
    } catch (e) {
      log('Échec du test : ' + explainError(e), 'ko');
    } finally {
      if (secret) new Uint8Array(secret).fill(0);
      setBusy(false);
    }
  }

  btnCreate.addEventListener('click', createPasskey);
  btnTest.addEventListener('click', testPasskey);
  btnClear.addEventListener('click', function () {
    logEl.textContent = '';
    previousFingerprint = null;
    attempt = 0;
  });

  checkSupport().then(function (ok) {
    if (!ok) setBusy(true);
  });
})();
