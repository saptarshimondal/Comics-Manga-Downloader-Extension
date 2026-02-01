export const dump = function (variable, type = false) {
    const op = JSON.stringify(variable, null, 4)
    console.log(type ? `(${typeof variable}) ${op}` : op)
}

export const hasSomeParentTheClass = function(element, classname) {
    try {
        if (element.className.split(' ').indexOf(classname)>=0) return true;
        return element.parentNode && hasSomeParentTheClass(element.parentNode, classname);
    } catch(e) {        
        // console.log(e);
        return false
    }
}

export const triggerEvent = function (el, type) {
    // IE9+ and other modern browsers
    if ('createEvent' in document) {
        var e = document.createEvent('HTMLEvents');
        e.initEvent(type, false, true);
        el.dispatchEvent(e);
    } else {
        // IE8
        var e = document.createEventObject();
        e.eventType = type;
        el.fireEvent('on' + e.eventType, e);
    }
}


export const srcType = (src) => {
    return src.startsWith("data") ? 'data' : 'url';
}


const formats={
    png: "iVBORw0KGgo=",
    jpeg: "/9g=",
    gif: "R0lG",
    "svg+xml": "PA=="
};
const defaultFormat="png";

const bytesToBase64=byteArray=>
    btoa(byteArray.reduce((a,e)=>a+String.fromCharCode(e),""))

const getFormat=byteArray=>{
    for(let format in formats){
        let header=formats[format];
        
        if(bytesToBase64(byteArray.slice(0,atob(header).length))==header){
            return format;
        }
    }
    return defaultFormat;
};

export const getBase64Image = async (srcUrl) => {
    try {
        let response=await fetch(srcUrl,{
            method:"GET",
            mode:"cors",
            cache:"default"
        });
        let arrayBuffer=await response.arrayBuffer();
        let bytes=[].slice.call(new Uint8Array(arrayBuffer));
        
        if(!bytes.length) {
            return {
                "mime": null, 
                "data": null
            };
        }
        
        const format = getFormat(bytes);
        // Ensure we have a valid format, default to jpeg if unknown
        const mime = format && format !== 'UNKNOWN' ? format : 'jpeg';
        let base64=`data:image/${mime};base64,`+bytesToBase64(bytes);

        return {
            "mime": mime, 
            "data": base64
        };
    } catch (error) {
        console.error('Error fetching image:', error);
        return {
            "mime": null,
            "data": null
        };
    }
}

export const calculateAspectRatioFit = (srcWidth, srcHeight, maxWidth, maxHeight) => {

    var ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);

    return { width: srcWidth*ratio, height: srcHeight*ratio };
}

/**
 * Sanitize a string for use as a filesystem-safe filename.
 * Removes invalid characters, collapses whitespace, avoids reserved names, and trims length.
 * @param {string} fileName - Raw filename (no path, extension optional)
 * @returns {string} Sanitized base name safe for Windows, Linux, macOS
 */
export const sanitizeFileName = (fileName) => {
    if (!fileName || typeof fileName !== 'string') return '';
    // Remove invalid characters for Windows, Linux, macOS
    let sanitized = fileName
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/[\x7F-\x9F]/g, '');
    sanitized = sanitized.replace(/[\s\t]+/g, ' ').trim();
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
    const reservedNames = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
    if (nameWithoutExt && reservedNames.includes(nameWithoutExt)) {
        sanitized = '_' + sanitized;
    }
    const maxLength = 200;
    if (sanitized.length > maxLength) {
        const lastDot = sanitized.lastIndexOf('.');
        if (lastDot > 0 && lastDot < sanitized.length - 1) {
            const ext = sanitized.substring(lastDot);
            const name = sanitized.substring(0, lastDot);
            sanitized = name.substring(0, maxLength - ext.length) + ext;
        } else {
            sanitized = sanitized.substring(0, maxLength);
        }
    }
    if (!sanitized || sanitized.trim() === '') {
        sanitized = 'download';
    }
    return sanitized;
};

/**
 * Overlay title text for the active download format (used when showing/restoring overlay).
 * Ensures label reflects actual download type (PDF/CBZ/ZIP) when popup is reopened mid-download.
 * @param {string} format - 'pdf' | 'cbz' | 'zip'
 * @returns {string} e.g. "Downloading PDF...", "Downloading CBZ...", "Downloading ZIP..."
 */
