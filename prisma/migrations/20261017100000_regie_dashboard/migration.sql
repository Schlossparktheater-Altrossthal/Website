-- Regie-Dashboard (docs/Plan/regie-plan.md, Phase 1).

-- Nur Regie-Ansicht: ohne Menü, alles läuft über /mitglieder/regie.
ALTER TABLE "User" ADD COLUMN "directionView" BOOLEAN NOT NULL DEFAULT false;

-- Neues Recht „Regie-Dashboard“.
INSERT INTO "Permission" ("id", "key", "label")
VALUES ('perm_direction_dashboard', 'PRIVATE.PRODUCTION.DIRECTION.DASHBOARD', 'Regie-Dashboard')
ON CONFLICT ("key") DO NOTHING;

-- Blaupause „Regie“; nicht im Onboarding als Wunsch anbieten, die Regie wird zugeordnet.
INSERT INTO "DepartmentTemplate" ("id", "slug", "name", "description", "onboardingVisible", "sortOrder", "updatedAt")
SELECT 'tpl_regie_' || substr(md5(random()::text), 1, 12), 'regie', 'Regie',
       'Künstlerische Leitung der Produktion; gibt den Fahrplan für die Probenplanung vor.',
       false, 5, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "DepartmentTemplate" WHERE "slug" = 'regie');

-- Regie und Regieassistenz bekommen das Recht für Leitung, Stellvertretung und Mitglied.
INSERT INTO "TemplatePermission" ("id", "templateId", "permissionId", "role")
SELECT 'tp_' || md5(t."id" || p."id" || r.role), t."id", p."id", r.role::"DepartmentMembershipRole"
FROM "DepartmentTemplate" t
CROSS JOIN (SELECT "id" FROM "Permission" WHERE "key" = 'PRIVATE.PRODUCTION.DIRECTION.DASHBOARD') p
CROSS JOIN (VALUES ('lead'), ('deputy'), ('member')) AS r(role)
WHERE t."slug" IN ('regie', 'regieassistenz-orga')
ON CONFLICT ("templateId", "permissionId", "role") DO NOTHING;
