-- „Licht & Ton“ (crew_tech) meint Licht und Ton, nicht das übergeordnete Gewerk Technik.
UPDATE "DepartmentTemplate" SET "preferenceCodes" = ARRAY[]::TEXT[] WHERE "slug" = 'technik';
