/**
 * Unit tests for image fetch retry and validation (no real network).
 */

import {
  validateImageBytes,
  isRetryableStatus,
  fetchImageWithRetry
} from '../imageFetch.js';

describe('validateImageBytes', () => {
  it('rejects empty arrayBuffer with reason', () => {
    const result = validateImageBytes(new ArrayBuffer(0));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/empty|0 bytes/);
  });

  it('accepts JPEG signature (FF D8 FF)', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00]);
    const result = validateImageBytes(jpeg.buffer);
    expect(result.valid).toBe(true);
    expect(result.mime).toBe('jpeg');
  });

  it('accepts PNG signature', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = validateImageBytes(png.buffer);
    expect(result.valid).toBe(true);
    expect(result.mime).toBe('png');
  });

  it('accepts non-empty unknown format as jpeg (default)', () => {
    const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = validateImageBytes(unknown.buffer);
    expect(result.valid).toBe(true);
    expect(result.mime).toBe('jpeg');
  });
});

describe('isRetryableStatus', () => {
  it('retries 429', () => expect(isRetryableStatus(429)).toBe(true));
  it('retries 5xx', () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });
  it('does not retry 4xx (except 429)', () => {
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
  });
  it('does not retry 2xx', () => expect(isRetryableStatus(200)).toBe(false));
});

describe('fetchImageWithRetry', () => {
  const testUrl = 'https://example.com/image.jpg';

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('throws after maxAttempts when response is always 200 with empty body', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
    });

    const err = await fetchImageWithRetry(testUrl, { maxAttempts: 3, timeoutMs: 5000 }).catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/empty body|0 bytes|failed after 3 attempts/);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(err.detail).toBeDefined();
    expect(err.detail.byteLength).toBe(0);
    expect(err.detail.url).toBe(testUrl);
  });

  it('succeeds on second attempt after 500 then 200 with valid body', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(jpegBytes.buffer.slice(0))
      });

    const result = await fetchImageWithRetry(testUrl, { maxAttempts: 3, timeoutMs: 5000 });

    expect(result).toHaveProperty('mime', 'jpeg');
    expect(result.data).toMatch(/^data:image\/jpeg;base64,/);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 404', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
    });

    await expect(fetchImageWithRetry(testUrl, { maxAttempts: 3, timeoutMs: 5000 }))
      .rejects.toThrow(/404/);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns valid data when 200 with non-empty JPEG body', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03]);
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(jpegBytes.buffer.slice(0))
    });

    const result = await fetchImageWithRetry(testUrl, { maxAttempts: 1, timeoutMs: 5000 });

    expect(result.mime).toBe('jpeg');
    expect(result.data.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
