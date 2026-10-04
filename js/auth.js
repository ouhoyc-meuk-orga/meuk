// Passkey WebAuthn + Face ID + extension PRF.
// Chaque fonction doit être appelée DIRECTEMENT depuis un appui sur un bouton (exigence d'iOS).

const enc = new TextEncoder();

// Identifiant fixe de l'utilisateur pour ce site : recréer une passkey (phrase de secours, nouvelle
// installation) REMPLACE l'ancienne dans l'app Mots de passe au lieu d'en accumuler plusieurs.
const USER_ID = enc.encode('meuk-user-v1');

export class AuthError extends Error {
  constructor(code, cause) {
    super(code);
    this.code = code;
    this.cause = cause;
  }
}

function translate(err) {
  if (err instanceof AuthError) return err;
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'AbortError':
      return new AuthError('cancelled', err);
    case 'SecurityError':
      return new AuthError('security', err);
    case 'NotSupportedError':
      return new AuthError('not-supported', err);
    default:
      return new AuthError('other', err);
  }
}

export function passkeysSupported() {
  return Boolean(window.PublicKeyCredential && navigator.credentials);
}

// Crée la passkey (Face ID). Renvoie son identifiant.
export async function createPasskey() {
  let credential;
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'Meuk' },
        user: { id: USER_ID, name: 'Meuk', displayName: 'Meuk' },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
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
  } catch (err) {
    throw translate(err);
  }
  const prf = credential.getClientExtensionResults().prf;
  if (prf && prf.enabled === false) throw new AuthError('no-prf');
  return new Uint8Array(credential.rawId);
}

// Demande Face ID et renvoie le secret PRF (32 octets) propre à cette passkey et à ce sel.
export async function getPrfSecret(credentialId, prfSalt) {
  let assertion;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: credentialId }],
        userVerification: 'required',
        timeout: 120000,
        extensions: { prf: { eval: { first: prfSalt } } }
      }
    });
  } catch (err) {
    throw translate(err);
  }
  // Octet 32 des données de l'authentificateur, bit 2 : l'utilisateur a bien été vérifié (Face ID).
  const flags = new Uint8Array(assertion.response.authenticatorData)[32];
  if (!(flags & 0x04)) throw new AuthError('no-uv');

  const prf = assertion.getClientExtensionResults().prf;
  if (!prf || !prf.results || !prf.results.first) throw new AuthError('no-prf');
  return new Uint8Array(prf.results.first.slice(0));
}
