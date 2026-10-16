-- Alte Onboarding-Wunsch-Codes den Gewerks-Blaupausen zuordnen (Entscheidung 2026-10-16),
-- damit Wünsche wie „Kostüm“ beim Gewerk „Kostüme“ landen statt als eigener Bereich.
UPDATE "DepartmentTemplate" SET "preferenceCodes" = ARRAY['crew_stage', 'crew_props'] WHERE "slug" = 'buehnenbau';
UPDATE "DepartmentTemplate" SET "preferenceCodes" = ARRAY['crew_costume'] WHERE "slug" = 'kostueme';
UPDATE "DepartmentTemplate" SET "preferenceCodes" = ARRAY['crew_tech'] WHERE "slug" = 'technik';
UPDATE "DepartmentTemplate" SET "preferenceCodes" = ARRAY['crew_marketing'] WHERE "slug" = 'social-media-werbung';
UPDATE "DepartmentTemplate" SET "preferenceCodes" = ARRAY['crew_music'] WHERE "slug" = 'musik-sounddesign-atmosphare';

-- Neue Blaupausen für bisher gewerklose Wünsche; das Gewerk legt die Regie in der Produktion an.
INSERT INTO "DepartmentTemplate" ("id", "slug", "name", "description", "preferenceCodes", "sortOrder", "updatedAt")
SELECT 'tpl_maske_' || substr(md5(random()::text), 1, 12), 'maske', 'Maske & Make-up',
       'Maskenbild, Styling, Perücken und schnelle Verwandlungen hinter der Bühne.',
       ARRAY['crew_makeup'], 70, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "DepartmentTemplate" WHERE "slug" = 'maske');

INSERT INTO "DepartmentTemplate" ("id", "slug", "name", "description", "preferenceCodes", "sortOrder", "updatedAt")
SELECT 'tpl_regie_' || substr(md5(random()::text), 1, 12), 'regieassistenz-orga', 'Regieassistenz & Orga',
       'Probenplanung, Organisation und Unterstützung der Regie.',
       ARRAY['crew_direction'], 80, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "DepartmentTemplate" WHERE "slug" = 'regieassistenz-orga');
