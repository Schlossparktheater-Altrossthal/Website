"use server";

import { z } from "zod";

import { loadOnboardingDashboardSnapshot } from "@/lib/onboarding/dashboard-service";

const payloadSchema = z.object({
  onboardingId: z.string().min(1),
  capacities: z
    .array(
      z.object({
        roleId: z.string().min(1),
        capacity: z.number().int().min(0).max(999),
      }),
    )
    .default([]),
});

export async function recalculateAllocationAction(input: {
  onboardingId: string;
  capacities: Array<{ roleId: string; capacity: number }>;
}) {
  const { onboardingId, capacities } = payloadSchema.parse(input);

  const capacityMap = new Map<string, number>();
  capacities.forEach(({ roleId, capacity }) => {
    capacityMap.set(roleId, capacity);
  });

  const dashboard = await loadOnboardingDashboardSnapshot(onboardingId, {
    capacityOverrides: capacityMap,
  });

  if (!dashboard) {
    throw new Error("Onboarding nicht gefunden");
  }

  return dashboard;
}
