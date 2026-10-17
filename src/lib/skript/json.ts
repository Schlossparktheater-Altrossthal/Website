import { z } from "zod";

import { scriptCreditSchema } from "./credits";
import type { ScriptImportReport } from "./service";
import type { ScriptPart } from "./types";

/** Gespeicherte JSON-Felder sicher lesen (statt Casts). */

const category = z.enum(["ton", "licht", "nebel", "effekt", "umbau", "aus", "technik"]);

const partSchema = z.union([
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("direction"), text: z.string() }),
  z.object({
    kind: z.literal("cue"),
    text: z.string(),
    category,
    auto: z.boolean().optional(),
  }),
]);

export function readParts(value: unknown): ScriptPart[] {
  const parsed = z.array(partSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

const reportSchema = z.object({
  mergedRoles: z.array(z.tuple([z.string(), z.string()])).default([]),
  roleTypos: z
    .array(
      z.object({
        name: z.string(),
        count: z.number(),
        similarTo: z.string(),
        levenshtein: z.number(),
        jaroWinkler: z.number(),
      }),
    )
    .default([]),
  uncertainCues: z.number().default(0),
  speakers: z
    .array(z.object({ name: z.string(), lines: z.number(), words: z.number(), known: z.boolean() }))
    .default([]),
  scenes: z.number().default(0),
  blocks: z.number().default(0),
  credits: z.array(scriptCreditSchema).catch([]).default([]),
});

export function readImportReport(value: unknown): ScriptImportReport {
  const parsed = reportSchema.safeParse(value);
  return parsed.success ? parsed.data : reportSchema.parse({});
}
