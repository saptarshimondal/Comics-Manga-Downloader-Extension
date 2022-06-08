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


  const downloadUsingJSPdf = async function ({ fileName, images }) {

    let port = browser.runtime.connect({ name: 'conn-get-images-data' });

    port.postMessage({ method: 'getImagesData', images: images });
    port.onMessage.addListener(function({type, data}) {
      if(type === 'success'){

        const imagesData = data;
        const doc = new jsPDF("p", "mm", "a4");

        let imgProps = undefined,
            maxWidth = doc.internal.pageSize.getWidth(),
            maxHeight = doc.internal.pageSize.getHeight(),
            aspectRatio = undefined,
            marginX = 0,
            marginY = 0;

        const updatedDoc = imagesData.reduce((doc, img) => {
          if(img.src !== null){
            imgProps = doc.getImageProperties(img.src);
            
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

            doc.addImage(img.src, img.mime, marginX, marginY, aspectRatio.width, aspectRatio.height);
            doc.addPage();
          }


          return doc;
        }, doc);

        // Hack for firefox user to forcefully downloading the file from blob
        // https://github.com/parallax/jsPDF/issues/3391#issuecomment-1133782322 
        if (navigator.userAgent.toLowerCase().includes('firefox')) {
          console.warn('Firefox detected - using alternative PDF save way...')
          let blob = doc.output('blob')
          blob = blob.slice(0, blob.size, 'application/octet-stream') 
          FileSaver.saveAs(blob, `${fileName}.pdf`)
          return
        }

        updatedDoc.save(`${fileName}.pdf`);
      }

      port.disconnect()
    });

  }




  const handler = function (data) {   
    if(data.method === 'fetchImages'){
      const images = fetchImages();
      
      return Promise.resolve(images)
    }

    if(data.method === 'generatePDF'){

      const {fileName, images, downloadType} = data;

      if(downloadType === 'browser'){
        downloadUsingBrowser({ fileName, images });
        return Promise.resolve("Page created successfully!")
      }
      if(downloadType === 'jspdf'){
        downloadUsingJSPdf({ fileName, images })
        return Promise.resolve("Pdf downloaded successfully!");
      }

    }

    if(data.method === 'fetchTitle'){
      return Promise.resolve(fetchTitle());
    }

    return false;
  }

  browser.runtime.onMessage.addListener(handler)
})();

