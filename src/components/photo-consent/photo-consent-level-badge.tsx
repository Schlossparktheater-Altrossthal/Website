import { Badge } from "@/components/ui/badge";
import {
  PHOTO_CONSENT_LEVEL_DEFINITIONS,
  photoConsentLevelShortLabel,
  type PhotoConsentLevelTone,
  type PhotoConsentLevelValue,
} from "@/lib/photo-consent-levels";
import { cn } from "@/lib/utils";

export const PHOTO_CONSENT_TONE_DOT: Record<PhotoConsentLevelTone | "muted", string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

/** Farbpunkt einer Stufe (grau für „Stufe unbekannt“). */
export function PhotoConsentLevelDot({
  level,
  tone,
  className,
}: {
  level?: PhotoConsentLevelValue | null;
  tone?: PhotoConsentLevelTone | "muted";
  className?: string;
}) {
  const resolved = tone ?? (level ? PHOTO_CONSENT_LEVEL_DEFINITIONS[level].tone : "muted");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        PHOTO_CONSENT_TONE_DOT[resolved],
        className,
      )}
    />
  );
}

/** Kurzform der Stufe als Badge mit Farbpunkt. */
export function PhotoConsentLevelBadge({
  level,
  className,
}: {
  level: PhotoConsentLevelValue | null;
  className?: string;
}) {
  return (
    <Badge variant={level ? "outline" : "muted"} size="sm" className={cn("gap-1.5", className)}>
      <PhotoConsentLevelDot level={level} className="size-2" />
      {photoConsentLevelShortLabel(level)}
    </Badge>
  );
}
