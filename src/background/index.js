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