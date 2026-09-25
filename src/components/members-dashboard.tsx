"use client";

import {
  CalendarCheckIcon,
  CalendarCogIcon,
  CalendarIcon,
  CheckCircle2Icon,
  HammerIcon,
  IconComponent,
  MessageCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
  UsersRoundIcon,
  WifiIcon,
  WifiOffIcon,
} from "@/components/ui/action-icons";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRealtime, useNotificationRealtime } from "@/hooks/useRealtime";
import { useOnlineStats } from "@/hooks/useOnlineStats";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DismissibleNotice } from "@/components/ui/dismissible-notice";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile, type StatTileTone } from "@/components/ui/stat-tile";
import { UserAvatar } from "@/components/user-avatar";
import { MembersContentLayout } from "@/components/members/members-app-shell";
import { useMembersPermissions } from "@/components/members/permissions-context";
import { ConnectionStatusBadge } from "@/components/members/connection-status-badge";
import { PageHeader } from "@/components/members/page-header";

interface DashboardStats {
  totalMembers: number;
  rehearsalsThisWeek: number;
  unreadNotifications: number;
}

interface FinalRehearsalWeekInfo {
  showId: string;
  title: string | null;
  year: number;
  startDate: Date;
  endDate: Date | null;
}

type UpcomingEvent = {
  id: string;
  kind: "rehearsal" | "department";
  title: string;
  start: Date;
  end: Date | null;
  location: string | null;
  context: string | null;
  href: string;
};

type ProfileCompletion = {
  complete: boolean;
  completed: number;
  total: number;
  openItems: Array<{ id: string; label: string; targetSection: string | null }>;
};

type ActiveProduction = {
  id: string;
  title: string | null;
  year: number;
  whatsapp: { link: string; noticeKey: string; visited: boolean; dismissed: boolean } | null;
};

const INITIAL_STATS: DashboardStats = {
  totalMembers: 0,
  rehearsalsThisWeek: 0,
  unreadNotifications: 0,
};

type QuickActionLink = {
  href: string;
  label: string;
  icon: IconComponent;
  permissionKey?: string;
};

const DAY_IN_MS = 86_400_000;
const TIME_ZONE = "Europe/Berlin";

interface MembersDashboardProps {
  permissions?: readonly string[];
}

const QUICK_ACTION_LINKS = [
  {
    href: "/mitglieder/meine-proben",
    label: "Meine Termine",
    icon: CalendarCheckIcon,
    permissionKey: "PRIVATE.REHEARSAL.OWN.VIEW",
  },
  {
    href: "/mitglieder/profil",
    label: "Mein Profil",
    icon: UserRoundIcon,
    permissionKey: "PRIVATE.PROFILE.OWN.VIEW",
  },
  {
    href: "/mitglieder/meine-gewerke",
    label: "Gewerkeplanung",
    icon: HammerIcon,
    permissionKey: "PRIVATE.DEPARTMENT.OWN.VIEW",
  },
  {
    href: "/mitglieder/probenplanung",
    label: "Probenplanung",
    icon: CalendarCogIcon,
    permissionKey: "PRIVATE.REHEARSAL.PLANNING.MANAGE",
  },
  {
    href: "/mitglieder/mitgliederverwaltung",
    label: "Mitgliederverwaltung",
    icon: UsersRoundIcon,
    permissionKey: "PRIVATE.ADMIN.MEMBERS.MANAGE",
  },
  {
    href: "/mitglieder/rechte",
    label: "Rechteverwaltung",
    icon: ShieldCheckIcon,
    permissionKey: "PRIVATE.ADMIN.PERMISSIONS.MANAGE",
  },
] satisfies QuickActionLink[];

type OverviewResponse = {
  offline?: boolean;
  stats?: unknown;
  finalRehearsalWeek?: unknown;
  profileCompletion?: unknown;
  upcomingEvents?: unknown;
  activeProduction?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseIsoDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return null;
}

function parseFinalRehearsalWeek(value: unknown): FinalRehearsalWeekInfo | null {
  if (!isRecord(value)) return null;

  const showId = readString(value.showId)?.trim();
  if (!showId) return null;

  const startDate = parseIsoDate(value.startDate);
  if (!startDate) return null;

  return {
    showId,
    title: readString(value.title),
    year: readNumber(value.year) ?? startDate.getFullYear(),
    startDate,
    endDate: parseIsoDate(value.endDate),
  };
}

function parseProfileCompletion(value: unknown): ProfileCompletion | null {
  if (!isRecord(value)) return null;
  const openItems = Array.isArray(value.openItems)
    ? value.openItems.flatMap((item) => {
        if (!isRecord(item)) return [];
        const id = readString(item.id);
        const label = readString(item.label);
        if (!id || !label) return [];
        return [{ id, label, targetSection: readString(item.targetSection) }];
      })
    : [];
  return {
    complete: Boolean(value.complete),
    completed: readNumber(value.completed) ?? 0,
    total: readNumber(value.total) ?? 0,
    openItems,
  };
}

