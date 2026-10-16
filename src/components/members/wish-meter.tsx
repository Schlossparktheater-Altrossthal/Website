import { cn } from "@/lib/utils";
import { wishLevelLabel, type WishLevel } from "@/lib/wishes/levels";

/** Ampelfarbe je Stufe: Unbedingt/Sehr gern grün, Gern gelb, Vielleicht grau. */
const LEVEL_TONE: Record<WishLevel, string> = {
  4: "bg-success",
  3: "bg-success/60",
  2: "bg-warning",
  1: "bg-muted-foreground/50",
};

/**
 * Wie gern jemand etwas möchte, als kleine Ampel-Leiste (vier Segmente) – schneller erfassbar
 * als das Wort allein. Mit `showLabel` steht das Wort daneben.
 */
export function WishMeter({
  level,
  showLabel = false,
  className,
}: {
  level: WishLevel;
  showLabel?: boolean;
  className?: string;
}) {
  const label = wishLevelLabel(level);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5", className)}
      title={label}
      aria-label={showLabel ? undefined : label}
      role={showLabel ? undefined : "img"}
    >
      <span className="inline-flex items-end gap-0.5" aria-hidden>
        {([1, 2, 3, 4] as const).map((segment) => (
          <span
            key={segment}
            className={cn(
              "w-1.5 rounded-sm",
              segment === 1 ? "h-1.5" : segment === 2 ? "h-2" : segment === 3 ? "h-2.5" : "h-3",
              segment <= level ? LEVEL_TONE[level] : "bg-border",
            )}
          />
        ))}
      </span>
      {showLabel ? <span className="text-xs font-medium">{label}</span> : null}
    </span>
  );
}
