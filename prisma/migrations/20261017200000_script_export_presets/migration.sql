CREATE TABLE "ScriptExportPreset" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptExportPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScriptExportPreset_showId_ownerId_idx" ON "ScriptExportPreset"("showId", "ownerId");

ALTER TABLE "ScriptExportPreset" ADD CONSTRAINT "ScriptExportPreset_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriptExportPreset" ADD CONSTRAINT "ScriptExportPreset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
