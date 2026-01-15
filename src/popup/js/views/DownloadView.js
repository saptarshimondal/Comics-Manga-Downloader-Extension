import View from './View';
import { getState, saveDownloadState, getDownloadState, clearDownloadState } from '../model';

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
		this._restorePromise = null
		
		// Always set up progress listener immediately, even if not downloading
		// This ensures we catch progress messages if download is active
		this._setupProgressListener();
		
		// Save state when popup is about to close
		window.addEventListener('beforeunload', () => {
			if (this._isDownloading) {
				console.log('DownloadView: Popup closing, saving final state...');
				// Save state synchronously if possible, or use sendBeacon
				saveDownloadState({
					isDownloading: true,
					progress: this._progressFill ? parseInt(this._progressFill.style.width) || 0 : 0,
					progressText: this._progressText ? this._progressText.textContent || '' : '',
					downloadComplete: this._downloadComplete
				}).catch(err => console.error('Error saving state on close:', err));
			}
		});
	}
	
	// Restore download state if popup was closed during download
	async _restoreDownloadState() {
		try {
			console.log('DownloadView: Checking for saved download state...');
			const savedState = await getDownloadState();
			console.log('DownloadView: Retrieved state:', savedState);
			
			if (savedState && savedState.isDownloading) {
				console.log('DownloadView: Restoring download state:', savedState);
				
				// Ensure DOM elements exist - retry if not ready
				let retries = 0;
				while ((!this._overlay || !this._progressFill || !this._progressText || !this._parent) && retries < 5) {
					console.log(`DownloadView: DOM elements not ready, retrying... (${retries + 1}/5)`);
					await new Promise(resolve => setTimeout(resolve, 100));
					// Re-query elements
					this._overlay = document.querySelector('#downloading_overlay');
					this._progressFill = document.querySelector('#download_progress_fill');
					this._progressText = document.querySelector('#download_progress_text');
					this._errorMessage = document.querySelector('#download_error_message');
					this._parent = document.querySelector('#download');
					retries++;
				}
				
				if (!this._overlay || !this._progressFill || !this._progressText || !this._parent) {
					console.error('DownloadView: DOM elements not found after retries, cannot restore state');
					return false;
				}
				
				// Restore the downloading overlay
				this._isDownloading = true;
				this._downloadComplete = savedState.downloadComplete || false;
				this._parent.disabled = true;
				this._parent.value = 'Downloading...';
				
				// Force show overlay
				this._overlay.classList.add('show');
				this._overlay.style.display = 'flex'; // Ensure it's visible
				this._errorMessage.classList.remove('show');
				this._errorMessage.textContent = '';
				
				// Restore progress
				const progress = savedState.progress || 0;
				const progressText = savedState.progressText || 'Download in progress...';
				this._updateProgress(progress, progressText);
				console.log('DownloadView: Progress restored to', progress, '% -', progressText);
				
				// Verify overlay is visible
				if (!this._overlay.classList.contains('show')) {
					console.warn('DownloadView: Overlay class not set, forcing show...');
					this._overlay.classList.add('show');
				}
				console.log('DownloadView: Overlay visible:', this._overlay.classList.contains('show'));
				
				// Reattach progress listener
				this._setupProgressListener();
				console.log('DownloadView: Progress listener reattached');
				
				// If download was already complete, handle it
				if (savedState.downloadComplete && savedState.progress >= 100) {
					this._downloadComplete = true;
					this._closeTimeout = setTimeout(() => {
						if (this._downloadComplete) {
							clearDownloadState();
							window.close();
						}
					}, 500);
				}
				
				return true;
			} else {
				console.log('DownloadView: No active download state found');
				return false;
			}
		} catch (error) {
			console.error('Error restoring download state:', error);
			return false;
		}
	}
	
	// Set up progress listener (extracted for reuse)
	_setupProgressListener() {
		// Remove existing listener if any
		if (this._progressListener) {
			browser.runtime.onMessage.removeListener(this._progressListener);
		}
		
		// Set up progress message listener
		this._progressListener = (message, sender, sendResponse) => {
			console.log('DownloadView: Received message:', message, 'from:', sender);
			// Handle progress messages
			if (message && message.type === 'downloadProgress') {
				console.log('DownloadView: Progress update received:', message.progress, message.text);
				
				// If we're not in downloading state but receive a progress message, restore state
				if (!this._isDownloading) {
					console.log('DownloadView: Received progress but not in downloading state, restoring...');
					
					// Ensure DOM elements exist
					if (!this._overlay) this._overlay = document.querySelector('#downloading_overlay');
					if (!this._progressFill) this._progressFill = document.querySelector('#download_progress_fill');
					if (!this._progressText) this._progressText = document.querySelector('#download_progress_text');
					if (!this._errorMessage) this._errorMessage = document.querySelector('#download_error_message');
					if (!this._parent) this._parent = document.querySelector('#download');
					
					if (this._overlay && this._parent) {
						this._isDownloading = true;
						this._downloadComplete = false;
						this._parent.disabled = true;
						this._parent.value = 'Downloading...';
						this._overlay.classList.add('show');
						this._overlay.style.display = 'flex';
						this._errorMessage.classList.remove('show');
						this._errorMessage.textContent = '';
						console.log('DownloadView: Overlay restored from progress message');
					} else {
						console.error('DownloadView: Cannot restore - DOM elements missing');
					}
				}
				
				this.updateProgress(message.progress, message.text)
				
				// If we reached 100%, mark as complete and schedule popup close
				if (message.progress >= 100) {
					console.log('DownloadView: Download complete, waiting for file to save before closing popup');
					this._downloadComplete = true
					// Save state
					saveDownloadState({
						isDownloading: true,
						progress: 100,
						progressText: message.text || 'Download complete!',
						downloadComplete: true
					});
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
							clearDownloadState(); // Clear state before closing
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
		};
		browser.runtime.onMessage.addListener(this._progressListener)
		console.log('DownloadView: Progress listener added');
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

		// Don't change disabled state if we're currently downloading
		if (!this._isDownloading) {
			if(this._data.some(img => img.checked === true)){
				this._parent.removeAttribute('disabled');
			}
			else{
				this._parent.setAttribute('disabled', 'disabled');
			}
		}
		
		// Set fileName from title when rendering (title should be available by now)
		this._setFileNameFromTitle();
	}
	
	// Override render to check for active download before clearing
	render(data) {
		// If we're downloading, don't clear the UI, just update data
		if (this._isDownloading) {
			this._data = data;
			// Still update the buildMarkUp logic but preserve download state
			this._buildMarkUp();
			return;
		}
		
		// Normal render behavior
		super.render(data);
	}
	
	// Method to be called after initialization to restore download state
	async restoreDownloadState() {
		// Prevent multiple simultaneous restorations
		if (this._restorePromise) {
			return this._restorePromise;
		}
		
		console.log('DownloadView: restoreDownloadState() called');
		this._restorePromise = this._restoreDownloadState();
		const result = await this._restorePromise;
		this._restorePromise = null;
		
		// Also set up a delayed check to ensure restoration happened
		// This handles cases where DOM might not be ready immediately
		setTimeout(async () => {
			if (!this._isDownloading) {
				console.log('DownloadView: Delayed check - current state:', this._isDownloading);
				const savedState = await getDownloadState();
				console.log('DownloadView: Delayed check - saved state:', savedState);
				if (savedState && savedState.isDownloading) {
					console.log('DownloadView: Delayed check found active download, restoring now...');
					await this._restoreDownloadState();
				}
			}
		}, 100);
		
		// Also check again after a longer delay in case messages arrive late
		setTimeout(async () => {
			if (!this._isDownloading) {
				const savedState = await getDownloadState();
				if (savedState && savedState.isDownloading) {
					console.log('DownloadView: Second delayed check found active download, restoring...');
					await this._restoreDownloadState();
				}
			}
		}, 500);
		
		return result;
	}
	
	// Force check and restore state - useful for debugging
	async checkAndRestoreState() {
		console.log('DownloadView: Force checking download state...');
		const savedState = await getDownloadState();
		console.log('DownloadView: Current saved state:', savedState);
		console.log('DownloadView: Current _isDownloading:', this._isDownloading);
		
		if (savedState && savedState.isDownloading && !this._isDownloading) {
			console.log('DownloadView: State mismatch detected! Restoring...');
			await this._restoreDownloadState();
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
		
		// Save initial download state
		saveDownloadState({
			isDownloading: true,
			progress: 0,
			progressText: 'Preparing download...',
			downloadComplete: false
		});
		
		// Clear any existing close timeout
		if (this._closeTimeout) {
			clearTimeout(this._closeTimeout)
			this._closeTimeout = null
		}
		
		// Set up progress message listener
		this._setupProgressListener();
		
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
		
		// Clear stored download state
		clearDownloadState();
		
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
		
		// Clear stored download state on error
		clearDownloadState();
		
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
		
		// Always update stored download state if downloading
		// This ensures state is saved even if _isDownloading flag gets out of sync
		// Save state on EVERY progress update to ensure it's always current
		if (this._isDownloading) {
			const stateToSave = {
				isDownloading: true,
				progress: percentage,
				progressText: text || '',
				downloadComplete: this._downloadComplete
			};
			console.log('DownloadView: Saving progress state:', stateToSave);
			// Use synchronous-like approach - don't await, just fire and forget
			saveDownloadState(stateToSave).catch(err => {
				console.error('DownloadView: Error saving progress state:', err);
			});
		} else {
			// Even if not marked as downloading, if we have progress, save it
			// This handles edge cases where state might be out of sync
			if (percentage > 0) {
				console.log('DownloadView: Saving progress state even though not marked as downloading');
				saveDownloadState({
					isDownloading: true,
					progress: percentage,
					progressText: text || '',
					downloadComplete: false
				}).catch(err => {
					console.error('DownloadView: Error saving progress state:', err);
				});
			}
		}
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
						// For browser downloads, clear state and close after a short delay
						clearDownloadState();
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