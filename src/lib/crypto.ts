/** Passphrase-protected backups. WebCrypto only: no dependencies and no network. Kept free of React so it runs in node tests. */

export const ENCRYPTED_KIND = "resume-builder-encrypted";
export const ENCRYPTED_VERSION = 1;
export const KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 8;
/** Bounds on what a file may ask for, so a hostile file cannot make the browser grind on key derivation. */
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 5_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedEnvelope {
  kind: typeof ENCRYPTED_KIND;
  v: typeof ENCRYPTED_VERSION;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string };
  ciphertext: string;
}

export type DecryptResult = { ok: true; plain: string } | { ok: false; reason: "wrong-passphrase" | "unsupported" };

const enc = new TextEncoder();
const dec = new TextDecoder();
/** The header is authenticated with the ciphertext, so changing `kind` or `v` makes decryption fail. */
const aad = () => enc.encode(`${ENCRYPTED_KIND}:${ENCRYPTED_VERSION}`);

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> | null {
  try {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(plain: string, passphrase: string, iterations = KDF_ITERATIONS): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad() }, key, enc.encode(plain));
  return {
    kind: ENCRYPTED_KIND,
    v: ENCRYPTED_VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: toBase64(salt) },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    ciphertext: toBase64(new Uint8Array(data)),
  };
}

/** Shape check for an untrusted file. Does not decrypt. */
export function isEncrypted(raw: unknown): raw is EncryptedEnvelope {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  if (r.kind !== ENCRYPTED_KIND) return false;
  const kdf = r.kdf as Record<string, unknown> | undefined;
  const cipher = r.cipher as Record<string, unknown> | undefined;
  if (typeof kdf !== "object" || kdf === null || typeof cipher !== "object" || cipher === null) return false;
  return (
    r.v === ENCRYPTED_VERSION
    && kdf.name === "PBKDF2" && kdf.hash === "SHA-256"
    && typeof kdf.iterations === "number" && Number.isInteger(kdf.iterations) && kdf.iterations >= MIN_ITERATIONS && kdf.iterations <= MAX_ITERATIONS
    && typeof kdf.salt === "string" && fromBase64(kdf.salt)?.length === SALT_BYTES
    && cipher.name === "AES-GCM"
    && typeof cipher.iv === "string" && fromBase64(cipher.iv)?.length === IV_BYTES
    && typeof r.ciphertext === "string" && r.ciphertext.length > 0
  );
}

/**
 * AES-GCM cannot tell a wrong passphrase from a damaged file, so both report "wrong-passphrase".
 * "unsupported" is a well-formed envelope this version cannot read.
 */
export async function decryptJson(env: EncryptedEnvelope, passphrase: string): Promise<DecryptResult> {
  if (!isEncrypted(env)) return { ok: false, reason: "unsupported" };
  const salt = fromBase64(env.kdf.salt);
  const iv = fromBase64(env.cipher.iv);
  const data = fromBase64(env.ciphertext);
  if (!salt || !iv || !data) return { ok: false, reason: "wrong-passphrase" };
  try {
    const key = await deriveKey(passphrase, salt, env.kdf.iterations);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad() }, key, data);
    return { ok: true, plain: dec.decode(plain) };
  } catch {
    return { ok: false, reason: "wrong-passphrase" };
  }
}

/** Errors for the set-passphrase form. No strength score: a length floor and a typo check. */
export function validatePassphrase(passphrase: string, confirm: string): string[] {
  const errors: string[] = [];
  if ([...passphrase].length < MIN_PASSPHRASE) errors.push(`Use at least ${MIN_PASSPHRASE} characters.`);
  else if (passphrase !== confirm) errors.push("The two passphrases do not match.");
  return errors;
}
