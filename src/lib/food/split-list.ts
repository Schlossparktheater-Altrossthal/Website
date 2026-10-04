/**
 * Zerlegt einen Sammeleintrag („Erdnüsse, rote Beete; Laktose“) in einzelne Angaben. Nur Komma
 * und Semikolon trennen – „Fructose-Intoleranz“ oder „Rind/Schwein“ bleiben ganz. Klammern
 * schützen ihren Inhalt („Linsen (rot, gelb)“ ist ein Eintrag).
 */
export function splitAllergenList(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of text) {
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if ((character === "," || character === ";") && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current);
  const cleaned = parts.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
  const seen = new Set<string>();
  return cleaned.filter((part) => {
    const key = part.toLocaleLowerCase("de-DE");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
