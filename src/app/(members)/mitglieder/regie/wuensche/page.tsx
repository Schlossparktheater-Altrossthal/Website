import { DirectionViewHeader } from "@/components/regie/direction-ui";
import { WishBoard, WishComposer } from "@/components/regie/wish-board";
import { loadDirectionPeople, loadDirectionScenes } from "@/lib/regie/data";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";
import { listDirectionWishes } from "@/lib/regie/wishes";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Wünsche · Regie" };

/** Gemeinsamer Eingang des Regieteams: alle Wünsche, Filter „Meine Wünsche“, Verlauf. */
export default async function DirectionWishesPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { userId, show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const [wishes, scenes, people] = await Promise.all([
    listDirectionWishes(show.id),
    loadDirectionScenes(show.id),
    loadDirectionPeople(show.id),
  ]);

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Wünsche an die Planung"
        description="Das Regieteam sieht alle Wünsche; die Planung antwortet hier."
        showId={show.id}
      />
      <WishComposer
        showId={show.id}
        scenes={scenes.map((scene) => ({ id: scene.id, label: scene.label }))}
        people={people}
      />
      <WishBoard wishes={wishes} currentUserId={userId} mode="direction" />
    </div>
  );
}
