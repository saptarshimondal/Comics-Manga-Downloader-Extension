import { init } from './controller';
import { setState } from './model';
import DownloadView from './views/DownloadView';

(async function () {
	try {
		const tabs = await browser.tabs.query({ active: true, currentWindow: true });
		if (!tabs.length) return;
		const tabId = tabs[0].id;
		const pageUrl = tabs[0].url || '';
		// Set current tab so download state and progress are scoped to this tab only
		setState('currentTabId', tabId);
		// Restore download overlay only if this tab had an active download
		await DownloadView.restoreDownloadState(tabId);

		// Inject content script using Manifest V3 API
		await browser.scripting.executeScript({
			target: { tabId: tabs[0].id },
			files: ['./content.bundle.js']
		});

		const images = await browser.tabs.sendMessage(tabs[0].id, { method: 'fetchImages' });
		const title = await browser.tabs.sendMessage(tabs[0].id, { method: 'fetchTitle' });

		await init({ images, title, pageUrl });
	} catch (e) {
		console.error(e.message);
	}
})();