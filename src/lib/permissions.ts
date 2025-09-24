import { prisma } from "@/lib/prisma";
import { sortRoles, type Role } from "@/lib/roles";
import { Prisma } from "@prisma/client";

// Categories for permissions
type PermissionCategoryKey =
  | "base"
  | "communication"
  | "self"
  | "planning"
  | "membership"
  | "mystery"
  | "finances"
  | "analytics";

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategoryKey, string> = {
  base: "Basisbereiche & Start",
  communication: "Kommunikation & Support",
  self: "Persönliche Bereiche",
  planning: "Planung & Produktionen",
  membership: "Mitgliederverwaltung & Administration",
  mystery: "Community & Mystery",
  finances: "Finanzen & Controlling",
  analytics: "Onboarding & Analysen",
};

// Permission definition shape
type PermissionDefinition = {
  key: string;
  label: string;
  description?: string;
  category: PermissionCategoryKey;
};

// User-like object used across helpers
type UserLike = { id?: string; role?: Role; roles?: Role[] } | null | undefined;

// Role context resolved from DB
type ResolvedRoleContext = {
  systemRoles: Role[];
  customRoleIds: string[];
};

// Shared keys for profile data gatekeeping
export const PROFILE_DATA_PERMISSION_KEYS = {
  measurements: "mitglieder.koerpermasse",
  sizes: "mitglieder.konfektionsgroessen",
  dietary: "mitglieder.ernaehrungshinweise",
} as const satisfies Record<"measurements" | "sizes" | "dietary", PermissionDefinition["key"]>;

