"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRealtime, useNotificationRealtime } from "@/hooks/useRealtime";
import { useOnlineStats } from "@/hooks/useOnlineStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MembersContentHeader,
  MembersContentLayout,
  MembersTopbar,
  MembersTopbarStatus,
  MembersTopbarTitle,
} from "@/components/members/members-app-shell";
import { useMembersPermissions } from "@/components/members/permissions-context";
import { PageHeader, PageHeaderDescription, PageHeaderStatus, PageHeaderTitle } from "@/design-system/patterns";
import {
  Users,
  Activity,
  Calendar,
  Wifi,
  WifiOff,
  CheckCircle2,
  Sparkles,
  UserRound,
  CalendarCheck,
  CalendarCog,
  UsersRound,
  ShieldCheck,
  Hammer,
  PiggyBank,
  CalendarRange,
  UtensilsCrossed,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalOnline: number;
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

const INITIAL_STATS: DashboardStats = {
  totalOnline: 0,
  totalMembers: 0,
  rehearsalsThisWeek: 0,
  unreadNotifications: 0,
};

type QuickActionLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissionKey?: string;
};

type MetricTone = "neutral" | "accent" | "positive" | "warning" | "destructive";

type MetricItem = {
  key: string;
  label: string;
  value: string;
  hint?: string | null;
  icon: ReactNode;
  tone: MetricTone;
};

const DASHBOARD_CARD_SURFACE =
  "rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background/95 to-background shadow-lg shadow-primary/5 backdrop-blur";

const DAY_IN_MS = 86_400_000;

const DASHBOARD_CARD_ACCENT =
  "rounded-3xl border border-primary/45 bg-gradient-to-br from-primary/12 via-background/95 to-background shadow-xl shadow-primary/10 backdrop-blur";

const METRIC_CARD_CLASSES: Record<MetricTone, string> = {
  neutral:
    "border-border/60 bg-gradient-to-br from-background via-background/95 to-background shadow-lg shadow-primary/5 backdrop-blur",
  accent:
    "border-primary/50 bg-gradient-to-br from-primary/18 via-primary/10 to-background shadow-xl shadow-primary/10 text-primary",
  positive:
    "border-success/50 bg-gradient-to-br from-success/18 via-success/10 to-background shadow-xl text-success",
  warning:
    "border-warning/50 bg-gradient-to-br from-warning/18 via-warning/10 to-background shadow-xl text-warning",
  destructive:
    "border-destructive/50 bg-gradient-to-br from-destructive/18 via-destructive/10 to-background shadow-xl text-destructive",
};

const METRIC_ICON_CLASSES: Record<MetricTone, string> = {
  neutral: "border-border/50 bg-background/80 text-muted-foreground",
  accent: "border-primary/40 bg-primary/15 text-primary",
  positive: "border-success/45 bg-success/15 text-success",
  warning: "border-warning/45 bg-warning/15 text-warning",
  destructive: "border-destructive/45 bg-destructive/15 text-destructive",
};

interface MembersDashboardProps {
  permissions?: readonly string[];
}

const QUICK_ACTION_LINKS = [
  {
    href: "/mitglieder/profil",
    label: "Profil öffnen",
    icon: UserRound,
    permissionKey: "mitglieder.profil",
  },
  {
    href: "/mitglieder/kalender",
    label: "Kalender",
    icon: CalendarRange,
    permissionKey: "mitglieder.kalender",
  },
  {
    href: "/mitglieder/meine-proben",
    label: "Meine Proben",
    icon: CalendarCheck,
    permissionKey: "mitglieder.meine-proben",
  },
  {
    href: "/mitglieder/meine-gewerke",
    label: "Meine Gewerke",
    icon: Hammer,
    permissionKey: "mitglieder.meine-gewerke",
  },
  {
    href: "/mitglieder/finanzen",
    label: "Finanzen",
    icon: PiggyBank,
    permissionKey: "mitglieder.finanzen",
  },
  {
    href: "/mitglieder/probenplanung",
    label: "Probenplanung",
    icon: CalendarCog,
    permissionKey: "mitglieder.probenplanung",
  },
  {
    href: "/mitglieder/endproben-woche/dienstplan",
    label: "Endproben-Woche",
    icon: CalendarRange,
    permissionKey: "mitglieder.endprobenwoche",
  },
  {
    href: "/mitglieder/endproben-woche/essenplanung",
    label: "Essensplanung",
    icon: UtensilsCrossed,
    permissionKey: "mitglieder.essenplanung",
  },
  {
    href: "/mitglieder/mitgliederverwaltung",
    label: "Mitgliederverwaltung",
    icon: UsersRound,
    permissionKey: "mitglieder.rollenverwaltung",
  },
  {
    href: "/mitglieder/rechte",
    label: "Rechteverwaltung",
    icon: ShieldCheck,
    permissionKey: "mitglieder.rechte",
  },
] satisfies QuickActionLink[];

