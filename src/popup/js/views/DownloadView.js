import View from './View';

class DownloadView extends View {

	constructor(selector){
		super(selector);
		this._fileName = document.querySelector('#fileName')
		this._downloadType = document.querySelector('#downloadType')
		this._overlay = document.querySelector('#downloading_overlay')
		this._progressFill = document.querySelector('#download_progress_fill')
		this._progressText = document.querySelector('#download_progress_text')
		this._errorMessage = document.querySelector('#download_error_message')
		this._isDownloading = false
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

	showDownloadingOverlay() {
		this._isDownloading = true
		this._parent.disabled = true
		this._parent.value = 'Downloading...'
		this._overlay.classList.add('show')
		this._errorMessage.classList.remove('show')
		this._errorMessage.textContent = ''
		this._updateProgress(0, 'Preparing download...')
	}

	hideDownloadingOverlay() {
		this._isDownloading = false
		this._parent.disabled = false
		this._parent.value = 'Download'
		this._overlay.classList.remove('show')
		this._updateProgress(0, '')
	}

	showError(message) {
		this._errorMessage.textContent = message
		this._errorMessage.classList.add('show')
		this._progressText.textContent = 'Download failed'
		// Re-enable download button after error
		setTimeout(() => {
			this._isDownloading = false
			this._parent.disabled = false
			this._parent.value = 'Download'
		}, 3000)
	}

	_updateProgress(percentage, text) {
		this._progressFill.style.width = `${percentage}%`
		if (text) {
			this._progressText.textContent = text
		}
	}

	updateProgress(percentage, text) {
		this._updateProgress(percentage, text)
	}

	addHandlerDownloader(handler){
		this._parent.addEventListener('click', async () => {
			if(this._isDownloading) return
			
			if(this._fileName.value){
				this.showDownloadingOverlay()
				
				try {
					await handler(this._fileName.value, this._downloadType.value, (progress, text) => {
						// Progress callback for tracking
						if (progress !== undefined) {
							this.updateProgress(progress, text)
						}
					})
					
					// Success - show completion message and close popup
					this._updateProgress(100, 'Download complete!')
					setTimeout(() => {
						// Close the popup window on successful download
						window.close()
					}, 1000)
				} catch(error) {
					console.error('Download error:', error)
					// On error, keep popup open and show error message
					if(this._downloadType.value === 'jspdf') {
						this.showError('Direct download does not work, please use built in browser download.')
					} else {
						this.showError('Download failed. Please try again.')
					}
				}
			}
			else{
				this._fileName.focus();
			}
		});	
	}
}

export default new DownloadView('#download');