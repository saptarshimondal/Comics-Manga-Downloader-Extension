jest.mock('../../../content/index.js', () => ({}));
import { setState, getState, buildAppliedFiltersState } from '../model';

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