type OverviewStatsPayload = {
  totalMembers?: unknown;
  rehearsalsThisWeek?: unknown;
  unreadNotifications?: unknown;
};

type OverviewResponse = {
  stats?: OverviewStatsPayload;
  finalRehearsalWeek?: unknown;
  profileCompletion?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  const rawShowId = value.showId;
  if (typeof rawShowId !== "string") return null;
  const showId = rawShowId.trim();
  if (!showId) return null;

  const startDate = parseIsoDate(value.startDate);
  if (!startDate) return null;

  const endDate = parseIsoDate(value.endDate);

  const title = typeof value.title === "string" && value.title.trim() ? value.title : null;
  const yearRaw = value.year;
  const year =
    typeof yearRaw === "number" && Number.isFinite(yearRaw)
      ? yearRaw
      : startDate.getFullYear();

  return {
    showId,
    title,
    year,
    startDate,
    endDate,
  };
}

function parseProfileCompletion(value: unknown):
  | { complete: boolean; completed: number; total: number }
  | null {
  if (!isRecord(value)) return null;
  const totalRaw = value.total;
  const completedRaw = value.completed;
  const complete = Boolean(value.complete);
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : 0;
  const completed =
    typeof completedRaw === "number" && Number.isFinite(completedRaw)
      ? completedRaw
      : 0;
  return { complete, completed, total };
}

