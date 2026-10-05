-- Lager 3 (docs/Plan/lager-kategorien-plan.md, Phase 7): Vorlagen an die neuen Merkmaltypen
-- anpassen. Eigene Migration, weil neue Enum-Werte erst nach dem Commit nutzbar sind.

-- Leistung als Messwert: Werte stehen schon in W (Basiseinheit) – nur der Typ ändert sich.
UPDATE "InventoryFieldDef" SET "type" = 'measure'
WHERE id IN ('inv_f_t_power', 'inv_f_w_power', 'inv_f_amp_power4') AND "type" = 'number';

-- Epoche und Farbe sind Querliegendes → Tags. Vorhandene Werte werden zu Tags der Typen.
INSERT INTO "InventoryTag" ("id", "name")
SELECT 'inv_tag_' || md5(lower(v.value)), (array_agg(v.value ORDER BY v.value COLLATE "C"))[1]
FROM "InventoryProduct" p
CROSS JOIN LATERAL (
  SELECT trim(p.specs ->> 'era') AS value
  UNION ALL SELECT trim(p.specs ->> 'color')
) v
WHERE p."areaId" = 'inv_area_kostuem' AND coalesce(v.value, '') <> ''
GROUP BY lower(v.value)
ON CONFLICT DO NOTHING;

INSERT INTO "_InventoryProductToInventoryTag" ("A", "B")
SELECT DISTINCT p.id, t.id
FROM "InventoryProduct" p
CROSS JOIN LATERAL (
  SELECT trim(p.specs ->> 'era') AS value
  UNION ALL SELECT trim(p.specs ->> 'color')
) v
JOIN "InventoryTag" t ON lower(t.name) = lower(v.value)
WHERE p."areaId" = 'inv_area_kostuem' AND coalesce(v.value, '') <> ''
ON CONFLICT DO NOTHING;

DELETE FROM "InventoryFieldDef" WHERE id IN ('inv_f_k_era', 'inv_f_k_color');

-- Feste Datentypen als Vorlage: Maße für Bühnenbau und Requisite, Gewicht in der Technik.
INSERT INTO "InventoryFieldDef" ("id", "areaId", "key", "label", "type", "unit", "sortOrder")
SELECT v.id, v."areaId", v.key, v.label, v.type::"InventoryFieldType", v.unit, v."sortOrder"
FROM (VALUES
  ('inv_f_b_dims', 'inv_area_buehnenbau', 'dimensions', 'Maße', 'dimensions', 'cm', 0),
  ('inv_f_r_dims', 'inv_area_requisite', 'dimensions', 'Maße', 'dimensions', 'cm', 0),
  ('inv_f_t_weight', 'inv_area_technik', 'weight', 'Gewicht', 'measure', 'kg', 2)
) AS v(id, "areaId", key, label, type, unit, "sortOrder")
WHERE EXISTS (SELECT 1 FROM "InventoryArea" a WHERE a.id = v."areaId")
  AND NOT EXISTS (
    SELECT 1 FROM "InventoryFieldDef" f
    LEFT JOIN "InventoryCategory" c ON c.id = f."categoryId"
    WHERE f.key = v.key AND (f."areaId" = v."areaId" OR c."areaId" = v."areaId")
  );
