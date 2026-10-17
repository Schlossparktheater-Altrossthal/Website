import type { BlockedDayKind } from "@prisma/client";

import { buildScheduleMonths } from "@/lib/calendar/schedule-pdf";
import { renderPdfTemplate } from "@/lib/pdf/engine";
import type { PdfRenderResult } from "@/lib/pdf/types";
import type { DirectionShow } from "@/lib/regie/access";
import {
  dayKeyOf,
  eventTimeLabel,
  formatDay,
  loadDirectionAvailability,
  loadDirectionCasting,
  loadDirectionEvents,
  loadDirectionProps,
  loadDirectionScenes,
  loadDirectionScript,
  type DirectionCastRole,
  type DirectionEvent,
  type DirectionScene,
} from "@/lib/regie/data";
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
  verfuegbarkeit: "Verfügbarkeit (2 Wochen)",
  besetzung: "Besetzung",
  ausstattung: "Requisiten je Szene",
  skript: "Skript (aktuelle Fassung)",
};

export function isDirectionPdfKind(value: string): value is DirectionPdfKind {
  return (DIRECTION_PDF_KINDS as readonly string[]).includes(value);
}

const AVAILABILITY_DAYS = 14;
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

/** Szenen-Zeilen der Verfügbarkeit: probbar, wenn keine besetzte Rolle fehlt. */
export function sceneRows(
  scenes: DirectionScene[],
  roles: DirectionCastRole[],
  days: string[],
  entries: Map<string, BlockedDayKind>,
) {
  const roleById = new Map(roles.map((role) => [role.id, role]));
  return scenes.map((scene) => {
    const sceneRoles = scene.characterIds
      .map((id) => roleById.get(id))
      .filter((role): role is DirectionCastRole => Boolean(role));
    return {
      label: scene.label,
      cast: sceneRoles.map((role) => `${role.name}: ${castLabel(role) ?? "–"}`).join(" · ") || null,
      cells: days.map((day) => {
        const missing: string[] = [];
        const limited: string[] = [];
        let alternate = false;
        for (const role of sceneRoles) {
          const states = role.castings.map((c) => entries.get(`${c.userId}:${day}`));
          const free = states.filter((state) => !state || state === "PREFERRED").length;
          if (!role.castings.length || free === 0) {
            if (states.some((state) => state === "LIMITED")) limited.push(role.name);
            else missing.push(role.name);
          } else if (states[0] && states[0] !== "PREFERRED") alternate = true;
        }
        if (missing.length) return { status: "missing" as const, note: missing.join(", ") };
        if (limited.length) return { status: "limited" as const, note: limited.join(", ") };
        return { status: alternate ? ("alternate" as const) : ("ready" as const), note: null };
      }),
    };
  });
}

async function buildPayload(kind: DirectionPdfKind, show: DirectionShow, userId: string) {
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
      const from = new Date();
      const [{ days, members }, scenes, roles, events] = await Promise.all([
        loadDirectionAvailability(show.id, { from, days: AVAILABILITY_DAYS }),
        loadDirectionScenes(show.id),
        loadDirectionCasting(show.id),
        loadDirectionEvents(show.id, { from }),
      ]);
      const entries = new Map<string, BlockedDayKind>();
      for (const member of members) {
        for (const [day, state] of Object.entries(member.entries)) {
          entries.set(`${member.id}:${day}`, state);
        }
      }
      const noon = (key: string) => new Date(`${key}T12:00:00Z`);
      return {
        templateId: "sperrliste-wichtige-tage",
        payload: {
          generatedAt,
          production,
          range: {
            start: noon(days[0]).toISOString(),
            end: noon(days.at(-1)!).toISOString(),
            label: `${formatDay(noon(days[0]))} – ${formatDay(noon(days.at(-1)!))}`,
          },
          summary: { memberCount: members.length, importantWeekdays: null },
          days: days.map((key) => {
            const [weekday, date] = formatDay(noon(key)).split(", ");
            return {
              key,
              weekday,
              date,
              events: events
                .filter((event) => dayKeyOf(event.start) === key)
                .map((event) => ({
                  rehearsal: event.rehearsal,
                  time: eventTimeLabel(event),
                  title: event.title,
                })),
            };
          }),
          members: members.map((member) => ({
            zone: member.roles.length ? "acting" : "crew",
            name: member.name,
            detail: member.roles.join(", ") || null,
            // Gründe sieht nur die Planung – hier nie.
            entries: days.map((key) => ({
              dayKey: key,
              status: member.entries[key] ? KIND_STATUS[member.entries[key]] : "none",
              value: null,
            })),
          })),
          scenes: scenes.length
            ? {
                castComplete: roles.every((role) => role.castings.length > 0),
                rows: sceneRows(scenes, roles, days, entries),
              }
            : null,
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
): Promise<PdfRenderResult<unknown> | null> {
  const built = await buildPayload(kind, show, userId);
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
): Promise<{ buffer: Buffer; filename: string } | null> {
  const { PDFDocument } = await import("pdf-lib");
  const rendered = await Promise.all(
    parts.map(async (kind) => ({ kind, result: await renderDirectionPdf(kind, show, userId) })),
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
