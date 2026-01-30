import { sanitizeFileName } from '../helpers';

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
