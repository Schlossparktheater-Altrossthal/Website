import { z } from "zod";

import {
  PDF_COLOR,
  PDF_MARGIN,
  drawDocumentHeader,
  drawPageFooters,
  drawTable,
  pdfDateTimeFormatter,
  type PdfTableCell,
  type PdfTableColumn,
  type PdfTableRow,
} from "../layout";
import type { PdfTemplate } from "../types";

const eventSchema = z.object({
  type: z.literal("event").default("event"),
  /** z. B. „Fr 16.10.“ oder „Fr 16.–So 18.10.“ */
  date: z.string(),
  time: z.string().nullable(),
  title: z.string(),
  /** Erste Zeile der Beschreibung. */
  note: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  /** Geplante Szenen, z. B. „3, 4, 7“. */
  scenes: z.string().nullable().default(null),
  /** Wer ist dabei, z. B. „Ensemble · Kostüm · Bühne“. */
  who: z.string().nullable().default(null),
  rehearsal: z.boolean(),
  status: z.enum(["CONFIRMED", "TENTATIVE", "CANCELLED"]).default("CONFIRMED"),
  /** „fehlen: …“ bzw. „eingeschränkt: …“; null, wenn ausgeblendet oder niemand. */
  blocked: z.string().nullable().default(null),
  limited: z.string().nullable().default(null),
  /** z. B. „12/14“ */
  attendance: z.string().nullable().default(null),
});

const noticeSchema = z.object({
  type: z.literal("notice"),
  kind: z.enum(["schoolHoliday", "publicHoliday"]),
  text: z.string(),
});

const modeValues = ["plan", "notes", "poster", "availability"] as const;

const terminlisteSchema = z.object({
  /**
   * plan: Ablaufplan ohne Sperrlistendaten · notes: Ablaufplan mit Notizspalte ·
   * poster: zweispaltig zum Aushängen · availability: quer, mit Abwesenheiten und Zusagen.
   */
  mode: z.enum(modeValues).default("plan"),
  generatedAt: z.string().datetime(),
  production: z.string().nullable().default(null),
  months: z.array(
    z.object({
      label: z.string(),
      weeks: z.array(
        z.object({
          /** z. B. „KW 42“ */
          label: z.string().nullable().default(null),
          items: z.array(z.discriminatedUnion("type", [eventSchema, noticeSchema])),
        }),
      ),
    }),
  ),
});

export type TerminlistePdfData = z.infer<typeof terminlisteSchema>;
type Mode = (typeof modeValues)[number];
type Event = z.infer<typeof eventSchema>;

const TITLE: Record<Mode, string> = {
  plan: "Ablaufplan",
  notes: "Ablaufplan",
  poster: "Ablaufplan",
  availability: "Termine & Verfügbarkeit",
};

const STATUS_PILL = {
  TENTATIVE: { text: "vorgemerkt", pill: { fill: PDF_COLOR.warningFill, ink: PDF_COLOR.warning } },
  CANCELLED: { text: "abgesagt", pill: { fill: PDF_COLOR.dangerFill, ink: PDF_COLOR.danger } },
} as const;

const NOTICE_STYLE = {
  schoolHoliday: { ink: "#0e7490", fill: "#ecfeff" },
  publicHoliday: { ink: "#b45309", fill: "#fffbeb" },
} as const;

const COLUMNS: Record<Mode, PdfTableColumn[]> = {
  plan: [
    { label: "Datum", weight: 12 },
    { label: "Zeit", weight: 10 },
    { label: "Termin", weight: 28 },
    { label: "Szenen", weight: 13 },
    { label: "Wer", weight: 17 },
    { label: "Ort", weight: 12 },
    { label: "Status", weight: 9, align: "center" },
  ],
  notes: [
    { label: "Datum", weight: 12 },
    { label: "Zeit", weight: 10 },
    { label: "Termin", weight: 27 },
    { label: "Szenen", weight: 11 },
    { label: "Wer", weight: 13 },
    { label: "Notizen", weight: 27 },
  ],
  poster: [
    { label: "Datum", weight: 19 },
    { label: "Zeit", weight: 14 },
    { label: "Termin", weight: 67 },
  ],
  availability: [
    { label: "Datum", weight: 9 },
    { label: "Zeit", weight: 8 },
    { label: "Termin", weight: 21 },
    { label: "Szenen", weight: 9 },
    { label: "Wer", weight: 12 },
    { label: "Abwesend", weight: 27 },
    { label: "Status", weight: 7, align: "center" },
    { label: "Können", weight: 7, align: "right" },
  ],
};

