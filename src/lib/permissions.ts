import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { Prisma } from "@prisma/client";

type PermissionDefinition = { key: string; label: string; description?: string };

type UserLike = { id?: string; role?: Role; roles?: Role[] } | null | undefined;

export const DEFAULT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "mitglieder.dashboard", label: "Mitglieder-Dashboard öffnen" },
  { key: "mitglieder.profil", label: "Profilbereich aufrufen" },
  {
    key: "mitglieder.issues",
    label: "Feedback & Support nutzen",
    description:
      "Anliegen, Probleme oder Verbesserungsvorschläge im Mitglieder-Issue-Board melden und einsehen.",
  },
  {
    key: "mitglieder.meine-proben",
    label: "Eigene Probentermine einsehen",
    description: "Zugang zum Bereich \"Meine Proben\" mit persönlichen Terminen und Fristen.",
  },
  {
    key: "mitglieder.meine-gewerke",
    label: "Eigene Gewerke einsehen",
    description: "Zugang zum Bereich \"Meine Gewerke\" mit Aufgabenübersicht und Terminvorschlägen.",
  },
  { key: "mitglieder.probenplanung", label: "Probenplanung verwalten" },
  {
    key: "mitglieder.produktionen",
    label: "Produktionsplanung öffnen",
    description:
      "Bereich zur Verwaltung von Gewerken, Besetzungen, Szenen und Breakdown-Aufgaben im Produktionsmanagement.",
  },
  { key: "mitglieder.rollenverwaltung", label: "Mitgliederverwaltung öffnen" },
  {
    key: "mitglieder.einladungen",
    label: "Einladungslinks verwalten",
    description: "Mehrfach nutzbare Einladungslinks anlegen, deaktivieren und deren Status prüfen.",
  },
  { key: "mitglieder.rechte", label: "Rechteverwaltung öffnen" },
  {
    key: "mitglieder.mystery.timer",
    label: "Mystery-Timer verwalten",
    description: "Countdown und Hinweistext für das öffentliche Geheimnis pflegen.",
  },
  {
    key: "mitglieder.mystery.tips",
    label: "Mystery-Tipps verwalten",
    description: "Community-Tipps nach Rätsel auswerten und Punkte für richtige Ideen vergeben.",
  },
  { key: "mitglieder.sperrliste", label: "Sperrliste pflegen" },
  {
    key: "mitglieder.fotoerlaubnisse",
    label: "Fotoerlaubnisse verwalten",
    description: "Bereich zum Prüfen und Freigeben von Fotoeinverständniserklärungen.",
  },
  {
    key: "mitglieder.finanzen",
    label: "Finanzbereich öffnen",
    description:
      "Dashboard für Einnahmen, Ausgaben, Rechnungen und Spenden im Mitgliederbereich einsehen.",
  },
  {
    key: "mitglieder.finanzen.manage",
    label: "Finanzbuchungen verwalten",
    description:
      "Neue Finanzbuchungen anlegen, bearbeiten, Rechnungen erfassen und Spenden dokumentieren.",
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
  {
    key: "mitglieder.onboarding.analytics",
    label: "Onboarding-Analytics öffnen",
    description: "Statistiken zum Einladungs- und Onboarding-Prozess einsehen.",
  },
  {
    key: "mitglieder.issues.manage",
    label: "Feedback-Anliegen verwalten",
    description: "Status, Priorität und Moderation für gemeldete Anliegen im Issue-Board übernehmen.",
  },
];

const DEFAULT_PERMISSION_KEYS = DEFAULT_PERMISSION_DEFINITIONS.map((def) => def.key);
const PERMISSION_KEY_SET = new Set(DEFAULT_PERMISSION_KEYS);

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

// Baseline permissions that every authenticated user should retain even when no
// explicit grants exist yet (e.g. on a fresh installation before the matrix is
// configured). This prevents core pages like the dashboard from responding with
// 403 errors for regular members.
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

function collectOwnedRoles(user: UserLike) {
  const owned = new Set<Role>();
  if (!user) return owned;
  if (user.role) owned.add(user.role);
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) owned.add(r);
  }
  return owned;
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

  const owned = collectOwnedRoles(user);

  if (owned.has("owner") || owned.has("admin")) return true;

  if (getBaselinePermissions(user).has(permissionKey)) {
    return true;
  }

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  const systemRoles = Array.from(owned);

  const [perm, customAssignments] = await Promise.all([
    prisma.permission.findUnique({ where: { key: permissionKey } }),
    prisma.userAppRole.findMany({
      where: { userId: user.id },
      select: { roleId: true },
    }),
  ]);

  if (!perm) return false;

  const customRoleIds = customAssignments.map((assignment) => assignment.roleId);

  if (!systemRoles.length && !customRoleIds.length) return false;

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

  if (!roleFilters.length) return false;

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

  const owned = collectOwnedRoles(user);

  if (owned.has("owner") || owned.has("admin")) {
    return [...DEFAULT_PERMISSION_KEYS];
  }

  const granted = getBaselinePermissions(user);

  await ensureSystemRoles();
  await ensurePermissionDefinitions();

  const systemRoles = Array.from(owned);

  const customAssignments = await prisma.userAppRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });

  const customRoleIds = customAssignments.map((assignment) => assignment.roleId);

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
