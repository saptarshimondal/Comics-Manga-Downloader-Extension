import View from './View';
import { getState, saveDownloadState, getDownloadState, clearDownloadState } from '../model';
import { sanitizeFileName, getOverlayTitleForDownloadFormat } from '../helpers';

const getCurrentTabId = () => getState('currentTabId');

class DownloadView extends View {

	constructor(selector){
		super(selector);
		this._fileName = document.querySelector('#fileName')
		this._downloadFormat = document.querySelector('#downloadFormat')
		this._downloadType = document.querySelector('#downloadType')
		this._downloadTypeWrapper = document.querySelector('#download_type_wrapper')
		this._directOnlyHint = document.querySelector('#download_direct_only_hint')
		this._overlay = document.querySelector('#downloading_overlay')
		this._overlayTitle = document.querySelector('#download_overlay_title')
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
		/** @type {string|null} Active download format (pdf/cbz/zip) for the current job; used when restoring overlay so label stays correct. */
		this._activeDownloadFormat = null

		if (this._overlayClose) {
			this._overlayClose.addEventListener('click', () => this._onOverlayCloseClick());
		}

		// Always set up progress listener immediately, even if not downloading
		this._setupProgressListener();

		// When format changes, show/hide download type and direct-only hint
		if (this._downloadFormat) {
			this._downloadFormat.addEventListener('change', () => this._applyFormatUi());
			// Initial apply (in case restored from state)
			setTimeout(() => this._applyFormatUi(), 0);
		}

		// Save state when popup is about to close (per-tab) – only if download still in progress (not completed/errored)
		window.addEventListener('beforeunload', () => {
			if (this._isDownloading && !this._downloadComplete) {
				const tabId = getCurrentTabId();
				if (tabId != null) {
					saveDownloadState(tabId, {
						isDownloading: true,
						progress: this._progressFill ? parseInt(this._progressFill.style.width) || 0 : 0,
						progressText: this._progressText ? this._progressText.textContent || '' : '',
						downloadComplete: false,
						downloadFormat: this._activeDownloadFormat || 'pdf'
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

	_getDownloadFormat() {
		return (this._downloadFormat && this._downloadFormat.value) ? this._downloadFormat.value : 'pdf';
	}

	_applyFormatUi() {
		const format = this._getDownloadFormat();
		const isArchive = format === 'cbz' || format === 'zip';
		if (this._downloadType) {
			const browserOpt = this._downloadType.querySelector('option[value="browser"]');
			if (browserOpt) {
				browserOpt.disabled = isArchive;
				browserOpt.hidden = isArchive;
			}
			if (isArchive) {
				this._downloadType.value = 'jspdf';
			}
		}
		if (this._directOnlyHint) {
			this._directOnlyHint.style.display = isArchive ? 'block' : 'none';
		}
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
				while ((!this._overlay || !this._progressFill || !this._progressText || !this._parent || !this._overlayTitle || !this._downloadFormat) && retries < 5) {
					console.log(`DownloadView: DOM elements not ready, retrying... (${retries + 1}/5)`);
					await new Promise(resolve => setTimeout(resolve, 100));
					// Re-query elements
					this._overlay = document.querySelector('#downloading_overlay');
					this._progressFill = document.querySelector('#download_progress_fill');
					this._progressText = document.querySelector('#download_progress_text');
					this._errorMessage = document.querySelector('#download_error_message');
					this._parent = document.querySelector('#download');
					this._overlayTitle = document.querySelector('#download_overlay_title');
					this._downloadFormat = document.querySelector('#downloadFormat');
					retries++;
				}
				
				if (!this._overlay || !this._progressFill || !this._progressText || !this._parent) {
					console.error('DownloadView: DOM elements not found after retries, cannot restore state');
					return false;
				}
				
				// Restore active download format so overlay label and dropdown match the actual download type
				const savedFormat = (savedState.downloadFormat && ['pdf', 'cbz', 'zip'].includes(savedState.downloadFormat)) ? savedState.downloadFormat : 'pdf';
				this._activeDownloadFormat = savedFormat;
				if (this._overlayTitle) {
					this._overlayTitle.textContent = getOverlayTitleForDownloadFormat(savedFormat);
				}
				if (this._downloadFormat) {
					this._downloadFormat.value = savedFormat;
					this._downloadFormat.disabled = true; // Lock type while download in progress
					this._applyFormatUi();
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
			let sanitized = sanitizeFileName(title.trim());
			if (!this._fileName.value || this._fileName.value.trim() === '') {
				this._fileName.value = sanitized;
			}
		} else {
			if (!this._fileName.value || this._fileName.value.trim() === '') {
				this._fileName.value = '';
			}
		}
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
		const format = this._getDownloadFormat();
		this._activeDownloadFormat = format;
		if (this._overlayTitle) {
			this._overlayTitle.textContent = getOverlayTitleForDownloadFormat(format);
		}
		// Lock "Download as" dropdown during download so type stays consistent
		if (this._downloadFormat) this._downloadFormat.disabled = true;
		this._updateProgress(0, 'Preparing download...')
		const tabId = getCurrentTabId();
		if (tabId != null) {
			saveDownloadState(tabId, {
				isDownloading: true,
				progress: 0,
				progressText: 'Preparing download...',
				downloadComplete: false,
				downloadFormat: format
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
		this._activeDownloadFormat = null
		this._parent.disabled = false
		this._parent.value = 'Download'
		if (this._downloadFormat) this._downloadFormat.disabled = false
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
		
		// Re-enable download button and "Download as" dropdown after error
		setTimeout(() => {
			this._isDownloading = false
			this._activeDownloadFormat = null
			this._parent.disabled = false
			this._parent.value = 'Download'
			if (this._downloadFormat) this._downloadFormat.disabled = false
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
		const formatToSave = this._activeDownloadFormat || 'pdf';
		if (this._isDownloading) {
			saveDownloadState(tabId, {
				isDownloading: true,
				progress: percentage,
				progressText: text || '',
				downloadComplete: false,
				downloadFormat: formatToSave
			}).catch(err => console.error('DownloadView: Error saving progress state:', err));
		} else if (percentage > 0) {
			saveDownloadState(tabId, {
				isDownloading: true,
				progress: percentage,
				progressText: text || '',
				downloadComplete: false,
				downloadFormat: formatToSave
			}).catch(err => console.error('DownloadView: Error saving progress state:', err));
		}
	}

	addHandlerDownloader(handler){
		this._parent.addEventListener('click', async () => {
			if(this._isDownloading) return
			
			if(this._fileName.value){
				// Sanitize filename (base name only; extension added per format)
				let baseName = sanitizeFileName(this._fileName.value.trim());
				// Strip common extensions so we always add the correct one
				baseName = baseName.replace(/\.(pdf|cbz|zip)$/i, '') || 'download';
				if (this._fileName.value.trim() !== baseName) {
					this._fileName.value = baseName;
				}

				const format = this._getDownloadFormat();
				// CBZ/ZIP only support Direct download
				const downloadType = (format === 'cbz' || format === 'zip') ? 'jspdf' : this._downloadType.value;

				this.showDownloadingOverlay()
				
				try {
					await handler(baseName, downloadType, format, (progress, text) => {
						if (progress !== undefined) {
							this.updateProgress(progress, text)
						}
					})
					
					if (downloadType !== 'jspdf') {
						const tabId = getCurrentTabId();
						if (tabId != null) clearDownloadState(tabId);
						setTimeout(() => {
							window.close()
						}, 1000)
					}
				} catch(error) {
					console.error('Download error:', error)
					console.error('Error details:', {
						message: error.message,
						stack: error.stack,
						name: error.name
					})
					if (this._closeTimeout) {
						clearTimeout(this._closeTimeout)
						this._closeTimeout = null
					}
					if (this._safetyTimeout) {
						clearTimeout(this._safetyTimeout)
						this._safetyTimeout = null
					}
					if (this._progressListener) {
						browser.runtime.onMessage.removeListener(this._progressListener)
						this._progressListener = null
					}
					this.showError('Download failed, please try again.')
				}
			}
			else{
				this._fileName.focus();
			}
		});	
	}
}

export default new DownloadView('#download');