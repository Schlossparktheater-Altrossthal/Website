// Bündelt scripts/demo/seed.ts für das Produktions-Image (dort gibt es kein tsx).
// Pakete bleiben extern (node_modules im Image). src/auth.ts wird durch auth-stub.ts ersetzt:
// next-auth importiert "next/server" ohne Endung, was Node außerhalb von Next nicht auflöst.
import { resolve } from "node:path";

import { build } from "esbuild";

await build({
  entryPoints: ["scripts/demo/seed.ts"],
  outfile: "scripts/demo/dist/seed.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  tsconfig: "tsconfig.json",
  logLevel: "warning",
  plugins: [
    {
      name: "externals",
      setup(api) {
        api.onResolve({ filter: /^@\/auth$/ }, () => ({
          path: resolve("scripts/demo/auth-stub.ts"),
        }));
        api.onResolve({ filter: /^[^./@]|^@[^/]/ }, (args) => ({
          path: args.path,
          external: true,
        }));
      },
    },
  ],
});
