// jest.config.cjs
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./", // Path to your Next.js app
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^uuid$": require.resolve('uuid'), // Fix uuid module resolution
  },
  transformIgnorePatterns: [
    "node_modules/(?!(uuid)/)", // Transform uuid module
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/_*.{js,jsx,ts,tsx}",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/pages/_*.{js,jsx,ts,tsx}",
    "!**/node_modules/**",
  ],
  // Memory management
  maxWorkers: 2, // Limit parallel test workers
  workerIdleMemoryLimit: '512MB', // Force worker restart on memory threshold
  // Timeouts
  testTimeout: 10000, // 10 seconds per test
  // Clear mocks between tests to prevent memory leaks
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
};

module.exports = createJestConfig(customJestConfig);
