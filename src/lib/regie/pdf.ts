import type { BlockedDayKind } from "@prisma/client";

import { buildScheduleMonths } from "@/lib/calendar/schedule-pdf";
import { renderPdfTemplate } from "@/lib/pdf/engine";
import type { PdfRenderResult } from "@/lib/pdf/types";
import type { DirectionShow } from "@/lib/regie/access";
import {
  dayKeyOf,
  eventTimeLabel,
  formatDay,
  loadDirectionCasting,
  loadDirectionEvents,
  loadDirectionProps,
  loadDirectionScenes,
  loadDirectionScript,
  type DirectionCastRole,
  type DirectionEvent,
} from "@/lib/regie/data";
import { loadDirectionAvailabilityView, sceneRows } from "@/lib/regie/availability";
import {
  describeAvailabilityRange,
  parseAvailabilityRange,
  type AvailabilityRange,
} from "@/lib/regie/availability-range";
import { formatWeekdayList } from "@/lib/weekdays";

export { sceneRows };
import { scriptPdfOptionsSchema } from "@/lib/skript/pdf";
import { loadScriptReader } from "@/lib/skript/reader";

/** PDFs des Regie-Dashboards; Reihenfolge = Reihenfolge in der Probenmappe. */
export const DIRECTION_PDF_KINDS = [
  "termine",
  "szenen",
  "verfuegbarkeit",
  "besetzung",
  "ausstattung",
  "skript",
] as const;
export type DirectionPdfKind = (typeof DIRECTION_PDF_KINDS)[number];

export const DIRECTION_PDF_LABELS: Record<DirectionPdfKind, string> = {
  termine: "Terminliste",
  szenen: "Szenen × Personen",
  verfuegbarkeit: "Verfügbarkeit",
  besetzung: "Besetzung",
  ausstattung: "Requisiten je Szene",
  skript: "Skript (aktuelle Fassung)",
};

export function isDirectionPdfKind(value: string): value is DirectionPdfKind {
  return (DIRECTION_PDF_KINDS as readonly string[]).includes(value);
}

const KIND_STATUS: Record<BlockedDayKind, "blocked" | "limited" | "preferred" | "emergency"> = {
  BLOCKED: "blocked",
  LIMITED: "limited",
  PREFERRED: "preferred",
  EMERGENCY: "emergency",
};

const showLabel = (show: DirectionShow) => `${show.title ?? "Produktion"} ${show.year}`;
const castLabel = (role: DirectionCastRole) =>
  role.castings.map((casting) => casting.name).join(" / ") || null;

function scheduleItem(event: DirectionEvent) {
  return {
    type: "event" as const,
    date: formatDay(event.start),
    time: eventTimeLabel(event),
    title: event.title,
    location: event.location,
    scenes: event.scenes.join(", ") || null,
    who: event.invited ? `${event.invited} eingeladen` : null,
    rehearsal: event.rehearsal,
    status: event.status === "SCHEDULED" ? ("CONFIRMED" as const) : event.status,
    blocked: event.absent.length ? `fehlen: ${event.absent.join(", ")}` : null,
    attendance: event.invited ? `${event.invited - event.absent.length}/${event.invited}` : null,
  };
}

async function buildPayload(
  kind: DirectionPdfKind,
  show: DirectionShow,
  userId: string,
  range: AvailabilityRange,
) {
  const generatedAt = new Date().toISOString();
  const production = showLabel(show);

  switch (kind) {
    case "termine": {
      const events = await loadDirectionEvents(show.id);
      return {
        templateId: "terminliste",
        payload: {
          mode: "availability",
          generatedAt,
          production,
          months: buildScheduleMonths(
            events.map((event) => ({
              dayKey: dayKeyOf(event.start),
              lastDayKey: dayKeyOf(event.end ?? event.start),
              event: scheduleItem(event),
            })),
            [],
          ),
        },
      };
    }
    case "szenen": {
      const [scenes, roles] = await Promise.all([
        loadDirectionScenes(show.id),
        loadDirectionCasting(show.id),
      ]);
      return {
        templateId: "szenen-matrix",
        payload: {
          generatedAt,
          production,
          scenes: scenes.map((scene) => ({
            id: scene.id,
            short: scene.label.split(" ")[0].slice(0, 5),
          })),
          roles: roles.map((role) => ({
            name: role.name,
            cast: castLabel(role),
            sceneIds: scenes.filter((s) => s.characterIds.includes(role.id)).map((s) => s.id),
          })),
        },
      };
    }
    case "verfuegbarkeit": {
      const view = await loadDirectionAvailabilityView(show.id, range);
      if (!view.days.length) return null;
      const noon = (key: string) => new Date(`${key}T12:00:00Z`);
      const first = noon(view.days[0].key);
      const last = noon(view.days.at(-1)!.key);
      return {
        templateId: "sperrliste-wichtige-tage",
        payload: {
          generatedAt,
          production,
          range: {
            start: first.toISOString(),
            end: last.toISOString(),
            label: `${formatDay(first)} – ${formatDay(last)} · ${describeAvailabilityRange(range)}`,
          },
          summary: {
            memberCount: view.members.length,
            importantWeekdays:
              range.mode === "kerntage" ? formatWeekdayList(view.preferredWeekdays) || null : null,
          },
          days: view.days.map((day) => {
            const [weekday, date] = formatDay(noon(day.key)).split(", ");
            return {
              key: day.key,
              weekday,
              date,
              badges: day.finalWeek
                ? [{ kind: "finalWeek" as const, label: "Endprobenwoche" }]
                : [],
              events: day.events.map((event) => ({
                rehearsal: event.rehearsal,
                time: eventTimeLabel(event),
                title: event.title,
              })),
            };
          }),
          members: view.members.map((member) => ({
            zone: member.roles.length ? "acting" : "crew",
            name: member.name,
            detail: member.roles.join(", ") || null,
            entries: view.days.map(({ key }) => {
              const entry = member.entries[key];
              return {
                dayKey: key,
                status: entry ? KIND_STATUS[entry.kind] : "none",
                value: entry?.reason ?? null,
              };
            }),
          })),
          scenes: view.rows.length ? { castComplete: view.castComplete, rows: view.rows } : null,
        },
      };
    }
    case "besetzung": {
      const roles = await loadDirectionCasting(show.id);
      return {
        templateId: "production-casting",
        payload: {
          showTitle: production,
          generatedAt,
          roles: roles.map((role) => ({
            name: role.name,
            shortName: null,
            description: null,
            notes: null,
            color: role.color,
            castings: role.castings.map((casting) => ({
              name: casting.name,
              type: casting.type,
              typeLabel: CASTING_LABELS[casting.type],
              notes: null,
            })),
          })),
        },
      };
    }
    case "ausstattung": {
      const { scenes } = await loadDirectionProps(show.id);
      return {
        templateId: "requisiten-ablauf",
        payload: {
          generatedAt,
          production,
          scenes: scenes.map((scene) => ({
            title: scene.label,
            objects: scene.objects.map((object) => ({
              title: object.title,
              note: object.note,
              roles: object.roles.join(", ") || null,
              status: object.status,
            })),
          })),
        },
      };
    }
    case "skript": {
      const version = await loadDirectionScript(show.id);
      const data = version ? await loadScriptReader(version.id, userId) : null;
      if (!data) return null;
      return {
        templateId: "skript-fassung",
        payload: { title: data.version.showTitle, data, options: scriptPdfOptionsSchema.parse({}) },
      };
    }
  }
}

