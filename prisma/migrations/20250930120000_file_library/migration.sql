DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'FileLibraryAccessType'
    ) THEN
        CREATE TYPE "public"."FileLibraryAccessType" AS ENUM ('VIEW', 'DOWNLOAD', 'UPLOAD');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'FileLibraryAccessTargetType'
    ) THEN
        CREATE TYPE "public"."FileLibraryAccessTargetType" AS ENUM ('SYSTEM_ROLE', 'APP_ROLE');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."FileLibraryFolder" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allowAllView" BOOLEAN NOT NULL DEFAULT true,
    "allowAllDownload" BOOLEAN NOT NULL DEFAULT true,
    "allowAllUpload" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "FileLibraryFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."FileLibraryItem" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."FileLibraryFolderAccess" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "accessType" "public"."FileLibraryAccessType" NOT NULL,
    "targetType" "public"."FileLibraryAccessTargetType" NOT NULL,
    "systemRole" "public"."Role",
    "appRoleId" TEXT,
    CONSTRAINT "FileLibraryFolderAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FileLibraryFolder_parentId_idx" ON "public"."FileLibraryFolder"("parentId");
CREATE INDEX IF NOT EXISTS "FileLibraryItem_folderId_createdAt_idx" ON "public"."FileLibraryItem"("folderId", "createdAt");
CREATE INDEX IF NOT EXISTS "FileLibraryFolderAccess_folderId_accessType_idx" ON "public"."FileLibraryFolderAccess"("folderId", "accessType");
CREATE UNIQUE INDEX IF NOT EXISTS "FileLibraryFolderAccess_folderId_accessType_systemRole_appRoleId_key" ON "public"."FileLibraryFolderAccess"("folderId", "accessType", "systemRole", "appRoleId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FileLibraryFolder_parentId_fkey'
          AND conrelid = to_regclass('public."FileLibraryFolder"')
    ) THEN
        ALTER TABLE "public"."FileLibraryFolder"
            ADD CONSTRAINT "FileLibraryFolder_parentId_fkey"
            FOREIGN KEY ("parentId") REFERENCES "public"."FileLibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FileLibraryFolder_createdById_fkey'
          AND conrelid = to_regclass('public."FileLibraryFolder"')
    ) THEN
        ALTER TABLE "public"."FileLibraryFolder"
            ADD CONSTRAINT "FileLibraryFolder_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FileLibraryItem_folderId_fkey'
          AND conrelid = to_regclass('public."FileLibraryItem"')
    ) THEN
        ALTER TABLE "public"."FileLibraryItem"
            ADD CONSTRAINT "FileLibraryItem_folderId_fkey"
            FOREIGN KEY ("folderId") REFERENCES "public"."FileLibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FileLibraryItem_uploadedById_fkey'
          AND conrelid = to_regclass('public."FileLibraryItem"')
    ) THEN
        ALTER TABLE "public"."FileLibraryItem"
            ADD CONSTRAINT "FileLibraryItem_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FileLibraryFolderAccess_folderId_fkey'
          AND conrelid = to_regclass('public."FileLibraryFolderAccess"')
    ) THEN
        ALTER TABLE "public"."FileLibraryFolderAccess"
            ADD CONSTRAINT "FileLibraryFolderAccess_folderId_fkey"
            FOREIGN KEY ("folderId") REFERENCES "public"."FileLibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FileLibraryFolderAccess_appRoleId_fkey'
          AND conrelid = to_regclass('public."FileLibraryFolderAccess"')
    ) THEN
        ALTER TABLE "public"."FileLibraryFolderAccess"
            ADD CONSTRAINT "FileLibraryFolderAccess_appRoleId_fkey"
            FOREIGN KEY ("appRoleId") REFERENCES "public"."AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
