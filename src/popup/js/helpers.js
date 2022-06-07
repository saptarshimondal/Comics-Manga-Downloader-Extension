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
    return src.startsWith("data") ? 'data' : 'url';
}


const formats={
    png: "iVBORw0KGgo=",
    jpeg: "/9g=",
    gif: "R0lG",
    "svg+xml": "PA=="
};
const defaultFormat="png";

const bytesToBase64=byteArray=>
    btoa(byteArray.reduce((a,e)=>a+String.fromCharCode(e),""))

const getFormat=byteArray=>{
    for(let format in formats){
        let header=formats[format];
        
        if(bytesToBase64(byteArray.slice(0,atob(header).length))==header){
            return format;
        }
    }
    return defaultFormat;
};

export const getBase64Image = async (srcUrl) => {
    let response=await fetch(srcUrl,{
        method:"GET",
        mode:"cors",
        cache:"default"
    });
    let arrayBuffer=await response.arrayBuffer();
    let bytes=[].slice.call(new Uint8Array(arrayBuffer));
    let base64=`data:image/${getFormat(bytes)};base64,`+bytesToBase64(bytes);

    // console.log(srcUrl, base64)

    return {
        "mime": getFormat(bytes), 
        "data": base64
    };
}