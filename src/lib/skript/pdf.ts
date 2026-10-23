import { z } from "zod";

import { DEFAULT_TIME_ZONE } from "@/lib/format/date";
import type { PdfTemplate } from "@/lib/pdf/types";

import { joinNames, sortCredits } from "./credits";
import {
  DEFAULT_SCENE_COLUMNS,
  SCENE_TABLE_COLUMNS,
  SCRIPT_PDF_SECTIONS,
  SCRIPT_PDF_SECTION_LABELS,
  type ScriptPdfSection,
} from "./export-options";
import { SKETCH_HEIGHT } from "./annotation-types";
import { blockNotes, drawSketch, segmentText, type BlockNotes, type PdfNote } from "./pdf-notes";
import { renderScriptSection } from "./pdf-sections";
import {
  buildSceneHeaders,
  formatPages,
  SCENE_HEADER_ITEMS,
  type SceneHeaderModel,
} from "./scene-header";
import { formatDuration } from "./stats";
import type { ScriptReaderData } from "./reader";
import { cueLineIndices, isRoleBlock, splitTail } from "./reader-logic";
import type { CueCategory, ScriptPart } from "./types";

/**
 * PDF-Ausgabe einer Fassung mit den Einstellungen des Lesers (docs/Plan/skript-plan.md, Phase 6).
 * Aufbau wie der Leser am Desktop: Sprecher-Spalte links, Text rechts, Regie kursiv.
 */

export const SCRIPT_PDF_VISIBILITY = ["show", "dim", "hide"] as const;

export const scriptPdfOptionsSchema = z.object({
  roleIds: z.array(z.string()).default([]),
  directions: z.enum(SCRIPT_PDF_VISIBILITY).default("show"),
  hiddenCues: z.array(z.string()).default([]),
  dimOthers: z.boolean().default(false),
  fontSize: z.number().int().min(0).max(3).default(1),
  cover: z.boolean().default(true),
  /** Personalisiert „für“ ein Mitglied der Produktion (Name kommt aus den Leser-Daten). */
  personId: z.string().min(1).nullable().default(null),
  /** Was das Deckblatt bei einer personalisierten Fassung nennt. */
  personShow: z.enum(["both", "role", "name"]).default("both"),
  /** Abschnitte in Reihenfolge; „script“ ist das Skript selbst (Phase 3 Auswertungen). */
  sections: z
    .array(z.enum(SCRIPT_PDF_SECTIONS))
    .max(SCRIPT_PDF_SECTIONS.length)
    .default(["script"])
    .transform((list) => (list.length ? [...new Set(list)] : ["script" as const])),
  sceneColumns: z.array(z.enum(SCENE_TABLE_COLUMNS)).default(DEFAULT_SCENE_COLUMNS),
  matrixCell: z.enum(["mark", "words", "passages"]).default("mark"),
  /** Szenenkopf-Bausteine (wie im Leser); null = kein Kopf (docs/Plan/skript-ansicht-plan.md). */
  sceneHeader: z
    .array(z.enum(SCENE_HEADER_ITEMS))
    .max(SCENE_HEADER_ITEMS.length)
    .nullable()
    .default(null),
  sceneHeaderOnlyMine: z.boolean().default(false),
  /** Eigene Markierungen, Zeichen, Notizen und Zettel mitdrucken. */
  notes: z.boolean().default(false),
});

export type ScriptPdfOptions = z.infer<typeof scriptPdfOptionsSchema>;

export type ScriptPdfInput = {
  title: string;
  data: ScriptReaderData;
  options: ScriptPdfOptions;
  /** Name der Person bei einer personalisierten Fassung. */
  personName?: string | null;
  /** Eigene Notizen der Person, die das PDF erzeugt (nur wenn gewünscht). */
  notes?: PdfNote[];
};

