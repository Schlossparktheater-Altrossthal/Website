/**
 * Zufällige, nicht erratbare Kennungen für Lager-URLs und QR-Codes
 * (docs/Plan/lager-typen-projekte-plan.md, F8). 12 Zeichen Base58 ≈ 70 Bit.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const PUBLIC_ID_LENGTH = 12;
const PUBLIC_ID_PATTERN = new RegExp(`^[${ALPHABET}]{${PUBLIC_ID_LENGTH}}$`);

export function createPublicId(): string {
  // 256 ist kein Vielfaches von 58 – Werte ab 232 verwerfen, damit alle Zeichen gleich oft vorkommen.
  const limit = 256 - (256 % ALPHABET.length);
  let result = "";
  while (result.length < PUBLIC_ID_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(PUBLIC_ID_LENGTH * 2));
    for (const byte of bytes) {
      if (byte >= limit) continue;
      result += ALPHABET[byte % ALPHABET.length];
      if (result.length === PUBLIC_ID_LENGTH) break;
    }
  }
  return result;
}

export function isPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}
