import contentScript from '../../content/index.js';

const state = {
	data: [
		{ 'images': [] },
		{ 'filteredImages': [] },
		{ 'query': '' },
	]
};

export const setState = (key, value) => {
	return state.data[key] = value;
};

export const getState = (key) => {
	return state.data[key] ? state.data[key] : null;
};


export const fetchImages = async () => {
	const getAllImageUrls = `
		if(typeof imgs !== undefined){

			const imgs = document.querySelectorAll("img"); 

			const imgData = [];

			for(let img of imgs){
				imgData.push(img.src)
			}

			const canvases = document.querySelectorAll('canvas');

			for(let canvas of canvases){
				imgData.push(canvas.toDataURL('image/jpeg'))
			}

			imgData;
		}
		else{
			imgData;
		}
	`;

	try {
		const images = await browser.tabs.executeScript({
		  code: getAllImageUrls
		  // file: contentScript
		});

		if(typeof images[0] !== 'object'){
			return false;
		}

		const imgData = [];

		images[0].forEach(function (img) {
			imgData.push({
				'src': img,
			})
		})


		setState('images', imgData);
		setState('filteredImages', imgData.map(({src}) => {
			return {'src': src, 'checked': true}
		}));

		return getState('filteredImages');

	} catch(e) {
		throw e;
	}
}