import type { ThemeModeKey, ThemeTokenKey, ThemeTokens } from "@/lib/website-settings";

function toVariableLines(
  record: Record<ThemeTokenKey, string>,
  fallback: Record<ThemeTokenKey, string>,
  tokenKeys: ThemeTokenKey[],
) {
  return tokenKeys
    .map((token) => {
      const value = record[token] ?? fallback[token] ?? "transparent";
      return `  --${token}: ${value};`;
    })
    .join("\n");
}

export function createThemeCss(tokens: ThemeTokens) {
  const modeKeys = Object.keys(tokens.modes).map((key) => key as ThemeModeKey);
  if (modeKeys.length === 0) {
    return "";
  }

  const baseMode: ThemeModeKey = modeKeys.includes("light" as ThemeModeKey)
    ? ("light" as ThemeModeKey)
    : modeKeys[0];
  const darkMode: ThemeModeKey | null = modeKeys.includes("dark" as ThemeModeKey)
    ? ("dark" as ThemeModeKey)
    : modeKeys.find((key) => key !== baseMode) ?? null;

  const baseTokens = (tokens.modes[baseMode] ?? {}) as Record<ThemeTokenKey, string>;
  const tokenKeySet = new Set<ThemeTokenKey>(
    Object.keys(baseTokens).map((key) => key as ThemeTokenKey),
  );
  if (darkMode) {
    for (const key of Object.keys(tokens.modes[darkMode] ?? {})) {
      tokenKeySet.add(key as ThemeTokenKey);
    }
  }
  const tokenKeys = Array.from(tokenKeySet);
  const lines: string[] = [];

  lines.push("/* dynamically generated website theme */");
  lines.push(":root {");
  if (tokens.radius?.base) {
    lines.push(`  --radius: ${tokens.radius.base};`);
  }
  const baseFallbackMode = darkMode
    ? ((tokens.modes[darkMode] ?? {}) as Record<ThemeTokenKey, string>)
    : {};
  lines.push(toVariableLines(baseTokens, baseFallbackMode, tokenKeys));
  lines.push("}");

  if (darkMode) {
    lines.push("");
    lines.push(".dark {");
    const darkTokens = (tokens.modes[darkMode] ?? {}) as Record<ThemeTokenKey, string>;
    lines.push(toVariableLines(darkTokens, baseTokens, tokenKeys));
    lines.push("}");
  }

  return lines.join("\n");
}
