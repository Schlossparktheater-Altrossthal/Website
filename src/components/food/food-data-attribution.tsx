/**
 * Quellenangabe der Lebensmitteldaten – Pflicht nach ODbL (Open Food Facts) und CC BY 4.0 (BLS),
 * überall, wo diese Daten angezeigt werden.
 */
export function FoodDataAttribution() {
  return (
    <p className="text-xs text-muted-foreground">
      Lebensmitteldaten:{" "}
      <a
        className="underline underline-offset-2 hover:text-foreground"
        href="https://world.openfoodfacts.org"
        target="_blank"
        rel="noreferrer"
      >
        Open Food Facts
      </a>{" "}
      (ODbL) ·{" "}
      <a
        className="underline underline-offset-2 hover:text-foreground"
        href="https://www.blsdb.de"
        target="_blank"
        rel="noreferrer"
      >
        Bundeslebensmittelschlüssel 4.0
      </a>
      , Max Rubner-Institut (CC BY 4.0)
    </p>
  );
}
