import { PhotoConsentAdminPanel } from "@/components/members/photo-consent-admin-panel";
import { PhotoConsentPurposesPanel } from "@/components/members/photo-consent-purposes-panel";
import { PageHeader } from "@/components/members/page-header";
import { SectionNav } from "@/components/ui/section-nav";
import { ensurePermissionDefinitions, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const SECTIONS = [
  { id: "einwilligungen", label: "Einwilligungen", href: "/mitglieder/fotoerlaubnisse" },
  { id: "zwecke", label: "Zwecke", href: "/mitglieder/fotoerlaubnisse?bereich=zwecke" },
] as const;

export default async function FotoErlaubnissePage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const session = await requireAuth();
  await ensurePermissionDefinitions();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE");
  if (!allowed) {
    return (
      <div className="text-sm text-destructive">
        Kein Zugriff auf die Verwaltung der Fotoeinverständnisse
      </div>
    );
  }

  const params = await searchParams;
  const activeSection = params.bereich === "zwecke" ? "zwecke" : "einwilligungen";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotoerlaubnisse"
        description="Prüfe Einwilligungen je Produktion und pflege die abgefragten Verwendungszwecke."
      />
      <SectionNav
        items={SECTIONS}
        activeId={activeSection}
        ariaLabel="Bereiche der Fotoerlaubnisse"
      />
      {activeSection === "zwecke" ? <PhotoConsentPurposesPanel /> : <PhotoConsentAdminPanel />}
    </div>
  );
}
