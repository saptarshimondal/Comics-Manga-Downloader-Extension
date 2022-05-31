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



const handler = function (data) {
  if(data.method === 'fetchImages'){
    const images = fetchImages();
    
    return Promise.resolve(images)
  }
}

browser.runtime.onMessage.addListener(handler)