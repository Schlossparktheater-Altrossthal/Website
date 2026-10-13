"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getStroke } from "perfect-freehand";
import { toast } from "sonner";

import { EraserIcon, PenLineIcon, Undo2Icon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { SCRIPT_INK_STYLES } from "@/config/category-colors";
import {
  INK_COLORS,
  type InkColor,
  type InkStroke,
  type ReaderAnnotation,
} from "@/lib/skript/annotation-types";
import { cn } from "@/lib/utils";

import { addInkStrokeAction, removeInkStrokesAction } from "../actions";

/** Freihandnotizen mit Stift (docs/Plan/skript-plan.md, Phase 9). */

export const INK_SIZES = { fein: 0.09, mittel: 0.16, dick: 0.28 } as const;
export type InkSize = keyof typeof INK_SIZES;

const COLOR_LABEL: Record<InkColor, string> = {
  schwarz: "Schwarz",
  rot: "Rot",
  blau: "Blau",
  gruen: "Grün",
};

/**
 * Bezugsrahmen der Striche eines Absatzes: x ab dem Textanfang der ersten Zeile (mobil steht
 * der Sprecher davor in derselben Zeile), Breite bis zum rechten Rand, y ab Oberkante in em.
 */
export function inkFrame(container: Element) {
  const box = container.getBoundingClientRect();
  const text = container.querySelector("[data-ink-text]");
  const first = text?.getClientRects()[0];
  const left = first ? first.left : box.left;
  return {
    left,
    top: box.top,
    width: Math.max(1, box.right - left),
    offset: left - box.left,
    em: Number.parseFloat(window.getComputedStyle(container).fontSize) || 16,
  };
}

/** Umriss eines Strichs als SVG-Pfad (perfect-freehand liefert ein Polygon). */
function outline(points: number[][], size: number, pen: boolean) {
  const shape = getStroke(points, {
    size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: !pen,
  });
  if (shape.length < 2) return "";
  const [first, ...rest] = shape;
  let path = `M${first[0].toFixed(1)},${first[1].toFixed(1)} Q`;
  rest.forEach(([x, y], index) => {
    const [nx, ny] = rest[index + 1] ?? first;
    path += `${x.toFixed(1)},${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)} `;
  });
  return `${path}Z`;
}

/** Neigung macht den Strich breiter – wie ein schräg gehaltener Bleistift. */
function tiltFactor(points: InkStroke["points"]) {
  const tilt = points.reduce((sum, point) => sum + point[3], 0) / points.length;
  return 1 + (tilt / 90) * 1.2;
}

function isPen(points: InkStroke["points"]) {
  return points.some((point) => point[2] !== 0.5);
}

/**
 * Gespeicherte Zeichnung eines Absatzes; liegt im Textbereich (`data-ink-anchor`) und misst
 * dessen Breite und Schriftgröße.
 */
export function InkLayer({
  annotation,
  pending,
  erasing,
  erased,
}: {
  annotation: ReaderAnnotation | null;
  pending: InkStroke[];
  erasing: boolean;
  /** Gerade wegradierte Striche `id:index`, bis zur Aktualisierung ausgeblendet. */
  erased: ReadonlySet<string>;
}) {
  const ref = React.useRef<SVGSVGElement>(null);
  const [box, setBox] = React.useState<{ width: number; offset: number; em: number } | null>(null);
  React.useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const frame = inkFrame(parent);
      setBox({ width: frame.width, offset: frame.offset, em: frame.em });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  const strokes = [
    ...(annotation?.strokes ?? [])
      .map((stroke, index) => ({ stroke, index }))
      .filter(({ index }) => !erased.has(`${annotation?.id}:${index}`)),
    ...pending.map((stroke) => ({ stroke, index: -1 })),
  ];
  return (
    <svg
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
        erasing && "[&_path]:pointer-events-auto",
      )}
    >
      {box
        ? strokes.map(({ stroke, index }, key) => (
            <path
              key={key}
              data-ink={annotation && index >= 0 ? annotation.id : undefined}
              data-stroke={index >= 0 ? index : undefined}
              className={SCRIPT_INK_STYLES[stroke.color]}
              d={outline(
                stroke.points.map(([x, y, pressure]) => [
                  x * box.width + box.offset,
                  y * box.em,
                  pressure,
                ]),
                stroke.size * box.em * tiltFactor(stroke.points),
                isPen(stroke.points),
              )}
            />
          ))
        : null}
    </svg>
  );
}

export type PenTool = "pen" | "eraser";

export type PenSettings = { tool: PenTool; color: InkColor; size: InkSize; finger: boolean };

