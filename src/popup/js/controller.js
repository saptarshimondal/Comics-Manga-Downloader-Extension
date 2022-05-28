import ImagesView from './views/ImagesView';
import DownloadView from './views/DownloadView';
import SearchView from './views/SearchView';
import { fetchImages, getState, setState } from './model';
import { dump } from './helpers';
import imagesHTML from '../images.html';

const imagesController = async function () {

	ImagesView.showLoader();

	const response = await fetchImages();


	if(!response){
		ImagesView.showError();
	}
	else{
		const images = response.filter(i => i.src !== "")
		ImagesView.render(images)
		DownloadView.render(images);
	}
};


const imagesSelectionController = function (id, checked) {

	const images = getState('filteredImages')

	images[id].checked = checked

	setState('images', images)
};


const downloaderController = async function () {

	try {
		const images = getState('filteredImages').filter(img => img.checked)

		const code = `
			const images = JSON.parse('${JSON.stringify(images)}')		
			
			let markup = "";

			images.forEach(function (img) {

				markup += "<page size='A4'><img src='"+img.src+"'/></page>"
			})

			document.body.innerHTML = markup;
			document.title = "Demo Title";

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
	// console.log(e.target.value)
	const query = setState('query', e.target.value);
	let images = getState('images');

	const filteredImages = images.filter(img => img.src.includes(query)).map(({src}) => {
		return {'src': src, 'checked': true}
	})

	setState('filteredImages', filteredImages);
	ImagesView.render(filteredImages);

}


export const selectAllController = function (checkVal) {
	dump(checkVal);
}


export const init = function () {
	ImagesView.addHandlerRender(imagesController);
	ImagesView.addHandlerSelection(imagesSelectionController);
	ImagesView.addHandlerSelectAll(selectAllController);
	DownloadView.addHandlerDownloader(downloaderController);
	SearchView.addHandlerSearch(searchController);

};