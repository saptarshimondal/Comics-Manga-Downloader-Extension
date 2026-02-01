import ImagesView from './views/ImagesView';
import DownloadView from './views/DownloadView';
import SearchView from './views/SearchView';
import SelectAllCheckBoxView from './views/SelectAllCheckBoxView';
import { initState, getState, setState, getAppliedFiltersForPage, saveAppliedFiltersForPage, buildAppliedFiltersState } from './model';
import { dump } from './helpers';
import { autoDetectPages } from '../../utils/autoDetectPages';

/** Persist current filters and image selection for the current page */
const persistAppliedFilters = async () => {
	const pageUrl = getState('currentPageUrl');
	if (!pageUrl) return;
	const data = buildAppliedFiltersState();
	await saveAppliedFiltersForPage(pageUrl, data);
};

/** Key for an image in the list (src|type). */
const imageKey = (img) => `${img.src}|${img.type || (img.src && img.src.startsWith('data') ? 'data' : 'url')}`;

/**
 * Run auto-detect on current filteredImages and apply preselection by confidence.
 * confidence >= 0.70: preselect detected pages, no hint.
 * 0.45 <= confidence < 0.70: preselect and show "Low confidence" hint.
 * confidence < 0.45: do not preselect; leave selection as-is (manual).
 */
const runAutoDetectAndApply = () => {
	const enabled = getState('autoDetectEnabled');
	if (enabled === false) return;

	let filteredImages = getState('filteredImages') || [];
	if (!filteredImages.length) return;

	const result = autoDetectPages(filteredImages);
	setState('autoDetectLastResult', result);

	const conf = result.confidence;
	const shouldPreselect = conf >= 0.45;
	const showLowConfidenceHint = conf >= 0.45 && conf < 0.70;

	if (shouldPreselect && result.selected && result.selected.length > 0) {
		const selectedKeys = new Set(result.selected.map(imageKey));
		filteredImages = filteredImages.map((img) => ({
			...img,
			checked: selectedKeys.has(imageKey(img)),
		}));
		setState('filteredImages', filteredImages);
		persistAppliedFilters();
	}

	// Update hint UI
	const hintEl = document.getElementById('autoDetectHint');
	if (hintEl) {
		if (showLowConfidenceHint) {
			hintEl.textContent = 'Low confidence — check selection.';
			hintEl.style.display = '';
		} else {
			hintEl.textContent = '';
			hintEl.style.display = 'none';
		}
	}

	if (result.reason) console.log('[autoDetectPages]', result.reason);

	SelectAllCheckBoxView.render(filteredImages);
	ImagesView.render(filteredImages);
	DownloadView.render(filteredImages);
};

const imagesController = async function () {

	ImagesView.showLoader();

	const response = getState('filteredImages');

	if(!response){
		ImagesView.showError();
	}
	else if(!response.length){
		ImagesView.showError("No images found on this page!");
	}
	else{
		const images = response.filter(i => i.src !== "")
		SelectAllCheckBoxView.render(images)
		ImagesView.render(images);
		DownloadView.render(images);
	}
};


const imagesSelectionController = function (id, checkVal) {

	const images = getState('filteredImages');

	images[id].checked = checkVal;	

	setState('filteredImages', images);
	persistAppliedFilters();
	SelectAllCheckBoxView.render(images);
	DownloadView.render(images);
};


export const selectAllController = function (checkVal) {

	let images = getState('filteredImages');
	// Preserve all fields including optimization data
	images = images.map((img) => {
		const {src, type, originalSrc, width, height} = img;
		const result = {
			'src': src, 
			'type': type, 
			'checked': checkVal
		};
		// Preserve optimization data if available
		if (originalSrc) result.originalSrc = originalSrc;
		if (width) result.width = width;
		if (height) result.height = height;
		return result;
	})

	setState('filteredImages', images);

	persistAppliedFilters();
	SelectAllCheckBoxView.render(images);
	ImagesView.render(images);
	DownloadView.render(images);
}

const downloaderController = async function (baseName, downloadType, downloadFormat, progressCallback = ()=>{}) {

	try {
		const images = getState('filteredImages').filter(img => img.checked);
		const totalImages = images.length;

		if (totalImages === 0) {
			throw new Error('No images selected');
		}

		const [tab] = await browser.tabs.query({active: true, currentWindow: true});

		progressCallback(10, 'Injecting content script...');
		await browser.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['./content.bundle.js']
		});

		progressCallback(20, 'Preparing images...');

		if (downloadType === 'browser') {
			// Browser download - PDF only (CBZ/ZIP use Direct download only)
			progressCallback(50, 'Opening print dialog...');
			await browser.tabs.sendMessage(tab.id, {
				"method": "generatePDF",
				"fileName": baseName,
				"downloadType": downloadType,
				"downloadFormat": "pdf",
				"images": images
			});
			progressCallback(100, 'Print dialog opened!');
		} else if (downloadFormat === 'cbz' || downloadFormat === 'zip') {
			// Archive (CBZ/ZIP) - always Direct download, content script builds zip
			progressCallback(5, 'Preparing to build archive...');
			await browser.tabs.sendMessage(tab.id, {
				"method": "generateArchive",
				"fileName": baseName,
				"downloadFormat": downloadFormat,
				"images": images
			}).then((response) => {
				console.log('Archive generation response:', response);
			}).catch((error) => {
				console.error('Error generating archive:', error);
				throw new Error(error.message || 'Unknown error');
			});
		} else {
			// PDF via JSPDF (Direct download)
			progressCallback(5, 'Preparing to process images...');
			browser.tabs.sendMessage(tab.id, {
				"method": "generatePDF",
				"fileName": baseName,
				"downloadType": downloadType,
				"downloadFormat": "pdf",
				"images": images
			}).then((response) => {
				console.log('PDF generation response:', response);
			}).catch((error) => {
				console.error('Error generating PDF:', error);
				throw new Error('Failed to generate PDF: ' + (error.message || 'Unknown error'));
			});
		}

	} catch(e) {
		console.error('Download error:', e);
		throw e;
	}

};


