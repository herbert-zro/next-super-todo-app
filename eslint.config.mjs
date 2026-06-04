import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Keep the generated Prisma client (runtime) out of the UI/application/domain
  // layers. Only infrastructure may instantiate it; everyone else goes through a
  // repository. Note: `/models` (types) is intentionally NOT restricted — type
  // imports are erased at build time and are safe for mappers.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/shared/generated/prisma/client",
                "**/generated/prisma/client",
              ],
              message:
                "El PrismaClient solo se instancia en la capa de infraestructura. Usa un repositorio en su lugar.",
            },
          ],
        },
      ],
    },
  },
  // Infrastructure is the composition layer for persistence: it may import the
  // generated client directly.
  {
    files: ["src/**/infrastructure/**", "src/shared/infrastructure/**"],
    rules: { "no-restricted-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Ignore the generated Prisma client entirely.
    "src/shared/generated/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
