import ImagesView from './views/ImagesView';
import DownloadView from './views/DownloadView';
import SearchView from './views/SearchView';
import SelectAllCheckBoxView from './views/SelectAllCheckBoxView';
import { initState, getState, setState } from './model';
import { dump } from './helpers';
import contentScript from '../../content/index.js';

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
	images = images.map(({src, checked}) => {
		return {'src': src, 'checked': checkVal}
	})

	setState('filteredImages', images);

	SelectAllCheckBoxView.render(images);
	ImagesView.render(images);
	DownloadView.render(images);
}

const downloaderController = async function (fileName, callback) {

	try {
		const images = getState('filteredImages').filter(img => img.checked);

		const [tab] = await browser.tabs.query({active: true, currentWindow: true});

		await browser.tabs.executeScript(tab.id, {
			file: contentScript
		});

		callback();

		return browser.tabs.sendMessage(tab.id, {
			"method": "generatePDF", 
			"filename": fileName,
			"images": images
		});

	} catch(e) {
		// throw e;
		console.error(e);
	}

};


export const searchController = function (e) {
	const query = setState('query', e.target.value);
	let images = getState('images');

	const filteredImages = images.filter(img => img.src.startsWith(query)).map(({src}) => {
		return {'src': src, 'checked': true}
	})

	setState('filteredImages', filteredImages);
	ImagesView.render(filteredImages);
	SelectAllCheckBoxView.render(filteredImages);
	DownloadView.render(filteredImages);

}

export const clearSearchController = function (){
	setState('query', '');
}


export const init = function (images) {
	initState(images)
	// ImagesView.addHandlerRender(imagesController);
	imagesController();
	ImagesView.addHandlerSelection(imagesSelectionController);
	SelectAllCheckBoxView.addHandlerSelectAll(selectAllController);
	DownloadView.addHandlerDownloader(downloaderController);
	SearchView.addHandlerSearch(searchController);
	SearchView.addHandlerClearSearch(clearSearchController);

};