-- Fotoerlaubnis als Stufen (docs/Plan/fotoerlaubnis-stufen-plan.md, Phase 1).
-- CreateEnum
CREATE TYPE "PhotoConsentLevel" AS ENUM ('all', 'promoOnRequest', 'internal', 'none');

-- AlterTable
ALTER TABLE "PhotoConsent" ADD COLUMN "level" "PhotoConsentLevel";
ALTER TABLE "PhotoConsentVersion" ADD COLUMN "level" "PhotoConsentLevel";

-- Datenübernahme aus den angekreuzten Zwecken. Ohne erkennbare Auswahl bleibt die Stufe
-- NULL („Stufe unbekannt“); sie wird in der Verwaltung vom Papierformular nachgetragen.
UPDATE "PhotoConsent" c
SET "level" = CASE
  WHEN c."status" = 'noPhotos' OR picked.codes && ARRAY['none'] THEN 'none'::"PhotoConsentLevel"
  WHEN picked.codes && ARRAY['promo'] THEN 'all'::"PhotoConsentLevel"
  WHEN picked.codes && ARRAY['promo_on_request'] THEN 'promoOnRequest'::"PhotoConsentLevel"
  WHEN picked.codes && ARRAY['internal'] THEN 'internal'::"PhotoConsentLevel"
  ELSE NULL
END
FROM (
  SELECT c2."id",
         COALESCE(
           ARRAY_AGG(p."code") FILTER (WHERE ch."chosen" AND p."id" IS NOT NULL),
           ARRAY[]::TEXT[]
         ) AS codes
  FROM "PhotoConsent" c2
  LEFT JOIN "PhotoConsentChoice" ch ON ch."consentId" = c2."id"
  LEFT JOIN "PhotoConsentPurpose" p ON p."id" = ch."purposeId"
  GROUP BY c2."id"
) picked
WHERE picked."id" = c."id";

UPDATE "PhotoConsentVersion" v
SET "level" = CASE
  WHEN v."status" = 'noPhotos' OR picked.codes && ARRAY['none'] THEN 'none'::"PhotoConsentLevel"
  WHEN picked.codes && ARRAY['promo'] THEN 'all'::"PhotoConsentLevel"
  WHEN picked.codes && ARRAY['promo_on_request'] THEN 'promoOnRequest'::"PhotoConsentLevel"
  WHEN picked.codes && ARRAY['internal'] THEN 'internal'::"PhotoConsentLevel"
  ELSE NULL
END
FROM (
  SELECT v2."id",
         COALESCE(
           ARRAY_AGG(e->>'code') FILTER (WHERE (e->>'chosen')::BOOLEAN),
           ARRAY[]::TEXT[]
         ) AS codes
  FROM "PhotoConsentVersion" v2
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(v2."purposesSnapshot") = 'array' THEN v2."purposesSnapshot" ELSE '[]'::jsonb END
  ) e ON TRUE
  GROUP BY v2."id"
) picked
WHERE picked."id" = v."id";
