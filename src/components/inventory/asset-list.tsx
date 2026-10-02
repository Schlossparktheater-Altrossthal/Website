import { AssetThumb } from "@/components/inventory/asset-thumb";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  INSPECTION_STATE_TONES,
  inventoryAssetPath,
} from "@/lib/inventory/constants";
import type { InventoryListItem } from "@/lib/inventory/queries";

/** Zeilenliste des Bestands: Foto, Name, Code + Ort, rechts nur Auffälligkeiten. */
export function AssetList({ items }: { items: InventoryListItem[] }) {
  return (
    <ListRowGroup variant="inset" className="bg-card">
      {items.map((item) => (
        <ListRow
          key={item.id}
          href={inventoryAssetPath(item.code)}
          leading={<AssetThumb photoId={item.photoId} kind={item.kind} />}
          title={item.name}
          description={
            <>
              <span className="font-mono">{item.code}</span>
              {item.kind === "bulk" ? ` · ${item.quantity} ${item.unit ?? "Stk."}` : null}
              {item.place ? ` · ${item.place}` : " · ohne Ort"}
            </>
          }
          trailing={<AssetSignals item={item} />}
        />
      ))}
    </ListRowGroup>
  );
}

function AssetSignals({ item }: { item: InventoryListItem }) {
  const signals: React.ReactNode[] = [];
  if (item.status !== "available") {
    signals.push(
      <ToneBadge key="status" tone={ASSET_STATUS_TONES[item.status]}>
        {ASSET_STATUS_LABELS[item.status]}
      </ToneBadge>,
    );
  }
  if (item.openDefects > 0 && item.status !== "locked") {
    signals.push(
      <ToneBadge key="defects" tone="warning">
        {item.openDefects === 1 ? "Mangel" : `${item.openDefects} Mängel`}
      </ToneBadge>,
    );
  }
  if (item.inspection === "overdue" || item.inspection === "soon" || item.inspection === "failed") {
    signals.push(
      <ToneBadge key="inspection" tone={INSPECTION_STATE_TONES[item.inspection]}>
        Prüfung
      </ToneBadge>,
    );
  }
  if (!signals.length) return null;
  // Auf dem Handy nur das wichtigste Signal, damit der Name Platz behält.
  return (
    <>
      <span className="sm:hidden">{signals[0]}</span>
      <span className="hidden items-center gap-1 sm:flex">{signals}</span>
    </>
  );
}
