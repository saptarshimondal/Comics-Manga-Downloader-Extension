import View from './View';

class DownloadView extends View {

	constructor(selector){
		super(selector);
		this._fileName = document.querySelector('#fileName')
	}

	_buildMarkUp(){

		// console.log(this._data, this._data.some(img => !img.checked));

		if(this._data.some(img => img.checked === true)){
			this._parent.removeAttribute('disabled');
		}
		else{
			this._parent.setAttribute('disabled', 'disabled');
		}
	}

	addHandlerDownloader(handler){		
		this._parent.addEventListener('click', async () => {
			if(this._fileName.value){				
				await handler(this._fileName.value);
				window.close();
			}
			else{
				this._fileName.focus();
			}
		});	
	}
}

export default new DownloadView('#download');