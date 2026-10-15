"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { getStroke } from "perfect-freehand";

import {
  CloseIcon,
  EraserIcon,
  PenLineIcon,
  TrashIcon,
  Undo2Icon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { SCRIPT_INK_STYLES } from "@/config/category-colors";
import {
  INK_COLORS,
  SKETCH_HEIGHT,
  type InkColor,
  type InkStroke,
  type ReaderAnnotation,
} from "@/lib/skript/annotation-types";
import { cn } from "@/lib/utils";

/**
 * Notizzettel (docs/Plan/skript-notizen-plan.md, Schritt 6): feste Zeichenfläche 4:3 an einer
 * Stelle im Text. Koordinaten sind Anteile der Zettelbreite – der Zettel wird auf jedem Gerät
 * nur als Ganzes größer oder kleiner, nichts verrutscht.
 */

/** Zeichenmaßstab des SVG: Breite 1000, Höhe 750. */
const SCALE = 1000;

const SIZES = { fein: 0.004, mittel: 0.007, dick: 0.013 } as const;
type SizeKey = keyof typeof SIZES;

const COLOR_LABEL: Record<InkColor, string> = {
  schwarz: "Schwarz",
  rot: "Rot",
  blau: "Blau",
  gruen: "Grün",
};

/** Liegt `p` näher als `radius` an der Strecke a–b? */
function nearSegment(p: number[], a: number[], b: number[], radius: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
    : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)) < radius;
}

/** Umriss eines Strichs als SVG-Pfad (perfect-freehand liefert ein Polygon). */
function outline(stroke: InkStroke) {
  const pen = stroke.points.some((point) => point[2] !== 0.5);
  const tilt = stroke.points.reduce((sum, point) => sum + point[3], 0) / stroke.points.length;
  const shape = getStroke(
    stroke.points.map(([x, y, pressure]) => [x * SCALE, y * SCALE, pressure]),
    {
      // Neigung macht den Strich breiter – wie ein schräg gehaltener Bleistift.
      size: stroke.size * SCALE * (1 + (tilt / 90) * 1.2),
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.45,
      simulatePressure: !pen,
    },
  );
  if (shape.length < 2) return "";
  const [first, ...rest] = shape;
  let path = `M${first[0].toFixed(1)},${first[1].toFixed(1)} Q`;
  rest.forEach(([x, y], index) => {
    const [nx, ny] = rest[index + 1] ?? first;
    path += `${x.toFixed(1)},${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)} `;
  });
  return `${path}Z`;
}

function Strokes({ strokes }: { strokes: InkStroke[] }) {
  return (
    <>
      {strokes.map((stroke, index) => (
        <path
          key={index}
          data-ink
          className={SCRIPT_INK_STYLES[stroke.color]}
          d={outline(stroke)}
        />
      ))}
    </>
  );
}

/** Kleine Vorschau eines Zettels (unter dem Absatz bzw. im Rand). */
export function SketchCard({ annotation }: { annotation: ReaderAnnotation }) {
  return (
    <button
      type="button"
      data-annotation={annotation.id}
      data-sketch={annotation.id}
      aria-label={annotation.body ? `Zettel: ${annotation.body}` : "Zettel öffnen"}
      className="block w-full max-w-[14rem] border border-border bg-card text-left not-italic hover:bg-muted"
    >
      <svg viewBox={`0 0 ${SCALE} ${SCALE * SKETCH_HEIGHT}`} className="block w-full" aria-hidden>
        <Strokes strokes={annotation.strokes} />
      </svg>
      {annotation.body ? (
        <span className="block truncate border-t border-border px-2 py-0.5 text-[0.75em]">
          {annotation.body}
        </span>
      ) : null}
    </button>
  );
}

/** Symbol im Text, wo ein Zettel hängt. */
export function SketchMark({ annotation }: { annotation: ReaderAnnotation }) {
  return (
    <span
      data-annotation={annotation.id}
      data-sign-point
      aria-label={annotation.body ? `Zettel: ${annotation.body}` : "Zettel"}
      className="mx-[0.12em] inline-block cursor-pointer rounded-sm border border-primary/60 bg-primary/10 px-[0.2em] align-[0.1em] text-[0.7em] font-bold not-italic leading-tight text-primary"
    >
      ✎
    </span>
  );
}

export type SketchTarget = {
  existing: ReaderAnnotation | null;
  blockId: string;
  partIndex: number | null;
  at: number | null;
  /** Wortlaut an der Stelle, nur zur Orientierung. */
  label: string;
};

/**
 * Zettel zeichnen: Vollbild, damit kein Wischen ein Blatt schließt. Stift mit Druck/Neigung;
 * sobald ein Stift erkannt wurde, zeichnet der Finger nicht mehr (Handballen).
 */
