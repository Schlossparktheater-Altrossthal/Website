-- Delete grants for removed public permission keys
DELETE FROM "AppRolePermission"
WHERE "permissionId" IN (
  SELECT id FROM "Permission" WHERE "key" LIKE 'PUBLIC.%' OR "key" = 'PRIVATE.CHRONIK.MANAGE'
);

DELETE FROM "DepartmentPermission"
WHERE "permissionId" IN (
  SELECT id FROM "Permission" WHERE "key" LIKE 'PUBLIC.%' OR "key" = 'PRIVATE.CHRONIK.MANAGE'
);

DELETE FROM "Permission"
WHERE "key" LIKE 'PUBLIC.%' OR "key" = 'PRIVATE.CHRONIK.MANAGE';