type Live = {
  pointerId: number;
  blockId: string;
  rect: DOMRect;
  em: number;
  points: InkStroke["points"];
  client: number[][];
};

function blockAt(x: number, y: number) {
  const element = document.elementFromPoint(x, y);
  const block = element?.closest("[data-block]");
  if (block) return block;
  // Auf einer Szenenüberschrift: erster Absatz der Szene.
  const heading = element?.closest("h2");
  const next = heading?.nextElementSibling;
  return next?.matches("[data-block]") ? next : null;
}

/**
 * Stiftmodus: Stift (und auf Wunsch Finger) zeichnet, Finger scrollt sonst weiter. Jeder Strich
 * wird sofort gespeichert und bis zur Aktualisierung vorläufig angezeigt.
 */
export function usePen({
  enabled,
  settings,
  versionId,
  inkByBlock,
}: {
  enabled: boolean;
  settings: PenSettings;
  versionId: string;
  inkByBlock: Map<string, ReaderAnnotation>;
}) {
  const router = useRouter();
  const [live, setLive] = React.useState<Live | null>(null);
  const [pending, setPending] = React.useState<Map<string, InkStroke[]>>(new Map());
  const [erased, setErased] = React.useState<Set<string>>(new Set());
  const history = React.useRef<string[]>([]);
  const scroll = React.useRef<{ pointerId: number; y: number } | null>(null);

  // Nach dem Neuladen stehen die Striche in den Daten – vorläufige Anzeige leeren.
  React.useEffect(() => {
    setPending(new Map());
    setErased(new Set());
  }, [inkByBlock]);

  const save = React.useCallback(
    async (blockId: string, stroke: InkStroke) => {
      const result = await addInkStrokeAction(versionId, blockId, stroke);
      if (!result.ok) {
        toast.error("Strich nicht gespeichert", { description: result.error });
        setPending((current) => {
          const next = new Map(current);
          next.set(
            blockId,
            (next.get(blockId) ?? []).filter((entry) => entry !== stroke),
          );
          return next;
        });
        return;
      }
      history.current.push(blockId);
      router.refresh();
    },
    [router, versionId],
  );

  const eraseAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y);
    const path = element?.closest("path[data-ink]");
    const id = path?.getAttribute("data-ink");
    const index = path?.getAttribute("data-stroke");
    if (!id || index === null || index === undefined) return;
    setErased((current) =>
      current.has(`${id}:${index}`) ? current : new Set(current).add(`${id}:${index}`),
    );
  };

  const commitErase = async () => {
    const groups = new Map<string, number[]>();
    for (const key of erased) {
      const [id, index] = key.split(":");
      groups.set(id, [...(groups.get(id) ?? []), Number(index)]);
    }
    if (!groups.size) return;
    const results = await Promise.all(
      [...groups].map(([id, indices]) => removeInkStrokesAction(versionId, id, indices)),
    );
    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) toast.error("Radieren fehlgeschlagen", { description: failed.error });
    router.refresh();
  };

  const undo = async () => {
    const blockId = history.current.pop();
    const annotation = blockId ? inkByBlock.get(blockId) : undefined;
    if (!annotation?.strokes.length) return;
    const result = await removeInkStrokesAction(versionId, annotation.id, [
      annotation.strokes.length - 1,
    ]);
    if (!result.ok) toast.error("Rückgängig fehlgeschlagen", { description: result.error });
    router.refresh();
  };

  const point = (event: PointerEvent | React.PointerEvent, current: Live) => {
    const tilt = Math.min(90, Math.hypot(event.tiltX ?? 0, event.tiltY ?? 0));
    const pressure = event.pointerType === "pen" ? event.pressure || 0.5 : 0.5;
    return [
      (event.clientX - current.rect.left) / current.rect.width,
      (event.clientY - current.rect.top) / current.em,
      Math.round(pressure * 1000) / 1000,
      Math.round(tilt),
    ] as [number, number, number, number];
  };

  const handlers = enabled
    ? {
        onPointerDown: (event: React.PointerEvent) => {
          const draws = event.pointerType !== "touch" || settings.finger;
          if (!draws) {
            scroll.current = { pointerId: event.pointerId, y: event.clientY };
            return;
          }
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          if (settings.tool === "eraser") {
            setLive({
              pointerId: event.pointerId,
              blockId: "",
              rect: new DOMRect(),
              em: 16,
              points: [],
              client: [],
            });
            eraseAt(event.clientX, event.clientY);
            return;
          }
          const block = blockAt(event.clientX, event.clientY);
          const blockId = block?.getAttribute("data-block");
          if (!block || !blockId) return;
          // Verankert am Textbereich (bei Repliken ohne Sprecher-Spalte), damit Striche auf
          // Handy und Desktop über demselben Text liegen.
          const frame = inkFrame(block.querySelector("[data-ink-anchor]") ?? block);
          const start: Live = {
            pointerId: event.pointerId,
            blockId,
            rect: new DOMRect(frame.left, frame.top, frame.width, 0),
            em: frame.em,
            points: [],
            client: [],
          };
          start.points.push(point(event, start));
          start.client.push([event.clientX, event.clientY, start.points[0][2]]);
          setLive(start);
        },
        onPointerMove: (event: React.PointerEvent) => {
          if (scroll.current?.pointerId === event.pointerId) {
            window.scrollBy(0, scroll.current.y - event.clientY);
            scroll.current.y = event.clientY;
            return;
          }
          if (!live || live.pointerId !== event.pointerId) return;
          const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
          if (settings.tool === "eraser") {
            for (const entry of events) eraseAt(entry.clientX, entry.clientY);
            return;
          }
          const next = { ...live, points: [...live.points], client: [...live.client] };
          for (const entry of events) {
            const value = point(entry, live);
            next.points.push(value);
            next.client.push([entry.clientX, entry.clientY, value[2]]);
          }
          setLive(next);
        },
        onPointerUp: (event: React.PointerEvent) => {
          if (scroll.current?.pointerId === event.pointerId) {
            scroll.current = null;
            return;
          }
          if (!live || live.pointerId !== event.pointerId) return;
          setLive(null);
          if (settings.tool === "eraser") {
            void commitErase();
            return;
          }
          const stroke: InkStroke = {
            color: settings.color,
            size: INK_SIZES[settings.size],
            points: live.points.map(
              ([x, y, p, t]) =>
                [Math.round(x * 10000) / 10000, Math.round(y * 1000) / 1000, p, t] as [
                  number,
                  number,
                  number,
                  number,
                ],
            ),
          };
          setPending((current) =>
            new Map(current).set(live.blockId, [...(current.get(live.blockId) ?? []), stroke]),
          );
          void save(live.blockId, stroke);
        },
        onPointerCancel: () => {
          scroll.current = null;
          setLive(null);
        },
      }
    : {};

  const liveStroke =
    live && settings.tool === "pen" && live.client.length ? (
      <svg aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full">
        <path
          className={SCRIPT_INK_STYLES[settings.color]}
          d={outline(
            live.client,
            INK_SIZES[settings.size] * live.em * tiltFactor(live.points),
            isPen(live.points),
          )}
        />
      </svg>
    ) : null;

  return { handlers, pending, erased, liveStroke, undo };
}

