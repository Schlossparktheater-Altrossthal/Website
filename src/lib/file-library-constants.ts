export const FILE_LIBRARY_ACCEPT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "audio/mpeg",
];

export const MAX_FILE_LIBRARY_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_FILE_LIBRARY_FILES_PER_UPLOAD = 10;
export const MAX_FILE_LIBRARY_DESCRIPTION_LENGTH = 500;

export function formatFileLibraryFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
