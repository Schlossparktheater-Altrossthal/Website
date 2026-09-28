/** Programmpunkt eines Termins für die Ablauf-Zeitleiste (Zeiten als ISO-Strings). */
export type TimelineBlock = {
  id: string;
  label: string;
  kind: "SCENE" | "DEPARTMENT" | "CUSTOM";
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  /** Wer dabei ist, kurz, z. B. „Anna, Ben +2“ oder „Gewerk Technik“. */
  who: string | null;
  /** Betrifft die ansehende Person. */
  mine: boolean;
  outcome: "DONE" | "PARTIAL" | "SKIPPED" | null;
};

/** Eine Zeile der Zeitleiste: ein Punkt oder mehrere, die sich zeitlich überschneiden. */
export type TimelineRow = { start: string | null; end: string | null; blocks: TimelineBlock[] };

/**
 * Ordnet Programmpunkte zeitlich und fasst überlappende zu einer Zeile zusammen
 * (parallel in verschiedenen Räumen). Punkte ohne Uhrzeit folgen in ihrer Reihenfolge.
 */
export function buildTimeline(blocks: readonly TimelineBlock[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const block of blocks) {
    const last = rows.at(-1);
    if (
      last &&
      block.startsAt &&
      block.endsAt &&
      last.start &&
      last.end &&
      block.startsAt < last.end
    ) {
      last.blocks.push(block);
      if (block.endsAt > last.end) last.end = block.endsAt;
      continue;
    }
    rows.push({ start: block.startsAt, end: block.endsAt, blocks: [block] });
  }
  return rows;
}

/** Kurze Namensliste: „Anna, Ben, Clara +2“. */
export function shortNameList(names: readonly string[], max = 3) {
  if (!names.length) return null;
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}
