/** Verkleinert ein Foto im Browser auf höchstens `maxSize` Pixel Kantenlänge (JPEG). */
export async function resizeImageFile(file: File, maxSize = 1280, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error("Das Foto konnte nicht gelesen werden.");
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Das Foto konnte nicht verarbeitet werden.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Das Foto konnte nicht verarbeitet werden.");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}
