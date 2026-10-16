import { z } from "zod";

import type { PdfTemplate } from "../types";

const entryStatusValues = ["none", "blocked", "limited", "preferred", "emergency"] as const;
const memberZoneValues = ["acting", "both", "crew", "unknown"] as const;

const daySchema = z.object({
  key: z.string(),
  /** Kurzer Wochentag, z. B. „Fr“. */
  weekday: z.string(),
  /** Kurzes Datum, z. B. „16.10.“. */
  date: z.string(),
  /** Ferien, Feiertage, Endprobenwoche – kurze Hinweise unter dem Datum. */
  badges: z
    .array(
      z.object({
        kind: z.enum(["schoolHoliday", "publicHoliday", "finalWeek"]),
        label: z.string(),
      }),
    )
    .default([]),
  /** Proben und Termine an diesem Tag. */
  events: z
    .array(
      z.object({
        rehearsal: z.boolean(),
        time: z.string().nullable(),
        title: z.string(),
      }),
    )
    .default([]),
});

const entrySchema = z.object({
  dayKey: z.string(),
  status: z.enum(entryStatusValues),
  /** Grund (nur für Planer), sonst null. */
  value: z.string().nullable(),
});

const memberSchema = z.object({
  zone: z.enum(memberZoneValues),
  name: z.string(),
  /** Rollen bzw. Gewerke, klein hinter dem Namen. */
  detail: z.string().nullable().default(null),
  entries: z.array(entrySchema),
});

const sceneStatusValues = ["ready", "alternate", "limited", "missing"] as const;

const sceneRowSchema = z.object({
  label: z.string(),
  /** Je Tag (gleiche Reihenfolge wie `days`): Zustand und kurzer Hinweis (wer fehlt). */
  cells: z.array(z.object({ status: z.enum(sceneStatusValues), note: z.string().nullable() })),
});

const sperrlisteImportantDaysSchema = z
  .object({
    generatedAt: z.string().datetime(),
    production: z.string().nullable().default(null),
    range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
      label: z.string().nullable(),
    }),
    summary: z.object({
      memberCount: z.number().int().nonnegative(),
      importantWeekdays: z.string().nullable(),
    }),
    days: z.array(daySchema),
    members: z.array(memberSchema),
    /** null: keine Szenen/Besetzung – der Abschnitt entfällt bzw. zeigt einen Hinweis. */
    scenes: z
      .object({
        castComplete: z.boolean(),
        rows: z.array(sceneRowSchema),
      })
      .nullable()
      .default(null),
  })
  .superRefine((data, ctx) => {
    data.members.forEach((member, memberIndex) => {
      if (member.entries.length !== data.days.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["members", memberIndex, "entries"],
          message: "entries length must match number of days",
        });
      }
    });
  });

export type SperrlisteImportantDaysPdfData = z.infer<typeof sperrlisteImportantDaysSchema>;
type Day = SperrlisteImportantDaysPdfData["days"][number];
type Member = SperrlisteImportantDaysPdfData["members"][number];
type Zone = Member["zone"];
type Status = Member["entries"][number]["status"];
type SceneStatus = (typeof sceneStatusValues)[number];

const SCENE_STYLE: Record<SceneStatus, { fill: string; ink: string; label: string }> = {
  ready: { fill: "#dcfce7", ink: "#15803d", label: "probbar" },
  alternate: { fill: "#cffafe", ink: "#0e7490", label: "mit Zweitbesetzung" },
  limited: { fill: "#fef3c7", ink: "#b45309", label: "eingeschränkt" },
  missing: { fill: "#fee2e2", ink: "#b91c1c", label: "fehlt jemand" },
};

const FONT = "Helvetica";
const BOLD = "Helvetica-Bold";
const MARGIN = 28;

