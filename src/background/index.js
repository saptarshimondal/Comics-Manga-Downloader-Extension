import { getBase64Image, getBase64ImageMime } from '../popup/js/helpers';


const getImagesData = async (images) => {
  let image = undefined,
      mime = undefined;

  const promises = images.map(async ({src, type, checked}) => {

    if(type === 'url'){

      image = await getBase64Image(src)

      return {
        'src': image.data,
        'mime': image.mime,
        'type': type,
        'checked': checked
      }
    }
    else{ 
      mime = getBase64ImageMime(src);
      return {src, mime, type, checked};
    }
  });

  return await Promise.all(promises);
}


browser.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(async data => {
    
    if(data.method === 'getImagesData'){
      const images = await getImagesData(data.images);

      console.log('Sending Images data -')
      console.log(images)
      port.postMessage({ type: 'success', 'data': images });
    }
  });
});