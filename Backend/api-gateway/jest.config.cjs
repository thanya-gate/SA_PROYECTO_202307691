/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  verbose: true,
  collectCoverageFrom: [
    'src/validation/**/*.ts',
    'src/storage/**/*.ts',
    'src/middleware/**/*.ts',
    'src/server.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