const COLOR = {
  text: "#111827",
  muted: "#6b7280",
  faint: "#9ca3af",
  line: "#e5e7eb",
  header: "#f3f4f6",
  accent: "#4f46e5",
  rehearsal: "#4338ca",
  rehearsalFill: "#e0e7ff",
  holiday: "#0e7490",
  holidayFill: "#cffafe",
  publicHoliday: "#b45309",
  publicHolidayFill: "#fef3c7",
  finalWeek: "#be185d",
  finalWeekFill: "#fce7f3",
};

const STATUS_STYLE: Record<
  Exclude<Status, "none">,
  { fill: string; ink: string; label: string }
> = {
  blocked: { fill: "#fee2e2", ink: "#b91c1c", label: "gesperrt" },
  emergency: { fill: "#fee2e2", ink: "#b91c1c", label: "nur im Notfall" },
  limited: { fill: "#fef3c7", ink: "#b45309", label: "eingeschränkt" },
  preferred: { fill: "#dcfce7", ink: "#15803d", label: "bevorzugt" },
};

const ZONE_STYLE: Record<Zone, { label: string; ink: string; fill: string }> = {
  acting: { label: "Schauspiel", ink: "#4338ca", fill: "#eef2ff" },
  both: { label: "Schauspiel & Gewerke", ink: "#7c3aed", fill: "#f5f3ff" },
  crew: { label: "Gewerke", ink: "#047857", fill: "#ecfdf5" },
  unknown: { label: "Noch nicht zugewiesen", ink: "#4b5563", fill: "#f3f4f6" },
};

const BADGE_STYLE: Record<Day["badges"][number]["kind"], { ink: string; fill: string }> = {
  schoolHoliday: { ink: COLOR.holiday, fill: COLOR.holidayFill },
  publicHoliday: { ink: COLOR.publicHoliday, fill: COLOR.publicHolidayFill },
  finalWeek: { ink: COLOR.finalWeek, fill: COLOR.finalWeekFill },
};

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});
const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

const isAway = (status: Status) => status === "blocked" || status === "emergency";

// ---------- Zeichenhelfer ----------

function drawCheck(doc: PDFKit.PDFDocument, cx: number, cy: number, size: number, color: string) {
  doc
    .save()
    .lineWidth(1.1)
    .lineCap("round")
    .lineJoin("round")
    .moveTo(cx - size * 0.5, cy)
    .lineTo(cx - size * 0.12, cy + size * 0.38)
    .lineTo(cx + size * 0.55, cy - size * 0.42)
    .stroke(color)
    .restore();
}

function drawCross(doc: PDFKit.PDFDocument, cx: number, cy: number, size: number, color: string) {
  const h = size / 2;
  doc
    .save()
    .lineWidth(1.2)
    .lineCap("round")
    .moveTo(cx - h, cy - h)
    .lineTo(cx + h, cy + h)
    .moveTo(cx + h, cy - h)
    .lineTo(cx - h, cy + h)
    .stroke(color)
    .restore();
}

function drawTilde(doc: PDFKit.PDFDocument, cx: number, cy: number, size: number, color: string) {
  const h = size / 2;
  doc
    .save()
    .lineWidth(1.2)
    .lineCap("round")
    .moveTo(cx - h, cy + 1)
    .bezierCurveTo(cx - h / 2, cy - 2.5, cx, cy - 1, cx, cy)
    .bezierCurveTo(cx, cy + 1, cx + h / 2, cy + 2.5, cx + h, cy - 1)
    .stroke(color)
    .restore();
}

function drawStar(doc: PDFKit.PDFDocument, cx: number, cy: number, size: number, color: string) {
  const outer = size / 2;
  const inner = outer * 0.45;
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  doc
    .save()
    .polygon(...points)
    .fill(color)
    .restore();
}

function drawDot(doc: PDFKit.PDFDocument, cx: number, cy: number, color: string) {
  doc.save().circle(cx, cy, 0.9).fill(color).restore();
}

function drawStatusIcon(doc: PDFKit.PDFDocument, status: Status, cx: number, cy: number, size = 6) {
  if (status === "none") return drawCheck(doc, cx, cy, size, "#86c5a0");
  const ink = STATUS_STYLE[status].ink;
  if (isAway(status)) return drawCross(doc, cx, cy, size - 1, ink);
  if (status === "limited") return drawTilde(doc, cx, cy, size + 1, ink);
  return drawStar(doc, cx, cy, size + 1.5, ink);
}

