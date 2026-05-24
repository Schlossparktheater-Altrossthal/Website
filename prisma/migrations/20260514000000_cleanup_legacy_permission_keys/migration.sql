DO $$
DECLARE
  old_countdown_id TEXT;
  new_countdown_id TEXT;
  old_theme_id TEXT;
  new_theme_id TEXT;
  old_chronik_id TEXT;
  new_chronik_id TEXT;
BEGIN
  SELECT id INTO old_countdown_id FROM "Permission" WHERE "key" = 'PRIVATE.WEBSITE.COUNTDOWN.EDIT' LIMIT 1;
  SELECT id INTO new_countdown_id FROM "Permission" WHERE "key" = 'PUBLIC.HOME.COUNTDOWN.EDIT' LIMIT 1;

  IF old_countdown_id IS NOT NULL THEN
    IF new_countdown_id IS NOT NULL THEN
      UPDATE "AppRolePermission" rp
      SET "permissionId" = new_countdown_id
      WHERE rp."permissionId" = old_countdown_id
        AND NOT EXISTS (
          SELECT 1 FROM "AppRolePermission" rp2
          WHERE rp2."roleId" = rp."roleId"
            AND rp2."permissionId" = new_countdown_id
        );

      DELETE FROM "AppRolePermission" WHERE "permissionId" = old_countdown_id;
      DELETE FROM "DepartmentPermission" WHERE "permissionId" = old_countdown_id;
      DELETE FROM "Permission" WHERE id = old_countdown_id;
    ELSE
      DELETE FROM "Permission" p
      WHERE p.id = old_countdown_id
        AND NOT EXISTS (
          SELECT 1 FROM "AppRolePermission" rp WHERE rp."permissionId" = p.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM "DepartmentPermission" dp WHERE dp."permissionId" = p.id
        );
    END IF;
  END IF;

  DELETE FROM "AppRolePermission"
  WHERE "permissionId" IN (
    SELECT id FROM "Permission"
    WHERE "key" IN (
      'website' || '.' || 'premiere-countdown',
      'website' || '.' || 'production-flyer',
      'chronik' || '.' || 'performance-dates',
      'site.countdown',
      'site.homepage-flyer'
    )
  );

  DELETE FROM "DepartmentPermission"
  WHERE "permissionId" IN (
    SELECT id FROM "Permission"
    WHERE "key" IN (
      'website' || '.' || 'premiere-countdown',
      'website' || '.' || 'production-flyer',
      'chronik' || '.' || 'performance-dates',
      'site.countdown',
      'site.homepage-flyer'
    )
  );

  DELETE FROM "Permission"
  WHERE "key" IN (
    'website' || '.' || 'premiere-countdown',
    'website' || '.' || 'production-flyer',
    'chronik' || '.' || 'performance-dates',
    'site.countdown',
    'site.homepage-flyer'
  );

  SELECT id INTO old_theme_id FROM "Permission" WHERE "key" = 'PRIVATE' || '.' || 'WEBSITE.THEME.MANAGE' LIMIT 1;
  SELECT id INTO new_theme_id FROM "Permission" WHERE "key" = 'PRIVATE.SETTINGS.THEME.MANAGE' LIMIT 1;

  IF old_theme_id IS NOT NULL THEN
    IF new_theme_id IS NOT NULL THEN
      UPDATE "AppRolePermission" rp
      SET "permissionId" = new_theme_id
      WHERE rp."permissionId" = old_theme_id
        AND NOT EXISTS (
          SELECT 1 FROM "AppRolePermission" rp2
          WHERE rp2."roleId" = rp."roleId"
            AND rp2."permissionId" = new_theme_id
        );

      DELETE FROM "AppRolePermission" WHERE "permissionId" = old_theme_id;
      DELETE FROM "DepartmentPermission" WHERE "permissionId" = old_theme_id;
      DELETE FROM "Permission" WHERE id = old_theme_id;
    ELSE
      UPDATE "Permission" SET "key" = 'PRIVATE.SETTINGS.THEME.MANAGE' WHERE id = old_theme_id;
    END IF;
  END IF;

  SELECT id INTO old_chronik_id FROM "Permission" WHERE "key" = 'PRIVATE' || '.' || 'WEBSITE.CHRONIK.EDIT' LIMIT 1;
  SELECT id INTO new_chronik_id FROM "Permission" WHERE "key" = 'PUBLIC.CHRONIK.DATES.EDIT' LIMIT 1;

  IF old_chronik_id IS NOT NULL THEN
    IF new_chronik_id IS NOT NULL THEN
      UPDATE "AppRolePermission" rp
      SET "permissionId" = new_chronik_id
      WHERE rp."permissionId" = old_chronik_id
        AND NOT EXISTS (
          SELECT 1 FROM "AppRolePermission" rp2
          WHERE rp2."roleId" = rp."roleId"
            AND rp2."permissionId" = new_chronik_id
        );

      DELETE FROM "AppRolePermission" WHERE "permissionId" = old_chronik_id;
      DELETE FROM "DepartmentPermission" WHERE "permissionId" = old_chronik_id;
      DELETE FROM "Permission" WHERE id = old_chronik_id;
    ELSE
      UPDATE "Permission" SET "key" = 'PUBLIC.CHRONIK.DATES.EDIT' WHERE id = old_chronik_id;
    END IF;
  END IF;
END $$;
