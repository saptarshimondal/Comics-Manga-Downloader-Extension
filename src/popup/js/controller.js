import ImagesView from './views/ImagesView';
import DownloadView from './views/DownloadView';
import SearchView from './views/SearchView';
import SelectAllCheckBoxView from './views/SelectAllCheckBoxView';
import { fetchImages, getState, setState } from './model';
import { dump } from './helpers';
import imagesHTML from '../images.html';

const imagesController = async function () {

	ImagesView.showLoader();

	const response = await fetchImages();


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

const downloaderController = async function (fileName) {

	try {
		const images = getState('filteredImages').filter(img => img.checked)

		const code = `

			const images = JSON.parse('${JSON.stringify(images)}')		
			
			let markup = "";

			images.forEach(function (img) {

				markup += "<page size='A4'><img src='"+img.src+"'/></page>"
			})

			document.body.innerHTML = markup;
			document.title = "${fileName}";

			window.print();

		`;

		await browser.tabs.create({url: imagesHTML})

		return browser.tabs.executeScript({
			code: code
		});
	} catch(e) {
		throw e;
		console.error(e);
	}

};


export const searchController = function (e) {
	const query = setState('query', e.target.value);
	let images = getState('images');

	const filteredImages = images.filter(img => img.src.includes(query)).map(({src}) => {
		return {'src': src, 'checked': true}
	})

	setState('filteredImages', filteredImages);
	ImagesView.render(filteredImages);
	SelectAllCheckBoxView.render(filteredImages);
	DownloadView.render(filteredImages);

}

export const clearSearchController = async function (){
	setState('query', '');
	await imagesController();
}


export const init = function () {
	ImagesView.addHandlerRender(imagesController);
	ImagesView.addHandlerSelection(imagesSelectionController);
	SelectAllCheckBoxView.addHandlerSelectAll(selectAllController);
	DownloadView.addHandlerDownloader(downloaderController);
	SearchView.addHandlerSearch(searchController);
	SearchView.addHandlerClearSearch(clearSearchController);

};