-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "act" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ShowAct" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowAct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowAct_showId_number_key" ON "ShowAct"("showId", "number");

-- AddForeignKey
ALTER TABLE "ShowAct" ADD CONSTRAINT "ShowAct_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Akt aus der bisherigen Nummer übernehmen („2.1“ → Akt 2, ohne Punkt → Akt 1).
UPDATE "Scene" SET "act" = CAST(split_part("identifier", '.', 1) AS INTEGER)
WHERE "identifier" ~ '^[0-9]+\.[0-9]+$' AND CAST(split_part("identifier", '.', 1) AS INTEGER) > 0;

-- Akte der bestehenden Szenen anlegen, damit sie auch leer bestehen bleiben.
INSERT INTO "ShowAct" ("id", "showId", "number", "updatedAt")
SELECT DISTINCT ON ("showId", "act") 'act_' || md5("showId" || '-' || "act"), "showId", "act", CURRENT_TIMESTAMP
FROM "Scene"
ON CONFLICT ("showId", "number") DO NOTHING;