export function SketchEditor({
  target,
  onSave,
  onClose,
}: {
  target: SketchTarget;
  onSave: (strokes: InkStroke[], title: string | null) => void;
  onClose: () => void;
}) {
  const [strokes, setStrokes] = React.useState<InkStroke[]>(target.existing?.strokes ?? []);
  const [title, setTitle] = React.useState(target.existing?.body ?? "");
  const [color, setColor] = React.useState<InkColor>("schwarz");
  const [size, setSize] = React.useState<SizeKey>("mittel");
  const [eraser, setEraser] = React.useState(false);
  const [live, setLive] = React.useState<InkStroke | null>(null);
  const history = React.useRef<InkStroke[][]>([]);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const penSeen = React.useRef(false);
  const drawing = React.useRef<{ id: number; points: InkStroke["points"] } | null>(null);

  const pointOf = (event: React.PointerEvent): InkStroke["points"][number] | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = (event.clientX - rect.left) / rect.width;
    const y = ((event.clientY - rect.top) / rect.height) * SKETCH_HEIGHT;
    const pressure = event.pointerType === "pen" ? event.pressure || 0.5 : 0.5;
    const tilt = Math.min(90, Math.hypot(event.tiltX || 0, event.tiltY || 0));
    return [Math.min(1, Math.max(0, x)), Math.min(SKETCH_HEIGHT, Math.max(0, y)), pressure, tilt];
  };
  const commit = (next: InkStroke[]) => {
    history.current = [...history.current.slice(-49), strokes];
    setStrokes(next);
  };
  const eraseAt = (point: InkStroke["points"][number]) => {
    // Fingerbreit: Abstand zur Linie zwischen den Punkten, nicht nur zu den Punkten selbst.
    const radius = 0.03;
    const keep = strokes.filter(
      (stroke) =>
        !stroke.points.some((from, index) =>
          nearSegment(point, from, stroke.points[index + 1] ?? from, radius),
        ),
    );
    if (keep.length !== strokes.length) commit(keep);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "pen") penSeen.current = true;
    if (event.pointerType === "touch" && penSeen.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOf(event);
    if (!point) return;
    if (eraser) {
      drawing.current = { id: event.pointerId, points: [] };
      eraseAt(point);
      return;
    }
    drawing.current = { id: event.pointerId, points: [point] };
    setLive({ color, size: SIZES[size], points: [point] });
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = drawing.current;
    if (!current || current.id !== event.pointerId) return;
    const point = pointOf(event);
    if (!point) return;
    if (eraser) {
      eraseAt(point);
      return;
    }
    current.points.push(point);
    setLive({ color, size: SIZES[size], points: [...current.points] });
  };
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = drawing.current;
    if (!current || current.id !== event.pointerId) return;
    drawing.current = null;
    if (!eraser && current.points.length) {
      commit([...strokes, { color, size: SIZES[size], points: current.points.slice(0, 4000) }]);
    }
    setLive(null);
  };

  const finish = () => {
    onSave(strokes, title.trim() || null);
    onClose();
  };

  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notizzettel"
      className="fixed inset-0 z-50 flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Titel (optional), z. B. Gang zur Treppe"
          aria-label="Titel"
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base"
        />
        <Button variant="ghost" size="icon" aria-label="Ohne Speichern schließen" onClick={onClose}>
          <CloseIcon aria-hidden />
        </Button>
      </div>
      <p className="truncate px-3 pt-1 text-xs text-muted-foreground">
        Zettel bei „{target.label}“
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <svg
          ref={svgRef}
          data-sketch-canvas
          viewBox={`0 0 ${SCALE} ${SCALE * SKETCH_HEIGHT}`}
          className={cn(
            "aspect-[4/3] max-h-full w-full max-w-full touch-none rounded-md border border-border bg-card shadow-sm",
            eraser ? "cursor-cell" : "cursor-crosshair",
          )}
          style={{ maxWidth: `calc((100dvh - 12rem) * 4 / 3)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Strokes strokes={live ? [...strokes, live] : strokes} />
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Werkzeug">
          <Button
            variant={eraser ? "outline" : "primary"}
            size="icon"
            role="radio"
            aria-checked={!eraser}
            aria-label="Stift"
            onClick={() => setEraser(false)}
          >
            <PenLineIcon aria-hidden />
          </Button>
          <Button
            variant={eraser ? "primary" : "outline"}
            size="icon"
            role="radio"
            aria-checked={eraser}
            aria-label="Radierer"
            onClick={() => setEraser(true)}
          >
            <EraserIcon aria-hidden />
          </Button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Farbe">
          {INK_COLORS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={COLOR_LABEL[key]}
              aria-pressed={color === key && !eraser}
              onClick={() => {
                setColor(key);
                setEraser(false);
              }}
              className="flex h-10 w-10 items-center justify-center"
            >
              <svg viewBox="0 0 10 10" className="h-6 w-6" aria-hidden>
                <circle
                  cx="5"
                  cy="5"
                  r="4"
                  className={cn(
                    SCRIPT_INK_STYLES[key],
                    color === key && !eraser && "stroke-foreground [stroke-width:1.2]",
                  )}
                />
              </svg>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Stärke">
          {(Object.keys(SIZES) as SizeKey[]).map((key) => (
            <Button
              key={key}
              variant={size === key ? "outline" : "ghost"}
              size="sm"
              aria-pressed={size === key}
              onClick={() => setSize(key)}
            >
              {key}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rückgängig"
            disabled={!history.current.length}
            onClick={() => {
              const previous = history.current.at(-1);
              if (!previous) return;
              history.current = history.current.slice(0, -1);
              setStrokes(previous);
            }}
          >
            <Undo2Icon aria-hidden />
          </Button>
          {target.existing ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zettel löschen"
              onClick={() => {
                onSave([], null);
                onClose();
              }}
            >
              <TrashIcon aria-hidden />
            </Button>
          ) : null}
          <Button onClick={finish}>Fertig</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
