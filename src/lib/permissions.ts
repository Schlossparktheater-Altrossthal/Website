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
  departmentIds: string[];
};

// Shared keys for profile data gatekeeping
export const PROFILE_DATA_PERMISSION_KEYS = {
  measurements: "PRIVATE.PROFILE.MEASUREMENTS.MANAGE",
  sizes: "PRIVATE.PROFILE.SIZES.MANAGE",
  dietary: "PRIVATE.PROFILE.DIETARY.MANAGE",
} as const satisfies Record<"measurements" | "sizes" | "dietary", PermissionDefinition["key"]>;

// Registry of all permissions used by the app
export const DEFAULT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "PRIVATE.DASHBOARD.OVERVIEW.VIEW", label: "Mitglieder-Dashboard öffnen", category: "base" },
  { key: "PRIVATE.PROFILE.OWN.VIEW", label: "Profilbereich aufrufen", category: "base" },
  { key: "PRIVATE.INVENTORY.SCAN.USE", label: "Scanner & Check-in nutzen", category: "base" },
  {
    key: "PRIVATE.INVENTORY.STICKER.EXPORT",
    label: "Inventaraufkleber erstellen",
    description: "Druckfertige Inventaraufkleber mit QR-Codes erstellen und exportieren.",
    category: "base",
  },
  {
    key: "PRIVATE.INVENTORY.TECH.MANAGE",
    label: "Technik-Lager verwalten",
    description:
      "Gerätebestand, Ausgaben und Rückgaben im Techniklager koordinieren und nachverfolgen.",
    category: "planning",
  },
  {
    key: "PRIVATE.INVENTORY.COSTUME.MANAGE",
    label: "Kostüm-Lager verwalten",
    description:
      "Bestand des Kostümfundus pflegen, Größen kontrollieren und Pflegehinweise dokumentieren.",
    category: "planning",
  },
  {
    key: "PRIVATE.GALLERY.MEDIA.VIEW",
    label: "Archiv und Bilder öffnen",
    description:
      "Zugang zum Medienarchiv mit Jahrgangsordnern, Fotos und Videos im Mitgliederportal.",
    category: "self",
  },
  {
    key: "PRIVATE.GALLERY.MEDIA.UPLOAD",
    label: "Medien in Archiv und Bilder hochladen",
    description:
      "Eigene Fotos und Videos in Jahrgangsordnern ablegen sowie Beschreibungen ergänzen.",
    category: "self",
  },
  {
    key: "PRIVATE.GALLERY.MEDIA.DELETE",
    label: "Uploads im Archiv moderieren",
    description:
      "Fremde Beiträge löschen, Inhalte kuratieren und das Medienarchiv aufräumen.",
    category: "self",
  },
  {
    key: "PRIVATE.FILES.FOLDER.VIEW",
    label: "Dateisystem öffnen",
    description:
      "Greift auf das gemeinsame Dateisystem mit Ordnerstruktur, Dokumenten und Downloads zu.",
    category: "self",
  },
  {
    key: "PRIVATE.FILES.FOLDER.MANAGE",
    label: "Dateisystem verwalten",
    description:
      "Struktur und Zugriffsrechte des Dateisystems pflegen, Dateien moderieren und Freigaben steuern.",
    category: "membership",
  },
  {
    key: "PRIVATE.SUPPORT.ISSUE.VIEW",
    label: "Feedback & Support nutzen",
    description:
      "Anliegen, Probleme oder Verbesserungsvorschläge im Mitglieder-Issue-Board melden und einsehen.",
    category: "communication",
  },
  {
    key: "PRIVATE.SUPPORT.ISSUE.MANAGE",
    label: "Feedback-Anliegen verwalten",
    description: "Status, Priorität und Moderation für gemeldete Anliegen im Issue-Board übernehmen.",
    category: "communication",
  },
  {
    key: "PRIVATE.SUPPORT.NOTIFICATION.TEST",
    label: "Testbenachrichtigungen senden",
    description:
      "Versendet Test-Nachrichten (normal oder Notfall) an Mitglieder, um Benachrichtigungskanäle zu prüfen.",
    category: "communication",
  },
  {
    key: "PRIVATE.REHEARSAL.OWN.VIEW",
    label: "Eigene Probentermine einsehen",
    description: 'Zugang zum Bereich "Meine Termine" mit persönlichen Terminen und Fristen.',
    category: "self",
  },
  {
    key: "PRIVATE.DEPARTMENT.OWN.VIEW",
    label: "Gewerkeplanung einsehen",
    description:
      'Zugang zum Bereich "Gewerkeplanung" mit Aufgabenübersicht und Terminvorschlägen.',
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
  { key: "PRIVATE.REHEARSAL.PLANNING.MANAGE", label: "Probenplanung verwalten", category: "planning" },
  {
    key: "PRIVATE.REHEARSAL.MEALS.MANAGE",
    label: "Essensplanung koordinieren",
    description:
      "Zugang zum kulinarischen Cockpit für die Endprobenwoche: Ernährungsprofile bündeln, Allergien absichern und Menüs zusammenstellen.",
    category: "planning",
  },
  {
    key: "PRIVATE.REHEARSAL.FINALWEEK.VIEW",
    label: "Endprobenwoche einsehen",
    description:
      "Planungsübersicht für die finale Probenwoche mit Dienstplänen, Verpflegung und organisatorischen Hinweisen einsehen.",
    category: "planning",
  },
  {
    key: "PRIVATE.REHEARSAL.FINALWEEK.MANAGE",
    label: "Endprobenwoche koordinieren",
    description:
      "Dienstpläne der Endprobenwoche pflegen, Aufgaben hinzufügen und verantwortliche Mitglieder zuweisen.",
    category: "planning",
  },
  {
    key: "PRIVATE.PRODUCTION.SHOW.MANAGE",
    label: "Produktionsplanung öffnen",
    description:
      "Bereich zur Verwaltung von Gewerken, Besetzungen, Szenen und Breakdown-Aufgaben im Produktionsmanagement.",
    category: "planning",
  },
  { key: "PRIVATE.ADMIN.MEMBERS.MANAGE", label: "Mitgliederverwaltung öffnen", category: "membership" },
  {
    key: "PRIVATE.ADMIN.INVITES.MANAGE",
    label: "Einladungslinks verwalten",
    description: "Mehrfach nutzbare Einladungslinks anlegen, deaktivieren und deren Status prüfen.",
    category: "membership",
  },
  { key: "PRIVATE.ADMIN.PERMISSIONS.MANAGE", label: "Rechteverwaltung öffnen", category: "membership" },
  { key: "PRIVATE.REHEARSAL.BLOCKLIST.VIEW", label: "Sperrliste pflegen", category: "membership" },
  {
    key: "PRIVATE.REHEARSAL.BLOCKLIST.SETTINGS",
    label: "Sperrlisten-Einstellungen verwalten",
    description: "Ferienquelle, Vorlaufzeit und bevorzugte Probentage anpassen.",
    category: "membership",
  },
  {
    key: "PRIVATE.REHEARSAL.BLOCKLIST.EXPORT",
    label: "Sperrlisten-Export herunterladen",
    description:
      "CSV-Übersichten der nächsten zwei Wochen für die wichtigsten Probentage exportieren.",
    category: "membership",
  },
  {
    key: "PRIVATE.ADMIN.PAGES.MANAGE",
    label: "Pages verwalten",
    description:
      "Wartungsmodus, Seitensteuerung und Website-Bereiche im Mitgliederbereich verwalten.",
    category: "membership",
  },
  {
    key: "PRIVATE.WEBSITE.THEME.MANAGE",
    label: "Website-Einstellungen verwalten",
    description:
      "Theme-Farben, Branding und öffentliche Website-Parameter anpassen.",
    category: "membership",
  },
  {
    key: "PRIVATE.WEBSITE.COUNTDOWN.EDIT",
    label: "Premieren-Countdown verwalten",
    description: "Countdown zur ersten Aufführung auf der öffentlichen Startseite einstellen.",
    category: "membership",
  },
  {
    key: "PRIVATE.WEBSITE.CHRONIK.EDIT",
    label: "Chronik-Termine pflegen",
    description: "Aufführungstermine der öffentlichen Chronik direkt im Frontend bearbeiten.",
    category: "membership",
  },
  {
    key: "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE",
    label: "Fotoerlaubnisse verwalten",
    description: "Bereich zum Prüfen und Freigeben von Fotoeinverständniserklärungen.",
    category: "membership",
  },
  {
    key: "PRIVATE.MYSTERY.TIMER.EDIT",
    label: "Mystery-Timer bearbeiten",
    description: "Countdown und Hinweistext für das öffentliche Geheimnis pflegen.",
    category: "mystery",
  },
  {
    key: "PRIVATE.MYSTERY.PUZZLE.MANAGE",
    label: "Mystery-Rätsel verwalten",
    description: "Rätsel erstellen, bearbeiten und veröffentlichen.",
    category: "mystery",
  },
  {
    key: "PRIVATE.MYSTERY.TIPS.MANAGE",
    label: "Mystery-Tipps verwalten",
    description: "Community-Tipps moderieren und löschen.",
    category: "mystery",
  },
  {
    key: "PRIVATE.MYSTERY.SCOREBOARD.MANAGE",
    label: "Mystery-Scoreboard verwalten",
    description: "Punkte vergeben und Scoreboard-Einträge bearbeiten.",
    category: "mystery",
  },
  {
    key: "PRIVATE.MYSTERY.HINTS.MANAGE",
    label: "Mystery-Hinweise verwalten",
    description: "Hinweise freischalten und hinzufügen.",
    category: "mystery",
  },
  {
    key: "PRIVATE.FINANCE.ENTRY.VIEW",
    label: "Finanzbereich öffnen",
    description:
      "Dashboard für Einnahmen, Ausgaben, Rechnungen und Spenden im Mitgliederbereich einsehen.",
    category: "finances",
  },
  {
    key: "PRIVATE.FINANCE.ENTRY.MANAGE",
    label: "Finanzbuchungen verwalten",
    description:
      "Neue Finanzbuchungen anlegen, bearbeiten, Rechnungen erfassen und Spenden dokumentieren.",
    category: "finances",
  },
  {
    key: "PRIVATE.FINANCE.ENTRY.APPROVE",
    label: "Finanzbuchungen freigeben",
    description: "Prüfen und freigeben von Rechnungen, Auslagen und Auszahlungen im Finanzmodul.",
    category: "finances",
  },
  {
    key: "PRIVATE.FINANCE.ENTRY.EXPORT",
    label: "Finanzdaten exportieren",
    description: "CSV- oder Excel-Exporte der Finanzbuchungen und Budgetübersichten erstellen.",
    category: "finances",
  },
  {
    key: "PRIVATE.ADMIN.ONBOARDING.ANALYTICS",
    label: "Onboarding-Analytics öffnen",
    description: "Statistiken zum Einladungs- und Onboarding-Prozess einsehen.",
    category: "analytics",
  },
  {
    key: "PRIVATE.ADMIN.SERVER.SETTINGS",
    label: "Servereinstellungen verwalten",
    description: "SMTP-Server und technische Basisdienste konfigurieren.",
    category: "membership",
  },
  {
    key: "PRIVATE.ADMIN.SERVER.ANALYTICS",
    label: "Server-Statistiken einsehen",
    description: "Auslastung, Antwortzeiten und Nutzungsverhalten in der Server-Statistik abrufen.",
    category: "analytics",
  },
];

