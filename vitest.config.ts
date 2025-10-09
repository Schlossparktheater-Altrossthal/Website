import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [...configDefaults.exclude, "realtime-server/**", "e2e/**"],
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^react-easy-crop$/,
        replacement: path.resolve(__dirname, "./src/test/mocks/react-easy-crop"),
      },
      {
        find: /^react-easy-crop\/react-easy-crop\.css$/,
        replacement: path.resolve(__dirname, "./src/test/mocks/react-easy-crop.css"),
      },
    ],
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
});
