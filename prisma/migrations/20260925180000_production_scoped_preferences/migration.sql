-- Rollenwünsche, Notizen und WhatsApp-Besuch gelten künftig pro Produktion.

ALTER TABLE "MemberRolePreference" ADD COLUMN "showId" TEXT;

ALTER TABLE "ProductionOnboarding" ADD COLUMN "notes" TEXT,
ADD COLUMN "whatsappLinkVisitedAt" TIMESTAMP(3);

-- Bestehende Wünsche der Produktion zuordnen, für die das Mitglied das Onboarding
-- gemacht hat (Onboarding-Profil). Ohne Produktion bleiben sie als Vorschlag erhalten.
UPDATE "MemberRolePreference" AS p
SET "showId" = o."showId"
FROM "MemberOnboardingProfile" AS o
WHERE o."userId" = p."userId" AND o."showId" IS NOT NULL;

-- Der alte Unique-Index gilt pro (userId, code) und muss vor dem Einfügen weichen:
-- Mitglieder können denselben Rollen-Code in mehreren Produktionen wünschen, die
-- historischen Snapshot-Einträge würden sonst mit bestehenden Zeilen kollidieren.
DROP INDEX "MemberRolePreference_userId_code_key";

-- Für frühere Produktionen die im Onboarding bestätigten Wünsche aus dem Snapshot übernehmen.
INSERT INTO "MemberRolePreference" ("id", "userId", "showId", "code", "domain", "weight", "createdAt", "updatedAt")
SELECT DISTINCT ON (po."userId", po."showId", pref->>'code')
       gen_random_uuid()::text,
       po."userId",
       po."showId",
       pref->>'code',
       (pref->>'domain')::"RolePreferenceDomain",
       LEAST(100, GREATEST(0, (pref->>'weight')::int)),
       COALESCE(po."completedAt", po."createdAt"),
       COALESCE(po."completedAt", po."createdAt")
FROM "ProductionOnboarding" AS po
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(po."profileSnapshot"->'preferences') = 'array'
       THEN po."profileSnapshot"->'preferences' ELSE '[]'::jsonb END
) AS pref
WHERE pref->>'code' IS NOT NULL
  AND pref->>'domain' IN ('acting', 'crew')
  AND (pref->>'weight') ~ '^[0-9]+$'
  AND (pref->>'weight')::int > 0
  AND NOT EXISTS (
    SELECT 1 FROM "MemberRolePreference" AS existing
    WHERE existing."userId" = po."userId" AND existing."showId" = po."showId"
  );

-- Notizen und WhatsApp-Besuch in das Produktions-Onboarding derselben Produktion übernehmen.
UPDATE "ProductionOnboarding" AS po
SET "notes" = o."notes",
    "whatsappLinkVisitedAt" = o."whatsappLinkVisitedAt"
FROM "MemberOnboardingProfile" AS o
WHERE o."userId" = po."userId" AND o."showId" = po."showId";

CREATE UNIQUE INDEX "MemberRolePreference_userId_showId_code_key" ON "MemberRolePreference"("userId", "showId", "code");

CREATE INDEX "MemberRolePreference_showId_idx" ON "MemberRolePreference"("showId");

ALTER TABLE "MemberRolePreference" ADD CONSTRAINT "MemberRolePreference_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
