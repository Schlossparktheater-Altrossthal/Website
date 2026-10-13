-- Skript: Markierungen und Notizen (docs/Plan/skript-plan.md, Phase 8)
CREATE TYPE "ScriptAnnotationKind" AS ENUM ('highlight', 'note');

CREATE TABLE "ScriptAnnotation" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "blockId" TEXT,
    "lineageId" TEXT NOT NULL,
    "kind" "ScriptAnnotationKind" NOT NULL,
    "color" TEXT,
    "body" TEXT,
    "partIndex" INTEGER,
    "start" INTEGER,
    "end" INTEGER,
    "quote" TEXT,
    "blockText" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScriptAnnotation_showId_authorId_idx" ON "ScriptAnnotation"("showId", "authorId");
CREATE INDEX "ScriptAnnotation_lineageId_idx" ON "ScriptAnnotation"("lineageId");

ALTER TABLE "ScriptAnnotation" ADD CONSTRAINT "ScriptAnnotation_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptAnnotation" ADD CONSTRAINT "ScriptAnnotation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScriptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptAnnotation" ADD CONSTRAINT "ScriptAnnotation_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ScriptBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScriptAnnotation" ADD CONSTRAINT "ScriptAnnotation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
