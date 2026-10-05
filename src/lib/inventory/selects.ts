/** Wiederkehrende Prisma-Selects für Lagerobjekte. */

/** Genug für `assetDisplayName` (Typname + Zusatz). */
export const ASSET_NAME_SELECT = {
  label: true,
  product: { select: { name: true } },
} as const;

/**
 * Sortierung nach Code numerisch (`T-2-1` vor `T-10-1`): Bereich, Typnummer, Exemplarnummer.
 * Als Text sortiert stünde `T-10` vor `T-2`.
 */
export function assetCodeOrder(dir: "asc" | "desc" = "asc") {
  return [
    { area: { prefix: dir } },
    { product: { number: dir } },
    { unitNumber: { sort: dir, nulls: "first" } },
  ] as const;
}

export const ASSET_CODE_ORDER = assetCodeOrder("asc");
