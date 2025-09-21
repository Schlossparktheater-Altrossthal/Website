import type {
  FinanceAttachment,
  FinanceBudget,
  FinanceEntry,
  FinanceLog,
  FinanceType,
  VisibilityScope,
} from "@prisma/client";

export type NamedUser = { id: string; name: string | null; email: string | null } | null;

export type FinanceEntryWithRelations = FinanceEntry & {
  show?: { id: string; title: string | null; year: number } | null;
  budget?: (FinanceBudget & { show?: { id: string; title: string | null; year: number } | null }) | null;
  createdBy?: NamedUser;
  approvedBy?: NamedUser;
  memberPaidBy?: NamedUser;
  attachments: FinanceAttachment[];
  logs: (FinanceLog & { changedBy?: NamedUser })[];
};

export type FinanceEntryDTO = {
  id: string;
  type: FinanceType;
  kind: FinanceEntry["kind"];
  status: FinanceEntry["status"];
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  category: string | null;
  bookingDate: string;
  dueDate: string | null;
  paidAt: string | null;
  invoiceNumber: string | null;
  vendor: string | null;
  memberPaidById: string | null;
  donationSource: string | null;
  donorContact: string | null;
  tags: unknown;
  show: { id: string; title: string | null; year: number } | null;
  budget:
    | {
        id: string;
        category: string;
        plannedAmount: number;
        currency: string;
        show: { id: string | null; title: string | null; year: number | null };
      }
    | null;
  visibilityScope: FinanceEntry["visibilityScope"];
  createdBy: NamedUser;
  approvedBy: NamedUser;
  memberPaidBy: NamedUser;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: {
    id: string;
    filename: string;
    url: string | null;
    mimeType: string | null;
    size: number | null;
    createdAt: string;
  }[];
  logs: {
    id: string;
    fromStatus: FinanceLog["fromStatus"];
    toStatus: FinanceLog["toStatus"];
    note: string | null;
    createdAt: string;
    changedBy: NamedUser;
  }[];
};

export function mapFinanceEntry(entry: FinanceEntryWithRelations): FinanceEntryDTO {
  return {
    id: entry.id,
    type: entry.type,
    kind: entry.kind,
    status: entry.status,
    title: entry.title,
    description: entry.description ?? null,
    amount: entry.amount,
    currency: entry.currency,
    category: entry.category ?? null,
    bookingDate: entry.bookingDate.toISOString(),
    dueDate: entry.dueDate ? entry.dueDate.toISOString() : null,
    paidAt: entry.paidAt ? entry.paidAt.toISOString() : null,
    invoiceNumber: entry.invoiceNumber ?? null,
    vendor: entry.vendor ?? null,
    memberPaidById: entry.memberPaidById ?? null,
    donationSource: entry.donationSource ?? null,
    donorContact: entry.donorContact ?? null,
    tags: entry.tags ?? null,
    show: entry.show
      ? {
          id: entry.show.id,
          title: entry.show.title,
          year: entry.show.year,
        }
      : null,
    budget: entry.budget
      ? {
          id: entry.budget.id,
          category: entry.budget.category,
          plannedAmount: entry.budget.plannedAmount,
          currency: entry.budget.currency,
          show: {
            id: entry.budget.show?.id ?? null,
            title: entry.budget.show?.title ?? null,
            year: entry.budget.show?.year ?? null,
          },
        }
      : null,
    visibilityScope: entry.visibilityScope,
    createdBy: entry.createdBy ?? null,
    approvedBy: entry.approvedBy ?? null,
    memberPaidBy: entry.memberPaidBy ?? null,
    approvedAt: entry.approvedAt ? entry.approvedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    attachments: entry.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      url: attachment.url ?? null,
      mimeType: attachment.mimeType ?? null,
      size: attachment.size ?? null,
      createdAt: attachment.createdAt.toISOString(),
    })),
    logs: entry.logs
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((log) => ({
        id: log.id,
        fromStatus: log.fromStatus ?? null,
        toStatus: log.toStatus,
        note: log.note ?? null,
        createdAt: log.createdAt.toISOString(),
        changedBy: log.changedBy ?? null,
      })),
  };
}

export type FinanceBudgetWithMeta = FinanceBudget & {
  show?: { id: string; title: string | null; year: number } | null;
  actualAmount?: number;
  entryCount?: number;
};

export type FinanceBudgetDTO = {
  id: string;
  category: string;
  plannedAmount: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  show: { id: string | null; title: string | null; year: number | null };
  actualAmount: number;
  entryCount: number;
};

export function mapFinanceBudget(budget: FinanceBudgetWithMeta): FinanceBudgetDTO {
  return {
    id: budget.id,
    category: budget.category,
    plannedAmount: budget.plannedAmount,
    currency: budget.currency,
    notes: budget.notes ?? null,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    show: {
      id: budget.show?.id ?? null,
      title: budget.show?.title ?? null,
      year: budget.show?.year ?? null,
    },
    actualAmount: budget.actualAmount ?? 0,
    entryCount: budget.entryCount ?? 0,
  };
}

export type FinanceSummaryDTO = {
  totalIncome: number;
  totalExpense: number;
  pendingInvoices: number;
  pendingAmount: number;
  donationTotal: number;
};

export function createEmptyFinanceSummary(): FinanceSummaryDTO {
  return {
    totalIncome: 0,
    totalExpense: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    donationTotal: 0,
  };
}

type RoleLike = { role?: string | null; roles?: string[] | null } | null | undefined;

export function collectOwnedRoles(user: RoleLike): Set<string> {
  const roles = new Set<string>();
  if (!user) return roles;
  if (typeof user.role === "string" && user.role) {
    roles.add(user.role);
  }
  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      if (typeof role === "string" && role) {
        roles.add(role);
      }
    }
  }
  return roles;
}

export function resolveAllowedVisibilityScopes(
  user: RoleLike,
  canApprove: boolean,
): VisibilityScope[] {
  const owned = collectOwnedRoles(user);
  const elevated =
    canApprove ||
    owned.has("board") ||
    owned.has("admin") ||
    owned.has("owner");

  return elevated ? ["finance", "board"] : ["finance"];
}
