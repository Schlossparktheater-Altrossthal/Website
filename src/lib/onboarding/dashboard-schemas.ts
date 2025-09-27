import { z } from "zod";

export const onboardingStatusSchema = z.enum(["draft", "active", "completed", "archived"]);

export const onboardingSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  periodLabel: z.string().nullable(),
  status: onboardingStatusSchema,
});

export const kpiCardSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  helper: z.string().optional(),
  trend: z
    .object({
      direction: z.enum(["up", "down", "flat"]),
      percentage: z.number().optional(),
      label: z.string().optional(),
    })
    .optional(),
  intent: z.enum(["default", "success", "warning", "critical"]).optional(),
});

export const distributionEntrySchema = z.object({
  label: z.string(),
  value: z.number(),
  percentage: z.number().optional(),
  intent: z.enum(["default", "success", "warning", "critical"]).optional(),
});

export const heatmapCellSchema = z.object({
  x: z.string(),
  y: z.string(),
  value: z.number(),
});

export const coOccurrenceEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  weight: z.number(),
});

export const clusterNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  intent: z.enum(["default", "success", "warning", "critical"]).optional(),
});

export const diversityMetricSchema = z.object({
  shannon: z.number(),
  gini: z.number(),
  normalized: z.number(),
  status: z.enum(["ok", "warning", "critical"]),
  explanation: z.string(),
});

export const nutritionBreakdownSchema = z.object({
  diets: z.array(
    z.object({
      label: z.string(),
      count: z.number(),
    }),
  ),
  allergies: z.array(
    z.object({
      allergen: z.string(),
      severities: z.record(z.string(), z.number()),
    }),
  ),
});

export const processStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  completionRate: z.number(),
  dropoutRate: z.number(),
});

export const documentStatusSchema = z.object({
  uploaded: z.number(),
  skipped: z.number(),
  pending: z.number(),
});

export const roleAggregateSchema = z.object({
  roleId: z.string(),
  label: z.string(),
  domain: z.enum(["acting", "crew"]),
  normalizedShare: z.number(),
  participantShare: z.number(),
});

export const allocationCandidateSchema = z.object({
  userId: z.string(),
  name: z.string(),
  focus: z.enum(["acting", "tech", "both"]).optional(),
  normalizedShare: z.number(),
  qualityFactor: z.number(),
  score: z.number(),
  confidence: z.number(),
  justification: z.string(),
  interests: z.array(z.string()).default([]),
  experienceYears: z.number().optional(),
  adjustedScore: z.number().optional(),
  fairnessPenalty: z.number().optional(),
  delta: z.number().optional(),
});

export const allocationSlotSchema = z.object({
  slotId: z.string(),
  index: z.number(),
  candidate: allocationCandidateSchema.nullable(),
  adjustedScore: z.number().nullable(),
  fairnessPenalty: z.number().nullable(),
  alternatives: z.array(allocationCandidateSchema),
});

export const allocationRoleSchema = z.object({
  roleId: z.string(),
  label: z.string(),
  domain: z.enum(["acting", "crew"]),
  capacity: z.number(),
  demand: z.number(),
  candidates: z.array(allocationCandidateSchema),
  slots: z.array(allocationSlotSchema).default([]),
  optimizedScore: z.number().optional(),
  unmatchedDemand: z.number().optional(),
});

export const fairnessMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  target: z.number(),
  status: z.enum(["ok", "warning", "critical"]),
  description: z.string(),
});

export const conflictItemSchema = z.object({
  roleId: z.string(),
  label: z.string(),
  slotIndex: z.number(),
  delta: z.number(),
  candidates: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      score: z.number(),
      tieBreaker: z.string(),
    }),
  ),
});

export const optimizerFairnessBucketSchema = z.object({
  bucketId: z.string(),
  label: z.string(),
  capacity: z.number(),
  used: z.number(),
  utilization: z.number(),
});

export const optimizerSummarySchema = z.object({
  totalSlots: z.number(),
  totalAssignments: z.number(),
  averageScore: z.number().nullable(),
  fairnessBuckets: z.array(optimizerFairnessBucketSchema),
});

export const historySnapshotSchema = z.object({
  onboardingId: z.string(),
  label: z.string(),
  participants: z.number(),
  medianAge: z.number().nullable(),
  focusBothShare: z.number().nullable(),
  createdAt: z.string(),
});

export const onboardingGlobalSectionSchema = z.object({
  kpis: z.array(kpiCardSchema),
  ageGroups: z.array(distributionEntrySchema),
  genderDistribution: z.array(distributionEntrySchema),
  focusDistribution: z.array(distributionEntrySchema),
  photoConsentRate: z.number().nullable(),
  rolesActing: z.array(roleAggregateSchema),
  rolesCrew: z.array(roleAggregateSchema),
  roleCoverage: z.object({ acting: z.number(), crew: z.number() }),
  roleHeatmap: z.array(heatmapCellSchema),
  interestTopTags: z.array(distributionEntrySchema),
  interestWordCloud: z.array(
    z.object({
      tag: z.string(),
      weight: z.number(),
    }),
  ),
  interestCoOccurrences: z.array(coOccurrenceEdgeSchema),
  interestClusters: z.array(clusterNodeSchema),
  diversity: diversityMetricSchema,
  nutrition: nutritionBreakdownSchema,
  process: z.object({
    steps: z.array(processStepSchema),
    documents: documentStatusSchema,
  }),
});

export const onboardingAllocationSectionSchema = z.object({
  roles: z.array(allocationRoleSchema),
  fairness: z.array(fairnessMetricSchema),
  conflicts: z.array(conflictItemSchema),
  optimizer: optimizerSummarySchema,
});

export const onboardingDashboardSchema = z.object({
  onboarding: onboardingSummarySchema.extend({
    statusLabel: z.string(),
    timeSpan: z.string().nullable(),
    participants: z.number(),
  }),
  global: onboardingGlobalSectionSchema,
  allocation: onboardingAllocationSectionSchema,
  history: z.array(historySnapshotSchema).optional(),
});

export type OnboardingDashboardData = z.infer<typeof onboardingDashboardSchema>;
export type OnboardingSummary = z.infer<typeof onboardingSummarySchema>;
export type AllocationRole = z.infer<typeof allocationRoleSchema>;
export type AllocationCandidate = z.infer<typeof allocationCandidateSchema>;
export type AllocationSlot = z.infer<typeof allocationSlotSchema>;
