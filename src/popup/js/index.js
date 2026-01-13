import {init} from './controller';
import {dump} from './helpers';
// import contentScript from '../../content/index.js'; 

(async function () {
	try {
		const tabs = await browser.tabs.query({active: true, currentWindow: true});
		
		// Inject content script using Manifest V3 API
		await browser.scripting.executeScript({
			target: { tabId: tabs[0].id },
			files: ['./content.bundle.js']
		});
	    
		const images = await browser.tabs.sendMessage(tabs[0].id, {"method": "fetchImages"});

		const title = await browser.tabs.sendMessage(tabs[0].id, {"method": "fetchTitle"});

		init({images, title});

	} catch(e) {
		console.error(e.message);
	}
})();