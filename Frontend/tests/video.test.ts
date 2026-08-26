import { formatSegundos, parseDuracionInput, formatTamanoBytes } from '../src/utils/video';

describe('utilidades de video', () => {
  test.each([
    [0, '0:00'],
    [5, '0:05'],
    [90, '1:30'],
    [3661, '1:01:01'],
  ])('formatea %s segundos como %s', (seconds, expected) => {
    expect(formatSegundos(seconds)).toBe(expected);
  });

  test.each([
    ['1:30', 90],
    ['01:02:03', 3723],
    ['42', 42],
  ])('parsea %s', (input, expected) => {
    expect(parseDuracionInput(input)).toBe(expected);
  });

  test.each(['', 'abc', '1:60', '1:2:60', '1:2:3:4', '-1:00', '1.5'])('rechaza formato inválido %s', (input) => {
    expect(parseDuracionInput(input)).toBeNull();
  });

  test('formatea tamaños y entradas no finitas', () => {
    expect(formatTamanoBytes(0)).toBe('0 B');
    expect(formatTamanoBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatTamanoBytes(Number.NaN)).toBe('0 B');
  });
});