const DEFAULT_PERMISSION_KEYS = DEFAULT_PERMISSION_DEFINITIONS.map((def) => def.key);
const PERMISSION_KEY_SET = new Set(DEFAULT_PERMISSION_KEYS);

// Grouped permission helpers
const FINANCE_PERMISSION_KEYS = [
  "PRIVATE.FINANCE.ENTRY.VIEW",
  "PRIVATE.FINANCE.ENTRY.MANAGE",
  "PRIVATE.FINANCE.ENTRY.APPROVE",
  "PRIVATE.FINANCE.ENTRY.EXPORT",
] as const satisfies PermissionDefinition["key"][];

const FINANCE_BOARD_PERMISSION_KEYS = [
  "PRIVATE.FINANCE.ENTRY.VIEW",
  "PRIVATE.FINANCE.ENTRY.EXPORT",
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
  "PRIVATE.REHEARSAL.FINALWEEK.VIEW" as const satisfies PermissionDefinition["key"];

const FINAL_WEEK_VIEW_DEFAULT_ROLE_NAMES = [
  "member",
  "cast",
  "tech",
  "board",
  "finance",
] as const satisfies readonly Role[];

const FINAL_WEEK_MANAGE_PERMISSION_KEY =
  "PRIVATE.REHEARSAL.FINALWEEK.MANAGE" as const satisfies PermissionDefinition["key"];

const FINAL_WEEK_MANAGE_ROLE_NAMES = ["board"] as const satisfies readonly Role[];

// Baseline permissions that every authenticated user should retain even when not explicitly granted
const BASELINE_PERMISSION_KEYS = new Set([
  "PRIVATE.DASHBOARD.OVERVIEW.VIEW",
  "PRIVATE.PROFILE.OWN.VIEW",
  "PRIVATE.SUPPORT.ISSUE.VIEW",
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
    return { systemRoles: [], customRoleIds: [], departmentIds: [] };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      roles: { select: { role: true } },
      appRoles: { select: { roleId: true } },
      departmentMemberships: { select: { departmentId: true } },
    },
  });

  if (!dbUser) {
    return { systemRoles: [], customRoleIds: [], departmentIds: [] };
  }

  const systemRoles = sortRoles([
    dbUser.role as Role,
    ...dbUser.roles.map((entry) => entry.role as Role),
  ]);

  const customRoleIds = Array.from(new Set(dbUser.appRoles.map((entry) => entry.roleId)));

  const departmentIds = Array.from(
    new Set(dbUser.departmentMemberships.map((membership) => membership.departmentId)),
  );

  return { systemRoles, customRoleIds, departmentIds };
}

