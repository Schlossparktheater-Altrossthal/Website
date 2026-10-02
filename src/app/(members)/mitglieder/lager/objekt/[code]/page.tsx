import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetActions } from "@/components/inventory/asset-actions";
import { AssetThumb } from "@/components/inventory/asset-thumb";
import { DefectList } from "@/components/inventory/defect-list";
import { NoInventoryAccess } from "@/components/inventory/no-access";
import { PhotoStrip } from "@/components/inventory/photo-strip";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PageHeader } from "@/components/members/page-header";
import { AlertTriangleIcon, FileIcon, MapPinIcon, PackageIcon } from "@/components/ui/action-icons";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import {
  ASSET_KIND_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  attributeFieldsFor,
  CONDITION_LABELS,
  formatInventoryDate,
  formatInventoryDateTime,
  INSPECTION_RESULT_LABELS,
  INSPECTION_STATE_LABELS,
  INSPECTION_STATE_TONES,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  inventoryLocationPath,
} from "@/lib/inventory/constants";
import {
  getInventoryAssetDetail,
  listContainerOptions,
  listLocationOptions,
} from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

function personName(
  person: { firstName: string | null; lastName: string | null; name: string | null } | null,
) {
  if (!person) return null;
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.name;
}

const CARD = "space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm";

export default async function AssetDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await requireAuth();
  const access = await getInventoryAccess(session.user);
  if (!access.canUse) return <NoInventoryAccess />;
  const { code } = await params;
  const asset = await getInventoryAssetDetail(decodeURIComponent(code).toUpperCase(), {
    includeCost: access.canManage,
  });
  if (!asset) notFound();
  const [locations, containers] = await Promise.all([
    listLocationOptions(),
    listContainerOptions(),
  ]);

  const placement: PlacementTarget = asset.containerId
    ? { type: "container", id: asset.containerId }
    : asset.locationId
      ? { type: "location", id: asset.locationId }
      : { type: "none" };
  const locked = asset.status === "locked";
  const attributes = attributeFieldsFor(asset.area.prefix)
    .map((field) => ({ label: field.label, value: asset.attributes[field.key] }))
    .filter((entry): entry is { label: string; value: string } => Boolean(entry.value));
  const details: { label: string; value: string }[] = [
    { label: "Art", value: ASSET_KIND_LABELS[asset.kind] },
    { label: "Zustand", value: CONDITION_LABELS[asset.condition] },
    ...(asset.manufacturer ? [{ label: "Hersteller", value: asset.manufacturer }] : []),
    ...(asset.model ? [{ label: "Modell", value: asset.model }] : []),
    ...(asset.serialNumber ? [{ label: "Seriennummer", value: asset.serialNumber }] : []),
    ...attributes,
    ...(asset.lastSeenAt
      ? [{ label: "Zuletzt gesehen", value: formatInventoryDate(asset.lastSeenAt) }]
      : []),
  ];
  const purchase: { label: string; value: string }[] = access.canManage
    ? [
        ...(asset.acquisitionCost !== null
          ? [
              {
                label: "Anschaffungspreis",
                value: new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: "EUR",
                }).format(asset.acquisitionCost),
              },
            ]
          : []),
        ...(asset.purchaseDate
          ? [{ label: "Kaufdatum", value: formatInventoryDate(asset.purchaseDate) }]
          : []),
        ...(asset.supplier ? [{ label: "Händler", value: asset.supplier }] : []),
        ...(asset.ownership ? [{ label: "Eigentum", value: asset.ownership }] : []),
      ]
    : [];
  const unit = asset.unit ?? "Stk.";

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset.name}
        breadcrumbs={[
          membersNavigationBreadcrumb(INVENTORY_BASE_PATH),
          { id: "asset", label: asset.code },
        ]}
      />

      {locked ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive"
        >
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Gesperrt – nicht benutzen</p>
            <p className="text-sm">Erst wieder freigeben, wenn der Mangel behoben ist.</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={CARD}>
            <div className="flex items-start gap-4">
              {asset.photos.length ? null : (
                <AssetThumb photoId={null} kind={asset.kind} size="lg" />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-lg leading-tight font-semibold break-words text-foreground">
                  {asset.name}
                </h2>
                <p className="font-mono text-sm text-muted-foreground">{asset.code}</p>
                <p className="text-sm text-muted-foreground">
                  {[asset.area.name, asset.category?.name].filter(Boolean).join(" · ")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ToneBadge tone={ASSET_STATUS_TONES[asset.status]}>
                    {ASSET_STATUS_LABELS[asset.status]}
                  </ToneBadge>
                  {asset.inspectionState !== "none" ? (
                    <ToneBadge tone={INSPECTION_STATE_TONES[asset.inspectionState]}>
                      {asset.inspectionState === "ok" || asset.inspectionState === "soon"
                        ? `Geprüft bis ${formatInventoryDate(asset.nextInspectionAt)}`
                        : INSPECTION_STATE_LABELS[asset.inspectionState]}
                    </ToneBadge>
                  ) : null}
                  {asset.kind === "bulk" ? (
                    <ToneBadge
                      tone={
                        asset.minQuantity !== null && asset.quantity < asset.minQuantity
                          ? "warning"
                          : "muted"
                      }
                    >
                      {asset.quantity} {unit}
                      {asset.minQuantity !== null ? ` (min. ${asset.minQuantity})` : ""}
                    </ToneBadge>
                  ) : null}
                  {!asset.labelPrintedAt ? <ToneBadge tone="info">Kein Etikett</ToneBadge> : null}
                </div>
              </div>
            </div>
            {asset.photos.length ? (
              <PhotoStrip photoIds={asset.photos.map((photo) => photo.id)} alt={asset.name} />
            ) : null}
          </section>

          <AssetActions
            asset={{
              id: asset.id,
              code: asset.code,
              name: asset.name,
              kind: asset.kind,
              status: asset.status,
              unit: asset.unit,
              inspectionIntervalMonths: asset.inspectionIntervalMonths,
              placement,
            }}
            stocks={asset.stocks.map((stock) => ({
              id: stock.id,
              quantity: stock.quantity,
              target: stock.container
                ? { type: "container", id: stock.container.id }
                : stock.locationId
                  ? { type: "location", id: stock.locationId }
                  : { type: "none" },
              label: stock.container
                ? `${stock.container.code} ${stock.container.name}`
                : (stock.locationPath ?? "ohne Ort"),
            }))}
            options={{ locations, containers }}
            canManage={access.canManage}
          />

          <section className={CARD}>
            <SectionHeader title={asset.kind === "bulk" ? "Bestände" : "Lagerplatz"} />
            {asset.kind === "bulk" ? (
              asset.stocks.length ? (
                <ListRowGroup>
                  {asset.stocks.map((stock) => (
                    <ListRow
                      key={stock.id}
                      density="compact"
                      leading={<MapPinIcon className="h-4 w-4 text-muted-foreground" />}
                      title={
                        stock.container
                          ? `${stock.container.code} ${stock.container.name}`
                          : (stock.locationPath ?? "ohne Ort")
                      }
                      trailing={
                        <span className="text-sm font-medium text-foreground">
                          {stock.quantity} {unit}
                        </span>
                      }
                      href={stock.container ? inventoryAssetPath(stock.container.code) : undefined}
                    />
                  ))}
                </ListRowGroup>
              ) : (
                <p className="text-sm text-muted-foreground">Noch kein Bestand erfasst.</p>
              )
            ) : asset.container ? (
              <ListRow
                href={inventoryAssetPath(asset.container.code)}
                leading={<PackageIcon className="h-5 w-5 text-muted-foreground" />}
                title={`${asset.container.code} ${asset.container.name}`}
                description={asset.containerPath ?? "Kiste ohne Ort"}
              />
            ) : asset.location ? (
              <ListRow
                href={inventoryLocationPath(asset.location.code)}
                leading={<MapPinIcon className="h-5 w-5 text-muted-foreground" />}
                title={asset.locationPath ?? asset.location.name}
                description={asset.location.code}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Noch keinem Ort zugeordnet.</p>
            )}
            {asset.checkoutLines.length ? (
              <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm">
                Ausgegeben:{" "}
                {asset.checkoutLines.map((line, index) => (
                  <span key={line.checkout.id}>
                    {index ? ", " : ""}
                    <Link
                      href={`${INVENTORY_BASE_PATH}/ausgaben/${line.checkout.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {line.checkout.title}
                    </Link>
                    {asset.kind === "bulk"
                      ? ` (${line.quantity - line.returnedQuantity} ${unit})`
                      : ""}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {asset.kind === "container" ? (
            <section className={CARD}>
              <SectionHeader
                title={`Inhalt (${asset.contents.length + asset.storedStocks.length})`}
                action={
                  <Link
                    href={`${INVENTORY_BASE_PATH}/scannen?modus=einlagern&ziel=${encodeURIComponent(asset.code)}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Einscannen
                  </Link>
                }
              />
              {asset.contents.length || asset.storedStocks.length ? (
                <ListRowGroup>
                  {asset.contents.map((item) => (
                    <ListRow
                      key={item.id}
                      density="compact"
                      href={inventoryAssetPath(item.code)}
                      title={item.name}
                      description={item.code}
                      trailing={
                        item.status !== "available" ? (
                          <ToneBadge tone={ASSET_STATUS_TONES[item.status]}>
                            {ASSET_STATUS_LABELS[item.status]}
                          </ToneBadge>
                        ) : null
                      }
                    />
                  ))}
                  {asset.storedStocks.map((stock) => (
                    <ListRow
                      key={stock.asset.id}
                      density="compact"
                      href={inventoryAssetPath(stock.asset.code)}
                      title={stock.asset.name}
                      description={stock.asset.code}
                      trailing={`${stock.quantity} ${stock.asset.unit ?? "Stk."}`}
                    />
                  ))}
                </ListRowGroup>
              ) : (
                <p className="text-sm text-muted-foreground">Die Kiste ist leer.</p>
              )}
            </section>
          ) : null}

          <section className={CARD}>
            <SectionHeader title="Mängel" />
            <DefectList
              defects={asset.defects.map((defect) => ({
                id: defect.id,
                title: defect.title,
                description: defect.description,
                severity: defect.severity,
                status: defect.status,
                resolutionNote: defect.resolutionNote,
                resolvedAt: defect.resolvedAt?.toISOString() ?? null,
                createdAt: defect.createdAt.toISOString(),
                reporter: personName(defect.reportedBy),
                photoIds: defect.photos.map((photo) => photo.id),
              }))}
            />
          </section>

          {asset.inspectionRequired || asset.inspections.length ? (
            <section className={CARD}>
              <SectionHeader
                title="Prüfungen"
                description={
                  asset.inspectionRequired
                    ? `Alle ${asset.inspectionIntervalMonths ?? 12} Monate · nächste ${formatInventoryDate(asset.nextInspectionAt)}`
                    : undefined
                }
              />
              {asset.inspections.length ? (
                <ListRowGroup>
                  {asset.inspections.map((inspection) => (
                    <ListRow
                      key={inspection.id}
                      density="compact"
                      title={`${inspection.kind} · ${formatInventoryDate(inspection.inspectedAt)}`}
                      description={
                        [inspection.inspectorName, inspection.note].filter(Boolean).join(" · ") ||
                        undefined
                      }
                      trailing={
                        <>
                          {inspection.documentName ? (
                            <a
                              href={`/api/lager/inspections/${inspection.id}/document`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary"
                              aria-label="Prüfprotokoll öffnen"
                            >
                              <FileIcon className="h-4 w-4" />
                            </a>
                          ) : null}
                          <ToneBadge
                            tone={inspection.result === "passed" ? "success" : "destructive"}
                          >
                            {INSPECTION_RESULT_LABELS[inspection.result]}
                          </ToneBadge>
                        </>
                      }
                    />
                  ))}
                </ListRowGroup>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Prüfung eingetragen.</p>
              )}
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className={CARD}>
            <SectionHeader title="Angaben" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {details.map((entry) => (
                <div key={entry.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{entry.label}</dt>
                  <dd className="break-words text-foreground">{entry.value}</dd>
                </div>
              ))}
            </dl>
            {asset.description ? (
              <p className="text-sm whitespace-pre-line text-foreground">{asset.description}</p>
            ) : null}
            {asset.publicNote ? (
              <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Öffentlicher Hinweis</p>
                {asset.publicNote}
              </div>
            ) : null}
            {asset.internalNote ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Interne Notiz</p>
                <p className="whitespace-pre-line">{asset.internalNote}</p>
              </div>
            ) : null}
          </section>

          {purchase.length ? (
            <section className={CARD}>
              <SectionHeader title="Anschaffung" description="Nur für die Lagerverwaltung" />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {purchase.map((entry) => (
                  <div key={entry.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{entry.label}</dt>
                    <dd className="break-words text-foreground">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className={CARD}>
            <SectionHeader title="Verlauf" />
            {asset.events.length ? (
              <ol className="space-y-3">
                {asset.events.map((event) => (
                  <li key={event.id} className="border-l-2 border-border pl-3">
                    <p className="text-sm text-foreground">{event.message ?? event.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatInventoryDateTime(event.createdAt)}
                      {event.user ? ` · ${personName(event.user)}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
