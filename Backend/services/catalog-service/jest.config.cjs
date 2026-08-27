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
    'src/application/dto/**/*.ts',
    'src/application/services/**/*.ts',
    'src/infrastructure/persistence/postgres/postgres-catalog-repository.ts',
    'src/interfaces/grpc/server.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