export type PermissionRoleContext = ResolvedRoleContext;

export async function getPermissionRoleContext(user: UserLike): Promise<PermissionRoleContext> {
  return resolveRoleContext(user);
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

  const { systemRoles, customRoleIds, departmentIds } = await resolveRoleContext(user);
  const owned = new Set(systemRoles);

  if (owned.has("owner") || owned.has("admin")) return true;

  if (getBaselinePermissions(user).has(permissionKey)) {
    return true;
  }

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  if (!systemRoles.length && !customRoleIds.length && !departmentIds.length) return false;

  const perm = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!perm) return false;

  if (departmentIds.length) {
    const departmentGrant = await prisma.departmentPermission.count({
      where: { permissionId: perm.id, departmentId: { in: departmentIds } },
    });
    if (departmentGrant > 0) {
      return true;
    }
  }

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
    return false;
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

  const { systemRoles, customRoleIds, departmentIds } = await resolveRoleContext(user);
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

  if (roleFilters.length) {
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
  }

  if (departmentIds.length) {
    const departmentPermissions = await prisma.departmentPermission.findMany({
      where: { departmentId: { in: departmentIds } },
      select: { permission: { select: { key: true } } },
    });

    for (const entry of departmentPermissions) {
      const key = entry.permission?.key;
      if (key && isKnownPermissionKey(key)) {
        granted.add(key);
      }
    }
  }

  return DEFAULT_PERMISSION_KEYS.filter((key) => granted.has(key));
}
