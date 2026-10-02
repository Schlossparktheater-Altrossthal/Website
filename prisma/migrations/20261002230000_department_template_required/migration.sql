-- Jedes Gewerk hat eine Blaupause (E7). Eigener Schritt nach dem Nachtrag in
-- 20261002210000; Blaupausen werden archiviert, nicht gelöscht (RESTRICT).
-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_templateId_fkey";

-- AlterTable
ALTER TABLE "Department" ALTER COLUMN "templateId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DepartmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

