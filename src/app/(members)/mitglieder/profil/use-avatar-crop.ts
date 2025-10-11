import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { AvatarCropSelection, AvatarCropState } from "./avatar-crop-dialog";

const AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

type UseAvatarCropOptions = {
  userId: string;
  onCropComplete?: (file: File, selection: AvatarCropSelection, state: AvatarCropState, previewUrl: string) => void;
};

export function useAvatarCrop({ userId, onCropComplete }: UseAvatarCropOptions) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarCropSelection, setAvatarCropSelection] = useState<AvatarCropSelection | null>(null);
  const [avatarCropState, setAvatarCropState] = useState<AvatarCropState | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropDialogInitialSelection, setCropDialogInitialSelection] = useState<AvatarCropSelection | null>(null);
  const [cropDialogInitialState, setCropDialogInitialState] = useState<AvatarCropState | null>(null);
  const [avatarCropLoading, setAvatarCropLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cleanupCropImage = useCallback(() => {
    setCropImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupCropImage();
    };
  }, [cleanupCropImage]);

  const loadImage = useCallback((src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      image.src = src;
    });
  }, []);

  const createAvatarPreview = useCallback(
    async (file: File, selection: AvatarCropSelection): Promise<string> => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = await loadImage(objectUrl);
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;

        if (!sourceWidth || !sourceHeight) {
          throw new Error("Ungültige Bildabmessungen");
        }

        const canvas = document.createElement("canvas");
        const PREVIEW_SIZE = 256;
        canvas.width = PREVIEW_SIZE;
        canvas.height = PREVIEW_SIZE;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas-Kontext nicht verfügbar");
        }

        const cropWidth = Math.min(sourceWidth, Math.max(1, Math.round(sourceWidth * selection.width)));
        const cropHeight = Math.min(sourceHeight, Math.max(1, Math.round(sourceHeight * selection.height)));
        const cropX = Math.min(sourceWidth - 1, Math.max(0, Math.round(sourceWidth * selection.x)));
        const cropY = Math.min(sourceHeight - 1, Math.max(0, Math.round(sourceHeight * selection.y)));
        const safeCropWidth = Math.min(cropWidth, sourceWidth - cropX);
        const safeCropHeight = Math.min(cropHeight, sourceHeight - cropY);

        context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
        context.drawImage(
          image,
          cropX,
          cropY,
          safeCropWidth,
          safeCropHeight,
          0,
          0,
          PREVIEW_SIZE,
          PREVIEW_SIZE,
        );

        return canvas.toDataURL("image/png");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [loadImage],
  );

  const openCropDialogForFile = useCallback(
    (
      file: File,
      options?: { selection?: AvatarCropSelection | null; state?: AvatarCropState | null },
    ) => {
      cleanupCropImage();
      const url = URL.createObjectURL(file);
      setPendingAvatarFile(file);
      setCropDialogInitialSelection(options?.selection ?? null);
      setCropDialogInitialState(options?.state ?? null);
      setCropImageUrl(url);
      setCropDialogOpen(true);
    },
    [cleanupCropImage],
  );

  const handleCropDialogClose = useCallback(() => {
    setCropDialogOpen(false);
    setPendingAvatarFile(null);
    cleanupCropImage();
    setCropDialogInitialSelection(null);
    setCropDialogInitialState(null);
    setAvatarCropLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [cleanupCropImage]);

  const handleCropDialogConfirm = useCallback(
    async ({ selection, state }: { selection: AvatarCropSelection; state: AvatarCropState }) => {
      if (!pendingAvatarFile) {
        handleCropDialogClose();
        return;
      }

      try {
        const preview = await createAvatarPreview(pendingAvatarFile, selection);
        setAvatarFile(pendingAvatarFile);
        setAvatarCropSelection(selection);
        setAvatarCropState(state);
        setAvatarPreviewUrl(preview);
        onCropComplete?.(pendingAvatarFile, selection, state, preview);
      } catch (cropError) {
        console.error("[profile][avatar-crop]", cropError);
        toast.error("Bild konnte nicht verarbeitet werden.");
      } finally {
        handleCropDialogClose();
      }
    },
    [createAvatarPreview, handleCropDialogClose, onCropComplete, pendingAvatarFile],
  );

  const handleAvatarFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      if (event.target.value) {
        event.target.value = "";
      }
      return;
    }
    if (!AVATAR_MIME_TYPES.has(file.type.toLowerCase())) {
      toast.error("Nur JPG, PNG oder WebP werden unterstützt.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Bitte nutze ein Bild bis maximal 8 MB.");
      event.target.value = "";
      return;
    }
    openCropDialogForFile(file);
  }, [openCropDialogForFile]);

  const handleAvatarCropReopen = useCallback(async (
    currentAvatarSource: string | null,
  ) => {
    if (avatarFile) {
      openCropDialogForFile(avatarFile, {
        selection: avatarCropSelection,
        state: avatarCropState,
      });
      return;
    }

    if (currentAvatarSource !== "UPLOAD") {
      return;
    }

    try {
      setAvatarCropLoading(true);
      const response = await fetch(`/api/users/${userId}/avatar?v=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        toast.error("Bestehendes Bild konnte nicht geladen werden.");
        return;
      }
      const blob = await response.blob();
      const mimeType = blob.type || "image/png";
      const extension = mimeType.split("/").pop() || "png";
      const restoredFile = new File([blob], `avatar-${userId}.${extension}`, { type: mimeType });
      openCropDialogForFile(restoredFile, {
        selection: avatarCropSelection,
        state: avatarCropState,
      });
    } catch (error) {
      console.error("[profile][avatar-crop][reload]", error);
      toast.error("Bildausschnitt konnte nicht vorbereitet werden.");
    } finally {
      setAvatarCropLoading(false);
    }
  }, [avatarCropSelection, avatarCropState, avatarFile, openCropDialogForFile, userId]);

  const resetAvatarCrop = useCallback(() => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setAvatarCropSelection(null);
    setAvatarCropState(null);
  }, []);

  return {
    // State
    avatarFile,
    avatarPreviewUrl,
    avatarCropSelection,
    avatarCropState,
    avatarCropLoading,
    cropDialogOpen,
    cropImageUrl,
    cropDialogInitialSelection,
    cropDialogInitialState,
    fileInputRef,
    // Actions
    handleAvatarFileChange,
    handleAvatarCropReopen,
    handleCropDialogClose,
    handleCropDialogConfirm,
    resetAvatarCrop,
  };
}
