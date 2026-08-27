/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  verbose: true,
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        jsx: 'react-jsx',
        isolatedModules: false,
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/tests/styleMock.cjs',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'src/utils/video.ts',
    'src/api/catalog.ts',
    'src/api/materiales.ts',
    'src/components/ChapterManager.tsx',
    'src/components/ChapterTimeline.tsx',
    '!src/main.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
