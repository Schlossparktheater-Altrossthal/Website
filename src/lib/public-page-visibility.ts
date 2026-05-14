import { readWebsiteSettings, resolveWebsiteSettings } from "@/lib/website-settings";

export async function getPublicPageVisibility() {
  if (!process.env.DATABASE_URL) {
    return resolveWebsiteSettings(null).pageVisibility.public;
  }

  const record = await readWebsiteSettings();
  return resolveWebsiteSettings(record).pageVisibility.public;
}
