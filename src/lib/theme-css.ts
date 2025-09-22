import type { ThemeModeKey, ThemeTokenKey, ThemeTokens } from "@/lib/website-settings";

function toVariableLines(record: Record<ThemeTokenKey, string>, tokenKeys: ThemeTokenKey[]) {
  return tokenKeys.map((token) => `  --${token}: ${record[token]};`).join("\n");
}

export function createThemeCss(tokens: ThemeTokens) {
  const modeKeys = Object.keys(tokens.modes) as ThemeModeKey[];
  const baseMode: ThemeModeKey = modeKeys.includes("light" as ThemeModeKey)
    ? ("light" as ThemeModeKey)
    : modeKeys[0];
  const darkMode: ThemeModeKey | null = modeKeys.includes("dark" as ThemeModeKey)
    ? ("dark" as ThemeModeKey)
    : modeKeys.find((key) => key !== baseMode) ?? null;

  const tokenKeys = Object.keys(tokens.modes[baseMode]) as ThemeTokenKey[];
  const lines: string[] = [];

  lines.push("/* dynamically generated website theme */");
  lines.push(":root {");
  if (tokens.radius?.base) {
    lines.push(`  --radius: ${tokens.radius.base};`);
  }
  lines.push(toVariableLines(tokens.modes[baseMode] as Record<ThemeTokenKey, string>, tokenKeys));
  lines.push("}");

  if (darkMode) {
    lines.push("");
    lines.push(".dark {");
    const darkTokens = tokens.modes[darkMode] as Record<ThemeTokenKey, string>;
    for (const token of tokenKeys) {
      const value = darkTokens[token] ?? tokens.modes[baseMode][token];
      lines.push(`  --${token}: ${value};`);
    }
    lines.push("}");
  }

  return lines.join("\n");
}