export const getOverlayTitleForDownloadFormat = (format) => {
    const f = (format && ['pdf', 'cbz', 'zip'].includes(format)) ? format : 'pdf';
    return f === 'pdf' ? 'Downloading PDF...' : `Downloading ${f.toUpperCase()}...`;
};

/**
 * Normalize an image URL for deduplication: trim whitespace, convert relative to absolute.
 * @param {string} src - Image URL (relative, absolute, or data URI)
 * @param {string} baseHref - Base URL for resolving relative URLs (e.g. location.href)
 * @returns {string|null} Normalized absolute URL or data URI, or null if empty/invalid
 */
export const normalizeImageUrl = (src, baseHref) => {
    if (src == null || typeof src !== 'string') return null;
    const trimmed = src.trim();
    if (trimmed === '') return null;
    if (trimmed.startsWith('data:')) return trimmed;
    try {
        return new URL(trimmed, baseHref).href;
    } catch {
        return null;
    }
};

/**
 * Deduplicate an array of image URLs by normalized URL (first occurrence wins).
 * @param {string[]} urls - Array of image URLs (may be relative or absolute)
 * @param {string} baseHref - Base URL for resolving relative URLs
 * @returns {string[]} Unique normalized URLs in stable order
 */
export const deduplicateImageUrls = (urls, baseHref) => {
    const seen = new Set();
    const result = [];
    for (const u of urls) {
        const n = normalizeImageUrl(u, baseHref);
        if (n != null && !seen.has(n)) {
            seen.add(n);
            result.push(n);
        }
    }
    return result;
};

/**
 * Detect image type from magic bytes (not URL or Content-Type).
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {'jpeg'|'png'|'webp'|'gif'|'avif'|'unknown'}
 */
export function detectImageType(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const n = u.length;

  if (n < 3) return 'unknown';
  // JPEG: FF D8 FF
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (n >= 8 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47 &&
      u[4] === 0x0d && u[5] === 0x0a && u[6] === 0x1a && u[7] === 0x0a) return 'png';
  // GIF: GIF87a or GIF89a
  if (n >= 6 && u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46 &&
      u[3] === 0x38 && (u[4] === 0x37 || u[4] === 0x39) && u[5] === 0x61) return 'gif';
  // WebP: RIFF....WEBP (bytes 0-3 RIFF, 8-11 WEBP)
  if (n >= 12 && u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 &&
      u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return 'webp';
  // AVIF: ISO BMFF - ftyp at 4, then brand avif/avis at 8
  if (n >= 12 && u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70) {
    const brand = String.fromCharCode(u[8], u[9], u[10], u[11]);
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  return 'unknown';
}

/**
 * Heuristic: response looks like HTML (anti-bot / login / 403 page).
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {boolean}
 */
export function isLikelyHtml(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const n = Math.min(u.length, 512);
  let start = 0;
  // Skip BOM
  if (u.length >= 3 && u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) start = 3;
  for (let i = start; i <= n - 4; i++) {
    const c = u[i];
    if (c === 0x3c) { // '<'
      if (u[i + 1] === 0x21 && u[i + 2] === 0x44 && u[i + 3] === 0x4f) return true; // <!DO
      if (u[i + 1] === 0x68 && u[i + 2] === 0x74 && u[i + 3] === 0x6d) return true; // <htm
      if (u[i + 1] === 0x48 && u[i + 2] === 0x54 && u[i + 3] === 0x4d) return true; // <HTM
    }
  }
  return false;
}

export const getBase64ImageMime = (data) => {
    try {
        if (!data || typeof data !== 'string') {
            return null;
        }
        // Extract mime type from data URI: data:image/jpeg;base64,...
        const mimeMatch = data.match(/data:image\/([^;]+)/);
        if (mimeMatch && mimeMatch[1]) {
            const mime = mimeMatch[1].toLowerCase();
            // Validate mime type - jsPDF supports: jpeg, png, webp
            const validMimes = ['jpeg', 'jpg', 'png', 'webp'];
            if (validMimes.includes(mime) || validMimes.includes(mime.replace('jpeg', 'jpg'))) {
                return mime === 'jpg' ? 'jpeg' : mime; // Normalize jpg to jpeg
            }
        }
        // Fallback: try to extract from the format we have
        const parts = data.split(';')[0].split('/');
        if (parts.length > 1) {
            const extracted = parts[parts.length - 1].toLowerCase();
            if (extracted && extracted !== 'base64') {
                return extracted === 'jpg' ? 'jpeg' : extracted;
            }
        }
        return null;
    } catch (error) {
        console.error('Error extracting mime type:', error);
        return null;
    }
}