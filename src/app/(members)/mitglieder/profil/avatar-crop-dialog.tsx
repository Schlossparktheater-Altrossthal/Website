"use client";

import { useCallback, useEffect, useState } from "react";
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

type AvatarCropDialogProps = {
  open: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onConfirm: (selection: AvatarCropSelection) => void;
};

export function AvatarCropDialog({ open, imageUrl, onClose, onConfirm }: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
    }
  }, [open, imageUrl]);

  const handleCropComplete = useCallback((_area: Area, areaPercent: Area) => {
    setCroppedArea(areaPercent);
  }, []);

  const handleConfirm = () => {
    if (!croppedArea) {
      return;
    }

    const selection: AvatarCropSelection = {
      x: Math.min(1, Math.max(0, croppedArea.x / 100)),
      y: Math.min(1, Math.max(0, croppedArea.y / 100)),
      width: Math.min(1, Math.max(0, croppedArea.width / 100)),
      height: Math.min(1, Math.max(0, croppedArea.height / 100)),
    };

    if (selection.width <= 0 || selection.height <= 0) {
      return;
    }

    onConfirm(selection);
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
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              objectFit="contain"
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
