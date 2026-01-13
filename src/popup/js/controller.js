import ImagesView from './views/ImagesView';
import DownloadView from './views/DownloadView';
import SearchView from './views/SearchView';
import SelectAllCheckBoxView from './views/SelectAllCheckBoxView';
import { initState, getState, setState } from './model';
import { dump } from './helpers';

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
	SelectAllCheckBoxView.render(images);
	DownloadView.render(images);
};


export const selectAllController = function (checkVal) {

	let images = getState('filteredImages');
	images = images.map(({src, type, checked}) => {
		return {
			'src': src, 
			'type': type, 
			'checked': checkVal
		}
	})

	setState('filteredImages', images);

	SelectAllCheckBoxView.render(images);
	ImagesView.render(images);
	DownloadView.render(images);
}

const downloaderController = async function (fileName, downloadType, callback = ()=>{}) {

	try {
		const images = getState('filteredImages').filter(img => img.checked);

		const [tab] = await browser.tabs.query({active: true, currentWindow: true});

		await browser.tabs.executeScript(tab.id, {
			file: './content.bundle.js'
		});

		callback();	

		const imagesData =  await browser.tabs.sendMessage(tab.id, {
			"method": "generatePDF", 
			"fileName": fileName,
			"downloadType": downloadType,
			"images": images
		});

	} catch(e) {
		console.error(e);
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
	filteredImages = filteredImages.map(({src, type}) => {
		const key = `${src}|${type}`;
		const wasChecked = checkedStateMap.has(key) ? checkedStateMap.get(key) : true;
		return {'src': src, 'type': type, 'checked': wasChecked}
	});

	setState('filteredImages', filteredImages);
	ImagesView.render(filteredImages);
	SelectAllCheckBoxView.render(filteredImages);
	DownloadView.render(filteredImages);
}

export const searchController = function (e) {
	setState('query', e.target.value);
	applyFilters();
}

export const clearSearchController = function (){
	setState('query', '');
}

export const dimensionFilterController = function (selectedDimensions) {
	setState('selectedDimensionFilters', selectedDimensions);
	applyFilters();
}


export const downloadSingleImageController = async function (url) {

	const image = await fetch(url)
  	const imageBlob = await image.blob()
  	const imageURL = URL.createObjectURL(imageBlob)

  	const title = getState('title');

  	return {title, imageURL};
}


export const init = function ({images, title}) {
	initState({images, title})
	// ImagesView.addHandlerRender(imagesController);
	imagesController();
	ImagesView.addHandlerSelection(imagesSelectionController);
	ImagesView.addHandlerDownloadSingleImage(downloadSingleImageController);
	ImagesView.addHandlerDimensionFilter(dimensionFilterController);
	SelectAllCheckBoxView.addHandlerSelectAll(selectAllController);
	DownloadView.addHandlerDownloader(downloaderController);
	SearchView.addHandlerSearch(searchController);
	SearchView.addHandlerClearSearch(clearSearchController);

};