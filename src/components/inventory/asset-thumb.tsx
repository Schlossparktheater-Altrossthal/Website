import { BoxesIcon, FileStackIcon, PackageIcon } from "@/components/ui/action-icons";
import type { ProductKind } from "@/lib/inventory/constants";
import { cn } from "@/lib/utils";

/** Quadratisches Vorschaubild eines Objekts; ohne Foto ein Symbol für die Objektart. */
export function AssetThumb({
  photoId,
  kind,
  size = "md",
  className,
}: {
  photoId: string | null;
  kind: ProductKind;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimension = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-16 w-16" : "h-11 w-11";
  if (photoId) {
    return (
      // Fotos kommen als Bytes aus der DB; next/image bringt hier keinen Vorteil.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/lager/photos/${photoId}`}
        alt=""
        loading="lazy"
        className={cn(
          dimension,
          "shrink-0 rounded-md border border-border object-cover",
          className,
        )}
      />
    );
  }
  const Icon = kind === "container" ? PackageIcon : kind === "set" ? FileStackIcon : BoxesIcon;
  return (
    <span
      className={cn(
        dimension,
        "flex shrink-0 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
