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

		// Inject content script using Manifest V3 API
		await browser.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['./content.bundle.js']
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


export const searchController = function (e) {
	const query = setState('query', e.target.value);
	let images = getState('images');

	const filteredImages = images.filter(({src, type}) => {
		if(type === 'url'){
			return src.startsWith(query)
		}
		if(type === 'data'){
			return src;
		}
	}).map(({src, type}) => {
		return {'src': src, 'type': type, 'checked': true}
	})

	setState('filteredImages', filteredImages);
	ImagesView.render(filteredImages);
	SelectAllCheckBoxView.render(filteredImages);
	DownloadView.render(filteredImages);

}

export const clearSearchController = function (){
	setState('query', '');
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
	SelectAllCheckBoxView.addHandlerSelectAll(selectAllController);
	DownloadView.addHandlerDownloader(downloaderController);
	SearchView.addHandlerSearch(searchController);
	SearchView.addHandlerClearSearch(clearSearchController);

};