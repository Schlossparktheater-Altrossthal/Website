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

      // React Compiler ist nicht aktiv (next.config.ts). Diese Regeln bleiben
      // als Warnung sichtbar, blockieren aber nicht. Sie werden relevant,
      // sobald der Compiler eingeführt wird.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",

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

      // Direktes console.log verbieten; error/warn/debug bleiben erlaubt.
      "no-console": ["warn", { allow: ["error", "warn", "debug"] }],
    },
  },
  {
    // CLI-Skripte, der Realtime-Server und der zentrale Logger geben bewusst
    // auf stdout aus. service.ts/presence.ts sind toter Code (P3).
    files: [
      "scripts/**",
      "realtime-server/**",
      "src/lib/logger.ts",
      "src/lib/realtime/service.ts",
      "src/lib/realtime/presence.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Test-Mocks nutzen bewusst partielle Objekte und casten sie (z. B.
    // "as unknown as Request"). Diese Casts sind in Tests idiomatisch.
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;
