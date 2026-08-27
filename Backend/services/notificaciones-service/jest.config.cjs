/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup-env.cjs'],
  clearMocks: true,
  verbose: true,
  collectCoverageFrom: [
    'src/application/**/*.ts',
    'src/domain/**/*.ts',
    'src/infrastructure/worker/**/*.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