/** Druckfarben je Gewerk (dunkel genug für Schwarzweiß-Druck). */
const CUE_COLORS: Record<CueCategory, string> = {
  ton: "#a16207",
  licht: "#0e7490",
  nebel: "#15803d",
  effekt: "#a21caf",
  umbau: "#b91c1c",
  aus: "#57534e",
  technik: "#c2410c",
};
const CUE_LABELS: Record<CueCategory, string> = {
  ton: "TON",
  licht: "LICHT",
  nebel: "NEBEL",
  effekt: "EFFEKT",
  umbau: "UMBAU",
  aus: "OFF",
  technik: "TECHNIK",
};
const INK = "#1c1917";
const MUTED = "#78716c";
const MINE_FILL = "#fdeedd";
const MINE_BAR = "#d9480f";

const FONT_SIZES = [9, 10, 11, 12.5];
const MARGIN = 48;
/** Sprecher-Spalte: so breit wie der längste Name, aber in diesen Grenzen. */
const SPEAKER_MIN = 64;
const SPEAKER_MAX = 130;
const GAP = 10;

type Doc = PDFKit.PDFDocument;

function fileSlug(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "skript"
  );
}

type PartEntry = { part: ScriptPart; index: number };

/** Sichtbare Teile mit ihrem Index im Absatz (Notizen verweisen auf den Index). */
function visibleParts(
  parts: ScriptPart[],
  options: ScriptPdfOptions,
  hidden: Set<string>,
): PartEntry[] {
  return parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => {
      if (part.kind === "cue") return !hidden.has(part.category);
      if (part.kind === "direction") return options.directions !== "hide";
      return true;
    });
}

type Run = { text: string; font: string; color: string; oblique?: boolean; underline?: boolean };

function partRuns(
  entries: PartEntry[],
  options: ScriptPdfOptions,
  baseColor: string,
  cueLine: boolean,
  notes?: BlockNotes,
): Run[] {
  const runs: Run[] = [];
  const lastText = cueLine ? entries.findLastIndex(({ part }) => part.kind === "text") : -1;
  const directionColor = options.directions === "dim" ? "#a8a29e" : MUTED;
  entries.forEach(({ part, index }, position) => {
    if (part.kind === "cue") {
      const color = CUE_COLORS[part.category];
      const label = CUE_LABELS[part.category];
      const named = part.text.toUpperCase().startsWith(label);
      runs.push({
        text: named ? `[${part.text}] ` : `[${label}: ${part.text}] `,
        font: "Helvetica-Bold",
        color,
      });
      return;
    }
    const direction = part.kind === "direction";
    const color = direction ? directionColor : baseColor;
    // Stichwortzeile: die letzten Wörter fett und unterstrichen.
    const tailStart = position === lastText ? splitTail(part.text)[0].length : null;
    const segments = segmentText(
      part.text,
      notes?.parts.get(index) ?? [],
      tailStart === null ? [] : [tailStart],
    );
    let offset = 0;
    for (const segment of segments) {
      for (const insert of segment.inserts) {
        runs.push({ text: insert.text, font: "Helvetica-Bold", color: insert.color });
      }
      if (segment.text) {
        const inTail = tailStart !== null && offset >= tailStart;
        const decoration = segment.covering.findLast((d) => d.tint);
        runs.push({
          text: segment.text,
          font: inTail || segment.covering.some((d) => d.bold) ? "Helvetica-Bold" : "Helvetica",
          color: decoration?.color ?? color,
          oblique: direction,
          underline: inTail || segment.covering.some((d) => d.underline),
        });
      }
      offset += segment.text.length;
    }
    runs.push({ text: " ", font: "Helvetica", color });
  });
  return runs;
}

/** Notiztexte und Zettel unter einem Absatz (eigene Notizen, nur auf Wunsch). */
function renderBlockNotes(
  doc: Doc,
  notes: BlockNotes,
  layout: { x: number; width: number; size: number; ensureSpace: (height: number) => void },
) {
  const size = layout.size * 0.8;
  for (const line of notes.lines) {
    const runs: Run[] = [
      ...(line.number !== null
        ? [{ text: `[${line.number}] `, font: "Helvetica-Bold", color: line.color }]
        : []),
      ...(line.quote ? [{ text: `„${line.quote}“ `, font: "Helvetica", color: MUTED }] : []),
      { text: line.body, font: "Helvetica", color: INK, oblique: true },
    ];
    doc.fontSize(size);
    const height = runsHeight(doc, runs, layout.width - 8);
    layout.ensureSpace(height + 2);
    doc.fontSize(size);
    const y = doc.y;
    doc.rect(layout.x, y, 1.5, height).fill(line.color);
    writeRuns(doc, runs, layout.x + 6, y, layout.width - 8);
    doc.y = Math.max(doc.y, y + height) + 2;
  }
  const sketchWidth = Math.min(120, layout.width);
  for (const strokes of notes.sketches) {
    layout.ensureSpace(sketchWidth * SKETCH_HEIGHT + 4);
    const y = doc.y;
    const height = drawSketch(doc, strokes, layout.x, y, sketchWidth);
    doc.y = y + height + 4;
  }
  doc.fontSize(layout.size);
}

