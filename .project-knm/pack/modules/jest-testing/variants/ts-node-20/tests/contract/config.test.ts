const config = require('../../files/jest.config.js');

describe('jest config contract', () => {
  it('runs TypeScript tests in node and gates coverage on application code', () => {
    expect(config.testEnvironment).toBe('node');
    expect(config.testMatch).toEqual(['**/*.test.ts']);
    expect(config.transform['^.+\\.ts$']).toBe('ts-jest');
    expect(config.collectCoverageFrom).toContain('src/**/*.ts');
    expect(config.collectCoverageFrom).toContain('!src/glue/**');   // scaffold glue is not application logic
    expect(config.coverageThreshold.global).toMatchObject({ statements: 80, lines: 80, functions: 80 });
  });
});
