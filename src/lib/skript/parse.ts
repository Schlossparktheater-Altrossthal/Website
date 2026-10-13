import type { ScriptProfile } from "./profiles";
import type { ScriptBlock, ScriptPart, ScriptScene, TextLine, TextSpan } from "./types";

/** Ebene 2: Zeilen → Szenen, Absätze (Replik/Anweisung) und Teile. */

const NO_COLON = "\u0000";

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Sprecher am Zeilenanfang: fett + „:“ (Doppelpunkt fett oder direkt danach). Ein fetter Name
 * ohne Doppelpunkt mit direkt folgender Regie („Alle (sprechen …)“) wird vorläufig markiert und
 * in `parseLines` nur übernommen, wenn die Rolle sonst mit Doppelpunkt vorkommt.
 */
export function splitSpeaker(
  spans: TextSpan[],
  profile: ScriptProfile,
): { speaker: string | null; rest: TextSpan[] } {
  let lead = "";
  let i = 0;
  while (i < spans.length && (spans[i].bold || !spans[i].text.trim())) {
    lead += spans[i].text;
    i++;
    if (lead.includes(":")) break;
  }
  let rest = spans.slice(i);
  // führende Striche/Aufzählungszeichen („- ATRÉJU:“) gehören nicht zum Namen
  let name = lead.trim().replace(/^[-–•*]+\s*/, "");
  if (!name) return { speaker: null, rest: spans };
  if (name.includes(":")) {
    const [before, ...after] = name.split(":");
    const tail = after.join(":").trim();
    name = before.trim();
    if (tail) rest = [{ ...spans[0], text: tail + " " }, ...rest];
  } else if (rest[0]?.text.trimStart().startsWith(":")) {
    rest = [{ ...rest[0], text: rest[0].text.trimStart().slice(1) }, ...rest.slice(1)];
  } else if (rest[0]?.italic && /^[\p{L} ./-]{2,25}$/u.test(name)) {
    name = NO_COLON + name;
  } else {
    return { speaker: null, rest: spans };
  }
  if (!name.replace(NO_COLON, "").trim() || name.length > profile.speakerMaxLength) {
    return { speaker: null, rest: spans };
  }
  return { speaker: name, rest };
}

/** „Bastian: Tot. Koreander: Hättest …“ → zwei Zeilen. */
export function splitInlineSpeakers(lines: TextLine[]): TextLine[] {
  const out: TextLine[] = [];
  for (const line of lines) {
    let start = 0;
    for (let k = 1; k < line.spans.length; k++) {
      const span = line.spans[k];
      const next = line.spans[k + 1];
      const colon = span.text.trimEnd().endsWith(":") || next?.text.trimStart().startsWith(":");
      const before = line.spans
        .slice(start, k)
        .map((s) => s.text)
        .join("");
      if (
        span.bold &&
        span.text.trim() &&
        colon &&
        !line.spans[k - 1].bold &&
        /[.!?…)]\s*$/.test(before)
      ) {
        out.push({ ...line, x1: 0, spans: line.spans.slice(start, k) });
        start = k;
      }
    }
    out.push({ ...line, spans: line.spans.slice(start) });
  }
  return out;
}

function cueKeywordRe(profile: ScriptProfile): string {
  const words = Object.keys(profile.cueKeywords).sort((a, b) => b.length - a.length);
  // Nur Großschreibung (und „BelWechsel“ aus Word), damit „Licht!“ im Text nicht greift.
  return `\\b(${words.join("|")}|BelWechsel)\\b`;
}

/** Unmarkierte Hinweise im gesprochenen Text („… Bücher – TON 2b: Luftzug und Tür zu“). */
export function splitInlineCues(text: string, profile: ScriptProfile): ScriptPart[] {
  const kw = cueKeywordRe(profile);
  const head = new RegExp(`${kw}(?:\\s+(?:${kw}|\\d+[a-z]?\\b))*:?`, "g");
  const startsCue = new RegExp(`^${kw}`);
  const out: ScriptPart[] = [];
  let pos = 0;
  for (const match of text.matchAll(head)) {
    const start = match.index;
    if (start < pos) continue;
    const headEnd = start + match[0].length;
    let end = headEnd;
    let count = 0;
    for (const word of text.slice(headEnd).matchAll(/\S+/g)) {
      if (count >= profile.cueMaxTailWords) break;
      end = headEnd + word.index + word[0].length;
      count++;
      const w = word[0];
      if (
        /[.!?,]$/.test(w) ||
        profile.cueEndWords.has(w) ||
        /^\d+[a-z]?$/.test(w) ||
        startsCue.test(text.slice(end).trimStart())
      ) {
        break;
      }
    }
    if (text.slice(pos, start).trim()) out.push({ kind: "text", text: text.slice(pos, start) });
    const key = match[1].toUpperCase();
    out.push({
      kind: "cue",
      text: text.slice(start, end),
      category: profile.cueKeywords[key] ?? "technik",
      auto: true,
    });
    pos = end;
  }
  if (text.slice(pos).trim() || !out.length) out.push({ kind: "text", text: text.slice(pos) });
  return out;
}

function sameKind(a: ScriptPart, b: ScriptPart): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "cue" && b.kind === "cue") return a.category === b.category && !a.auto && !b.auto;
  return true;
}

