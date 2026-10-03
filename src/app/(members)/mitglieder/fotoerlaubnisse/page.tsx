import { PhotoConsentAdminPanel } from "@/components/members/photo-consent-admin-panel";
import { PhotoConsentPhotographerView } from "@/components/members/photo-consent-photographer-view";
import { PageHeader } from "@/components/members/page-header";
import { SectionNav } from "@/components/ui/section-nav";
import { ensurePermissionDefinitions, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const SECTIONS = [
  { id: "einwilligungen", label: "Prüfen", href: "/mitglieder/fotoerlaubnisse" },
  { id: "fotografen", label: "Fotoliste", href: "/mitglieder/fotoerlaubnisse?bereich=fotografen" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default async function FotoErlaubnissePage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const session = await requireAuth();
  await ensurePermissionDefinitions();
  const [canManage, canView] = await Promise.all([
    hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"),
    hasPermission(session.user, "PRIVATE.PHOTOCONSENT.VIEW"),
  ]);

  if (!canManage && !canView) {
    return (
      <div className="text-sm text-destructive">Kein Zugriff auf die Fotoeinverständnisse</div>
    );
  }

  const params = await searchParams;
  const requested = params.bereich;
  const activeSection: SectionId = canManage
    ? requested === "fotografen"
      ? "fotografen"
      : "einwilligungen"
    : "fotografen";

  // Wer nur lesen darf, sieht ausschließlich die Fotoliste.
  const visibleSections = canManage
    ? SECTIONS
    : SECTIONS.filter((section) => section.id === "fotografen");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotoerlaubnisse"
        description="Fotoerlaubnisse je Produktion prüfen und die Fotoliste ansehen."
      />
      <SectionNav
        items={visibleSections}
        activeId={activeSection}
        ariaLabel="Bereiche der Fotoerlaubnisse"
      />
      {activeSection === "fotografen" ? (
        <PhotoConsentPhotographerView />
      ) : (
        <PhotoConsentAdminPanel />
      )}
    </div>
  );
}
