/**
 * Service for managing the stamps modal state
 */
import { writable } from 'svelte/store';

export interface StampsModalState {
	isOpen: boolean;
	stampsUpdated: boolean;
}

const initialState: StampsModalState = {
	isOpen: false,
	stampsUpdated: false
};

function createStampsModalService() {
	const { subscribe, set: _set, update } = writable<StampsModalState>(initialState);

	return {
		subscribe,

		/**
		 * Open the stamps modal
		 */
		open() {
			update((state) => ({ ...state, isOpen: true }));
		},

		/**
		 * Close the stamps modal
		 */
		close() {
			update((state) => ({ ...state, isOpen: false }));
		},

		/**
		 * Mark that stamps have been updated (called after successful import)
		 */
		markStampsUpdated() {
			update((state) => ({ ...state, stampsUpdated: true }));
		},

		/**
		 * Clear the stamps updated flag (called after consuming the update)
		 */
		clearStampsUpdated() {
			update((state) => ({ ...state, stampsUpdated: false }));
		}
	};
}

export const stampsModalService = createStampsModalService();
