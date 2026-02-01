import { srcType, getBase64Image, calculateAspectRatioFit, getBase64ImageMime, dump, normalizeImageUrl, detectImageType, isLikelyHtml } from '../popup/js/helpers';
import { getPaddedEntryName, mimeToExtension } from '../popup/js/archiveHelpers';
import { jsPDF } from 'jspdf';
import FileSaver from 'file-saver';
import JSZip from 'jszip';

(function () {

  if(window.hasRun){
    return false;
  }
  window.hasRun = true;

  const fetchImages = function () {
    const imgs = document.querySelectorAll("img");

    const images = [];
    const seenUrls = new Set(); // Deduplicate by normalized URL (first occurrence wins)
    const baseHref = typeof location !== 'undefined' ? location.href : '';
    const MAX_DATA_URI_SIZE = 500 * 1024; // 500KB - only convert small images to avoid message size limits

    imgs.forEach(function (img, i) {
      // Normalize img.src for uniqueness (trim, resolve relative to page)
      const normalizedUrl = normalizeImageUrl(img.src, baseHref);
      if (normalizedUrl == null || seenUrls.has(normalizedUrl)) return;
      seenUrls.add(normalizedUrl);

      img.dataset.download_id = images.length;

      // Optimization: Get dimensions from already-loaded images
      // This avoids the popup needing to load images just to get dimensions
      let width = 0;
      let height = 0;

      if (img.complete && (img.naturalWidth || img.width)) {
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
      }

      // Try to get image as data URI if it's already loaded, same-origin, and small
      // This avoids re-fetching in the popup for small images
      let imageData = null;
      if (img.complete && width > 0 && height > 0) {
        // Only convert small images to data URI to avoid message size limits
        const estimatedSize = width * height * 3; // Rough estimate: width * height * 3 bytes (RGB)
        if (estimatedSize < MAX_DATA_URI_SIZE) {
          try {
            // Only convert to data URI if it's same-origin or already loaded
            // This avoids CORS issues and re-fetching
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            imageData = canvas.toDataURL('image/jpeg', 0.85); // Use 0.85 quality for balance

            // Check actual size - if too large, don't use data URI
            if (imageData.length > MAX_DATA_URI_SIZE) {
              imageData = null;
            }
          } catch (e) {
            // Canvas might be tainted (CORS), fall back to URL
            // This is expected for cross-origin images
          }
        }
      }

      images.push({
        'src': imageData || img.src, // Use data URI if available, otherwise URL
        'type': imageData ? 'data' : srcType(img.src),
        'width': width, // Send dimensions so popup doesn't need to load for dimensions
        'height': height,
        'originalSrc': img.src // Always keep original URL for download
      });
    });

    const canvases = document.querySelectorAll('canvas');
    let id = images.length;

    for(let canvas of canvases){
      images.push({
        'src': canvas.toDataURL('image/jpeg'),
        'type': 'data',
        'width': canvas.width,
        'height': canvas.height
      })
    }

    return images;
  }

  const fetchTitle = function () {
    return document.title;
  };

  // Shared image-to-base64 and fetch helpers for both PDF and archive generation
  const imageToBase64 = (imgSrc) => {
    return new Promise((resolve, reject) => {
      const allImgs = Array.from(document.querySelectorAll('img'));
      let imgElement = allImgs.find(img => img.src === imgSrc);
      if (!imgElement && imgSrc) {
        try {
          const targetUrl = new URL(imgSrc);
          imgElement = allImgs.find(img => {
            try {
              const imgUrl = new URL(img.src);
              return imgUrl.origin === targetUrl.origin && imgUrl.pathname === targetUrl.pathname;
            } catch (e) { return false; }
          });
        } catch (e) {}
      }
      if (!imgElement) {
        imgElement = allImgs.find(img => img.getAttribute('src') === imgSrc || img.getAttribute('data-src') === imgSrc);
      }
      if (!imgElement) {
        imgElement = allImgs.find(img => {
          const a = (img.src || '').split('?')[0];
          const b = (imgSrc || '').split('?')[0];
          return a === b || (img.src && img.src.includes(b)) || (imgSrc && imgSrc.includes(a));
        });
      }
      if (imgElement) {
        if (!imgElement.complete || imgElement.naturalWidth === 0) {
          const onLoad = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = imgElement.naturalWidth || imgElement.width;
              canvas.height = imgElement.naturalHeight || imgElement.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(imgElement, 0, 0);
              resolve({ data: canvas.toDataURL('image/jpeg', 0.95), mime: 'jpeg' });
            } catch (err) { reject(err); }
          };
          const onError = () => reject(new Error('Image failed to load'));
          imgElement.addEventListener('load', onLoad, { once: true });
          imgElement.addEventListener('error', onError, { once: true });
          if (imgElement.complete && imgElement.naturalWidth === 0) {
            setTimeout(() => imgElement.naturalWidth > 0 ? onLoad() : onError(), 100);
          }
          return;
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imgElement.naturalWidth || imgElement.width;
          canvas.height = imgElement.naturalHeight || imgElement.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgElement, 0, 0);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.95), mime: 'jpeg' });
        } catch (err) { reject(err); }
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.addEventListener('load', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.95), mime: 'jpeg' });
        } catch (err) { reject(err); }
      }, { once: true });
      img.addEventListener('error', () => reject(new Error('Failed to load image')), { once: true });
      img.src = imgSrc;
      setTimeout(() => { if (!img.complete) reject(new Error('Image load timeout')); }, 5000);
    });
  };

  const fetchImageViaBackground = (imgSrc, index) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Background script request timed out')), 35000);
      browser.runtime.sendMessage({ method: 'fetchImage', src: imgSrc, index })
        .then((response) => {
          clearTimeout(timeout);
          if (browser.runtime.lastError) { reject(new Error(browser.runtime.lastError.message)); return; }
          if (!response) { reject(new Error('No response from background script')); return; }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          if (response.data) resolve({ data: response.data, mime: response.mime || 'jpeg' });
          else reject(new Error('Invalid response from background script'));
        })
        .catch(err => { clearTimeout(timeout); reject(err); });
    });
  };

  const processImagesInContentScript = async (images, progressCallback) => {
    const checkedImages = images.filter(img => img.checked);
    const total = checkedImages.length;
    let processed = 0;
    const processedImages = [];
    const failedUrls = [];
    for (let i = 0; i < images.length; i++) {
      const { src, type, checked, originalSrc } = images[i];
      if (!checked) continue;
      try {
        let imageData = null;
        let mime = null;
        const imageSrc = originalSrc || src;
        if (type === 'url' || (type === 'data' && originalSrc)) {
          try {
            const image = await imageToBase64(imageSrc);
            imageData = image.data;
            mime = image.mime;
          } catch (canvasError) {
            try {
              const image = await fetchImageViaBackground(imageSrc, processed);
              if (!image || !image.data) throw new Error('Invalid image data');
              imageData = image.data;
              mime = image.mime || 'jpeg';
              if (!mime || mime === 'UNKNOWN') {
                const m = imageData.match(/data:image\/([^;]+)/);
                mime = m ? (m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase()) : 'jpeg';
              }
            } catch (fetchError) {
              failedUrls.push({ index: processed + 1, url: imageSrc, reason: fetchError.message });
              processed++;
              if (progressCallback && total > 0) progressCallback(Math.round((processed / total) * 100), `Processing image ${processed} of ${total}...`);
              continue;
            }
          }
        } else {
          mime = getBase64ImageMime(src) || 'jpeg';
          if (mime === 'jpg') mime = 'jpeg';
          imageData = src;
        }
        if (imageData && mime) {
          processedImages.push({ src: imageData, mime, type, checked, index: processedImages.length, originalUrl: imageSrc });
        }
        processed++;
        if (progressCallback && total > 0) progressCallback(Math.round((processed / total) * 100), `Processing image ${processed} of ${total}...`);
      } catch (err) {
        processed++;
        if (progressCallback && total > 0) progressCallback(Math.round((processed / total) * 100), `Processing image ${processed} of ${total}...`);
      }
    }
    return processedImages;
  };

  const downloadAsArchive = async ({ fileName, downloadFormat, images }) => {
    const progressCallback = (progress, text) => {
      browser.runtime.sendMessage({ type: 'downloadProgress', progress, text }).catch(() => {});
    };
    progressCallback(5, 'Starting image processing...');
    const processedImages = await processImagesInContentScript(images, progressCallback);
    if (!processedImages || processedImages.length === 0) {
      const failedInfo = failedUrls.length > 0
        ? ` Failed fetches: ${failedUrls.map(f => `#${f.index} (${f.reason})`).join('; ')}.`
        : '';
      throw new Error(`No valid images to download. Some images may have unsupported formats.${failedInfo}`);
    }
    const total = processedImages.length;
    const zip = new JSZip();
    for (let i = 0; i < processedImages.length; i++) {
      const img = processedImages[i];
      const name = getPaddedEntryName(i, total, img.mime);
      const base64Data = img.src.replace(/^data:image\/[^;]+;base64,/, '');
      zip.file(name, base64Data, { base64: true });
      progressCallback(50 + Math.round((i + 1) / total * 45), `Adding image ${i + 1} of ${total}...`);
    }
    progressCallback(95, 'Building archive...');
    const blob = await zip.generateAsync({ type: 'blob' });
    const ext = downloadFormat === 'cbz' ? '.cbz' : '.zip';
    const mimeType = downloadFormat === 'cbz' ? 'application/vnd.comicbook+zip' : 'application/zip';
    const blobWithMime = blob.slice(0, blob.size, mimeType);
    FileSaver.saveAs(blobWithMime, fileName + ext);
    progressCallback(100, 'Download complete!');
  };

  const downloadUsingBrowser = function ({ fileName, images }) {
    let markup = "";

      images.forEach(function (img) {

        markup += `<page size='A4'><img src='${img.src}'/></page>`
      })

      document.querySelector('html').innerHTML = '';

      const fullMarkup = `
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${fileName}</title>

            <style type="text/css">

              body {
                background: rgb(204,204,204); 
              }
              page[size="A4"] {
                background: white;
                width: 21cm;
                height: 29.7cm;
                display: block;
                margin: 0 auto;
                // margin-bottom: 0.5cm;
                box-shadow: 0 0 0.5cm rgba(0,0,0,0.5);
              }
              @media print {
                body, page[size="A4"] {
                  margin: 0;
                  box-shadow: 0;
                }
              }

              img {
                  width: 100%; /* or any custom size */
                  height: 100%; 
                  object-fit: contain;
              }
            </style>
          </head>
          <body>
              <div id="printDiv">
                ${markup}
              </div>
          </body>
      `

      document.querySelector('html').innerHTML = fullMarkup;


      Promise.all(Array.from(document.querySelectorAll('img')).filter(img => !img.complete).map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))).then(() => {
          window.print();
      });


      window.addEventListener('afterprint', function () {
        window.location.reload()
      })
  }


  /**
   * Ensure image is in a format jsPDF addImage supports (jpeg or png).
   * Uses magic-byte detection; converts webp/avif/gif/unknown via canvas to PNG if decodable.
   * @param {{ src: string, mime?: string, originalUrl?: string }} img - data URL and optional URL for errors
   * @returns {{ src: string, mime: 'jpeg'|'png' }} - normalized data URL and type for addImage
   */
  const ensureSupportedForPdf = async (img) => {
    const dataUrl = img.src;
    const urlForError = img.originalUrl || '(data URI)';
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error(`Image is not a data URL: ${urlForError}`);
    }
    const base64 = dataUrl.indexOf(';base64,') >= 0 ? dataUrl.split(';base64,')[1] : dataUrl.replace(/^data:[^,]+,/, '');
    if (!base64) {
      throw new Error(`Image data URL has no base64 payload: ${urlForError}`);
    }
    let bytes;
    try {
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch (e) {
      throw new Error(`Image base64 decode failed: ${urlForError}`);
    }
    if (bytes.length === 0) {
      throw new Error(`Image response is empty (0 bytes): ${urlForError}`);
    }
    if (isLikelyHtml(bytes)) {
      const hexSnippet = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      throw new Error(`Image response is not a valid image (detected: text/html or challenge page). URL: ${urlForError}. First bytes (hex): ${hexSnippet}`);
    }
    const detectedType = detectImageType(bytes);
    if (detectedType === 'jpeg' || detectedType === 'png') {
      const prefix = detectedType === 'jpeg' ? 'data:image/jpeg;base64,' : 'data:image/png;base64,';
      const normalized = dataUrl.replace(/^data:image\/[^;]+;base64,/, prefix);
      return { src: normalized, mime: detectedType };
    }
    // webp / gif / avif / unknown: decode and convert to PNG via canvas
    const mimeForBlob = detectedType !== 'unknown' ? `image/${detectedType}` : 'image/png';
    const blob = new Blob([bytes], { type: mimeForBlob });
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pngDataUrl = canvas.toDataURL('image/png');
      return { src: pngDataUrl, mime: 'png' };
    } catch (decodeErr) {
      const snippet = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      throw new Error(`Image response is not a valid image (detected: ${detectedType}, decode failed). URL: ${urlForError}. First bytes (hex): ${snippet}. ${decodeErr.message || ''}`);
    }
  };

  const downloadUsingJSPdf = async function ({ fileName, images, imagesData }) {

    // Helper function to generate PDF from image data
    const generatePDFFromData = async (imagesData, progressCallback = null) => {
      if (!imagesData || imagesData.length === 0) {
        throw new Error('No image data provided for PDF generation');
      }
      const doc = new jsPDF("p", "mm", "a4");

      const maxWidth = doc.internal.pageSize.getWidth();
      const maxHeight = doc.internal.pageSize.getHeight();

      for (let index = 0; index < imagesData.length; index++) {
        const img = imagesData[index];
        if (progressCallback) progressCallback(index + 1, imagesData.length);
        if (!img.src || img.src === null) {
          console.warn(`Skipping image ${index}: no src`);
          continue;
        }
        let normalized;
        try {
          normalized = await ensureSupportedForPdf(img);
        } catch (err) {
          const url = img.originalUrl || '(unknown URL)';
          console.error(`Error normalizing image ${index} for PDF:`, err, { index, url, mime: img.mime });
          if (index === 0) throw new Error(`Failed to add first image to PDF: ${err.message}`);
          continue;
        }
        try {
          const imgProps = doc.getImageProperties(normalized.src);
          if (!imgProps || !imgProps.width || !imgProps.height) {
            console.warn(`Skipping image ${index}: invalid image properties`, { imgProps });
            continue;
          }
          const aspectRatio = calculateAspectRatioFit(imgProps.width, imgProps.height, maxWidth, maxHeight);
          let marginX = 0, marginY = 0;
          if(Math.round(aspectRatio.width) < Math.round(maxWidth)){
            marginX = (maxWidth - aspectRatio.width) / 2;
          }
          else{
            marginX = 0
          }

          if(Math.round(aspectRatio.height) < Math.round(maxHeight)){
            marginY = (maxHeight - aspectRatio.height) / 2;
          }
          else{
            marginY = 0;
          }

          // Use the mime type from the image data, with fallback
          doc.addImage(normalized.src, normalized.mime, marginX, marginY, aspectRatio.width, aspectRatio.height);
          if(index !== imagesData.length - 1) doc.addPage();
        } catch (error) {
          const url = img.originalUrl || '(unknown URL)';
          console.error(`Error adding image ${index} to PDF:`, error, { url, mime: normalized.mime });
          if (index === 0) throw new Error(`Failed to add first image to PDF: ${error.message}`);
        }

      }
      const updatedDoc = doc;

      // Hack for firefox user to forcefully downloading the file from blob
      // https://github.com/parallax/jsPDF/issues/3391#issuecomment-1133782322 
      if (navigator.userAgent.toLowerCase().includes('firefox')) {
        console.warn('Firefox detected - using alternative PDF save way...')
        let blob = updatedDoc.output('blob')
        blob = blob.slice(0, blob.size, 'application/octet-stream') 
        FileSaver.saveAs(blob, `${fileName}.pdf`)
        return
      }

      updatedDoc.save(`${fileName}.pdf`);
    };

    // Process images directly in content script to avoid 64MB limit
    // This avoids transferring large amounts of data through messages/ports
    return new Promise(async (resolve, reject) => {
      try {
        // Process images with progress updates
        // Send progress updates to popup via messages
        const progressCallback = (progress, text) => {
          console.log(`Progress: ${progress}% - ${text}`);
          // Send progress update to popup
          const message = {
            type: 'downloadProgress',
            progress: progress,
            text: text
          };
          console.log('Content script: Sending progress message:', message);
          browser.runtime.sendMessage(message)
            .then(() => {
              console.log('Content script: Progress message sent successfully');
            })
            .catch(err => {
              // Ignore errors if popup is closed
              console.warn('Content script: Could not send progress update:', err);
            });
        };

        console.log('Processing images directly in content script...');
        progressCallback(5, 'Starting image processing...');
        
        const processedImages = await processImagesInContentScript(images, progressCallback);
        
        if (processedImages.length === 0) {
          reject(new Error('No valid images to download. Some images may have unsupported formats.'));
          return;
        }

        const totalImages = processedImages.length;
        console.log('Generating PDF with', totalImages, 'images');
        
        // Generate PDF with progress updates
        const pdfProgressCallback = (current, total) => {
          const pdfProgress = 90 + Math.round((current / total) * 10); // 90-100% for PDF generation
          progressCallback(pdfProgress, `Adding image ${current} of ${total} to PDF...`);
        };
        
        await generatePDFFromData(processedImages, pdfProgressCallback);
        console.log('PDF generation completed successfully');
        
        // Send 95% - PDF generated, waiting for download to start
        progressCallback(95, 'PDF generated, starting download...');
        
        // Wait to ensure the download actually starts
        // The browser needs time to process the download request
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Send 97% - Download should be starting
        progressCallback(97, 'Download starting...');
        
        // Wait longer to ensure download file is being saved
        // Larger files need more time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Send 99% - Download should be in progress
        progressCallback(99, 'Saving file...');
        
        // Wait a bit more to ensure download completes
        // Give the browser time to actually save the file to disk
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Now send 100% - Download should be complete
        progressCallback(100, 'Download complete!');
        console.log('Download completed - file should be saved');
        
        // Resolve after ensuring the message is sent
        setTimeout(() => {
          resolve();
        }, 300);
      } catch (error) {
        console.error('Error in downloadUsingJSPdf:', error);
        console.error('Error stack:', error.stack);
        // Send error progress update
        browser.runtime.sendMessage({
          type: 'downloadProgress',
          progress: 0,
          text: 'Download failed',
          error: error.message
        }).catch(err => {
          console.warn('Could not send error update:', err);
        });
        reject(error);
      }
    });

  }




  const handler = function (data) {   
    if(data.method === 'fetchImages'){
      const images = fetchImages();
      
      return Promise.resolve(images)
    }

    if(data.method === 'generatePDF'){

      const {fileName, images, downloadType, downloadFormat, imagesData} = data;

      if(downloadType === 'browser'){
        try {
          downloadUsingBrowser({ fileName, images });
          return Promise.resolve("Page created successfully!")
        } catch (error) {
          console.error('Error in browser download:', error);
          return Promise.reject(error);
        }
      }
      if(downloadType === 'jspdf'){
        return downloadUsingJSPdf({ fileName, images, imagesData })
          .then(() => "Pdf downloaded successfully!")
          .catch((error) => {
            console.error('Error in jspdf download:', error);
            throw error;
          });
      }

    }

    if(data.method === 'generateArchive'){
      const { fileName, downloadFormat, images } = data;
      return downloadAsArchive({ fileName, downloadFormat, images })
        .then(() => "Archive downloaded successfully!")
        .catch((error) => {
          console.error('Error in archive download:', error);
          browser.runtime.sendMessage({
            type: 'downloadProgress',
            progress: 0,
            text: 'Download failed',
            error: error.message
          }).catch(() => {});
          throw error;
        });
    }

    if(data.method === 'fetchTitle'){
      return Promise.resolve(fetchTitle());
    }

    return false;
  }

  browser.runtime.onMessage.addListener(handler)
})();

