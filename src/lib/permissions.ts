import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { currentCastingWhere, currentDepartmentMembershipWhere } from "@/lib/produktionen/status";
import { ROLES, ROLE_LABELS, isAdminRole, sortRoles, type Role } from "@/lib/roles";
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
  | "services"
  | "inventory";

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategoryKey, string> = {
  base: "Allgemeines",
  rehearsal: "Proben",
  department: "Gewerke",
  pages: "Pages",
  admin: "Verwaltung",
  analytics: "Analysen",
  communication: "Kommunikation",
  services: "Dienste",
  inventory: "Lager",
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
  /** Besetzt in einer Rolle – öffnet „Meine Teams“ wie eine Gewerk-Zugehörigkeit. */
  hasCasting: boolean;
};

// Shared keys for profile data gatekeeping
export const PROFILE_DATA_PERMISSION_KEYS = {
  measurements: "PRIVATE.PROFILE.MEASUREMENTS.MANAGE",
  sizes: "PRIVATE.PROFILE.SIZES.MANAGE",
  dietary: "PRIVATE.PROFILE.DIETARY.MANAGE",
} as const satisfies Record<"measurements" | "sizes" | "dietary", PermissionDefinition["key"]>;

// Registry of all permissions used by the app
export const INVENTORY_PERMISSION_KEYS = {
  use: "PRIVATE.INVENTORY.USE",
  manage: "PRIVATE.INVENTORY.MANAGE",
} as const;

