import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const sharedIsomorphicRules = {
  files: ["src/shared/**/*.ts", "src/shared/**/*.tsx"],
  ignores: ["src/shared/**/*.test.ts", "src/shared/env/public-env.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/server", "@/server/*"],
            message: "src/shared must not import server-only code.",
          },
          {
            group: ["node:*"],
            message: "No Node builtins in src/shared (use src/server).",
          },
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[object.name='process'][property.name='env']",
        message:
          "Do not read process.env in src/shared; use @/shared/env/public-env.",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  sharedIsomorphicRules,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
