import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/rbac";
import { DIRECTION_HOME_PATH, getDirectionShows, pickDirectionShow } from "@/lib/regie/access";

export type DirectionSearchParams = Promise<{ show?: string | string[] }>;

/** Angemeldete Person, ihre Regie-Produktionen und die gewählte (`?show=`). */
export async function resolveDirectionPage(searchParams: DirectionSearchParams) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) redirect("/login");
  const shows = await getDirectionShows(userId);
  const requested = (await searchParams).show;
  const show = pickDirectionShow(shows, Array.isArray(requested) ? requested[0] : requested);
  return { session, userId, shows, show };
}

export function directionHref(section: string | null, showId: string) {
  const path = section ? `${DIRECTION_HOME_PATH}/${section}` : DIRECTION_HOME_PATH;
  return `${path}?show=${encodeURIComponent(showId)}`;
}

export function directionPdfHref(kind: string, showId: string) {
  return `/api/regie/${encodeURIComponent(showId)}/pdf/${kind}`;
}
