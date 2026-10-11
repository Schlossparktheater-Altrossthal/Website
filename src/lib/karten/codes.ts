import { createHash, randomBytes, randomInt } from "node:crypto";

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
