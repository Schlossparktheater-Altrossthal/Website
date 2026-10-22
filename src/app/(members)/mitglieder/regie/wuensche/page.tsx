import { DirectionViewHeader } from "@/components/regie/direction-ui";
import { WishBoard, WishComposer } from "@/components/regie/wish-board";
import { loadDirectionScenes, loadWishRecipientOptions } from "@/lib/regie/data";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";
import { listDirectionWishes } from "@/lib/regie/wishes";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Wünsche · Regie" };

/** Gemeinsamer Eingang des Regieteams: alle Wünsche mit Status je Empfänger, Verlauf. */
export default async function DirectionWishesPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { userId, show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const [wishes, scenes, recipients] = await Promise.all([
    listDirectionWishes(show.id, userId),
    loadDirectionScenes(show.id),
    loadWishRecipientOptions(show.id),
  ]);

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Wünsche"
        description="An Planung, Gewerke, Rollen oder einzelne Personen. Das Regieteam sieht alle Wünsche und Antworten."
        showId={show.id}
      />
      <WishComposer
        showId={show.id}
        scenes={scenes.map((scene) => ({ id: scene.id, label: scene.label }))}
        recipients={recipients}
      />
      <WishBoard wishes={wishes} currentUserId={userId} mode="direction" />
    </div>
  );
}
