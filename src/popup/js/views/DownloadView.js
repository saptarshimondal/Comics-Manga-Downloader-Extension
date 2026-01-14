import View from './View';
import { getState } from '../model';

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
	
	// Set fileName from page title (sanitized for filename)
	_setFileNameFromTitle() {
		if (!this._fileName) return;
		
		const title = getState('title');
		if (title && title.trim()) {
			// Sanitize title for use as filename (compatible with Windows, Linux, macOS)
			let sanitized = this._sanitizeFileName(title.trim());
			
			// Set value only if field is empty (don't overwrite user input)
			if (!this._fileName.value || this._fileName.value.trim() === '') {
				this._fileName.value = sanitized;
			}
		} else {
			// Title is missing, ensure field is blank
			if (!this._fileName.value || this._fileName.value.trim() === '') {
				this._fileName.value = '';
			}
		}
	}
	
	// Sanitize filename to be valid on Windows, Linux, and macOS
	_sanitizeFileName(fileName) {
		if (!fileName) return '';
		
		// Remove invalid characters for all operating systems
		// Windows: < > : " / \ | ? *
		// Linux: / and null byte
		// macOS: : and /
		// Also remove control characters (0x00-0x1F) and other problematic characters
		let sanitized = fileName
			.replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid characters
			.replace(/[\x7F-\x9F]/g, ''); // Remove DEL and other control characters
		
		// Replace multiple spaces/tabs with single space
		sanitized = sanitized.replace(/[\s\t]+/g, ' ').trim();
		
		// Remove leading/trailing dots and spaces (Windows doesn't allow these)
		sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
		
		// Windows reserved names (case-insensitive)
		const reservedNames = [
			'CON', 'PRN', 'AUX', 'NUL',
			'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
			'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
		];
		
		// Check if filename (without extension) is a reserved name
		const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
		if (reservedNames.includes(nameWithoutExt)) {
			// Add underscore to make it valid
			sanitized = '_' + sanitized;
		}
		
		// Limit length (Windows has 255 char limit for filename, but we'll use 200 to be safe)
		// This accounts for potential path length and extension
		const maxLength = 200;
		if (sanitized.length > maxLength) {
			// Try to preserve extension if present
			const lastDot = sanitized.lastIndexOf('.');
			if (lastDot > 0 && lastDot < sanitized.length - 1) {
				const ext = sanitized.substring(lastDot);
				const name = sanitized.substring(0, lastDot);
				sanitized = name.substring(0, maxLength - ext.length) + ext;
			} else {
				sanitized = sanitized.substring(0, maxLength);
			}
		}
		
		// If after sanitization the string is empty, use a default
		if (!sanitized || sanitized.trim() === '') {
			sanitized = 'download';
		}
		
		return sanitized;
	}

	_buildMarkUp(){

		// console.log(this._data, this._data.some(img => !img.checked));

		if(this._data.some(img => img.checked === true)){
			this._parent.removeAttribute('disabled');
		}
		else{
			this._parent.setAttribute('disabled', 'disabled');
		}
		
		// Set fileName from title when rendering (title should be available by now)
		this._setFileNameFromTitle();
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
					console.log('DownloadView: Download complete, waiting for file to save before closing popup');
					this._downloadComplete = true
					// Clear any safety timeout since we got completion
					if (this._safetyTimeout) {
						clearTimeout(this._safetyTimeout)
						this._safetyTimeout = null
					}
					// Wait longer before closing to ensure the download file is actually saved
					// The content script already waited, but we wait a bit more to be safe
					// This ensures the file is fully saved to disk before closing
					this._closeTimeout = setTimeout(() => {
						if (this._downloadComplete) {
							console.log('DownloadView: Closing popup now - download should be complete');
							window.close()
						}
					}, 2500) // Wait 2.5 seconds after 100% to ensure download file is saved
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
				// Sanitize filename before download to ensure it's valid
				const sanitizedFileName = this._sanitizeFileName(this._fileName.value.trim());
				if (sanitizedFileName !== this._fileName.value.trim()) {
					// Update the field with sanitized version
					this._fileName.value = sanitizedFileName;
				}
				
				this.showDownloadingOverlay()
				
				try {
					await handler(sanitizedFileName, this._downloadType.value, (progress, text) => {
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