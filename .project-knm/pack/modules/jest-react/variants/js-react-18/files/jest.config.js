// Jest for a React app: jsdom, JavaScript/JSX transpiled by ts-jest (allowJs), Testing Library matchers and polyfills from
// src/testing/setup.js, coverage gate on application code (scaffold glue excluded).
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.test.jsx'],
  transform: { '^.+\\.jsx?$': ['ts-jest', { tsconfig: { allowJs: true, jsx: 'react-jsx', module: 'commonjs', esModuleInterop: true }, diagnostics: false }] },
  setupFilesAfterEnv: ['<rootDir>/src/testing/setup.js'],
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/app/{providers,router,theme,config}.{js,jsx}', '!src/main.jsx'],
  coverageThreshold: { global: { statements: 80, lines: 80, functions: 80, branches: 70 } }
};
