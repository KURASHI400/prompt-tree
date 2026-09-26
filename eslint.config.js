import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "node_modules/**",
      "work/**",
      ".pnpm-store/**",
      "dist/**",
      "dist-worker/**",
      "dist-worker-production/**",
      ".wrangler/**",
      "test-results/**",
      "playwright-report/**",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
