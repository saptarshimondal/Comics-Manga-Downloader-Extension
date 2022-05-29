import View from './View';

class SelectAllCheckBoxView extends View {
	_buildMarkUp(){
		const selected = this._data.filter(i => i.checked === true).length;
		const total = this._data.length;

		const markup = this._data.length > 2 ? `
			<label class="select_all_checkbox" title="">
	      		<input type="checkbox" id="selectAllCheckBox" ${ selected === total ? 'checked' : ''} style="margin-left: 0px;">Select all (${selected} / ${total})
	    	</label>
		` : '';

		return markup.trim();
	}

	addHandlerSelectAll(handler){
		// this._selectAllCheckBox = document.querySelector('#selectAllCheckBox');

		// dump(this._parent, true);

		this._parent.addEventListener('change', (e) => {
			if(e.target.id === 'selectAllCheckBox'){
				handler(e.target.checked)
			}

		})
	}
}

export default new SelectAllCheckBoxView('#select_all_checkbox_container');