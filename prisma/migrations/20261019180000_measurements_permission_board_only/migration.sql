-- Körpermaße aller nur noch für den Vorstand: früher per Seed vergebenes Recht anderen Systemrollen entziehen.
DELETE FROM "AppRolePermission" rp
USING "Permission" p, "AppRole" r
WHERE rp."permissionId" = p.id
  AND rp."roleId" = r.id
  AND p.key = 'PRIVATE.PROFILE.MEASUREMENTS.MANAGE'
  AND r.name IN ('member', 'cast', 'tech', 'finance');
