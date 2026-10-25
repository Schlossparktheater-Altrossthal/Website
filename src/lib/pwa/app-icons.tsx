import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

/** Grundfarbe der installierten App (Splash, Titelleiste); Standard-Theme ist dunkel. */
export const PWA_BACKGROUND_COLOR = "#0f1115";

/**
 * App-Icon = roter Hintergrund, Katze, bunter Ring (docs/logo/skripte/app_icons.py, 2026-10-25).
 * Die PNGs sind randlos; maskable hat Ring und Katze in der sicheren Zone (Android schneidet bis zu 20 % weg).
 */
export const PWA_ICON_VARIANTS = {
  "192": { size: 192, file: "app-icon.png" },
  "512": { size: 512, file: "app-icon.png" },
  "maskable-512": { size: 512, file: "app-icon-maskable.png" },
  apple: { size: 180, file: "app-icon.png" },
} as const;

export type PwaIconVariant = keyof typeof PWA_ICON_VARIANTS;

const iconDataUrls = new Map<string, Promise<string>>();

function readIcon(file: string) {
  let dataUrl = iconDataUrls.get(file);
  if (!dataUrl) {
    dataUrl = readFile(path.join(process.cwd(), "public", file)).then(
      (buffer) => `data:image/png;base64,${buffer.toString("base64")}`,
    );
    iconDataUrls.set(file, dataUrl);
  }
  return dataUrl;
}

/** PNG-Icon in der gewünschten Größe aus dem App-Icon (public/app-icon*.png). */
export async function renderPwaIcon(variant: PwaIconVariant) {
  const { size, file } = PWA_ICON_VARIANTS[variant];
  const icon = await readIcon(file);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse rendert nur <img> */}
      <img src={icon} width={size} height={size} alt="" />
    </div>,
    { width: size, height: size },
  );
}