/** Pill mit Text; gibt die Breite zurück. */
function drawPill(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  text: string,
  style: { ink: string; fill: string },
  maxWidth: number,
  fontSize = 5.6,
) {
  doc.font(BOLD).fontSize(fontSize);
  const width = Math.min(maxWidth, doc.widthOfString(text) + 5);
  const height = fontSize + 3;
  doc
    .save()
    .roundedRect(x, y, width, height, height / 2)
    .fill(style.fill)
    .restore();
  doc.fillColor(style.ink).text(text, x + 2.5, y + 1.6, {
    width: width - 5,
    height: fontSize + 1,
    lineBreak: false,
    ellipsis: true,
  });
  return width;
}

function textLine(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: { font?: string; size: number; color: string; align?: "left" | "center" | "right" },
) {
  doc
    .font(options.font ?? FONT)
    .fontSize(options.size)
    .fillColor(options.color)
    .text(text, x, y, {
      width,
      height: options.size + 2,
      lineBreak: false,
      ellipsis: true,
      align: options.align ?? "left",
    });
}

// ---------- Layout ----------

type Layout = {
  left: number;
  right: number;
  nameWidth: number;
  dayWidth: number;
  dayX: (index: number) => number;
};

function buildLayout(doc: PDFKit.PDFDocument, dayCount: number): Layout {
  const left = MARGIN;
  const right = doc.page.width - MARGIN;
  const total = right - left;
  const nameWidth = Math.max(150, Math.min(210, total - dayCount * 30));
  const dayWidth = (total - nameWidth) / Math.max(1, dayCount);
  return { left, right, nameWidth, dayWidth, dayX: (index) => left + nameWidth + index * dayWidth };
}

function eventLabel(event: Day["events"][number]) {
  const title = event.rehearsal ? "Probe" : event.title;
  return event.time ? `${title} ${event.time}` : title;
}

/** Höhe des Tageskopfs: Wochentag/Datum + eine Zeile je Hinweis/Termin (max. 3). */
function dayHeaderHeight(days: Day[]) {
  const lines = Math.max(
    0,
    ...days.map((day) => Math.min(3, day.badges.length + day.events.length)),
  );
  return 22 + lines * 8.5;
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  layout: Layout,
  days: Day[],
  y: number,
  headerHeight: number,
) {
  doc
    .save()
    .rect(layout.left, y, layout.right - layout.left, headerHeight)
    .fill(COLOR.header)
    .restore();
  textLine(doc, "Mitglied", layout.left + 6, y + 6, layout.nameWidth - 12, {
    font: BOLD,
    size: 7,
    color: COLOR.muted,
  });
  days.forEach((day, index) => {
    const x = layout.dayX(index);
    const width = layout.dayWidth;
    const highlight = day.events.some((event) => event.rehearsal);
    if (highlight) {
      doc.save().rect(x, y, width, headerHeight).fill(COLOR.rehearsalFill).restore();
    }
    textLine(doc, day.weekday, x, y + 3.5, width, {
      font: BOLD,
      size: 7.5,
      color: highlight ? COLOR.rehearsal : COLOR.text,
      align: "center",
    });
    textLine(doc, day.date, x, y + 12, width, {
      size: 6.5,
      color: COLOR.muted,
      align: "center",
    });
    const items: { text: string; style: { ink: string; fill: string } }[] = [
      ...day.events.map((event) => ({
        text: eventLabel(event),
        style: event.rehearsal
          ? { ink: "#ffffff", fill: COLOR.rehearsal }
          : { ink: COLOR.text, fill: "#e5e7eb" },
      })),
      ...day.badges.map((badge) => ({ text: badge.label, style: BADGE_STYLE[badge.kind] })),
    ];
    const shown =
      items.length > 3
        ? [
            ...items.slice(0, 2),
            { text: `+${items.length - 2}`, style: { ink: COLOR.muted, fill: "#e5e7eb" } },
          ]
        : items;
    shown.forEach((item, line) => {
      doc.font(BOLD).fontSize(5.2);
      const pillWidth = Math.min(width - 3, doc.widthOfString(item.text) + 5);
      drawPill(
        doc,
        x + (width - pillWidth) / 2,
        y + 21 + line * 8.5,
        item.text,
        item.style,
        width - 3,
        5.2,
      );
    });
  });
  // Trennlinien zwischen den Tagen
  doc.save().lineWidth(0.4).strokeColor(COLOR.line);
  days.forEach((_, index) => {
    const x = layout.dayX(index);
    doc.moveTo(x, y).lineTo(x, y + headerHeight);
  });
  doc.stroke().restore();
  return y + headerHeight;
}

