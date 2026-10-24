import { redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { getActiveProduction } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import { latestReleasedVersion } from "@/lib/skript/learn/service";

/**
 * Menü-Einstieg „Mein Text“/„Text lernen“: springt in die neueste freigegebene Fassung der
 * angezeigten Produktion. Ohne Fassung bleibt eine kurze Erklärung stehen.
 */
export async function ScriptEntry({ target }: { target: "read" | "learn" }) {
  const session = await requireAuth();
  const production = await getActiveProduction(session.user?.id);
  const version = production ? await latestReleasedVersion(production.id) : null;
  if (production && version) {
    redirect(
      target === "learn"
        ? `/mitglieder/lernen/${production.id}`
        : `/mitglieder/skript/${version.id}`,
    );
  }
  const href = target === "learn" ? "/mitglieder/text/lernen" : "/mitglieder/text";
  return (
    <div className="space-y-6">
      <PageHeader
        title={target === "learn" ? "Text lernen" : "Mein Text"}
        breadcrumbs={[membersNavigationBreadcrumb(href)]}
      />
      <p className="py-12 text-center text-sm text-muted-foreground">
        {production
          ? "Für diese Produktion ist noch keine Fassung des Skripts freigegeben."
          : "Wähle oben im Menü eine Produktion aus, um ihr Skript zu öffnen."}
      </p>
    </div>
  );
}
