/**
 * Service for managing the booster pack reveal modal state
 */
import { writable } from 'svelte/store';
import type { ID } from '$types/core.type';

export interface BoosterPackModalState {
	isOpen: boolean;
	collectionId: ID | null;
	packCount: number;
	earnedFrom: string;
}

const initialState: BoosterPackModalState = {
	isOpen: false,
	collectionId: null,
	packCount: 0,
	earnedFrom: ''
};

function createBoosterPackModalService() {
	const { subscribe, set } = writable<BoosterPackModalState>(initialState);
	let onCloseCallback: (() => void) | null = null;

	return {
		subscribe,

		/**
		 * Open the booster pack reveal modal
		 * @param collectionId - The collection to open packs from
		 * @param packCount - Number of packs to open
		 * @param earnedFrom - Source of the packs (e.g., 'pokemon-trivia')
		 * @param onClose - Optional callback to run when the modal closes
		 */
		open(collectionId: ID, packCount: number, earnedFrom: string = '', onClose?: () => void) {
			onCloseCallback = onClose ?? null;
			set({
				isOpen: true,
				collectionId,
				packCount,
				earnedFrom
			});
		},

		/**
		 * Close the modal and run the onClose callback if set
		 */
		close() {
			set(initialState);
			if (onCloseCallback) {
				onCloseCallback();
				onCloseCallback = null;
			}
		}
	};
}

export const boosterPackModalService = createBoosterPackModalService();
