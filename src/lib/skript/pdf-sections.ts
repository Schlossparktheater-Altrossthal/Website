import {
  drawTable,
  type PdfTableCell,
  type PdfTableColumn,
  type PdfTableRow,
} from "@/lib/pdf/layout";

import type { ScriptReaderData } from "./reader";
import {
  CUE_CATEGORIES,
  computeScriptStats,
  cueScript,
  formatDuration,
  type ScriptStats,
} from "./stats";
import {
  CUE_LABELS,
  DEFAULT_SCENE_COLUMNS,
  SCENE_TABLE_COLUMN_LABELS,
  type SceneTableColumn,
  type ScriptPdfSection,
} from "./export-options";
import type { CueCategory } from "./types";

/**
 * Zusätzliche Abschnitte im Skript-PDF (docs/Plan/skript-auswertungen-plan.md, Phase 3):
 * Rollenstatistik, Szenentabelle, Auftrittsmatrix, Technik-Fahrplan, Stichwortheft.
 */

export type SectionOptions = {
  roleIds: string[];
  hiddenCues: string[];
  sceneColumns: SceneTableColumn[];
  matrixCell: "mark" | "words" | "passages";
};

type Doc = PDFKit.PDFDocument;

const INK = "#1c1917";
const MUTED = "#78716c";
const ACCENT = "#d9480f";

const NUMBER = new Intl.NumberFormat("de-DE");
const PERCENT = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });

/** Kurzname einer Szene für enge Spalten: „SZENE 10 A – Furcht“ → „10A“. */
export function sceneShortLabel(title: string, index: number) {
  const match = /^(?:szene|bild|auftritt)?\s*(\d+)\s*([a-z])?\b/iu.exec(title.trim());
  if (match) return `${match[1]}${(match[2] ?? "").toUpperCase()}`;
  if (/^\(?vorspann\)?$/iu.test(title.trim())) return "V";
  if (/^pause/iu.test(title.trim())) return "P";
  return String(index + 1);
}

function heading(doc: Doc, title: string, hint?: string) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  doc.rect(left, doc.y, 28, 3).fill(ACCENT);
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(INK)
    .text(title, left, doc.y + 10, { width });
  if (hint) doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(hint, { width });
  doc.moveDown(0.6);
  return doc.y;
}

function roleNames(data: ScriptReaderData) {
  return new Map(data.roles.map((role) => [role.id, role.name]));
}

function renderRoleStats(doc: Doc, stats: ScriptStats, mine: Set<string>) {
  const y = heading(
    doc,
    "Rollen in Zahlen",
    `${NUMBER.format(stats.totalWords)} gesprochene Wörter in ${NUMBER.format(stats.totalPassages)} Passagen · gemeinsame Repliken zählen für jede Rolle`,
  );
  const columns: PdfTableColumn[] = [
    { label: "ROLLE", weight: 3 },
    { label: "WÖRTER", weight: 1.3, align: "right" },
    { label: "ANTEIL", weight: 1.2, align: "right" },
    { label: "PASSAGEN", weight: 1.3, align: "right" },
    { label: "LÄNGSTE", weight: 1.2, align: "right" },
    { label: "SZENEN", weight: 1.1, align: "right" },
  ];
  const rows: PdfTableRow[] = stats.roles.map((role) => ({
    accent: mine.has(role.id) ? ACCENT : null,
    cells: [
      { text: role.name, bold: mine.has(role.id) },
      NUMBER.format(role.words),
      PERCENT.format(role.share),
      NUMBER.format(role.passages),
      NUMBER.format(role.longestPassage),
      NUMBER.format(role.sceneIds.length),
    ],
  }));
  drawTable(doc, { y, columns, rows });
}

function cueNumbers(stats: ScriptStats["scenes"][number], category: CueCategory) {
  const list = stats.cues[category];
  if (!list.length) return "";
  const first = list[0].number;
  const last = list[list.length - 1].number;
  return list.length === last - first + 1 && list.length > 2
    ? `${first}–${last}`
    : list.map((cue) => cue.number).join(", ");
}