// Registry of all permissions used by the app
export const DEFAULT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "mitglieder.dashboard", label: "Mitglieder-Dashboard öffnen", category: "base" },
  { key: "mitglieder.profil", label: "Profilbereich aufrufen", category: "base" },
  { key: "mitglieder.scan", label: "Scanner & Check-in nutzen", category: "base" },
  {
    key: "mitglieder.galerie",
    label: "Archiv und Bilder öffnen",
    description:
      "Zugang zum Medienarchiv mit Jahrgangsordnern, Fotos und Videos im Mitgliederportal.",
    category: "self",
  },
  {
    key: "mitglieder.galerie.upload",
    label: "Medien in Archiv und Bilder hochladen",
    description:
      "Eigene Fotos und Videos in Jahrgangsordnern ablegen sowie Beschreibungen ergänzen.",
    category: "self",
  },
  {
    key: "mitglieder.galerie.delete",
    label: "Uploads im Archiv moderieren",
    description:
      "Fremde Beiträge löschen, Inhalte kuratieren und das Medienarchiv aufräumen.",
    category: "self",
  },
  {
    key: "mitglieder.issues",
    label: "Feedback & Support nutzen",
    description:
      "Anliegen, Probleme oder Verbesserungsvorschläge im Mitglieder-Issue-Board melden und einsehen.",
    category: "communication",
  },
  {
    key: "mitglieder.issues.manage",
    label: "Feedback-Anliegen verwalten",
    description: "Status, Priorität und Moderation für gemeldete Anliegen im Issue-Board übernehmen.",
    category: "communication",
  },
  {
    key: "mitglieder.notifications.test",
    label: "Testbenachrichtigungen senden",
    description:
      "Versendet Test-Nachrichten (normal oder Notfall) an Mitglieder, um Benachrichtigungskanäle zu prüfen.",
    category: "communication",
  },
  {
    key: "mitglieder.meine-proben",
    label: "Eigene Probentermine einsehen",
    description: 'Zugang zum Bereich "Meine Proben" mit persönlichen Terminen und Fristen.',
    category: "self",
  },
  {
    key: "mitglieder.meine-gewerke",
    label: "Eigene Gewerke einsehen",
    description:
      'Zugang zum Bereich "Meine Gewerke" mit Aufgabenübersicht und Terminvorschlägen.',
    category: "self",
  },
  {
    key: PROFILE_DATA_PERMISSION_KEYS.measurements,
    label: "Körpermaße verwalten",
    description:
      "Öffnet das Körpermaße-Control-Center für das Kostüm-Team, um alle Maße des Ensembles futuristisch zu überwachen, fehlende Angaben zu erkennen und Einträge live zu aktualisieren.",
    category: "self",
  },
  {
    key: PROFILE_DATA_PERMISSION_KEYS.sizes,
    label: "Konfektionsgrößen verwalten",
    description:
      "Erfasst und pflegt Konfektionsgrößen sowie zugehörige Passform-Notizen für Ensemble und Kostüm-Team.",
    category: "self",
  },
  {
    key: PROFILE_DATA_PERMISSION_KEYS.dietary,
    label: "Ernährungshinweise verwalten",
    description:
      "Einsicht und Pflege von Allergien, Unverträglichkeiten und Ernährungspräferenzen zur sicheren Verpflegung.",
    category: "self",
  },
  { key: "mitglieder.probenplanung", label: "Probenplanung verwalten", category: "planning" },
  {
    key: "mitglieder.essenplanung",
    label: "Essensplanung koordinieren",
    description:
      "Zugang zum kulinarischen Cockpit für die Endprobenwoche: Ernährungsprofile bündeln, Allergien absichern und Menüs zusammenstellen.",
    category: "planning",
  },
  {
    key: "mitglieder.endprobenwoche",
    label: "Endprobenwoche einsehen",
    description:
      "Planungsübersicht für die finale Probenwoche mit Dienstplänen, Verpflegung und organisatorischen Hinweisen einsehen.",
    category: "planning",
  },
  {
    key: "mitglieder.endprobenwoche.manage",
    label: "Endprobenwoche koordinieren",
    description:
      "Dienstpläne der Endprobenwoche pflegen, Aufgaben hinzufügen und verantwortliche Mitglieder zuweisen.",
    category: "planning",
  },
  {
    key: "mitglieder.produktionen",
    label: "Produktionsplanung öffnen",
    description:
      "Bereich zur Verwaltung von Gewerken, Besetzungen, Szenen und Breakdown-Aufgaben im Produktionsmanagement.",
    category: "planning",
  },
  { key: "mitglieder.rollenverwaltung", label: "Mitgliederverwaltung öffnen", category: "membership" },
  {
    key: "mitglieder.einladungen",
    label: "Einladungslinks verwalten",
    description: "Mehrfach nutzbare Einladungslinks anlegen, deaktivieren und deren Status prüfen.",
    category: "membership",
  },
  { key: "mitglieder.rechte", label: "Rechteverwaltung öffnen", category: "membership" },
  { key: "mitglieder.sperrliste", label: "Sperrliste pflegen", category: "membership" },
  {
    key: "mitglieder.sperrliste.settings",
    label: "Sperrlisten-Einstellungen verwalten",
    description: "Ferienquelle, Vorlaufzeit und bevorzugte Probentage anpassen.",
    category: "membership",
  },
  {
    key: "mitglieder.website.settings",
    label: "Website-Einstellungen verwalten",
    description:
      "Theme-Farben, Branding und öffentliche Website-Parameter anpassen.",
    category: "membership",
  },
  {
    key: "mitglieder.website.countdown",
    label: "Premieren-Countdown verwalten",
    description: "Countdown zur ersten Aufführung auf der öffentlichen Startseite einstellen.",
    category: "membership",
  },
  {
    key: "mitglieder.website.chronik",
    label: "Chronik-Termine pflegen",
    description: "Aufführungstermine der öffentlichen Chronik direkt im Frontend bearbeiten.",
    category: "membership",
  },
  {
    key: "mitglieder.fotoerlaubnisse",
    label: "Fotoerlaubnisse verwalten",
    description: "Bereich zum Prüfen und Freigeben von Fotoeinverständniserklärungen.",
    category: "membership",
  },
  {
    key: "mitglieder.mystery.timer",
    label: "Mystery-Timer verwalten",
    description: "Countdown und Hinweistext für das öffentliche Geheimnis pflegen.",
    category: "mystery",
  },
  {
    key: "mitglieder.mystery.tips",
    label: "Mystery-Tipps verwalten",
    description: "Community-Tipps nach Rätsel auswerten und Punkte für richtige Ideen vergeben.",
    category: "mystery",
  },
  {
    key: "mitglieder.finanzen",
    label: "Finanzbereich öffnen",
    description:
      "Dashboard für Einnahmen, Ausgaben, Rechnungen und Spenden im Mitgliederbereich einsehen.",
    category: "finances",
  },
  {
    key: "mitglieder.finanzen.manage",
    label: "Finanzbuchungen verwalten",
    description:
      "Neue Finanzbuchungen anlegen, bearbeiten, Rechnungen erfassen und Spenden dokumentieren.",
    category: "finances",
  },
  {
    key: "mitglieder.finanzen.approve",
    label: "Finanzbuchungen freigeben",
    description: "Prüfen und freigeben von Rechnungen, Auslagen und Auszahlungen im Finanzmodul.",
    category: "finances",
  },
  {
    key: "mitglieder.finanzen.export",
    label: "Finanzdaten exportieren",
    description: "CSV- oder Excel-Exporte der Finanzbuchungen und Budgetübersichten erstellen.",
    category: "finances",
  },
  {
    key: "mitglieder.onboarding.analytics",
    label: "Onboarding-Analytics öffnen",
    description: "Statistiken zum Einladungs- und Onboarding-Prozess einsehen.",
    category: "analytics",
  },
  {
    key: "mitglieder.server.analytics",
    label: "Server-Statistiken einsehen",
    description: "Auslastung, Antwortzeiten und Nutzungsverhalten in der Server-Statistik abrufen.",
    category: "analytics",
  },
];

