import fs from "fs";
import path from "path";

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export function getHeroImages(): string[] {
  try {
    const dir = path.join(process.cwd(), "public", "hero");
    const files = fs.readdirSync(dir);
    const images = files
      .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()))
      .map((f) => "/hero/" + f)
      .sort();
    return images;
  } catch {
    return [];
  }
}

export function pickHeroForNow(images: string[]): string | null {
  if (!images || images.length === 0) return null;
  // Use a stable seed based on the day to avoid hydration mismatch
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = dayOfYear % images.length;
  return images[idx];
}

