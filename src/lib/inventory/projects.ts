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
  /** Andere Projekte im selben Zeitraum (bei Sets: die ihrer Bestandteile). */
  reservations: Reservation[];
  /** Fest (bestätigt) bzw. weich (angefragt) belegt. */
  confirmed: number;
  requested: number;
  /** Nur bei Sets: Bestandteile mit Menge je Set und ihrer eigenen Verfügbarkeit. */
  components?: { productId: string; name: string; quantity: number; availability: Availability }[];
};

type ComponentRow = { setId: string; componentId: string; quantity: number; name: string };

/** Bestandteile von Sets (Set-ID → Liste). */
async function loadComponents(db: Db, setIds: readonly string[]) {
  const map = new Map<string, ComponentRow[]>();
  if (!setIds.length) return map;
  const rows = await db.inventoryProductComponent.findMany({
    where: { setId: { in: [...setIds] } },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      setId: true,
      componentId: true,
      quantity: true,
      component: { select: { name: true } },
    },
  });
  for (const row of rows) {
    const list = map.get(row.setId) ?? [];
    list.push({
      setId: row.setId,
      componentId: row.componentId,
      quantity: row.quantity,
      name: row.component.name,
    });
    map.set(row.setId, list);
  }
  return map;
}

/**
 * Verfügbarkeit je Artikeltyp für einen Zeitraum. Gezählt werden nutzbare Exemplare minus
 * Bedarf anderer Projekte, deren Belegung sich mit dem Zeitraum überschneidet. Sets werden auf
 * ihre Bestandteile heruntergerechnet – auch die Sets anderer Projekte belegen Bestandteile.
 */
export async function loadAvailability(
  productIds: readonly string[],
  window: { startsOn: Date | null; endsOn: Date | null },
  options: { excludeProjectId?: string; db?: Db } = {},
): Promise<Map<string, Availability>> {
  const db = options.db ?? prisma;
  const result = new Map<string, Availability>();
  if (!productIds.length) return result;

  const requested = await db.inventoryProduct.findMany({
    where: { id: { in: [...productIds] } },
    select: { id: true, kind: true },
  });
  const requestedSets = requested.filter((product) => product.kind === "set").map((p) => p.id);
  const ownComponents = await loadComponents(db, requestedSets);
  const baseIds = new Set<string>();
  for (const product of requested) {
    if (product.kind === "set") {
      for (const component of ownComponents.get(product.id) ?? [])
        baseIds.add(component.componentId);
    } else {
      baseIds.add(product.id);
    }
  }

  // Sets, in denen diese Grundtypen stecken – deren Projektzeilen belegen sie mit.
  const usage = await db.inventoryProductComponent.findMany({
    where: { componentId: { in: [...baseIds] } },
    select: { setId: true },
  });
  const relatedSets = [...new Set(usage.map((entry) => entry.setId))];
  const setComponents = await loadComponents(db, relatedSets);

  const [products, lines] = await Promise.all([
    db.inventoryProduct.findMany({
      where: { id: { in: [...baseIds] } },
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
            productId: { in: [...baseIds, ...relatedSets] },
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

  const base = new Map<string, Availability>();
  for (const product of products) {
    const bulk = product.kind === "bulk";
    const usable = product.assets.filter((asset) =>
      (USABLE_STATUSES as readonly string[]).includes(asset.status),
    );
    const sum = (list: typeof product.assets) =>
      bulk ? list.reduce((total, asset) => total + asset.quantity, 0) : list.length;
    base.set(product.id, {
      capacity: sum(usable),
      total: sum(product.assets),
      reservations: [],
      confirmed: 0,
      requested: 0,
    });
  }
  const book = (
    productId: string,
    quantity: number,
    project: (typeof lines)[number]["project"],
  ) => {
    const entry = base.get(productId);
    if (!entry) return;
    const existing = entry.reservations.find((item) => item.projectId === project.id);
    if (existing) existing.quantity += quantity;
    else {
      entry.reservations.push({
        projectId: project.id,
        publicId: project.publicId,
        title: project.title,
        status: project.status as ProjectStatus,
        quantity,
        startsOn: project.startsOn,
        endsOn: project.endsOn,
      });
    }
    if (project.status === "confirmed") entry.confirmed += quantity;
    else entry.requested += quantity;
  };
  for (const line of lines) {
    const components = setComponents.get(line.productId);
    if (components) {
      for (const component of components) {
        book(component.componentId, line.quantity * component.quantity, line.project);
      }
    } else {
      book(line.productId, line.quantity, line.project);
    }
  }

  for (const product of requested) {
    if (product.kind !== "set") {
      const entry = base.get(product.id);
      if (entry) result.set(product.id, entry);
      continue;
    }
    const components = (ownComponents.get(product.id) ?? []).map((component) => ({
      productId: component.componentId,
      name: component.name,
      quantity: component.quantity,
      availability: base.get(component.componentId) ?? {
        capacity: 0,
        total: 0,
        reservations: [],
        confirmed: 0,
        requested: 0,
      },
    }));
    // Ein Set ist so oft verfügbar, wie sein knappster Bestandteil es zulässt.
    const sets = (pick: (entry: Availability) => number) =>
      components.length
        ? Math.min(
            ...components.map((component) =>
              Math.floor(pick(component.availability) / component.quantity),
            ),
          )
        : 0;
    const capacity = sets((entry) => entry.capacity);
    const afterConfirmed = sets((entry) => entry.capacity - entry.confirmed);
    const afterRequested = sets((entry) => entry.capacity - entry.confirmed - entry.requested);
    const reservations = new Map<string, Reservation>();
    for (const component of components) {
      for (const reservation of component.availability.reservations) {
        if (!reservations.has(reservation.projectId)) {
          reservations.set(reservation.projectId, { ...reservation });
        }
      }
    }
    result.set(product.id, {
      capacity,
      total: sets((entry) => entry.total),
      reservations: [...reservations.values()],
      confirmed: capacity - afterConfirmed,
      requested: afterConfirmed - afterRequested,
      components,
    });
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
  // Eigenbedarf je Grundtyp: direkte Zeilen plus Bestandteile von Sets zusammengezählt.
  const own = new Map<string, number>();
  for (const line of project.lines) {
    const components = availability.get(line.productId)?.components;
    if (components) {
      for (const component of components) {
        own.set(
          component.productId,
          (own.get(component.productId) ?? 0) + component.quantity * line.quantity,
        );
      }
    } else {
      own.set(line.productId, (own.get(line.productId) ?? 0) + line.quantity);
    }
  }
  const order: LineVerdict[] = ["ok", "tight", "short"];
  const worst = (verdicts: LineVerdict[]) =>
    verdicts.reduce<LineVerdict>(
      (current, next) => (order.indexOf(next) > order.indexOf(current) ? next : current),
      "ok",
    );
  const verdictFor = (productId: string): LineVerdict => {
    const entry = availability.get(productId);
    if (!entry) return "short";
    if (entry.components) {
      return entry.components.length
        ? worst(
            entry.components.map((component) =>
              lineVerdict(own.get(component.productId) ?? 0, component.availability),
            ),
          )
        : "short";
    }
    return lineVerdict(own.get(productId) ?? 0, entry);
  };

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
        verdict: project.startsOn ? verdictFor(line.productId) : ("ok" as LineVerdict),
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
