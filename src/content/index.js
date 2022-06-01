import { srcType } from '../popup/js/helpers';

(function () {

  if(window.hasRun){
    return false;
  }
  window.hasRun = true;
  
  const fetchImages = function () {
    const imgs = document.querySelectorAll("img"); 

    const images = [];

    for(const img of imgs){
      images.push({
        'src': img.src,
        'type': srcType(img.src)
      })
    }

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


  const downloadUsingJSPdf = function ({ fileName, images }) {
    
  }


  const generatePDF = function ({ fileName, images, downloadType }) {

    if(downloadType === 'browser'){
      downloadUsingBrowser({ fileName, images });
    }
    if(downloadType === 'jspdf'){
      downloadUsingJSPdf({ fileName, images });
    }

  }



  const handler = function (data) {
    if(data.method === 'fetchImages'){
      const images = fetchImages();
      
      return Promise.resolve(images)
    }

    else if(data.method === 'generatePDF'){

      // console.log(data.filename, data.images)
      generatePDF(data)

      return Promise.resolve("Page created successfully!")
    }

    return false;
  }

  browser.runtime.onMessage.addListener(handler)
})();

