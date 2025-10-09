"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import "react-easy-crop/react-easy-crop.css";

export type AvatarCropSelection = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AvatarCropState = {
  crop: { x: number; y: number };
  zoom: number;
};

type AvatarCropDialogProps = {
  open: boolean;
  imageUrl: string | null;
  initialSelection?: AvatarCropSelection | null;
  initialState?: AvatarCropState | null;
  onClose: () => void;
  onConfirm: (result: { selection: AvatarCropSelection; state: AvatarCropState }) => void;
};

export function AvatarCropDialog({
  open,
  imageUrl,
  initialSelection,
  initialState,
  onClose,
  onConfirm,
}: AvatarCropDialogProps) {
  const defaultCrop = useMemo(() => ({ x: 0, y: 0 }), []);
  const [crop, setCrop] = useState(initialState?.crop ?? defaultCrop);
  const [zoom, setZoom] = useState(initialState?.zoom ?? 1);
  const [croppedAreaPercentages, setCroppedAreaPercentages] = useState<Area | null>(
    initialSelection
      ? {
          x: initialSelection.x * 100,
          y: initialSelection.y * 100,
          width: initialSelection.width * 100,
          height: initialSelection.height * 100,
        }
      : null,
  );

  useEffect(() => {
    if (open) {
      setCrop(initialState?.crop ?? defaultCrop);
      setZoom(initialState?.zoom ?? 1);
      setCroppedAreaPercentages(
        initialSelection
          ? {
              x: initialSelection.x * 100,
              y: initialSelection.y * 100,
              width: initialSelection.width * 100,
              height: initialSelection.height * 100,
            }
          : null,
      );
    }
  }, [defaultCrop, initialSelection, initialState?.crop, initialState?.zoom, open]);

  useEffect(() => {
    if (!open) {
      setCrop(initialState?.crop ?? defaultCrop);
      setZoom(initialState?.zoom ?? 1);
    }
  }, [defaultCrop, initialState?.crop, initialState?.zoom, open]);

  const handleCropComplete = useCallback((areaPercent: Area) => {
    setCroppedAreaPercentages(areaPercent);
  }, []);

  const handleConfirm = () => {
    if (!croppedAreaPercentages) {
      return;
    }

    const selection: AvatarCropSelection = {
      x: Math.min(1, Math.max(0, croppedAreaPercentages.x / 100)),
      y: Math.min(1, Math.max(0, croppedAreaPercentages.y / 100)),
      width: Math.min(1, Math.max(0, croppedAreaPercentages.width / 100)),
      height: Math.min(1, Math.max(0, croppedAreaPercentages.height / 100)),
    };

    if (selection.width <= 0 || selection.height <= 0) {
      return;
    }

    onConfirm({ selection, state: { crop, zoom } });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Bild zuschneiden</DialogTitle>
          <DialogDescription>
            Verschiebe den Ausschnitt und passe bei Bedarf den Zoom an, damit dein Avatar perfekt dargestellt wird.
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
          {imageUrl ? (
            <Cropper
              key={`${imageUrl ?? "no-image"}-${initialSelection ? `${initialSelection.x}-${initialSelection.y}-${initialSelection.width}-${initialSelection.height}` : "default"}`}
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(area) => handleCropComplete(area)}
              objectFit="contain"
              initialCroppedAreaPercentages={
                initialSelection
                  ? {
                      x: initialSelection.x * 100,
                      y: initialSelection.y * 100,
                      width: initialSelection.width * 100,
                      height: initialSelection.height * 100,
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <Label htmlFor="avatar-zoom">Zoom</Label>
            <span>{zoom.toFixed(2)}&times;</span>
          </div>
          <input
            id="avatar-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value) || 1)}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted"
          />
        </div>
        <DialogFooter>
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Ausschnitt übernehmen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
