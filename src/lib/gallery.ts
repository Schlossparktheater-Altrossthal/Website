export const GALLERY_START_YEAR = 2009;
export const MAX_GALLERY_FILES_PER_UPLOAD = 20;
export const MAX_GALLERY_FILE_BYTES = 60 * 1024 * 1024; // 60 MB
export const MAX_GALLERY_DESCRIPTION_LENGTH = 280;
export const GALLERY_ACCEPT_MIME_TYPES = "image/*,video/*";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
] as const;

export type GalleryMediaKind = "image" | "video";

const EXTENSION_MEDIA_TYPE: Record<string, GalleryMediaKind> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".mp4": "video",
  ".mov": "video",
  ".m4v": "video",
  ".webm": "video",
};

export function createGalleryYearRange(startYear: number = GALLERY_START_YEAR): number[] {
  const currentYear = new Date().getFullYear();
  const totalYears = currentYear - startYear + 1;
  return Array.from({ length: totalYears }, (_, index) => currentYear - index);
}

export function isValidGalleryYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= GALLERY_START_YEAR && year <= currentYear;
}

export function resolveGalleryMediaKind(
  mimeType: string | null | undefined,
  fileName?: string | null,
): GalleryMediaKind | null {
  const normalizedMime = mimeType?.trim().toLowerCase() ?? "";
  if (normalizedMime.startsWith("image/")) {
    return "image";
  }
  if (normalizedMime.startsWith("video/")) {
    return "video";
  }
  if (normalizedMime) {
    if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalizedMime)) {
      return "image";
    }
    if ((ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(normalizedMime)) {
      return "video";
    }
  }

  if (fileName) {
    const trimmed = fileName.trim().toLowerCase();
    const dotIndex = trimmed.lastIndexOf(".");
    if (dotIndex !== -1) {
      const extension = trimmed.slice(dotIndex);
      const kind = EXTENSION_MEDIA_TYPE[extension];
      if (kind) {
        return kind;
      }
    }
  }

  return null;
}

export function sanitizeGalleryFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "datei";
  }
  const withoutControl = trimmed.replace(/[\r\n\t]+/g, "_");
  const sanitized = withoutControl.replace(/[^\w.()\-\s]+/g, "_");
  return sanitized.slice(0, 180) || "datei";
}

export function formatGalleryFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const maximumFractionDigits = size >= 10 || unitIndex === 0 ? 0 : 1;

  return `${size.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })} ${units[unitIndex]}`;
}

export function getGalleryYearDescription(year: number, currentYear: number): string {
  if (year === currentYear) {
    return "Halte Proben, Premieren und Backstage-Momente der aktuellen Saison fest.";
  }

  if (year === currentYear - 1) {
    return "Schließe die Highlights der vergangenen Saison ab – von Ensemble-Porträts bis zu Pressebildern.";
  }

  if (year === GALLERY_START_YEAR) {
    return "Hier begann alles: Digitalisiere die ersten Aufführungen und Plakatmotive des Sommertheaters.";
  }

  if (year < 2013) {
    return `Vervollständige das frühe Archiv aus ${year} mit gescannten Prints und Making-of-Fotos.`;
  }

  if (year >= currentYear - 5) {
    return `Sammle Social-Media-Motive, Presse-Features und Bühnenbilder aus ${year}.`;
  }

  return `Füge weitere Erinnerungen aus ${year} hinzu – Kostüme, Publikumsmomente und Probendokumentation.`;
}