const applyFilters = function () {
	const query = getState('query') || '';
	const selectedDimensions = getState('selectedDimensionFilters') || [];
	const images = getState('images');
	const imageDimensions = getState('imageDimensions') || {};

	// Apply query filter
	let filteredImages = images.filter(({src, type}) => {
		if(type === 'url'){
			return src.startsWith(query)
		}
		if(type === 'data'){
			return src;
		}
	});

	// Apply dimension filter (multiple dimensions)
	if (selectedDimensions.length > 0) {
		filteredImages = filteredImages.filter((img) => {
			// Use unique key (src|type) to look up dimension
			const imageKey = `${img.src}|${img.type}`;
			const dim = imageDimensions[imageKey];
			// Check if the dimension matches any of the selected dimensions
			// If dimension is not yet loaded (undefined), exclude it from filtered results
			return dim && selectedDimensions.includes(dim);
		});
	}

	// Preserve checked state from current filteredImages if they exist
	const currentFilteredImages = getState('filteredImages') || [];
	const checkedStateMap = new Map();
	currentFilteredImages.forEach(img => {
		checkedStateMap.set(`${img.src}|${img.type}`, img.checked);
	});

	// Map to filteredImages format with checked state (preserve existing checked state)
	// Also preserve originalSrc, width, height if they exist (optimization data from content script)
	filteredImages = filteredImages.map((img) => {
		const {src, type, originalSrc, width, height} = img;
		const key = `${src}|${type}`;
		const wasChecked = checkedStateMap.has(key) ? checkedStateMap.get(key) : true;
		const result = {'src': src, 'type': type, 'checked': wasChecked};
		// Preserve optimization data if available
		if (originalSrc) result.originalSrc = originalSrc;
		if (width) result.width = width;
		if (height) result.height = height;
		return result;
	});

	setState('filteredImages', filteredImages);
	ImagesView.render(filteredImages);
	SelectAllCheckBoxView.render(filteredImages);
	DownloadView.render(filteredImages);
}

export const searchController = function (e) {
	setState('query', e.target.value);
	applyFilters();
	persistAppliedFilters();
}

export const clearSearchController = function (){
	setState('query', '');
}

export const dimensionFilterController = function (selectedDimensions) {
	setState('selectedDimensionFilters', selectedDimensions);
	applyFilters();
	persistAppliedFilters();
}


export const downloadSingleImageController = async function (url) {

	const image = await fetch(url)
  	const imageBlob = await image.blob()
  	const imageURL = URL.createObjectURL(imageBlob)

  	const title = getState('title');

  	return {title, imageURL};
}


export const init = async function ({ images, title, pageUrl }) {
	setState('currentPageUrl', pageUrl || '');

	initState({ images, title });

	const saved = pageUrl ? await getAppliedFiltersForPage(pageUrl) : null;
	if (saved) {
		setState('query', saved.query || '');
		setState('selectedDimensionFilters', Array.isArray(saved.selectedDimensionFilters) ? saved.selectedDimensionFilters : []);
		setState('autoDetectEnabled', saved.autoDetectEnabled !== false);
	} else {
		setState('autoDetectEnabled', true);
	}

	applyFilters();

	if (saved && saved.imageSelection && typeof saved.imageSelection === 'object') {
		let filteredImages = getState('filteredImages') || [];
		filteredImages = filteredImages.map((img) => {
			const key = `${img.src}|${img.type || (img.src.startsWith('data') ? 'data' : 'url')}`;
			if (Object.prototype.hasOwnProperty.call(saved.imageSelection, key)) {
				return { ...img, checked: !!saved.imageSelection[key] };
			}
			return img;
		});
		setState('filteredImages', filteredImages);
	} else if (getState('autoDetectEnabled') !== false) {
		runAutoDetectAndApply();
	}

	// Restore download state first, before rendering
	await DownloadView.restoreDownloadState();

	// Sync URL filter input and dimension filter UI from state
	const queryInput = document.querySelector('#query');
	if (queryInput) queryInput.value = getState('query') || '';
	ImagesView.setSelectedDimensions(getState('selectedDimensionFilters') || []);

	// Sync auto-detect toggle and wire handlers
	const autoDetectToggle = document.getElementById('autoDetectToggle');
	if (autoDetectToggle) {
		autoDetectToggle.checked = getState('autoDetectEnabled') !== false;
		autoDetectToggle.addEventListener('change', () => {
			setState('autoDetectEnabled', autoDetectToggle.checked);
			persistAppliedFilters();
		});
	}
	const autoDetectRescan = document.getElementById('autoDetectRescan');
	if (autoDetectRescan) {
		autoDetectRescan.addEventListener('click', () => runAutoDetectAndApply());
	}

	imagesController();
	ImagesView.addHandlerSelection(imagesSelectionController);
	ImagesView.addHandlerDownloadSingleImage(downloadSingleImageController);
	ImagesView.addHandlerDimensionFilter(dimensionFilterController);
	SelectAllCheckBoxView.addHandlerSelectAll(selectAllController);
	DownloadView.addHandlerDownloader(downloaderController);
	SearchView.addHandlerSearch(searchController);
	SearchView.addHandlerClearSearch(clearSearchController);
};