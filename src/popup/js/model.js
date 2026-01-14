import contentScript from '../../content/index.js';

const state = {
	data: [
		{ 'title': '' },
		{ 'images': [] },
		{ 'filteredImages': [] },
		{ 'query': '' },
		{ 'imageDimensions': {} }, // Store dimensions by image key (src|type): { 'url1|url': '100x200', 'data1|data': '500x500', ... }
		{ 'selectedDimensionFilters': [] }, // Currently selected dimension filters (array for multiple selection)
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
	setState('imageDimensions', {});
	setState('selectedDimensionFilters', []);

	return true;

}