function renderSceneTable(
  doc: Doc,
  data: ScriptReaderData,
  stats: ScriptStats,
  options: SectionOptions,
) {
  const names = roleNames(data);
  const mine = new Set(options.roleIds);
  const columns = options.sceneColumns.length ? options.sceneColumns : DEFAULT_SCENE_COLUMNS;
  const y = heading(
    doc,
    "Szenenübersicht",
    `${stats.scenes.length} Szenen · Sprechzeit ${formatDuration(stats.duration)}${stats.duration.estimated ? " (geschätzt aus dem gesprochenen Text, ohne Spiel, Musik und Umbauten)" : ""}`,
  );
  const tableColumns: PdfTableColumn[] = [
    { label: "SZENE", weight: 3.2 },
    ...columns.map((column): PdfTableColumn => {
      if (column === "roles") return { label: "ROLLEN", weight: 4.5 };
      if (column === "duration") return { label: "SPRECHZEIT", weight: 1.7, align: "right" };
      if (column === "pages") return { label: "SEITEN", weight: 1, align: "right" };
      if (column === "words" || column === "passages") {
        return {
          label: SCENE_TABLE_COLUMN_LABELS[column].toUpperCase(),
          weight: 1.1,
          align: "right",
        };
      }
      return { label: SCENE_TABLE_COLUMN_LABELS[column].toUpperCase(), weight: 1.2 };
    }),
  ];
  // Teil-Überschriften und leerer Vorspann (ohne Text und Hinweise) brauchen keine Zeile.
  const scenes = stats.scenes.filter(
    (scene) => scene.passages > 0 || CUE_CATEGORIES.some((c) => scene.cues[c].length),
  );
  const rows: PdfTableRow[] = scenes.map((scene) => ({
    accent: scene.roles.some((role) => mine.has(role.id)) ? ACCENT : null,
    cells: [
      { text: scene.title, bold: true },
      ...columns.map((column): PdfTableCell => {
        switch (column) {
          case "roles": {
            const spoken = scene.roles.map((role) => names.get(role.id) ?? role.id);
            const silent = scene.mentionedRoleIds.map((id) => names.get(id) ?? id);
            return {
              text: spoken.join(", ") || "–",
              sub: silent.length ? `ohne Text: ${silent.join(", ")}` : null,
            };
          }
          case "words":
            return NUMBER.format(scene.words);
          case "passages":
            return NUMBER.format(scene.passages);
          case "pages":
            return scene.pages
              ? scene.pages.from === scene.pages.to
                ? String(scene.pages.from)
                : `${scene.pages.from}–${scene.pages.to}`
              : "";
          case "duration":
            return scene.words || !scene.duration.estimated ? formatDuration(scene.duration) : "";
          default: {
            const count = scene.cues[column].length;
            return count ? { text: String(count), sub: `Nr. ${cueNumbers(scene, column)}` } : "";
          }
        }
      }),
    ],
  }));
  drawTable(doc, { y, columns: tableColumns, rows });
}

function renderMatrix(doc: Doc, stats: ScriptStats, options: SectionOptions) {
  const mine = new Set(options.roleIds);
  const cellLabel = { mark: "●", words: "Wörter", passages: "Passagen" }[options.matrixCell];
  const scenes = stats.scenes.filter((scene) => scene.passages > 0);
  const y = heading(
    doc,
    "Auftritte",
    options.matrixCell === "mark"
      ? "● spricht · ○ nur in Regieanweisungen genannt"
      : `Zahl = ${cellLabel} in der Szene · ○ nur in Regieanweisungen genannt`,
  );
  const columns: PdfTableColumn[] = [
    { label: "ROLLE", weight: 6 },
    ...scenes.map((scene) => ({
      label: sceneShortLabel(scene.title, stats.scenes.indexOf(scene)),
      weight: 1,
      align: "center" as const,
    })),
  ];
  const cells = new Map(
    scenes.map((scene) => [scene.id, new Map(scene.roles.map((role) => [role.id, role]))]),
  );
  const rows: PdfTableRow[] = stats.roles.map((role) => ({
    accent: mine.has(role.id) ? ACCENT : null,
    cells: [
      { text: role.name, bold: mine.has(role.id) },
      ...scenes.map((scene): PdfTableCell => {
        const cell = cells.get(scene.id)?.get(role.id);
        if (!cell)
          return scene.mentionedRoleIds.includes(role.id) ? { text: "○", color: MUTED } : "";
        if (options.matrixCell === "mark") return { text: "●", color: INK };
        return String(options.matrixCell === "words" ? cell.words : cell.passages);
      }),
    ],
  }));
  drawTable(doc, { y, columns, rows });
}

