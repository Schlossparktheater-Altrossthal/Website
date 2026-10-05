import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ToneBadge } from "@/components/inventory/tone-badge";
import { AlertTriangleIcon, ShieldCheckIcon } from "@/components/ui/action-icons";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  formatInventoryDate,
  INSPECTION_STATE_LABELS,
  INSPECTION_STATE_TONES,
  inventoryAssetPath,
  inventoryLocationPath,
  isLocationCode,
  parseInventoryCode,
} from "@/lib/inventory/constants";
import { isPublicId } from "@/lib/inventory/public-id";
import { getPublicAssetView } from "@/lib/inventory/queries";
import { getInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { DEFAULT_SITE_TITLE } from "@/lib/website-settings";

export const metadata: Metadata = {
  title: "Inventar",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Ziel der QR-Codes auf den Etiketten: `/i/<publicId>` mit zufälliger, nicht erratbarer Kennung.
 * Mitglieder mit Lagerzugriff landen direkt in der Lageransicht, alle anderen sehen eine
 * öffentliche Kurzinfo – ohne Preise, Notizen oder Personen. Lesbare Codes (`/i/T-42-3`) lösen
 * nur mit Lagerzugriff auf, damit sich der Bestand von außen nicht durchprobieren lässt.
 */
export default async function PublicInventoryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const value = decodeURIComponent(raw).trim();

  const session = await getSession().catch(() => null);
  const access = session?.user ? await getInventoryAccess(session.user) : null;

  if (!isPublicId(value)) {
    const code = parseInventoryCode(value);
    if (!code || !access?.canUse) notFound();
    redirect(isLocationCode(code) ? inventoryLocationPath(code) : inventoryAssetPath(code));
  }

  const [location, assetCode] = await Promise.all([
    prisma.inventoryLocation.findUnique({
      where: { publicId: value },
      select: { code: true, name: true },
    }),
    prisma.inventoryAsset.findUnique({ where: { publicId: value }, select: { code: true } }),
  ]);
  const target = location
    ? inventoryLocationPath(location.code)
    : assetCode
      ? inventoryAssetPath(assetCode.code)
      : null;
  if (!target) notFound();
  if (access?.canUse) redirect(target);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(target)}`;

  if (location) {
    return (
      <PublicShell loginHref={session?.user ? null : loginHref}>
        <p className="font-mono text-sm text-muted-foreground">{location.code}</p>
        <h1 className="text-2xl font-semibold text-foreground">{location.name}</h1>
        <p className="text-sm text-muted-foreground">Lagerplatz des {DEFAULT_SITE_TITLE}.</p>
      </PublicShell>
    );
  }

  const asset = await getPublicAssetView(value);
  if (!asset) notFound();
  const attributes = asset.specRows;

  return (
    <PublicShell loginHref={session?.user ? null : loginHref}>
      {asset.locked ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive"
        >
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Gesperrt – bitte nicht benutzen</p>
            <p className="text-sm">Bitte dem Team Bescheid geben.</p>
          </div>
        </div>
      ) : null}
      {asset.photoId ? (
        // eslint-disable-next-line @next/next/no-img-element -- Foto aus der DB
        <img
          src={`/api/lager/photos/${asset.photoId}`}
          alt={asset.name}
          className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
        />
      ) : null}
      <div className="space-y-1">
        <p className="font-mono text-sm text-muted-foreground">{asset.code}</p>
        <h1 className="text-2xl font-semibold break-words text-foreground">{asset.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[asset.areaName, asset.categoryName].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ToneBadge tone={ASSET_STATUS_TONES[asset.status]}>
          {ASSET_STATUS_LABELS[asset.status]}
        </ToneBadge>
        {asset.inspectionState !== "none" ? (
          <ToneBadge tone={INSPECTION_STATE_TONES[asset.inspectionState]}>
            <ShieldCheckIcon className="mr-1 h-3 w-3" />
            {asset.inspectionState === "ok" || asset.inspectionState === "soon"
              ? `Geprüft bis ${formatInventoryDate(asset.nextInspectionAt)}`
              : INSPECTION_STATE_LABELS[asset.inspectionState]}
          </ToneBadge>
        ) : null}
        {asset.hasDefects && !asset.locked ? (
          <ToneBadge tone="warning">Mangel bekannt</ToneBadge>
        ) : null}
      </div>
      {asset.publicNote ? (
        <div className="rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-foreground">
          {asset.publicNote}
        </div>
      ) : null}
      {asset.description ? (
        <p className="text-sm whitespace-pre-line text-foreground">{asset.description}</p>
      ) : null}
      {asset.manufacturer || asset.model || attributes.length ? (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {asset.manufacturer || asset.model ? (
            <div>
              <dt className="text-muted-foreground">Hersteller / Modell</dt>
              <dd className="text-foreground">
                {[asset.manufacturer, asset.model].filter(Boolean).join(" ")}
              </dd>
            </div>
          ) : null}
          {attributes.map((entry) => (
            <div key={entry.label}>
              <dt className="text-muted-foreground">{entry.label}</dt>
              <dd className="text-foreground">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </PublicShell>
  );
}

function PublicShell({
  children,
  loginHref,
}: {
  children: React.ReactNode;
  loginHref: string | null;
}) {
  return (
    <div className="flex min-h-dvh items-start justify-center bg-background px-4 py-8 sm:items-center">
      <main className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          Inventar · {DEFAULT_SITE_TITLE}
        </p>
        {children}
        <div className="space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
          <p>Gefunden? Dieses Teil gehört dem {DEFAULT_SITE_TITLE} – bitte gib uns Bescheid.</p>
          {loginHref ? (
            <Link href={loginHref} className="font-medium text-primary hover:underline">
              Mitglied? Anmelden für alle Details
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
