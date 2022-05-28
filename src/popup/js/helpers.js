export const getBase64Image = (img) => {
  var canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL();
}

export const imageUrlToBase64 = async (url) => {

    const data = await fetch(url);
    const blob = await data.blob();
    const reader = new FileReader();
    reader.readAsDataURL(blob);

    return reader;
    /*reader.onload = () => {
        const base64data = reader.result;
        return base64data;
    }*/
}

export const dump = function (variable, type = false) {
    const op = JSON.stringify(variable, null, 4)
    console.log(type ? `(${typeof variable}) ${op}` : op)
}
