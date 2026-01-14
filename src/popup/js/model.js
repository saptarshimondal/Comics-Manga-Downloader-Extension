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
	// Preserve all fields including optimization data (originalSrc, width, height)
	setState('filteredImages', images.map((img) => {
		const {src, type, originalSrc, width, height} = img;
		const result = {
			'src': src, 
			'type': type,
			'checked': true
		};
		// Preserve optimization data if available
		if (originalSrc) result.originalSrc = originalSrc;
		if (width) result.width = width;
		if (height) result.height = height;
		return result;
	}));
	setState('imageDimensions', {});
	setState('selectedDimensionFilters', []);

	return true;

}