import View from './View';
import { getState, saveDownloadState, getDownloadState, clearDownloadState } from '../model';

const getCurrentTabId = () => getState('currentTabId');

class DownloadView extends View {

	constructor(selector){
		super(selector);
		this._fileName = document.querySelector('#fileName')
		this._downloadType = document.querySelector('#downloadType')
		this._overlay = document.querySelector('#downloading_overlay')
		this._progressFill = document.querySelector('#download_progress_fill')
		this._progressText = document.querySelector('#download_progress_text')
		this._errorMessage = document.querySelector('#download_error_message')
		this._overlayClose = document.querySelector('#download_overlay_close')
		this._isDownloading = false
		this._progressListener = null
		this._closeTimeout = null
		this._safetyTimeout = null
		this._downloadComplete = false
		this._restorePromise = null

		if (this._overlayClose) {
			this._overlayClose.addEventListener('click', () => this._onOverlayCloseClick());
		}

		// Always set up progress listener immediately, even if not downloading
		this._setupProgressListener();

		// Save state when popup is about to close (per-tab) – only if download still in progress (not completed/errored)
		window.addEventListener('beforeunload', () => {
			if (this._isDownloading && !this._downloadComplete) {
				const tabId = getCurrentTabId();
				if (tabId != null) {
					saveDownloadState(tabId, {
						isDownloading: true,
						progress: this._progressFill ? parseInt(this._progressFill.style.width) || 0 : 0,
						progressText: this._progressText ? this._progressText.textContent || '' : '',
						downloadComplete: false
					}).catch(err => console.error('Error saving state on close:', err));
				}
			}
		});
	}

	_showOverlayCloseButton() {
		if (this._overlay) this._overlay.classList.add('show-close');
	}

	_hideOverlayCloseButton() {
		if (this._overlay) this._overlay.classList.remove('show-close');
	}

	_onOverlayCloseClick() {
		this.hideDownloadingOverlay();
		window.close();
	}
	
	// Restore download state only if this tab had an active download
	async _restoreDownloadState(tabId) {
		try {
			if (tabId == null) return false;
			const savedState = await getDownloadState(tabId);
			
			if (savedState && savedState.isDownloading) {
				if (savedState.downloadComplete && (savedState.progress ?? 0) < 100) {
					await clearDownloadState(tabId);
					return false;
				}

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
				
				// Restore progress – use "Download complete!" when restored state was at 100%
				const progress = savedState.progress || 0;
				const isCompleted = progress >= 100 || (savedState.downloadComplete && progress >= 100);
				const progressText = isCompleted
					? 'Download complete!'
					: (savedState.progressText || 'Download in progress...');
				this._updateProgress(progress, progressText);

				// Reattach progress listener
				this._setupProgressListener();

				// If restored state was completed (progress >= 100), always show close button so user can dismiss overlay
				if (isCompleted) {
					this._downloadComplete = true;
					this._showOverlayCloseButton();
					this._closeTimeout = setTimeout(() => {
						if (this._downloadComplete) {
							clearDownloadState(tabId);
							window.close();
						}
					}, 500);
				}
				return true;
			}
			return false;
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
			if (!message || message.type !== 'downloadProgress') return false;
			const senderTabId = sender && sender.tab ? sender.tab.id : null;
			if (senderTabId == null) return false;

			// Always clear that tab's state on completion or error so reopening that tab's popup won't show stale overlay
			if (message.progress >= 100 || message.error) {
				clearDownloadState(senderTabId);
			}

			const currentTabId = getCurrentTabId();
			if (senderTabId !== currentTabId) return false;

			// From here: message is for current tab – update UI
			if (!this._isDownloading) {
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
				}
			}

			this.updateProgress(message.progress, message.text);

			if (message.progress >= 100) {
				this._downloadComplete = true;
				this._showOverlayCloseButton();
				if (this._safetyTimeout) {
					clearTimeout(this._safetyTimeout);
					this._safetyTimeout = null;
				}
				this._closeTimeout = setTimeout(() => {
					if (this._downloadComplete) {
						window.close();
					}
				}, 2500);
			}

			if (message.error) {
				this._showOverlayCloseButton();
				this.showError(message.error);
				this._downloadComplete = false;
				if (this._closeTimeout) {
					clearTimeout(this._closeTimeout);
					this._closeTimeout = null;
				}
				if (this._safetyTimeout) {
					clearTimeout(this._safetyTimeout);
					this._safetyTimeout = null;
				}
			}
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
	
	// Restore download state only for the given tab (called when popup opens)
	async restoreDownloadState(tabId) {
		if (this._restorePromise) {
			return this._restorePromise;
		}
		this._restorePromise = this._restoreDownloadState(tabId);
		const result = await this._restorePromise;
		this._restorePromise = null;
		const currentTabId = getCurrentTabId();
		setTimeout(async () => {
			if (!this._isDownloading && currentTabId != null) {
				const savedState = await getDownloadState(currentTabId);
				if (savedState && savedState.isDownloading) {
					await this._restoreDownloadState(currentTabId);
				}
			}
		}, 100);
		setTimeout(async () => {
			if (!this._isDownloading && currentTabId != null) {
				const savedState = await getDownloadState(currentTabId);
				if (savedState && savedState.isDownloading) {
					await this._restoreDownloadState(currentTabId);
				}
			}
		}, 500);
		return result;
	}

	async checkAndRestoreState() {
		const tabId = getCurrentTabId();
		if (tabId == null) return;
		const savedState = await getDownloadState(tabId);
		if (savedState && savedState.isDownloading && !this._isDownloading) {
			await this._restoreDownloadState(tabId);
		}
	}

	showDownloadingOverlay() {
		this._isDownloading = true
		this._downloadComplete = false
		this._parent.disabled = true
		this._parent.value = 'Downloading...'
		this._overlay.classList.add('show')
		this._hideOverlayCloseButton()
		this._errorMessage.classList.remove('show')
		this._errorMessage.textContent = ''
		this._updateProgress(0, 'Preparing download...')
		const tabId = getCurrentTabId();
		if (tabId != null) {
			saveDownloadState(tabId, {
				isDownloading: true,
				progress: 0,
				progressText: 'Preparing download...',
				downloadComplete: false
			});
		}
		
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
		this._hideOverlayCloseButton()
		this._updateProgress(0, '')
		const tabId = getCurrentTabId();
		if (tabId != null) clearDownloadState(tabId);
		
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
		const tabId = getCurrentTabId();
		if (tabId != null) clearDownloadState(tabId);
		
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
		this._updateProgress(percentage, text);
		// Never persist state at 100% or when complete – we clear that tab's state on completion
		if (percentage >= 100) return;
		const tabId = getCurrentTabId();
		if (tabId == null) return;
		if (this._isDownloading) {
			saveDownloadState(tabId, {
				isDownloading: true,
				progress: percentage,
				progressText: text || '',
				downloadComplete: false
			}).catch(err => console.error('DownloadView: Error saving progress state:', err));
		} else if (percentage > 0) {
			saveDownloadState(tabId, {
				isDownloading: true,
				progress: percentage,
				progressText: text || '',
				downloadComplete: false
			}).catch(err => console.error('DownloadView: Error saving progress state:', err));
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
						const tabId = getCurrentTabId();
						if (tabId != null) clearDownloadState(tabId);
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