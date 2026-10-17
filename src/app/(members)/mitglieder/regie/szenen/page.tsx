import { DirectionEmpty, DirectionViewHeader } from "@/components/regie/direction-ui";
import { loadDirectionCasting, loadDirectionScenes } from "@/lib/regie/data";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Szenen · Regie" };

/** Je Szene: Rollen und wer sie spielt (mobil als Liste statt breiter Matrix). */
export default async function DirectionScenesPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const [scenes, roles] = await Promise.all([
    loadDirectionScenes(show.id),
    loadDirectionCasting(show.id),
  ]);
  const roleById = new Map(roles.map((role) => [role.id, role]));

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Szenen × Personen"
        description="Wer spielt in welcher Szene"
        showId={show.id}
        pdfKind="szenen"
      />
      {scenes.length ? (
        <ul className="space-y-2">
          {scenes.map((scene) => (
            <li key={scene.id} className="rounded-xl border border-border/70 bg-card p-3">
              <p className="font-medium">{scene.label}</p>
              {scene.characterIds.length ? (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {scene.characterIds.map((id) => {
                    const role = roleById.get(id);
                    if (!role) return null;
                    const cast = role.castings.map((casting) => casting.name).join(" / ");
                    return (
                      <li key={id} className="flex justify-between gap-3">
                        <span>{role.name}</span>
                        <span className={cast ? "text-muted-foreground" : "text-warning"}>
                          {cast || "unbesetzt"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Rollen zugeordnet.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <DirectionEmpty>Noch keine Szenen angelegt.</DirectionEmpty>
      )}
    </div>
  );
}
