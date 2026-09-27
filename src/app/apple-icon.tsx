import { PWA_ICON_VARIANTS, renderPwaIcon } from "@/lib/pwa/app-icons";

export const size = { width: PWA_ICON_VARIANTS.apple.size, height: PWA_ICON_VARIANTS.apple.size };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderPwaIcon("apple");
}
