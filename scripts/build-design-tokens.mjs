import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const tokensPath = path.resolve(projectRoot, "src/design-system/tokens.json");
const outputPath = path.resolve(projectRoot, "src/app/design-tokens.css");

if (!fs.existsSync(tokensPath)) {
  console.error(`Design tokens not found at ${tokensPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(tokensPath, "utf8");
const tokens = JSON.parse(raw);

const parameters = tokens.parameters;
if (!parameters || typeof parameters !== "object") {
  console.error("Design token file must contain a 'parameters' object with families and tokens.");
  process.exit(1);
}

const families = parameters.families ?? {};
const semanticTokens = parameters.tokens ?? {};

if (!Object.keys(semanticTokens).length) {
  console.error("No semantic tokens defined under parameters.tokens.");
  process.exit(1);
}

const RESERVED_KEYS = new Set(["family", "description", "notes", "tags"]);

function normaliseFamilies(familyRecord) {
  const result = {};
  for (const [familyName, modes] of Object.entries(familyRecord ?? {})) {
    if (!modes || typeof modes !== "object") {
      continue;
    }
    result[familyName] = {};
    for (const [mode, value] of Object.entries(modes)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const { l, c, h, alpha } = value;
      if (typeof l !== "number" || typeof c !== "number" || typeof h !== "number") {
        console.error(`Family '${familyName}' is missing numeric l/c/h for mode '${mode}'.`);
        process.exit(1);
      }
      result[familyName][mode] = { l, c, h, alpha: typeof alpha === "number" ? alpha : 1 };
    }
  }
  return result;
}

const normalisedFamilies = normaliseFamilies(families);

const modeKeySet = new Set();
for (const def of Object.values(semanticTokens)) {
  if (!def || typeof def !== "object") {
    continue;
  }
  for (const key of Object.keys(def)) {
    if (!RESERVED_KEYS.has(key)) {
      modeKeySet.add(key);
    }
  }
}

if (!modeKeySet.size) {
  console.error("Unable to determine theme modes from token definitions.");
  process.exit(1);
}

const modeKeys = Array.from(modeKeySet).sort();
const tokenNames = Object.keys(semanticTokens).sort();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wrapHue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let result = value % 360;
  if (result < 0) result += 360;
  return result;
}

function toPrecision(value, precision) {
  return Number.parseFloat(value.toFixed(precision));
}

function formatOklch({ l, c, h, alpha }) {
  const parts = [toPrecision(clamp(l, 0, 1), 3), toPrecision(Math.max(c, 0), 3), toPrecision(wrapHue(h), 1)];
  const prefix = `oklch(${parts.join(" ")}`;
  if (typeof alpha === "number" && alpha >= 0 && alpha < 1) {
    return `${prefix} / ${toPrecision(clamp(alpha, 0, 1), 2)})`;
  }
  return `${prefix})`;
}

function applyAdjustments(base, adjustments, tokenName, mode) {
  let { l, c, h, alpha } = base;
  if (typeof adjustments !== "object" || !adjustments) {
    return { l, c, h, alpha };
  }

  if (typeof adjustments.value === "string") {
    return adjustments.value;
  }

  if (typeof adjustments.l === "number") {
    l = adjustments.l;
  }
  if (typeof adjustments.deltaL === "number") {
    l += adjustments.deltaL;
  }
  if (typeof adjustments.scaleL === "number") {
    l *= adjustments.scaleL;
  }

  if (typeof adjustments.c === "number") {
    c = adjustments.c;
  }
  if (typeof adjustments.deltaC === "number") {
    c += adjustments.deltaC;
  }
  if (typeof adjustments.scaleC === "number") {
    c *= adjustments.scaleC;
  }

  if (typeof adjustments.h === "number") {
    h = adjustments.h;
  }
  if (typeof adjustments.deltaH === "number") {
    h += adjustments.deltaH;
  }

  if (typeof adjustments.alpha === "number") {
    alpha = adjustments.alpha;
  }
  if (typeof adjustments.deltaAlpha === "number") {
    alpha += adjustments.deltaAlpha;
  }
  if (typeof adjustments.scaleAlpha === "number") {
    alpha *= adjustments.scaleAlpha;
  }

  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h) || !Number.isFinite(alpha)) {
    console.error(`Token '${tokenName}' produced an invalid color for mode '${mode}'.`);
    process.exit(1);
  }

  return { l, c, h, alpha };
}

const memo = new Map();

function resolveTokenValue(tokenName, mode) {
  const memoKey = `${mode}:${tokenName}`;
  if (memo.has(memoKey)) {
    return memo.get(memoKey);
  }

  const definition = semanticTokens[tokenName];
  if (!definition || typeof definition !== "object") {
    console.error(`Unknown token '${tokenName}'.`);
    process.exit(1);
  }

  const modeConfig = definition[mode] ?? {};
  if (typeof modeConfig === "string") {
    memo.set(memoKey, modeConfig);
    return modeConfig;
  }

  const familyName = (modeConfig && typeof modeConfig === "object" && modeConfig.family)
    || definition.family;

  if (!familyName || !normalisedFamilies[familyName]) {
    console.error(`Token '${tokenName}' references unknown family '${familyName}'.`);
    process.exit(1);
  }

  const familyModes = normalisedFamilies[familyName];
  const base = familyModes[mode];
  if (!base) {
    console.error(`Family '${familyName}' does not define mode '${mode}'.`);
    process.exit(1);
  }

  const adjusted = applyAdjustments(base, modeConfig, tokenName, mode);

  if (typeof adjusted === "string") {
    memo.set(memoKey, adjusted);
    return adjusted;
  }

  const colour = formatOklch(adjusted);
  memo.set(memoKey, colour);
  return colour;
}

const resolvedModes = Object.fromEntries(modeKeys.map((mode) => [mode, {}]));

for (const mode of modeKeys) {
  for (const tokenName of tokenNames) {
    resolvedModes[mode][tokenName] = resolveTokenValue(tokenName, mode);
  }
}

const radiusLine = tokens.radius?.base ? `  --radius: ${tokens.radius.base};\n` : "";

const lightBlock = resolvedModes["light"] ? Object.entries(resolvedModes["light"]).map(([name, value]) => `  --${name}: ${value};`).join("\n") : "";
const darkBlock = resolvedModes["dark"] ? Object.entries(resolvedModes["dark"]).map(([name, value]) => `  --${name}: ${value};`).join("\n") : "";

const fileHeader = `/**\n * Auto-generated by scripts/build-design-tokens.mjs\n * Do not edit this file directly. Update src/design-system/tokens.json instead.\n */`;

const cssLines = [fileHeader, "", ":root {", radiusLine + lightBlock, "}"];
if (resolvedModes.dark) {
  cssLines.push("", ".dark {", darkBlock, "}");
}

fs.writeFileSync(outputPath, cssLines.join("\n") + "\n");
console.log(`Design tokens written to ${path.relative(projectRoot, outputPath)}`);

tokens.modes = resolvedModes;
tokens.meta = {
  ...(tokens.meta ?? {}),
  generatedAt: new Date().toISOString(),
  modes: modeKeys,
};

fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2) + "\n");
console.log(`Design token configuration updated at ${path.relative(projectRoot, tokensPath)}`);
