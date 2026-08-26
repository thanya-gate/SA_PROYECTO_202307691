import '@testing-library/jest-dom';

Object.defineProperty(globalThis, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'blob:test'),
    revokeObjectURL: jest.fn(),
  },
  configurable: true,
});
