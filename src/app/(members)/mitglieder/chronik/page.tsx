import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/members/page-header";
import { ShowManager } from "./show-manager";
import type { ShowRecord } from "./types";

export const dynamic = "force-dynamic";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeDates(value: Prisma.JsonValue): string | null {
  if (typeof value === "string") return value || null;
  if (value !== null && value !== undefined) return JSON.stringify(value);
  return null;
}

function serializeShow(show: {
  id: string;
  year: number;
  title: string | null;
  synopsis: string | null;
  dates: Prisma.JsonValue;
  posterUrl: string | null;
  revealedAt: Date | null;
  meta: Prisma.JsonValue;
}): ShowRecord {
  return {
    id: show.id,
    year: show.year,
    title: show.title,
    synopsis: show.synopsis,
    dates: serializeDates(show.dates),
    posterUrl: show.posterUrl,
    revealedAt: show.revealedAt?.toISOString() ?? null,
    meta: isPlainObject(show.meta) ? (show.meta as ShowRecord["meta"]) : null,
  };
}

export default async function ChronikManagePage() {
  const session = await requireAuth();
  if (!session.user || !(await hasPermission(session.user, "PRIVATE.CHRONIK.MANAGE"))) {
    redirect("/mitglieder");
  }

  const shows = await prisma.show.findMany({
    orderBy: [{ year: "desc" }],
    select: {
      id: true,
      year: true,
      title: true,
      synopsis: true,
      dates: true,
      posterUrl: true,
      revealedAt: true,
      meta: true,
    },
  });

  const serialized = shows.map(serializeShow);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chronik"
        description="Vergangene Produktionen verwalten, neue Einträge anlegen."
      />
      <ShowManager initialShows={serialized} />
    </div>
  );
}