const DEFAULT_PERMISSION_KEYS = DEFAULT_PERMISSION_DEFINITIONS.map((def) => def.key);
const PERMISSION_KEY_SET = new Set(DEFAULT_PERMISSION_KEYS);

// Grouped permission helpers
const FINANCE_PERMISSION_KEYS = [
  "mitglieder.finanzen",
  "mitglieder.finanzen.manage",
  "mitglieder.finanzen.approve",
  "mitglieder.finanzen.export",
] as const satisfies PermissionDefinition["key"][];

const FINANCE_BOARD_PERMISSION_KEYS = [
  "mitglieder.finanzen",
  "mitglieder.finanzen.export",
] as const satisfies PermissionDefinition["key"][];

const MEASUREMENT_PERMISSION_KEY = PROFILE_DATA_PERMISSION_KEYS.measurements;

const PROFILE_ADMIN_PERMISSION_KEYS = [
  PROFILE_DATA_PERMISSION_KEYS.sizes,
  PROFILE_DATA_PERMISSION_KEYS.dietary,
] as const satisfies PermissionDefinition["key"][];

const MEASUREMENT_DEFAULT_ROLE_NAMES = [
  "member",
  "cast",
  "tech",
  "board",
  "finance",
] as const satisfies readonly Role[];

const FINAL_WEEK_VIEW_PERMISSION_KEY =
  "mitglieder.endprobenwoche" as const satisfies PermissionDefinition["key"];

const FINAL_WEEK_VIEW_DEFAULT_ROLE_NAMES = [
  "member",
  "cast",
  "tech",
  "board",
  "finance",
] as const satisfies readonly Role[];

const FINAL_WEEK_MANAGE_PERMISSION_KEY =
  "mitglieder.endprobenwoche.manage" as const satisfies PermissionDefinition["key"];

const FINAL_WEEK_MANAGE_ROLE_NAMES = ["board"] as const satisfies readonly Role[];

// Baseline permissions that every authenticated user should retain even when not explicitly granted
const BASELINE_PERMISSION_KEYS = new Set([
  "mitglieder.dashboard",
  "mitglieder.profil",
  "mitglieder.issues",
] satisfies PermissionDefinition["key"][]);

let ensurePermissionsPromise: Promise<void> | null = null;
let ensureSystemRolesPromise: Promise<void> | null = null;

async function runEnsurePermissionDefinitions() {
  const operations = DEFAULT_PERMISSION_DEFINITIONS.map((definition) =>
    prisma.permission.upsert({
      where: { key: definition.key },
      update: {
        label: definition.label,
        description: definition.description ?? null,
      },
      create: {
        key: definition.key,
        label: definition.label,
        description: definition.description ?? null,
      },
    }),
  );
  await prisma.$transaction(operations);
  await prisma.permission.deleteMany({ where: { key: { notIn: Array.from(PERMISSION_KEY_SET) } } });
  await ensureFinanceRoleDefaultAssignments();
  await ensureMeasurementRoleDefaultAssignments();
  await ensureProfileAdminDefaultAssignments();
  await ensureFinalWeekRoleDefaultAssignments();
}

export async function ensurePermissionDefinitions() {
  if (!ensurePermissionsPromise) {
    ensurePermissionsPromise = runEnsurePermissionDefinitions().catch((error) => {
      ensurePermissionsPromise = null;
      throw error;
    });
  }
  await ensurePermissionsPromise;
}

export function isKnownPermissionKey(key: string) {
  return PERMISSION_KEY_SET.has(key);
}