export const CASTING_LABELS = {
  primary: "Hauptbesetzung",
  alternate: "Zweitbesetzung",
  cover: "Einspringer",
  cameo: "Gastauftritt",
} as const;

/** Rendert ein Regie-PDF; `null`, wenn es dafür (noch) keine Daten gibt (z. B. kein Skript). */
export async function renderDirectionPdf(
  kind: DirectionPdfKind,
  show: DirectionShow,
  userId: string,
  range: AvailabilityRange = parseAvailabilityRange(null, null),
): Promise<PdfRenderResult<unknown> | null> {
  const built = await buildPayload(kind, show, userId, range);
  if (!built) return null;
  return renderPdfTemplate(built.templateId, built.payload);
}

/** Wählbare Teile der Probenmappe – das Skript gehört nicht hinein. */
export const BINDER_PARTS = DIRECTION_PDF_KINDS.filter((kind) => kind !== "skript");

/** Vorauswahl der Probenmappe (Plan: Wochenplan, Szenen, Verfügbarkeit, Besetzung, Requisiten). */
export const BINDER_DEFAULT_PARTS: DirectionPdfKind[] = [
  "termine",
  "szenen",
  "verfuegbarkeit",
  "besetzung",
  "ausstattung",
];

/** `?teile=a,b` → gültige Teile in fester Mappen-Reihenfolge; leer → Vorauswahl. */
export function parseBinderParts(value: string | null | undefined): DirectionPdfKind[] {
  const wanted = new Set((value ?? "").split(",").map((part) => part.trim()));
  const parts = BINDER_PARTS.filter((kind) => wanted.has(kind));
  return parts.length ? parts : BINDER_DEFAULT_PARTS;
}

/** Probenmappe: gewählte Teile + Deckblatt mit Stand und Inhalt als ein PDF. */
export async function renderDirectionBinder(
  parts: DirectionPdfKind[],
  show: DirectionShow,
  userId: string,
  range: AvailabilityRange = parseAvailabilityRange(null, null),
): Promise<{ buffer: Buffer; filename: string } | null> {
  const { PDFDocument } = await import("pdf-lib");
  const rendered = await Promise.all(
    parts.map(async (kind) => ({
      kind,
      result: await renderDirectionPdf(kind, show, userId, range),
    })),
  );
  const docs = await Promise.all(
    rendered
      .filter((entry) => entry.result)
      .map(async ({ kind, result }) => ({ kind, doc: await PDFDocument.load(result!.buffer) })),
  );
  if (!docs.length) return null;

  const generatedAt = new Date().toISOString();
  const contents: { label: string; page: number }[] = [];
  let page = 2;
  for (const { kind, doc } of docs) {
    contents.push({ label: DIRECTION_PDF_LABELS[kind], page });
    page += doc.getPageCount();
  }
  const cover = await renderPdfTemplate("probenmappe-deckblatt", {
    generatedAt,
    production: showLabel(show),
    parts: contents,
    missing: rendered.filter((entry) => !entry.result).map((e) => DIRECTION_PDF_LABELS[e.kind]),
  });

  const binder = await PDFDocument.create();
  binder.setTitle(`Probenmappe ${showLabel(show)}`);
  for (const source of [await PDFDocument.load(cover.buffer), ...docs.map((d) => d.doc)]) {
    const pages = await binder.copyPages(source, source.getPageIndices());
    for (const copied of pages) binder.addPage(copied);
  }
  return { buffer: Buffer.from(await binder.save()), filename: cover.filename };
}
