import tokens from "./tokens.json";

type Modes = typeof tokens.modes;

export type ThemeMode = keyof Modes;
export type SemanticToken = keyof Modes[ThemeMode];

export const designTokens = tokens;
export const designTokenParameters = tokens.parameters;

export function getThemeTokens(mode: ThemeMode) {
  return designTokens.modes[mode];
}

export function getSemanticToken(mode: ThemeMode, token: SemanticToken) {
  return designTokens.modes[mode][token];
}

export function getBaseRadius() {
  return designTokens.radius.base;
}
