/**
 * Robust image fetch with retry, timeout, and validation.
 * Only considers a fetch successful when response has non-empty bytes and valid image signature.
 */

export const DEFAULT_TIMEOUT_MS = 25000;
export const DEFAULT_MAX_ATTEMPTS = 3;

// Backoff delays (ms) for attempts 1, 2, 3 (first attempt has no delay)
const BACKOFF_MS = [250, 750, 1750];

const IMAGE_SIGNATURES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  gif: [0x47, 0x49, 0x46], // GIF
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF - need to check bytes 8-11 for WEBP
};

function bytesMatch(bytes, offset, signature) {
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Validate arrayBuffer: non-empty and optional lightweight image signature sniff.
 * @returns {{ valid: boolean, mime: string, reason?: string }}
 */
export function validateImageBytes(arrayBuffer) {
  const byteLength = arrayBuffer.byteLength;
  if (byteLength === 0) {
    return { valid: false, mime: 'jpeg', reason: 'empty body (0 bytes)' };
  }

  const bytes = new Uint8Array(arrayBuffer);

  if (bytesMatch(bytes, 0, IMAGE_SIGNATURES.jpeg)) {
    return { valid: true, mime: 'jpeg' };
  }
  if (bytesMatch(bytes, 0, IMAGE_SIGNATURES.png)) {
    return { valid: true, mime: 'png' };
  }
  if (bytesMatch(bytes, 0, IMAGE_SIGNATURES.gif)) {
    return { valid: true, mime: 'gif' };
  }
  if (bytesMatch(bytes, 0, IMAGE_SIGNATURES.webp) && byteLength >= 12 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { valid: true, mime: 'webp' };
  }

  // Unknown but non-empty: accept and default to jpeg (existing behavior)
  return { valid: true, mime: 'jpeg' };
}

/**
 * @param {number} status
 * @returns {boolean} true if we should retry (429 or 5xx)
 */
export function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Sleep for ms with optional jitter (±20%).
 */
function sleep(ms, jitter = true) {
  const t = jitter ? ms * (0.8 + 0.4 * Math.random()) : ms;
  return new Promise((resolve) => setTimeout(resolve, Math.round(t)));
}

/**
 * Encode ArrayBuffer to base64 data URI.
 */
function arrayBufferToBase64DataUri(arrayBuffer, mime) {
  const bytes = new Uint8Array(arrayBuffer);
  const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  const base64 = btoa(binary);
  const normalizedMime = mime === 'jpg' ? 'jpeg' : mime;
  return `data:image/${normalizedMime};base64,${base64}`;
}

/**
 * Optional decode check: createImageBitmap(blob). Rejects if image cannot be decoded.
 * No-op if createImageBitmap is not available (e.g. some workers).
 */
function decodeImageBlob(blob) {
  if (typeof createImageBitmap !== 'function') return Promise.resolve();
  return createImageBitmap(blob);
}

/**
 * Fetch image with timeout, retries, and validation.
 * Only resolves when body is non-empty and passes signature check (and optional decode).
 *
 * @param {string} url
 * @param {{ timeoutMs?: number, maxAttempts?: number, signal?: AbortSignal }} options
 * @returns {Promise<{ mime: string, data: string }>}
 * @throws Error with .detail = { url, byteLength, statusCode, attempt, reason } for UI
 */
export async function fetchImageWithRetry(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const signal = options.signal;

  let lastStatus = null;
  let lastByteLength = null;
  let lastReason = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    const fetchSignal = controller.signal;

    try {
      const startTime = Date.now();
      if (attempt > 1) {
        console.warn(`Background image fetch: retry attempt ${attempt}/${maxAttempts} for ${url}, reason: ${lastReason}`);
      }

      const response = await fetch(url, { method: 'GET', cache: 'default', signal: fetchSignal });

      lastStatus = response.status;

      if (!response.ok) {
        const body = await response.arrayBuffer().catch(() => new ArrayBuffer(0));
        lastByteLength = body.byteLength;
        lastReason = `HTTP ${response.status}`;
        if (!isRetryableStatus(response.status)) {
          const err = new Error(`Image fetch failed: HTTP ${response.status}`);
          err.detail = { url, byteLength: lastByteLength, statusCode: response.status, attempt, reason: lastReason };
          throw err;
        }
        if (attempt === maxAttempts) {
          const err = new Error(`Image fetch failed after ${maxAttempts} attempts: ${lastReason}`);
          err.detail = { url, byteLength: lastByteLength, statusCode: response.status, attempt, reason: lastReason };
          throw err;
        }
        await sleep(BACKOFF_MS[attempt - 1]);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();

      lastByteLength = arrayBuffer.byteLength;

      const validation = validateImageBytes(arrayBuffer);
      if (!validation.valid) {
        lastReason = validation.reason || 'validation failed';
        if (attempt === maxAttempts) {
          const err = new Error(`Image fetch failed after ${maxAttempts} attempts: ${lastReason} (${lastByteLength} bytes)`);
          err.detail = { url, byteLength: lastByteLength, statusCode: lastStatus, attempt, reason: lastReason };
          throw err;
        }
        await sleep(BACKOFF_MS[attempt - 1]);
        continue;
      }

      // Optional decode check (catches corrupt/partial images)
      const blob = new Blob([arrayBuffer], { type: `image/${validation.mime}` });
      try {
        await decodeImageBlob(blob);
      } catch (decodeErr) {
        lastReason = `decode failed: ${decodeErr?.message || 'unknown'}`;
        if (attempt === maxAttempts) {
          const err = new Error(`Image fetch failed after ${maxAttempts} attempts: ${lastReason}`);
          err.detail = { url, byteLength: lastByteLength, statusCode: lastStatus, attempt, reason: lastReason };
          throw err;
        }
        await sleep(BACKOFF_MS[attempt - 1]);
        continue;
      }

      const data = arrayBufferToBase64DataUri(arrayBuffer, validation.mime);
      const elapsed = Date.now() - startTime;
      console.log(`Background image fetch: success in ${elapsed}ms, ${lastByteLength} bytes, mime: ${validation.mime}`);
      return { mime: validation.mime === 'jpg' ? 'jpeg' : validation.mime, data };
    } catch (err) {
      lastReason = err.message || 'network error';
      if (err.name === 'AbortError') {
        const e = new Error('Image fetch cancelled');
        e.detail = { url, byteLength: lastByteLength, statusCode: lastStatus, attempt, reason: 'aborted' };
        throw e;
      }
      // Do not retry on deterministic 4xx (except 429)
      if (err.detail?.statusCode != null && !isRetryableStatus(err.detail.statusCode)) {
        throw err;
      }
      if (attempt === maxAttempts) {
        const e = new Error(`Image fetch failed after ${maxAttempts} attempts: ${lastReason}`);
        e.detail = { url, byteLength: lastByteLength ?? 0, statusCode: lastStatus, attempt, reason: lastReason };
        throw e;
      }
      await sleep(BACKOFF_MS[attempt - 1]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const err = new Error(`Image fetch failed after ${maxAttempts} attempts: ${lastReason}`);
  err.detail = { url, byteLength: lastByteLength ?? 0, statusCode: lastStatus, attempt: maxAttempts, reason: lastReason };
  throw err;
}
