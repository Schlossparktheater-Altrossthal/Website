import type { Prisma, PrismaClient } from "@prisma/client";

import { categoryPathLabel } from "@/lib/inventory/specs";
import {
  RESERVING_STATUSES,
  type PhaseKind,
  type ProjectStatus,
} from "@/lib/inventory/project-constants";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Status, die ein Exemplar für Projekte nutzbar lassen (ausgegeben kommt ja zurück). */
const USABLE_STATUSES = ["available", "checked_out"] as const;

export type Reservation = {
  projectId: string;
  publicId: string;
  title: string;
  status: ProjectStatus;
  quantity: number;
  startsOn: Date | null;
  endsOn: Date | null;
};

export type Availability = {
  /** Nutzbarer Bestand: Exemplare ohne Defekt/Sperre bzw. Gesamtmenge bei Mengenartikeln. */
  capacity: number;
  /** Bestand inkl. Reparatur/Gesperrt/Vermisst – zeigt, was „eigentlich“ da wäre. */
  total: number;
  /** Andere Projekte im selben Zeitraum. */
  reservations: Reservation[];
  /** Fest (bestätigt) bzw. weich (angefragt) belegt. */
  confirmed: number;
  requested: number;
};

/**
 * Verfügbarkeit je Artikeltyp für einen Zeitraum. Gezählt werden nutzbare Exemplare minus
 * Bedarf anderer Projekte, deren Belegung sich mit dem Zeitraum überschneidet.
 */
