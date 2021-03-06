import View from './View';
import openIcon from '../../images/open.svg';
import downloadIcon from '../../images/download.svg';
import { dump, hasSomeParentTheClass } from '../helpers';

class ImagesView extends View {

	constructor(selector){
		super(selector);
		this._card = this._parent.querySelector('.card');
	}

	_buildMarkUp(){
		let markup = ``;

		this._data.forEach(function (img, i) {
			markup += `
							<div data-id="${i}" id="card_${i}" class="card ${ img.checked ? 'checked' : '' }" style="min-height: 200px;"><img src="${img.src}" style="min-width: 50px; max-width: 200px;">
                <div class="checkbox"></div>
                <div class="actions">
                  <button type="button" data-url="${img.src}" class="open_image" title="Open in new tab" style="background-image: url(${openIcon});"></button>
                  <button type="button" data-url="${img.src}" class="download_image" title="Download" style="background-image: url(${downloadIcon});"></button>
                </div>
                <div class="image_url_container"><input type="text" readonly='true' value="${img.src}"></div>
          		</div>
      `;
		});

		return markup.trim();
	}

	addHandlerRender(handler){
		['load'].forEach(ev => window.addEventListener(ev, handler))
	}

	addHandlerSelection(handler){
		this._parent.addEventListener('click', (e) => {

			if(hasSomeParentTheClass(e.target, 'card') 
				&& e.target.nodeName !== "BUTTON" 
				&& e.target.nodeName !== "INPUT"){

				const card = e.target.closest('div.card');

				if(card.classList.contains('checked')){
					card.classList.remove('checked')

					handler(Number(card.dataset.id), false);
				}
				else{
					card.classList.add('checked')
					handler(Number(card.dataset.id), true);
				}

			}
		});

		this._addHandlerOpenSingleImage();
	}

	_addHandlerOpenSingleImage(){
		this._parent.addEventListener('click', function(e){
			if(e.target.classList.contains('open_image')){
				window.open(e.target.dataset.url, '_blank');
				window.close()
			}
		})
	}

	addHandlerDownloadSingleImage(handler){
		this._parent.addEventListener('click', async function(e){
			if(e.target.classList.contains('download_image')){

			  const {title, imageURL} = await handler(e.target.dataset.url)

			  const link = document.createElement('a')
			  link.href = imageURL;
			  link.download = title;
			  document.body.appendChild(link);
			  link.click();
			  document.body.removeChild(link);
			}
		})
	}

}

export default new ImagesView("#images_container");