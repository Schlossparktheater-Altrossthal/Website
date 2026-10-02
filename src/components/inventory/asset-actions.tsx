"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addAssetPhotoAction,
  markAssetMissingAction,
  setAssetRetiredAction,
} from "@/app/(members)/mitglieder/lager/actions/assets";
import { DefectDialog } from "@/components/inventory/defect-dialog";
import { InspectionDialog } from "@/components/inventory/inspection-dialog";
import { MoveDialog, StockDialog } from "@/components/inventory/move-dialog";
import type { PlacementOptions } from "@/components/inventory/placement-picker";
import {
  AlertTriangleIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowRightLeftIcon,
  BoxesIcon,
  CameraIcon,
  EditIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@/components/ui/action-icons";
import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  type AssetKind,
  type AssetStatus,
} from "@/lib/inventory/constants";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import { cn } from "@/lib/utils";

type Dialog = "move" | "stock" | "defect" | "inspection" | "retire" | "missing" | null;

export type AssetActionsProps = {
  asset: {
    id: string;
    code: string;
    name: string;
    kind: AssetKind;
    status: AssetStatus;
    unit: string | null;
    inspectionIntervalMonths: number | null;
    placement: PlacementTarget;
  };
  stocks: { id: string; quantity: number; target: PlacementTarget; label: string }[];
  options: PlacementOptions;
  canManage: boolean;
};

/** Große Schnellaktionen unter dem Kopf; Seltenes steckt im Menü. */
export function AssetActions({ asset, stocks, options, canManage }: AssetActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [busy, setBusy] = React.useState(false);
  const photoRef = React.useRef<HTMLInputElement>(null);
  const label = `${asset.code} · ${asset.name}`;
  const retired = asset.status === "retired";
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("photo", await resizeImageFile(file));
      const result = await addAssetPhotoAction(asset.id, formData);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Foto gespeichert.");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  const runStatus = async (action: () => ReturnType<typeof markAssetMissingAction>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setDialog(null);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(result.message ?? "Gespeichert.");
      router.refresh();
    }
  };

  const primary: {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    tone?: string;
  }[] = retired
    ? []
    : [
        asset.kind === "bulk"
          ? {
              key: "stock",
              label: "Bestand",
              icon: <BoxesIcon className="h-5 w-5" />,
              onClick: () => setDialog("stock"),
            }
          : {
              key: "move",
              label: "Umlagern",
              icon: <ArrowRightLeftIcon className="h-5 w-5" />,
              onClick: () => setDialog("move"),
            },
        {
          key: "defect",
          label: "Mangel",
          icon: <AlertTriangleIcon className="h-5 w-5" />,
          onClick: () => setDialog("defect"),
          tone: "text-warning",
        },
        {
          key: "inspection",
          label: "Prüfung",
          icon: <ShieldCheckIcon className="h-5 w-5" />,
          onClick: () => setDialog("inspection"),
        },
        {
          key: "photo",
          label: "Foto",
          icon: <CameraIcon className="h-5 w-5" />,
          onClick: () => photoRef.current?.click(),
        },
      ];

  const menu = [
    {
      label: "Bearbeiten",
      icon: <EditIcon />,
      onSelect: () => router.push(`${inventoryAssetPath(asset.code)}/bearbeiten`),
    },
    {
      label: "Etikett drucken",
      icon: <PrinterIcon />,
      onSelect: () =>
        router.push(`${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(asset.code)}`),
    },
    ...(asset.kind === "container" && !retired
      ? [
          {
            label: "In diese Kiste erfassen",
            icon: <PlusIcon />,
            onSelect: () => router.push(`${INVENTORY_BASE_PATH}/neu?kiste=${asset.id}`),
          },
        ]
      : []),
    ...(!retired && asset.status !== "missing"
      ? [
          {
            label: "Als vermisst melden",
            icon: <SearchIcon />,
            onSelect: () => setDialog("missing"),
          },
        ]
      : []),
    ...(canManage
      ? [
          retired
            ? {
                label: "Wieder aufnehmen",
                icon: <ArchiveRestoreIcon />,
                onSelect: () => runStatus(() => setAssetRetiredAction(asset.id, false)),
              }
            : {
                label: "Ausmustern",
                icon: <ArchiveIcon />,
                variant: "destructive" as const,
                onSelect: () => setDialog("retire"),
              },
        ]
      : []),
  ];

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div className="grid flex-1 grid-cols-4 gap-2">
          {primary.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={busy}
              onClick={action.onClick}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              <span className={cn("text-muted-foreground", action.tone)}>{action.icon}</span>
              {action.label}
            </button>
          ))}
          {retired ? (
            <Link
              href={`${inventoryAssetPath(asset.code)}/bearbeiten`}
              className="col-span-4 flex min-h-12 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground"
            >
              Ausgemustert – nur noch Ansicht
            </Link>
          ) : null}
        </div>
        <ActionDropdownMenu
          items={menu}
          label="Weitere Aktionen"
          className="h-auto min-h-16 w-11 rounded-lg border border-border bg-card"
        />
      </div>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Foto hinzufügen"
        onChange={uploadPhoto}
      />

      <MoveDialog
        open={dialog === "move"}
        onOpenChange={close}
        assetId={asset.id}
        assetLabel={label}
        isContainer={asset.kind === "container"}
        current={asset.placement}
        options={options}
      />
      {asset.kind === "bulk" ? (
        <StockDialog
          open={dialog === "stock"}
          onOpenChange={close}
          assetId={asset.id}
          assetLabel={label}
          unit={asset.unit ?? "Stk."}
          stocks={stocks}
          options={options}
        />
      ) : null}
      <DefectDialog
        open={dialog === "defect"}
        onOpenChange={close}
        assetId={asset.id}
        assetLabel={label}
      />
      <InspectionDialog
        open={dialog === "inspection"}
        onOpenChange={close}
        assetIds={[asset.id]}
        label={label}
        defaultIntervalMonths={asset.inspectionIntervalMonths}
      />
      <ConfirmDialog
        open={dialog === "missing"}
        onOpenChange={close}
        title="Als vermisst melden?"
        description="Das Objekt gilt als vermisst, bis es wieder gescannt wird."
        confirmLabel="Vermisst melden"
        cancelLabel="Abbrechen"
        variant="default"
        onCancel={() => setDialog(null)}
        onConfirm={() => runStatus(() => markAssetMissingAction(asset.id))}
      />
      <ConfirmDialog
        open={dialog === "retire"}
        onOpenChange={close}
        title="Ausmustern?"
        description="Das Objekt verschwindet aus dem Bestand, der Code bleibt reserviert. Inhalt einer Kiste bleibt am Ort liegen."
        confirmLabel="Ausmustern"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDialog(null)}
        onConfirm={() => runStatus(() => setAssetRetiredAction(asset.id, true))}
      />
    </>
  );
}
