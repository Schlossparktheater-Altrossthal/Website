-- CreateEnum
CREATE TYPE "FileLibraryAccessType" AS ENUM ('VIEW', 'DOWNLOAD', 'UPLOAD');
CREATE TYPE "FileLibraryAccessTargetType" AS ENUM ('SYSTEM_ROLE', 'APP_ROLE');

-- CreateTable
CREATE TABLE "FileLibraryFolder" (
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

CREATE TABLE "FileLibraryItem" (
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

CREATE TABLE "FileLibraryFolderAccess" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "accessType" "FileLibraryAccessType" NOT NULL,
    "targetType" "FileLibraryAccessTargetType" NOT NULL,
    "systemRole" "Role",
    "appRoleId" TEXT,
    CONSTRAINT "FileLibraryFolderAccess_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "FileLibraryFolder_parentId_idx" ON "FileLibraryFolder"("parentId");
CREATE INDEX "FileLibraryItem_folderId_createdAt_idx" ON "FileLibraryItem"("folderId", "createdAt");
CREATE INDEX "FileLibraryFolderAccess_folderId_accessType_idx" ON "FileLibraryFolderAccess"("folderId", "accessType");
CREATE UNIQUE INDEX "FileLibraryFolderAccess_folderId_accessType_systemRole_appRoleId_key" ON "FileLibraryFolderAccess"("folderId", "accessType", "systemRole", "appRoleId");

-- Foreign keys
ALTER TABLE "FileLibraryFolder" ADD CONSTRAINT "FileLibraryFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FileLibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileLibraryFolder" ADD CONSTRAINT "FileLibraryFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileLibraryItem" ADD CONSTRAINT "FileLibraryItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FileLibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileLibraryItem" ADD CONSTRAINT "FileLibraryItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileLibraryFolderAccess" ADD CONSTRAINT "FileLibraryFolderAccess_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FileLibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileLibraryFolderAccess" ADD CONSTRAINT "FileLibraryFolderAccess_appRoleId_fkey" FOREIGN KEY ("appRoleId") REFERENCES "AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
