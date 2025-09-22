import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { resolveFrontendEditingFeatures } from "@/lib/frontend-editing";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ features: [] });
  }

  try {
    const features = await resolveFrontendEditingFeatures(session.user);
    return NextResponse.json({ features });
  } catch (error) {
    console.error("Failed to resolve frontend editing features", error);
    return NextResponse.json({ features: [], error: "Bearbeitungsrechte konnten nicht geladen werden." }, { status: 500 });
  }
}
