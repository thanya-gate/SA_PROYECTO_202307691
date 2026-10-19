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

describe('utilidades de video: URLs, miniaturas y formatos', () => {
  const { youtubeEmbedUrl, youtubeVideoId, esVideoLocal, thumbnailDeClase, formatDuracion, formatFecha, extraerPrimerMarcador } =
    jest.requireActual('../src/utils/video');

  test('reconoce YouTube y videos propios', () => {
    expect(youtubeEmbedUrl('https://youtu.be/abcdef123')).toBe('https://www.youtube.com/embed/abcdef123');
    expect(youtubeEmbedUrl('')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/watch?v=abcdef123')).toBe('abcdef123');
    expect(youtubeVideoId('https://x.test/a.mp4')).toBeNull();
    expect(esVideoLocal('/media/clases/a.mp4')).toBe(true);
    expect(esVideoLocal('https://storage.googleapis.com/b/clases/a.mp4')).toBe(true);
    expect(esVideoLocal('https://youtu.be/abcdef123')).toBe(false);
    expect(esVideoLocal('')).toBe(false);
  });

  test('deduce la miniatura según el origen', () => {
    expect(thumbnailDeClase('https://youtu.be/abcdef123', 'c1')).toBe('https://i.ytimg.com/vi/abcdef123/hqdefault.jpg');
    expect(thumbnailDeClase('/media/clases/c1.mp4', 'c1')).toBe('/media/thumbnails/c1.jpg');
    expect(thumbnailDeClase('https://x.test/otro.mp4', 'c1')).toBeNull();
    expect(thumbnailDeClase(undefined, 'c1')).toBeNull();
  });

  test('formatea duraciones, fechas y marcadores', () => {
    expect(formatDuracion(0)).toBe('—');
    expect(formatDuracion(5400)).toBe('1 h 30 min');
    expect(formatDuracion(600)).toBe('10 min');
    expect(formatFecha(undefined)).toBe('—');
    expect(formatFecha('no-fecha')).toBe('no-fecha');
    expect(formatFecha('2026-10-01')).toContain('2026');
    expect(extraerPrimerMarcador('ver [01:30] y [02:00]')).toBe(90);
    expect(extraerPrimerMarcador('sin marcas')).toBeNull();
  });
});
