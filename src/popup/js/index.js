import {init} from './controller';
import {dump} from './helpers';
import DownloadView from './views/DownloadView';
// import contentScript from '../../content/index.js'; 

(async function () {
	try {
		// Immediately check for active download state when popup opens
		// This happens before any other initialization
		console.log('Popup: Starting initialization, checking for active download...');
		await DownloadView.restoreDownloadState();
		
		const tabs = await browser.tabs.query({active: true, currentWindow: true});
		
		// Inject content script using Manifest V3 API
		await browser.scripting.executeScript({
			target: { tabId: tabs[0].id },
			files: ['./content.bundle.js']
		});
	    
		const images = await browser.tabs.sendMessage(tabs[0].id, {"method": "fetchImages"});

		const title = await browser.tabs.sendMessage(tabs[0].id, {"method": "fetchTitle"});

		await init({images, title});

	} catch(e) {
		console.error(e.message);
	}
})();