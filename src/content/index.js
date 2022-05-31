const fetchImages = function () {
  const imgs = document.querySelectorAll("img"); 

  const imgData = [];

  for(let img of imgs){
    imgData.push(img.src)
  }

  const canvases = document.querySelectorAll('canvas');

  for(let canvas of canvases){
    imgData.push(canvas.toDataURL('image/jpeg'))
  }

  return imgData;
}


const generatePDF = function (filename, images) {
      
  let markup = "";

  images.forEach(function (img) {

    markup += `<page size='A4'><img src='${img.src}'/></page>`
  })

  document.body.innerHTML = markup;
  document.title = filename;

  window.print();
}



const handler = function (data) {
  if(data.method === 'fetchImages'){
    const images = fetchImages();
    
    return Promise.resolve(images)
  }

  else if(data.method === 'generatePDF'){
    generatePDF(data.filename, data.images)
  }

  return false;
}

browser.runtime.onMessage.addListener(handler)