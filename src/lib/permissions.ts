import { prisma } from "@/lib/prisma";
import { currentDepartmentMembershipWhere } from "@/lib/produktionen/status";
import { ROLE_LABELS, isAdminRole, sortRoles, type Role } from "@/lib/roles";
import { Prisma } from "@prisma/client";
import { isProductionRole } from "@/lib/produktionen/production-role-keys";

// Categories for permissions
type PermissionCategoryKey =
  | "base"
  | "rehearsal"
  | "department"
  | "pages"
  | "admin"
  | "analytics"
  | "communication"
  | "services";

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategoryKey, string> = {
  base: "Allgemeines",
  rehearsal: "Proben",
  department: "Gewerke",
  pages: "Pages",
  admin: "Verwaltung",
  analytics: "Analysen",
  communication: "Kommunikation",
  services: "Dienste",
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
  {
    key: "PRIVATE.DASHBOARD.OVERVIEW.VIEW",
    label: "Mitglieder-Dashboard öffnen",
    category: "base",
  },
  { key: "PRIVATE.PROFILE.OWN.VIEW", label: "Profilbereich aufrufen", category: "base" },
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
    description:
      "Status, Priorität und Moderation für gemeldete Anliegen im Issue-Board übernehmen.",
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
    category: "rehearsal",
  },
  {
    key: "PRIVATE.DEPARTMENT.OWN.VIEW",
    label: "Gewerkeplanung einsehen",
    description: 'Zugang zum Bereich "Gewerkeplanung" mit Aufgabenübersicht und Terminvorschlägen.',
    category: "department",
  },
  {
    key: PROFILE_DATA_PERMISSION_KEYS.measurements,
    label: "Körpermaße verwalten",
    description:
      "Öffnet das Körpermaße-Control-Center für das Kostüm-Team, um alle Maße des Ensembles futuristisch zu überwachen, fehlende Angaben zu erkennen und Einträge live zu aktualisieren.",
    category: "department",
  },
  {
    key: PROFILE_DATA_PERMISSION_KEYS.sizes,
    label: "Konfektionsgrößen verwalten",
    description:
      "Erfasst und pflegt Konfektionsgrößen sowie zugehörige Passform-Notizen für Ensemble und Kostüm-Team.",
    category: "department",
  },
  {
    key: PROFILE_DATA_PERMISSION_KEYS.dietary,
    label: "Ernährungshinweise verwalten",
    description:
      "Einsicht und Pflege von Allergien, Unverträglichkeiten und Ernährungspräferenzen zur sicheren Verpflegung.",
    category: "department",
  },
  {
    key: "PRIVATE.REHEARSAL.PLANNING.MANAGE",
    label: "Probenplanung verwalten",
    category: "rehearsal",
  },
  {
    key: "PRIVATE.PRODUCTION.SHOW.MANAGE",
    label: "Produktionsplanung öffnen",
    description:
      "Bereich zur Verwaltung von Gewerken, Besetzungen, Szenen und Breakdown-Aufgaben im Produktionsmanagement.",
    category: "pages",
  },
  { key: "PRIVATE.ADMIN.MEMBERS.MANAGE", label: "Mitgliederverwaltung öffnen", category: "admin" },
  {
    key: "PRIVATE.ADMIN.INVITES.MANAGE",
    label: "Einladungslinks verwalten",
    description: "Mehrfach nutzbare Einladungslinks anlegen, deaktivieren und deren Status prüfen.",
    category: "admin",
  },
  { key: "PRIVATE.ADMIN.PERMISSIONS.MANAGE", label: "Rechteverwaltung öffnen", category: "admin" },
  { key: "PRIVATE.REHEARSAL.BLOCKLIST.VIEW", label: "Sperrliste pflegen", category: "rehearsal" },
  {
    key: "PRIVATE.REHEARSAL.BLOCKLIST.SETTINGS",
    label: "Sperrlisten-Einstellungen verwalten",
    description: "Ferienquelle, Vorlaufzeit und bevorzugte Probentage anpassen.",
    category: "rehearsal",
  },
  {
    key: "PRIVATE.REHEARSAL.BLOCKLIST.EXPORT",
    label: "Sperrlisten-Export herunterladen",
    description:
      "CSV-Übersichten der nächsten zwei Wochen für die wichtigsten Probentage exportieren.",
    category: "rehearsal",
  },
  {
    key: "PRIVATE.ADMIN.PAGES.MANAGE",
    label: "Pages verwalten",
    description:
      "Wartungsmodus, Seitensteuerung und Website-Bereiche im Mitgliederbereich verwalten.",
    category: "pages",
  },
  {
    key: "PRIVATE.SETTINGS.THEME.MANAGE",
    label: "Website-Einstellungen verwalten",
    description: "Theme-Farben, Branding und öffentliche Website-Parameter anpassen.",
    category: "pages",
  },
  {
    key: "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE",
    label: "Fotoerlaubnisse verwalten",
    description: "Bereich zum Prüfen und Freigeben von Fotoeinverständniserklärungen.",
    category: "admin",
  },
  {
    key: "PRIVATE.DATA.PORTAL.VIEW",
    label: "Datenportal öffnen",
    description:
      "Auswertungen zu Teilnehmenden einer Produktion erstellen und ansehen (Basisfelder wie Name, Rolle, Funktion).",
    category: "analytics",
  },
  {
    key: "PRIVATE.DATA.PORTAL.EXPORT",
    label: "Datenportal: Export",
    description: "Auswertungen als CSV oder XLSX herunterladen.",
    category: "analytics",
  },
  {
    key: "PRIVATE.DATA.PORTAL.EDUCATION",
    label: "Datenportal: Schule und Alter",
    description:
      "Felder zu Schule, Klasse, Ausbildung, Geschlecht und Geburtsdatum/Alter auswerten.",
    category: "analytics",
  },
  {
    key: "PRIVATE.DATA.PORTAL.HEALTH",
    label: "Datenportal: Allergien und Ernährung",
    description:
      "Gesundheitsbezogene Felder (Allergien, Unverträglichkeiten, Ernährung) auswerten. Besondere Datenkategorie nach DSGVO Art. 9.",
    category: "analytics",
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
    category: "admin",
  },
  {
    key: "PRIVATE.ADMIN.SERVER.ANALYTICS",
    label: "Server-Statistiken einsehen",
    description: "Auslastung, Antwortzeiten und Nutzungsverhalten in der Server-Statistik abrufen.",
    category: "analytics",
  },
  // Zugriff auf weitere Theater-Dienste per Single Sign-on. Der Mitgliederbereich
  // gleicht diese Rechte mit Authentik-Gruppen ab (siehe lib/authentik/service-groups.ts);
  // welche Gruppe welchen Dienst öffnet, steht im Authentik-Blueprint.
  {
    key: "SSO.NEXTCLOUD.ACCESS",
    label: "Nextcloud nutzen",
    description:
      "Anmeldung an der Theater-Nextcloud mit dem Mitglieder-Konto (eigener Speicher 100 MB plus Sommertheater-Freigabe).",
    category: "services",
  },
];

