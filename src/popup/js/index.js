import {init} from './controller';
import {dump} from './helpers';
import contentScript from '../../content/index.js';

(async function () {
	try {
		await browser.tabs.executeScript({
		  file: contentScript
		});

		const tabs = await browser.tabs.query({active: true, currentWindow: true})
	    
		const images = await browser.tabs.sendMessage(tabs[0].id, {"method": "fetchImages"});

		init(images);

	} catch(e) {
		console.error(e.message);
	}
})();