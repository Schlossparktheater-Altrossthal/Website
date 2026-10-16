import { z } from "zod";

import {
  PDF_BOLD,
  PDF_COLOR,
  PDF_MARGIN,
  drawDocumentHeader,
  drawPageFooters,
  drawTable,
  pdfDateTimeFormatter,
  textLine,
  type PdfTableRow,
} from "../layout";
import type { PdfTemplate } from "../types";

const LEVEL_LABELS = ["", "Vielleicht", "Gern", "Sehr gern", "Unbedingt"] as const;

const wunschlisteSchema = z.object({
  generatedAt: z.string().datetime(),
  production: z.string().nullable().default(null),
  layout: z.enum(["list", "matrix"]),
  areas: z.array(
    z.object({
      title: z.string(),
      shortTitle: z.string(),
      domain: z.enum(["acting", "crew"]),
    }),
  ),
  people: z.array(
    z.object({
      name: z.string(),
      /** Kurz-Hinweis hinter dem Namen, z. B. „neu“. */
      tag: z.string().nullable().default(null),
      /** Ist-Stand in Worten (Gewerke, Rollen). */
      assignment: z.string().nullable().default(null),
      /** Je Bereich (gleiche Reihenfolge wie `areas`): Stufe 1–4 oder null. */
      wishes: z.array(
        z
          .object({
            level: z.number().int().min(1).max(4),
            assigned: z.boolean(),
            entered: z.boolean(),
          })
          .nullable(),
      ),
    }),
  ),
});

export type WunschlistePdfData = z.infer<typeof wunschlisteSchema>;

type Person = WunschlistePdfData["people"][number];

