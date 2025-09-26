"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  Bell,
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
  MessageCircle,
  ArrowUpRight,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  backgroundClass: string | null;
  notes: string | null;
  whatsappLink: string | null;
  whatsappLinkVisitedAt: Date | null;
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

interface FinalRehearsalWeekInfo {
  showId: string;
  title: string | null;
  year: number;
  startDate: Date;
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
  acting: "from-primary/60 via-primary/30 to-transparent",
  crew: "from-info/60 via-info/30 to-transparent",
};

const ONBOARDING_PHOTO_STATUS_LABELS: Record<OnboardingPhotoStatus, string> = {
  none: "Ausstehend",
  pending: "In Prüfung",
  approved: "Freigabe erteilt",
  rejected: "Abgelehnt",
};

const ONBOARDING_PHOTO_STATUS_CLASSES: Record<OnboardingPhotoStatus, string> = {
  none: "border border-border/60 bg-background/70 text-muted-foreground shadow-sm backdrop-blur",
  pending: "border border-amber-400/45 bg-amber-500/10 text-amber-700 shadow-sm backdrop-blur dark:text-amber-200",
  approved: "border border-emerald-400/45 bg-emerald-500/10 text-emerald-700 shadow-sm backdrop-blur dark:text-emerald-200",
  rejected: "border border-rose-400/45 bg-rose-500/10 text-rose-700 shadow-sm backdrop-blur dark:text-rose-200",
};

