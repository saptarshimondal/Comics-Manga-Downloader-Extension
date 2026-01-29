import { getBase64Image, getBase64ImageMime } from '../popup/js/helpers';


const getImagesData = async (images, progressCallback) => {
  let image = undefined,
      mime = undefined;
  
  // Only count checked images for progress tracking
  const checkedImages = images.filter(img => img.checked);
  const total = checkedImages.length;
  let processed = 0;

  const promises = images.map(async ({src, type, checked}, index) => {

    if(type === 'url'){

      // Only process checked images
      if (!checked) {
        return null;
      }
      
      image = await getBase64Image(src)
      
      // Ensure we have valid image data
      if (!image || !image.data) {
        console.warn(`Skipping image: invalid image data`);
        processed++;
        if (progressCallback && total > 0) {
          const progress = Math.round((processed / total) * 100);
          progressCallback(progress, `Processing image ${processed} of ${total}...`);
        }
        return null;
      }
      
      // Ensure valid mime type, default to jpeg if missing or unknown
      let mime = image.mime;
      if (!mime || mime === 'UNKNOWN' || mime === null) {
        // Try to extract from data URI
        const mimeMatch = image.data.match(/data:image\/([^;]+)/);
        if (mimeMatch && mimeMatch[1]) {
          mime = mimeMatch[1].toLowerCase();
          if (mime === 'jpg') mime = 'jpeg';
        } else {
          // Default to jpeg if we can't determine
          mime = 'jpeg';
          // Update the data URI to include the mime type
          image.data = image.data.replace(/data:image\/[^;]+/, `data:image/${mime}`);
        }
      }
      
      processed++;
      if (progressCallback && total > 0) {
        const progress = Math.round((processed / total) * 100);
        progressCallback(progress, `Processing image ${processed} of ${total}...`);
      }
      
      return {
        'src': image.data,
        'mime': mime,
        'type': type,
        'checked': checked
      }
    }
    else{ 
      // Only process checked images
      if (!checked) {
        return null;
      }
      
      mime = getBase64ImageMime(src);
      
      // If mime type detection failed, try to extract from data URI or default to jpeg
      if (!mime || mime === 'UNKNOWN' || mime === null) {
        const mimeMatch = src.match(/data:image\/([^;]+)/);
        if (mimeMatch && mimeMatch[1]) {
          mime = mimeMatch[1].toLowerCase();
          if (mime === 'jpg') mime = 'jpeg';
        } else {
          // Default to jpeg if we can't determine
          mime = 'jpeg';
        }
      }
      
      processed++;
      if (progressCallback && total > 0) {
        const progress = Math.round((processed / total) * 100);
        progressCallback(progress, `Processing image ${processed} of ${total}...`);
      }
      
      return {src, mime, type, checked};
    }
  });

  const results = await Promise.all(promises);
  // Filter out null values (unchecked or invalid images)
  return results.filter(img => img !== null);
}


