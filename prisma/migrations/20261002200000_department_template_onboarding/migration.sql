-- Blaupausen als Onboarding-Wünsche (gewerke-plan.md, Phase 9b)
ALTER TABLE "DepartmentTemplate"
  ADD COLUMN "onboardingVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "onboardingDescription" TEXT;

-- Schauspiel ist kein Gewerks-Wunsch (acting_* bleiben feste Codes), Technik hat seit
-- 20260926230000 bewusst keinen Wunsch.
UPDATE "DepartmentTemplate" SET "onboardingVisible" = false WHERE "slug" IN ('schauspiel', 'technik');
