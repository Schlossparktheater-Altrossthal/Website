-- Neues Recht „Gewerks-Blaupausen verwalten“ (gewerke-plan.md, Phase 9): Standardmäßig
-- bekommt es jede Rolle, die bisher Produktionen verwaltet (Regie/Board).
INSERT INTO "Permission" ("id", "key", "label")
VALUES ('perm_department_template_manage', 'PRIVATE.DEPARTMENT.TEMPLATE.MANAGE', 'Gewerks-Blaupausen verwalten')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AppRolePermission" ("id", "roleId", "permissionId")
SELECT 'apr_' || md5(arp."roleId" || target."id"), arp."roleId", target."id"
FROM "AppRolePermission" arp
JOIN "Permission" source ON source."id" = arp."permissionId" AND source."key" = 'PRIVATE.PRODUCTION.SHOW.MANAGE'
CROSS JOIN (SELECT "id" FROM "Permission" WHERE "key" = 'PRIVATE.DEPARTMENT.TEMPLATE.MANAGE') target
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
