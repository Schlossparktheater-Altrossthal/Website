/**
 * Lässt eine PDF-Vorlage über `/api/pdfs/<id>` rendern und startet den Download im Browser.
 * Wirft mit lesbarer Meldung, wenn das Rendern fehlschlägt.
 */
export async function downloadPdf(templateId: string, payload: unknown, fallbackName: string) {
  const response = await fetch(`/api/pdfs/${templateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "PDF konnte nicht erstellt werden.");
  }
  const disposition = response.headers.get("content-disposition");
  const filename = disposition?.match(/filename="([^"]+)"/i)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[\\/\r\n]/g, "_");
  link.click();
  URL.revokeObjectURL(url);
}
