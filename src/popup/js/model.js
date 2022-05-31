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


export const initState = (images) => {
	const imgData = [];

	images.forEach(function (img) {
		imgData.push({
			'src': img,
		})
	})


	setState('images', imgData);
	setState('filteredImages', imgData.map(({src}) => {
		return {'src': src, 'checked': true}
	}));

	return true;

}