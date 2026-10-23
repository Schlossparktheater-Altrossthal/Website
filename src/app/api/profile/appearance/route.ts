import { HttpError, parseJson, withRoute } from "@/lib/api/route";
import { z } from "zod";

import {
  MemberThemeNotSelectableError,
  THEME_COLOR_MODES,
  ensureWebsiteSettingsRecord,
  listMemberSelectableThemes,
  readMemberAppearance,
  resolveWebsiteSettings,
  toClientWebsiteThemeSummary,
  saveMemberAppearance,
} from "@/lib/website-settings";

const appearanceSchema = z.object({
  colorMode: z.enum(THEME_COLOR_MODES).nullable(),
  themeId: z.string().trim().min(1).max(100).nullable(),
});

/** Profil „Darstellung“: eigener Farbmodus und Theme aus den freigegebenen Themes. */
export const GET = withRoute({ name: "profile/appearance.get" }, async ({ userId }) => {
  const [appearance, themes, settings] = await Promise.all([
    readMemberAppearance(userId),
    listMemberSelectableThemes(),
    ensureWebsiteSettingsRecord(),
  ]);
  const site = resolveWebsiteSettings(settings);
  return {
    colorMode: appearance?.colorMode ?? null,
    themeId: appearance?.theme?.id ?? null,
    site: { colorMode: site.colorMode, theme: toClientWebsiteThemeSummary(site.theme) },
    themes,
  };
});

export const PUT = withRoute({ name: "profile/appearance.put" }, async ({ request, userId }) => {
  const input = await parseJson(request, appearanceSchema);
  try {
    await saveMemberAppearance(userId, input);
  } catch (error) {
    if (error instanceof MemberThemeNotSelectableError) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
  return { ok: true };
});
