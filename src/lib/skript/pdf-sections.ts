import {
  drawTable,
  type PdfTableCell,
  type PdfTableColumn,
  type PdfTableRow,
} from "@/lib/pdf/layout";

import { buildCastingModel, isEnsembleRole, ROLE_TIER_LABELS, type RoleTier } from "./casting";
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
  sceneDisplayTitle,
  sceneShortLabel,
  type MirrorWidth,
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
  mirrorWidth?: MirrorWidth;
};

type Doc = PDFKit.PDFDocument;

const INK = "#1c1917";
const MUTED = "#78716c";
const ACCENT = "#d9480f";

const NUMBER = new Intl.NumberFormat("de-DE");
const PERCENT = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const LIGHT = "#f4c7a6";
const GRID = "#e7e5e4";
const PDF_HEADER = "#f3f4f6";

function share(value: number) {
  return value > 0 && value < 0.0005 ? "< 0,1 %" : PERCENT.format(value);
}

/** „Nr · Name“ einer Szene für Gruppenzeilen. */
function sceneLabel(title: string, index: number) {
  const { short, name } = sceneDisplayTitle(title, index);
  return short && short !== name ? `${short} · ${name}` : name;
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
    { label: "WÖRTER", weight: 1.2, align: "right" },
    { label: "ANTEIL", weight: 2.6, align: "right" },
    { label: "PASSAGEN", weight: 1.3, align: "right" },
    { label: "LÄNGSTE", weight: 1.2, align: "right" },
    { label: "SZENEN", weight: 1.1, align: "right" },
  ];
  const max = Math.max(1, ...stats.roles.map((role) => role.words));
  const row = (role: ScriptStats["roles"][number]): PdfTableRow => ({
    accent: mine.has(role.id) ? ACCENT : null,
    cells: [
      { text: role.name, bold: mine.has(role.id) },
      NUMBER.format(role.words),
      { text: share(role.share), bar: { value: role.words / max, color: ACCENT } },
      NUMBER.format(role.passages),
      NUMBER.format(role.longestPassage),
      NUMBER.format(role.sceneIds.length),
    ],
  });
  // Sammelrollen („Alle“, „Chor“ …) getrennt unter den echten Rollen.
  const ensemble = stats.roles.filter((role) => isEnsembleRole(role.name));
  const rows: PdfTableRow[] = [
    ...stats.roles.filter((role) => !isEnsembleRole(role.name)).map(row),
    ...(ensemble.length
      ? [{ kind: "group" as const, label: ROLE_TIER_LABELS.ensemble }, ...ensemble.map(row)]
      : []),
  ];
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
  // Gewerke ohne einen einzigen Hinweis in der Fassung brauchen keine leere Spalte.
  const columns = (
    options.sceneColumns.length ? options.sceneColumns : DEFAULT_SCENE_COLUMNS
  ).filter(
    (column) =>
      !(CUE_CATEGORIES as readonly string[]).includes(column) ||
      stats.scenes.some((scene) => scene.cues[column as CueCategory].length),
  );
  const y = heading(
    doc,
    "Szenenübersicht",
    `${stats.scenes.length} Szenen · Dauer ${formatDuration(stats.duration)}${stats.duration.estimated ? " · „ca.“ = geschätzt aus dem gesprochenen Text (ohne Spiel, Musik, Umbauten)" : " (gemessen)"}`,
  );
  const tableColumns: PdfTableColumn[] = [
    { label: "NR.", weight: 0.7 },
    { label: "SZENE", weight: 2.8 },
    ...columns.map((column): PdfTableColumn => {
      if (column === "roles") return { label: "ROLLEN", weight: 4.5 };
      if (column === "duration") return { label: "DAUER", weight: 1.5, align: "right" };
      if (column === "pages") return { label: "SEITEN", weight: 1, align: "right" };
      if (column === "words" || column === "passages") {
        return {
          label: SCENE_TABLE_COLUMN_LABELS[column].toUpperCase(),
          weight: 1.4,
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
      { text: sceneDisplayTitle(scene.title, stats.scenes.indexOf(scene)).short, bold: true },
      { text: sceneDisplayTitle(scene.title, stats.scenes.indexOf(scene)).name, bold: true },
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

/**
 * Szenenspiegel wie im Leser: Rollen nach Gewicht gruppiert, Balken je Auftrittsstrecke
 * (spricht kräftig, nur genannt hell). Läuft auf Querformat-Seiten (siehe pdf.ts).
 */
function renderMirror(doc: Doc, stats: ScriptStats, options: SectionOptions) {
  const mine = new Set(options.roleIds);
  const model = buildCastingModel(stats);
  const byDuration = options.mirrorWidth === "duration";
  heading(
    doc,
    "Szenenspiegel",
    `Balken = spricht · hell = nur in Regieanweisungen genannt · Spalten ${byDuration ? "nach Szenendauer" : "gleich breit"}`,
  );
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const LABEL = 118;
  const COUNT = 26;
  const area = width - LABEL - COUNT;
  const weights = model.scenes.map((scene) => (byDuration ? Math.max(30, scene.seconds) : 1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const xs: number[] = [];
  let acc = 0;
  for (const w of weights) {
    xs.push(left + LABEL + (acc / total) * area);
    acc += w;
  }
  const colWidth = (i: number) => (weights[i] / total) * area;
  const ROW = 12;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 6;

  const drawHeader = (top: number) => {
    doc.save().rect(left, top, width, 14).fill(PDF_HEADER).restore();
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED);
    doc.text("ROLLE", left + 4, top + 4, { lineBreak: false });
    model.scenes.forEach((scene, i) => {
      const label = sceneShortLabel(scene.title, i);
      if (doc.widthOfString(label) > colWidth(i) - 1) return;
      doc.text(label, xs[i], top + 4, { width: colWidth(i), align: "center", lineBreak: false });
    });
    doc.text("SZ.", left + LABEL + area, top + 4, {
      width: COUNT - 2,
      align: "right",
      lineBreak: false,
    });
    return top + 14;
  };

  let y = drawHeader(doc.y);
  const drawGrid = (top: number, height: number) => {
    doc.save().lineWidth(0.3).strokeColor(GRID);
    model.scenes.forEach((scene, i) => {
      if (i === 0 && !scene.part) return;
      doc
        .lineWidth(scene.part ? 0.9 : 0.3)
        .moveTo(xs[i], top)
        .lineTo(xs[i], top + height)
        .stroke();
    });
    doc.restore();
  };

  const tiers: RoleTier[] = ["main", "supporting", "small", "ensemble"];
  for (const tier of tiers) {
    const roles = model.roles.filter((role) => role.tier === tier);
    if (!roles.length) continue;
    if (y + 14 + ROW > bottom()) {
      doc.addPage({ ...doc.options, layout: "landscape" });
      y = drawHeader(doc.page.margins.top);
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(`${ROLE_TIER_LABELS[tier].toUpperCase()} · ${roles.length}`, left + 4, y + 5, {
        characterSpacing: 0.4,
        lineBreak: false,
      });
    y += 15;
    roles.forEach((role, index) => {
      if (y + ROW > bottom()) {
        doc.addPage({ ...doc.options, layout: "landscape" });
        y = drawHeader(doc.page.margins.top);
      }
      if (index % 2 === 1) doc.save().rect(left, y, width, ROW).fill("#fafaf9").restore();
      drawGrid(y, ROW);
      const own = mine.has(role.id);
      if (own) doc.save().rect(left, y, 2, ROW).fill(ACCENT).restore();
      doc
        .font(own ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7.5)
        .fillColor(INK)
        .text(role.name, left + 5, y + 2.5, {
          width: LABEL - 8,
          height: ROW,
          lineBreak: false,
          ellipsis: true,
        });
      // Aufeinanderfolgende Szenen mit gleicher Anwesenheit zu einem Balken verbinden.
      let start = -1;
      let kind: string | undefined;
      const flush = (end: number) => {
        if (start < 0) return;
        const x0 = xs[start] + 1;
        const x1 = xs[end] + colWidth(end) - 1;
        doc
          .save()
          .roundedRect(x0, y + 3.5, Math.max(2, x1 - x0), 5, 2.5)
          .fill(kind === "speaks" ? ACCENT : LIGHT)
          .restore();
        start = -1;
      };
      model.scenes.forEach((_, i) => {
        const presence = role.presence.get(i);
        if (presence !== kind || !presence) flush(i - 1);
        if (presence && start < 0) start = i;
        kind = presence;
      });
      flush(model.scenes.length - 1);
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(MUTED)
        .text(String(role.presence.size), left + LABEL + area, y + 2.5, {
          width: COUNT - 2,
          align: "right",
          lineBreak: false,
        });
      y += ROW;
    });
    y += 4;
  }
  doc.y = y;
}

function renderCueList(
  doc: Doc,
  data: ScriptReaderData,
  stats: ScriptStats,
  options: SectionOptions,
) {
  const hidden = new Set(options.hiddenCues);
  const sceneTitle = new Map(
    data.scenes.map((scene, index) => [scene.id, sceneLabel(scene.title, index)]),
  );
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
    case "mirror":
      return renderMirror(doc, stats, options);
    case "cueList":
      return renderCueList(doc, data, stats, options);
    case "cueScript":
      return renderCueScript(doc, data, options);
  }
}
