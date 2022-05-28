import View from './View';

class DownloadView extends View {

	constructor(selector){
		super(selector);
		this._fileName = document.querySelector('#fileName')
	}

	_buildMarkUp(){

		if(!this._data.some(img => !img.checked)){
			this._parent.removeAttribute('disabled');
		}
		else{
			this._parent.setAttribute('disabled', 'disabled');
		}
	}

	addHandlerDownloader(handler){

		const fileName = this._fileName.value;


		this._parent.addEventListener('click', () => {
		console.log(fileName)
			// dump(this._fileName.value, true)
			// handler();
		})	
	}
}

export default new DownloadView('#download');