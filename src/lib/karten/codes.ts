import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";

/** Ohne leicht verwechselbare Zeichen (0/O, 1/I/L), damit Codes am Telefon diktierbar sind. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RESERVATION_CODE_LENGTH = 6;

export function generateReservationCode(length = RESERVATION_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalisiert Eingaben aus Scanner oder Tastatur („k7f-3qx“ → „K7F3QX“). */
export function normalizeReservationCode(value: string): string {
  const trimmed = value.trim();
  // QR-Inhalt kann ein Link sein: …/karten/c/K7F3QX
  const fromUrl = trimmed.match(/\/c\/([A-Za-z0-9-]+)\/?$/)?.[1] ?? trimmed;
  return fromUrl.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isReservationCode(value: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${RESERVATION_CODE_LENGTH}}$`).test(value);
}

export function generateSecretToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashSecretToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  return secret ? createHash("sha256").update(`karten-access:${secret}`).digest() : null;
}

/** Verschlüsselt einen Zugangs-Token (AES-GCM), damit der Link später wieder angezeigt werden kann. */
export function encryptSecretToken(token: string): string | null {
  const key = tokenKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecretToken(value: string | null | undefined): string | null {
  const key = tokenKey();
  if (!value || !key) return null;
  try {
    const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (error) {
    // Schlüssel geändert: Link lässt sich nur noch neu erzeugen.
    console.warn("[karten] Zugangs-Token nicht entschlüsselbar", error);
    return null;
  }
}
