import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

export const ACTIVE_PRODUCTION_COOKIE = "active-production";

export async function getActiveProductionId() {
  const store = await cookies();
  const value = store.get(ACTIVE_PRODUCTION_COOKIE)?.value;
  return value ?? null;
}

export async function getActiveProduction() {
  const activeProductionId = await getActiveProductionId();
  if (!activeProductionId) {
    return null;
  }

  const show = await prisma.show.findUnique({
    where: { id: activeProductionId },
    select: {
      id: true,
      title: true,
      year: true,
      synopsis: true,
    },
  });

  if (!show) {
    return null;
  }

  return show;
}
