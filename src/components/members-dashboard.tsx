"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  useRealtime,
  useNotificationRealtime,
  useRehearsalRealtime,
} from "@/hooks/useRealtime";
import { useOnlineStats } from "@/hooks/useOnlineStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  KeyMetricCard,
  KeyMetricGrid,
  PageHeader,
  PageHeaderActions,
  PageHeaderStatus,
  PageHeaderTitle,
} from "@/design-system/patterns";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import {
  Users,
  Activity,
  Calendar,
  Wifi,
  WifiOff,
  Bell,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentActivity {
  id: string;
  type: "notification" | "rehearsal" | "attendance";
  message: string;
  timestamp: Date;
}

interface DashboardStats {
  totalOnline: number;
  totalMembers: number;
  rehearsalsThisWeek: number;
  unreadNotifications: number;
}

type OnboardingPhotoStatus = "none" | "pending" | "approved" | "rejected";

interface OnboardingDomainStats {
  count: number;
  averageWeight: number;
}

interface OnboardingOverview {
  completed: boolean;
  completedAt: Date | null;
  focus: "acting" | "tech" | "both" | null;
  background: string | null;
  stats: {
    acting: OnboardingDomainStats;
    crew: OnboardingDomainStats;
    interests: { count: number; top: string[] };
    dietary: { count: number; highlights: { name: string; level: string | null }[] };
  };
  photoConsent: {
    status: OnboardingPhotoStatus;
    consentGiven: boolean;
    hasDocument: boolean;
    updatedAt: Date | null;
  };
  passwordSet: boolean;
}

const INITIAL_STATS: DashboardStats = {
  totalOnline: 0,
  totalMembers: 0,
  rehearsalsThisWeek: 0,
  unreadNotifications: 0,
};

const ONBOARDING_FOCUS_LABELS: Record<"acting" | "tech" | "both", string> = {
  acting: "Schauspiel",
  tech: "Gewerke",
  both: "Schauspiel & Gewerke",
};

const ONBOARDING_FOCUS_DESCRIPTIONS: Record<"acting" | "tech" | "both", string> = {
  acting: "Du möchtest auf der Bühne wirken und Rollen gestalten.",
  tech: "Du möchtest hinter den Kulissen organisieren, bauen oder für Licht & Ton sorgen.",
  both: "Du bleibst flexibel zwischen Bühne und Gewerken und entscheidest situativ.",
};

const ONBOARDING_DOMAIN_ACCENT: Record<"acting" | "crew", string> = {
  acting: "from-violet-500/70 to-fuchsia-500/70",
  crew: "from-cyan-500/70 to-teal-500/70",
};

const ONBOARDING_PHOTO_STATUS_LABELS: Record<OnboardingPhotoStatus, string> = {
  none: "Ausstehend",
  pending: "In Prüfung",
  approved: "Freigabe erteilt",
  rejected: "Abgelehnt",
};

const ONBOARDING_PHOTO_STATUS_CLASSES: Record<OnboardingPhotoStatus, string> = {
  none: "border-border/60 bg-muted/40 text-muted-foreground",
  pending: "border-amber-400/40 bg-amber-50 text-amber-700",
  approved: "border-emerald-400/40 bg-emerald-50 text-emerald-700",
  rejected: "border-red-400/40 bg-red-50 text-red-700",
};

const DIETARY_LEVEL_LABELS: Record<string, string> = {
  MILD: "Leicht",
  MODERATE: "Mittel",
  SEVERE: "Stark",
  LETHAL: "Kritisch",
};

type OverviewStatsPayload = {
  totalMembers?: unknown;
  rehearsalsThisWeek?: unknown;
  unreadNotifications?: unknown;
};

type OverviewResponse = {
  stats?: OverviewStatsPayload;
  recentActivities?: unknown;
  onboarding?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRecentActivities(value: unknown): RecentActivity[] {
  if (!Array.isArray(value)) return [];

  const fallbackTimestamp = () => new Date();

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;

      const rawId = entry.id;
      const rawType = entry.type;
      const rawMessage = entry.message;
      const rawTimestamp = entry.timestamp;

      const timestampCandidate =
        typeof rawTimestamp === "string" || rawTimestamp instanceof Date
          ? new Date(rawTimestamp)
          : fallbackTimestamp();
      const timestamp = Number.isNaN(timestampCandidate.getTime())
        ? fallbackTimestamp()
        : timestampCandidate;

      let id: string;
      if (typeof rawId === "string" && rawId.trim()) {
        id = rawId;
      } else if (typeof rawId === "number" && Number.isFinite(rawId)) {
        id = String(rawId);
      } else {
        id = `activity_${timestamp.getTime()}`;
      }

      const message = typeof rawMessage === "string" && rawMessage.trim()
        ? rawMessage
        : "Aktualisierung";

      const type: RecentActivity["type"] =
        rawType === "rehearsal" || rawType === "attendance" || rawType === "notification"
          ? rawType
          : "notification";

      return { id, type, message, timestamp } satisfies RecentActivity;
    })
    .filter((entry): entry is RecentActivity => entry !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

const isFocusValue = (value: unknown): value is "acting" | "tech" | "both" =>
  value === "acting" || value === "tech" || value === "both";

const isPhotoStatus = (value: unknown): value is OnboardingPhotoStatus =>
  value === "pending" || value === "approved" || value === "rejected" || value === "none";

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

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
}

function parseOnboardingOverview(value: unknown): OnboardingOverview | null {
  if (!isRecord(value)) return null;

  const completed = Boolean(value.completed);
  const focusRaw = value.focus;
  const focus = isFocusValue(focusRaw) ? focusRaw : null;
  const background = typeof value.background === "string" && value.background.trim() ? value.background : null;
  const completedAt = parseIsoDate(value.completedAt);

  const statsRecord = isRecord(value.stats) ? value.stats : {};
  const parseDomain = (entry: unknown): OnboardingDomainStats => {
    if (!isRecord(entry)) return { count: 0, averageWeight: 0 };
    const count = typeof entry.count === "number" && Number.isFinite(entry.count) ? entry.count : 0;
    const averageWeight = typeof entry.averageWeight === "number" && Number.isFinite(entry.averageWeight)
      ? entry.averageWeight
      : 0;
    return { count, averageWeight };
  };

  const actingStats = parseDomain(statsRecord.acting);
  const crewStats = parseDomain(statsRecord.crew);

  const interestsRecord = isRecord(statsRecord.interests) ? statsRecord.interests : {};
  const interestCount = typeof interestsRecord.count === "number" && Number.isFinite(interestsRecord.count)
    ? interestsRecord.count
    : 0;
  const interestTop = parseStringArray(interestsRecord.top);

  const dietaryRecord = isRecord(statsRecord.dietary) ? statsRecord.dietary : {};
  const dietaryCount = typeof dietaryRecord.count === "number" && Number.isFinite(dietaryRecord.count)
    ? dietaryRecord.count
    : 0;
  const dietaryHighlights = Array.isArray(dietaryRecord.highlights)
    ? dietaryRecord.highlights
        .map((entry) => {
          if (!isRecord(entry)) return null;
          const name = typeof entry.name === "string" && entry.name.trim() ? entry.name : null;
          const level = typeof entry.level === "string" && entry.level.trim() ? entry.level : null;
          if (!name) return null;
          return { name, level };
        })
        .filter((entry): entry is { name: string; level: string | null } => entry !== null)
    : [];

  const photoRecord = isRecord(value.photoConsent) ? value.photoConsent : {};
  const statusRaw = photoRecord.status;
  const status: OnboardingPhotoStatus = isPhotoStatus(statusRaw) ? statusRaw : "none";
  const consentGiven = Boolean(photoRecord.consentGiven);
  const hasDocument = Boolean(photoRecord.hasDocument);
  const updatedAt = parseIsoDate(photoRecord.updatedAt);

  const passwordSet = Boolean(value.passwordSet);

  return {
    completed,
    completedAt,
    focus,
    background,
    stats: {
      acting: actingStats,
      crew: crewStats,
      interests: { count: interestCount, top: interestTop },
      dietary: { count: dietaryCount, highlights: dietaryHighlights },
    },
    photoConsent: { status, consentGiven, hasDocument, updatedAt },
    passwordSet,
  };
}

export function MembersDashboard() {
  const { data: session } = useSession();
  const { connectionStatus } = useRealtime();
  const {
    totalOnline: liveOnline,
    onlineUsers,
    isLoading: onlineLoading,
  } = useOnlineStats();

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingOverview | null>(null);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);

  useEffect(() => {
    setStats((prev) => ({ ...prev, totalOnline: liveOnline }));
  }, [liveOnline]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
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

        setOnboarding(parseOnboardingOverview(payload?.onboarding));
        const activities = parseRecentActivities(payload?.recentActivities);

        setRecentActivities(activities.slice(0, 10));
      } catch (error) {
        console.error("[Dashboard] Error loading overview", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setOnboardingLoaded(true);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const addActivity = useCallback((activity: RecentActivity) => {
    setRecentActivities((prev) => {
      const filtered = prev.filter((entry) => entry.id !== activity.id);
      return [activity, ...filtered].slice(0, 10);
    });
  }, []);

  useNotificationRealtime((event) => {
    const activity: RecentActivity = {
      id: event.notification.id ?? `notification_${Date.now()}`,
      type: "notification",
      message: event.notification.title,
      timestamp: new Date(event.timestamp ?? Date.now()),
    };

    addActivity(activity);
    setStats((prev) => ({ ...prev, unreadNotifications: prev.unreadNotifications + 1 }));
  });

  useRehearsalRealtime(
    (event) => {
      const activity: RecentActivity = {
        id: `rehearsal_${event.rehearsal.id}_${Date.now()}`,
        type: "rehearsal",
        message: `Neue Probe: ${event.rehearsal.title}`,
        timestamp: new Date(event.timestamp ?? Date.now()),
      };
      addActivity(activity);
    },
    (event) => {
      const activity: RecentActivity = {
        id: `rehearsal_update_${event.rehearsalId}_${Date.now()}`,
        type: "rehearsal",
        message: `Probe aktualisiert: ${event.rehearsalId}`,
        timestamp: new Date(event.timestamp ?? Date.now()),
      };
      addActivity(activity);
    },
  );

  const getActivityIcon = useCallback((type: RecentActivity["type"]) => {
    switch (type) {
      case "attendance":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "rehearsal":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "notification":
      default:
        return <Bell className="h-4 w-4 text-purple-500" />;
    }
  }, []);

  const formatTimeAgo = useCallback((date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "gerade eben";
    if (diffInSeconds < 3600) return `vor ${Math.floor(diffInSeconds / 60)} Min`;
    if (diffInSeconds < 86400) return `vor ${Math.floor(diffInSeconds / 3600)} Std`;
    return `vor ${Math.floor(diffInSeconds / 86400)} Tag(en)`;
  }, []);

  const onlineList = useMemo(() => onlineUsers.slice(0, 6), [onlineUsers]);

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

  const onlineUpdatedHint = onlineLoading
    ? "Aktualisiert …"
    : `Aktualisiert ${formatTimeAgo(new Date())}`;

  const onboardingCard = useMemo(() => {
    if (!onboardingLoaded) {
      return (
        <Card className="border border-dashed border-border/60 bg-background/80">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Onboarding-Status wird geladen …
          </CardContent>
        </Card>
      );
    }

    if (!onboarding) {
      return (
        <Card className="border border-dashed border-border/60 bg-background/80">
          <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>Noch keine Onboarding-Daten vorhanden.</p>
            <p>Nutze den Einladungslink oder melde dich beim Team.</p>
          </CardContent>
        </Card>
      );
    }

    const focusLabel = onboarding.focus ? ONBOARDING_FOCUS_LABELS[onboarding.focus] : "Noch offen";
    const focusDescription = onboarding.focus
      ? ONBOARDING_FOCUS_DESCRIPTIONS[onboarding.focus]
      : "Triff deine Wahl, sobald du soweit bist.";
    const completedAtLabel = onboarding.completedAt
      ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(onboarding.completedAt)
      : null;
    const statusBadge = onboarding.completed ? (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
        Abgeschlossen
      </Badge>
    ) : (
      <Badge variant="outline" className="border-amber-400/40 text-amber-700">
        In Bearbeitung
      </Badge>
    );

    const photoStatus = onboarding.photoConsent.status;
    const photoBadgeClass = ONBOARDING_PHOTO_STATUS_CLASSES[photoStatus];
    const photoLabel = ONBOARDING_PHOTO_STATUS_LABELS[photoStatus];
    const photoText = (() => {
      switch (photoStatus) {
        case "approved":
          return "Freigabe erteilt – du bist für Fotoeinsätze freigeschaltet.";
        case "pending":
          return "Wird geprüft – du erhältst eine Benachrichtigung nach der Freigabe.";
        case "rejected":
          return "Der Antrag wurde abgelehnt – bitte kontaktiere das Team bei Fragen.";
        default:
          return onboarding.photoConsent.consentGiven
            ? "Einverständnis liegt vor, Dokument wird noch erwartet."
            : "Noch keine Zustimmung erfasst.";
      }
    })();
    const photoUpdatedLabel = onboarding.photoConsent.updatedAt
      ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(onboarding.photoConsent.updatedAt)
      : null;

    return (
      <Card className="border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Dein Onboarding</CardTitle>
            <p className="text-sm text-muted-foreground">
              {onboarding.completed
                ? completedAtLabel
                  ? `Abgeschlossen am ${completedAtLabel}.`
                  : "Abgeschlossen."
                : "Noch in Bearbeitung – behalte deine nächsten Schritte im Blick."}
            </p>
          </div>
          {statusBadge}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2 rounded-xl border border-border/50 bg-background/90 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {focusLabel}
            </div>
            <p className="text-xs text-muted-foreground">{focusDescription}</p>
            {onboarding.background && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                  {onboarding.background}
                </Badge>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["acting", "crew"] as const).map((domain) => {
              const stats = onboarding.stats[domain];
              const averageWeight = Math.max(0, Math.min(100, Math.round(stats.averageWeight)));
              return (
                <div key={domain} className="space-y-2 rounded-xl border border-border/60 bg-background/85 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                    <span>{domain === "acting" ? "Schauspiel" : "Gewerke"}</span>
                    <span>
                      {stats.count} Bereich
                      {stats.count === 1 ? "" : "e"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r", ONBOARDING_DOMAIN_ACCENT[domain])}
                      style={{ width: `${averageWeight}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Ø Intensität: {averageWeight}%</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/85 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Interessen</span>
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                {onboarding.stats.interests.count}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {onboarding.stats.interests.top.length ? (
                onboarding.stats.interests.top.map((interest) => (
                  <Badge key={interest} variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                    {interest}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Keine Angaben</span>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/85 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Essenshinweise</span>
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                {onboarding.stats.dietary.count}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {onboarding.stats.dietary.count && onboarding.stats.dietary.highlights.length ? (
                onboarding.stats.dietary.highlights.map((item, index) => (
                  <Badge
                    key={`${item.name}-${index}`}
                    variant="outline"
                    className="flex items-center gap-1 border-border/50 text-foreground/80"
                  >
                    <span className="font-medium">{item.name}</span>
                    {item.level ? (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {DIETARY_LEVEL_LABELS[item.level] ?? item.level}
                      </span>
                    ) : null}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Keine Hinweise</span>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/85 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Fotoerlaubnis</span>
              <Badge variant="outline" className={photoBadgeClass}>
                {photoLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{photoText}</p>
            {!onboarding.photoConsent.hasDocument && onboarding.photoConsent.consentGiven && (
              <p className="text-[11px] text-amber-600">Hinweis: Dokument noch ausstehend.</p>
            )}
            {photoUpdatedLabel ? (
              <p className="text-[11px] text-muted-foreground">Zuletzt aktualisiert am {photoUpdatedLabel}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Passwort: {onboarding.passwordSet ? "gesetzt" : "wird nach Abschluss aktiviert"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }, [onboarding, onboardingLoaded]);

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
    <div className="space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-0 lg:pt-2 lg:pb-10">
      <PageHeader>
        <div className="space-y-1.5">
          <PageHeaderTitle>Mitglieder-Dashboard</PageHeaderTitle>
        </div>
        <PageHeaderActions>
          <PageHeaderStatus state={connectionMeta.state} icon={connectionMeta.icon}>
            {connectionMeta.label}
          </PageHeaderStatus>
        </PageHeaderActions>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)] xl:items-start">
        <div className="space-y-4">
          {onboardingCard}

          <Card className="h-full bg-gradient-to-br from-accent/20 to-transparent">
            <CardContent className="flex h-full flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between xl:gap-6">
              <div>
                <div className="text-sm text-muted-foreground">Willkommen zurück</div>
                <h2 className="text-xl font-semibold">
                  {session?.user?.name || session?.user?.email || "Mitglied"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hier findest du aktuelle Aktivitäten und schnelle Aktionen.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const userRoles = (session?.user?.roles as string[] | undefined) ?? (session?.user?.role ? [session.user.role] : []);
                  const roleSet = new Set(userRoles);
                  const links = [
                    { href: "/mitglieder/profil", label: "Profil öffnen" },
                    { href: "/mitglieder/meine-proben", label: "Meine Proben" },
                    { href: "/mitglieder/probenplanung", label: "Probenplanung", roles: ["board", "admin", "tech", "owner"] },
                    { href: "/mitglieder/mitgliederverwaltung", label: "Mitgliederverwaltung", roles: ["admin", "owner"] },
                    { href: "/mitglieder/rechte", label: "Rechteverwaltung", roles: ["admin", "owner"] },
                  ].filter((l: { href: string; label: string; roles?: string[] }) => !l.roles || l.roles.some((r) => roleSet.has(r)));
                  return links.map((l) => (
                    <Button asChild key={l.href} variant="outline" size="sm">
                      <Link href={l.href}>{l.label}</Link>
                    </Button>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        <KeyMetricGrid>
          <KeyMetricCard
            label="Online Mitglieder"
            value={stats.totalOnline}
            icon={<Users className="h-4 w-4" />}
            hint={onlineUpdatedHint}
            tone="positive"
          />
          <KeyMetricCard
            label="Mitglieder gesamt"
            value={stats.totalMembers}
            icon={<Activity className="h-4 w-4" />}
            hint="inkl. Ensemble und Technik"
          />
          <KeyMetricCard
            label="Proben diese Woche"
            value={stats.rehearsalsThisWeek}
            icon={<Calendar className="h-4 w-4" />}
            hint="Termine der laufenden Kalenderwoche"
          />
          <KeyMetricCard
            label="Ungelesene Benachrichtigungen"
            value={stats.unreadNotifications}
            icon={<Bell className="h-4 w-4" />}
            hint="Wer zuerst liest, ist informiert"
            tone={stats.unreadNotifications > 0 ? "warning" : undefined}
          />
        </KeyMetricGrid>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] xl:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] xl:gap-6">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle>Aktive Mitglieder</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wer ist gerade online? Live-Ansicht aktualisiert über WebSockets.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {onlineList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {onlineLoading ? "Lade Live-Daten …" : "Derzeit ist niemand online."}
              </p>
            ) : (
              <ul className="space-y-3">
                {onlineList.map((user) => (
                  <li key={`${user.id}-${user.joinedAt.getTime()}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">{user.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(user.joinedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle>Aktivitäten</CardTitle>
            <p className="text-sm text-muted-foreground">
              Neueste Proben, Zusagen und Benachrichtigungen.
            </p>
          </CardHeader>
          <CardContent className="flex h-full flex-col">
            {isLoading && recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Lade Aktivitäten …</p>
            ) : recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Aktivitäten erfasst.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivities.map((activity) => (
                  <li key={`${activity.id}-${activity.timestamp.getTime()}`} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <PhotoConsentCard />
    </div>
  );
}
