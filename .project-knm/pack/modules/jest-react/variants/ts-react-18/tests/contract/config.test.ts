/** @jest-environment node */
const config = require('../../files/jest.config.js');

describe('jest config contract', () => {
  it('runs React tests in jsdom with the setup file and a coverage gate that leaves out the glue', () => {
    expect(config.testEnvironment).toBe('jsdom');
    expect(config.testMatch).toEqual(['**/*.test.ts', '**/*.test.tsx']);
    expect(config.transform['^.+\\.tsx?$']).toBe('ts-jest');
    expect(config.setupFilesAfterEnv).toEqual(['<rootDir>/src/testing/setup.ts']);
    expect(config.collectCoverageFrom.join(' ')).toMatch(/!src\/app\/\{providers,router,theme,config\}/);
    expect(config.coverageThreshold.global).toMatchObject({ statements: 80, lines: 80, functions: 80 });
  });
});
