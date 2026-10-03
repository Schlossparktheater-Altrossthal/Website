/** Wiederkehrende Prisma-Selects für Lagerobjekte. */

/** Genug für `assetDisplayName` (Typname + Zusatz). */
export const ASSET_NAME_SELECT = {
  label: true,
  product: { select: { name: true } },
} as const;
