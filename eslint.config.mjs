import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Commercetools calls live in services (src/features/*/service.ts), where they can be cached, checked and tested.
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "@/lib/commercetools/client", message: "Call a feature service instead." }] }],
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
