-- Aufgaben-Board pro Gewerk: Spalten, Position, Priorität, Kommentare.

CREATE TYPE "TaskPriority" AS ENUM ('low', 'normal', 'high');

CREATE TABLE "DepartmentBoardColumn" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "status" "TaskStatus" NOT NULL DEFAULT 'doing',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartmentBoardColumn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DepartmentBoardColumn_departmentId_position_idx" ON "DepartmentBoardColumn"("departmentId", "position");
ALTER TABLE "DepartmentBoardColumn" ADD CONSTRAINT "DepartmentBoardColumn_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepartmentTask"
  ADD COLUMN "columnId" TEXT,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'normal';
CREATE INDEX "DepartmentTask_columnId_position_idx" ON "DepartmentTask"("columnId", "position");
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_columnId_fkey"
  FOREIGN KEY ("columnId") REFERENCES "DepartmentBoardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DepartmentTaskComment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentTaskComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DepartmentTaskComment_taskId_createdAt_idx" ON "DepartmentTaskComment"("taskId", "createdAt");
ALTER TABLE "DepartmentTaskComment" ADD CONSTRAINT "DepartmentTaskComment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "DepartmentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentTaskComment" ADD CONSTRAINT "DepartmentTaskComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Standardspalten für bestehende Gewerke und Zuordnung der Aufgaben nach Status.
INSERT INTO "DepartmentBoardColumn" ("id", "departmentId", "name", "position", "status", "updatedAt")
SELECT d."id" || '_' || c."key", d."id", c."name", c."position", c."status"::"TaskStatus", CURRENT_TIMESTAMP
FROM "Department" d
CROSS JOIN (VALUES
  ('todo', 'Offen', 0, 'todo'),
  ('doing', 'In Arbeit', 1, 'doing'),
  ('review', 'Review', 2, 'doing'),
  ('done', 'Erledigt', 3, 'done')
) AS c("key", "name", "position", "status");

UPDATE "DepartmentTask" t
SET "columnId" = t."departmentId" || '_' || t."status"::text,
    "position" = sub.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "departmentId", "status" ORDER BY "createdAt") - 1 AS rn
  FROM "DepartmentTask"
) sub
WHERE sub."id" = t."id";
