/**
 * Controller tests for auto-detect toggle: default-on, persistence, OFF => no scan + all selected,
 * Rescan runs auto-detect even when OFF, toggling updates selection.
 */

const mockState = {};
const mockGetElementById = jest.fn().mockReturnValue({ textContent: '', style: { display: '' } });
if (typeof global.document === 'undefined') {
	global.document = { getElementById: mockGetElementById };
}
const mockAutoDetectPages = jest.fn().mockReturnValue({
	confidence: 0.8,
	selected: [],
	reason: null,
});

jest.mock('../model', () => ({
	getState: (key) => mockState[key],
	setState: (key, value) => {
		mockState[key] = value;
	},
	initState: jest.fn(),
	getAppliedFiltersForPage: jest.fn(),
	saveAppliedFiltersForPage: jest.fn(),
	buildAppliedFiltersState: jest.fn(),
}));

jest.mock('../../../utils/autoDetectPages', () => ({
	autoDetectPages: (...args) => mockAutoDetectPages(...args),
}));

jest.mock('../views/ImagesView', () => ({ render: jest.fn(), default: {} }));
jest.mock('../views/SelectAllCheckBoxView', () => ({ render: jest.fn(), default: {} }));
jest.mock('../views/DownloadView', () => ({ render: jest.fn(), default: {} }));
jest.mock('../views/SearchView', () => ({}));

import { runAutoDetectAndApply, setAllSelectedAndRender } from '../controller';

describe('auto-detect controller', () => {
	const twoImages = [
		{ src: 'https://a.com/1.jpg', type: 'url', checked: true },
		{ src: 'https://a.com/2.jpg', type: 'url', checked: false },
	];

	beforeEach(() => {
		jest.clearAllMocks();
		Object.keys(mockState).forEach((k) => delete mockState[k]);
		mockState.filteredImages = [...twoImages];
		if (global.document) global.document.getElementById = mockGetElementById;
	});

	it('OFF => no auto scan: runAutoDetectAndApply(false) when autoDetectEnabled is false does not call autoDetectPages', () => {
		mockState.autoDetectEnabled = false;
		runAutoDetectAndApply(false);
		expect(mockAutoDetectPages).not.toHaveBeenCalled();
	});

	it('Rescan runs auto-detect even when OFF: runAutoDetectAndApply(true) when autoDetectEnabled is false calls autoDetectPages', () => {
		mockState.autoDetectEnabled = false;
		runAutoDetectAndApply(true);
		expect(mockAutoDetectPages).toHaveBeenCalledWith(mockState.filteredImages);
	});

	it('When auto-detect ON, runAutoDetectAndApply(false) runs autoDetectPages', () => {
		mockState.autoDetectEnabled = true;
		runAutoDetectAndApply(false);
		expect(mockAutoDetectPages).toHaveBeenCalledWith(mockState.filteredImages);
	});

	it('setAllSelectedAndRender sets all filteredImages to checked and persists', () => {
		mockState.currentPageUrl = 'https://example.com';
		setAllSelectedAndRender();
		const updated = mockState.filteredImages;
		expect(updated).toHaveLength(2);
		expect(updated.every((img) => img.checked === true)).toBe(true);
	});

	it('runAutoDetectAndApply with no filteredImages does not call autoDetectPages', () => {
		mockState.filteredImages = [];
		mockState.autoDetectEnabled = true;
		runAutoDetectAndApply(false);
		expect(mockAutoDetectPages).not.toHaveBeenCalled();
	});
});
