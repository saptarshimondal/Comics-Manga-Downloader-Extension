import {
  mimeToExtension,
  getPaddedEntryName,
  getExtensionForFormat,
  getMimeForFormat,
} from '../archiveHelpers';

describe('archiveHelpers', () => {
  describe('mimeToExtension', () => {
    it('maps mime to file extension', () => {
      expect(mimeToExtension('jpeg')).toBe('jpg');
      expect(mimeToExtension('png')).toBe('png');
      expect(mimeToExtension('gif')).toBe('gif');
      expect(mimeToExtension('webp')).toBe('webp');
      expect(mimeToExtension(null)).toBe('jpg');
      expect(mimeToExtension('unknown')).toBe('jpg');
    });
  });

  describe('getPaddedEntryName', () => {
    it('produces zero-padded entry names in order (001, 002, ...)', () => {
      expect(getPaddedEntryName(0, 10, 'jpeg')).toBe('001.jpg');
      expect(getPaddedEntryName(1, 10, 'png')).toBe('002.png');
      expect(getPaddedEntryName(9, 10, 'jpeg')).toBe('010.jpg');
    });

    it('uses 3 digits for total <= 999', () => {
      expect(getPaddedEntryName(0, 999, 'jpeg')).toBe('001.jpg');
      expect(getPaddedEntryName(998, 999, 'png')).toBe('999.png');
    });

    it('uses more digits when total > 999', () => {
      expect(getPaddedEntryName(0, 1000, 'jpeg')).toBe('0001.jpg');
      expect(getPaddedEntryName(999, 1000, 'jpeg')).toBe('1000.jpg');
      expect(getPaddedEntryName(0, 10000, 'png')).toBe('00001.png');
    });

    it('preserves order by index', () => {
      const total = 5;
      const names = [];
      for (let i = 0; i < total; i++) names.push(getPaddedEntryName(i, total, 'jpeg'));
      expect(names).toEqual(['001.jpg', '002.jpg', '003.jpg', '004.jpg', '005.jpg']);
    });
  });

  describe('getExtensionForFormat', () => {
    it('returns correct extension for format', () => {
      expect(getExtensionForFormat('pdf')).toBe('pdf');
      expect(getExtensionForFormat('cbz')).toBe('cbz');
      expect(getExtensionForFormat('zip')).toBe('zip');
    });
  });

  describe('getMimeForFormat', () => {
    it('returns correct MIME type for download', () => {
      expect(getMimeForFormat('zip')).toBe('application/zip');
      expect(getMimeForFormat('cbz')).toBe('application/vnd.comicbook+zip');
      expect(getMimeForFormat('pdf')).toBe('application/pdf');
    });
  });
});