function renderCueList(
  doc: Doc,
  data: ScriptReaderData,
  stats: ScriptStats,
  options: SectionOptions,
) {
  const hidden = new Set(options.hiddenCues);
  const sceneTitle = new Map(data.scenes.map((scene) => [scene.id, scene.title]));
  const cues = stats.cues.filter((cue) => !hidden.has(cue.category));
  const y = heading(
    doc,
    "Technik-Fahrplan",
    `${cues.length} Hinweise in Stückreihenfolge · Nummern je Gewerk · Stichwort = letzte gesprochene Wörter davor`,
  );
  const columns: PdfTableColumn[] = [
    { label: "NR.", weight: 1.4 },
    { label: "HINWEIS", weight: 5 },
    { label: "STICHWORT", weight: 4 },
    { label: "S.", weight: 0.7, align: "right" },
  ];
  const rows: PdfTableRow[] = [];
  let scene: string | null = null;
  for (const cue of cues) {
    if (cue.sceneId !== scene) {
      scene = cue.sceneId;
      rows.push({ kind: "group", label: sceneTitle.get(cue.sceneId) ?? "" });
    }
    rows.push({
      cells: [
        { text: `${CUE_LABELS[cue.category]} ${cue.number}`, bold: true },
        cue.text,
        { text: cue.after ? `…${cue.after}` : "(Szenenanfang)", color: MUTED },
        cue.page != null ? String(cue.page) : "",
      ],
    });
  }
  drawTable(doc, { y, columns, rows });
}

function renderCueScript(doc: Doc, data: ScriptReaderData, options: SectionOptions) {
  const names = roleNames(data);
  const sceneTitle = new Map(data.scenes.map((scene) => [scene.id, scene.title]));
  const selected = options.roleIds.map((id) => names.get(id)).filter(Boolean);
  const y = heading(
    doc,
    "Stichwortheft",
    selected.length
      ? `${selected.join(", ")} · eigene Repliken mit den letzten Worten davor`
      : "Keine Rolle gewählt – im Leser unter „Rollen“ oder „Fassung für“ eine Rolle wählen.",
  );
  if (!selected.length) return;
  const lines = cueScript(data, options.roleIds);
  const columns: PdfTableColumn[] = [
    { label: "STICHWORT", weight: 4 },
    { label: "TEXT", weight: 6 },
  ];
  const rows: PdfTableRow[] = [];
  let scene: string | null = null;
  for (const line of lines) {
    if (line.sceneId !== scene) {
      scene = line.sceneId;
      rows.push({ kind: "group", label: sceneTitle.get(line.sceneId) ?? "" });
    }
    rows.push({
      cells: [
        line.cue
          ? { text: `…${line.cue}`, sub: line.cueSpeaker, color: MUTED }
          : { text: "(direkt weiter)", color: MUTED },
        { text: line.text },
      ],
    });
  }
  drawTable(doc, { y, columns, rows });
}

/** Zeichnet einen Abschnitt ab einer neuen Seite. */
export function renderScriptSection(
  doc: Doc,
  section: Exclude<ScriptPdfSection, "script">,
  data: ScriptReaderData,
  options: SectionOptions,
  stats: ScriptStats = computeScriptStats(data),
) {
  const mine = new Set(options.roleIds);
  switch (section) {
    case "roleStats":
      return renderRoleStats(doc, stats, mine);
    case "sceneTable":
      return renderSceneTable(doc, data, stats, options);
    case "matrix":
      return renderMatrix(doc, stats, options);
    case "cueList":
      return renderCueList(doc, data, stats, options);
    case "cueScript":
      return renderCueScript(doc, data, options);
  }
}
