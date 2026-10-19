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
    // El adaptador SQL se valida contra PostgreSQL real con tests/run-sql-contract.sh (integración).
    'src/interfaces/grpc/server.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Fase 3: el pipeline se corta si la cobertura unitaria baja del 75%.
  coverageThreshold: { global: { lines: 75, statements: 75 } },
};