function drawFooter(doc: PDFKit.PDFDocument, data: SperrlisteImportantDaysPdfData) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const y = doc.page.height - MARGIN + 8;
    const left = MARGIN;
    const width = doc.page.width - MARGIN * 2;
    // Unterer Seitenrand darf beschrieben werden, ohne dass PDFKit umbricht.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    textLine(
      doc,
      `Sperrliste${data.production ? ` · ${data.production}` : ""} · Stand ${dateTimeFormatter.format(new Date(data.generatedAt))}`,
      left,
      y,
      width / 1.5,
      { size: 6, color: COLOR.faint },
    );
    textLine(doc, `Seite ${index - range.start + 1} von ${range.count}`, left, y, width, {
      size: 6,
      color: COLOR.faint,
      align: "right",
    });
    doc.page.margins.bottom = bottom;
  }
}

function drawLegend(doc: PDFKit.PDFDocument, x: number, y: number, maxX: number) {
  doc.font(FONT).fontSize(6.5);
  const items: { status: Status; label: string }[] = [
    { status: "none", label: "frei" },
    { status: "preferred", label: "bevorzugt" },
    { status: "limited", label: "eingeschränkt" },
    { status: "blocked", label: "gesperrt" },
  ];
  let cursor = x;
  for (const item of items) {
    if (item.status === "none") drawDot(doc, cursor + 3, y + 3.5, "#94a3b8");
    else drawStatusIcon(doc, item.status, cursor + 3, y + 3.5, 5.5);
    cursor += 9;
    textLine(doc, item.label, cursor, y, 60, { size: 6.5, color: COLOR.muted });
    cursor += doc.widthOfString(item.label) + 10;
  }
  cursor += 2;
  cursor +=
    drawPill(doc, cursor, y - 0.5, "Probe", { ink: "#ffffff", fill: COLOR.rehearsal }, 40) + 4;
  cursor += drawPill(doc, cursor, y - 0.5, "Ferien", BADGE_STYLE.schoolHoliday, 40) + 4;
  cursor += drawPill(doc, cursor, y - 0.5, "Feiertag", BADGE_STYLE.publicHoliday, 40) + 4;
  if (cursor < maxX) drawPill(doc, cursor, y - 0.5, "Endprobenwoche", BADGE_STYLE.finalWeek, 70);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number, hint?: string) {
  textLine(doc, title, x, y, 300, { font: BOLD, size: 9, color: COLOR.text });
  if (hint) {
    doc.font(BOLD).fontSize(9);
    const offset = doc.widthOfString(title) + 6;
    textLine(doc, hint, x + offset, y + 1.6, 400, { size: 6.5, color: COLOR.muted });
  }
  return y + 14;
}

// ---------- Vorlage ----------

