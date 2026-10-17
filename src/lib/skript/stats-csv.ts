import { CUE_LABELS, SCENE_TABLE_COLUMN_LABELS, type SceneTableColumn } from "./export-options";
import { formatDuration, type ScriptStats } from "./stats";

/**
 * CSV-Export der Auswertungen (docs/Plan/skript-auswertungen-plan.md, Phase 5). Semikolon und
 * BOM, damit Excel mit deutschen Einstellungen Umlaute und Spalten richtig liest.
 */

type Names = ReadonlyMap<string, string>;

function cell(value: string | number) {
  const text = typeof value === "number" ? String(value).replace(".", ",") : value;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly (readonly (string | number)[])[]) {
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}

export function roleStatsCsv(stats: ScriptStats) {
  return toCsv([
    ["Rolle", "Wörter", "Anteil %", "Passagen", "Längste Passage", "Szenen"],
    ...stats.roles.map((role) => [
      role.name,
      role.words,
      Math.round(role.share * 1000) / 10,
      role.passages,
      role.longestPassage,
      role.sceneIds.length,
    ]),
  ]);
}

export function sceneTableCsv(
  stats: ScriptStats,
  names: Names,
  columns: readonly SceneTableColumn[],
) {
  return toCsv([
    ["Szene", ...columns.map((column) => SCENE_TABLE_COLUMN_LABELS[column])],
    ...stats.scenes.map((scene) => [
      scene.title,
      ...columns.map((column): string | number => {
        switch (column) {
          case "roles":
            return scene.roles.map((role) => names.get(role.id) ?? role.id).join(", ");
          case "words":
            return scene.words;
          case "passages":
            return scene.passages;
          case "pages":
            return scene.pages ? `${scene.pages.from}–${scene.pages.to}` : "";
          case "duration":
            return scene.words ? formatDuration(scene.duration) : "";
          default:
            return scene.cues[column].map((cue) => cue.number).join(", ");
        }
      }),
    ]),
  ]);
}

export function matrixCsv(stats: ScriptStats, cellKind: "mark" | "words" | "passages") {
  const scenes = stats.scenes.filter((scene) => scene.passages > 0);
  const lookup = new Map(
    scenes.map((scene) => [scene.id, new Map(scene.roles.map((role) => [role.id, role]))]),
  );
  return toCsv([
    ["Rolle", ...scenes.map((scene) => scene.title)],
    ...stats.roles.map((role) => [
      role.name,
      ...scenes.map((scene) => {
        const entry = lookup.get(scene.id)?.get(role.id);
        if (!entry) return scene.mentionedRoleIds.includes(role.id) ? "(erwähnt)" : "";
        if (cellKind === "mark") return "x";
        return cellKind === "words" ? entry.words : entry.passages;
      }),
    ]),
  ]);
}

export function cueListCsv(stats: ScriptStats, sceneTitles: Names) {
  return toCsv([
    ["Gewerk", "Nr.", "Hinweis", "Stichwort", "Szene", "Seite"],
    ...stats.cues.map((cue) => [
      CUE_LABELS[cue.category],
      cue.number,
      cue.text,
      cue.after,
      sceneTitles.get(cue.sceneId) ?? "",
      cue.page ?? "",
    ]),
  ]);
}
