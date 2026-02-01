import { sanitizeFileName, getOverlayTitleForDownloadFormat, normalizeImageUrl, deduplicateImageUrls, detectImageType, isLikelyHtml } from '../helpers';

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

describe('detectImageType', () => {
  it('detects JPEG by magic bytes FF D8 FF', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]);
    expect(detectImageType(bytes)).toBe('jpeg');
    expect(detectImageType(bytes.buffer)).toBe('jpeg');
  });

  it('detects PNG by magic bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectImageType(bytes)).toBe('png');
  });

  it('detects GIF (GIF87a)', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(detectImageType(bytes)).toBe('gif');
  });

  it('detects WebP (RIFF....WEBP)', () => {
    const bytes = new Uint8Array(12);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    bytes.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(detectImageType(bytes)).toBe('webp');
  });

  it('returns unknown for empty or short buffer', () => {
    expect(detectImageType(new Uint8Array(0))).toBe('unknown');
    expect(detectImageType(new Uint8Array([0x00, 0x00]))).toBe('unknown');
  });

  it('returns unknown for non-image bytes', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(detectImageType(bytes)).toBe('unknown');
  });

  it('detects AVIF (ftyp avif)', () => {
    const bytes = new Uint8Array(12);
    bytes.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
    bytes.set([0x61, 0x76, 0x69, 0x66], 8); // avif
    expect(detectImageType(bytes)).toBe('avif');
  });
});

describe('isLikelyHtml', () => {
  it('returns true for bytes starting with <!DOCTYPE', () => {
    const bytes = new Uint8Array([...'<!DOCTYPE html>'].map(c => c.charCodeAt(0)));
    expect(isLikelyHtml(bytes)).toBe(true);
  });

  it('returns true for bytes starting with <html', () => {
    const bytes = new Uint8Array([...'<html lang="en">'].map(c => c.charCodeAt(0)));
    expect(isLikelyHtml(bytes)).toBe(true);
  });

  it('returns true for bytes starting with <HTML', () => {
    const bytes = new Uint8Array([...'<HTML>'].map(c => c.charCodeAt(0)));
    expect(isLikelyHtml(bytes)).toBe(true);
  });

  it('returns false for JPEG magic bytes', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    expect(isLikelyHtml(bytes)).toBe(false);
  });

  it('returns false for PNG magic bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(isLikelyHtml(bytes)).toBe(false);
  });
});