function parseUpcomingEvents(value: unknown): UpcomingEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = readString(entry.id);
    const title = readString(entry.title);
    const start = parseIsoDate(entry.start);
    const href = readString(entry.href);
    if (!id || !title || !start || !href) return [];
    return [
      {
        id,
        kind: entry.kind === "department" ? "department" : "rehearsal",
        title,
        start,
        end: parseIsoDate(entry.end),
        location: readString(entry.location),
        context: readString(entry.context),
        href,
      } satisfies UpcomingEvent,
    ];
  });
}

function parseActiveProduction(value: unknown): ActiveProduction | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  if (!id) return null;
  const whatsappRaw = value.whatsapp;
  const link = isRecord(whatsappRaw) ? readString(whatsappRaw.link) : null;
  const noticeKey = isRecord(whatsappRaw) ? readString(whatsappRaw.noticeKey) : null;
  return {
    id,
    title: readString(value.title),
    year: readNumber(value.year) ?? new Date().getFullYear(),
    whatsapp:
      isRecord(whatsappRaw) && link && noticeKey
        ? {
            link,
            noticeKey,
            visited: Boolean(whatsappRaw.visited),
            dismissed: Boolean(whatsappRaw.dismissed),
          }
        : null,
  };
}

const weekdayFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  timeZone: TIME_ZONE,
});
const dayFormatter = new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: TIME_ZONE });
const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const shortDateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

function DateBadge({ date }: { date: Date }) {
  return (
    <span className="flex h-11 w-11 flex-col items-center justify-center rounded-md bg-muted/60 leading-none">
      <span className="text-[0.625rem] font-medium uppercase text-muted-foreground">
        {weekdayFormatter.format(date).replace(".", "")}
      </span>
      <span className="text-base font-semibold tabular-nums text-foreground">
        {dayFormatter.format(date).replace(".", "")}
      </span>
      <span className="sr-only">{monthFormatter.format(date)}</span>
    </span>
  );
}

function formatEventTime(event: UpcomingEvent) {
  const start = timeFormatter.format(event.start);
  const end = event.end ? timeFormatter.format(event.end) : null;
  return end ? `${start}–${end}` : start;
}