export const sperrlisteImportantDaysTemplate: PdfTemplate<SperrlisteImportantDaysPdfData> = {
  id: "sperrliste-wichtige-tage",
  label: "Sperrliste – Kerntage",
  description:
    "Kompakte Übersicht der Verfügbarkeiten an den Kerntagen mit Proben, Ferien/Feiertagen und probbaren Szenen.",
  schema: sperrlisteImportantDaysSchema,
  documentOptions: { size: "A4", layout: "portrait", margin: MARGIN, bufferPages: true },
  filename: (data) => {
    const start = new Date(data.range.start).toISOString().slice(0, 10).replace(/-/g, "");
    return `sperrliste-${start}.pdf`;
  },
  render: (doc, data) => {
    const { days } = data;
    const layout = buildLayout(doc, days.length);
    const bottomLimit = () => doc.page.height - MARGIN - 10;
    const fullWidth = layout.right - layout.left;

    // Kopf
    let y = MARGIN;
    textLine(doc, "Sperrliste · Kerntage", layout.left, y, fullWidth, {
      font: BOLD,
      size: 15,
      color: COLOR.text,
    });
    y += 19;
    const rangeText = `${dateFormatter.format(new Date(data.range.start))} – ${dateFormatter.format(new Date(data.range.end))}`;
    const subtitle = [
      data.production,
      rangeText,
      data.summary.importantWeekdays ? `Kerntage: ${data.summary.importantWeekdays}` : null,
      `${data.summary.memberCount} Mitglieder`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    textLine(doc, subtitle, layout.left, y, fullWidth, { size: 7.5, color: COLOR.muted });
    y += 12;
    doc.save().rect(layout.left, y, 36, 1.6).fill(COLOR.accent).restore();
    y += 7;
    drawLegend(doc, layout.left, y, layout.right - 60);
    y += 13;

    // Tabelle
    const headerHeight = dayHeaderHeight(days);
    const rowHeight = 12.5;
    const groupHeight = 12;
    y = drawTableHeader(doc, layout, days, y, headerHeight);

    const zones = memberZoneValues.filter((zone) => data.members.some((m) => m.zone === zone));
    const notes: { day: Day; member: Member; text: string; status: Status }[] = [];

    const newPage = () => {
      doc.addPage();
      return drawTableHeader(doc, layout, days, MARGIN, headerHeight);
    };

    for (const zone of zones) {
      const members = data.members.filter((member) => member.zone === zone);
      const style = ZONE_STYLE[zone];
      if (y + groupHeight + rowHeight * 2 > bottomLimit()) y = newPage();

      // Gruppenzeile mit Anwesenheit je Tag
      doc.save().rect(layout.left, y, fullWidth, groupHeight).fill(style.fill).restore();
      doc.save().rect(layout.left, y, 2, groupHeight).fill(style.ink).restore();
      textLine(doc, `${style.label}`, layout.left + 6, y + 3, layout.nameWidth - 30, {
        font: BOLD,
        size: 7,
        color: style.ink,
      });
      doc.font(BOLD).fontSize(7);
      textLine(
        doc,
        String(members.length),
        layout.left + 6 + doc.widthOfString(style.label) + 4,
        y + 3,
        30,
        { size: 6.5, color: style.ink },
      );
      days.forEach((day, index) => {
        const present = members.filter(
          (member) => !isAway(member.entries[index]?.status ?? "none"),
        ).length;
        textLine(
          doc,
          `${present}/${members.length}`,
          layout.dayX(index),
          y + 3.2,
          layout.dayWidth,
          {
            font: BOLD,
            size: 6.5,
            color: present === members.length ? style.ink : "#b91c1c",
            align: "center",
          },
        );
      });
      y += groupHeight;

      members.forEach((member, memberIndex) => {
        if (y + rowHeight > bottomLimit()) y = newPage();
        if (memberIndex % 2 === 1) {
          doc.save().rect(layout.left, y, fullWidth, rowHeight).fill("#fafafa").restore();
        }
        doc.font(BOLD).fontSize(7);
        const nameWidth = Math.min(doc.widthOfString(member.name), layout.nameWidth - 12);
        textLine(doc, member.name, layout.left + 6, y + 3, layout.nameWidth - 12, {
          font: BOLD,
          size: 7,
          color: COLOR.text,
        });
        if (member.detail) {
          textLine(
            doc,
            member.detail,
            layout.left + 6 + nameWidth + 4,
            y + 3.6,
            layout.nameWidth - nameWidth - 16,
            { size: 6, color: COLOR.muted },
          );
        }
        member.entries.forEach((entry, index) => {
          const x = layout.dayX(index);
          const day = days[index];
          if (entry.status !== "none") {
            doc
              .save()
              .rect(x + 0.6, y + 0.6, layout.dayWidth - 1.2, rowHeight - 1.2)
              .fill(STATUS_STYLE[entry.status].fill)
              .restore();
          }
          const text = entry.value?.trim();
          if (text && entry.status !== "none") {
            notes.push({ day, member, text, status: entry.status });
          }
          const showText = text && layout.dayWidth >= 44;
          if (showText) {
            drawStatusIcon(doc, entry.status, x + 6, y + rowHeight / 2, 5);
            textLine(doc, text, x + 11, y + 3.6, layout.dayWidth - 13, {
              size: 5.6,
              color: STATUS_STYLE[entry.status as Exclude<Status, "none">].ink,
            });
          } else if (entry.status === "none") {
            drawDot(doc, x + layout.dayWidth / 2, y + rowHeight / 2, "#cbd5e1");
          } else {
            drawStatusIcon(doc, entry.status, x + layout.dayWidth / 2, y + rowHeight / 2, 5.5);
          }
        });
        doc
          .save()
          .lineWidth(0.3)
          .strokeColor(COLOR.line)
          .moveTo(layout.left, y + rowHeight)
          .lineTo(layout.right, y + rowHeight)
          .stroke()
          .restore();
        y += rowHeight;
      });
    }

    // Summenzeile
    if (y + 14 > bottomLimit()) y = newPage();
    doc.save().rect(layout.left, y, fullWidth, 14).fill(COLOR.header).restore();
    textLine(doc, "Verfügbar gesamt", layout.left + 6, y + 4, layout.nameWidth, {
      font: BOLD,
      size: 7,
      color: COLOR.text,
    });
    days.forEach((day, index) => {
      const present = data.members.filter(
        (m) => !isAway(m.entries[index]?.status ?? "none"),
      ).length;
      textLine(
        doc,
        `${present}/${data.members.length}`,
        layout.dayX(index),
        y + 4,
        layout.dayWidth,
        {
          font: BOLD,
          size: 7,
          color: COLOR.text,
          align: "center",
        },
      );
    });
    y += 14;
    // Senkrechte Trennlinien über die ganze Tabelle der letzten Seite sind bewusst weggelassen –
    // Zebrastreifen und Zellfarben reichen und halten das Blatt ruhig.

    // Probbare Szenen – gleiche Tagesspalten wie oben
    if (data.scenes) {
      const scenes = data.scenes;
      y += 16;
      if (y + 30 > bottomLimit()) {
        doc.addPage();
        y = MARGIN;
      }
      const hint = scenes.rows.length
        ? `Ist die Besetzung der Szene da?${scenes.castComplete ? "" : " · noch nicht alle Rollen besetzt"}`
        : undefined;
      y = sectionTitle(doc, "Probbare Szenen", layout.left, y, hint);
      if (!scenes.rows.length) {
        textLine(
          doc,
          "Noch keine Szenen mit Besetzung – die Übersicht erscheint, sobald Szenen angelegt und Rollen besetzt sind.",
          layout.left,
          y,
          fullWidth,
          { size: 7, color: COLOR.muted },
        );
        y += 12;
      } else {
        // Legende
        let legendX = layout.left;
        for (const status of sceneStatusValues) {
          legendX +=
            drawPill(doc, legendX, y, SCENE_STYLE[status].label, SCENE_STYLE[status], 90) + 4;
        }
        y += 12;
        const sceneHeader = () => {
          doc.save().rect(layout.left, y, fullWidth, 12).fill(COLOR.header).restore();
          textLine(doc, "Szene", layout.left + 6, y + 3.2, layout.nameWidth - 12, {
            font: BOLD,
            size: 6.5,
            color: COLOR.muted,
          });
          days.forEach((day, index) => {
            const ready = scenes.rows.filter((row) => {
              const status = row.cells[index]?.status;
              return status === "ready" || status === "alternate";
            }).length;
            textLine(
              doc,
              `${day.weekday} ${day.date} · ${ready}/${scenes.rows.length}`,
              layout.dayX(index),
              y + 3.2,
              layout.dayWidth,
              {
                font: BOLD,
                size: 6,
                color: COLOR.text,
                align: "center",
              },
            );
          });
          y += 12;
        };
        sceneHeader();
        const sceneRowHeight = 11;
        scenes.rows.forEach((row, rowIndex) => {
          if (y + sceneRowHeight > bottomLimit()) {
            doc.addPage();
            y = MARGIN;
            sceneHeader();
          }
          if (rowIndex % 2 === 1) {
            doc.save().rect(layout.left, y, fullWidth, sceneRowHeight).fill("#fafafa").restore();
          }
          textLine(doc, row.label, layout.left + 6, y + 2.6, layout.nameWidth - 12, {
            size: 6.8,
            color: COLOR.text,
          });
          row.cells.forEach((cell, index) => {
            const x = layout.dayX(index);
            const style = SCENE_STYLE[cell.status];
            doc
              .save()
              .rect(x + 0.6, y + 0.6, layout.dayWidth - 1.2, sceneRowHeight - 1.2)
              .fill(style.fill)
              .restore();
            const text = cell.status === "ready" ? null : cell.note;
            if (text && layout.dayWidth >= 44) {
              textLine(doc, text, x + 3, y + 3, layout.dayWidth - 6, {
                size: 5.4,
                color: style.ink,
                align: "center",
              });
            } else if (cell.status === "ready") {
              drawCheck(doc, x + layout.dayWidth / 2, y + sceneRowHeight / 2, 5, style.ink);
            } else if (cell.status === "missing") {
              drawCross(doc, x + layout.dayWidth / 2, y + sceneRowHeight / 2, 4.5, style.ink);
            } else {
              drawTilde(doc, x + layout.dayWidth / 2, y + sceneRowHeight / 2, 6, style.ink);
            }
          });
          y += sceneRowHeight;
        });
      }
    }

    // Anmerkungen (Gründe), nur wenn welche mitgeschickt wurden
    if (notes.length) {
      y += 12;
      if (y + 30 > bottomLimit()) {
        doc.addPage();
        y = MARGIN;
      }
      y = sectionTitle(doc, "Anmerkungen", layout.left, y, "Gründe – nur für die Planung");
      const columnGap = 12;
      const columnWidth = (fullWidth - columnGap) / 2;
      const sorted = [...notes].sort(
        (a, b) =>
          a.day.key.localeCompare(b.day.key) || a.member.name.localeCompare(b.member.name, "de"),
      );
      const half = Math.ceil(sorted.length / 2);
      const columns = [sorted.slice(0, half), sorted.slice(half)];
      const startY = y;
      let maxY = y;
      columns.forEach((column, columnIndex) => {
        let columnY = startY;
        const x = layout.left + columnIndex * (columnWidth + columnGap);
        for (const note of column) {
          if (columnY + 9 > bottomLimit()) break;
          drawStatusIcon(doc, note.status, x + 3, columnY + 3.6, 4.5);
          const head = `${note.day.weekday} ${note.day.date}  ${note.member.name}:`;
          doc.font(BOLD).fontSize(6.5);
          const headWidth = Math.min(doc.widthOfString(head), columnWidth - 40);
          textLine(doc, head, x + 9, columnY, headWidth + 1, {
            font: BOLD,
            size: 6.5,
            color: COLOR.text,
          });
          textLine(doc, note.text, x + 12 + headWidth, columnY, columnWidth - headWidth - 14, {
            size: 6.5,
            color: COLOR.muted,
          });
          columnY += 9;
        }
        maxY = Math.max(maxY, columnY);
      });
      y = maxY;
    }

    drawFooter(doc, data);
  },
};
