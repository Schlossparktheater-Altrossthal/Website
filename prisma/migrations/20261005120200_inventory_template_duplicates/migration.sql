-- Korrektur zu 20261005120100: Vorlagen-Merkmale (Maße, Gewicht) entfernen, wenn es im Bereich
-- schon ein von Hand angelegtes Merkmal mit derselben Bezeichnung gibt (anderer Schlüssel).
-- Werte der Vorlagen-Merkmale gibt es dann noch nicht – sie wurden eben erst angelegt.
DELETE FROM "InventoryFieldDef" t
WHERE t.id IN ('inv_f_t_weight', 'inv_f_b_dims', 'inv_f_r_dims')
  AND EXISTS (
    SELECT 1 FROM "InventoryFieldDef" f
    LEFT JOIN "InventoryCategory" c ON c.id = f."categoryId"
    WHERE f.id <> t.id
      AND lower(f.label) = lower(t.label)
      AND coalesce(f."areaId", c."areaId") = t."areaId"
  );
