import { DirectionEmpty, DirectionViewHeader } from "@/components/regie/direction-ui";
import { Badge } from "@/components/ui/badge";
import { loadDirectionProps } from "@/lib/regie/data";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Ausstattung · Regie" };

const STATUS = {
  planned: { label: "geplant", variant: "muted" },
  in_progress: { label: "in Arbeit", variant: "warning" },
  ready: { label: "fertig", variant: "success" },
} as const;

const KIND: Record<string, string> = {
  prop: "Requisite",
  set_piece: "Bühnenbild",
  costume: "Kostüm",
  other: "Sonstiges",
};

export default async function DirectionPropsPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const { scenes } = await loadDirectionProps(show.id);

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Ausstattung"
        description="Requisiten, Kostüme und Bühnenbild je Szene"
        showId={show.id}
        pdfKind="ausstattung"
      />
      {scenes.length ? (
        <ul className="space-y-3">
          {scenes.map((scene) => (
            <li key={scene.id} className="rounded-xl border border-border/70 bg-card p-3">
              <p className="font-medium">{scene.label}</p>
              <ul className="mt-1 space-y-1.5 text-sm">
                {scene.objects.map((object) => (
                  <li key={object.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      {object.title}
                      <span className="block text-xs text-muted-foreground">
                        {[KIND[object.kind], object.roles.join(", "), object.note]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <Badge variant={STATUS[object.status].variant} className="shrink-0">
                      {STATUS[object.status].label}
                    </Badge>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <DirectionEmpty>Noch keine Ausstattung den Szenen zugeordnet.</DirectionEmpty>
      )}
    </div>
  );
}
