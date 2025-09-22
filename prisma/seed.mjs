import {
  PrismaClient,
  DepartmentMembershipRole,
  CharacterCastingType,
  BreakdownStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import chronikAltrossthal from "../src/data/chronik-altrossthal.json" assert { type: "json" };
const prisma = new PrismaClient();

function splitFullName(value) {
  if (!value) return { firstName: null, lastName: null };
  const trimmed = value.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  if (trimmed.includes(",")) {
    const [lastPart, firstPart] = trimmed.split(",", 2);
    return {
      firstName: (firstPart ?? "").trim() || null,
      lastName: (lastPart ?? "").trim() || null,
    };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  const [first, ...rest] = parts;
  return {
    firstName: first,
    lastName: rest.join(" ") || null,
  };
}

function combineName(firstName, lastName) {
  const parts = [];
  if (typeof firstName === "string" && firstName.trim()) {
    parts.push(firstName.trim());
  }
  if (typeof lastName === "string" && lastName.trim()) {
    parts.push(lastName.trim());
  }
  return parts.length ? parts.join(" ") : null;
}

async function main() {
  // --- Chronik: use ONLY the provided Altroßthal data below ---

  // Altroßthal data provided (curated demo -> replace with real assets later)
  const altData = Array.isArray(chronikAltrossthal) ? chronikAltrossthal : [];

  for (const d of altData) {
    const id = `altrossthal-${d.year}`;
    const meta = {
      author: d.author ?? null,
      director: d.director ?? null,
      venue: d.location ?? null,
      organizer: d.organizer ?? null,
      sources: d.sources ?? [],
      evidence: d.evidence_snippets ?? [],
      quotes: d.press_quotes ?? [],
      gallery: d.images ?? [],
      ticket_info: d.ticket_info ?? null,
      transport: d.transport ?? null,
      cast: d.cast ?? null,
    };
    const revealedAt = new Date(`${d.year}-06-01T12:00:00Z`);
    await prisma.show.upsert({
      where: { id },
      update: {
        year: d.year,
        title: d.title,
        synopsis: d.author ? `${d.author}` : null,
        dates: d.dates ?? null,
        posterUrl: d.posterUrl ?? `https://picsum.photos/seed/${d.year}/800/1200`,
        revealedAt,
        meta,
      },
      create: {
        id,
        year: d.year,
        title: d.title,
        synopsis: d.author ? `${d.author}` : null,
        dates: d.dates ?? null,
        posterUrl: d.posterUrl ?? `https://picsum.photos/seed/${d.year}/800/1200`,
        revealedAt,
        meta,
      },
    });
  }

  // Remove demo shows not in provided list
  const keepIds = altData.map((d) => `altrossthal-${d.year}`);
  await prisma.show.deleteMany({
    where: {
      OR: [
        { id: "seed-show" },
        {
          AND: [
            { id: { startsWith: "altrossthal-" } },
            { NOT: { id: { in: keepIds } } },
          ],
        },
      ],
    },
  });

  const emails = [
    "member@example.com",
    "cast@example.com",
    "tech@example.com",
    "board@example.com",
    "finance@example.com",
    "admin@example.com",
    "owner@example.com",
  ];
  const roles = ["member", "cast", "tech", "board", "finance", "admin", "owner"];
  const defaultPasswordHash = await bcrypt.hash("password", 10);

  for (let i = 0; i < emails.length; i++) {
    const friendlyName = emails[i].split("@")[0] ?? "";
    const normalizedName = friendlyName.replace(/[._-]+/g, " ");
    const { firstName, lastName } = splitFullName(normalizedName);
    const displayName = combineName(firstName, lastName);

    await prisma.user.upsert({
      where: { email: emails[i] },
      update: {
        firstName,
        lastName,
        name: displayName,
        passwordHash: defaultPasswordHash,
      },
      create: {
        email: emails[i],
        firstName,
        lastName,
        name: displayName,
        role: roles[i],
        passwordHash: defaultPasswordHash,
      },
    });
    const userRecord = await prisma.user.findUnique({ where: { email: emails[i] } });
    if (userRecord) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: userRecord.id, role: roles[i] } },
        update: {},
        create: { userId: userRecord.id, role: roles[i] },
      });
    }
  }

  const latestShow = await prisma.show.findFirst({ orderBy: { year: "desc" } });
  const referenceYear = latestShow?.year ?? new Date().getUTCFullYear();

  const financeBudgetSeeds = [
    {
      id: "seed-budget-costumes",
      category: "Kostüme & Requisiten",
      plannedAmount: 1500,
      currency: "EUR",
      notes: "Materialien, Leihen und Reinigung",
      showId: latestShow?.id ?? null,
    },
    {
      id: "seed-budget-marketing",
      category: "Marketing & Druck",
      plannedAmount: 800,
      currency: "EUR",
      notes: "Flyer, Plakate und Social Ads",
      showId: latestShow?.id ?? null,
    },
  ];

  for (const budget of financeBudgetSeeds) {
    await prisma.financeBudget.upsert({
      where: { id: budget.id },
      update: {
        category: budget.category,
        plannedAmount: budget.plannedAmount,
        currency: budget.currency,
        notes: budget.notes,
        showId: budget.showId,
      },
      create: budget,
    });
  }

  const financePermissionSeeds = [
    {
      key: "mitglieder.finanzen",
      label: "Finanzbereich öffnen",
      description: "Dashboard für Einnahmen, Ausgaben, Rechnungen und Spenden im Mitgliederbereich einsehen.",
    },
    {
      key: "mitglieder.finanzen.manage",
      label: "Finanzbuchungen verwalten",
      description: "Neue Finanzbuchungen anlegen, bearbeiten, Rechnungen erfassen und Spenden dokumentieren.",
    },
    {
      key: "mitglieder.finanzen.approve",
      label: "Finanzbuchungen freigeben",
      description: "Prüfen und freigeben von Rechnungen, Auslagen und Auszahlungen im Finanzmodul.",
    },
    {
      key: "mitglieder.finanzen.export",
      label: "Finanzdaten exportieren",
      description: "CSV- oder Excel-Exporte der Finanzbuchungen und Budgetübersichten erstellen.",
    },
  ];

  for (const perm of financePermissionSeeds) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { label: perm.label, description: perm.description },
      create: perm,
    });
  }

  const systemAppRoles = [
    { name: "member", systemRole: "member", isSystem: false },
    { name: "cast", systemRole: "cast", isSystem: false },
    { name: "tech", systemRole: "tech", isSystem: false },
    { name: "board", systemRole: "board", isSystem: false },
    { name: "finance", systemRole: "finance", isSystem: false },
    { name: "admin", systemRole: "admin", isSystem: true },
    { name: "owner", systemRole: "owner", isSystem: true },
  ];

  for (const role of systemAppRoles) {
    await prisma.appRole.upsert({
      where: { name: role.name },
      update: { systemRole: role.systemRole, isSystem: role.isSystem },
      create: role,
    });
  }

  const measurementPermission = await prisma.permission.upsert({
    where: { key: "mitglieder.koerpermasse" },
    update: {
      label: "Körpermaße verwalten",
      description:
        "Öffnet das Körpermaße-Control-Center für das Kostüm-Team, um alle Maße des Ensembles futuristisch zu überwachen, fehlende Angaben zu erkennen und Einträge live zu aktualisieren.",
    },
    create: {
      key: "mitglieder.koerpermasse",
      label: "Körpermaße verwalten",
      description:
        "Öffnet das Körpermaße-Control-Center für das Kostüm-Team, um alle Maße des Ensembles futuristisch zu überwachen, fehlende Angaben zu erkennen und Einträge live zu aktualisieren.",
    },
  });

  const measurementRoleNames = ["member", "cast", "tech", "board", "finance"];
  const measurementRoles = await prisma.appRole.findMany({
    where: { name: { in: measurementRoleNames } },
  });

  for (const role of measurementRoles) {
    await prisma.appRolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: measurementPermission.id } },
      update: {},
      create: { roleId: role.id, permissionId: measurementPermission.id },
    });
  }

  const financePermissionKeys = financePermissionSeeds.map((perm) => perm.key);
  const boardPermissionKeys = ["mitglieder.finanzen", "mitglieder.finanzen.export"];

  const [financeRole, boardRole, financePermissions] = await Promise.all([
    prisma.appRole.findUnique({ where: { name: "finance" } }),
    prisma.appRole.findUnique({ where: { name: "board" } }),
    prisma.permission.findMany({ where: { key: { in: financePermissionKeys } } }),
  ]);

  const permissionMap = new Map(financePermissions.map((perm) => [perm.key, perm.id]));

  if (financeRole) {
    for (const key of financePermissionKeys) {
      const permissionId = permissionMap.get(key);
      if (!permissionId) continue;
      await prisma.appRolePermission.upsert({
        where: { roleId_permissionId: { roleId: financeRole.id, permissionId } },
        update: {},
        create: { roleId: financeRole.id, permissionId },
      });
    }
  }

  if (boardRole) {
    for (const key of boardPermissionKeys) {
      const permissionId = permissionMap.get(key);
      if (!permissionId) continue;
      await prisma.appRolePermission.upsert({
        where: { roleId_permissionId: { roleId: boardRole.id, permissionId } },
        update: {},
        create: { roleId: boardRole.id, permissionId },
      });
    }
  }

  const [financeUser, boardUser, memberUser, castUser, financeBudgets] = await Promise.all([
    prisma.user.findUnique({ where: { email: "finance@example.com" } }),
    prisma.user.findUnique({ where: { email: "board@example.com" } }),
    prisma.user.findUnique({ where: { email: "member@example.com" } }),
    prisma.user.findUnique({ where: { email: "cast@example.com" } }),
    prisma.financeBudget.findMany({ where: { id: { in: financeBudgetSeeds.map((budget) => budget.id) } } }),
  ]);

  const budgetMap = new Map(financeBudgets.map((budget) => [budget.id, budget.id]));

  const financeEntrySeeds = [
    {
      id: "seed-finance-invoice-costumes",
      data: {
        title: "Erstattung Stoffe für Kostüme",
        description: "Auslage für Stoffe und Kurzwaren der diesjährigen Produktion.",
        type: "expense",
        kind: "invoice",
        status: "approved",
        amount: 320.45,
        currency: "EUR",
        category: "Kostüme",
        bookingDate: new Date(Date.UTC(referenceYear, 2, 18, 9, 15)),
        dueDate: new Date(Date.UTC(referenceYear, 2, 31, 8, 0)),
        paidAt: null,
        invoiceNumber: "KOST-" + referenceYear + "-05",
        vendor: "Stoff & Faden Dresden",
        memberPaidById: castUser?.id ?? memberUser?.id ?? null,
        donationSource: null,
        donorContact: null,
        tags: null,
        showId: latestShow?.id ?? null,
        budgetId: budgetMap.get("seed-budget-costumes") ?? null,
        visibilityScope: "finance",
        createdById: financeUser?.id ?? boardUser?.id ?? memberUser?.id ?? null,
        approvedById: boardUser?.id ?? financeUser?.id ?? null,
        approvedAt: new Date(Date.UTC(referenceYear, 2, 20, 10, 0)),
        attachments: [
          {
            filename: "Beleg-Stoffe.pdf",
            url: "https://example.com/seed/stoffe.pdf",
            mimeType: "application/pdf",
            size: 245678,
          },
        ],
        logs: [
          { fromStatus: null, toStatus: "pending", changedById: financeUser?.id ?? null, note: null },
          {
            fromStatus: "pending",
            toStatus: "approved",
            changedById: boardUser?.id ?? financeUser?.id ?? null,
            note: "Vorstand hat die Auslage freigegeben",
          },
        ],
      },
    },
    {
      id: "seed-finance-donation-sparkasse",
      data: {
        title: "Spende Sparkasse Kulturstiftung",
        description: "Projektförderung für Öffentlichkeitsarbeit und Nachwuchsarbeit.",
        type: "income",
        kind: "donation",
        status: "approved",
        amount: 1200,
        currency: "EUR",
        category: "Förderungen",
        bookingDate: new Date(Date.UTC(referenceYear, 3, 5, 10, 30)),
        dueDate: null,
        paidAt: new Date(Date.UTC(referenceYear, 3, 8, 8, 30)),
        invoiceNumber: null,
        vendor: "Sparkasse Kulturstiftung",
        memberPaidById: null,
        donationSource: "Sparkasse Kulturstiftung",
        donorContact: "kultur@sparkasse.example",
        tags: null,
        showId: latestShow?.id ?? null,
        budgetId: budgetMap.get("seed-budget-marketing") ?? null,
        visibilityScope: "board",
        createdById: financeUser?.id ?? boardUser?.id ?? null,
        approvedById: boardUser?.id ?? financeUser?.id ?? null,
        approvedAt: new Date(Date.UTC(referenceYear, 3, 6, 9, 0)),
        attachments: [],
        logs: [
          { fromStatus: null, toStatus: "pending", changedById: financeUser?.id ?? null, note: null },
          {
            fromStatus: "pending",
            toStatus: "approved",
            changedById: boardUser?.id ?? financeUser?.id ?? null,
            note: "Freigabe des Spendeneingangs",
          },
        ],
      },
    },
    {
      id: "seed-finance-expense-marketing",
      data: {
        title: "Druckkosten Plakate",
        description: "Großformatige Plakate für den Schlosspark und Schulen im Umfeld.",
        type: "expense",
        kind: "general",
        status: "paid",
        amount: 540,
        currency: "EUR",
        category: "Marketing",
        bookingDate: new Date(Date.UTC(referenceYear, 4, 2, 12, 0)),
        dueDate: new Date(Date.UTC(referenceYear, 4, 12, 12, 0)),
        paidAt: new Date(Date.UTC(referenceYear, 4, 9, 14, 30)),
        invoiceNumber: "MKT-" + referenceYear + "-11",
        vendor: "Druckerei Altstadt",
        memberPaidById: null,
        donationSource: null,
        donorContact: null,
        tags: null,
        showId: latestShow?.id ?? null,
        budgetId: budgetMap.get("seed-budget-marketing") ?? null,
        visibilityScope: "finance",
        createdById: financeUser?.id ?? boardUser?.id ?? null,
        approvedById: financeUser?.id ?? boardUser?.id ?? null,
        approvedAt: new Date(Date.UTC(referenceYear, 4, 5, 8, 45)),
        attachments: [
          {
            filename: "Rechnung-Plakate.pdf",
            url: "https://example.com/seed/plakate.pdf",
            mimeType: "application/pdf",
            size: 198765,
          },
        ],
        logs: [
          { fromStatus: null, toStatus: "draft", changedById: financeUser?.id ?? null, note: null },
          {
            fromStatus: "draft",
            toStatus: "approved",
            changedById: financeUser?.id ?? null,
            note: "Selbstfreigabe im kleinen Budgetrahmen",
          },
          {
            fromStatus: "approved",
            toStatus: "paid",
            changedById: financeUser?.id ?? null,
            note: "Rechnung wurde überwiesen",
          },
        ],
      },
    },
  ];

  for (const entry of financeEntrySeeds) {
    const { attachments, logs, ...entryData } = entry.data;
    const attachmentUpdate = attachments.length
      ? { deleteMany: {}, create: attachments }
      : { deleteMany: {} };
    const attachmentCreate = attachments.length ? { create: attachments } : null;
    await prisma.financeEntry.upsert({
      where: { id: entry.id },
      update: {
        ...entryData,
        attachments: attachmentUpdate,
        logs: { deleteMany: {}, create: logs },
      },
      create: {
        id: entry.id,
        ...entryData,
        ...(attachmentCreate ? { attachments: attachmentCreate } : {}),
        logs: { create: logs },
      },
    });
  }

  const departmentSeeds = [
    {
      slug: "schauspiel",
      name: "Schauspiel",
      color: "#9333ea",
      description: "Ensemble, Rollenplanung und Probenteilnehmer.",
    },
    {
      slug: "buehnenbild",
      name: "Bühnenbild",
      color: "#0ea5e9",
      description: "Kulissen, Aufbauten und Umbauten.",
    },
    {
      slug: "technik",
      name: "Technik",
      color: "#1d4ed8",
      description: "Gesamtkoordination für Licht, Ton und Bühne.",
    },
    {
      slug: "maske",
      name: "Maske",
      color: "#f97316",
      description: "Make-up, Haare und Spezialeffekte.",
    },
    {
      slug: "kostuem",
      name: "Kostüm",
      color: "#f59e0b",
      description: "Kostümplanung, Anproben und Pflege.",
    },
    {
      slug: "licht",
      name: "Licht",
      color: "#22d3ee",
      description: "Lichtdesign, Einleuchten und Cues.",
    },
    {
      slug: "ton",
      name: "Ton",
      color: "#6366f1",
      description: "Sounddesign, Einspielungen und Mikrofonierung.",
    },
    {
      slug: "requisite",
      name: "Requisite",
      color: "#16a34a",
      description: "Requisitenbeschaffung, Vorbereitung und Pflege.",
    },
    {
      slug: "werbung-social",
      name: "Werbung & Social Media",
      color: "#ec4899",
      description: "Kommunikation, Öffentlichkeitsarbeit und Social Media.",
    },
  ];

  for (const dept of departmentSeeds) {
    await prisma.department.upsert({
      where: { slug: dept.slug },
      update: {
        name: dept.name,
        description: dept.description ?? null,
        color: dept.color ?? null,
        isCore: true,
      },
      create: {
        slug: dept.slug,
        name: dept.name,
        description: dept.description ?? null,
        color: dept.color ?? null,
        isCore: true,
      },
    });
  }

  const membershipSeeds = [
    {
      departmentSlug: "schauspiel",
      email: "cast@example.com",
      role: DepartmentMembershipRole.lead,
      title: "Spielleitung",
    },
    {
      departmentSlug: "technik",
      email: "tech@example.com",
      role: DepartmentMembershipRole.lead,
      title: "Technische Leitung",
    },
    {
      departmentSlug: "licht",
      email: "tech@example.com",
      role: DepartmentMembershipRole.member,
    },
    {
      departmentSlug: "ton",
      email: "tech@example.com",
      role: DepartmentMembershipRole.member,
    },
    {
      departmentSlug: "buehnenbild",
      email: "board@example.com",
      role: DepartmentMembershipRole.lead,
    },
    {
      departmentSlug: "kostuem",
      email: "member@example.com",
      role: DepartmentMembershipRole.member,
    },
    {
      departmentSlug: "maske",
      email: "member@example.com",
      role: DepartmentMembershipRole.member,
    },
  ];

  for (const membership of membershipSeeds) {
    const department = await prisma.department.findUnique({ where: { slug: membership.departmentSlug } });
    const user = await prisma.user.findUnique({ where: { email: membership.email } });
    if (!department || !user) continue;

    await prisma.departmentMembership.upsert({
      where: { departmentId_userId: { departmentId: department.id, userId: user.id } },
      update: {
        role: membership.role,
        title: membership.title ?? null,
        note: membership.note ?? null,
      },
      create: {
        departmentId: department.id,
        userId: user.id,
        role: membership.role,
        title: membership.title ?? null,
        note: membership.note ?? null,
      },
    });
  }

  // Link a sample rehearsal to the newest chronik show (if present)
  const newest = await prisma.show.findFirst({ orderBy: { year: "desc" } });
  if (newest) {
    await prisma.rehearsal.upsert({
      where: { id: `rehearsal-${newest.id}` },
      update: {},
      create: {
        id: `rehearsal-${newest.id}`,
        showId: newest.id,
        start: new Date(Date.now() + 1000 * 60 * 60 * 24),
        end: new Date(Date.now() + 1000 * 60 * 60 * 26),
        location: "Schlosspark",
        requiredRoles: ["cast", "tech"],
      },
    });

    const seedRehearsalId = `rehearsal-${newest.id}`;
    const existingLogs = await prisma.rehearsalAttendanceLog.count({
      where: { rehearsalId: seedRehearsalId },
    });

    if (existingLogs === 0) {
      const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
      if (adminUser) {
        const defaultTargets = await prisma.user.findMany({
          where: { role: { in: ["member", "cast", "tech"] } },
          select: { id: true },
        });

        for (const target of defaultTargets) {
          await prisma.rehearsalAttendanceLog.create({
            data: {
              rehearsalId: seedRehearsalId,
              userId: target.id,
              next: null,
              comment: "Initial: automatisch eingeplant",
              changedById: adminUser.id,
            },
          });
        }
      }
    }

    const [primaryCast, coverCast, techLead] = await Promise.all([
      prisma.user.findUnique({ where: { email: "cast@example.com" }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: "member@example.com" }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: "tech@example.com" }, select: { id: true } }),
    ]);

    const characterSeeds = [
      {
        id: `${newest.id}-char-protagonist`,
        name: "Protagonist:in",
        shortName: "Prota",
        description: "Hauptfigur, steht im Zentrum der Handlung.",
        color: "#7c3aed",
        order: 1,
      },
      {
        id: `${newest.id}-char-mentor`,
        name: "Mentor:in",
        shortName: "Mentor",
        description: "Unterstützt die Hauptfigur und liefert Exposition.",
        color: "#2563eb",
        order: 2,
      },
    ];

    for (const character of characterSeeds) {
      await prisma.character.upsert({
        where: { id: character.id },
        update: {
          name: character.name,
          shortName: character.shortName ?? null,
          description: character.description ?? null,
          notes: character.notes ?? null,
          color: character.color ?? null,
          order: character.order ?? 0,
        },
        create: {
          id: character.id,
          showId: newest.id,
          name: character.name,
          shortName: character.shortName ?? null,
          description: character.description ?? null,
          notes: character.notes ?? null,
          color: character.color ?? null,
          order: character.order ?? 0,
        },
      });
    }

    if (primaryCast) {
      await prisma.characterCasting.upsert({
        where: {
          characterId_userId_type: {
            characterId: `${newest.id}-char-protagonist`,
            userId: primaryCast.id,
            type: CharacterCastingType.primary,
          },
        },
        update: { notes: "Primärbesetzung" },
        create: {
          characterId: `${newest.id}-char-protagonist`,
          userId: primaryCast.id,
          type: CharacterCastingType.primary,
          notes: "Primärbesetzung",
        },
      });
    }

    if (coverCast) {
      await prisma.characterCasting.upsert({
        where: {
          characterId_userId_type: {
            characterId: `${newest.id}-char-protagonist`,
            userId: coverCast.id,
            type: CharacterCastingType.cover,
          },
        },
        update: { notes: "Zweitbesetzung" },
        create: {
          characterId: `${newest.id}-char-protagonist`,
          userId: coverCast.id,
          type: CharacterCastingType.cover,
          notes: "Zweitbesetzung",
        },
      });

      await prisma.characterCasting.upsert({
        where: {
          characterId_userId_type: {
            characterId: `${newest.id}-char-mentor`,
            userId: coverCast.id,
            type: CharacterCastingType.primary,
          },
        },
        update: { notes: "Primärbesetzung" },
        create: {
          characterId: `${newest.id}-char-mentor`,
          userId: coverCast.id,
          type: CharacterCastingType.primary,
          notes: "Primärbesetzung",
        },
      });
    }

    if (techLead) {
      await prisma.characterCasting.upsert({
        where: {
          characterId_userId_type: {
            characterId: `${newest.id}-char-mentor`,
            userId: techLead.id,
            type: CharacterCastingType.cameo,
          },
        },
        update: { notes: "Cameo-Auftritt Technik" },
        create: {
          characterId: `${newest.id}-char-mentor`,
          userId: techLead.id,
          type: CharacterCastingType.cameo,
          notes: "Cameo-Auftritt Technik",
        },
      });
    }

    const sceneSeeds = [
      {
        id: `${newest.id}-scene-1`,
        identifier: "1",
        title: "Ankunft im Schlosspark",
        summary: "Die Figuren treffen sich zum Auftakt der Probe.",
        location: "Schlosspark",
        timeOfDay: "Abend",
        sequence: 1,
        durationMinutes: 8,
      },
      {
        id: `${newest.id}-scene-2`,
        identifier: "2",
        title: "Das geheime Labor",
        summary: "Ein Technik- und Bühnenbild-Setup mit Spezialeffekten.",
        location: "Labor",
        timeOfDay: "Nacht",
        sequence: 2,
        durationMinutes: 12,
      },
    ];

    for (const scene of sceneSeeds) {
      const base = (scene.identifier ?? scene.title ?? scene.id).toString();
      const slugCandidate = base
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const slug = slugCandidate || `${scene.id}-scene`;

      await prisma.scene.upsert({
        where: { id: scene.id },
        update: {
          identifier: scene.identifier ?? null,
          title: scene.title ?? null,
          summary: scene.summary ?? null,
          location: scene.location ?? null,
          timeOfDay: scene.timeOfDay ?? null,
          sequence: scene.sequence ?? 0,
          durationMinutes: scene.durationMinutes ?? null,
          slug,
        },
        create: {
          id: scene.id,
          showId: newest.id,
          identifier: scene.identifier ?? null,
          title: scene.title ?? null,
          summary: scene.summary ?? null,
          location: scene.location ?? null,
          timeOfDay: scene.timeOfDay ?? null,
          sequence: scene.sequence ?? 0,
          durationMinutes: scene.durationMinutes ?? null,
          slug,
        },
      });
    }

    const sceneAssignments = [
      {
        sceneId: `${newest.id}-scene-1`,
        characterId: `${newest.id}-char-protagonist`,
        isFeatured: true,
        order: 1,
      },
      {
        sceneId: `${newest.id}-scene-1`,
        characterId: `${newest.id}-char-mentor`,
        isFeatured: false,
        order: 2,
      },
      {
        sceneId: `${newest.id}-scene-2`,
        characterId: `${newest.id}-char-protagonist`,
        isFeatured: true,
        order: 1,
      },
      {
        sceneId: `${newest.id}-scene-2`,
        characterId: `${newest.id}-char-mentor`,
        isFeatured: true,
        order: 2,
      },
    ];

    for (const assignment of sceneAssignments) {
      await prisma.sceneCharacter.upsert({
        where: {
          sceneId_characterId: {
            sceneId: assignment.sceneId,
            characterId: assignment.characterId,
          },
        },
        update: {
          isFeatured: assignment.isFeatured ?? false,
          order: assignment.order ?? 0,
        },
        create: {
          sceneId: assignment.sceneId,
          characterId: assignment.characterId,
          isFeatured: assignment.isFeatured ?? false,
          order: assignment.order ?? 0,
        },
      });
    }

    const breakdownDepartments = await prisma.department.findMany({
      where: { slug: { in: ["buehnenbild", "technik", "licht", "maske"] } },
      select: { id: true, slug: true },
    });
    const breakdownMap = new Map(breakdownDepartments.map((entry) => [entry.slug, entry.id]));

    const breakdownSeeds = [
      {
        id: `${newest.id}-scene-1-set`,
        sceneId: `${newest.id}-scene-1`,
        departmentSlug: "buehnenbild",
        title: "Parkbank und Laternen aufbauen",
        description: "Eine Holzbank, zwei LED-Laternen, Moosteppich.",
        status: BreakdownStatus.planned,
      },
      {
        id: `${newest.id}-scene-1-light`,
        sceneId: `${newest.id}-scene-1`,
        departmentSlug: "licht",
        title: "Warmton-Einleuchten",
        description: "Stufenlinsen 2×, Amber-Folie, sanfter Fade-in.",
        status: BreakdownStatus.ready,
        assignedToId: techLead?.id ?? null,
      },
      {
        id: `${newest.id}-scene-2-props`,
        sceneId: `${newest.id}-scene-2`,
        departmentSlug: "technik",
        title: "Nebelmaschine vorbereiten",
        description: "Fluid prüfen, Funkempfänger testen.",
        status: BreakdownStatus.in_progress,
        assignedToId: techLead?.id ?? null,
      },
      {
        id: `${newest.id}-scene-2-makeup`,
        sceneId: `${newest.id}-scene-2`,
        departmentSlug: "maske",
        title: "Schminken Mentor",
        description: "Leichte Alterungsschminke, silberne Haarsträhne.",
        status: BreakdownStatus.planned,
      },
    ];

    for (const item of breakdownSeeds) {
      const departmentId = breakdownMap.get(item.departmentSlug);
      if (!departmentId) continue;

      await prisma.sceneBreakdownItem.upsert({
        where: { id: item.id },
        update: {
          title: item.title,
          description: item.description ?? null,
          status: item.status ?? BreakdownStatus.planned,
          assignedToId: item.assignedToId ?? null,
        },
        create: {
          id: item.id,
          sceneId: item.sceneId,
          departmentId,
          title: item.title,
          description: item.description ?? null,
          status: item.status ?? BreakdownStatus.planned,
          assignedToId: item.assignedToId ?? null,
        },
      });
    }
  }

  // Create default rehearsal templates
  const defaultTemplates = [
    {
      id: "weekend-saturday",
      name: "Samstag Probe",
      description: "Standard Samstag-Probe",
      weekday: 6, // Samstag
      startTime: "14:00",
      endTime: "17:00",
      location: "Schlosspark Altroßthal",
      requiredRoles: ["cast", "tech"],
      priority: "NORMAL",
      isActive: true
    },
    {
      id: "weekend-sunday",
      name: "Sonntag Probe",
      description: "Standard Sonntag-Probe",
      weekday: 0, // Sonntag
      startTime: "14:00",
      endTime: "17:00",
      location: "Schlosspark Altroßthal",
      requiredRoles: ["cast", "tech"],
      priority: "NORMAL",
      isActive: true
    },
    {
      id: "tech-rehearsal",
      name: "Technik-Probe",
      description: "Technische Probe vor Aufführungen",
      weekday: 5, // Freitag
      startTime: "18:00",
      endTime: "21:00",
      location: "Schlosspark Altroßthal",
      requiredRoles: ["cast", "tech"],
      priority: "HIGH",
      isActive: false // Nur bei Bedarf aktivieren
    }
  ];

  for (const template of defaultTemplates) {
    await prisma.rehearsalTemplate.upsert({
      where: { id: template.id },
      update: template,
      create: template
    });
  }

  // Seed a few availability entries/templates for a test user
  const seedUser = await prisma.user.findFirst({ where: { email: "member@example.com" } });
  if (seedUser) {
    const base = new Date();
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth(); // 0-based
    // A few specific days
    const mkDate = (day) => new Date(Date.UTC(y, m, day));
    await prisma.availabilityDay.createMany({
      data: [
        { userId: seedUser.id, date: mkDate(5), kind: "FULL_AVAILABLE", note: "frei" },
        { userId: seedUser.id, date: mkDate(6), kind: "FULL_UNAVAILABLE", note: "Familie" },
        { userId: seedUser.id, date: mkDate(7), kind: "PARTIAL", availableFromMin: 17 * 60, availableToMin: 20 * 60, note: "nach der Arbeit" },
      ],
      skipDuplicates: true,
    });
    // Simple weekday template (Mo–Fr abends verfügbar)
    await prisma.availabilityTemplate.createMany({
      data: [1, 2, 3, 4, 5].map((wd) => ({
        userId: seedUser.id,
        weekday: wd,
        kind: "PARTIAL",
        availableFromMin: 18 * 60,
        availableToMin: 21 * 60,
      })),
      skipDuplicates: true,
    });
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
