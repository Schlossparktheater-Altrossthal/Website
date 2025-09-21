import PDFDocument from "pdfkit";
import type { ZodError, ZodIssue } from "zod";

import { registerDefaultPdfFonts } from "./fonts";
import { findPdfTemplate } from "./templates";
import type { PdfRenderResult, PdfTemplate } from "./types";

export class PdfTemplateNotFoundError extends Error {
  constructor(public readonly templateId: string) {
    super(`Unknown PDF template: ${templateId}`);
    this.name = "PdfTemplateNotFoundError";
  }
}

export class PdfValidationError extends Error {
  public readonly issues: ZodIssue[];

  constructor(error: ZodError) {
    super("Ungültige Daten für diese PDF-Vorlage");
    this.name = "PdfValidationError";
    this.issues = error.issues;
  }
}

export class PdfRenderError extends Error {
  constructor(public readonly templateId: string, public readonly originalError: unknown) {
    super(`Rendering PDF template failed: ${templateId}`);
    this.name = "PdfRenderError";
  }
}

const DEFAULT_OPTIONS: ConstructorParameters<typeof PDFDocument>[0] = {
  size: "A4",
  margin: 56,
};

export async function renderPdfTemplate(
  templateId: string,
  input: unknown,
): Promise<PdfRenderResult<unknown>> {
  const template = findPdfTemplate(templateId);
  if (!template) {
    throw new PdfTemplateNotFoundError(templateId);
  }

  const parsed = template.schema.safeParse(input);
  if (!parsed.success) {
    throw new PdfValidationError(parsed.error);
  }

  const data = parsed.data;
  const typedTemplate = template as PdfTemplate<typeof data>;
  const options = { ...DEFAULT_OPTIONS, ...(typedTemplate.documentOptions ?? {}) };
  const doc = new PDFDocument(options);

  try {
    registerDefaultPdfFonts(doc);
  } catch (error) {
    try {
      doc.end();
    } catch {
      // ignore cleanup failure
    }
    throw new PdfRenderError(typedTemplate.id, error);
  }
  const chunks: Buffer[] = [];

  return await new Promise<PdfRenderResult<typeof data>>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      doc.removeAllListeners("data");
      doc.removeAllListeners("end");
      doc.removeAllListeners("error");
    };

    const handleError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        doc.end();
      } catch {
        // ignore
      }
      reject(new PdfRenderError(typedTemplate.id, error));
    };

    doc.on("data", (chunk) => {
      if (settled) return;
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    doc.once("end", () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        buffer: Buffer.concat(chunks),
        filename: typedTemplate.filename(data),
        template: typedTemplate,
        data,
      });
    });

    doc.once("error", (error) => {
      handleError(error);
    });

    (async () => {
      try {
        await typedTemplate.render(doc, data);
        doc.end();
      } catch (error) {
        handleError(error);
      }
    })().catch((error) => {
      handleError(error);
    });
  });
}
