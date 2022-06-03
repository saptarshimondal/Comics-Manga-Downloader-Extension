import contentScript from '../../content/index.js';

const state = {
	data: [
		{ 'title': '' },
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


export const initState = ({images, title}) => {

	setState('title', title);
	setState('images', images);
	setState('filteredImages', images.map(({src, type}) => {
		return {
			'src': src, 
			'type': type,
			'checked': true
		}
	}));

	return true;

}