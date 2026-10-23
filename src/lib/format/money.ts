/** Cent-Betrag als „12,50 €“; leer bei null. */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** Mit Vorzeichen „+ 12,50 €“ / „− 12,50 €“ (Kassenbuch). */
export function formatSignedCents(cents: number): string {
  if (cents === 0) return formatCents(0);
  return `${cents > 0 ? "+" : "−"} ${formatCents(Math.abs(cents))}`;
}

/** „12,5“, „1.234,50 €“, „12.50“ → Cent; leer, negativ oder ungültig → null. */
export function parseEuroToCents(value: string): number | null {
  let cleaned = value.replace(/[€\s]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
