import { PageHeader } from "@/components/members/page-header";
import { WishBoard } from "@/components/regie/wish-board";
import { getActiveProduction } from "@/lib/active-production";
import { requireAuth } from "@/lib/rbac";
import { listRecipientWishes } from "@/lib/regie/wishes";

export const metadata = { title: "Wünsche der Regie" };

/** Wünsche der Regie an mich, meine Rollen und meine Gewerke (docs/Plan/wuensche-plan.md). */
export default async function RecipientWishesPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  const production = await getActiveProduction(userId);
  if (!userId || !production) {
    return <div className="text-sm text-muted-foreground">Keine aktive Produktion.</div>;
  }
  const wishes = await listRecipientWishes(production.id, userId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Wünsche der Regie"
        description="An dich, deine Rollen und deine Gewerke. Annehmen, erledigt melden oder mit Grund ablehnen – die Regie sieht deine Antwort."
      />
      <div className="max-w-2xl">
        <WishBoard wishes={wishes} currentUserId={userId} mode="recipient" />
      </div>
    </div>
  );
}