function getFirstName(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Dashboard wird geladen">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}

export function MembersDashboard({ permissions: permissionsProp }: MembersDashboardProps = {}) {
  const { data: session, status: sessionStatus } = useSession();
  const { connectionStatus } = useRealtime();
  const { totalOnline: liveOnline, onlineUsers, isLoading: onlineLoading } = useOnlineStats();
  const contextPermissions = useMembersPermissions();
  const effectivePermissions = permissionsProp ?? contextPermissions;

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [finalRehearsalWeek, setFinalRehearsalWeek] = useState<FinalRehearsalWeekInfo | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<ProfileCompletion | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [activeProduction, setActiveProduction] = useState<ActiveProduction | null>(null);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/dashboard/overview", { cache: "no-store" });
        if (!response.ok) {
          console.error("[Dashboard] Failed to load overview", response.status);
          return;
        }
        const payload = (await response.json()) as OverviewResponse;
        if (cancelled) return;

        setIsOfflineFallback(payload?.offline === true);

        const statsPayload = isRecord(payload?.stats) ? payload.stats : {};
        setStats((prev) => ({
          totalMembers: readNumber(statsPayload.totalMembers) ?? prev.totalMembers,
          rehearsalsThisWeek:
            readNumber(statsPayload.rehearsalsThisWeek) ?? prev.rehearsalsThisWeek,
          unreadNotifications:
            readNumber(statsPayload.unreadNotifications) ?? prev.unreadNotifications,
        }));

        setFinalRehearsalWeek(parseFinalRehearsalWeek(payload?.finalRehearsalWeek));
        setProfileCompletion(parseProfileCompletion(payload?.profileCompletion));
        setUpcomingEvents(parseUpcomingEvents(payload?.upcomingEvents));
        setActiveProduction(parseActiveProduction(payload?.activeProduction));
      } catch (error) {
        if (!cancelled) {
          setIsOfflineFallback(false);
        }
        console.error("[Dashboard] Error loading overview", error);
      } finally {
        if (!cancelled) {
          setOverviewLoaded(true);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNotificationRealtime = useCallback(() => {
    setStats((prev) => ({ ...prev, unreadNotifications: prev.unreadNotifications + 1 }));
  }, []);

  useNotificationRealtime(handleNotificationRealtime);

  const quickActions = useMemo(() => {
    const permissionSet = new Set(effectivePermissions);
    return QUICK_ACTION_LINKS.filter(
      (link) => !link.permissionKey || permissionSet.has(link.permissionKey),
    );
  }, [effectivePermissions]);

  const connectionMeta = useMemo(() => {
    if (connectionStatus === "connected") {
      return {
        state: "online" as const,
        icon: <WifiIcon className="h-4 w-4" />,
        label: "Live",
      };
    }

    if (connectionStatus === "error") {
      return {
        state: "error" as const,
        icon: <WifiOffIcon className="h-4 w-4" />,
        label: "Verbindungsfehler",
      };
    }

    if (connectionStatus === "connecting") {
      return {
        state: "warning" as const,
        icon: <WifiIcon className="h-4 w-4 animate-pulse" />,
        label: "Verbinde …",
      };
    }

    return {
      state: "offline" as const,
      icon: <WifiOffIcon className="h-4 w-4" />,
      label: "Offline",
    };
  }, [connectionStatus]);

  const finalRehearsalMetric = useMemo(() => {
    if (!finalRehearsalWeek) return null;

    const startDate = finalRehearsalWeek.startDate;
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = finalRehearsalWeek.endDate
      ? new Date(
          finalRehearsalWeek.endDate.getFullYear(),
          finalRehearsalWeek.endDate.getMonth(),
          finalRehearsalWeek.endDate.getDate(),
        )
      : null;
    const effectiveEnd = endDay ?? new Date(startDay.getTime() + 6 * DAY_IN_MS);
    const hint = `ab ${shortDateFormatter.format(startDay)}`;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((startDay.getTime() - today.getTime()) / DAY_IN_MS);

    if (diffDays > 0) {
      const tone: StatTileTone =
        diffDays <= 3 ? "destructive" : diffDays <= 7 ? "warning" : "primary";
      return {
        label: "Tage bis Endproben",
        value: String(diffDays),
        hint,
        tone,
      };
    }
    if (diffDays === 0) {
      return { label: "Endprobenwoche", value: "Heute", hint, tone: "warning" as const };
    }
    if (effectiveEnd.getTime() >= today.getTime()) {
      return { label: "Endprobenwoche", value: "Läuft", hint, tone: "warning" as const };
    }
    return null;
  }, [finalRehearsalWeek]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);

  if (sessionStatus === "loading" || !session?.user) {
    return (
      <Fragment>
        <MembersContentLayout width="2xl" spacing="comfortable" gap="lg" />
        <PageHeader title="Dashboard" />
        <DashboardSkeleton />
      </Fragment>
    );
  }

  const firstName = getFirstName(session.user.name) ?? "schön, dass du da bist";
  const productionLabel = activeProduction
    ? (activeProduction.title ?? `Produktion ${activeProduction.year}`)
    : null;
  const whatsapp = activeProduction?.whatsapp ?? null;
  const showWhatsappNotice = Boolean(whatsapp && !whatsapp.visited && !whatsapp.dismissed);
  const openProfileItems = profileCompletion?.openItems ?? [];
  const onlinePreview = onlineUsers.slice(0, 8);
  const liveUnavailable = connectionStatus === "error";
  const onlineValue = liveUnavailable || onlineLoading ? "–" : numberFormatter.format(liveOnline);
  const onlineDescription = liveUnavailable
    ? "Live-Status gerade nicht verfügbar."
    : onlineLoading
      ? "Lade Live-Daten …"
      : onlineUsers.length
        ? undefined
        : "Derzeit ist niemand online.";

  return (
    <Fragment>
      <MembersContentLayout width="2xl" spacing="comfortable" gap="lg" />
      <PageHeader
        title="Dashboard"
        status={
          <ConnectionStatusBadge state={connectionMeta.state} icon={connectionMeta.icon}>
            {connectionMeta.label}
          </ConnectionStatusBadge>
        }
      />

      <div className="space-y-4 pb-10 sm:space-y-6">
        <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-4 shadow-sm sm:p-5">
          <div
            className="pointer-events-none absolute -right-16 -top-10 h-40 w-40 rounded-full bg-primary/20 opacity-60 blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/12 text-primary">
              <SparklesIcon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                Hallo, {firstName}
              </h2>
              {productionLabel ? (
                <p className="truncate text-sm text-muted-foreground">
                  Aktuelle Produktion:{" "}
                  <span className="font-medium text-primary">{productionLabel}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {isOfflineFallback ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Offline-Demo-Modus</p>
            <p className="text-xs text-muted-foreground">
              Der Dashboard-Endpunkt liefert Beispielwerte, da keine Datenbank verbunden ist.
            </p>
          </div>
        ) : null}

        {showWhatsappNotice && whatsapp ? (
          <DismissibleNotice
            noticeKey={whatsapp.noticeKey}
            tone="success"
            icon={<MessageCircleIcon />}
            title="Team-Chat beitreten"
            description="Infos zur Produktion per WhatsApp"
            action={
              <Button asChild size="sm" variant="outline">
                <a href={whatsapp.link} target="_blank" rel="noopener noreferrer">
                  Öffnen
                </a>
              </Button>
            }
          />
        ) : null}

        <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {finalRehearsalMetric ? (
            <StatTile
              label={finalRehearsalMetric.label}
              value={finalRehearsalMetric.value}
              hint={finalRehearsalMetric.hint}
              tone={finalRehearsalMetric.tone}
              icon={<SparklesIcon />}
            />
          ) : null}
          <StatTile
            label="Proben diese Woche"
            value={overviewLoaded ? numberFormatter.format(stats.rehearsalsThisWeek) : "–"}
            icon={<CalendarIcon />}
            tone="primary"
            href="/mitglieder/meine-proben"
          />
          <StatTile label="Gerade online" value={onlineValue} tone="success" icon={<WifiIcon />} />
          <StatTile
            label="Mitglieder"
            value={overviewLoaded ? numberFormatter.format(stats.totalMembers) : "–"}
            icon={<UsersIcon />}
            tone="info"
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <Card variant="plain" size="flush" className="lg:col-span-2">
            <div className="p-4 pb-2">
              <SectionHeader
                title="Nächste Termine"
                action={
                  <Button asChild size="xs" variant="ghost">
                    <Link href="/mitglieder/meine-proben">Alle</Link>
                  </Button>
                }
              />
            </div>
            <div className="px-1 pb-2">
              {!overviewLoaded ? (
                <div className="space-y-2 px-3 py-2">
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                </div>
              ) : upcomingEvents.length ? (
                <ListRowGroup>
                  {upcomingEvents.map((event) => (
                    <ListRow
                      key={`${event.kind}-${event.id}`}
                      href={event.href}
                      leading={<DateBadge date={event.start} />}
                      title={event.title}
                      description={[formatEventTime(event), event.context, event.location]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                </ListRowGroup>
              ) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  Keine anstehenden Termine.
                </p>
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-4 lg:gap-6">
            {profileCompletion && !profileCompletion.complete ? (
              <Card
                variant="plain"
                size="flush"
                className="order-first border-warning/30 bg-gradient-to-br from-warning/10 via-card to-card lg:order-none"
              >
                <div className="flex items-center gap-3 p-4 pb-2">
                  <ProgressRing value={profileCompletion.completed} max={profileCompletion.total} />
                  <SectionHeader
                    title="Profil vervollständigen"
                    description={`${openProfileItems.length} ${
                      openProfileItems.length === 1 ? "Angabe fehlt" : "Angaben fehlen"
                    }`}
                  />
                </div>
                <div className="px-1 pb-2">
                  <ListRowGroup>
                    {openProfileItems.map((item) => (
                      <ListRow
                        key={item.id}
                        density="compact"
                        href={
                          item.targetSection
                            ? `/mitglieder/profil?bereich=${item.targetSection}`
                            : "/mitglieder/profil"
                        }
                        title={item.label}
                      />
                    ))}
                  </ListRowGroup>
                </div>
              </Card>
            ) : profileCompletion?.complete ? (
              <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground">
                <CheckCircle2Icon className="h-4 w-4 text-success" aria-hidden />
                Dein Profil ist vollständig.
              </p>
            ) : null}

            <Card variant="plain" size="flush">
              <div className="p-4 pb-2">
                <SectionHeader title="Schnellzugriff" />
              </div>
              <div className="px-1 pb-2">
                <ListRowGroup>
                  {quickActions.map((link) => {
                    const Icon = link.icon;
                    return (
                      <ListRow
                        key={link.href}
                        density="compact"
                        href={link.href}
                        leading={
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                        }
                        title={link.label}
                      />
                    );
                  })}
                  {whatsapp ? (
                    <ListRow
                      density="compact"
                      href={whatsapp.link}
                      external
                      leading={
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-success">
                          <MessageCircleIcon className="h-4 w-4" />
                        </span>
                      }
                      title="Team-Chat (WhatsApp)"
                    />
                  ) : null}
                </ListRowGroup>
              </div>
            </Card>

            <Card variant="plain" size="md">
              <SectionHeader title="Gerade online" description={onlineDescription} />
              {onlinePreview.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {onlinePreview.map((user) => (
                    <li
                      key={`${user.id}-${user.joinedAt.getTime()}`}
                      className="flex items-center gap-2 rounded-full bg-muted/50 py-1 pl-1 pr-3 text-sm"
                    >
                      <UserAvatar userId={user.id} name={user.name} size={24} />
                      <span className="max-w-[9rem] truncate">{user.name}</span>
                    </li>
                  ))}
                  {onlineUsers.length > onlinePreview.length ? (
                    <li className="flex items-center rounded-full bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
                      +{onlineUsers.length - onlinePreview.length}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
