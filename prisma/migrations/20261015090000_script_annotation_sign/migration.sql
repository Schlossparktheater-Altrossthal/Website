-- Zeichen im Text (docs/Plan/skript-notizen-plan.md, Schritt 3)
ALTER TYPE "ScriptAnnotationKind" ADD VALUE 'sign';
ALTER TABLE "ScriptAnnotation" ADD COLUMN "sign" TEXT;
