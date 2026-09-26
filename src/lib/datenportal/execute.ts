import { allowedFields, type DataPortalQuery, type FieldDefinition } from "./fields";
import type { PortalAccess } from "./access";
import {
  PortalFieldError,
  applyQuery,
  groupRows,
  loadSourceRows,
  projectRows,
  type PortalRow,
} from "./run";

export type PortalResult = { columns: FieldDefinition[]; rows: PortalRow[] };

/** Führt eine Abfrage aus. Wirft `PortalFieldError`, wenn Felder nicht erlaubt sind. */
export async function executePortalQuery(
  query: DataPortalQuery,
  access: PortalAccess,
): Promise<PortalResult> {
  const fields = allowedFields(query.source, access.grants);
  const rows = await loadSourceRows(query.source, query.showId, {
    includeInactive: query.includeInactive,
  });
  const filtered = applyQuery(rows, query, fields);
  if (query.groupBy) {
    const groupField = fields.find((field) => field.key === query.groupBy);
    if (!groupField) throw new PortalFieldError(query.groupBy);
    return groupRows(filtered, groupField);
  }
  return projectRows(filtered, query.columns, fields);
}
