import { sanitizeFileName, getOverlayTitleForDownloadFormat, normalizeImageUrl, deduplicateImageUrls } from '../helpers';

describe('getOverlayTitleForDownloadFormat', () => {
  it('returns correct overlay label for PDF', () => {
    expect(getOverlayTitleForDownloadFormat('pdf')).toBe('Downloading PDF...');
  });

  it('returns correct overlay label for CBZ (closing/reopening modal retains label)', () => {
    expect(getOverlayTitleForDownloadFormat('cbz')).toBe('Downloading CBZ...');
  });

  it('returns correct overlay label for ZIP (closing/reopening modal retains label)', () => {
    expect(getOverlayTitleForDownloadFormat('zip')).toBe('Downloading ZIP...');
  });

  it('defaults to PDF for invalid or missing format', () => {
    expect(getOverlayTitleForDownloadFormat(null)).toBe('Downloading PDF...');
    expect(getOverlayTitleForDownloadFormat(undefined)).toBe('Downloading PDF...');
    expect(getOverlayTitleForDownloadFormat('')).toBe('Downloading PDF...');
    expect(getOverlayTitleForDownloadFormat('invalid')).toBe('Downloading PDF...');
  });
});

describe('sanitizeFileName', () => {
  it('returns empty string for null/empty', () => {
    expect(sanitizeFileName('')).toBe('');
    expect(sanitizeFileName(null)).toBe('');
    expect(sanitizeFileName(undefined)).toBe('');
  });

  it('removes invalid filesystem characters', () => {
    expect(sanitizeFileName('a<b>c:d"e/f\\g|h?i*j')).toBe('abcdefghij');
    expect(sanitizeFileName('file<>name')).toBe('filename');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeFileName('  foo   bar  ')).toBe('foo bar');
    expect(sanitizeFileName('\t\n  name  \t')).toBe('name');
  });

  it('avoids Windows reserved names', () => {
    expect(sanitizeFileName('CON')).toBe('_CON');
    expect(sanitizeFileName('con.txt')).toBe('_con.txt');
    expect(sanitizeFileName('NUL')).toBe('_NUL');
  });

  it('trims length to 200 chars', () => {
    const long = 'a'.repeat(250);
    expect(sanitizeFileName(long).length).toBeLessThanOrEqual(200);
  });

  it('produces safe predictable names', () => {
    expect(sanitizeFileName('My Comic Title')).toBe('My Comic Title');
    expect(sanitizeFileName('chapter: 1')).toBe('chapter 1');
    expect(sanitizeFileName('download')).toBe('download');
  });

  it('returns "download" when result would be empty', () => {
    expect(sanitizeFileName('  <>:"/\\|?*  ')).toBe('download');
  });
});

describe('normalizeImageUrl', () => {
  const base = 'https://example.com/page';

  it('returns null for empty or invalid input', () => {
    expect(normalizeImageUrl('', base)).toBe(null);
    expect(normalizeImageUrl('   ', base)).toBe(null);
    expect(normalizeImageUrl(null, base)).toBe(null);
    expect(normalizeImageUrl(undefined, base)).toBe(null);
  });

  it('trims whitespace and resolves relative URLs', () => {
    expect(normalizeImageUrl('  a.jpg  ', base)).toBe('https://example.com/a.jpg');
    expect(normalizeImageUrl('img/b.jpg', base)).toBe('https://example.com/img/b.jpg');
  });

  it('returns absolute URLs as-is (normalized)', () => {
    expect(normalizeImageUrl('https://cdn.example.com/pic.png', base)).toBe('https://cdn.example.com/pic.png');
  });

  it('returns data URIs trimmed only', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQ';
    expect(normalizeImageUrl(dataUri, base)).toBe(dataUri);
    expect(normalizeImageUrl('  ' + dataUri + '  ', base)).toBe(dataUri);
  });
});

describe('deduplicateImageUrls', () => {
  const base = 'https://example.com/';

  it('removes duplicate URLs; first occurrence wins', () => {
    const result = deduplicateImageUrls(['a.jpg', 'a.jpg', 'b.jpg'], base);
    expect(result).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  it('preserves order and keeps single occurrence', () => {
    expect(deduplicateImageUrls(['x.png', 'y.png', 'x.png'], base)).toEqual(['https://example.com/x.png', 'https://example.com/y.png']);
  });

  it('skips empty/invalid URLs', () => {
    const result = deduplicateImageUrls(['a.jpg', '', 'a.jpg', '  ', 'b.jpg'], base);
    expect(result).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });
});
