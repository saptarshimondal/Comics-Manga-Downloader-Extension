export default class View {
	// _parent;
	// _data;
	// _defaultErrorMsg;

	constructor(selector){
		this._defaultErrorMsg = "Something went wrong!!";
		this._parent = document.querySelector(selector);
	}

	showLoader() {
	  const markup = `Loading...`;

	  this._clear();

	  this._appendMarkup(markup);
	}

	showError(msg){
		const markup = `${msg ? msg : this._defaultErrorMsg}`;

	  this._clear();

	  this._appendMarkup(markup);	
	}

	_clear(){
		this._parent.innerHTML = '';
	}

	_appendMarkup(markup){
		this._parent.insertAdjacentHTML('afterbegin', markup);
	}

	render(data){
		this._data = data;

		const markup = this._buildMarkUp();


		this._clear();
		this._appendMarkup(markup);
	}
};