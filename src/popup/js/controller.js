import ImagesView from './views/ImagesView';
import DownloadView from './views/DownloadView';
import SearchView from './views/SearchView';
import SelectAllCheckBoxView from './views/SelectAllCheckBoxView';
import { initState, getState, setState, getAppliedFiltersForPage, saveAppliedFiltersForPage, buildAppliedFiltersState } from './model';
import { dump } from './helpers';

/** Persist current filters and image selection for the current page */
const persistAppliedFilters = async () => {
	const pageUrl = getState('currentPageUrl');
	if (!pageUrl) return;
	const data = buildAppliedFiltersState();
	await saveAppliedFiltersForPage(pageUrl, data);
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

const downloaderController = async function (fileName, downloadType, progressCallback = ()=>{}) {

	try {
		const images = getState('filteredImages').filter(img => img.checked);
		const totalImages = images.length;

		if (totalImages === 0) {
			throw new Error('No images selected');
		}

		const [tab] = await browser.tabs.query({active: true, currentWindow: true});

		// Inject content script using Manifest V3 API
		progressCallback(10, 'Injecting content script...');
		await browser.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['./content.bundle.js']
		});

		progressCallback(20, 'Preparing images...');

		if (downloadType === 'browser') {
			// Browser download - simpler, just open print dialog
			progressCallback(50, 'Opening print dialog...');
			await browser.tabs.sendMessage(tab.id, {
				"method": "generatePDF", 
				"fileName": fileName,
				"downloadType": downloadType,
				"images": images
			});
			progressCallback(100, 'Print dialog opened!');
		} else if (downloadType === 'jspdf') {
			// JSPDF download - process images directly in content script to avoid 64MB limit
			progressCallback(5, 'Preparing to process images...');
			
			// Send message to content script to generate PDF
			// Content script will process images directly to avoid 64MB message limit
			// Progress updates will be sent via messages and handled by DownloadView
			browser.tabs.sendMessage(tab.id, {
				"method": "generatePDF", 
				"fileName": fileName,
				"downloadType": downloadType,
				"images": images // Pass original images, content script will process them
			}).then((response) => {
				console.log('PDF generation response:', response);
				// Progress will be updated via messages from content script
				// Don't set to 100% here - let content script send final progress
			}).catch((error) => {
				console.error('Error generating PDF:', error);
				console.error('Error details:', {
					message: error.message,
					stack: error.stack,
					tabId: tab.id
				});
				throw new Error('Failed to generate PDF: ' + (error.message || 'Unknown error'));
			});
		}

	} catch(e) {
		console.error('Download error:', e);
		throw e; // Re-throw to be handled by DownloadView
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
	}

	// Restore download state first, before rendering
	await DownloadView.restoreDownloadState();

	// Sync URL filter input and dimension filter UI from state
	const queryInput = document.querySelector('#query');
	if (queryInput) queryInput.value = getState('query') || '';
	ImagesView.setSelectedDimensions(getState('selectedDimensionFilters') || []);

	imagesController();
	ImagesView.addHandlerSelection(imagesSelectionController);
	ImagesView.addHandlerDownloadSingleImage(downloadSingleImageController);
	ImagesView.addHandlerDimensionFilter(dimensionFilterController);
	SelectAllCheckBoxView.addHandlerSelectAll(selectAllController);
	DownloadView.addHandlerDownloader(downloaderController);
	SearchView.addHandlerSearch(searchController);
	SearchView.addHandlerClearSearch(clearSearchController);
};