function renderList(doc: PDFKit.PDFDocument, data: WunschlistePdfData, startY: number) {
  // Eine durchlaufende Tabelle in zwei Spalten, damit keine Spalte halb leer bleibt.
  const rows: PdfTableRow[] = [];
  for (const domain of ["acting", "crew"] as const) {
    data.areas.forEach((area, index) => {
      if (area.domain !== domain) return;
      const wishers = data.people
        .map((person) => ({ person, wish: person.wishes[index] }))
        .filter((entry): entry is { person: Person; wish: NonNullable<Person["wishes"][number]> } =>
          Boolean(entry.wish),
        )
        .sort((a, b) => b.wish.level - a.wish.level || a.person.name.localeCompare(b.person.name));
      if (!wishers.length) return;
      const top = wishers.filter((entry) => entry.wish.level >= 3).length;
      const assigned = wishers.filter((entry) => entry.wish.assigned).length;
      rows.push({
        kind: "group",
        label: area.title,
        hint: [
          `${wishers.length}`,
          top ? `${top} ab sehr gern` : null,
          assigned ? `${assigned} zugeteilt` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      wishers.forEach(({ person, wish }, position) => {
        rows.push({
          gapBefore: position > 0 && wishers[position - 1].wish.level !== wish.level,
          cells: [
            {
              text: person.name + (person.tag ? ` (${person.tag})` : ""),
              bold: wish.level >= 3,
              sub: wish.entered ? "nachgetragen" : null,
            },
            {
              text: LEVEL_LABELS[wish.level],
              color: wish.level >= 3 ? PDF_COLOR.text : PDF_COLOR.muted,
            },
            wish.assigned
              ? { text: "zugeteilt", pill: { fill: PDF_COLOR.successFill, ink: PDF_COLOR.success } }
              : { text: "" },
          ],
        });
      });
    });
  }

  const without = data.people.filter((person) => person.wishes.every((wish) => !wish));
  if (without.length) {
    rows.push({ kind: "group", label: "Ohne Wünsche", hint: String(without.length) });
    for (const person of without) {
      rows.push({
        cells: [
          person.name + (person.tag ? ` (${person.tag})` : ""),
          { text: "" },
          { text: person.assignment ?? "", color: PDF_COLOR.muted },
        ],
      });
    }
  }

  drawTable(doc, {
    y: startY,
    flowColumns: 2,
    columns: [
      { label: "Person", weight: 3.2 },
      { label: "Stufe", weight: 1.6 },
      { label: "Ist", weight: 1.4 },
    ],
    rows,
  });
}

const NAME_WIDTH = 150;
const ASSIGN_WIDTH = 130;
const ROW_HEIGHT = 14;
const HEAD_HEIGHT = 30;

function drawDots(doc: PDFKit.PDFDocument, x: number, y: number, level: number, hollow: boolean) {
  for (let index = 0; index < 4; index += 1) {
    const cx = x + index * 5.5;
    doc.save().lineWidth(0.6);
    if (index < level) {
      if (hollow) doc.circle(cx, y, 1.9).stroke(PDF_COLOR.accent);
      else doc.circle(cx, y, 2).fill(PDF_COLOR.accent);
    } else {
      doc.circle(cx, y, 1.2).fill(PDF_COLOR.line);
    }
    doc.restore();
  }
}

function renderMatrix(doc: PDFKit.PDFDocument, data: WunschlistePdfData, startY: number) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const columnWidth = Math.min(
    60,
    (width - NAME_WIDTH - ASSIGN_WIDTH) / Math.max(1, data.areas.length),
  );
  const bottom = () => doc.page.height - doc.page.margins.bottom - 6;
  const firstCrew = data.areas.findIndex((area) => area.domain === "crew");

  const drawHead = (top: number) => {
    doc.save().rect(left, top, width, HEAD_HEIGHT).fill(PDF_COLOR.header).restore();
    textLine(doc, "Person", left + 4, top + HEAD_HEIGHT - 11, NAME_WIDTH - 8, {
      font: PDF_BOLD,
      size: 6.5,
      color: PDF_COLOR.muted,
    });
    data.areas.forEach((area, index) => {
      const x = left + NAME_WIDTH + index * columnWidth;
      if (index === 0 || index === firstCrew) {
        textLine(doc, area.domain === "acting" ? "Schauspiel" : "Gewerke", x + 2, top + 4, 120, {
          font: PDF_BOLD,
          size: 6,
          color: PDF_COLOR.accent,
        });
      }
      textLine(doc, area.shortTitle, x + 2, top + HEAD_HEIGHT - 11, columnWidth - 3, {
        font: PDF_BOLD,
        size: 6,
        color: PDF_COLOR.muted,
      });
    });
    textLine(
      doc,
      "Zugeteilt",
      left + NAME_WIDTH + data.areas.length * columnWidth + 4,
      top + HEAD_HEIGHT - 11,
      ASSIGN_WIDTH - 8,
      { font: PDF_BOLD, size: 6.5, color: PDF_COLOR.muted },
    );
    return top + HEAD_HEIGHT;
  };

  let y = drawHead(startY);
  data.people.forEach((person, rowIndex) => {
    if (y + ROW_HEIGHT > bottom()) {
      doc.addPage();
      y = drawHead(doc.page.margins.top);
    }
    if (rowIndex % 2 === 1) {
      doc.save().rect(left, y, width, ROW_HEIGHT).fill("#f9fafb").restore();
    }
    textLine(
      doc,
      person.name + (person.tag ? ` (${person.tag})` : ""),
      left + 4,
      y + 4,
      NAME_WIDTH - 8,
      { size: 7, color: PDF_COLOR.text },
    );
    person.wishes.forEach((wish, index) => {
      if (!wish) return;
      const x = left + NAME_WIDTH + index * columnWidth;
      if (wish.assigned) {
        doc
          .save()
          .rect(x + 1, y + 1, columnWidth - 2, ROW_HEIGHT - 2)
          .fill(PDF_COLOR.successFill)
          .restore();
      }
      drawDots(doc, x + 5, y + ROW_HEIGHT / 2, wish.level, wish.entered);
    });
    if (person.assignment) {
      textLine(
        doc,
        person.assignment,
        left + NAME_WIDTH + data.areas.length * columnWidth + 4,
        y + 4.5,
        ASSIGN_WIDTH - 8,
        { size: 6, color: PDF_COLOR.muted },
      );
    }
    if (firstCrew > 0) {
      const x = left + NAME_WIDTH + firstCrew * columnWidth;
      doc
        .save()
        .moveTo(x, y)
        .lineTo(x, y + ROW_HEIGHT)
        .lineWidth(0.5)
        .stroke(PDF_COLOR.line)
        .restore();
    }
    y += ROW_HEIGHT;
  });

  // Legende
  y += 10;
  if (y + 12 > bottom()) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  let x = left + 4;
  for (const level of [4, 3, 2, 1]) {
    drawDots(doc, x, y + 3, level, false);
    textLine(doc, LEVEL_LABELS[level], x + 24, y, 50, { size: 6.5, color: PDF_COLOR.muted });
    x += 80;
  }
  drawDots(doc, x, y + 3, 2, true);
  textLine(doc, "hohl = nachgetragen", x + 24, y, 90, { size: 6.5, color: PDF_COLOR.muted });
  x += 120;
  doc
    .save()
    .rect(x, y - 1, 22, 9)
    .fill(PDF_COLOR.successFill)
    .restore();
  textLine(doc, "grün = zugeteilt", x + 28, y, 90, { size: 6.5, color: PDF_COLOR.muted });
}

export const wunschlisteTemplate: PdfTemplate<WunschlistePdfData> = {
  id: "wunschliste",
  label: "Wunschliste",
  description: "Rollen- und Gewerkewünsche einer Produktion als Liste oder Matrix.",
  schema: wunschlisteSchema,
  documentOptions: (data) => ({
    size: "A4",
    layout: data.layout === "matrix" ? "landscape" : "portrait",
    margin: PDF_MARGIN,
    bufferPages: true,
  }),
  filename: (data) =>
    `wunschliste${data.layout === "matrix" ? "-matrix" : ""}-${data.generatedAt.slice(0, 10)}.pdf`,
  render: (doc, data) => {
    const withWishes = data.people.filter((person) => person.wishes.some(Boolean)).length;
    const y = drawDocumentHeader(doc, {
      title: data.layout === "matrix" ? "Wunschliste · Übersicht" : "Wunschliste",
      meta: [
        data.production,
        `${withWishes} von ${data.people.length} Personen mit Wünschen`,
        `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
      ],
    });
    if (data.layout === "matrix") renderMatrix(doc, data, y);
    else renderList(doc, data, y);
    drawPageFooters(
      doc,
      `Wunschliste${data.production ? ` · ${data.production}` : ""} · Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`,
    );
  },
};
