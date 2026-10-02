/** Gewerks-Wunsch im Onboarding, Rückkehrer-Wizard und Profil (ohne Server-Abhängigkeiten). */
export type CrewWishOption = {
  code: string;
  domain: "crew";
  title: string;
  description: string;
  color: string | null;
  /** `null` für feste Wünsche ohne Blaupause (z. B. `crew_direction`). */
  templateId: string | null;
  /** Gespeicherte Codes, die als dieser Wunsch gelten (Alt-Codes der Blaupause). */
  matchCodes: string[];
};

/** Gewicht eines gespeicherten Wunsches für eine Option (höchstes passendes, sonst `null`). */
export function findMatchingWishWeight(
  option: Pick<CrewWishOption, "matchCodes">,
  weightsByCode: ReadonlyMap<string, number>,
): number | null {
  let best: number | null = null;
  for (const code of option.matchCodes) {
    const weight = weightsByCode.get(code);
    if (weight !== undefined && (best === null || weight > best)) best = weight;
  }
  return best;
}
