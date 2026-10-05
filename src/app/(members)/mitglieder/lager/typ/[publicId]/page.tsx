import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetThumb } from "@/components/inventory/asset-thumb";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PhotoStrip } from "@/components/inventory/photo-strip";
import { SetComponentsEditor } from "@/components/inventory/set-components-editor";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { EditIcon, PlusIcon, PrinterIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import {
  ASSET_KIND_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  CONDITION_LABELS,
  INSPECTION_STATE_TONES,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  inventoryProductPath,
  type AssetStatus,
} from "@/lib/inventory/constants";
import { getInventoryProductDetail } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

const CARD = "space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm";

const SUMMARY_ORDER: AssetStatus[] = ["available", "checked_out", "repair", "locked", "missing"];

/** Artikeltyp: Stammdaten, Merkmale und alle Exemplare nach Ort. */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { publicId } = await params;
  const product = await getInventoryProductDetail(decodeURIComponent(publicId));
  if (!product) notFound();

  const bulk = product.kind === "bulk";
  const isSet = product.kind === "set";
  const unit = product.unit ?? "Stk.";
  const details = [
    { label: "Art", value: ASSET_KIND_LABELS[product.kind] },
    ...(product.manufacturer ? [{ label: "Hersteller", value: product.manufacturer }] : []),
    ...(product.model ? [{ label: "Modell", value: product.model }] : []),
    ...product.specRows,
    ...(product.inspectionRequired
      ? [{ label: "Prüfung", value: `alle ${product.inspectionIntervalMonths ?? 12} Monate` }]
      : []),
    ...(bulk && product.minQuantity !== null
      ? [{ label: "Mindestbestand", value: `${product.minQuantity} ${unit}` }]
      : []),
  ];
  const labelsHref = `${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(product.activeCodes.join(","))}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={[product.area.name, product.categoryPath].filter(Boolean).join(" · ")}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "product", label: product.name },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`${inventoryProductPath(product.publicId)}/bearbeiten`}>
                <EditIcon className="mr-2 h-4 w-4" />
                Bearbeiten
              </Link>
            </Button>
            {!bulk && !isSet ? (
              <Button asChild size="sm">
                <Link href={`${INVENTORY_BASE_PATH}/neu?typ=${product.publicId}`}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Weitere Exemplare
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isSet ? (
            <section className={CARD}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-2xl font-semibold text-foreground tabular-nums">
                  {product.setCapacity} {product.setCapacity === 1 ? "Set" : "Sets"}
                </p>
                <p className="text-sm text-muted-foreground">
                  lassen sich aus dem heutigen Bestand zusammenstellen
                </p>
              </div>
              <SectionHeader title="Bestandteile" description="Menge je Set · nutzbar im Lager" />
              <ListRowGroup>
                {product.components.map((component) => (
                  <ListRow
                    key={component.productId}
                    density="compact"
                    href={inventoryProductPath(component.publicId)}
                    leading={
                      <AssetThumb photoId={component.photoId} kind={component.kind} size="sm" />
                    }
                    title={`${component.quantity} × ${component.name}`}
                    trailing={
                      <ToneBadge
                        tone={component.capacity >= component.quantity ? "success" : "destructive"}
                      >
                        {component.capacity} da
                      </ToneBadge>
                    }
                  />
                ))}
              </ListRowGroup>
              <SetComponentsEditor
                setId={product.id}
                initial={product.components.map((component) => ({
                  productId: component.productId,
                  name: component.name,
                  kind: component.kind,
                  photoId: component.photoId,
                  quantity: component.quantity,
                }))}
              />
            </section>
          ) : null}
          {!isSet ? (
            <>
              <section className={CARD}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-2xl font-semibold text-foreground tabular-nums">
                    {product.total} {bulk ? unit : product.total === 1 ? "Exemplar" : "Exemplare"}
                  </p>
                  {!bulk ? (
                    <p className="text-sm text-muted-foreground">
                      {product.counts.available} im Lager verfügbar
                    </p>
                  ) : null}
                </div>
                {!bulk ? (
                  <div className="flex flex-wrap gap-1.5">
                    {SUMMARY_ORDER.filter((status) => product.counts[status] > 0).map((status) => (
                      <ToneBadge key={status} tone={ASSET_STATUS_TONES[status]}>
                        {product.counts[status]} {ASSET_STATUS_LABELS[status]}
                      </ToneBadge>
                    ))}
                  </div>
                ) : null}
              </section>

              {product.placeGroups.map((group) => (
                <section key={group.place} className={CARD}>
                  <SectionHeader
                    title={group.place}
                    description={
                      bulk
                        ? undefined
                        : `${group.exemplars.length} ${group.exemplars.length === 1 ? "Exemplar" : "Exemplare"}`
                    }
                  />
                  <ListRowGroup>
                    {group.exemplars.flatMap((exemplar) =>
                      bulk
                        ? exemplar.stocks.map((stock) => (
                            <ListRow
                              key={`${exemplar.id}-${stock.place}`}
                              density="compact"
                              href={inventoryAssetPath(exemplar.code)}
                              title={stock.place}
                              trailing={
                                <span className="text-sm font-medium text-foreground">
                                  {stock.quantity} {unit}
                                </span>
                              }
                            />
                          ))
                        : [
                            <ListRow
                              key={exemplar.id}
                              density="compact"
                              href={inventoryAssetPath(exemplar.code)}
                              title={
                                <span>
                                  <span className="font-mono">{exemplar.code}</span>
                                  {exemplar.label ? ` · ${exemplar.label}` : ""}
                                </span>
                              }
                              description={[
                                CONDITION_LABELS[exemplar.condition],
                                exemplar.serialNumber ? `SN ${exemplar.serialNumber}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                              trailing={
                                <span className="flex items-center gap-1">
                                  {exemplar.status !== "available" ? (
                                    <ToneBadge tone={ASSET_STATUS_TONES[exemplar.status]}>
                                      {ASSET_STATUS_LABELS[exemplar.status]}
                                    </ToneBadge>
                                  ) : null}
                                  {exemplar.openDefects && exemplar.status === "available" ? (
                                    <ToneBadge tone="warning">Mangel</ToneBadge>
                                  ) : null}
                                  {exemplar.inspection === "overdue" ||
                                  exemplar.inspection === "failed" ? (
                                    <ToneBadge tone={INSPECTION_STATE_TONES[exemplar.inspection]}>
                                      Prüfung
                                    </ToneBadge>
                                  ) : null}
                                </span>
                              }
                            />,
                          ],
                    )}
                  </ListRowGroup>
                </section>
              ))}
            </>
          ) : null}
          {!product.exemplars.length && !isSet ? (
            <p className="text-sm text-muted-foreground">Noch keine Exemplare erfasst.</p>
          ) : null}
          {product.usedInSets.length ? (
            <section className={CARD}>
              <SectionHeader title="Steckt in Sets" />
              <ul className="space-y-1 text-sm">
                {product.usedInSets.map((entry) => (
                  <li key={entry.publicId}>
                    <Link
                      href={inventoryProductPath(entry.publicId)}
                      className="font-medium text-primary hover:underline"
                    >
                      {entry.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">({entry.quantity} je Set)</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className={CARD}>
            {product.photos.length ? (
              <PhotoStrip photoIds={product.photos.map((photo) => photo.id)} alt={product.name} />
            ) : (
              <AssetThumb photoId={null} kind={product.kind} size="lg" />
            )}
            <SectionHeader title="Angaben" description="Gelten für alle Exemplare" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {details.map((entry) => (
                <div key={entry.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{entry.label}</dt>
                  <dd className="break-words text-foreground">{entry.value}</dd>
                </div>
              ))}
            </dl>
            {product.tags.length ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Tags">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`${INVENTORY_BASE_PATH}?tag=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground hover:border-primary"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            ) : null}
            {product.description ? (
              <p className="text-sm whitespace-pre-line text-foreground">{product.description}</p>
            ) : null}
            {product.publicNote ? (
              <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Öffentlicher Hinweis</p>
                {product.publicNote}
              </div>
            ) : null}
          </section>
          {product.activeCodes.length ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={labelsHref}>
                <PrinterIcon className="mr-2 h-4 w-4" />
                Etiketten für{" "}
                {product.activeCodes.length === 1 ? "dieses" : `alle ${product.activeCodes.length}`}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
