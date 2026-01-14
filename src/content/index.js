import { srcType, getBase64Image, calculateAspectRatioFit, getBase64ImageMime, dump } from '../popup/js/helpers';
import { jsPDF } from 'jspdf';
import FileSaver from 'file-saver'

(function () {

  if(window.hasRun){
    return false;
  }
  window.hasRun = true;

  const fetchImages = function () {
    const imgs = document.querySelectorAll("img"); 

    const images = [];

    imgs.forEach(function (img, i) {
      img.dataset.download_id = i;

      images.push({
        'src': img.src,
        'type': srcType(img.src)
      })
    })

    const canvases = document.querySelectorAll('canvas');
    let id = images.length;

    for(let canvas of canvases){
      images.push({
        'src': canvas.toDataURL('image/jpeg'),
        'type': 'data'
      })
    }

    return images;
  }

  const fetchTitle = function () {
    return document.title;
  }

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


  const downloadUsingJSPdf = async function ({ fileName, images, imagesData }) {

    // Process images using canvas to avoid CORS issues
    // Images are already loaded in the page, so we can use canvas to convert them
    const processImagesInContentScript = async (images, progressCallback) => {
      // Only count checked images for progress tracking
      const checkedImages = images.filter(img => img.checked);
      const total = checkedImages.length;
      let processed = 0;
      const processedImages = [];

      // Helper to convert image to base64 using canvas (avoids CORS)
      const imageToBase64 = (imgSrc) => {
        return new Promise((resolve, reject) => {
          // Try to find the image element in the DOM first
          const allImgs = Array.from(document.querySelectorAll('img'));
          
          // Try multiple matching strategies
          let imgElement = null;
          
          // Strategy 1: Exact match
          imgElement = allImgs.find(img => img.src === imgSrc);
          
          // Strategy 2: Match by URL without query params
          if (!imgElement) {
            try {
              const targetUrl = new URL(imgSrc);
              imgElement = allImgs.find(img => {
                try {
                  const imgUrl = new URL(img.src);
                  return imgUrl.origin === targetUrl.origin && 
                         imgUrl.pathname === targetUrl.pathname;
                } catch (e) {
                  return false;
                }
              });
            } catch (e) {
              // URL parsing failed, skip this strategy
            }
          }
          
          // Strategy 3: Match by src attribute (before browser resolves it)
          if (!imgElement) {
            imgElement = allImgs.find(img => img.getAttribute('src') === imgSrc || 
                                          img.getAttribute('data-src') === imgSrc);
          }
          
          // Strategy 4: Partial match (one contains the other)
          if (!imgElement) {
            imgElement = allImgs.find(img => {
              const imgSrcClean = img.src.split('?')[0];
              const targetSrcClean = imgSrc.split('?')[0];
              return imgSrcClean === targetSrcClean || 
                     img.src.includes(targetSrcClean) || 
                     targetSrcClean.includes(imgSrcClean);
            });
          }
          
          if (imgElement) {
            // Wait for image to load if not complete
            if (!imgElement.complete || imgElement.naturalWidth === 0) {
              const onLoad = () => {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = imgElement.naturalWidth || imgElement.width;
                  canvas.height = imgElement.naturalHeight || imgElement.height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(imgElement, 0, 0);
                  const base64 = canvas.toDataURL('image/jpeg', 0.95);
                  resolve({ data: base64, mime: 'jpeg' });
                } catch (error) {
                  reject(error);
                }
              };
              
              const onError = () => {
                reject(new Error('Image failed to load'));
              };
              
              imgElement.addEventListener('load', onLoad, { once: true });
              imgElement.addEventListener('error', onError, { once: true });
              
              // If already loaded but dimensions are 0, try again after a short delay
              if (imgElement.complete && imgElement.naturalWidth === 0) {
                setTimeout(() => {
                  if (imgElement.naturalWidth > 0) {
                    onLoad();
                  } else {
                    onError();
                  }
                }, 100);
              }
              return;
            }
            
            // Image is loaded, try canvas conversion
            try {
              const canvas = document.createElement('canvas');
              canvas.width = imgElement.naturalWidth || imgElement.width;
              canvas.height = imgElement.naturalHeight || imgElement.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(imgElement, 0, 0);
              
              // Convert to base64
              const base64 = canvas.toDataURL('image/jpeg', 0.95);
              resolve({ data: base64, mime: 'jpeg' });
            } catch (error) {
              // Canvas might be tainted (CORS), reject to use background script
              console.warn('Canvas conversion failed, will try background script:', error);
              reject(error);
            }
          } else {
            // Image not in DOM, try to load it with crossOrigin
            console.log('Content script: Image not in DOM, attempting to load:', imgSrc);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const onLoad = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const base64 = canvas.toDataURL('image/jpeg', 0.95);
                resolve({ data: base64, mime: 'jpeg' });
              } catch (error) {
                console.warn('Content script: Canvas conversion failed after loading:', error);
                reject(error);
              }
            };
            
            const onError = () => {
              reject(new Error('Failed to load image in content script'));
            };
            
            img.addEventListener('load', onLoad, { once: true });
            img.addEventListener('error', onError, { once: true });
            img.src = imgSrc;
            
            // Timeout after 5 seconds
            setTimeout(() => {
              if (!img.complete) {
                reject(new Error('Image load timeout'));
              }
            }, 5000);
          }
        });
      };

      // Helper to fetch image via background script (bypasses CORS)
      const fetchImageViaBackground = async (imgSrc) => {
        return new Promise((resolve, reject) => {
          console.log('Content script: Requesting image from background script:', imgSrc);
          
          // Add timeout
          const timeout = setTimeout(() => {
            reject(new Error('Background script request timed out'));
          }, 30000); // 30 second timeout
          
          browser.runtime.sendMessage({
            method: 'fetchImage',
            src: imgSrc
          }).then((response) => {
            clearTimeout(timeout);
            console.log('Content script: Received response from background:', response);
            
            // Check for Chrome runtime errors
            if (browser.runtime.lastError) {
              clearTimeout(timeout);
              reject(new Error(`Runtime error: ${browser.runtime.lastError.message}`));
              return;
            }
            
            if (!response) {
              clearTimeout(timeout);
              reject(new Error('No response from background script (response was undefined)'));
              return;
            }
            
            if (response.error) {
              clearTimeout(timeout);
              reject(new Error(response.error));
              return;
            }
            
            if (response.data) {
              clearTimeout(timeout);
              resolve({ data: response.data, mime: response.mime || 'jpeg' });
            } else {
              clearTimeout(timeout);
              reject(new Error(`Invalid response from background script: missing data field. Response keys: ${Object.keys(response).join(', ')}`));
            }
          }).catch((error) => {
            clearTimeout(timeout);
            console.error('Content script: Error sending message to background:', error);
            reject(error);
          });
        });
      };

      for (let i = 0; i < images.length; i++) {
        const {src, type, checked} = images[i];
        
        // Only process checked images
        if (!checked) {
          continue;
        }

        try {
          let imageData = null;
          let mime = null;

          if (type === 'url') {
            // Try canvas method first (for images already in DOM)
            try {
              const image = await imageToBase64(src);
              imageData = image.data;
              mime = image.mime;
            } catch (canvasError) {
              // Canvas failed, use background script to fetch (bypasses CORS)
              try {
                const image = await fetchImageViaBackground(src);
                if (!image || !image.data) {
                  throw new Error('Invalid image data from background script');
                }
                imageData = image.data;
                mime = image.mime;
                
                // Ensure valid mime type
                if (!mime || mime === 'UNKNOWN' || mime === null) {
                  const mimeMatch = imageData.match(/data:image\/([^;]+)/);
                  if (mimeMatch && mimeMatch[1]) {
                    mime = mimeMatch[1].toLowerCase();
                    if (mime === 'jpg') mime = 'jpeg';
                  } else {
                    mime = 'jpeg';
                    imageData = imageData.replace(/data:image\/[^;]+/, `data:image/${mime}`);
                  }
                }
              } catch (fetchError) {
                console.warn(`Skipping image ${i}: Failed to fetch via background script`, fetchError);
                processed++;
                if (progressCallback && total > 0) {
                  const progress = Math.round((processed / total) * 100);
                  progressCallback(progress, `Processing image ${processed} of ${total}...`);
                }
                continue;
              }
            }
          } else {
            // Data URI - already base64
            mime = getBase64ImageMime(src);
            if (!mime || mime === 'UNKNOWN' || mime === null) {
              const mimeMatch = src.match(/data:image\/([^;]+)/);
              if (mimeMatch && mimeMatch[1]) {
                mime = mimeMatch[1].toLowerCase();
                if (mime === 'jpg') mime = 'jpeg';
              } else {
                mime = 'jpeg';
              }
            }
            imageData = src;
          }

          if (imageData && mime) {
            processedImages.push({
              src: imageData,
              mime: mime,
              type: type,
              checked: checked
            });
          }

          processed++;
          if (progressCallback && total > 0) {
            const progress = Math.round((processed / total) * 100);
            progressCallback(progress, `Processing image ${processed} of ${total}...`);
          }
        } catch (error) {
          console.error(`Error processing image ${i}:`, error);
          processed++;
          if (progressCallback && total > 0) {
            const progress = Math.round((processed / total) * 100);
            progressCallback(progress, `Processing image ${processed} of ${total}...`);
          }
          // Continue with next image
        }
      }

      return processedImages;
    };

    // Helper function to generate PDF from image data
    const generatePDFFromData = (imagesData, progressCallback = null) => {
      if (!imagesData || imagesData.length === 0) {
        throw new Error('No image data provided for PDF generation');
      }
      const doc = new jsPDF("p", "mm", "a4");

      let imgProps = undefined,
          maxWidth = doc.internal.pageSize.getWidth(),
          maxHeight = doc.internal.pageSize.getHeight(),
          aspectRatio = undefined,
          marginX = 0,
          marginY = 0;

      const updatedDoc = imagesData.reduce((doc, img, index) => {
        // Send progress update for each image added
        if (progressCallback) {
          progressCallback(index + 1, imagesData.length);
        }
        // Skip images with null src or invalid mime types
        if(!img.src || img.src === null || !img.mime || img.mime === 'UNKNOWN') {
          console.warn(`Skipping image ${index}: invalid src or mime type`, {
            hasSrc: !!img.src,
            mime: img.mime
          });
          return doc;
        }
        
        try {
          imgProps = doc.getImageProperties(img.src);
          
          // Validate that we got valid image properties
          if (!imgProps || !imgProps.width || !imgProps.height) {
            console.warn(`Skipping image ${index}: invalid image properties`, {
              imgProps: imgProps
            });
            return doc;
          }
          
          aspectRatio = calculateAspectRatioFit(imgProps.width, imgProps.height, maxWidth, maxHeight);

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
          const mimeType = img.mime || 'jpeg'; // Default to jpeg if mime is missing
          doc.addImage(img.src, mimeType, marginX, marginY, aspectRatio.width, aspectRatio.height);
          if(index !== imagesData.length - 1) doc.addPage();
        } catch (error) {
          console.error(`Error adding image ${index} to PDF:`, error);
          console.error(`Image data:`, {
            hasSrc: !!img.src,
            mime: img.mime,
            srcPreview: img.src ? img.src.substring(0, 50) + '...' : 'null'
          });
          // If this is the first image and it fails, throw the error
          // Otherwise, continue with next image
          if (index === 0) {
            throw new Error(`Failed to add first image to PDF: ${error.message}`);
          }
        }

        return doc;
      }, doc);

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
        
        generatePDFFromData(processedImages, pdfProgressCallback);
        console.log('PDF generation completed successfully');
        
        progressCallback(100, 'Download complete!');
        
        // Resolve after a short delay to ensure download starts
        setTimeout(() => {
          resolve();
        }, 500);
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

      const {fileName, images, downloadType, imagesData} = data;

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
        // downloadUsingJSPdf now returns a promise
        return downloadUsingJSPdf({ fileName, images, imagesData })
          .then(() => {
            return "Pdf downloaded successfully!";
          })
          .catch((error) => {
            console.error('Error in jspdf download:', error);
            throw error;
          });
      }

    }

    if(data.method === 'fetchTitle'){
      return Promise.resolve(fetchTitle());
    }

    return false;
  }

  browser.runtime.onMessage.addListener(handler)
})();

