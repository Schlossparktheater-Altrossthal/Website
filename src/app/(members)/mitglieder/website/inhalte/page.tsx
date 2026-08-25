import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  DEFAULT_HOME_FAQ,
  DEFAULT_SCHULKATZE_INTRO,
  DEFAULT_UEBER_UNS_INTRO,
  DEFAULT_UEBER_UNS_MILESTONES,
  DEFAULT_UEBER_UNS_SIGNATURE,
  DEFAULT_UEBER_UNS_STATS,
  DEFAULT_UEBER_UNS_TRADES,
  DEFAULT_UEBER_UNS_VALUES,
  WEBSITE_CONTENT_IDS,
  readFaqContent,
  readSchulkatzeIntro,
  readUeberUnsIntro,
  readUeberUnsMilestones,
  readUeberUnsSignature,
  readUeberUnsStats,
  readUeberUnsTrades,
  readUeberUnsValues,
} from "@/lib/website-content";
import { Heading } from "@/components/ui/typography";
import { ContentManager } from "./content-manager";

export default async function SeiteninhalteePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PUBLIC.CONTENT.MANAGE");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">Kein Zugriff auf die Seiteninhalte.</div>
      </div>
    );
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Die Datenbank ist nicht konfiguriert. Seiteninhalte können nicht geladen werden.
        </div>
      </div>
    );
  }

  const [
    faq,
    schulkatzeIntro,
    ueberUnsIntro,
    ueberUnsStats,
    ueberUnsMilestones,
    ueberUnsSignature,
    ueberUnsValues,
    ueberUnsTrades,
  ] = await Promise.all([
    readFaqContent(),
    readSchulkatzeIntro(),
    readUeberUnsIntro(),
    readUeberUnsStats(),
    readUeberUnsMilestones(),
    readUeberUnsSignature(),
    readUeberUnsValues(),
    readUeberUnsTrades(),
  ]);

  return (
    <div className="space-y-6">
      <Heading level="h2">Website-Redaktion</Heading>
      <ContentManager
        ids={WEBSITE_CONTENT_IDS}
        initialData={{
          faq,
          schulkatzeIntro,
          ueberUnsIntro,
          ueberUnsStats,
          ueberUnsMilestones,
          ueberUnsSignature,
          ueberUnsValues,
          ueberUnsTrades,
        }}
        defaults={{
          faq: DEFAULT_HOME_FAQ,
          schulkatzeIntro: DEFAULT_SCHULKATZE_INTRO,
          ueberUnsIntro: DEFAULT_UEBER_UNS_INTRO,
          ueberUnsStats: DEFAULT_UEBER_UNS_STATS,
          ueberUnsMilestones: DEFAULT_UEBER_UNS_MILESTONES,
          ueberUnsSignature: DEFAULT_UEBER_UNS_SIGNATURE,
          ueberUnsValues: DEFAULT_UEBER_UNS_VALUES,
          ueberUnsTrades: DEFAULT_UEBER_UNS_TRADES,
        }}
      />
    </div>
  );
}
