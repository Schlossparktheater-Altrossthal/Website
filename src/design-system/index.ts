import tokens from "./tokens.json";

type Modes = typeof tokens.modes;

export type ThemeMode = keyof Modes;
export type SemanticToken = keyof Modes["light"];

export const designTokens = tokens;

export function getThemeTokens(mode: ThemeMode) {
  return tokens.modes[mode];
}

export function getSemanticToken(mode: ThemeMode, token: SemanticToken) {
  return tokens.modes[mode][token];
}

export function getBaseRadius() {
  return tokens.radius.base;
}
