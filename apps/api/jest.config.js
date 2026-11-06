// Jest configuration: TypeScript through ts-jest, tests next to src or under tests/, coverage gate on application code.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  // the app tsconfig only loads node types: add jest's for test files compiled by ts-jest
  globals: { 'ts-jest': { tsconfig: { types: ['node', 'jest'] } } },
  collectCoverageFrom: ['src/**/*.ts', '!src/glue/**', '!**/*.d.ts'],
  coverageThreshold: { global: { statements: 80, lines: 80, functions: 80, branches: 70 } }
};
