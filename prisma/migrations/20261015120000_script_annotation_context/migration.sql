-- Text vor/nach einer Notiz-Stelle (docs/Plan/skript-notizen-plan.md, Schritt 5)
ALTER TABLE "ScriptAnnotation" ADD COLUMN "prefix" TEXT;
ALTER TABLE "ScriptAnnotation" ADD COLUMN "suffix" TEXT;