export const DEFAULT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: INVENTORY_PERMISSION_KEYS.use,
    label: "Lager nutzen",
    description:
      "Inventar suchen und scannen, Objekte erfassen und bearbeiten, ein- und umlagern, ausgeben, Mängel melden, Prüfungen eintragen und bei Inventuren mitzählen.",
    category: "inventory",
  },
  {
    key: INVENTORY_PERMISSION_KEYS.manage,
    label: "Lager verwalten",
    description:
      "Bereiche, Kategorien und Lagerorte pflegen, Preise und Werte sehen, Objekte ausmustern sowie Inventuren starten und abschließen.",
    category: "inventory",
  },
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
    label: "Meine Teams einsehen",
    description:
      "Zugang zu „Meine Teams“: Gewerk-Portale mit Aufgaben, Terminen, Team und Dateien.",
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
    key: "PRIVATE.REHEARSAL.PROTOCOL.EDIT",
    label: "Probenprotokoll führen",
    description:
      "Während der Probe Anwesenheit, tatsächliche Zeiten, geprobte Szenen und Notizen im Probenmodus erfassen.",
    category: "rehearsal",
  },
  {
    key: "PRIVATE.PRODUCTION.SHOW.MANAGE",
    label: "Produktionsplanung öffnen",
    description:
      "Bereich zur Verwaltung von Gewerken, Besetzungen, Szenen und Breakdown-Aufgaben im Produktionsmanagement.",
    category: "pages",
  },
  {
    key: "PRIVATE.PRODUCTION.PLAN.MANAGE",
    label: "Produktionsplan pflegen",
    description:
      "Meilensteine, Fristen und Abhängigkeiten der Produktion anlegen, verschieben und Vorlagen übernehmen.",
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
    description:
      "Bereich zum Prüfen und Freigeben von Fotoeinverständniserklärungen; bekommt auch die Benachrichtigungen dazu.",
    category: "admin",
  },
  {
    key: "PRIVATE.PHOTOCONSENT.VIEW",
    label: "Fotoliste einsehen",
    description:
      "Lesezugriff auf die Fotoerlaubnis-Liste einer Produktion – wer darf fotografiert werden, wer nicht – ohne Verwaltungsfunktionen.",
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

// Standardzuweisungen greifen nur, solange die jeweilige Rolle existiert. Wurde eine Rolle in
// der Rechteverwaltung gelöscht, wird sie hier stillschweigend übersprungen.
const MEASUREMENT_DEFAULT_ROLE_NAMES = [
  "member",
  "cast",
  "tech",
  "board",
  "finance",
] as const satisfies readonly Role[];

// Baseline permissions that every authenticated user should retain even when not explicitly granted
/** Jede aktive Gewerk-Zugehörigkeit erlaubt die Gewerkeplanung. */
const DEPARTMENT_MEMBER_PERMISSION_KEY = "PRIVATE.DEPARTMENT.OWN.VIEW";

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
  // Nur Mitglied, Admin und Owner sind Pflichtrollen (`MANDATORY_ROLES`). Vorstand, Ensemble,
  // Technik und Finanzen sind eingebaute Rollen, dürfen aber in der Rechteverwaltung gelöscht
  // werden – sie werden hier deshalb bewusst nicht mehr nachgelegt, sonst käme eine gelöschte
  // Rolle beim nächsten Seitenaufruf zurück. Neu entstehen sie über „Neue Rolle“.
  const mandatoryRoles: { role: Role; isSystem: boolean }[] = [
    { role: "member", isSystem: false },
    { role: "owner", isSystem: true },
    { role: "admin", isSystem: true },
  ];

  await prisma.$transaction(
    mandatoryRoles.map(({ role, isSystem }) =>
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
  "PRIVATE.REHEARSAL.PROTOCOL.EDIT",
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
    return { systemRoles: [], customRoleIds: [], departmentIds: [], hasCasting: false };
  }
  return resolveRoleContextCached(user.id, showId ?? null);
}

// Pro Request einmal je Nutzer/Produktion: Layout und Seiten prüfen oft mehrere Rechte.
const resolveRoleContextCached = cache(async function resolveRoleContextUncached(
  userId: string,
  showId: string | null,
): Promise<ResolvedRoleContext> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      roles: { select: { role: true } },
      appRoles: { select: { roleId: true } },
      departmentMemberships: {
        where: currentDepartmentMembershipWhere(),
        select: { departmentId: true },
      },
      characterCastings: { where: currentCastingWhere(), select: { id: true }, take: 1 },
    },
  });

  if (!dbUser) {
    return { systemRoles: [], customRoleIds: [], departmentIds: [], hasCasting: false };
  }

  let systemRoles = sortRoles([
    dbUser.role as Role,
    ...dbUser.roles.map((entry) => entry.role as Role),
  ]);

  if (showId && !isAdminRole(new Set(systemRoles))) {
    const membership = await prisma.productionMembership.findFirst({
      where: { userId, showId, leftAt: null, status: { not: "left" } },
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

  return {
    systemRoles,
    customRoleIds,
    departmentIds,
    hasCasting: dbUser.characterCastings.length > 0,
  };
});

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

const findPermissionByKey = cache((key: string) =>
  prisma.permission.findUnique({ where: { key } }),
);

export async function hasPermission(
  user: UserLike,
  permissionKey: string,
  options?: PermissionCheckOptions,
): Promise<boolean> {
  if (!user?.id) return false;
  if (!isKnownPermissionKey(permissionKey)) return false;

  const scopedShowId = isProductionScopedPermission(permissionKey) ? options?.showId : null;
  const { systemRoles, customRoleIds, departmentIds, hasCasting } = await resolveRoleContext(
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

  if (permissionKey === DEPARTMENT_MEMBER_PERMISSION_KEY && hasCasting) return true;
  if (!systemRoles.length && !customRoleIds.length && !departmentIds.length) return false;

  const perm = await findPermissionByKey(permissionKey);
  if (!perm) return false;

  // Wer einem Gewerk angehört, sieht die Gewerkeplanung – ohne gespeicherte Rolle.
  if (permissionKey === DEPARTMENT_MEMBER_PERMISSION_KEY && departmentIds.length) {
    return true;
  }

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

/**
 * Alle Nutzer, die ein (nicht produktionsbezogenes) Recht besitzen – z. B. als Empfänger von
 * Benachrichtigungen, damit die Rechteverwaltung auch darüber entscheidet. Owner/Admin zählen
 * immer dazu, Rechte der Grundausstattung werden nicht aufgelöst.
 */
export async function findUserIdsWithPermission(
  permissionKey: string,
  client: Pick<typeof prisma, "user" | "appRole" | "departmentPermission"> = prisma,
): Promise<string[]> {
  if (!isKnownPermissionKey(permissionKey)) return [];

  const [roles, departments] = await Promise.all([
    client.appRole.findMany({
      where: { grants: { some: { permission: { key: permissionKey } } } },
      select: { id: true, name: true, systemRole: true },
    }),
    client.departmentPermission.findMany({
      where: { permission: { key: permissionKey } },
      select: { departmentId: true },
    }),
  ]);

  const systemRoles = new Set<Role>(["admin", "owner"]);
  for (const role of roles) {
    if (role.systemRole) systemRoles.add(role.systemRole as Role);
    if ((ROLES as readonly string[]).includes(role.name)) systemRoles.add(role.name as Role);
  }
  // Ensemble/Technik gelten nur pro Produktion und reichen für globale Empfänger nicht.
  const globalRoles = [...systemRoles].filter((role) => !isProductionRole(role));

  const users = await client.user.findMany({
    where: {
      OR: [
        { role: { in: globalRoles } },
        { roles: { some: { role: { in: globalRoles } } } },
        ...(roles.length
          ? [{ appRoles: { some: { roleId: { in: roles.map((r) => r.id) } } } }]
          : []),
        ...(departments.length
          ? [
              {
                departmentMemberships: {
                  some: {
                    ...currentDepartmentMembershipWhere(),
                    departmentId: { in: departments.map((d) => d.departmentId) },
                  },
                },
              },
            ]
          : []),
      ],
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}

export async function getUserPermissionKeys(user: UserLike): Promise<string[]> {
  if (!user?.id) return [];

  const { systemRoles, customRoleIds, departmentIds, hasCasting } = await resolveRoleContext(user);
  const owned = new Set(systemRoles);

  if (isAdminRole(owned)) {
    return [...DEFAULT_PERMISSION_KEYS];
  }

  const granted = getBaselinePermissions(user);
  if (hasCasting) granted.add(DEPARTMENT_MEMBER_PERMISSION_KEY);

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
    granted.add(DEPARTMENT_MEMBER_PERMISSION_KEY);
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
      for (const department of departments) {
        add(DEPARTMENT_MEMBER_PERMISSION_KEY, { kind: "department", label: department.name });
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
