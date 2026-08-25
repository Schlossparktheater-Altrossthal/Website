import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
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
      // Deutsche Texte enthalten Apostrophe ("geht's"), die sonst als
      // unescaped entities gemeldet würden. Gezielte, begründete Ausnahme.
      "react/no-unescaped-entities": "off",

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
