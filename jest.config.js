module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // nanoid@5 ships ESM-only; transform it through ts-jest (which supports .js)
  // instead of leaving it ignored like the rest of node_modules.
  transformIgnorePatterns: ["node_modules/(?!(nanoid)/)"],
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { isolatedModules: true }],
  },
};
