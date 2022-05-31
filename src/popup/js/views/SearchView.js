import View from "./View";
import {dump, triggerEvent} from '../helpers'; 

class SearchView extends View {

	constructor(selector){
		super(selector);
		this._clearQuery = document.querySelector('#clearQuery')
	}

	_buildMarkUp(){

	}

	addHandlerSearch(handler){
		this._parent.addEventListener('keyup', handler);
	}
	addHandlerClearSearch(handler){
		this._clearQuery.addEventListener('click', () => {
			handler();
			this._parent.value = "";
			triggerEvent(this._parent, "keyup")
		});
	}
}

export default new SearchView('#query')