// Helper function for background script to fetch images (can bypass CORS)
const fetchImageInBackground = async (srcUrl) => {
  try {
    // Background scripts can make cross-origin requests
    // Try without CORS mode first (background scripts have special privileges)
    let response = await fetch(srcUrl, {
      method: "GET",
      cache: "default"
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    let arrayBuffer = await response.arrayBuffer();
    let bytes = [].slice.call(new Uint8Array(arrayBuffer));
    
    if (!bytes.length) {
      return {
        "mime": null, 
        "data": null
      };
    }
    
    // Determine format from bytes
    const formats = {
      png: "iVBORw0KGgo=",
      jpeg: "/9g=",
      gif: "R0lG",
      "svg+xml": "PA=="
    };
    const defaultFormat = "jpeg";
    
    const bytesToBase64 = (byteArray) =>
      btoa(byteArray.reduce((a, e) => a + String.fromCharCode(e), ""));
    
    const getFormat = (byteArray) => {
      for (let format in formats) {
        let header = formats[format];
        if (bytesToBase64(byteArray.slice(0, atob(header).length)) == header) {
          return format;
        }
      }
      return defaultFormat;
    };
    
    const format = getFormat(bytes);
    const mime = format && format !== 'UNKNOWN' ? format : 'jpeg';
    let base64 = `data:image/${mime};base64,` + bytesToBase64(bytes);
    
    return {
      "mime": mime, 
      "data": base64
    };
  } catch (error) {
    console.error('Background script: Error fetching image:', error);
    throw error;
  }
};

const DOWNLOAD_STATE_BY_TAB_KEY = 'downloadStateByTab';

// Clear a tab's download state in storage (so reopening that tab's popup won't show stale overlay)
const clearDownloadStateForTab = (tabId) => {
  if (tabId == null) return;
  browser.storage.local.get(DOWNLOAD_STATE_BY_TAB_KEY).then((result) => {
    const byTab = result[DOWNLOAD_STATE_BY_TAB_KEY] || {};
    delete byTab[tabId];
    return browser.storage.local.set({ [DOWNLOAD_STATE_BY_TAB_KEY]: byTab });
  }).catch(() => {});
};

// Handle individual image fetch requests (for CORS bypass)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward progress messages from content script to popup
  if (message.type === 'downloadProgress') {
    const senderTabId = sender && sender.tab ? sender.tab.id : null;
    // When download completed or error, clear that tab's state so reopening that tab's popup won't show overlay
    if (senderTabId != null && (message.progress >= 100 || message.error)) {
      clearDownloadStateForTab(senderTabId);
    }
    // Explicitly forward to popup by sending a new message
    browser.runtime.sendMessage({
      type: 'downloadProgress',
      progress: message.progress,
      text: message.text,
      error: message.error
    }).catch(err => {
      console.warn('Background script: Could not forward progress message (popup might be closed):', err);
    });
    return false;
  }
  
  if (message.method === 'fetchImage') {
    // Return true to indicate we will send a response asynchronously
    (async () => {
      let responseSent = false;
      const safeSendResponse = (response) => {
        if (!responseSent) {
          responseSent = true;
          try {
            sendResponse(response);
          } catch (e) {
            console.error('Background script: Error sending response:', e);
          }
        }
      };
      
      try {
        console.log('Background script: Fetching image', message.src);
        const image = await fetchImageInBackground(message.src);
        
        if (!image || !image.data) {
          console.error('Background script: Invalid image data');
          safeSendResponse({ error: 'Invalid image data' });
          return;
        }
        
        // Ensure valid mime type
        let mime = image.mime;
        if (!mime || mime === 'UNKNOWN' || mime === null) {
          const mimeMatch = image.data.match(/data:image\/([^;]+)/);
          if (mimeMatch && mimeMatch[1]) {
            mime = mimeMatch[1].toLowerCase();
            if (mime === 'jpg') mime = 'jpeg';
          } else {
            mime = 'jpeg';
            image.data = image.data.replace(/data:image\/[^;]+/, `data:image/${mime}`);
          }
        }
        
        console.log('Background script: Image fetched successfully, mime:', mime);
        safeSendResponse({ data: image.data, mime: mime });
      } catch (error) {
        console.error('Background script: Error fetching image:', error);
        safeSendResponse({ error: error.message || 'Failed to fetch image' });
      }
    })();
    
    return true; // Keep the message channel open for async response
  }
  // Return false if we don't handle the message
  return false;
});

browser.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(async data => {
    
    if(data.method === 'getImagesData'){
      // Create progress callback that sends updates via port
      const progressCallback = (progress, text) => {
        port.postMessage({ 
          type: 'progress', 
          progress: progress,
          text: text 
        });
      };
      
      try {
        const images = await getImagesData(data.images, progressCallback);

        console.log('Sending Images data -')
        console.log(images)
        port.postMessage({ type: 'success', 'data': images });
      } catch (error) {
        console.error('Error processing images:', error);
        port.postMessage({ type: 'error', error: error.message });
      }
    }
  });
});