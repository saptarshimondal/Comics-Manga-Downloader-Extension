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
		const checkBoxMarkup = this._data.length > 2 ? this._buildSelectCheckBoxMarkup() : '';
		const imagesMarkup = this._buildImagesMarkup();

		return checkBoxMarkup+imagesMarkup;
	}

	_buildSelectCheckBoxMarkup(){
		const markup = `
			<label class="select_all_checkbox" title="">
	      <input type="checkbox" id="selectAllCheckBox" checked style="margin-left: 0px;">Select all (${this._data.filter(i => i.checked === true).length} / ${this._data.length})
	    </label>
		`;

		return markup.trim();
	}

	_buildImagesMarkup(){
		let markup = ``;

		this._data.forEach(function (img, i) {
			markup += `<div data-id="${i}" id="card_${i}" class="card ${ img.checked ? 'checked' : '' }" style="min-height: 200px;"><img src="${img.src}" style="min-width: 50px; max-width: 200px;">
                <div class="checkbox"></div>
                <div class="actions">
                  <button type="button" title="Open in new tab" style="background-image: url(${openIcon});"></button>
                  <button type="button" title="Download" style="background-image: url(${downloadIcon});"></button>
                </div>
                <div class="image_url_container"><input type="text" readonly='true' value="${img.src}"></div>
          	</div>`;
		});



		return markup.trim();
	}

	addHandlerRender(handler){
		['load'].forEach(ev => window.addEventListener(ev, handler))
	}

	addHandlerSelection(handler){
		this._parent.addEventListener('click', function (e) {

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

	}


	addHandlerSelectAll(handler){
		/*this._selectAllCheckBox = document.querySelector('#selectAllCheckBox');

		dump(this._selectAllCheckBox., true)*/
		
		/*this._selectAllCheckBox.addEventListener('change', function (e) {
			dump(e.target.classList, true)
			// handler(true)
		})*/
	}

}

export default new ImagesView("#images_container");