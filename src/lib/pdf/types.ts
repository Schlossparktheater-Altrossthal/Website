import type PDFDocument from "pdfkit";
import type { z } from "zod";

export type PdfDocumentOptions = ConstructorParameters<typeof PDFDocument>[0];
type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

export type PdfTemplate<Data> = {
  /**
   * Technische ID der Vorlage. Wird für die API-Routen verwendet.
   */
  id: string;
  /**
   * Lesbarer Name der Vorlage.
   */
  label: string;
  /**
   * Optionale Beschreibung zur internen Dokumentation.
   */
  description?: string;
  /**
   * Zod-Schema zur Validierung und Normalisierung der Eingabedaten.
   */
  schema: z.ZodType<Data>;
  /**
   * Liefert den Dateinamen (inklusive .pdf), der im Download vorgeschlagen wird.
   */
  filename: (data: Data) => string;
  /**
   * Optional anpassbare Optionen für das zugrunde liegende PDF-Dokument.
   */
  documentOptions?: PdfDocumentOptions;
  /**
   * Zeichnet den eigentlichen Inhalt der PDF-Datei.
   */
  render: (doc: PdfDocumentInstance, data: Data) => Promise<void> | void;
};

export type PdfRenderResult<Data> = {
  buffer: Buffer;
  filename: string;
  template: PdfTemplate<Data>;
  data: Data;
};
