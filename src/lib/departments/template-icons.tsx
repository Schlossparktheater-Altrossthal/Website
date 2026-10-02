import {
  AudioLinesIcon,
  BoxesIcon,
  CameraIcon,
  ClapperboardIcon,
  DramaIcon,
  HammerIcon,
  MegaphoneIcon,
  PackageIcon,
  PaletteIcon,
  ShirtIcon,
  SunIcon,
  UsersRoundIcon,
  WandSparklesIcon,
  WrenchIcon,
  type IconComponent,
} from "@/components/ui/action-icons";

/** Auswahl für das Symbol einer Blaupause; gespeichert wird der Schlüssel. */
export const TEMPLATE_ICONS = {
  users: { label: "Team", Icon: UsersRoundIcon },
  hammer: { label: "Bau", Icon: HammerIcon },
  shirt: { label: "Kostüm", Icon: ShirtIcon },
  wand: { label: "Maske", Icon: WandSparklesIcon },
  sun: { label: "Licht", Icon: SunIcon },
  audio: { label: "Ton", Icon: AudioLinesIcon },
  package: { label: "Requisite", Icon: PackageIcon },
  megaphone: { label: "Werbung", Icon: MegaphoneIcon },
  drama: { label: "Schauspiel", Icon: DramaIcon },
  wrench: { label: "Technik", Icon: WrenchIcon },
  palette: { label: "Gestaltung", Icon: PaletteIcon },
  camera: { label: "Foto/Video", Icon: CameraIcon },
  clapperboard: { label: "Regie", Icon: ClapperboardIcon },
  boxes: { label: "Lager", Icon: BoxesIcon },
} satisfies Record<string, { label: string; Icon: IconComponent }>;

export type TemplateIconKey = keyof typeof TEMPLATE_ICONS;

const SLUG_DEFAULTS: Record<string, TemplateIconKey> = {
  buehnenbild: "hammer",
  kostuem: "shirt",
  maske: "wand",
  licht: "sun",
  ton: "audio",
  requisite: "package",
  "werbung-social": "megaphone",
  schauspiel: "drama",
  technik: "wrench",
};

export function isTemplateIconKey(value: string | null | undefined): value is TemplateIconKey {
  return Boolean(value && value in TEMPLATE_ICONS);
}

/** Gespeichertes Symbol, sonst ein passendes für bekannte Slugs, sonst „Team“. */
export function resolveTemplateIcon(icon: string | null | undefined, slug?: string) {
  const key: TemplateIconKey = isTemplateIconKey(icon)
    ? icon
    : ((slug ? SLUG_DEFAULTS[slug] : undefined) ?? "users");
  return { key, ...TEMPLATE_ICONS[key] };
}
