import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_DIGEST = "sha512";
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;

// --- Key Derivation ---

export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

export function generateDek(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

export function deriveKeyFromPassword(
  password: string,
  salt: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      PBKDF2_DIGEST,
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

// --- Server KEK ---

function getServerKek(): Buffer {
  return Buffer.from(process.env.VAULT_ENCRYPTION_KEY!, "hex");
}

// --- Low-level encrypt/decrypt with explicit key ---

export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptWithKey(encryptedData: string, key: Buffer): string {
  const [ivB64, authTagB64, ciphertextB64] = encryptedData.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// --- DEK wrapping ---

export function wrapDekWithKey(dek: Buffer, wrappingKey: Buffer): string {
  return encryptWithKey(dek.toString("base64"), wrappingKey);
}

export function unwrapDekWithKey(wrappedDek: string, wrappingKey: Buffer): Buffer {
  const dekB64 = decryptWithKey(wrappedDek, wrappingKey);
  return Buffer.from(dekB64, "base64");
}

export function wrapDekWithServerKek(dek: Buffer): string {
  return wrapDekWithKey(dek, getServerKek());
}

export function unwrapDekFromServerKek(wrappedDek: string): Buffer {
  return unwrapDekWithKey(wrappedDek, getServerKek());
}

// --- High-level encrypt/decrypt ---
// When key is provided, uses per-user DEK.
// When key is omitted, falls back to server KEK for legacy data.

export function encrypt(plaintext: string, key?: Buffer): string {
  return encryptWithKey(plaintext, key ?? getServerKek());
}

export function decrypt(encryptedData: string, key?: Buffer): string {
  return decryptWithKey(encryptedData, key ?? getServerKek());
}
