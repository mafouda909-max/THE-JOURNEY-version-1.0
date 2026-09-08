import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  // mobile/** is excluded: it is a separate package (Expo/React Native) with its own
  // tsconfig and toolchain, checked by the `mobile` CI job instead.
  ...nextCoreWebVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "mobile/**"]),
]);
