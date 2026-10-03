import { AssetThumb } from "@/components/inventory/asset-thumb";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { inventoryAssetPath, inventoryProductPath } from "@/lib/inventory/constants";
import type { InventoryProductListItem } from "@/lib/inventory/queries";

/**
 * Bestand nach Artikeltyp: ein Eintrag je Typ mit Anzahl, Verfügbarkeit und Orten. Typen mit nur
 * einem Exemplar führen direkt zum Exemplar.
 */
export function ProductList({ items }: { items: InventoryProductListItem[] }) {
  return (
    <ListRowGroup variant="inset" className="bg-card">
      {items.map((item) => (
        <ListRow
          key={item.id}
          href={
            item.singleCode
              ? inventoryAssetPath(item.singleCode)
              : inventoryProductPath(item.publicId)
          }
          leading={<AssetThumb photoId={item.photoId} kind={item.kind} />}
          title={item.name}
          description={<ProductSummary item={item} />}
          trailing={<ProductSignals item={item} />}
        />
      ))}
    </ListRowGroup>
  );
}

function placesText(places: string[]) {
  if (!places.length) return "ohne Ort";
  return places.length > 1 ? `${places[0]} + ${places.length - 1} weitere` : places[0];
}

function ProductSummary({ item }: { item: InventoryProductListItem }) {
  const amount =
    item.kind === "bulk"
      ? `${item.total} ${item.unit ?? "Stk."}`
      : item.singleCode
        ? item.singleCode
        : `${item.total} Stück`;
  return (
    <>
      <span className={item.singleCode ? "font-mono" : "font-medium text-foreground"}>
        {amount}
      </span>
      {item.categoryPath ? <span className="hidden sm:inline"> · {item.categoryPath}</span> : null}
      {` · ${placesText(item.places)}`}
    </>
  );
}

function ProductSignals({ item }: { item: InventoryProductListItem }) {
  const { counts } = item;
  const signals: React.ReactNode[] = [];
  if (item.kind !== "bulk" && item.total > 1) {
    const free = counts.available;
    signals.push(
      <ToneBadge
        key="free"
        tone={free === 0 ? "destructive" : free < item.total ? "info" : "success"}
      >
        {free}/{item.total} frei
      </ToneBadge>,
    );
  } else if (item.kind !== "bulk" && item.total === 1 && counts.available === 0) {
    const status = counts.checked_out
      ? "Ausgegeben"
      : counts.repair
        ? "Reparatur"
        : counts.locked
          ? "Gesperrt"
          : "Vermisst";
    signals.push(
      <ToneBadge key="single" tone={counts.checked_out ? "info" : "warning"}>
        {status}
      </ToneBadge>,
    );
  }
  const broken = counts.repair + counts.locked;
  if (broken && item.total > 1) {
    signals.push(
      <ToneBadge key="broken" tone={counts.locked ? "destructive" : "warning"}>
        {broken} defekt
      </ToneBadge>,
    );
  }
  if (counts.missing && item.total > 1) {
    signals.push(
      <ToneBadge key="missing" tone="destructive">
        {counts.missing} vermisst
      </ToneBadge>,
    );
  }
  if (item.low) {
    signals.push(
      <ToneBadge key="low" tone="warning">
        Nachkaufen
      </ToneBadge>,
    );
  }
  if (!signals.length) return null;
  return (
    <>
      <span className="sm:hidden">{signals[0]}</span>
      <span className="hidden items-center gap-1 sm:flex">{signals}</span>
    </>
  );
}
