-- Skript: Freihandnotizen (docs/Plan/skript-plan.md, Phase 9)
ALTER TYPE "ScriptAnnotationKind" ADD VALUE 'ink';

ALTER TABLE "ScriptAnnotation" ADD COLUMN "ink" JSONB;
