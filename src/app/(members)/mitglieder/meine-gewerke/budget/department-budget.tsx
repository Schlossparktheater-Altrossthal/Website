import Link from "next/link";

import { BudgetBar } from "@/components/finance/budget-bar";
import { Button } from "@/components/ui/button";
import { loadDepartmentFinance } from "@/lib/finance/budgets";
import { listDepartmentClaims } from "@/lib/finance/claims";
import { MY_CLAIMS_PATH } from "@/lib/finance/paths";
import { formatEntryNumber } from "@/lib/finance/periods";
import { formatCents } from "@/lib/format/money";
import { cn } from "@/lib/utils";

const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" });

/** Budget-Tab im Gewerk-Portal (docs/Plan/finanzen-plan.md, Phase 4). */
export async function DepartmentBudget({
  showId,
  departmentId,
  userId,
}: {
  showId: string;
  departmentId: string;
  userId: string;
}) {
  const [{ periodCode, budgets, expenses, objects }, pending] = await Promise.all([
    loadDepartmentFinance(showId, departmentId),
    listDepartmentClaims(userId),
  ]);
  const toCheck = pending.filter((claim) => claim.department?.id === departmentId);

  return (
    <div className="space-y-4">
      {budgets.length ? (
        budgets.map((budget) => (
          <section key={budget.id} className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Budget {budget.category || budget.fund ? budget.label : ""}
            </h2>
            <BudgetBar
              plannedCents={budget.plannedCents}
              spentCents={budget.spentCents}
              openCents={budget.openCents}
            />
            {budget.notes ? (
              <p className="mt-2 text-xs text-muted-foreground">{budget.notes}</p>
            ) : null}
          </section>
        ))
      ) : (
        <section className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Für dieses Gewerk ist noch kein Budget festgelegt. Das macht der Kassenwart unter Finanzen
          → Budgets.
        </section>
      )}

      {toCheck.length ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <header className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Zu prüfen ({toCheck.length})</h2>
            <Link href={MY_CLAIMS_PATH} className="text-sm font-medium text-primary">
              Prüfen
            </Link>
          </header>
          <ul className="divide-y divide-border">
            {toCheck.map((claim) => (
              <li key={claim.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{claim.purpose}</span>
                  <span className="text-muted-foreground">{claim.submittedBy.name}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatCents(claim.amountCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Ausgaben</h2>
        {expenses.length ? (
          <ul className="divide-y divide-border">
            {expenses.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span
                    className={cn("block truncate", entry.reversed && "line-through opacity-60")}
                  >
                    {entry.description}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {periodCode ? formatEntryNumber(periodCode, entry.number) : null} ·{" "}
                    {DAY.format(new Date(`${entry.bookingDate}T00:00:00Z`))}
                    {entry.reversed ? " · storniert" : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    entry.reversed && "line-through opacity-60",
                  )}
                >
                  {formatCents(entry.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">Noch keine Ausgaben gebucht.</p>
        )}
      </section>

      {objects.length ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Geschätzte Kosten der Objekte</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Summe {formatCents(objects.reduce((sum, object) => sum + object.estimatedCents, 0))} –
            zur Planung, nicht im Budget verrechnet.
          </p>
          <ul className="divide-y divide-border">
            {objects.map((object) => (
              <li key={object.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">{object.title}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCents(object.estimatedCents)}
                  {object.bookedCents ? ` · gebucht ${formatCents(object.bookedCents)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href={MY_CLAIMS_PATH}>Auslage einreichen</Link>
      </Button>
    </div>
  );
}
