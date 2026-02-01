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
	return Object.prototype.hasOwnProperty.call(state.data, key) ? state.data[key] : null;
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
	// Populate imageDimensions from content script data so dimension filter works on restore
	const imageDimensions = {};
	images.forEach((img) => {
		const w = img.width;
		const h = img.height;
		if (w != null && h != null && Number(w) > 0 && Number(h) > 0) {
			const imgType = img.type || (img.src && img.src.startsWith('data') ? 'data' : 'url');
			const key = `${img.src}|${imgType}`;
			imageDimensions[key] = `${Number(w)}x${Number(h)}`;
		}
	});
	setState('imageDimensions', imageDimensions);
	setState('selectedDimensionFilters', []);

	return true;

}

// Storage functions for persisting download state per tab (each tab has its own download state)
const DOWNLOAD_STATE_BY_TAB_KEY = 'downloadStateByTab';

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

export const saveDownloadState = async (tabId, state) => {
	try {
		const storage = getStorage();
		if (!storage) {
			console.warn('Storage not available, cannot save download state');
			return;
		}
		const result = await storage.get(DOWNLOAD_STATE_BY_TAB_KEY);
		const byTab = result[DOWNLOAD_STATE_BY_TAB_KEY] || {};
		byTab[tabId] = state;
		await storage.set({ [DOWNLOAD_STATE_BY_TAB_KEY]: byTab });
	} catch (error) {
		console.error('Error saving download state:', error);
	}
};

export const getDownloadState = async (tabId) => {
	try {
		const storage = getStorage();
		if (!storage) {
			console.warn('Storage not available, cannot get download state');
			return null;
		}
		const result = await storage.get(DOWNLOAD_STATE_BY_TAB_KEY);
		const byTab = result[DOWNLOAD_STATE_BY_TAB_KEY] || {};
		return byTab[tabId] || null;
	} catch (error) {
		console.error('Error getting download state:', error);
		return null;
	}
};

export const clearDownloadState = async (tabId) => {
	try {
		const storage = getStorage();
		if (!storage) {
			console.warn('Storage not available, cannot clear download state');
			return;
		}
		const result = await storage.get(DOWNLOAD_STATE_BY_TAB_KEY);
		const byTab = result[DOWNLOAD_STATE_BY_TAB_KEY] || {};
		delete byTab[tabId];
		await storage.set({ [DOWNLOAD_STATE_BY_TAB_KEY]: byTab });
	} catch (error) {
		console.error('Error clearing download state:', error);
	}
};

// Per-page applied filters and image selection (URL filter, dimension filter, checked state)
const APPLIED_FILTERS_STORAGE_KEY = 'appliedFiltersByPage';

export const getAppliedFiltersForPage = async (pageUrl) => {
	try {
		const storage = getStorage();
		if (!storage) return null;
		const result = await storage.get(APPLIED_FILTERS_STORAGE_KEY);
		const byPage = result[APPLIED_FILTERS_STORAGE_KEY] || {};
		return byPage[pageUrl] || null;
	} catch (error) {
		console.error('Error getting applied filters for page:', error);
		return null;
	}
};

export const saveAppliedFiltersForPage = async (pageUrl, data) => {
	try {
		const storage = getStorage();
		if (!storage) return;
		const result = await storage.get(APPLIED_FILTERS_STORAGE_KEY);
		const byPage = result[APPLIED_FILTERS_STORAGE_KEY] || {};
		byPage[pageUrl] = data;
		await storage.set({ [APPLIED_FILTERS_STORAGE_KEY]: byPage });
	} catch (error) {
		console.error('Error saving applied filters for page:', error);
	}
};

// User's preferred "Download as" format (global; cbz / pdf / zip)
const PREFERRED_DOWNLOAD_FORMAT_KEY = 'preferredDownloadFormat';
export const VALID_FORMATS = ['cbz', 'pdf', 'zip'];
export const DEFAULT_DOWNLOAD_FORMAT = 'cbz';

export const getPreferredDownloadFormat = async () => {
	try {
		const storage = getStorage();
		if (!storage) return DEFAULT_DOWNLOAD_FORMAT;
		const result = await storage.get(PREFERRED_DOWNLOAD_FORMAT_KEY);
		const value = result[PREFERRED_DOWNLOAD_FORMAT_KEY];
		if (value && VALID_FORMATS.includes(value)) return value;
		return DEFAULT_DOWNLOAD_FORMAT;
	} catch (error) {
		console.error('Error getting preferred download format:', error);
		return DEFAULT_DOWNLOAD_FORMAT;
	}
};

export const savePreferredDownloadFormat = async (format) => {
	if (!format || !VALID_FORMATS.includes(format)) return;
	try {
		const storage = getStorage();
		if (!storage) return;
		await storage.set({ [PREFERRED_DOWNLOAD_FORMAT_KEY]: format });
	} catch (error) {
		console.error('Error saving preferred download format:', error);
	}
};

/** Build current applied filter + image selection state for persistence */
export const buildAppliedFiltersState = () => {
	const query = getState('query') || '';
	const selectedDimensionFilters = getState('selectedDimensionFilters') || [];
	const autoDetectEnabled = getState('autoDetectEnabled');
	const filteredImages = getState('filteredImages') || [];
	const imageSelection = {};
	filteredImages.forEach((img) => {
		const key = `${img.src}|${img.type || (img.src.startsWith('data') ? 'data' : 'url')}`;
		imageSelection[key] = !!img.checked;
	});
	return { query, selectedDimensionFilters, imageSelection, autoDetectEnabled };
};