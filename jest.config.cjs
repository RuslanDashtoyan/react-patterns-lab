/** @type {import('jest').Config} */
module.exports = {
  // jsdom = a fake browser environment inside Node, so `render()` has a `document` to attach to.
  testEnvironment: "jsdom",

  // Runs after the test framework is set up, before each test file.
  // We use it to enable the extra `toBeInTheDocument()`-style matchers.
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // The project imports things like `~/hooks` — map that alias the same way tsconfig does.
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/app/$1",
  },

  // Only look at files ending in .test.ts(x)/.spec.ts(x) as test files.
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
};
