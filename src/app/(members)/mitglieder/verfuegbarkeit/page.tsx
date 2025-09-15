import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ClientAvailability } from "./client";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const userId = (session.user as any).id as string;
  const now = new Date();
  const sp = await searchParams;
  const year = Number(sp?.year ?? now.getUTCFullYear());
  const month = Number(sp?.month ?? now.getUTCMonth() + 1);

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const days = await prisma.availabilityDay.findMany({ where: { userId, date: { gte: start, lt: end } } });
  const initial = days.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    kind: d.kind as any,
    from: d.availableFromMin != null ? `${String(Math.floor(d.availableFromMin / 60)).padStart(2, "0")}:${String(d.availableFromMin % 60).padStart(2, "0")}` : undefined,
    to: d.availableToMin != null ? `${String(Math.floor(d.availableToMin / 60)).padStart(2, "0")}:${String(d.availableToMin % 60).padStart(2, "0")}` : undefined,
    note: d.note ?? undefined,
  }));
  const templates = await prisma.availabilityTemplate.findMany({ where: { userId } });
  const initialTemplates = templates.map((t) => ({
    weekday: t.weekday,
    kind: t.kind as any,
    from: t.availableFromMin != null ? `${String(Math.floor(t.availableFromMin / 60)).padStart(2, "0")}:${String(t.availableFromMin % 60).padStart(2, "0")}` : undefined,
    to: t.availableToMin != null ? `${String(Math.floor(t.availableToMin / 60)).padStart(2, "0")}:${String(t.availableToMin % 60).padStart(2, "0")}` : undefined,
  }));

  return <ClientAvailability year={year} month={month} initial={initial} initialTemplates={initialTemplates} />;
}
