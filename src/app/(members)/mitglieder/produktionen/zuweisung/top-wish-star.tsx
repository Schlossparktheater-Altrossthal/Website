import { StarIcon } from "lucide-react";

/** Stern für den höchsten Wunsch einer Person (wie im PDF). */
export function TopWishStar() {
  return (
    <StarIcon
      className="h-3.5 w-3.5 shrink-0 fill-primary text-primary"
      aria-label="höchster Wunsch"
      role="img"
    />
  );
}