async function runEnsureSystemRoles() {
  const coreRoles: { role: Role; isSystem: boolean }[] = [
    { role: "member", isSystem: false },
    { role: "cast", isSystem: false },
    { role: "tech", isSystem: false },
    { role: "board", isSystem: false },
    { role: "finance", isSystem: false },
    { role: "owner", isSystem: true },
    { role: "admin", isSystem: true },
  ];

  await prisma.$transaction(
    coreRoles.map(({ role, isSystem }) =>
      prisma.appRole.upsert({
        where: { name: role },
        update: { systemRole: role, isSystem },
        create: { name: role, systemRole: role, isSystem },
      }),
    ),
  );
}

export async function ensureSystemRoles() {
  if (!ensureSystemRolesPromise) {
    ensureSystemRolesPromise = runEnsureSystemRoles().catch((error) => {
      ensureSystemRolesPromise = null;
      throw error;
    });
  }
  await ensureSystemRolesPromise;
}

async function ensureFinanceRoleDefaultAssignments() {
  await ensureSystemRoles();

  const permissionKeys = Array.from(
    new Set<string>([...FINANCE_PERMISSION_KEYS, ...FINANCE_BOARD_PERMISSION_KEYS]),
  );

  const [roles, permissions] = await Promise.all([
    prisma.appRole.findMany({ where: { name: { in: ["finance", "board"] } } }),
    prisma.permission.findMany({ where: { key: { in: permissionKeys } } }),
  ]);

  if (!roles.length || !permissions.length) return;

  const permissionMap = new Map(permissions.map((perm) => [perm.key, perm.id]));
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  const financeRole = roles.find((role) => role.name === "finance");
  if (financeRole) {
    for (const key of FINANCE_PERMISSION_KEYS) {
      const permissionId = permissionMap.get(key);
      if (!permissionId) continue;
      operations.push(
        prisma.appRolePermission.upsert({
          where: { roleId_permissionId: { roleId: financeRole.id, permissionId } },
          update: {},
          create: { roleId: financeRole.id, permissionId },
        }),
      );
    }
  }

  const boardRole = roles.find((role) => role.name === "board");
  if (boardRole) {
    for (const key of FINANCE_BOARD_PERMISSION_KEYS) {
      const permissionId = permissionMap.get(key);
      if (!permissionId) continue;
      operations.push(
        prisma.appRolePermission.upsert({
          where: { roleId_permissionId: { roleId: boardRole.id, permissionId } },
          update: {},
          create: { roleId: boardRole.id, permissionId },
        }),
      );
    }
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }
}

async function ensureMeasurementRoleDefaultAssignments() {
  await ensureSystemRoles();

  const [permission, roles] = await Promise.all([
    prisma.permission.findUnique({ where: { key: MEASUREMENT_PERMISSION_KEY } }),
    prisma.appRole.findMany({ where: { name: { in: Array.from(MEASUREMENT_DEFAULT_ROLE_NAMES) } } }),
  ]);

  if (!permission || roles.length === 0) {
    return;
  }

  const operations: Prisma.PrismaPromise<unknown>[] = roles.map((role) =>
    prisma.appRolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    }),
  );

  if (operations.length) {
    await prisma.$transaction(operations);
  }
}

async function ensureProfileAdminDefaultAssignments() {
  await ensureSystemRoles();

  const [role, permissions] = await Promise.all([
    prisma.appRole.findUnique({ where: { name: "board" } }),
    prisma.permission.findMany({ where: { key: { in: Array.from(PROFILE_ADMIN_PERMISSION_KEYS) } } }),
  ]);

  if (!role || permissions.length === 0) {
    return;
  }

  const permissionMap = new Map(permissions.map((permission) => [permission.key, permission.id]));
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const key of PROFILE_ADMIN_PERMISSION_KEYS) {
    const permissionId = permissionMap.get(key);
    if (!permissionId) continue;

    operations.push(
      prisma.appRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      }),
    );
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }
}

