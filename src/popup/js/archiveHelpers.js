/**
 * Pure helpers for archive (ZIP/CBZ) entry naming and MIME/extension.
 * Used by content script and testable in isolation.
 */

export const mimeToExtension = (mime) => {
  if (!mime) return 'jpg';
  const m = (String(mime)).toLowerCase().replace('jpeg', 'jpg');
  if (['jpg', 'png', 'gif', 'webp'].includes(m)) return m;
  if (m === 'jpeg') return 'jpg';
  return 'jpg';
};

/**
 * Zero-padded entry name for archive (deterministic order).
 * @param {number} index - 0-based index
 * @param {number} totalCount - total number of entries
 * @param {string} mime - mime type (e.g. jpeg, png)
 * @returns {string} e.g. "001.jpg", "002.png"; 4+ digits if totalCount > 999
 */
export const getPaddedEntryName = (index, totalCount, mime) => {
  const padLen = totalCount <= 999 ? 3 : String(totalCount).length;
  const ext = mimeToExtension(mime);
  return String(index + 1).padStart(padLen, '0') + '.' + ext;
};

/** File extension for download format (no leading dot). */
export const getExtensionForFormat = (format) => {
  if (format === 'cbz') return 'cbz';
  if (format === 'zip') return 'zip';
  return 'pdf';
};

/** MIME type for download format. */
export const getMimeForFormat = (format) => {
  if (format === 'cbz') return 'application/vnd.comicbook+zip';
  if (format === 'zip') return 'application/zip';
  return 'application/pdf';
};
