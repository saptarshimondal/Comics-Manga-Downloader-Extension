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

export const hasSomeParentTheClass = function(element, classname) {
    try {
        if (element.className.split(' ').indexOf(classname)>=0) return true;
        return element.parentNode && hasSomeParentTheClass(element.parentNode, classname);
    } catch(e) {        
        // console.log(e);
        return false
    }
}

export const triggerEvent = function (el, type) {
    // IE9+ and other modern browsers
    if ('createEvent' in document) {
        var e = document.createEvent('HTMLEvents');
        e.initEvent(type, false, true);
        el.dispatchEvent(e);
    } else {
        // IE8
        var e = document.createEventObject();
        e.eventType = type;
        el.fireEvent('on' + e.eventType, e);
    }
}


export const srcType = (src) => {
    return src.startsWith("http") ? 'url' : 'data';
}
