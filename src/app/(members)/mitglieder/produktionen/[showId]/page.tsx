import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { ProductionStatusPill } from "@/components/production/production-status-pill";
import { ListRow } from "@/components/ui/list-row";
import { getActiveProductionId } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { getOnboardingWhatsAppLink } from "@/lib/onboarding-settings";
import { hasPermission } from "@/lib/permissions";
import { daysUntil, formatCountdown } from "@/lib/planning/schedule";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { UpdateProductionForm } from "../production-forms-client";
import { ProductionStatusControl } from "../verwalten/production-status-control";
import {
  OnboardingLinkForm,
  ShowProductionButton,
  TimelineForm,
} from "./production-settings-forms";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Produktion einrichten (docs/Plan/produktionen-wechsler-plan.md, Schritt 4). */
export default async function ProduktionDetailPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"))) {
    redirect("/mitglieder/produktionen");
  }

  const { showId } = await params;
  const [show, breakdownCount, memberCounts, activeProductionId] = await Promise.all([
    prisma.show.findUnique({
      where: { id: showId },
      include: { _count: { select: { characters: true, scenes: true } } },
    }),
    prisma.productionObject.count({ where: { showId, archivedAt: null } }),
    prisma.productionMembership.groupBy({
      by: ["status"],
      where: { showId },
      _count: { _all: true },
    }),
    getActiveProductionId(session.user?.id, { canManageProductions: true }),
  ]);
  if (!show) notFound();

  const isDisplayed = activeProductionId === show.id;
  const title = show.title?.trim() || `Produktion ${show.year}`;
  const countOf = (status: string) =>
    memberCounts.find((entry) => entry.status === status)?._count._all ?? 0;
  const activeMembers = countOf("active");
  const openMembers = countOf("invited") + countOf("onboarding");
  const premiere = show.premiereAt;

  const displayedOnly = (href: string) => (isDisplayed ? { href } : {});

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ProductionStatusPill status={show.status} />
            <span>
              {premiere
                ? [`Premiere ${DATE_FORMAT.format(premiere)}`, formatCountdown(daysUntil(premiere))]
                    .filter(Boolean)
                    .join(" · ")
                : `Jahrgang ${show.year} · Premiere noch offen`}
            </span>
          </span>
        }
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/produktionen"),
          { id: "verwalten", label: "Verwalten", href: "/mitglieder/produktionen/verwalten" },
        ]}
      />

      {isDisplayed ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm">
          <p className="min-w-0 flex-1 text-muted-foreground">
            Du siehst gerade eine andere Produktion. Stück und Gewerke öffnen sich erst, wenn diese
            angezeigt wird.
          </p>
          <ShowProductionButton showId={show.id}>Diese anzeigen</ShowProductionButton>
        </div>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        <li>
          <ListRow
            href={`/mitglieder/produktionen/${show.id}/ensemble`}
            title="Ensemble"
            description={`${activeMembers} dabei${openMembers > 0 ? ` · ${openMembers} im Onboarding` : ""}`}
          />
        </li>
        <li>
          <ListRow
            {...displayedOnly("/mitglieder/produktionen/stueck")}
            title="Stück, Rollen & Szenen"
            description={`${show._count.characters} Rollen · ${show._count.scenes} Szenen · ${breakdownCount} Ausstattung`}
          />
        </li>
        <li>
          <ListRow
            {...displayedOnly("/mitglieder/produktionen/gewerke")}
            title="Gewerke & Teams"
            description="Teams, Aufgaben und Übergaben"
          />
        </li>
      </ul>

      <Section title="Status">
        <ProductionStatusControl
          key={show.status}
          showId={show.id}
          showTitle={title}
          status={show.status}
        />
      </Section>

      <Section
        title="Termine"
        description="Fristen im Produktionsplan hängen an Premiere und Endprobenwoche und werden mitverschoben."
      >
        <TimelineForm
          showId={show.id}
          premiere={dateInput(show.premiereAt)}
          weekStart={dateInput(show.finalRehearsalWeekStart)}
          weekEnd={dateInput(show.finalRehearsalWeekEnd)}
        />
      </Section>

      <Section title="Stammdaten">
        <UpdateProductionForm
          show={{
            id: show.id,
            year: show.year,
            title: show.title,
            synopsis: show.synopsis,
            dates: show.dates,
            revealedAt: show.revealedAt ? show.revealedAt.toISOString() : null,
          }}
          redirectPath={`/mitglieder/produktionen/${show.id}`}
        />
      </Section>

      <Section title="Onboarding">
        <OnboardingLinkForm showId={show.id} link={getOnboardingWhatsAppLink(show.meta) ?? null} />
      </Section>
    </div>
  );
}