export async function loadAvailability(
  productIds: readonly string[],
  window: { startsOn: Date | null; endsOn: Date | null },
  options: { excludeProjectId?: string; db?: Db } = {},
): Promise<Map<string, Availability>> {
  const db = options.db ?? prisma;
  const result = new Map<string, Availability>();
  if (!productIds.length) return result;
  const [products, lines] = await Promise.all([
    db.inventoryProduct.findMany({
      where: { id: { in: [...productIds] } },
      select: {
        id: true,
        kind: true,
        assets: {
          where: { status: { not: "retired" } },
          select: { status: true, quantity: true },
        },
      },
    }),
    window.startsOn && window.endsOn
      ? db.inventoryProjectLine.findMany({
          where: {
            productId: { in: [...productIds] },
            project: {
              status: { in: RESERVING_STATUSES },
              ...(options.excludeProjectId ? { id: { not: options.excludeProjectId } } : {}),
              startsOn: { lte: window.endsOn },
              endsOn: { gte: window.startsOn },
            },
          },
          select: {
            productId: true,
            quantity: true,
            project: {
              select: {
                id: true,
                publicId: true,
                title: true,
                status: true,
                startsOn: true,
                endsOn: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  for (const product of products) {
    const bulk = product.kind === "bulk";
    const usable = product.assets.filter((asset) =>
      (USABLE_STATUSES as readonly string[]).includes(asset.status),
    );
    const sum = (list: typeof product.assets) =>
      bulk ? list.reduce((total, asset) => total + asset.quantity, 0) : list.length;
    result.set(product.id, {
      capacity: sum(usable),
      total: sum(product.assets),
      reservations: [],
      confirmed: 0,
      requested: 0,
    });
  }
  for (const line of lines) {
    const entry = result.get(line.productId);
    if (!entry) continue;
    entry.reservations.push({
      projectId: line.project.id,
      publicId: line.project.publicId,
      title: line.project.title,
      status: line.project.status as ProjectStatus,
      quantity: line.quantity,
      startsOn: line.project.startsOn,
      endsOn: line.project.endsOn,
    });
    if (line.project.status === "confirmed") entry.confirmed += line.quantity;
    else entry.requested += line.quantity;
  }
  return result;
}

export type LineVerdict = "ok" | "tight" | "short";

/**
 * Ampel für eine Bedarfszeile: reicht es auch, wenn alle angefragten Projekte zusagen (ok), nur
 * gegen bestätigte (tight), oder fehlt schon jetzt etwas (short)?
 */
export function lineVerdict(quantity: number, availability: Availability | undefined): LineVerdict {
  if (!availability) return "short";
  const afterConfirmed = availability.capacity - availability.confirmed;
  if (quantity > afterConfirmed) return "short";
  if (quantity > afterConfirmed - availability.requested) return "tight";
  return "ok";
}

export type ProjectListFilter = { scope: "current" | "past" | "all"; query?: string };

export async function listInventoryProjects(filter: ProjectListFilter) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const query = filter.query?.trim();
  const where: Prisma.InventoryProjectWhereInput = {
    ...(filter.scope === "current"
      ? {
          status: { in: ["request", "confirmed"] },
          OR: [{ endsOn: null }, { endsOn: { gte: today } }],
        }
      : filter.scope === "past"
        ? {
            OR: [{ status: { in: ["done", "cancelled"] } }, { endsOn: { lt: today } }],
          }
        : {}),
    ...(query
      ? {
          AND: [
            {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { venue: { contains: query, mode: "insensitive" } },
                { contact: { name: { contains: query, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : {}),
  };
  const projects = await prisma.inventoryProject.findMany({
    where,
    orderBy:
      filter.scope === "past"
        ? [{ startsOn: { sort: "desc", nulls: "last" } }]
        : [{ startsOn: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      publicId: true,
      title: true,
      status: true,
      venue: true,
      startsOn: true,
      endsOn: true,
      leadName: true,
      contact: { select: { name: true } },
      lead: { select: { firstName: true, lastName: true, name: true } },
      show: { select: { year: true, title: true } },
      _count: { select: { lines: true } },
      lines: { select: { quantity: true } },
    },
  });
  return projects.map((project) => ({
    id: project.id,
    publicId: project.publicId,
    title: project.title,
    status: project.status as ProjectStatus,
    venue: project.venue,
    startsOn: project.startsOn,
    endsOn: project.endsOn,
    contactName: project.contact?.name ?? null,
    leadLabel: personLabel(project.lead) ?? project.leadName,
    showLabel: project.show ? `${project.show.year} · ${project.show.title ?? "Produktion"}` : null,
    lineCount: project._count.lines,
    pieces: project.lines.reduce((sum, line) => sum + line.quantity, 0),
  }));
}

export type InventoryProjectListItem = Awaited<ReturnType<typeof listInventoryProjects>>[number];

export function personLabel(
  person: { firstName: string | null; lastName: string | null; name: string | null } | null,
): string | null {
  if (!person) return null;
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.name;
}

export async function getInventoryProjectDetail(publicId: string) {
  const project = await prisma.inventoryProject.findUnique({
    where: { publicId },
    include: {
      contact: true,
      lead: { select: { id: true, firstName: true, lastName: true, name: true } },
      show: { select: { id: true, year: true, title: true } },
      phases: { orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }] },
      lines: {
        orderBy: [{ sortOrder: "asc" }],
        include: {
          product: {
            select: {
              id: true,
              publicId: true,
              name: true,
              kind: true,
              unit: true,
              categoryId: true,
              area: { select: { name: true, prefix: true } },
              photos: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
      checkouts: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });
  if (!project) return null;
  const [availability, categories] = await Promise.all([
    loadAvailability(
      project.lines.map((line) => line.productId),
      { startsOn: project.startsOn, endsOn: project.endsOn },
      { excludeProjectId: project.id },
    ),
    prisma.inventoryCategory.findMany({ select: { id: true, parentId: true, name: true } }),
  ]);
  return {
    ...project,
    status: project.status as ProjectStatus,
    leadLabel: personLabel(project.lead) ?? project.leadName,
    showLabel: project.show ? `${project.show.year} · ${project.show.title ?? "Produktion"}` : null,
    phases: project.phases.map((phase) => ({ ...phase, kind: phase.kind as PhaseKind })),
    lines: project.lines.map((line) => {
      const entry = availability.get(line.productId);
      return {
        id: line.id,
        quantity: line.quantity,
        note: line.note,
        product: {
          ...line.product,
          categoryPath: categoryPathLabel(categories, line.product.categoryId),
          photoId: line.product.photos[0]?.id ?? null,
        },
        availability: entry ?? null,
        verdict: project.startsOn ? lineVerdict(line.quantity, entry) : ("ok" as LineVerdict),
      };
    }),
  };
}

export type InventoryProjectDetail = NonNullable<
  Awaited<ReturnType<typeof getInventoryProjectDetail>>
>;

/** Auswahllisten fürs Projekt-Formular: Kunden, aktive Mitglieder, Produktionen. */
export async function loadProjectFormOptions() {
  const [contacts, users, shows] = await Promise.all([
    prisma.inventoryContact.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.user.findMany({
      where: { deactivatedAt: null, anonymizedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, name: true },
    }),
    prisma.show.findMany({
      where: { archivedAt: null },
      orderBy: { year: "desc" },
      take: 10,
      select: { id: true, year: true, title: true },
    }),
  ]);
  return {
    contacts: contacts.map((contact) => contact.name),
    members: users
      .map((user) => ({ id: user.id, label: personLabel(user) ?? "Ohne Namen" }))
      .filter((member) => member.label !== "Ohne Namen"),
    shows: shows.map((show) => ({
      id: show.id,
      label: `${show.year} · ${show.title ?? "Produktion"}`,
    })),
  };
}