const DEFAULT_PERMISSION_KEYS = DEFAULT_PERMISSION_DEFINITIONS.map((def) => def.key);
const PERMISSION_KEY_SET = new Set(DEFAULT_PERMISSION_KEYS);

// Grouped permission helpers

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
  await ensureMeasurementRoleDefaultAssignments();
  await ensureProfileAdminDefaultAssignments();
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

async function ensureMeasurementRoleDefaultAssignments() {
  await ensureSystemRoles();

  const [permission, roles] = await Promise.all([
    prisma.permission.findUnique({ where: { key: MEASUREMENT_PERMISSION_KEY } }),
    prisma.appRole.findMany({
      where: { name: { in: Array.from(MEASUREMENT_DEFAULT_ROLE_NAMES) } },
    }),
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
    prisma.permission.findMany({
      where: { key: { in: Array.from(PROFILE_ADMIN_PERMISSION_KEYS) } },
    }),
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

/**
 * Rechte, die nur in einer bestimmten Produktion gelten (Phase 2). Wird bei der Prüfung eine
 * `showId` übergeben, zählen Produktionsrollen (Ensemble, Technik) nur aus der Mitgliedschaft
 * in genau dieser Produktion. Globale Rollen (Vorstand, Finanzen, eigene Rollen, Gewerke)
 * wirken weiterhin in allen Produktionen, Owner/Admin haben immer alles (Entscheidung E4).
 */
export const PRODUCTION_SCOPED_PERMISSION_KEYS: ReadonlySet<string> = new Set([
  "PRIVATE.REHEARSAL.PLANNING.MANAGE",
  "PRIVATE.REHEARSAL.BLOCKLIST.VIEW",
  "PRIVATE.REHEARSAL.BLOCKLIST.SETTINGS",
  "PRIVATE.REHEARSAL.BLOCKLIST.EXPORT",
  "PRIVATE.DATA.PORTAL.VIEW",
  "PRIVATE.DATA.PORTAL.EXPORT",
  "PRIVATE.DATA.PORTAL.EDUCATION",
  "PRIVATE.DATA.PORTAL.HEALTH",
]);

export function isProductionScopedPermission(key: string): boolean {
  return PRODUCTION_SCOPED_PERMISSION_KEYS.has(key);
}

/**
 * Systemrollen für eine Prüfung im Kontext einer Produktion: globale Rollen ohne die
 * (global gespiegelten) Produktionsrollen, plus die Rollen aus der Mitgliedschaft dieser
 * Produktion (`null` = nicht dabei).
 */
export function scopeSystemRolesToProduction(
  globalRoles: readonly Role[],
  membershipRoles: readonly Role[] | null,
): Role[] {
  return sortRoles([
    ...globalRoles.filter((role) => !isProductionRole(role)),
    ...(membershipRoles ?? []).filter((role) => isProductionRole(role)),
  ]);
}

type PermissionCheckOptions = {
  /** Produktion, in deren Kontext geprüft wird; wirkt nur bei produktionsbezogenen Rechten. */
  showId?: string | null;
};

async function resolveRoleContext(
  user: UserLike,
  showId?: string | null,
): Promise<ResolvedRoleContext> {
  if (!user?.id) {
    return { systemRoles: [], customRoleIds: [], departmentIds: [] };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      roles: { select: { role: true } },
      appRoles: { select: { roleId: true } },
      departmentMemberships: {
        where: currentDepartmentMembershipWhere(),
        select: { departmentId: true },
      },
    },
  });

  if (!dbUser) {
    return { systemRoles: [], customRoleIds: [], departmentIds: [] };
  }

  let systemRoles = sortRoles([
    dbUser.role as Role,
    ...dbUser.roles.map((entry) => entry.role as Role),
  ]);

  if (showId && !isAdminRole(new Set(systemRoles))) {
    const membership = await prisma.productionMembership.findFirst({
      where: { userId: user.id, showId, leftAt: null, status: { not: "left" } },
      select: { roles: true },
    });
    systemRoles = scopeSystemRolesToProduction(
      systemRoles,
      membership ? (membership.roles as Role[]) : null,
    );
  }

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

function buildRoleFilter(
  systemRoles: Role[],
  customRoleIds: string[],
): Prisma.AppRolePermissionWhereInput[] {
  const roleFilters: Prisma.AppRolePermissionWhereInput[] = [];
  if (systemRoles.length) {
    roleFilters.push({
      role: {
        OR: [{ systemRole: { in: systemRoles } }, { name: { in: systemRoles } }],
      },
    });
  }
  if (customRoleIds.length) {
    roleFilters.push({ roleId: { in: customRoleIds } });
  }
  return roleFilters;
}

export async function hasPermission(
  user: UserLike,
  permissionKey: string,
  options?: PermissionCheckOptions,
): Promise<boolean> {
  if (!user?.id) return false;
  if (!isKnownPermissionKey(permissionKey)) return false;

  const scopedShowId = isProductionScopedPermission(permissionKey) ? options?.showId : null;
  const { systemRoles, customRoleIds, departmentIds } = await resolveRoleContext(
    user,
    scopedShowId,
  );
  const owned = new Set(systemRoles);

  if (isAdminRole(owned)) return true;

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

  const roleFilters = buildRoleFilter(systemRoles, customRoleIds);

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

  if (isAdminRole(owned)) {
    return [...DEFAULT_PERMISSION_KEYS];
  }

  const granted = getBaselinePermissions(user);

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  const roleFilters = buildRoleFilter(systemRoles, customRoleIds);

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

export type PermissionSource =
  | { kind: "baseline" }
  | { kind: "admin"; label: string }
  | { kind: "role"; label: string; viaProductions: string[] }
  | { kind: "customRole"; label: string }
  | { kind: "department"; label: string };

export type ExplainedPermission = {
  key: string;
  label: string;
  categoryLabel: string;
  sources: PermissionSource[];
};

/**
 * Alle Rechte eines Mitglieds mit Herkunft, damit Admins nachvollziehen können, *warum*
 * jemand etwas darf. Spiegelt die Logik von `getUserPermissionKeys`.
 */
export async function explainUserPermissions(userId: string): Promise<ExplainedPermission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      roles: { select: { role: true } },
      appRoles: { select: { role: { select: { id: true, name: true } } } },
      departmentMemberships: {
        where: currentDepartmentMembershipWhere(),
        select: { department: { select: { id: true, name: true } } },
      },
      productionMemberships: {
        where: {
          leftAt: null,
          status: { not: "left" },
          show: { status: { in: ["planning", "active"] } },
        },
        select: { roles: true, show: { select: { title: true, year: true } } },
      },
    },
  });
  if (!user) return [];

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  const systemRoles = sortRoles([user.role as Role, ...user.roles.map((r) => r.role as Role)]);
  const sources = new Map<string, PermissionSource[]>(
    DEFAULT_PERMISSION_KEYS.map((key) => [key, []]),
  );
  const add = (key: string, source: PermissionSource) => sources.get(key)?.push(source);

  const adminRole = systemRoles.find((role) => role === "owner" || role === "admin");
  if (adminRole) {
    for (const key of DEFAULT_PERMISSION_KEYS) {
      add(key, { kind: "admin", label: ROLE_LABELS[adminRole] });
    }
  } else {
    for (const key of BASELINE_PERMISSION_KEYS) add(key, { kind: "baseline" });

    const viaProductions = (role: Role) =>
      user.productionMemberships
        .filter((membership) => membership.roles.includes(role))
        .map((membership) => membership.show.title ?? String(membership.show.year));

    const roleGrants = await prisma.appRolePermission.findMany({
      where: {
        OR: buildRoleFilter(
          systemRoles,
          user.appRoles.map((entry) => entry.role.id),
        ),
      },
      select: {
        permission: { select: { key: true } },
        role: { select: { id: true, name: true, systemRole: true } },
      },
    });
    for (const grant of roleGrants) {
      const systemRole = (grant.role.systemRole ??
        (systemRoles.includes(grant.role.name as Role) ? grant.role.name : null)) as Role | null;
      if (systemRole && systemRoles.includes(systemRole)) {
        add(grant.permission.key, {
          kind: "role",
          label: ROLE_LABELS[systemRole] ?? systemRole,
          viaProductions: viaProductions(systemRole),
        });
      } else {
        add(grant.permission.key, { kind: "customRole", label: grant.role.name });
      }
    }

    const departments = user.departmentMemberships.map((entry) => entry.department);
    if (departments.length) {
      const departmentGrants = await prisma.departmentPermission.findMany({
        where: { departmentId: { in: departments.map((d) => d.id) } },
        select: { departmentId: true, permission: { select: { key: true } } },
      });
      for (const grant of departmentGrants) {
        const department = departments.find((d) => d.id === grant.departmentId);
        if (department) add(grant.permission.key, { kind: "department", label: department.name });
      }
    }
  }

  return DEFAULT_PERMISSION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    categoryLabel: PERMISSION_CATEGORY_LABELS[definition.category] ?? definition.category,
    sources: sources.get(definition.key) ?? [],
  }));
}