const DIETARY_LEVEL_LABELS: Record<string, string> = {
  MILD: "Leicht",
  MODERATE: "Mittel",
  SEVERE: "Stark",
  LETHAL: "Kritisch",
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

const DASHBOARD_CARD_BASE =
  "rounded-3xl border border-border/60 bg-card/80 shadow-lg shadow-primary/10 backdrop-blur";
const DASHBOARD_SURFACE_MUTED =
  "rounded-2xl border border-border/50 bg-background/70 shadow-sm backdrop-blur";
const DASHBOARD_SURFACE_DASHED =
  "rounded-2xl border border-dashed border-border/60 bg-background/55 shadow-sm backdrop-blur";

const METRIC_CARD_CLASSES: Record<MetricTone, string> = {
  neutral: `${DASHBOARD_SURFACE_MUTED} bg-background/75 text-foreground shadow-md shadow-primary/10`,
  accent:
    `${DASHBOARD_SURFACE_MUTED} border-primary/45 bg-gradient-to-br from-primary/15 via-primary/10 to-background/80 text-foreground shadow-lg shadow-primary/15`,
  positive:
    `${DASHBOARD_SURFACE_MUTED} border-emerald-400/45 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-background/80 text-foreground shadow-lg shadow-emerald-500/20`,
  warning:
    `${DASHBOARD_SURFACE_MUTED} border-amber-400/45 bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-background/80 text-foreground shadow-lg shadow-amber-500/20`,
  destructive:
    `${DASHBOARD_SURFACE_MUTED} border-rose-400/45 bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-background/80 text-foreground shadow-lg shadow-rose-500/20`,
};

const METRIC_ICON_CLASSES: Record<MetricTone, string> = {
  neutral: "border-border/60 bg-background/80 text-muted-foreground",
  accent: "border-primary/45 bg-primary/10 text-primary",
  positive: "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  warning: "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  destructive: "border-rose-400/50 bg-rose-500/10 text-rose-700 dark:text-rose-200",
};

interface MembersDashboardProps {
  permissions?: readonly string[];
}

type ActiveProductionOverview = {
  id: string;
  title: string | null;
  year: number;
};

type ProductionMembershipSummary = {
  showId: string;
  title: string | null;
  year: number;
  joinedAt: Date | null;
  leftAt: Date | null;
  isActive: boolean;
};

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
  recentActivities?: unknown;
  onboarding?: unknown;
  finalRehearsalWeek?: unknown;
  profileCompletion?: unknown;
  activeProduction?: unknown;
  productionMemberships?: unknown;
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
  const backgroundClass =
    typeof value.backgroundClass === "string" && value.backgroundClass.trim()
      ? value.backgroundClass
      : null;
  const notes = typeof value.notes === "string" && value.notes.trim() ? value.notes : null;
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
  const whatsappLink =
    typeof value.whatsappLink === "string" && value.whatsappLink.trim()
      ? value.whatsappLink.trim()
      : null;
  const whatsappLinkVisitedAt = parseIsoDate(value.whatsappLinkVisitedAt);

  return {
    completed,
    completedAt,
    focus,
    background,
    backgroundClass,
    notes,
    whatsappLink,
    whatsappLinkVisitedAt,
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

function parseFinalRehearsalWeek(value: unknown): FinalRehearsalWeekInfo | null {
  if (!isRecord(value)) return null;

  const rawShowId = value.showId;
  if (typeof rawShowId !== "string") return null;
  const showId = rawShowId.trim();
  if (!showId) return null;

  const startDate = parseIsoDate(value.startDate);
  if (!startDate) return null;

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

function parseActiveProduction(value: unknown): ActiveProductionOverview | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawId = value.id;
  const rawTitle = value.title;
  const rawYear = value.year;

  if (typeof rawId !== "string" || !rawId) {
    return null;
  }

  if (typeof rawYear !== "number" || !Number.isFinite(rawYear)) {
    return null;
  }

  const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle : null;

  return { id: rawId, title, year: rawYear } satisfies ActiveProductionOverview;
}

function parseProductionMemberships(value: unknown): ProductionMembershipSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const rawShowId = entry.showId;
      const rawTitle = entry.title;
      const rawYear = entry.year;
      const rawJoinedAt = entry.joinedAt;
      const rawLeftAt = entry.leftAt;
      const rawIsActive = entry.isActive;

      if (typeof rawShowId !== "string" || !rawShowId) {
        return null;
      }

      if (typeof rawYear !== "number" || !Number.isFinite(rawYear)) {
        return null;
      }

      const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle : null;
      const joinedAt = parseIsoDate(rawJoinedAt);
      const leftAt = parseIsoDate(rawLeftAt);
      const isActive = Boolean(rawIsActive);

      return {
        showId: rawShowId,
        title,
        year: rawYear,
        joinedAt,
        leftAt,
        isActive,
      } satisfies ProductionMembershipSummary;
    })
    .filter((entry): entry is ProductionMembershipSummary => entry !== null);
}

function formatProductionName(entry: { title: string | null; year: number }) {
  if (entry.title && entry.title.trim()) {
    return `${entry.title} (${entry.year})`;
  }
  return `Produktion ${entry.year}`;
}

