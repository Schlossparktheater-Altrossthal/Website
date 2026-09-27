import { PWA_ICON_VARIANTS, renderPwaIcon, type PwaIconVariant } from "@/lib/pwa/app-icons";

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(PWA_ICON_VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, context: { params: Promise<{ variant: string }> }) {
  const { variant } = await context.params;
  if (!Object.hasOwn(PWA_ICON_VARIANTS, variant)) {
    return Response.json({ error: "Unbekanntes Icon" }, { status: 404 });
  }
  return renderPwaIcon(variant as PwaIconVariant);
}
