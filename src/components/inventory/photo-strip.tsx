"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteAssetPhotoAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import { TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Großes Foto mit umbrechenden Vorschaubildern darunter. */
export function PhotoStrip({ photoIds, alt }: { photoIds: string[]; alt: string }) {
  const router = useRouter();
  const [active, setActive] = React.useState(photoIds[0]);
  const [busy, setBusy] = React.useState(false);
  const current = photoIds.includes(active ?? "") ? active : photoIds[0];

  const remove = async () => {
    if (!current) return;
    setBusy(true);
    const result = await deleteAssetPhotoAction(current);
    setBusy(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(result.message ?? "Entfernt.");
      router.refresh();
    }
  };

  if (!current) return null;
  return (
    <div className="space-y-2">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- Foto aus der DB */}
        <img
          src={`/api/lager/photos/${current}`}
          alt={alt}
          className="aspect-[4/3] w-full rounded-lg border border-border bg-muted object-contain"
        />
        <Button
          type="button"
          size="icon"
          variant="subtle"
          disabled={busy}
          onClick={remove}
          className="absolute top-2 right-2"
          aria-label="Foto entfernen"
        >
          <TrashIcon />
        </Button>
      </div>
      {photoIds.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {photoIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              aria-pressed={id === current}
              aria-label="Foto anzeigen"
              className={cn(
                "rounded-md border-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                id === current ? "border-primary" : "border-transparent",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Foto aus der DB */}
              <img
                src={`/api/lager/photos/${id}`}
                alt=""
                className="h-14 w-14 rounded object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
