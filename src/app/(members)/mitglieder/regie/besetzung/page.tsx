import { DirectionEmpty, DirectionViewHeader } from "@/components/regie/direction-ui";
import { loadDirectionCasting } from "@/lib/regie/data";
import { CASTING_LABELS } from "@/lib/regie/pdf";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Besetzung · Regie" };

export default async function DirectionCastingPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const roles = await loadDirectionCasting(show.id);

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Besetzung"
        description="Rollen und wer sie spielt"
        showId={show.id}
        pdfKind="besetzung"
      />
      {roles.length ? (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
          {roles.map((role) => (
            <li key={role.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                {role.color ? (
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                ) : null}
                {role.name}
              </span>
              {role.castings.length ? (
                <span className="text-right">
                  {role.castings.map((casting) => (
                    <span key={`${casting.userId}-${casting.type}`} className="block">
                      {casting.name}
                      {casting.type !== "primary" ? (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {CASTING_LABELS[casting.type]}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-warning">unbesetzt</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <DirectionEmpty>Noch keine Rollen angelegt.</DirectionEmpty>
      )}
    </div>
  );
}
