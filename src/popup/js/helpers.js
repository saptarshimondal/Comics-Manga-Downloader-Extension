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