function formatDateLocalized(date: Date | null) {
  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
  } catch {
    return null;
  }
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
  const canAccessProductions =
    effectivePermissions?.includes("mitglieder.produktionen") ?? false;

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingOverview | null>(null);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [whatsappDismissed, setWhatsappDismissed] = useState(false);
  const [whatsappVisitPending, setWhatsappVisitPending] = useState(false);
  const [finalRehearsalWeek, setFinalRehearsalWeek] = useState<FinalRehearsalWeekInfo | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<
    { complete: boolean; completed: number; total: number } | null
  >(null);
  const [activeProduction, setActiveProduction] = useState<ActiveProductionOverview | null>(null);
  const [productionMemberships, setProductionMemberships] = useState<ProductionMembershipSummary[]>([]);
  const [activeProductionLoaded, setActiveProductionLoaded] = useState(false);
  const [activeProductionError, setActiveProductionError] = useState(false);

  useEffect(() => {
    setStats((prev) => ({ ...prev, totalOnline: liveOnline }));
  }, [liveOnline]);

  useEffect(() => {
    setWhatsappDismissed(false);
  }, [onboarding?.whatsappLink]);

  const showWhatsAppCallout = Boolean(
    onboarding?.whatsappLink && !onboarding.whatsappLinkVisitedAt && !whatsappDismissed,
  );

  const handleDashboardWhatsappVisit = useCallback(() => {
    if (!onboarding?.whatsappLink || onboarding.whatsappLinkVisitedAt || whatsappVisitPending) {
      return;
    }

    setWhatsappVisitPending(true);

    const send = async () => {
      try {
        const response = await fetch("/api/onboarding/whatsapp-visit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
          keepalive: true,
        });

        if (!response.ok) {
          throw new Error(`RequestFailed:${response.status}`);
        }

        const data = (await response.json().catch(() => null)) as { visitedAt?: string } | null;
        const visitedIso = typeof data?.visitedAt === "string" ? data.visitedAt.trim() : "";
        const parsedVisited = visitedIso ? new Date(visitedIso) : new Date();
        const visitedDate = Number.isNaN(parsedVisited.valueOf()) ? new Date() : parsedVisited;

        setOnboarding((prev) =>
          prev
            ? {
                ...prev,
                whatsappLinkVisitedAt: visitedDate,
              }
            : prev,
        );
      } catch (error) {
        console.error("[dashboard.whatsapp] visit failed", error);
      } finally {
        setWhatsappVisitPending(false);
      }
    };

    void send();
  }, [onboarding, whatsappVisitPending]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setActiveProductionError(false);
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
        setFinalRehearsalWeek(parseFinalRehearsalWeek(payload?.finalRehearsalWeek));
        setProfileCompletion(parseProfileCompletion(payload?.profileCompletion));
        setActiveProduction(parseActiveProduction(payload?.activeProduction));
        setProductionMemberships(parseProductionMemberships(payload?.productionMemberships));
        const activities = parseRecentActivities(payload?.recentActivities);

        setRecentActivities(activities.slice(0, 10));
      } catch (error) {
        console.error("[Dashboard] Error loading overview", error);
        setActiveProductionError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setOnboardingLoaded(true);
          setActiveProductionLoaded(true);
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
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "rehearsal":
        return <Calendar className="h-4 w-4 text-info" />;
      case "notification":
      default:
        return <Bell className="h-4 w-4 text-accent" />;
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

  const connectionToneClasses: Record<"online" | "offline" | "warning" | "error", string> = {
    online:
      "border-emerald-400/45 bg-gradient-to-r from-emerald-500/15 via-emerald-400/10 to-background/70 text-emerald-700 shadow-sm shadow-emerald-500/20 backdrop-blur dark:text-emerald-200",
    warning:
      "border-amber-400/45 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-background/70 text-amber-700 shadow-sm shadow-amber-500/20 backdrop-blur dark:text-amber-200",
    error:
      "border-rose-400/45 bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-background/70 text-rose-700 shadow-sm shadow-rose-500/20 backdrop-blur dark:text-rose-200",
    offline: "border-border/60 bg-background/60 text-muted-foreground shadow-sm backdrop-blur",
  };
  const connectionBadgeClass = connectionToneClasses[connectionMeta.state];

  const activeMembership = useMemo(() => {
    if (!activeProduction) {
      return null;
    }

    return (
      productionMemberships.find((entry) => entry.showId === activeProduction.id) ?? null
    );
  }, [activeProduction, productionMemberships]);

  const otherMemberships = useMemo(() => {
    if (productionMemberships.length === 0) {
      return [] as ProductionMembershipSummary[];
    }

    if (!activeProduction) {
      return productionMemberships;
    }

    return productionMemberships.filter((entry) => entry.showId !== activeProduction.id);
  }, [activeProduction, productionMemberships]);

  const finalRehearsalMetric = useMemo(() => {
    if (!finalRehearsalWeek) return null;

    const startDate = finalRehearsalWeek.startDate;
    const showLabel = finalRehearsalWeek.title
      ? finalRehearsalWeek.title
      : `Produktion ${finalRehearsalWeek.year}`;
    const formattedDate = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(startDate);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const diffMs = startDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

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
        hint: `${showLabel} · Start am ${formattedDate}`,
        tone,
      } as const;
    }

    if (diffDays === 0) {
      return {
        label: "Endprobenwoche",
        value: "Heute",
        hint: `${showLabel} · Start am ${formattedDate}`,
        tone: "warning" as const,
      };
    }

    return {
      label: "Endprobenwoche",
      value: "Gestartet",
      hint: `${showLabel} · Start am ${formattedDate}`,
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
      {
        key: "notifications",
        label: "Ungelesene Benachrichtigungen",
        value: numberFormatter.format(stats.unreadNotifications),
        hint: "Wer zuerst liest, ist informiert",
        icon: <Bell className="h-4 w-4" />,
        tone: stats.unreadNotifications > 0 ? "warning" : "neutral",
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
    stats.unreadNotifications,
  ]);

  const profileReminder = useMemo(() => {
    if (!profileCompletion) {
      return null;
    }

    const remaining = Math.max(profileCompletion.total - profileCompletion.completed, 0);

    if (!profileCompletion.complete) {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/45 bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-background/80 p-4 text-sm text-amber-700 shadow-sm shadow-amber-500/20 backdrop-blur dark:text-amber-200">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/10 text-amber-700/90 dark:text-amber-200">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Profilangaben unvollständig</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-200/80">
                {`Noch ${remaining} von ${profileCompletion.total} Aufgaben offen.`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-400/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-200"
            asChild
          >
            <Link href="/mitglieder/profil">Profil aktualisieren</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/45 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-background/80 p-4 text-sm text-emerald-700 shadow-sm shadow-emerald-500/20 backdrop-blur dark:text-emerald-200">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/10 text-emerald-700/90 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">Profil vollständig</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">Alle Angaben sind auf dem aktuellen Stand.</p>
        </div>
      </div>
    );
  }, [profileCompletion]);

  const activeProductionCard = useMemo(() => {
    if (!activeProductionLoaded) {
      return (
        <Card
          className={cn(
            DASHBOARD_CARD_BASE,
            "border-dashed border-border/60 bg-background/60 text-muted-foreground",
          )}
        >
          <CardContent className="space-y-3 p-6">
            <div className="h-4 w-32 rounded bg-background/70" />
            <div className="h-5 w-48 rounded bg-background/65" />
            <div className="h-3 w-full rounded bg-background/55" />
          </CardContent>
        </Card>
      );
    }

    if (activeProductionError) {
      return (
        <Card
          className={cn(
            DASHBOARD_CARD_BASE,
            "border-rose-400/50 bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-background/80 text-rose-700 shadow-lg shadow-rose-500/20 dark:text-rose-200",
          )}
        >
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-semibold">Aktive Produktion konnte nicht geladen werden.</p>
            <p className="text-xs text-rose-700/80 dark:text-rose-200/80">
              Bitte lade die Seite neu oder versuche es später erneut.
            </p>
          </CardContent>
        </Card>
      );
    }

    const membershipSectionTitle = activeProduction ? "Weitere Produktionen" : "Bisherige Produktionen";

    const membershipBadges = otherMemberships.length
      ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {membershipSectionTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              {otherMemberships.slice(0, 4).map((membership) => {
                const label = formatProductionName(membership);
                const leftLabel = formatDateLocalized(membership.leftAt);
                const statusText = membership.isActive
                  ? "aktiv"
                  : leftLabel
                    ? `bis ${leftLabel}`
                    : "archiviert";

                return (
                  <Badge
                    key={`membership-${membership.showId}`}
                    variant="outline"
                    className={cn(
                      "border-border/60 bg-background/70 text-foreground shadow-sm backdrop-blur",
                      membership.isActive &&
                        "border-primary/45 bg-gradient-to-r from-primary/15 via-primary/10 to-background/80 text-primary",
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground/80">• {statusText}</span>
                  </Badge>
                );
              })}
            </div>
            {otherMemberships.length > 4 ? (
              <p className="text-[11px] text-muted-foreground">
                + {otherMemberships.length - 4} weitere im Archiv
              </p>
            ) : null}
          </div>
        )
      : null;

    const sharedNote = (
      <p className="text-xs text-muted-foreground">
        Profilangaben wie Maße, Allergien und Einverständnisse gelten produktonsübergreifend und müssen nicht
        erneut erfasst werden.
      </p>
    );

    if (!activeProduction) {
      return (
        <Card
          className={cn(
            DASHBOARD_CARD_BASE,
            "border-dashed border-primary/45 bg-gradient-to-br from-primary/15 via-primary/10 to-background/85 shadow-lg shadow-primary/20",
          )}
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-primary">Keine aktive Produktion ausgewählt</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wähle eine aktive Produktion, um Rollen, Szenen und Gewerke der aktuellen Saison zu sehen.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sobald du nur einer laufenden Produktion angehörst oder frühere Produktionen ausgelaufen sind, setzen wir
              deine Mitgliedschaft automatisch auf die aktuelle Produktion.
            </p>
            {membershipBadges}
            {sharedNote}
            {canAccessProductions ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm">
                  <Link href="/mitglieder/produktionen">Zur Produktionsübersicht</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    const productionLabel = formatProductionName(activeProduction);
    const membership = activeMembership;
    const joinedLabel = formatDateLocalized(membership?.joinedAt ?? null);
    const leftLabel = formatDateLocalized(membership?.leftAt ?? null);
    const statusBadgeLabel = membership?.isActive === false ? "Archiviert" : "Aktiv";
    const statusBadgeClass =
      membership?.isActive === false
        ? "border-border/60 bg-background/70 text-muted-foreground shadow-sm backdrop-blur"
        : "border-emerald-400/45 bg-emerald-500/10 text-emerald-700 shadow-sm backdrop-blur dark:text-emerald-200";

    let membershipSubtitle: string | null = null;
    if (membership?.isActive) {
      membershipSubtitle = joinedLabel ? `Seit ${joinedLabel} Teil der Produktion.` : "Mitgliedschaft aktiv.";
    } else if (membership) {
      membershipSubtitle = joinedLabel && leftLabel
        ? `Von ${joinedLabel} bis ${leftLabel} aktiv.`
        : leftLabel
          ? `Mitgliedschaft beendet am ${leftLabel}.`
          : "Mitgliedschaft archiviert.";
    }

    return (
      <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_BASE)}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 via-background/50 to-transparent opacity-70"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">Aktive Produktion</CardTitle>
            <p className="text-sm text-muted-foreground">
              Du arbeitest aktuell in {productionLabel}.
            </p>
          </div>
          <Badge variant="outline" className={statusBadgeClass}>
            {statusBadgeLabel}
          </Badge>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{productionLabel}</p>
            <p className="text-xs text-muted-foreground">
              {membershipSubtitle ?? "Mitgliedschaft automatisch verwaltet."}
            </p>
          </div>
          {membershipBadges}
          {sharedNote}
          {canAccessProductions ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link href={`/mitglieder/produktionen/${activeProduction.id}`}>Arbeitsbereich öffnen</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/mitglieder/produktionen">Produktion wechseln</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }, [
    activeProduction,
    activeProductionError,
    activeProductionLoaded,
    activeMembership,
    canAccessProductions,
    otherMemberships,
  ]);

  const onboardingCard = useMemo(() => {
    if (!onboardingLoaded) {
      return (
        <Card
          className={cn(
            DASHBOARD_CARD_BASE,
            "border-dashed border-border/60 bg-background/60 text-muted-foreground",
          )}
        >
          <CardContent className="p-6 text-sm text-muted-foreground">
            Onboarding-Status wird geladen …
          </CardContent>
        </Card>
      );
    }

    if (!onboarding) {
      return (
        <Card
          className={cn(
            DASHBOARD_CARD_BASE,
            "border-dashed border-border/60 bg-background/60 text-muted-foreground",
          )}
        >
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
      <Badge variant="secondary" className="border-success/45 bg-success/15 text-success">
        Abgeschlossen
      </Badge>
    ) : (
      <Badge variant="outline" className="border-warning/45 text-warning">
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
      <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_BASE)}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/10 via-background/55 to-transparent opacity-80"
        />
        <CardHeader className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
        <CardContent className="relative z-10 space-y-4 text-sm">
          <div className={cn(DASHBOARD_SURFACE_MUTED, "space-y-2 p-3")}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {focusLabel}
            </div>
            <p className="text-xs text-muted-foreground">{focusDescription}</p>
            {onboarding.background && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                  {onboarding.background}
                </Badge>
                {onboarding.backgroundClass && (
                  <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                    Klasse {onboarding.backgroundClass}
                  </Badge>
                )}
              </div>
            )}
            {!onboarding.background && onboarding.backgroundClass && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                  Klasse {onboarding.backgroundClass}
                </Badge>
              </div>
            )}
            {onboarding.notes && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{onboarding.notes}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["acting", "crew"] as const).map((domain) => {
              const stats = onboarding.stats[domain];
              const normalizedWeight =
                stats.averageWeight > 0 && stats.averageWeight <= 1
                  ? stats.averageWeight * 100
                  : stats.averageWeight;
              const averageWeight = Math.max(0, Math.min(100, Math.round(normalizedWeight)));
              return (
                <div key={domain} className={cn(DASHBOARD_SURFACE_MUTED, "space-y-2 p-3")}
                >
                  <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                    <span>{domain === "acting" ? "Schauspiel" : "Gewerke"}</span>
                    <span>
                      {stats.count} Bereich
                      {stats.count === 1 ? "" : "e"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-background/50">
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

          <div className={cn(DASHBOARD_SURFACE_MUTED, "space-y-2 p-3")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Interessen</span>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {onboarding.stats.interests.count}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {onboarding.stats.interests.top.length ? (
                onboarding.stats.interests.top.map((interest) => (
                  <Badge key={interest} variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                    {interest}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Keine Angaben</span>
              )}
            </div>
          </div>

          <div className={cn(DASHBOARD_SURFACE_MUTED, "space-y-2 p-3")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Essenshinweise</span>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
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

          {showWhatsAppCallout ? (
            <div className="space-y-2 rounded-xl border border-emerald-400/45 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-background/80 p-3 text-emerald-800 shadow-sm shadow-emerald-500/20 backdrop-blur dark:text-emerald-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp-Gruppe
                </div>
                <button
                  type="button"
                  onClick={() => setWhatsappDismissed(true)}
                  className="rounded-full border border-transparent p-1 text-emerald-700/80 transition hover:border-emerald-400/60 hover:text-emerald-700 dark:text-emerald-200"
                  aria-label="Hinweis ausblenden"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">
                Tritt der Ensemble-Gruppe bei, um Ansprechpersonen und aktuelle Infos zu erhalten.
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-emerald-400/60 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-200"
              >
                <a
                  href={onboarding.whatsappLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleDashboardWhatsappVisit}
                >
                  {whatsappVisitPending ? "Wird geöffnet …" : "WhatsApp öffnen"}
                </a>
              </Button>
            </div>
          ) : null}

          <div className={cn(DASHBOARD_SURFACE_MUTED, "space-y-2 p-3")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Fotoerlaubnis</span>
              <Badge variant="outline" className={photoBadgeClass}>
                {photoLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{photoText}</p>
            {!onboarding.photoConsent.hasDocument && onboarding.photoConsent.consentGiven && (
              <p className="text-[11px] text-warning">Hinweis: Dokument noch ausstehend.</p>
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
  }, [
    handleDashboardWhatsappVisit,
    onboarding,
    onboardingLoaded,
    showWhatsAppCallout,
    whatsappVisitPending,
  ]);

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
          <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_BASE)}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-32 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-primary/15 opacity-60 blur-3xl dark:bg-primary/25"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-12 h-44 w-44 rounded-full bg-emerald-200/30 opacity-70 blur-3xl dark:bg-emerald-500/15"
            />
            <CardContent className="relative z-10 space-y-6 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/45 bg-primary/10 text-primary">
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
                    <Users className="h-3.5 w-3.5" />
                    <span>{numberFormatter.format(onlineUsers.length)} online</span>
                  </div>
                ) : null}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Halte Produktionen, Proben und Teamkommunikation im Blick. Nutze die Schnellaktionen für den direkten Einstieg.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                    connectionBadgeClass,
                  )}
                >
                  {connectionMeta.icon}
                  <span>{connectionMeta.label}</span>
                </div>
              </div>
              {profileReminder ? <div>{profileReminder}</div> : null}
            </CardContent>
          </Card>
          <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_BASE)}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 via-background/50 to-transparent opacity-80"
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
                        className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-sm font-medium shadow-sm backdrop-blur transition hover:border-primary/45 hover:bg-primary/10"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm transition group-hover:border-primary/45 group-hover:bg-primary/10 group-hover:text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          {link.label}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
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
                "relative overflow-hidden",
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

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            {activeProductionCard}
            {onboardingCard}
          </div>
          <div className="space-y-6">
            <Card className={cn("relative h-full overflow-hidden", DASHBOARD_CARD_BASE)}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 via-background/55 to-transparent opacity-70"
              />
              <CardHeader className="relative z-10 space-y-1 pb-4">
                <CardTitle>Aktive Mitglieder</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Wer ist gerade online? Live-Ansicht aktualisiert automatisch.
                </p>
              </CardHeader>
              <CardContent className="relative z-10 flex h-full flex-col gap-4">
                {onlineList.length === 0 ? (
                  <div className={cn(DASHBOARD_SURFACE_DASHED, "text-sm text-muted-foreground")}
                  >
                    {onlineLoading ? "Lade Live-Daten …" : "Derzeit ist niemand online."}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {onlineList.map((user) => (
                      <li
                        key={`${user.id}-${user.joinedAt.getTime()}`}
                        className={cn(DASHBOARD_SURFACE_MUTED, "flex items-center justify-between px-4 py-3")}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-2.5 w-2.5 rounded-full bg-success" />
                          <span className="text-sm font-medium">{user.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground/80">{formatTimeAgo(user.joinedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className={cn("relative h-full overflow-hidden", DASHBOARD_CARD_BASE)}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 via-background/55 to-transparent opacity-70"
              />
              <CardHeader className="relative z-10 space-y-1 pb-4">
                <CardTitle>Aktivitäten</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Neueste Proben, Zusagen und Benachrichtigungen.
                </p>
              </CardHeader>
              <CardContent className="relative z-10 flex h-full flex-col gap-4">
                {isLoading && recentActivities.length === 0 ? (
                  <div className={cn(DASHBOARD_SURFACE_DASHED, "text-sm text-muted-foreground")}
                  >
                    Lade Aktivitäten …
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className={cn(DASHBOARD_SURFACE_DASHED, "text-sm text-muted-foreground")}
                  >
                    Noch keine Aktivitäten erfasst.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {recentActivities.map((activity) => (
                      <li
                        key={`${activity.id}-${activity.timestamp.getTime()}`}
                        className={cn(DASHBOARD_SURFACE_MUTED, "flex items-center gap-3 px-4 py-3")}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.message}</p>
                          <p className="text-xs text-muted-foreground/80">{formatTimeAgo(activity.timestamp)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </Fragment>
  );
}
