jest.mock('../../../content/index.js', () => ({}));
import { setState, getState, buildAppliedFiltersState, getPreferredDownloadFormat, savePreferredDownloadFormat, VALID_FORMATS, DEFAULT_DOWNLOAD_FORMAT } from '../model';

describe('preferred download format (model)', () => {
	it('VALID_FORMATS order is CBZ, PDF, ZIP', () => {
		expect(VALID_FORMATS).toEqual(['cbz', 'pdf', 'zip']);
	});

	it('DEFAULT_DOWNLOAD_FORMAT is cbz', () => {
		expect(DEFAULT_DOWNLOAD_FORMAT).toBe('cbz');
	});

	it('getPreferredDownloadFormat returns cbz when no storage (e.g. node)', async () => {
		const format = await getPreferredDownloadFormat();
		expect(format).toBe('cbz');
	});

	it('savePreferredDownloadFormat ignores invalid format', async () => {
		await savePreferredDownloadFormat('invalid');
		const format = await getPreferredDownloadFormat();
		expect(format).toBe('cbz');
	});

	it('when storage has pdf, getPreferredDownloadFormat returns pdf', async () => {
		const stored = { preferredDownloadFormat: 'pdf' };
		global.chrome = {
			storage: {
				local: {
					get: () => Promise.resolve(stored),
					set: () => Promise.resolve(),
				},
			},
		};
		const format = await getPreferredDownloadFormat();
		expect(format).toBe('pdf');
		delete global.chrome;
	});

	it('when storage has invalid value, getPreferredDownloadFormat returns cbz', async () => {
		const stored = { preferredDownloadFormat: 'unknown' };
		global.chrome = {
			storage: {
				local: {
					get: () => Promise.resolve(stored),
					set: () => Promise.resolve(),
				},
			},
		};
		const format = await getPreferredDownloadFormat();
		expect(format).toBe('cbz');
		delete global.chrome;
	});
});

describe('auto-detect persistence (model)', () => {
	beforeEach(() => {
		setState('query', '');
		setState('selectedDimensionFilters', []);
		setState('filteredImages', [
			{ src: 'https://example.com/1.jpg', type: 'url', checked: true },
			{ src: 'https://example.com/2.jpg', type: 'url', checked: false },
		]);
	});

	it('buildAppliedFiltersState includes autoDetectEnabled', () => {
		setState('autoDetectEnabled', true);
		const state = buildAppliedFiltersState();
		expect(state).toHaveProperty('autoDetectEnabled');
		expect(state.autoDetectEnabled).toBe(true);
	});

	it('default-on: when autoDetectEnabled is not set, saved.autoDetectEnabled !== false is true', () => {
		setState('autoDetectEnabled', undefined);
		const state = buildAppliedFiltersState();
		const wouldRestoreAsOn = state.autoDetectEnabled !== false;
		expect(wouldRestoreAsOn).toBe(true);
	});

	it('persisted OFF: when autoDetectEnabled is false, state contains false', () => {
		setState('autoDetectEnabled', false);
		const state = buildAppliedFiltersState();
		expect(state.autoDetectEnabled).toBe(false);
	});

	it('persisted ON: when autoDetectEnabled is true, state contains true', () => {
		setState('autoDetectEnabled', true);
		const state = buildAppliedFiltersState();
		expect(state.autoDetectEnabled).toBe(true);
	});

	it('getState returns false when autoDetectEnabled is set to false (regression guard)', () => {
		setState('autoDetectEnabled', false);
		expect(getState('autoDetectEnabled')).toBe(false);
	});
});
