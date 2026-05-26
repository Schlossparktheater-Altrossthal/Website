import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

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
];

export default eslintConfig;
