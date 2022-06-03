import { srcType, getBase64Image } from '../popup/js/helpers';

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

    /*let port = browser.runtime.connect({ name: 'webextensions-boilerplate' });

    port.postMessage({ 'method': 'downloadUsingJSPdf', 'fileName': fileName, 'images' : images });
    port.onMessage.addListener(function(data) {
      console.log(data);
    });*/

    // const data = await getBase64Image(images.at(2).src)

    const promises = images.map(async ({src, type, checked}) => {

      if(type === 'url'){
        return {
          'src': await getBase64Image(src),
          'type': type,
          'checked': checked
        }
      }
      else{
        return {src, type, checked};
      }
    });

    return await Promise.all(promises);
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
        return Promise.resolve(downloadUsingJSPdf({ fileName, images }));
      }

    }

    if(data.method === 'fetchTitle'){
      return Promise.resolve(fetchTitle());
    }

    return false;
  }

  browser.runtime.onMessage.addListener(handler)
})();

