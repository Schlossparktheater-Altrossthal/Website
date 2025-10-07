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

const DAY_IN_MS = 86_400_000;

// Zentralisiertes Card-Design-System
const CARD_VARIANTS = {
  surface: "rounded-2xl border border-border bg-card shadow-lg",
  elevated: "rounded-2xl border border-border bg-card shadow-xl shadow-primary/5",
  accent: "rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 shadow-lg shadow-primary/10",
  metric: "rounded-2xl border border-border bg-gradient-to-br from-card to-background shadow-md"
} as const;

const METRIC_CARD_CLASSES: Record<MetricTone, string> = {
  neutral: `${CARD_VARIANTS.metric}`,
  accent: `rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/8 text-primary`,
  positive: `rounded-2xl border border-success/30 bg-gradient-to-br from-success/10 to-success/5 shadow-lg shadow-success/8 text-success`,
  warning: `rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/10 to-warning/5 shadow-lg shadow-warning/8 text-warning`,
  destructive: `rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 shadow-lg shadow-destructive/8 text-destructive`,
};

const METRIC_ICON_CLASSES: Record<MetricTone, string> = {
  neutral: "border border-border bg-background text-muted-foreground",
  accent: "border border-primary/30 bg-primary/12 text-primary",
  positive: "border border-success/30 bg-success/12 text-success",
  warning: "border border-warning/30 bg-warning/12 text-warning",
  destructive: "border border-destructive/30 bg-destructive/12 text-destructive",
};

// Konsistente Spacing-Konstanten
const SPACING = {
  cardPadding: "p-6",
  cardCompact: "p-4",
  cardHeader: "p-6 pb-4",
  cardContent: "p-6 pt-0",
  sectionGap: "space-y-6",
} as const;

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
    const percentLabel = (
      <>
        Zu <span className="font-semibold text-warning">{percentComplete}%</span> erledigt
      </>
    );

    if (!profileCompletion.complete) {
      return (
        <div className="flex flex-col gap-4 rounded-lg border border-warning bg-warning/15 p-4 text-sm text-warning shadow-lg" role="alert" aria-live="polite">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-warning/30 bg-warning/20 text-warning" aria-hidden="true">
                <CalendarRange className="h-5 w-5" />
              </div>
              <p className="text-base font-semibold">Profilangaben unvollständig</p>
            </div>
            {profileCompletion.total ? (
              <Badge className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warning/30 bg-warning/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning shadow-sm" aria-label={`Profil zu ${percentComplete} Prozent vollständig`}>
                {percentLabel}
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-warning/30 bg-warning/20 text-warning shadow-sm transition-all duration-200 hover:border-warning hover:bg-warning/25 focus:ring-2 focus:ring-warning/30"
            asChild
          >
            <Link href="/mitglieder/profil">Profil aktualisieren</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success" role="status" aria-live="polite">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-success/30 bg-success/15" aria-hidden="true">
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
          <Card className={cn(CARD_VARIANTS.accent, "relative overflow-hidden")}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 top-0 h-40 w-40 rounded-full bg-primary/15 opacity-40 blur-2xl"
            />
            <CardContent className={cn(SPACING.cardPadding, SPACING.sectionGap)}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/12 text-primary">
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
                    <Users className="h-3.5 w-3.5" />
                    <span>{numberFormatter.format(onlineUsers.length)} online</span>
                  </div>
                ) : null}
              </div>
              {profileReminder ? <div>{profileReminder}</div> : null}
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="mb-0 border-b border-border/60 px-6 py-5">
              <CardTitle className="text-base font-semibold">Schnellaktionen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 py-5">
              {quickActions.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {quickActions.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/80 px-4 py-3 text-sm font-medium shadow-sm transition",
                          "hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors",
                              "group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-left font-medium leading-tight">{link.label}</span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
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
              className={METRIC_CARD_CLASSES[metric.tone]}
            >
              <CardHeader className={cn(SPACING.cardPadding, "space-y-4")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="text-2xl font-bold tracking-tight">{metric.value}</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      METRIC_ICON_CLASSES[metric.tone],
                    )}
                  >
                    {metric.icon}
                  </div>
                </div>
                {metric.hint ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">{metric.hint}</p>
                ) : null}
              </CardHeader>
            </Card>
          ))}
        </section>

        <section>
          <Card className="p-0">
            <CardHeader className="mb-0 border-b border-border/60 px-6 py-5">
              <CardTitle>Aktive Mitglieder</CardTitle>
              <p className="text-sm text-muted-foreground">
                Wer ist gerade online? Live-Ansicht aktualisiert automatisch.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 py-5">
              {onlineList.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  {onlineLoading ? "Lade Live-Daten …" : "Derzeit ist niemand online."}
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {onlineList.map((user) => (
                    <li
                      key={`${user.id}-${user.joinedAt.getTime()}`}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-4 py-3 text-sm font-medium shadow-sm transition hover:border-success/40 hover:bg-success/10"
                    >
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/40" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-success shadow-sm" />
                        </span>
                        <span className="truncate">{user.name}</span>
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
