import type {
  NavigationBadgeVariant,
  NavigationItem,
  NavigationItemTone,
} from "@/config/navigation";
import { primaryNavigation, secondaryNavigation } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const iconToneClasses: Record<NavigationItemTone, string> = {
  default: "text-foreground/70",
  muted: "text-muted-foreground",
  primary: "text-[var(--primary)]",
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
};

const badgeToneFallback: Partial<
  Record<NavigationItemTone, NavigationBadgeVariant>
> = {
  muted: "muted",
  primary: "default",
  success: "success",
  info: "info",
  warning: "warning",
  destructive: "destructive",
};

function NavigationList({ items }: { items: NavigationItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const IconComponent = item.icon ?? item.activeIcon;
        const tone = item.tone ?? "default";
        const badgeVariant = item.badge?.variant ?? badgeToneFallback[tone] ?? "accent";

        return (
          <li key={item.href} className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/70 p-4">
            <div className="flex items-center gap-3">
              {IconComponent ? (
                <IconComponent
                  aria-hidden
                  className={cn("h-5 w-5", iconToneClasses[tone])}
                />
              ) : null}
              <span className="text-sm font-semibold text-foreground">{item.label}</span>
              {item.badge ? (
                <Badge variant={badgeVariant} size={item.badge.size ?? "sm"}>
                  {item.badge.label}
                </Badge>
              ) : null}
            </div>
            {item.description ? (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const title = "Config/Navigation";

const meta = { title };

export default meta;

export const Overview = () => (
  <div className="space-y-8 p-6">
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Primäre Navigation</h2>
      <NavigationList items={primaryNavigation} />
    </section>
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sekundäre Navigation</h2>
      <NavigationList items={secondaryNavigation} />
    </section>
  </div>
);
