/** Finanzen (docs/Plan/finanzen-plan.md). Auslagen einreichen darf jedes Mitglied ohne eigenes Recht,
 * Gewerksleitung/Vertretung sieht das Budget ihres Gewerks über die Gewerk-Zugehörigkeit. */
export const FINANCE_PERMISSION_KEYS = {
  manage: "PRIVATE.FINANCE.MANAGE",
  view: "PRIVATE.FINANCE.VIEW",
} as const;

export const FINANCE_ENTRY_TYPE_LABELS = {
  income: "Einnahme",
  expense: "Ausgabe",
  transfer: "Umbuchung",
} as const;

export const FINANCE_FUND_KIND_LABELS = {
  bank: "Konto",
  cash: "Bargeld",
  other: "Sonstiges",
} as const;

export const EXPENSE_CLAIM_STATUS_LABELS = {
  submitted: "Eingereicht",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  paid: "Erstattet",
} as const;

export const EXPENSE_CLAIM_PAYOUT_LABELS = {
  cash: "Bar",
  bank: "Überweisung",
  paypal: "PayPal",
  donated: "Spenden",
} as const;

export const FINANCE_LIMITS = {
  description: 200,
  counterparty: 120,
  notes: 1000,
  /** 1 Mio. € – schützt vor Tippfehlern bei der Betragseingabe. */
  maxAmountCents: 100_000_000,
} as const;
