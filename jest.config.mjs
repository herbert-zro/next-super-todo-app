import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Path to the Next.js app to load next.config and .env files in the test environment
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  // Domain/application code is framework-free, so a Node environment is enough.
  // Switch to "jsdom" only when adding component tests.
  testEnvironment: "node",
  // Mirror the "@/*" -> "./src/*" alias from tsconfig.json.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

// createJestConfig is exported this way to ensure next/jest can load the
// Next.js config (which is async) before applying our overrides.
export default createJestConfig(config);