function writeRuns(doc: Doc, runs: Run[], x: number, y: number, width: number) {
  runs.forEach((run, index) => {
    doc.font(run.font).fillColor(run.color);
    const options = {
      width,
      continued: index < runs.length - 1,
      // pdfkit behält Optionen bei `continued` bei – daher immer explizit setzen.
      oblique: run.oblique ? 12 : 0,
      underline: run.underline ?? false,
      lineGap: 1.5,
    };
    const text = index === runs.length - 1 ? run.text.trimEnd() || " " : run.text;
    if (index === 0) doc.text(text, x, y, options);
    else doc.text(text, options);
  });
}

function runsHeight(doc: Doc, runs: Run[], width: number) {
  // Näherung: gemischte Schnitte als Normalschrift gemessen, Fettes etwas breiter.
  doc.font("Helvetica");
  const text = runs.map((run) => run.text).join("");
  return doc.heightOfString(text.trimEnd() || " ", { width, lineGap: 1.5 }) * 1.04;
}

export function renderScriptPdf(doc: Doc, input: ScriptPdfInput) {
  const { data, options, title } = input;
  const size = FONT_SIZES[options.fontSize] ?? FONT_SIZES[1];
  const hidden = new Set(options.hiddenCues);
  const roleSet = new Set(options.roleIds);
  const cueLines = cueLineIndices(data.blocks, roleSet);
  const left = MARGIN;
  const right = doc.page.width - MARGIN;
  const speakerStyle = () => doc.font("Helvetica-Bold").fontSize(size * 0.85);
  const speakerWidthOf = (name: string) =>
    speakerStyle().widthOfString(name, { characterSpacing: 0.3 }) + 2;
  const widest = Math.max(
    0,
    ...data.blocks.map((block) => speakerWidthOf((block.speaker ?? "").toUpperCase())),
  );
  const SPEAKER_WIDTH = Math.max(SPEAKER_MIN, Math.min(SPEAKER_MAX, widest));
  const textX = left + SPEAKER_WIDTH + GAP;
  const textWidth = right - textX;
  const bottom = () => doc.page.height - MARGIN;
  const selectedNames = data.roles.filter((role) => roleSet.has(role.id)).map((r) => r.name);

  const personName = options.personShow !== "role" ? (input.personName ?? null) : null;
  const footerText = [title, data.version.label, personName ? `für ${personName}` : null]
    .filter(Boolean)
    .join(" · ");
  const sceneTitles = new Map(data.scenes.map((scene) => [scene.id, scene.title]));
  const scenePages = new Map<string, number>();
  let coverEnd = 0;
  if (options.cover) {
    coverEnd = renderCover(doc, input, selectedNames);
    doc.addPage();
  }
  const coverPages = options.cover ? 1 : 0;

  // Titelblock (mit Deckblatt überflüssig)
  if (!options.cover) {
    // Titelblock
    doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text(title, left, MARGIN);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED)
      .text(
        [
          data.version.label,
          data.version.status === "draft" ? "Entwurf" : null,
          selectedNames.length ? `Hervorgehoben: ${selectedNames.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    doc.moveDown(0.8);
  }

  // Abschnitte vor/nach dem Skript; jeder beginnt auf einer eigenen Seite.
  const sectionPages: { label: string; page: number }[] = [];
  const scriptAt = options.sections.indexOf("script");
  const before = scriptAt < 0 ? options.sections : options.sections.slice(0, scriptAt);
  const after = scriptAt < 0 ? [] : options.sections.slice(scriptAt + 1);
  const pageNumber = () => doc.bufferedPageRange().count - coverPages;
  const renderSections = (list: readonly ScriptPdfSection[]) => {
    for (const section of list) {
      if (section === "script") continue;
      if (doc.y > doc.page.height * 0.3) doc.addPage();
      sectionPages.push({ label: SCRIPT_PDF_SECTION_LABELS[section], page: pageNumber() });
      renderScriptSection(doc, section, data, options);
    }
  };
  renderSections(before);
  if (scriptAt >= 0 && before.length) doc.addPage();
  if (scriptAt >= 0 && (before.length || after.length)) {
    sectionPages.push({ label: SCRIPT_PDF_SECTION_LABELS.script, page: pageNumber() });
  }

  let currentScene: string | null = null;
  doc.fontSize(size);
  const roleNames = new Map(data.roles.map((role) => [role.id, role.name]));
  // Eigene Notizen je Absatz; Nummern laufen über das ganze Dokument.
  const notesByBlock = new Map<string, PdfNote[]>();
  for (const note of input.notes ?? []) {
    if (note.blockId)
      notesByBlock.set(note.blockId, [...(notesByBlock.get(note.blockId) ?? []), note]);
  }
  const noteCounter = { value: 0 };
  const headers =
    options.sceneHeader?.length && scriptAt >= 0
      ? buildSceneHeaders(
          { scenes: data.scenes, blocks: data.blocks, roles: data.roles },
          {
            // Notizen gibt es nur im Leser.
            items: options.sceneHeader.filter((item) => item !== "notes"),
            roleIds: options.roleIds,
            hiddenCues: options.hiddenCues,
          },
        )
      : new Map<string, SceneHeaderModel | null>();

  const ensureSpace = (height: number) => {
    if (doc.y + height > bottom()) {
      doc.addPage();
      doc.fontSize(size);
    }
  };

  (scriptAt >= 0 ? data.blocks : []).forEach((block, index) => {
    if (block.sceneId !== currentScene) {
      currentScene = block.sceneId;
      const header = headers.get(block.sceneId);
      const mineHere = data.roles.some(
        (role) => roleSet.has(role.id) && role.sceneIds.includes(block.sceneId),
      );
      const showHeader = header && (!options.sceneHeaderOnlyMine || mineHere) ? header : null;
      const headerHeight = showHeader
        ? renderSceneHeader(doc, showHeader, roleNames, { left, right, size }, true)
        : 0;
      // Überschrift, Kopf und die ersten Zeilen bleiben zusammen (Kopf nie allein am Seitenende).
      ensureSpace(size * 5 + Math.min(headerHeight, bottom() - MARGIN - size * 8));
      doc.moveDown(0.6);
      scenePages.set(block.sceneId, doc.bufferedPageRange().count - coverPages);
      const y = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(size * 1.05)
        .fillColor(INK)
        .text((sceneTitles.get(block.sceneId) ?? "").toUpperCase(), left, y, {
          width: right - left,
          characterSpacing: 0.6,
        });
      const lineY = doc.y + 2;
      doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(1.2).strokeColor(INK).stroke();
      doc.y = lineY + size * 0.5;
      if (showHeader) renderSceneHeader(doc, showHeader, roleNames, { left, right, size });
      doc.fontSize(size);
    }

    const parts = visibleParts(block.parts, options, hidden);
    if (!parts.length) return;
    const blockNoteList = notesByBlock.get(block.id);
    const notes = blockNoteList ? blockNotes(blockNoteList, noteCounter) : undefined;
    const notesLayout = { x: textX, width: textWidth, size, ensureSpace };
    const markBlock = (y: number, height: number) => {
      if (notes?.blockColor) doc.rect(left - 10, y - 2, 2.5, height + 4).fill(notes.blockColor);
    };

    if (block.kind === "direction") {
      if (options.directions === "hide" && !parts.some(({ part }) => part.kind === "cue")) return;
      const runs = partRuns(parts, options, MUTED, false, notes);
      const height = runsHeight(doc, runs, textWidth);
      ensureSpace(height);
      const y = doc.y;
      markBlock(y, height);
      writeRuns(doc, runs, textX, y, textWidth);
      doc.y = Math.max(doc.y, y + height) + size * 0.3;
      if (notes) renderBlockNotes(doc, notes, notesLayout);
      return;
    }

    const mine = isRoleBlock(block, roleSet);
    const dimmed = options.dimOthers && roleSet.size > 0 && !mine;
    const color = dimmed ? "#a8a29e" : INK;
    const runs = partRuns(parts, options, color, cueLines.has(index), notes);
    // Standardschrift ohne Notenzeichen: Lied als Wort kennzeichnen.
    const speaker = (
      block.kind === "song"
        ? `Lied${block.speaker ? ` · ${block.speaker}` : ""}`
        : (block.speaker ?? "?")
    ).toUpperCase();
    // Zu lange Namen stehen in einer eigenen Zeile über dem Text statt umzubrechen.
    const stacked = speakerWidthOf(speaker) > SPEAKER_WIDTH;
    const speakerHeight = stacked
      ? speakerStyle().heightOfString(speaker, { width: right - left }) + 1
      : 0;
    doc.fontSize(size);
    const height = runsHeight(doc, runs, textWidth) + speakerHeight;
    ensureSpace(Math.min(height, bottom() - MARGIN));
    const y = doc.y;
    if (mine) {
      doc
        .rect(left - 6, y - 2, right - left + 12, height + 4)
        .fill(MINE_FILL)
        .rect(left - 6, y - 2, 2.5, height + 4)
        .fill(MINE_BAR);
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(size * 0.85)
      .fillColor(mine ? MINE_BAR : dimmed ? "#a8a29e" : INK)
      .text(speaker, left, y + size * 0.1, {
        width: stacked ? right - left : SPEAKER_WIDTH,
        characterSpacing: 0.3,
      });
    markBlock(y, height);
    doc.fontSize(size);
    writeRuns(doc, runs, textX, y + speakerHeight, textWidth);
    doc.y = Math.max(doc.y, y + height) + size * 0.35;
    if (notes) renderBlockNotes(doc, notes, notesLayout);
  });

  if (after.length) doc.addPage();
  renderSections(after);

  // Kopf- und Fußzeile auf jeder Seite
  const range = doc.bufferedPageRange();
  if (options.cover) fillCoverContents(doc, input, scenePages, coverEnd, sectionPages);
  for (let page = range.start + coverPages; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    // Fußzeile liegt im unteren Rand – ohne das legt pdfkit eine neue Seite an.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - MARGIN + 16;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(footerText, left, footerY, {
        width: right - left,
        lineBreak: false,
      })
      .text(`${page - range.start - coverPages + 1} / ${range.count - coverPages}`, left, footerY, {
        width: right - left,
        align: "right",
        lineBreak: false,
      });
    doc.page.margins.bottom = bottomMargin;
  }
}

const HEADER_FILL = "#f5f5f4";
const HEADER_LABEL_WIDTH = 62;

/**
 * Szenenkopf fürs Papier: grauer Kasten unter der Überschrift, Beschriftung links, Inhalt rechts.
 * Gleicher Inhalt wie im Leser, aber immer ganz ausgeschrieben (nichts zum Aufklappen).
 */
function renderSceneHeader(
  doc: Doc,
  model: SceneHeaderModel,
  roleNames: ReadonlyMap<string, string>,
  layout: { left: number; right: number; size: number },
  /** Nur Höhe messen (damit Überschrift und Kopf zusammen auf eine Seite kommen). */
  measureOnly = false,
): number {
  const { left, right } = layout;
  const size = layout.size * 0.82;
  const name = (id: string) => roleNames.get(id) ?? id;
  const plain = (text: string, color = INK): Run => ({ text, font: "Helvetica", color });
  const bold = (text: string, color = INK): Run => ({ text, font: "Helvetica-Bold", color });
  const names = (ids: readonly string[], mine?: ReadonlySet<string>) =>
    ids.flatMap((id, index) => [
      ...(index ? [plain(", ")] : []),
      mine?.has(id) ? bold(name(id), MINE_BAR) : plain(name(id)),
    ]);
  const rows: { label: string; color: string; runs: Run[] }[] = [];
  const mine = new Set(model.roles?.speaking.filter((r) => r.mine).map((r) => r.id) ?? []);
  if (model.roles) {
    // Eigene Rollen zuerst (wie im Leser).
    const ids = model.roles.speaking.map((r) => r.id);
    const runs = names(
      [...ids.filter((id) => mine.has(id)), ...ids.filter((id) => !mine.has(id))],
      mine,
    );
    if (model.roles.mentioned.length) {
      runs.push(plain(`${runs.length ? " · " : ""}in der Regie genannt: `, MUTED));
      runs.push(...names(model.roles.mentioned).map((run) => ({ ...run, color: MUTED })));
    }
    rows.push({ label: "WER", color: MUTED, runs });
  }
  if (model.mine) {
    const runs = [
      bold(
        `${model.mine.passages} ${model.mine.passages === 1 ? "Replik" : "Repliken"} · ${model.mine.words} Wörter`,
        MINE_BAR,
      ),
    ];
    if (model.mine.cue) {
      runs.push(
        plain(
          ` · Stichwort${model.mine.cueSpeaker ? ` (${model.mine.cueSpeaker})` : ""}: „…${model.mine.cue}“`,
          MUTED,
        ),
      );
    }
    rows.push({ label: "MEIN TEIL", color: MINE_BAR, runs });
  }
  for (const { category, entries } of model.cues ?? []) {
    rows.push({
      label: CUE_LABELS[category],
      color: CUE_COLORS[category],
      runs: entries.flatMap((entry, index) => [
        ...(index ? [plain("  ·  ", MUTED)] : []),
        ...(entry.tag ? [bold(`${entry.tag} `, CUE_COLORS[category])] : []),
        plain(entry.text),
        ...(entry.page != null ? [plain(` S. ${entry.page}`, MUTED)] : []),
      ]),
    });
  }
  if (model.duration || model.size) {
    const parts = [
      model.duration
        ? `${formatDuration(model.duration)}${model.duration.estimated ? " Sprechzeit" : ""}`
        : null,
      model.size?.pages ? formatPages(model.size.pages) : null,
      model.size ? `${model.size.words} Wörter · ${model.size.passages} Passagen` : null,
    ].filter(Boolean);
    rows.push({ label: "UMFANG", color: MUTED, runs: [plain(parts.join(" · "))] });
  }
  if (model.transition) {
    rows.push({ label: "WEITER", color: MUTED, runs: names(model.transition.continuing, mine) });
  }
  if (!rows.length) return 0;

  const pad = 5;
  const textX = left + HEADER_LABEL_WIDTH;
  const textWidth = right - textX - pad;
  doc.fontSize(size);
  const heights = rows.map((row) => runsHeight(doc, row.runs, textWidth));
  const total = heights.reduce((sum, h) => sum + h + 2, 0) + pad * 2;
  if (measureOnly) return total + layout.size * 0.6;
  const top = doc.y;
  doc.rect(left - 6, top, right - left + 12, total).fill(HEADER_FILL);
  let y = top + pad;
  rows.forEach((row, index) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(size * 0.85)
      .fillColor(row.color)
      .text(row.label, left, y + size * 0.1, {
        width: HEADER_LABEL_WIDTH - 6,
        characterSpacing: 0.4,
        lineBreak: false,
      });
    doc.fontSize(size);
    writeRuns(doc, row.runs, textX, y, textWidth);
    y += heights[index] + 2;
  });
  doc.y = top + total + layout.size * 0.6;
  return total + layout.size * 0.6;
}

const DATE = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Platz für das Szenenverzeichnis auf dem Deckblatt (wird nach dem Satz gefüllt). */
const COVER_CONTENTS_Y = 0.46;

function renderCover(doc: Doc, input: ScriptPdfInput, selectedNames: string[]) {
  const { data, title, options } = input;
  const left = MARGIN;
  const width = doc.page.width - 2 * MARGIN;
  const top = doc.page.height * 0.14;
  doc.rect(left, top - 24, 40, 4).fill(MINE_BAR);
  doc.font("Helvetica-Bold").fontSize(34).fillColor(INK).text(title, left, top, { width });

  const credits = sortCredits(data.credits);
  if (credits.length) {
    doc.moveDown(0.4);
    for (const credit of credits) {
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor(MUTED)
        .text(`${credit.label} `, { width, continued: true })
        .font("Helvetica-Bold")
        .fillColor(INK)
        .text(joinNames(credit.names), { continued: false });
    }
  }

  doc.moveDown(0.8);
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(MUTED)
    .text(
      [
        data.version.label,
        data.version.status === "draft" ? "Entwurf" : null,
        data.version.versionDate
          ? `Stand vom ${DATE.format(new Date(data.version.versionDate))}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      { width },
    );

  const name = options.personShow !== "role" ? (input.personName ?? null) : null;
  const roles = options.personShow !== "name" || !name ? selectedNames : [];
  if (name || roles.length) {
    doc.moveDown(1.2);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text("FASSUNG FÜR", { width });
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(MINE_BAR)
      .text(name ?? joinNames(roles), { width });
    if (name && roles.length) {
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor(INK)
        .text(`${roles.length === 1 ? "Rolle" : "Rollen"}: ${joinNames(roles)}`, { width });
    }
  }
  const end = doc.y;
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(
      `Erstellt am ${DATE.format(new Date())} · ${data.scenes.length} Szenen · nur für den internen Gebrauch`,
      left,
      doc.page.height - MARGIN,
      { width, lineBreak: false },
    );
  doc.page.margins.bottom = bottomMargin;
  return end;
}

function fillCoverContents(
  doc: Doc,
  input: ScriptPdfInput,
  scenePages: Map<string, number>,
  coverEnd: number,
  sectionPages: readonly { label: string; page: number }[],
) {
  const range = doc.bufferedPageRange();
  doc.switchToPage(range.start);
  const left = MARGIN;
  const width = doc.page.width - 2 * MARGIN;
  let y = Math.max(doc.page.height * COVER_CONTENTS_Y, coverEnd + 28);
  const limit = doc.page.height - MARGIN - 24;
  if (sectionPages.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text("INHALT", left, y, { width });
    y += 18;
    for (const entry of sectionPages) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
      doc.text(entry.label, left, y, { width: width - 40, lineBreak: false });
      doc.text(String(entry.page), left, y, { width, align: "right", lineBreak: false });
      y += 14;
    }
    y += 14;
  }
  if (!scenePages.size) return;
  const scenes = input.data.scenes.filter((scene) => scenePages.has(scene.id));
  const lineHeight = Math.max(9, Math.min(15, (limit - y - 24) / Math.max(1, scenes.length)));
  doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text("SZENEN", left, y, { width });
  y += 18;
  doc
    .moveTo(left, y - 4)
    .lineTo(left + width, y - 4)
    .lineWidth(0.6)
    .strokeColor(MUTED)
    .stroke();
  const fontSize = Math.min(10, lineHeight * 0.72);
  for (const scene of scenes) {
    if (y + lineHeight > limit) break;
    const page = String(scenePages.get(scene.id) ?? "");
    doc.font("Helvetica").fontSize(fontSize).fillColor(INK);
    doc.text(scene.title, left, y, { width: width - 40, lineBreak: false, ellipsis: true });
    doc.text(page, left, y, { width, align: "right", lineBreak: false });
    y += lineHeight;
  }
}

export const scriptReaderPdfTemplate: PdfTemplate<ScriptPdfInput> = {
  id: "skript-fassung",
  label: "Skript-Fassung",
  description: "Fassung eines Skripts mit hervorgehobenen Rollen und gefilterten Hinweisen.",
  schema: z.custom<ScriptPdfInput>(
    (value) => typeof value === "object" && value !== null && "data" in value && "options" in value,
  ),
  filename: (input) => `skript-${fileSlug(input.title)}-${fileSlug(input.data.version.label)}.pdf`,
  documentOptions: { size: "A4", margin: MARGIN, bufferPages: true },
  render: renderScriptPdf,
};
