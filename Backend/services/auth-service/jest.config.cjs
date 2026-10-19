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
    'src/infrastructure/auth/**/*.ts',
    'src/infrastructure/oauth/**/*.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Fase 3: el pipeline se corta si la cobertura unitaria baja del 75%.
  coverageThreshold: { global: { lines: 75, statements: 75 } },
};