export function MembersDashboard({ permissions: permissionsProp }: MembersDashboardProps = {}) {
  const { data: session } = useSession();
  const { connectionStatus } = useRealtime();
  const {
    totalOnline: liveOnline,
    onlineUsers,
    isLoading: onlineLoading,
  } = useOnlineStats();
  const contextPermissions = useMembersPermissions();
  const effectivePermissions = permissionsProp ?? contextPermissions;

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [finalRehearsalWeek, setFinalRehearsalWeek] = useState<FinalRehearsalWeekInfo | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<
    { complete: boolean; completed: number; total: number } | null
  >(null);

  useEffect(() => {
    setStats((prev) => ({ ...prev, totalOnline: liveOnline }));
  }, [liveOnline]);

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

        setStats((prev) => {
          const statsPayload = isRecord(payload?.stats) ? payload.stats : {};
          const next: DashboardStats = {
            totalOnline: prev.totalOnline,
            totalMembers:
              typeof statsPayload.totalMembers === "number"
                ? statsPayload.totalMembers
                : prev.totalMembers,
            rehearsalsThisWeek:
              typeof statsPayload.rehearsalsThisWeek === "number"
                ? statsPayload.rehearsalsThisWeek
                : prev.rehearsalsThisWeek,
            unreadNotifications:
              typeof statsPayload.unreadNotifications === "number"
                ? statsPayload.unreadNotifications
                : prev.unreadNotifications,
          };
          return next;
        });

        setFinalRehearsalWeek(parseFinalRehearsalWeek(payload?.finalRehearsalWeek));
        setProfileCompletion(parseProfileCompletion(payload?.profileCompletion));
      } catch (error) {
        console.error("[Dashboard] Error loading overview", error);
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

  const formatTimeAgo = useCallback((date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "gerade eben";
    if (diffInSeconds < 3600) return `vor ${Math.floor(diffInSeconds / 60)} Min`;
    if (diffInSeconds < 86400) return `vor ${Math.floor(diffInSeconds / 3600)} Std`;
    return `vor ${Math.floor(diffInSeconds / 86400)} Tag(en)`;
  }, []);

  const onlineList = useMemo(() => onlineUsers.slice(0, 10), [onlineUsers]);

  const availableQuickActions = useMemo(() => {
    if (!effectivePermissions.length) {
      return QUICK_ACTION_LINKS.filter((link) => !link.permissionKey);
    }

    const permissionSet = new Set(effectivePermissions);
    return QUICK_ACTION_LINKS.filter(
      (link) => !link.permissionKey || permissionSet.has(link.permissionKey),
    );
  }, [effectivePermissions]);

  const quickActions = useMemo(() => availableQuickActions.slice(0, 6), [availableQuickActions]);

  const connectionMeta = useMemo(() => {
    if (connectionStatus === "connected") {
      return {
        state: "online" as const,
        icon: <Wifi className="h-4 w-4" />,
        label: "Live verbunden",
      };
    }

    if (connectionStatus === "error") {
      return {
        state: "error" as const,
        icon: <WifiOff className="h-4 w-4" />,
        label: "Verbindungsfehler",
      };
    }

    if (connectionStatus === "connecting") {
      return {
        state: "warning" as const,
        icon: <Wifi className="h-4 w-4 animate-pulse" />,
        label: "Verbindung wird aufgebaut",
      };
    }

    return {
      state: "offline" as const,
      icon: <WifiOff className="h-4 w-4" />,
      label: "Offline",
    };
  }, [connectionStatus]);

  const finalRehearsalMetric = useMemo(() => {
    if (!finalRehearsalWeek) return null;

    const startDate = finalRehearsalWeek.startDate;
    const showLabel = finalRehearsalWeek.title
      ? finalRehearsalWeek.title
      : `Produktion ${finalRehearsalWeek.year}`;
    const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = finalRehearsalWeek.endDate
      ? new Date(
          finalRehearsalWeek.endDate.getFullYear(),
          finalRehearsalWeek.endDate.getMonth(),
          finalRehearsalWeek.endDate.getDate(),
        )
      : null;
    const formattedStart = formatter.format(startDay);
    const formattedEnd = endDay ? formatter.format(endDay) : null;
    const rangeHint = formattedEnd
      ? `${showLabel} · ${formattedStart} – ${formattedEnd}`
      : `${showLabel} · Start am ${formattedStart}`;
    const effectiveEnd = endDay ?? new Date(startDay.getTime() + 6 * DAY_IN_MS);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = startDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / DAY_IN_MS);

    if (diffDays > 0) {
      let tone: "info" | "warning" | "destructive" = "info";
      if (diffDays <= 3) {
        tone = "destructive";
      } else if (diffDays <= 7) {
        tone = "warning";
      }
      return {
        label: "Tage bis Endprobenwoche",
        value: diffDays,
        hint: rangeHint,
        tone,
      } as const;
    }

    if (diffDays === 0) {
      return {
        label: "Endprobenwoche",
        value: "Heute",
        hint: rangeHint,
        tone: "warning" as const,
      };
    }

    if (effectiveEnd.getTime() >= today.getTime()) {
      return {
        label: "Endprobenwoche",
        value: "Läuft",
        hint: rangeHint,
        tone: "warning" as const,
      };
    }

    return {
      label: "Endprobenwoche",
      value: "Abgeschlossen",
      hint: rangeHint,
      tone: "positive" as const,
    };
  }, [finalRehearsalWeek]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);

  const onlineUpdatedHint = onlineLoading
    ? "Aktualisiert …"
    : `Aktualisiert ${formatTimeAgo(new Date())}`;

  const metrics = useMemo(() => {
    const items: MetricItem[] = [
      {
        key: "online",
        label: "Online Mitglieder",
        value: numberFormatter.format(stats.totalOnline),
        hint: onlineUpdatedHint,
        icon: <Users className="h-4 w-4" />,
        tone: "positive",
      },
      {
        key: "members",
        label: "Mitglieder gesamt",
        value: numberFormatter.format(stats.totalMembers),
        hint: "inkl. Ensemble und Technik",
        icon: <Activity className="h-4 w-4" />,
        tone: "neutral",
      },
      {
        key: "rehearsals",
        label: "Proben diese Woche",
        value: numberFormatter.format(stats.rehearsalsThisWeek),
        hint: "Termine der laufenden Kalenderwoche",
        icon: <Calendar className="h-4 w-4" />,
        tone: "accent",
      },
    ];

    if (finalRehearsalMetric) {
      const rehearsalTone: MetricTone =
        finalRehearsalMetric.tone === "destructive"
          ? "destructive"
          : finalRehearsalMetric.tone === "warning"
            ? "warning"
            : finalRehearsalMetric.tone === "positive"
              ? "positive"
              : "accent";

      items.unshift({
        key: "final-rehearsal",
        label: finalRehearsalMetric.label,
        value:
          typeof finalRehearsalMetric.value === "number"
            ? numberFormatter.format(finalRehearsalMetric.value)
            : finalRehearsalMetric.value,
        hint: finalRehearsalMetric.hint,
        icon: <Sparkles className="h-4 w-4" />,
        tone: rehearsalTone,
      });
    }

    return items;
  }, [
    finalRehearsalMetric,
    numberFormatter,
    onlineUpdatedHint,
    stats.rehearsalsThisWeek,
    stats.totalMembers,
    stats.totalOnline,
  ]);

  const profileReminder = useMemo(() => {
    if (!profileCompletion) {
      return null;
    }

    const percentCompleteRaw = profileCompletion.total
      ? Math.round((profileCompletion.completed / profileCompletion.total) * 100)
      : 0;
    const percentComplete = Math.min(100, Math.max(0, percentCompleteRaw));
    const percentLabel = `Zu ${percentComplete}% erledigt`;

    if (!profileCompletion.complete) {
      return (
        <div className="flex flex-col gap-4 rounded-2xl border border-warning/50 bg-gradient-to-br from-warning/20 via-warning/10 to-warning/5 p-4 text-sm text-warning">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-warning/50 bg-warning/20">
                <CalendarRange className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Profilangaben unvollständig</p>
                <p className="text-xs text-warning/90">
                  Aktualisiere die fehlenden Angaben, um dein Profil abzuschließen.
                </p>
              </div>
            </div>
            {profileCompletion.total ? (
              <Badge className="inline-flex items-center justify-center gap-1.5 rounded-lg border-warning/70 bg-warning/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning shadow-[0_8px_24px_rgba(234,179,8,0.15)] ring-1 ring-inset ring-warning/50 backdrop-blur-sm">
                {percentLabel}
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-warning/45 bg-gradient-to-r from-warning/20 via-warning/10 to-warning/5 text-warning transition hover:border-warning/60 hover:bg-warning/15"
            asChild
          >
            <Link href="/mitglieder/profil">Profil aktualisieren</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 rounded-2xl border border-success/50 bg-gradient-to-br from-success/20 via-success/10 to-success/5 p-4 text-sm text-success">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-success/50 bg-success/20">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">Profil vollständig</p>
          <p className="text-xs text-success/90">Alle Angaben sind auf dem aktuellen Stand.</p>
        </div>
      </div>
    );
  }, [profileCompletion]);



  if (!session?.user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Bitte melden Sie sich an, um das Mitglieder-Dashboard zu sehen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Fragment>
      <MembersContentLayout width="2xl" spacing="comfortable" gap="lg" />
      <MembersTopbar>
        <MembersTopbarTitle>Mitglieder-Dashboard</MembersTopbarTitle>
        <MembersTopbarStatus>
          <PageHeaderStatus state={connectionMeta.state} icon={connectionMeta.icon}>
            {connectionMeta.label}
          </PageHeaderStatus>
        </MembersTopbarStatus>
      </MembersTopbar>

      <MembersContentHeader>
        <PageHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <PageHeaderTitle>Mitglieder-Dashboard</PageHeaderTitle>
              <PageHeaderDescription>
                Aktuelle Kennzahlen, Aktivitäten und Schnellzugriffe auf einen Blick.
              </PageHeaderDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PageHeaderStatus state={connectionMeta.state} icon={connectionMeta.icon}>
                {connectionMeta.label}
              </PageHeaderStatus>
              {profileCompletion?.complete ? (
                <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                  Profil aktualisiert
                </Badge>
              ) : null}
            </div>
          </div>
        </PageHeader>
      </MembersContentHeader>

      <div className="space-y-10 pb-12">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className={cn(DASHBOARD_CARD_ACCENT, "relative overflow-hidden")}>
            <div
              aria-hidden
              className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-primary/20 opacity-60 blur-3xl dark:bg-primary/30"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 bottom-0 h-44 w-44 rounded-full bg-emerald-300/25 opacity-70 blur-3xl dark:bg-emerald-500/20"
            />
            <CardContent className="relative z-10 space-y-6 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Willkommen zurück</p>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {session?.user?.name || session?.user?.email || "Mitglied"}
                    </h2>
                  </div>
                </div>
                {onlineUsers.length ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-gradient-to-r from-muted/20 via-background/85 to-background px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                    <Users className="h-3.5 w-3.5" />
                    <span>{numberFormatter.format(onlineUsers.length)} online</span>
                  </div>
                ) : null}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Halte Produktionen, Proben und Teamkommunikation im Blick. Nutze die Schnellaktionen für den direkten Einstieg.
              </p>
              {profileReminder ? <div>{profileReminder}</div> : null}
            </CardContent>
          </Card>
          <Card className={cn(DASHBOARD_CARD_SURFACE, "relative overflow-hidden")}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-primary/10 opacity-60 blur-3xl dark:bg-primary/20"
            />
            <CardHeader className="relative z-10 space-y-1 p-6 pb-4">
              <CardTitle className="text-base font-semibold">Schnellaktionen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Direkt zu den wichtigsten Bereichen springen.
              </p>
            </CardHeader>
            <CardContent className="relative z-10 p-6 pt-0">
              {quickActions.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickActions.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background px-3 py-3 text-sm font-medium transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full bg-primary/10 opacity-0 transition duration-300 group-hover:opacity-80"
                        />
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground transition group-hover:border-primary/45 group-hover:text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          {link.label}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Schnellaktionen verfügbar.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card
              key={metric.key}
              className={cn(
                "rounded-2xl border",
                METRIC_CARD_CLASSES[metric.tone],
              )}
            >
              <CardHeader className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                      {metric.label}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl border text-sm",
                      METRIC_ICON_CLASSES[metric.tone],
                    )}
                  >
                    {metric.icon}
                  </div>
                </div>
                {metric.hint ? <p className="text-xs text-muted-foreground">{metric.hint}</p> : null}
              </CardHeader>
            </Card>
          ))}
        </section>

        <section>
          <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_SURFACE)}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 top-0 h-40 w-40 rounded-full bg-success/15 opacity-40 blur-3xl dark:bg-success/25"
            />
            <CardHeader className="relative z-10 space-y-1 pb-4">
              <CardTitle>Aktive Mitglieder</CardTitle>
              <p className="text-sm text-muted-foreground">
                Wer ist gerade online? Live-Ansicht aktualisiert automatisch.
              </p>
            </CardHeader>
            <CardContent className="relative z-10 flex flex-col gap-4">
              {onlineList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background p-4 text-sm text-muted-foreground">
                  {onlineLoading ? "Lade Live-Daten …" : "Derzeit ist niemand online."}
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {onlineList.map((user) => (
                    <li
                      key={`${user.id}-${user.joinedAt.getTime()}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-gradient-to-r from-muted/20 via-background/90 to-background px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-success" />
                        <span className="text-sm font-medium">{user.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(user.joinedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </Fragment>
  );
}
