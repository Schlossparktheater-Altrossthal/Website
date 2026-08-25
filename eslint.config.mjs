import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-plugin-react 7.37.5 unterstützt ESLint 10 noch nicht (Peer: ^9.7)
// und crasht beim Laden der react/*-Regeln ("react/display-name").
// Deshalb werden die react/*-Regeln vorübergehend entfernt, bis das Plugin
// ESLint 10 unterstützt oder das Projekt auf ESLint 9 zurückgeht.
// Nur die react/*-Regeln sind betroffen – react-hooks/* und
// @typescript-eslint/* bleiben aktiv.
function stripReactRules(config) {
  if (!config?.rules) return config;
  const filteredRules = Object.fromEntries(
    Object.entries(config.rules).filter(([name]) => !name.startsWith("react/")),
  );
  return { ...config, rules: filteredRules };
}

const eslintConfig = [
  ...nextVitals.map(stripReactRules),
  ...nextTypescript.map(stripReactRules),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/workbox/**",
      "deploy-service/**",
      "eslint.config.mjs",
    ],
  },
  {
    rules: {
      // AGENTS.md verbietet explizites any.
      "@typescript-eslint/no-explicit-any": "error",

      // AGENTS.md verbietet as never / as unknown as. Über den AST gemeldet.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression > TSUnknownKeyword",
          message:
            "Casts via 'as unknown as' sind verboten (AGENTS.md). Korrekte Typen oder Guards verwenden.",
        },
        {
          selector: "TSAsExpression > TSNeverKeyword",
          message: "Casts via 'as never' sind verboten (AGENTS.md).",
        },
      ],

      // Direktes console.log verbieten; error/warn bleiben erlaubt,
      // deren Umstellung auf den zentralen Logger ist eine eigene Aufgabe.
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
];

export default eslintConfig;
