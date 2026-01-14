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
		this._progressListener = null
		this._closeTimeout = null
		this._safetyTimeout = null
		this._downloadComplete = false
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
		this._downloadComplete = false
		this._parent.disabled = true
		this._parent.value = 'Downloading...'
		this._overlay.classList.add('show')
		this._errorMessage.classList.remove('show')
		this._errorMessage.textContent = ''
		this._updateProgress(0, 'Preparing download...')
		
		// Clear any existing close timeout
		if (this._closeTimeout) {
			clearTimeout(this._closeTimeout)
			this._closeTimeout = null
		}
		
		// Set up progress message listener
		this._progressListener = (message, sender, sendResponse) => {
			console.log('DownloadView: Received message:', message, 'from:', sender);
			// Handle progress messages
			if (message && message.type === 'downloadProgress') {
				console.log('DownloadView: Progress update received:', message.progress, message.text);
				this.updateProgress(message.progress, message.text)
				
				// If we reached 100%, mark as complete and schedule popup close
				if (message.progress >= 100) {
					console.log('DownloadView: Download complete, closing popup soon');
					this._downloadComplete = true
					// Clear any safety timeout since we got completion
					if (this._safetyTimeout) {
						clearTimeout(this._safetyTimeout)
						this._safetyTimeout = null
					}
					// Close popup after a short delay to show completion message
					this._closeTimeout = setTimeout(() => {
						if (this._downloadComplete) {
							console.log('DownloadView: Closing popup now');
							window.close()
						}
					}, 1000)
				}
				
				if (message.error) {
					// Error occurred during processing
					console.error('DownloadView: Error in progress message:', message.error);
					this.showError(message.error)
					this._downloadComplete = false
					if (this._closeTimeout) {
						clearTimeout(this._closeTimeout)
						this._closeTimeout = null
					}
					if (this._safetyTimeout) {
						clearTimeout(this._safetyTimeout)
						this._safetyTimeout = null
					}
				}
			}
			// Return true to indicate we might send a response asynchronously
			return false;
		}
		browser.runtime.onMessage.addListener(this._progressListener)
		console.log('DownloadView: Progress listener added');
		
		// Safety timeout: if we don't get 100% within 5 minutes, assume something went wrong
		// This prevents the popup from staying open forever
		this._safetyTimeout = setTimeout(() => {
			if (!this._downloadComplete && this._isDownloading) {
				console.warn('Download timeout - no completion message received')
				// Don't close, but show a message that something might be wrong
				// The user can manually close if needed
			}
		}, 300000) // 5 minutes
	}

	hideDownloadingOverlay() {
		this._isDownloading = false
		this._downloadComplete = false
		this._parent.disabled = false
		this._parent.value = 'Download'
		this._overlay.classList.remove('show')
		this._updateProgress(0, '')
		
		// Clear close timeout
		if (this._closeTimeout) {
			clearTimeout(this._closeTimeout)
			this._closeTimeout = null
		}
		
		// Clear safety timeout
		if (this._safetyTimeout) {
			clearTimeout(this._safetyTimeout)
			this._safetyTimeout = null
		}
		
		// Remove progress listener
		if (this._progressListener) {
			browser.runtime.onMessage.removeListener(this._progressListener)
			this._progressListener = null
		}
	}

	showError(message) {
		this._errorMessage.textContent = message
		this._errorMessage.classList.add('show')
		this._progressText.textContent = 'Download failed'
		this._downloadComplete = false
		
		// Clear close timeout on error
		if (this._closeTimeout) {
			clearTimeout(this._closeTimeout)
			this._closeTimeout = null
		}
		
		// Clear safety timeout on error
		if (this._safetyTimeout) {
			clearTimeout(this._safetyTimeout)
			this._safetyTimeout = null
		}
		
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
						// Progress callback for initial setup (before content script takes over)
						if (progress !== undefined) {
							this.updateProgress(progress, text)
						}
					})
					
					// For jspdf downloads, don't close immediately - wait for 100% progress message
					// The progress listener will handle closing when it receives 100%
					if (this._downloadType.value !== 'jspdf') {
						// For browser downloads, close after a short delay
						setTimeout(() => {
							window.close()
						}, 1000)
					}
					// For jspdf, the progress listener will close when it gets 100%
				} catch(error) {
					console.error('Download error:', error)
					console.error('Error details:', {
						message: error.message,
						stack: error.stack,
						name: error.name
					})
					// Clear timeouts on error
					if (this._closeTimeout) {
						clearTimeout(this._closeTimeout)
						this._closeTimeout = null
					}
					if (this._safetyTimeout) {
						clearTimeout(this._safetyTimeout)
						this._safetyTimeout = null
					}
					
					// Remove progress listener on error
					if (this._progressListener) {
						browser.runtime.onMessage.removeListener(this._progressListener)
						this._progressListener = null
					}
					// On error, keep popup open and show error message
					if(this._downloadType.value === 'jspdf') {
						// Show more specific error message if available
						const errorMsg = error.message || 'Unknown error';
						if (errorMsg.includes('No valid images')) {
							this.showError(errorMsg);
						} else {
							this.showError('Direct download does not work, please use built in browser download.')
						}
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