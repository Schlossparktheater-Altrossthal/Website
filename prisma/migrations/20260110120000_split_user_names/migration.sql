ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

WITH prepared AS (
  SELECT
    id,
    NULLIF(BTRIM(name), '') AS trimmed_name,
    CASE
      WHEN name IS NULL OR BTRIM(name) = '' THEN ARRAY[]::text[]
      ELSE regexp_split_to_array(BTRIM(name), '\\s+')
    END AS parts
  FROM "User"
)
UPDATE "User" AS u
SET
  "firstName" = CASE
    WHEN p.trimmed_name IS NULL THEN NULL
    WHEN POSITION(',' IN p.trimmed_name) > 0 THEN NULLIF(BTRIM(split_part(p.trimmed_name, ',', 2)), '')
    WHEN COALESCE(array_length(p.parts, 1), 0) >= 1 THEN NULLIF(BTRIM(p.parts[1]), '')
    ELSE NULL
  END,
  "lastName" = CASE
    WHEN p.trimmed_name IS NULL THEN NULL
    WHEN POSITION(',' IN p.trimmed_name) > 0 THEN NULLIF(BTRIM(split_part(p.trimmed_name, ',', 1)), '')
    WHEN COALESCE(array_length(p.parts, 1), 0) > 1 THEN NULLIF(
      BTRIM(array_to_string(p.parts[2:COALESCE(array_length(p.parts, 1), 0)], ' ')),
      ''
    )
    ELSE NULL
  END
FROM prepared AS p
WHERE p.id = u.id;

UPDATE "User"
SET "name" = NULLIF(BTRIM(concat_ws(' ', "firstName", "lastName")), '')
WHERE "firstName" IS NOT NULL OR "lastName" IS NOT NULL;
