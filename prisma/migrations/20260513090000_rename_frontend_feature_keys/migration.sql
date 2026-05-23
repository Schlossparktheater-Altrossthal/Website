-- Rename frontend feature permission keys when they were persisted in the Permission table.
-- If a target key already exists, grants are merged into the target permission before
-- the legacy permission row is removed.
DO $$
DECLARE
  mapping text[][] := ARRAY[
    ARRAY['site' || '.' || 'countdown', 'website.premiere-countdown'],
    ARRAY['site' || '.' || 'homepage-flyer', 'website.production-flyer'],
    ARRAY['mystery' || '.' || 'timer', 'mystery.launch-countdown'],
    ARRAY['chronik' || '.' || 'dates', 'chronik.performance-dates'],
    ARRAY['PRIVATE.MYSTERY' || '.' || 'timer', 'PRIVATE.WEBSITE.COUNTDOWN.EDIT'],
    ARRAY['PRIVATE.WEBSITE' || '.' || 'COUNTDOWN.EDIT', 'PRIVATE.WEBSITE.COUNTDOWN.EDIT']
  ];
  pair text[];
  old_permission_id text;
  new_permission_id text;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY mapping LOOP
    SELECT id INTO old_permission_id FROM "Permission" WHERE key = pair[1];
    SELECT id INTO new_permission_id FROM "Permission" WHERE key = pair[2];

    IF old_permission_id IS NOT NULL AND new_permission_id IS NULL THEN
      UPDATE "Permission" SET key = pair[2] WHERE id = old_permission_id;
    ELSIF old_permission_id IS NOT NULL AND new_permission_id IS NOT NULL THEN
      INSERT INTO "AppRolePermission" (id, "roleId", "permissionId")
      SELECT 'apr_' || md5("roleId" || new_permission_id), "roleId", new_permission_id
      FROM "AppRolePermission"
      WHERE "permissionId" = old_permission_id
      ON CONFLICT ("roleId", "permissionId") DO NOTHING;

      INSERT INTO "DepartmentPermission" (id, "departmentId", "permissionId")
      SELECT 'dpr_' || md5("departmentId" || new_permission_id), "departmentId", new_permission_id
      FROM "DepartmentPermission"
      WHERE "permissionId" = old_permission_id
      ON CONFLICT ("departmentId", "permissionId") DO NOTHING;

      DELETE FROM "Permission" WHERE id = old_permission_id;
    END IF;
  END LOOP;
END $$;
