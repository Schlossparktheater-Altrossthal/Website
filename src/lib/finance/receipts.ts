export const RECEIPT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RECEIPT_ACCEPT = [...RECEIPT_IMAGE_TYPES, "application/pdf"].join(",");
/** Fotos werden im Browser verkleinert; PDFs von Rechnungen dürfen größer sein. */
export const MAX_RECEIPT_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const MAX_RECEIPT_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_RECEIPTS_PER_CLAIM = 5;

export type ReceiptUpload = {
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  filename: string;
  size: number;
};

/** Belege aus FormData (`receipt`, mehrfach) lesen und prüfen. */
export async function readReceiptFiles(
  formData: FormData,
  key = "receipt",
): Promise<ReceiptUpload[]> {
  const files = formData
    .getAll(key)
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (files.length > MAX_RECEIPTS_PER_CLAIM) {
    throw new Error(`Höchstens ${MAX_RECEIPTS_PER_CLAIM} Belege je Auslage.`);
  }
  return Promise.all(
    files.map(async (file) => {
      const isPdf = file.type === "application/pdf";
      if (!isPdf && !(RECEIPT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        throw new Error("Belege bitte als Foto (JPEG, PNG, WebP) oder PDF hochladen.");
      }
      if (file.size > (isPdf ? MAX_RECEIPT_PDF_BYTES : MAX_RECEIPT_IMAGE_BYTES)) {
        throw new Error(`„${file.name}“ ist zu groß.`);
      }
      return {
        data: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type,
        filename: file.name.slice(0, 200) || "beleg",
        size: file.size,
      };
    }),
  );
}
