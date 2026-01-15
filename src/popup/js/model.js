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

// Storage functions for persisting download state across popup sessions
const DOWNLOAD_STATE_KEY = 'downloadState';

// Get the storage API (browser.storage or chrome.storage)
const getStorage = () => {
	if (typeof browser !== 'undefined' && browser.storage) {
		return browser.storage.local;
	} else if (typeof chrome !== 'undefined' && chrome.storage) {
		return chrome.storage.local;
	} else {
		console.error('Storage API not available');
		return null;
	}
};

export const saveDownloadState = async (state) => {
	try {
		const storage = getStorage();
		if (!storage) {
			console.warn('Storage not available, cannot save download state');
			return;
		}
		console.log('Saving download state:', state);
		await storage.set({ [DOWNLOAD_STATE_KEY]: state });
		console.log('Download state saved successfully');
	} catch (error) {
		console.error('Error saving download state:', error);
	}
};

export const getDownloadState = async () => {
	try {
		const storage = getStorage();
		if (!storage) {
			console.warn('Storage not available, cannot get download state');
			return null;
		}
		const result = await storage.get(DOWNLOAD_STATE_KEY);
		console.log('Retrieved download state:', result[DOWNLOAD_STATE_KEY]);
		return result[DOWNLOAD_STATE_KEY] || null;
	} catch (error) {
		console.error('Error getting download state:', error);
		return null;
	}
};

export const clearDownloadState = async () => {
	try {
		const storage = getStorage();
		if (!storage) {
			console.warn('Storage not available, cannot clear download state');
			return;
		}
		await storage.remove(DOWNLOAD_STATE_KEY);
	} catch (error) {
		console.error('Error clearing download state:', error);
	}
};