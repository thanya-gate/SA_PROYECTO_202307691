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
    'src/federation/**/*.ts',
    'src/academix/**/*.ts',
    'src/server.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Fase 3: el pipeline se corta si la cobertura unitaria baja del 75%.
  coverageThreshold: { global: { lines: 75, statements: 75 } },
};