async function ensureFinalWeekRoleDefaultAssignments() {
  await ensureSystemRoles();

  const roleNames = Array.from(
    new Set<string>([...FINAL_WEEK_VIEW_DEFAULT_ROLE_NAMES, ...FINAL_WEEK_MANAGE_ROLE_NAMES]),
  );

  const [viewPermission, managePermission, roles] = await Promise.all([
    prisma.permission.findUnique({ where: { key: FINAL_WEEK_VIEW_PERMISSION_KEY } }),
    prisma.permission.findUnique({ where: { key: FINAL_WEEK_MANAGE_PERMISSION_KEY } }),
    prisma.appRole.findMany({ where: { name: { in: roleNames } } }),
  ]);

  if ((!viewPermission && !managePermission) || roles.length === 0) {
    return;
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  if (viewPermission) {
    const viewRoles = new Set<Role>(FINAL_WEEK_VIEW_DEFAULT_ROLE_NAMES);
    for (const role of roles) {
      const roleName = role.name as Role;
      if (!viewRoles.has(roleName)) continue;
      operations.push(
        prisma.appRolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: viewPermission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: viewPermission.id },
        }),
      );
    }
  }

  if (managePermission) {
    const manageRoles = new Set<Role>(FINAL_WEEK_MANAGE_ROLE_NAMES);
    for (const role of roles) {
      const roleName = role.name as Role;
      if (!manageRoles.has(roleName)) continue;
      operations.push(
        prisma.appRolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: managePermission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: managePermission.id },
        }),
      );
    }
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }
}

async function resolveRoleContext(user: UserLike): Promise<ResolvedRoleContext> {
  if (!user?.id) {
    return { systemRoles: [], customRoleIds: [] };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      roles: { select: { role: true } },
      appRoles: { select: { roleId: true } },
    },
  });

  if (!dbUser) {
    return { systemRoles: [], customRoleIds: [] };
  }

  const systemRoles = sortRoles([
    dbUser.role as Role,
    ...dbUser.roles.map((entry) => entry.role as Role),
  ]);

  const customRoleIds = Array.from(new Set(dbUser.appRoles.map((entry) => entry.roleId)));

  return { systemRoles, customRoleIds };
}

function getBaselinePermissions(user: UserLike) {
  const granted = new Set<string>();
  if (!user?.id) return granted;

  for (const key of BASELINE_PERMISSION_KEYS) {
    if (PERMISSION_KEY_SET.has(key)) {
      granted.add(key);
    }
  }

  return granted;
}

export async function hasPermission(user: UserLike, permissionKey: string): Promise<boolean> {
  if (!user?.id) return false;
  if (!isKnownPermissionKey(permissionKey)) return false;

  const { systemRoles, customRoleIds } = await resolveRoleContext(user);
  const owned = new Set(systemRoles);

  if (owned.has("owner") || owned.has("admin")) return true;

  if (getBaselinePermissions(user).has(permissionKey)) {
    return true;
  }

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  if (!systemRoles.length && !customRoleIds.length) return false;

  const perm = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!perm) return false;

  const roleFilters: Prisma.AppRolePermissionWhereInput[] = [];
  if (systemRoles.length) {
    roleFilters.push({
      role: {
        OR: [
          { systemRole: { in: systemRoles } },
          { name: { in: systemRoles } },
        ],
      },
    });
  }
  if (customRoleIds.length) {
    roleFilters.push({ roleId: { in: customRoleIds } });
  }

  const rolePermissions = await prisma.appRolePermission.count({
    where: {
      permissionId: perm.id,
      OR: roleFilters,
    },
  });

  return rolePermissions > 0;
}

export async function getUserPermissionKeys(user: UserLike): Promise<string[]> {
  if (!user?.id) return [];

  const { systemRoles, customRoleIds } = await resolveRoleContext(user);
  const owned = new Set(systemRoles);

  if (owned.has("owner") || owned.has("admin")) {
    return [...DEFAULT_PERMISSION_KEYS];
  }

  const granted = getBaselinePermissions(user);

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  const roleFilters: Prisma.AppRolePermissionWhereInput[] = [];
  if (systemRoles.length) {
    roleFilters.push({
      role: {
        OR: [
          { systemRole: { in: systemRoles } },
          { name: { in: systemRoles } },
        ],
      },
    });
  }
  if (customRoleIds.length) {
    roleFilters.push({ roleId: { in: customRoleIds } });
  }

  if (!roleFilters.length) {
    return DEFAULT_PERMISSION_KEYS.filter((key) => granted.has(key));
  }

  const rolePermissions = await prisma.appRolePermission.findMany({
    where: { OR: roleFilters },
    select: { permission: { select: { key: true } } },
  });

  for (const entry of rolePermissions) {
    const key = entry.permission?.key;
    if (key && isKnownPermissionKey(key)) {
      granted.add(key);
    }
  }

  return DEFAULT_PERMISSION_KEYS.filter((key) => granted.has(key));
}
