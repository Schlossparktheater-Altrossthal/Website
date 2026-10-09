import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { MODULE_FOR_KIND, OBJECT_KIND_PLURAL } from "@/lib/ausstattung/constants";
import { loadObjectDetail, loadShowObjects, loadStage } from "@/lib/ausstattung/objects";
import { REQUIREMENT_CREATE_PERMISSION } from "@/lib/ausstattung/service";
import { resolveTeamsViewer } from "@/lib/departments/access";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { loadHandoverSettings, loadTaskHandover } from "@/lib/departments/handover";
import { loadDepartmentPortal } from "@/lib/departments/portal";
import { prisma } from "@/lib/prisma";

import { ObjectEditor } from "../../../ausstattung/object-editor";

const VIEW_FOR_MODULE: Record<string, string> = {
  props: "requisiten",
  costumes: "kostueme",
  set: "buehnenbild",
};

type PageProps = { params: Promise<{ slug: string; id: string }> };

/** Ein Ausstattungsstück: Beschreibung, Fotos, Szenen, Rollen, Teile, Arbeitsschritte, Fundus. */
export default async function ObjektPage({ params }: PageProps) {
  const { slug, id } = await params;
  const { userId, isManager, production } = await resolveTeamsViewer();
  if (!userId || !production) notFound();
  const portal = await loadDepartmentPortal(production.id, decodeURIComponent(slug), userId);
  // Lesend auch für alle, die anfordern (Regie/Planung), damit sie den Stand verfolgen können.
  const session = await requireAuth();
  const canRequest = await hasPermission(session.user, REQUIREMENT_CREATE_PERMISSION);
  if (!portal || (!portal.viewerRole && !isManager && !canRequest)) notFound();
  const object = await loadObjectDetail(id);
  if (!object || object.departmentId !== portal.id) notFound();

  const [stage, showObjects, inventory, handover, settings] = await Promise.all([
    loadStage(object.showId),
    object.kind === "costume" || object.kind === "costume_part"
      ? loadShowObjects(object.showId, ["costume", "costume_part"])
      : Promise.resolve([]),
    object.inventoryProductId
      ? loadInventory(object.inventoryProductId, object.inventoryAssetId)
      : null,
    object.taskId ? loadTaskHandover(object.taskId) : null,
    loadHandoverSettings(portal.id),
  ]);

  const basePath = `/mitglieder/meine-gewerke/${encodeURIComponent(portal.slug)}`;
  const moduleKey = MODULE_FOR_KIND[object.kind];
  const listView =
    moduleKey && portal.modules.includes(moduleKey) ? VIEW_FOR_MODULE[moduleKey] : null;
  const canEdit = isManager || (portal.viewerRole !== null && portal.viewerRole !== "guest");
  const canManage = isManager || portal.viewerRole === "lead" || portal.viewerRole === "deputy";

  return (
    <div className="space-y-4">
      <PageHeader
        title={object.title}
        breadcrumbs={[
          { id: "teams", label: "Meine Teams", href: "/mitglieder/meine-gewerke" },
          ...(portal.viewerRole || isManager
            ? [{ id: "team", label: portal.name, href: basePath }]
            : []),
          ...(listView && (portal.viewerRole || isManager)
            ? [
                {
                  id: "liste",
                  label:
                    OBJECT_KIND_PLURAL[object.kind === "costume_part" ? "costume" : object.kind],
                  href: `${basePath}?ansicht=${listView}`,
                },
              ]
            : []),
        ]}
      />
      <ObjectEditor
        object={object}
        stage={stage}
        basePath={basePath}
        canEdit={canEdit}
        canManage={canManage}
        showObjects={showObjects.map((entry) => ({
          id: entry.id,
          title: entry.title,
          kind: entry.kind,
          status: entry.status,
          photoId: entry.photoId,
        }))}
        inventory={inventory}
        canOpenTeam={Boolean(portal.viewerRole) || isManager}
        handover={
          handover && (portal.viewerRole || isManager)
            ? {
                state: handover,
                viewerId: userId,
                canEditCaution: settings.noteEditors === "leads" ? canManage : canEdit,
              }
            : null
        }
      />
    </div>
  );
}

async function loadInventory(productId: string, assetId: string | null) {
  const product = await prisma.inventoryProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      publicId: true,
      assets: {
        where: { status: { not: "retired" } },
        orderBy: [{ unitNumber: "asc" }, { code: "asc" }],
        take: 100,
        select: { id: true, code: true, status: true, publicId: true },
      },
    },
  });
  if (!product) return null;
  const asset = product.assets.find((entry) => entry.id === assetId) ?? null;
  return {
    productId: product.id,
    productName: product.name,
    productPublicId: product.publicId,
    asset: asset ? { id: asset.id, code: asset.code, publicId: asset.publicId } : null,
    assets: product.assets.map((entry) => ({
      id: entry.id,
      code: entry.code,
      status: entry.status,
    })),
  };
}
