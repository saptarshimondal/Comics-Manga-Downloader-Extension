import View from "./View";
import {dump} from '../helpers'; 

class SearchView extends View {
	_buildMarkUp(){

	}

	addHandlerSearch(handler){
		this._parent.addEventListener('keyup', handler);
	}
}

export default new SearchView('#query')