export function spansToParts(spans: TextSpan[], profile: ScriptProfile): ScriptPart[] {
  const raw: ScriptPart[] = [];
  for (const span of spans) {
    let part: ScriptPart;
    const hl = span.highlight ? profile.highlights[span.highlight] : undefined;
    const colored = span.color ? profile.textColors[span.color] : undefined;
    if (hl) part = { kind: "cue", text: span.text, category: hl };
    else if (colored === "umbau") part = { kind: "cue", text: span.text, category: "umbau" };
    else if (span.italic) part = { kind: "direction", text: span.text };
    else part = { kind: "text", text: span.text };
    const last = raw.at(-1);
    if (last && (sameKind(last, part) || !span.text.trim())) last.text += span.text;
    else raw.push(part);
  }
  const out: ScriptPart[] = [];
  for (const part of raw) {
    if (part.kind === "text") out.push(...splitInlineCues(part.text, profile));
    else out.push(part);
  }
  return out
    .map((part) => ({ ...part, text: normalizeWhitespace(part.text) }))
    .filter((part) => part.text);
}

function appendParts(block: ScriptBlock, parts: ScriptPart[]) {
  const [first, ...rest] = parts;
  const last = block.parts.at(-1);
  if (first && last && sameKind(last, first)) {
    last.text = normalizeWhitespace(`${last.text} ${first.text}`);
    block.parts.push(...rest);
  } else {
    block.parts.push(...parts);
  }
}

/**
 * Szenenüberschrift: fetter Zeilenanfang, der auf `sceneRe` passt. Steht danach noch Text
 * („PAUSE – Umbaugeister richten …“), wird er der erste Absatz der neuen Szene.
 */
function sceneHeading(
  line: TextLine,
  profile: ScriptProfile,
): { title: string; rest: TextSpan[] } | null {
  let i = 0;
  while (i < line.spans.length && (line.spans[i].bold || !line.spans[i].text.trim())) i++;
  const title = normalizeWhitespace(
    line.spans
      .slice(0, i)
      .map((s) => s.text)
      .join(""),
  );
  if (!title || !profile.sceneRe.test(title)) return null;
  return { title: title.replace(/[\s:–-]+$/, ""), rest: line.spans.slice(i) };
}

export function parseLines(input: TextLine[], profile: ScriptProfile): ScriptScene[] {
  const lines = splitInlineSpeakers(input);
  const scenes: ScriptScene[] = [{ title: "(Vorspann)", blocks: [] }];
  if (!lines.length) return [];
  // Typische rechte Kante: Zeilen, die deutlich davor enden, schließen einen Absatz ab.
  const rights = lines.map((l) => l.x1).sort((a, b) => a - b);
  const wrapX = rights[Math.floor(rights.length * 0.9)];
  let current: ScriptBlock | null = null;
  let prev: TextLine | null = null;

  for (const line of lines) {
    const heading = sceneHeading(line, profile);
    if (heading) {
      const rest = spansToParts(heading.rest, profile);
      current = rest.length
        ? { kind: "direction", speaker: null, parts: rest, page: line.page }
        : null;
      scenes.push({ title: heading.title, blocks: current ? [current] : [] });
      prev = line;
      continue;
    }
    const { speaker, rest } = splitSpeaker(line.spans, profile);
    const gap = prev !== null && line.page === prev.page && line.y - prev.y > 30;
    const prevEnded = prev === null || prev.x1 < wrapX - 60 || gap;
    const first = rest.find((s) => s.text.trim());
    const scene = scenes[scenes.length - 1];
    if (speaker) {
      current = { kind: "speech", speaker, parts: [], page: line.page };
      scene.blocks.push(current);
    } else if (
      current === null ||
      (prevEnded && (first?.italic || first?.highlight || first?.color))
    ) {
      current = { kind: "direction", speaker: null, parts: [], page: line.page };
      scene.blocks.push(current);
    }
    appendParts(current, spansToParts(rest, profile));
    prev = line;
  }

  const known = new Set(
    scenes.flatMap((s) =>
      s.blocks
        .filter((b) => b.speaker && !b.speaker.startsWith(NO_COLON))
        .map((b) => b.speaker!.toLocaleLowerCase("de")),
    ),
  );
  for (const scene of scenes) {
    for (const block of scene.blocks) {
      if (!block.speaker?.startsWith(NO_COLON)) continue;
      const name = block.speaker.slice(1);
      if (known.has(name.toLocaleLowerCase("de"))) {
        block.speaker = name;
      } else {
        // doch kein Sprecher (z. B. fettes Wort im Chortext)
        block.kind = "direction";
        block.speaker = null;
        block.parts.unshift({ kind: "text", text: name });
      }
    }
  }
  return scenes.filter((s) => s.blocks.length || s.title !== "(Vorspann)");
}

/** Autoerkennung: Anteil der Zeilen, die als Sprecher oder Szene erkannt werden. */
export function scoreProfile(lines: TextLine[], profile: ScriptProfile): number {
  const sample = lines.slice(0, 400);
  if (!sample.length) return 0;
  const hits = sample.filter(
    (l) => splitSpeaker(l.spans, profile).speaker || sceneHeading(l, profile),
  ).length;
  return hits / sample.length;
}
