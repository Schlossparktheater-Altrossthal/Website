import { prisma } from '@/lib/prisma';
import { broadcastOnboardingDashboardUpdate } from '@/lib/realtime/triggers';

import { loadOnboardingDashboardSnapshot } from './dashboard-service';

interface BroadcastOptions {
  broadcastToGlobal?: boolean;
}

export async function broadcastOnboardingDashboardSnapshot(
  onboardingId: string,
  options: BroadcastOptions = {},
) {
  if (!onboardingId) return;
  const dashboard = await loadOnboardingDashboardSnapshot(onboardingId);
  if (!dashboard) return;
  await broadcastOnboardingDashboardUpdate({
    onboardingId,
    dashboard,
    broadcastToGlobal: options.broadcastToGlobal,
  });
}

export async function broadcastOnboardingDashboardForUser(
  userId: string,
  options: BroadcastOptions = {},
) {
  if (!userId) return;
  const profile = await prisma.memberOnboardingProfile.findUnique({
    where: { userId },
    select: { showId: true },
  });
  const onboardingId = profile?.showId;
  if (!onboardingId) return;
  await broadcastOnboardingDashboardSnapshot(onboardingId, options);
}
