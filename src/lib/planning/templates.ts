import { z } from "zod";

import { toDay } from "@/lib/planning/schedule";

/**
 * Jahresvorlagen des Produktionsplans (docs/Plan/projektplanung-plan.md, Phase 6).
 *
 * Eine Vorlage speichert Meilensteine relativ zu Premiere, Endprobenwoche oder anderen
 * Einträgen der Vorlage. Feste Daten werden beim Speichern zur Premiere umgerechnet, damit sie
 * im nächsten Jahr mitwandern. Gewerke werden über ihr Kürzel (`slug`) zugeordnet.
 */

export const templateItemSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  kind: z.enum(["milestone", "deadline", "handover", "review"]),
  departmentSlug: z.string().nullable().optional(),
  anchorType: z.enum(["premiere", "finalRehearsalStart", "milestone", "fixed"]),
  anchorKey: z.string().nullable().optional(),
  offsetDays: z.number().int(),
  /** Nur bei `fixed` ohne Premiere: Datum `YYYY-MM-DD` samt Jahrgang zum Verschieben. */
  fixedDate: z.string().nullable().optional(),
  sourceYear: z.number().int().nullable().optional(),
  predecessors: z
    .array(z.object({ key: z.string(), lagDays: z.number().int().min(0) }))
    .default([]),
});

export const templateItemsSchema = z.array(templateItemSchema).max(100);

export type TemplateItem = z.infer<typeof templateItemSchema>;

type SourceMilestone = {
  id: string;
  title: string;
  description: string | null;
  kind: TemplateItem["kind"];
  departmentSlug: string | null;
  anchorType: TemplateItem["anchorType"];
  anchorMilestoneId: string | null;
  offsetDays: number;
  fixedDate: Date | null;
  predecessors: { fromId: string; lagDays: number }[];
};

/** Plan → Vorlage. Feste Daten werden mit Premiere relativ dazu gespeichert. */
export function buildTemplateItems(
  milestones: SourceMilestone[],
  show: { premiereAt: Date | null; year: number },
): TemplateItem[] {
  const keys = new Map(milestones.map((milestone, index) => [milestone.id, `m${index + 1}`]));
  return milestones.map((milestone) => {
    const base = {
      key: keys.get(milestone.id) as string,
      title: milestone.title,
      description: milestone.description,
      kind: milestone.kind,
      departmentSlug: milestone.departmentSlug,
      predecessors: milestone.predecessors.flatMap((dep) =>
        keys.has(dep.fromId) ? [{ key: keys.get(dep.fromId) as string, lagDays: dep.lagDays }] : [],
      ),
    };
    if (milestone.anchorType === "fixed" && milestone.fixedDate) {
      if (show.premiereAt) {
        return {
          ...base,
          anchorType: "premiere" as const,
          anchorKey: null,
          offsetDays: toDay(milestone.fixedDate) - toDay(show.premiereAt),
        };
      }
      return {
        ...base,
        anchorType: "fixed" as const,
        anchorKey: null,
        offsetDays: 0,
        fixedDate: milestone.fixedDate.toISOString().slice(0, 10),
        sourceYear: show.year,
      };
    }
    return {
      ...base,
      anchorType: milestone.anchorType,
      anchorKey:
        milestone.anchorType === "milestone"
          ? (keys.get(milestone.anchorMilestoneId ?? "") ?? null)
          : null,
      offsetDays: milestone.offsetDays,
    };
  });
}

export type InstantiatedMilestone = {
  key: string;
  title: string;
  description: string | null;
  kind: TemplateItem["kind"];
  departmentId: string | null;
  anchorType: TemplateItem["anchorType"];
  anchorKey: string | null;
  offsetDays: number;
  fixedDate: Date | null;
  predecessors: { key: string; lagDays: number }[];
};

/**
 * Vorlage → Meilensteine für eine Produktion. Fehlt ein Gewerk, bleibt der Eintrag der ganzen
 * Produktion zugeordnet; feste Daten wandern um die Jahresdifferenz.
 */
