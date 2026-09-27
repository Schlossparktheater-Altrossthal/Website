import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

/** Grundfarbe der installierten App (Splash, Titelleiste); Standard-Theme ist dunkel. */
export const PWA_BACKGROUND_COLOR = "#0f1115";

export const PWA_ICON_VARIANTS = {
  "192": { size: 192, padding: 0.04, background: false },
  "512": { size: 512, padding: 0.04, background: false },
  // Maskable: Android schneidet bis zu 20 % weg – das Logo bleibt in der sicheren Zone.
  "maskable-512": { size: 512, padding: 0.18, background: true },
  apple: { size: 180, padding: 0.08, background: true },
} as const;

export type PwaIconVariant = keyof typeof PWA_ICON_VARIANTS;

let logoDataUrl: Promise<string> | null = null;

function readLogo() {
  logoDataUrl ??= readFile(path.join(process.cwd(), "public", "Logo-Sommertheater.png")).then(
    (buffer) => `data:image/png;base64,${buffer.toString("base64")}`,
  );
  return logoDataUrl;
}

/** PNG-Icon aus dem Theaterlogo, damit keine Binärdateien ins Repository müssen. */
export async function renderPwaIcon(variant: PwaIconVariant) {
  const { size, padding, background } = PWA_ICON_VARIANTS[variant];
  const logo = await readLogo();
  const inner = Math.round(size * (1 - padding * 2));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: background ? PWA_BACKGROUND_COLOR : "transparent",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse rendert nur <img> */}
      <img src={logo} width={inner} height={inner} alt="" />
    </div>,
    { width: size, height: size },
  );
}
