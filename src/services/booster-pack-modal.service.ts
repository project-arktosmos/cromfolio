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
	const { subscribe, set, update } = writable<BoosterPackModalState>(initialState);

	return {
		subscribe,

		/**
		 * Open the booster pack reveal modal
		 * @param collectionId - The collection to open packs from
		 * @param packCount - Number of packs to open
		 * @param earnedFrom - Source of the packs (e.g., 'pokemon-trivia')
		 */
		open(collectionId: ID, packCount: number, earnedFrom: string = '') {
			set({
				isOpen: true,
				collectionId,
				packCount,
				earnedFrom
			});
		},

		/**
		 * Close the modal
		 */
		close() {
			set(initialState);
		}
	};
}

export const boosterPackModalService = createBoosterPackModalService();
