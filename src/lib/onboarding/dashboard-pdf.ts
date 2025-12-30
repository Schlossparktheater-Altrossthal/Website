import type { OnboardingDashboardData } from "./dashboard-schemas";
import type { OnboardingStatisticsPdfData } from "../pdf/templates/onboarding-statistics";

const numberFormatter = new Intl.NumberFormat("de-DE");

function clampPercentage(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Number(Math.round(value * 10) / 10);
}

function normalizeShare(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  const percentage = value * 100;
  return clampPercentage(percentage);
}

function toDisplayNumber(value: number | string) {
  if (typeof value === "number") {
    return numberFormatter.format(value);
  }
  return value;
}

function diversityLabel(status: "ok" | "warning" | "critical") {
  switch (status) {
    case "ok":
      return "Stabil";
    case "warning":
      return "Beobachten";
    case "critical":
      return "Handeln";
    default:
      return "Unbekannt";
  }
}

export function buildOnboardingStatisticsPdfData(
  dashboard: OnboardingDashboardData,
): OnboardingStatisticsPdfData {
  const participants = dashboard.onboarding.participants;
  const generatedAt = new Date();
  const safeParticipants = Number.isFinite(participants) ? participants : 0;

  const actingRoles = dashboard.global.rolesActing
    .slice()
    .sort((a, b) => b.participantShare - a.participantShare)
    .slice(0, 8)
    .map((role) => {
      const participantsCount = Math.round((role.participantShare / 100) * safeParticipants);
      return {
        label: role.label,
        participants: participantsCount,
        participantShare: clampPercentage(role.participantShare),
        normalizedShare: normalizeShare(role.normalizedShare),
      };
    });

  const crewRoles = dashboard.global.rolesCrew
    .slice()
    .sort((a, b) => b.participantShare - a.participantShare)
    .slice(0, 8)
    .map((role) => {
      const participantsCount = Math.round((role.participantShare / 100) * safeParticipants);
      return {
        label: role.label,
        participants: participantsCount,
        participantShare: clampPercentage(role.participantShare),
        normalizedShare: normalizeShare(role.normalizedShare),
      };
    });

  const interests = dashboard.global.interestTopTags.slice(0, 10).map((entry) => ({
    label: entry.label,
    count: entry.value,
    percentage: clampPercentage(entry.percentage ?? null),
  }));

  const formatDistribution = (entries: typeof dashboard.global.ageGroups) =>
    entries.map((entry) => ({
      label: entry.label,
      count: entry.value,
      percentage: clampPercentage(entry.percentage ?? null),
    }));

  const history = (dashboard.history ?? [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((entry) => ({
      label: entry.label,
      participants: entry.participants,
      createdAt: entry.createdAt,
      focusBothShare: entry.focusBothShare ?? null,
    }));

  return {
    generatedAt: generatedAt.toISOString(),
    onboarding: {
      id: dashboard.onboarding.id,
      title: dashboard.onboarding.title,
      statusLabel: dashboard.onboarding.statusLabel,
      timeSpan: dashboard.onboarding.timeSpan,
      participants: dashboard.onboarding.participants,
    },
    kpis: dashboard.global.kpis.slice(0, 8).map((kpi) => ({
      label: kpi.label,
      value: toDisplayNumber(kpi.value),
      helper: kpi.helper ?? null,
    })),
    focusDistribution: formatDistribution(dashboard.global.focusDistribution),
    genderDistribution: formatDistribution(dashboard.global.genderDistribution),
    ageGroups: formatDistribution(dashboard.global.ageGroups),
    interests,
    roleCoverage: {
      acting: clampPercentage(dashboard.global.roleCoverage.acting),
      crew: clampPercentage(dashboard.global.roleCoverage.crew),
      actingRoles,
      crewRoles,
    },
    process: {
      steps: dashboard.global.process.steps.map((step) => ({
        label: step.label,
        completionRate: clampPercentage(step.completionRate),
        dropoutRate: clampPercentage(step.dropoutRate),
      })),
      documents: {
        uploaded: dashboard.global.process.documents.uploaded,
        pending: dashboard.global.process.documents.pending,
        skipped: dashboard.global.process.documents.skipped,
      },
    },
    diversity: {
      shannon: Number.isFinite(dashboard.global.diversity.shannon)
        ? Number(dashboard.global.diversity.shannon)
        : null,
      gini: Number.isFinite(dashboard.global.diversity.gini)
        ? Number(dashboard.global.diversity.gini)
        : null,
      normalized: Number.isFinite(dashboard.global.diversity.normalized)
        ? Number(dashboard.global.diversity.normalized)
        : null,
      statusLabel: diversityLabel(dashboard.global.diversity.status),
      explanation: dashboard.global.diversity.explanation,
    },
    history,
    photoConsentRate: clampPercentage(
      dashboard.global.photoConsentRate !== null
        ? dashboard.global.photoConsentRate * 100
        : null,
    ),
  };
}
