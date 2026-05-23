-- Fix schema drift: remove stale updatedAt defaults and add missing analytics_settings PK

-- AlterTable
ALTER TABLE "public"."FileLibraryFolder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."FileLibraryItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."InventoryItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ServerSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."analytics_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Deduplicate analytics_settings before adding PK (can have duplicate 'default' rows from repeated seeding)
DELETE FROM "public"."analytics_settings" a
WHERE ctid <> (
  SELECT max(ctid) FROM "public"."analytics_settings" b WHERE b.id = a.id
);

-- AddPrimaryKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_settings_pkey'
  ) THEN
    ALTER TABLE "public"."analytics_settings" ADD CONSTRAINT "analytics_settings_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

-- RenameIndex (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'FileLibraryFolderAccess_folderId_accessType_systemRole_appRoleI') THEN
    ALTER INDEX "public"."FileLibraryFolderAccess_folderId_accessType_systemRole_appRoleI"
      RENAME TO "FileLibraryFolderAccess_folderId_accessType_systemRole_appR_key";
  END IF;
END $$;