function cellsFor(mode: Mode, event: Event, weekLabel: string | null): PdfTableCell[] {
  const cancelled = event.status === "CANCELLED";
  const date: PdfTableCell = { text: event.date, bold: true, sub: weekLabel };
  const time: PdfTableCell = { text: event.time ?? "", color: PDF_COLOR.muted };
  const title = (sub: (string | null)[]): PdfTableCell => ({
    text: event.title,
    bold: !event.rehearsal,
    strike: cancelled,
    color: cancelled ? PDF_COLOR.muted : PDF_COLOR.text,
    sub: sub.filter(Boolean).join(" · ") || null,
  });
  const status: PdfTableCell = event.status === "CONFIRMED" ? "" : STATUS_PILL[event.status];
  const muted = (text: string | null): PdfTableCell => ({
    text: text ?? "",
    color: PDF_COLOR.muted,
  });

  switch (mode) {
    case "plan":
      return [
        date,
        time,
        title([event.note]),
        muted(event.scenes),
        muted(event.who),
        muted(event.location),
        status,
      ];
    case "notes":
      return [
        date,
        time,
        title([event.note, event.location, cancelled ? "abgesagt" : null]),
        muted(event.scenes),
        muted(event.who),
        { text: "", ruled: true },
      ];
    case "poster":
      return [
        date,
        time,
        title([
          event.note,
          event.scenes ? `Sz. ${event.scenes}` : null,
          event.who,
          event.location,
          cancelled ? "abgesagt" : event.status === "TENTATIVE" ? "vorgemerkt" : null,
        ]),
      ];
    case "availability":
      return [
        date,
        time,
        title([event.note]),
        muted(event.scenes),
        muted(event.who),
        {
          text: "",
          sub: cancelled
            ? null
            : [
                { text: event.blocked ?? "", color: PDF_COLOR.danger },
                { text: event.limited ?? "", color: PDF_COLOR.warning },
              ],
        },
        status,
        { text: cancelled ? "" : (event.attendance ?? ""), color: PDF_COLOR.muted },
      ];
  }
}

export const terminlisteTemplate: PdfTemplate<TerminlistePdfData> = {
  id: "terminliste",
  label: "Terminliste",
  description:
    "Proben und Termine nach Monat und Woche – als Ablaufplan, mit Notizspalte, zweispaltig zum Aushängen oder mit Abwesenheiten.",
  schema: terminlisteSchema,
  // Mit Abwesenheiten quer: Platz für die Namen.
  documentOptions: (data) => ({
    size: "A4",
    layout: data.mode === "availability" ? "landscape" : "portrait",
    margin: PDF_MARGIN,
    bufferPages: true,
  }),
  filename: (data) =>
    `${data.mode === "availability" ? "termine" : "ablaufplan"}-${data.generatedAt.slice(0, 10)}.pdf`,
  render: (doc, data) => {
    const { mode } = data;
    const events = data.months.flatMap((month) =>
      month.weeks.flatMap((week) => week.items.filter((item) => item.type === "event")),
    );
    const rehearsals = events.filter((event) => event.rehearsal).length;
    const stand = `Stand ${pdfDateTimeFormatter.format(new Date(data.generatedAt))}`;
    const y = drawDocumentHeader(doc, {
      title: TITLE[mode],
      meta: [
        data.production,
        `${rehearsals} Proben`,
        `${events.length - rehearsals} weitere Termine`,
        stand,
      ],
    });

    const rows: PdfTableRow[] = [];
    for (const month of data.months) {
      const count = month.weeks.reduce(
        (sum, week) => sum + week.items.filter((item) => item.type === "event").length,
        0,
      );
      rows.push({ kind: "group", label: month.label, hint: `${count} Termine` });
      for (const week of month.weeks) {
        let firstEvent = true;
        for (const item of week.items) {
          if (item.type === "notice") {
            rows.push({ kind: "notice", text: item.text, ...NOTICE_STYLE[item.kind] });
            continue;
          }
          rows.push({
            gapBefore: firstEvent,
            accent: item.rehearsal ? PDF_COLOR.rehearsal : PDF_COLOR.accent,
            minHeight: mode === "notes" ? 30 : undefined,
            cells: cellsFor(mode, item, firstEvent ? week.label : null),
          });
          firstEvent = false;
        }
      }
    }

    if (!events.length) {
      doc.fontSize(9).fillColor(PDF_COLOR.muted).text("Keine Termine.", doc.page.margins.left, y);
    } else {
      drawTable(doc, {
        y,
        columns: COLUMNS[mode],
        rows,
        flowColumns: mode === "poster" ? 2 : 1,
      });
    }
    drawPageFooters(
      doc,
      `${TITLE[mode]}${data.production ? ` · ${data.production}` : ""} · ${stand}`,
    );
  },
};
