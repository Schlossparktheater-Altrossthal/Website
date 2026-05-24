import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { deleteProductionFlyerSettingsImage, readProductionFlyerSettings, saveProductionFlyerSettingsImage } from "@/lib/production-flyer-settings";

const MAX_SIZE = 5 * 1024 * 1024;

export async function GET() {
  const flyer = await readProductionFlyerSettings();
  if (!flyer?.bildData || !flyer.bildMimeType) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(flyer.bildData), { headers: { "Content-Type": flyer.bildMimeType } });
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PUBLIC.HOME.FLYER.EDIT"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "Datei fehlt." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Nur Bilder erlaubt." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Datei zu groß (max 5MB)." }, { status: 400 });
  const buffer = new Uint8Array(await file.arrayBuffer());
  await saveProductionFlyerSettingsImage({ bildData: buffer, bildMimeType: file.type });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PUBLIC.HOME.FLYER.EDIT"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await deleteProductionFlyerSettingsImage();
  return NextResponse.json({ success: true });
}
