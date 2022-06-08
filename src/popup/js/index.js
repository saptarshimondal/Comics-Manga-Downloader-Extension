import {init} from './controller';
import {dump} from './helpers';
// import contentScript from '../../content/index.js'; 

(async function () {
	try {
		await browser.tabs.executeScript({
		  file: './content.bundle.js'
		});

		const tabs = await browser.tabs.query({active: true, currentWindow: true})
	    
		const images = await browser.tabs.sendMessage(tabs[0].id, {"method": "fetchImages"});

		const title = await browser.tabs.sendMessage(tabs[0].id, {"method": "fetchTitle"});

		init({images, title});

	} catch(e) {
		console.error(e.message);
	}
})();