export function instantiateTemplate(
  items: TemplateItem[],
  target: { year: number; departmentIdsBySlug: Map<string, string> },
): InstantiatedMilestone[] {
  const keys = new Set(items.map((item) => item.key));
  return items.map((item) => {
    let fixedDate: Date | null = null;
    if (item.anchorType === "fixed" && item.fixedDate) {
      fixedDate = new Date(`${item.fixedDate}T00:00:00.000Z`);
      const shift = item.sourceYear ? target.year - item.sourceYear : 0;
      if (shift) fixedDate.setUTCFullYear(fixedDate.getUTCFullYear() + shift);
    }
    const anchorKey =
      item.anchorType === "milestone" && item.anchorKey && keys.has(item.anchorKey)
        ? item.anchorKey
        : null;
    return {
      key: item.key,
      title: item.title,
      description: item.description ?? null,
      kind: item.kind,
      departmentId: item.departmentSlug
        ? (target.departmentIdsBySlug.get(item.departmentSlug) ?? null)
        : null,
      // Ein verwaister Anker fällt auf die Premiere zurück, statt den Eintrag zu verlieren.
      anchorType: item.anchorType === "milestone" && !anchorKey ? "premiere" : item.anchorType,
      anchorKey,
      offsetDays: item.offsetDays,
      fixedDate,
      predecessors: item.predecessors.filter((dep) => keys.has(dep.key) && dep.key !== item.key),
    };
  });
}

/**
 * Erster Vorschlag aus docs/Plan/projektplanung-plan.md („Offene Fragen“) – Daten sind
 * Schätzwerte und werden nach dem Übernehmen mit der Leitung angepasst.
 */
export const SUGGESTED_TEMPLATE: { id: string; name: string; items: TemplateItem[] } = {
  id: "vorschlag",
  name: "Vorschlag: 10 Meilensteine",
  items: [
    {
      key: "gema",
      title: "GEMA/Rechte geklärt",
      kind: "deadline",
      departmentSlug: null,
      anchorType: "premiere",
      offsetDays: -180,
      predecessors: [],
    },
    {
      key: "genehmigung",
      title: "Genehmigungen beantragt",
      kind: "deadline",
      departmentSlug: null,
      anchorType: "premiere",
      offsetDays: -120,
      predecessors: [],
    },
    {
      key: "plakat",
      title: "Plakat/Druck",
      kind: "handover",
      departmentSlug: "werbung-social",
      anchorType: "premiere",
      offsetDays: -60,
      predecessors: [{ key: "gema", lagDays: 14 }],
    },
    {
      key: "tickets",
      title: "Ticketstart",
      kind: "milestone",
      departmentSlug: "werbung-social",
      anchorType: "premiere",
      offsetDays: -45,
      predecessors: [{ key: "plakat", lagDays: 7 }],
    },
    {
      key: "anprobe",
      title: "Kostüm-Anprobe",
      kind: "review",
      departmentSlug: "kostuem",
      anchorType: "finalRehearsalStart",
      offsetDays: -28,
      predecessors: [],
    },
    {
      key: "technik",
      title: "Technik vor Bodenschluss",
      kind: "deadline",
      departmentSlug: "technik",
      anchorType: "finalRehearsalStart",
      offsetDays: -24,
      predecessors: [],
    },
    {
      key: "bau",
      title: "Bauabgabe Bühne",
      kind: "handover",
      departmentSlug: "buehnenbild",
      anchorType: "finalRehearsalStart",
      offsetDays: -21,
      predecessors: [{ key: "technik", lagDays: 3 }],
    },
    {
      key: "requisiten",
      title: "Requisiten komplett",
      kind: "handover",
      departmentSlug: "requisite",
      anchorType: "finalRehearsalStart",
      offsetDays: -14,
      predecessors: [],
    },
    {
      key: "bauprobe",
      title: "Bauprobe",
      kind: "review",
      departmentSlug: "buehnenbild",
      anchorType: "finalRehearsalStart",
      offsetDays: -7,
      predecessors: [
        { key: "bau", lagDays: 7 },
        { key: "requisiten", lagDays: 0 },
      ],
    },
    {
      key: "endprobe",
      title: "Beginn Endprobenwoche",
      kind: "milestone",
      departmentSlug: null,
      anchorType: "finalRehearsalStart",
      offsetDays: 0,
      predecessors: [
        { key: "bauprobe", lagDays: 3 },
        { key: "anprobe", lagDays: 7 },
      ],
    },
  ],
};