/** Werkzeugleiste unten im Stiftmodus. */
export function PenBar({
  settings,
  onChange,
  onUndo,
  onDone,
}: {
  settings: PenSettings;
  onChange: (patch: Partial<PenSettings>) => void;
  onUndo: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
      <SegmentedControl<PenTool>
        aria-label="Werkzeug"
        value={settings.tool}
        onValueChange={(tool) => onChange({ tool })}
        options={[
          { value: "pen", label: <PenLineIcon />, ariaLabel: "Stift" },
          { value: "eraser", label: <EraserIcon />, ariaLabel: "Radierer" },
        ]}
      />
      <div className="flex items-center gap-1" role="group" aria-label="Stiftfarbe">
        {INK_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={COLOR_LABEL[color]}
            aria-pressed={settings.color === color}
            onClick={() => onChange({ color, tool: "pen" })}
            className={cn(
              "flex h-9 w-9 items-center justify-center",
              settings.color === color && settings.tool === "pen" && "bg-muted",
            )}
          >
            <svg viewBox="0 0 10 10" className="h-5 w-5" aria-hidden>
              <circle cx="5" cy="5" r="4" className={SCRIPT_INK_STYLES[color]} />
            </svg>
          </button>
        ))}
      </div>
      <SegmentedControl<InkSize>
        aria-label="Strichstärke"
        value={settings.size}
        onValueChange={(size) => onChange({ size, tool: "pen" })}
        options={[
          { value: "fein", label: "Fein" },
          { value: "mittel", label: "Mittel" },
          { value: "dick", label: "Dick" },
        ]}
      />
      <Button variant="ghost" size="icon" aria-label="Rückgängig" onClick={onUndo}>
        <Undo2Icon aria-hidden />
      </Button>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={settings.finger}
          onCheckedChange={(finger) => onChange({ finger })}
          aria-label="Mit dem Finger zeichnen"
        />
        Finger zeichnet
      </label>
      <Button className="ml-auto" onClick={onDone}>
        Fertig
      </Button>
    </div>
  );
}
