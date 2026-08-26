import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";

import { getOnboardingWhatsAppLink } from "@/lib/onboarding-settings";

import {
  updateOnboardingSettingsAction,
  updateProductionTimelineAction,
} from "../actions/production";
import { SetActiveProductionForm, UpdateProductionDialog } from "../production-forms-client";
import { XIcon } from "@/components/ui/action-icons";

function formatShowTitle(show: { title: string | null; year: number }) {
  if (show.title && show.title.trim()) return show.title;
  return `Produktion ${show.year}`;
}

export default async function ProduktionDetailPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf diese Produktion.
        </div>
      </div>
    );
  }

  const resolvedParams = await params;
  const showId = resolvedParams?.showId;
  if (!showId) {
    notFound();
  }

  const [show, breakdownCount] = await Promise.all([
    prisma.show.findUnique({
      where: { id: showId },
      include: { _count: { select: { characters: true, scenes: true } } },
    }),
    prisma.sceneBreakdownItem.count({ where: { scene: { showId } } }),
  ]);

  if (!show) {
    notFound();
  }

  const activeProductionId = await getActiveProductionId(session.user?.id);
  const isActive = activeProductionId === show.id;
  const title = formatShowTitle(show);
  const finalRehearsalWeekStartValue = show.finalRehearsalWeekStart
    ? show.finalRehearsalWeekStart.toISOString().slice(0, 10)
    : "";
  const finalRehearsalWeekEndValue = show.finalRehearsalWeekEnd
    ? show.finalRehearsalWeekEnd.toISOString().slice(0, 10)
    : "";
  const finalRehearsalWeekStartLabel = show.finalRehearsalWeekStart
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(show.finalRehearsalWeekStart)
    : null;
  const finalRehearsalWeekEndLabel = show.finalRehearsalWeekEnd
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(show.finalRehearsalWeekEnd)
    : null;
  const finalRehearsalWeekRangeLabel =
    finalRehearsalWeekStartLabel && finalRehearsalWeekEndLabel
      ? `${finalRehearsalWeekStartLabel} – ${finalRehearsalWeekEndLabel}`
      : (finalRehearsalWeekStartLabel ?? finalRehearsalWeekEndLabel);
  const whatsappLink = getOnboardingWhatsAppLink(show.meta);
  const onboardingRedirect = `/mitglieder/produktionen/${show.id}`;
  const updateDialogShow = {
    id: show.id,
    year: show.year,
    title: show.title,
    synopsis: show.synopsis,
    dates: show.dates,
    revealedAt: show.revealedAt ? show.revealedAt.toISOString() : null,
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Produktion {show.year}
            </p>
            <h1 className="text-3xl font-semibold">{title}</h1>
            {show.synopsis ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{show.synopsis}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UpdateProductionDialog
              show={updateDialogShow}
              redirectPath={`/mitglieder/produktionen/${show.id}`}
              trigger={
                <Button variant="outline" size="sm">
                  Produktion bearbeiten
                </Button>
              }
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/mitglieder/produktionen">Zur Produktionsübersicht</Link>
            </Button>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg font-semibold">Status &amp; Kennzahlen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Rollen</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {show._count.characters}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Szenen</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {show._count.scenes}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Breakdowns
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{breakdownCount}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/mitglieder/produktionen/besetzung">Besetzung</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/mitglieder/produktionen/szenen">Szenen</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/mitglieder/produktionen/gewerke">Gewerke &amp; Teams</Link>
            </Button>
            {!isActive ? (
              <SetActiveProductionForm
                showId={show.id}
                showTitle={title}
                redirectPath={`/mitglieder/produktionen/${show.id}`}
                isActive={isActive}
                className="ml-auto flex-shrink-0"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Endprobenwoche</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={updateProductionTimelineAction}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="showId" value={show.id} />
            <input
              type="hidden"
              name="redirectPath"
              value={`/mitglieder/produktionen/${show.id}`}
            />
            <div className="space-y-2 sm:max-w-xs">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="finalRehearsalWeekStart">
                  Beginn der Endprobenwoche
                </label>
                <DateInput
                  id="finalRehearsalWeekStart"
                  name="finalRehearsalWeekStart"
                  defaultValue={finalRehearsalWeekStartValue}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {finalRehearsalWeekRangeLabel ?? "Kein Zeitraum hinterlegt."}
              </p>
            </div>
            <div className="space-y-2 sm:max-w-xs">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="finalRehearsalWeekEnd">
                  Ende der Endprobenwoche
                </label>
                <DateInput
                  id="finalRehearsalWeekEnd"
                  name="finalRehearsalWeekEnd"
                  defaultValue={finalRehearsalWeekEndValue}
                />
              </div>
            </div>
            <Button type="submit" className="sm:w-auto">
              Zeitplan aktualisieren
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Onboarding-Einstellungen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateOnboardingSettingsAction} className="space-y-4">
            <input type="hidden" name="showId" value={show.id} />
            <input type="hidden" name="redirectPath" value={onboardingRedirect} />
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="whatsappLink">
                WhatsApp-Beitrittslink
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="whatsappLink"
                  name="whatsappLink"
                  defaultValue={whatsappLink ?? ""}
                  placeholder="https://chat.whatsapp.com/..."
                  className="sm:max-w-lg"
                />
                <div className="flex items-center gap-2">
                  <Button type="submit">Speichern</Button>
                  {whatsappLink ? (
                    <Button
                      type="submit"
                      name="clear"
                      value="1"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Link entfernen"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
