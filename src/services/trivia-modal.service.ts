import { writable } from 'svelte/store';
import type { Collection } from '$types/collection.type';

export interface TriviaModalState {
	isOpen: boolean;
	collection: Collection | null;
}

function createTriviaModalStore() {
	const {
		subscribe,
		set,
		update: _update
	} = writable<TriviaModalState>({
		isOpen: false,
		collection: null
	});

	function open(collection: Collection) {
		set({ isOpen: true, collection });
	}

	function close() {
		set({ isOpen: false, collection: null });
	}

	return {
		subscribe,
		open,
		close
	};
}

export const triviaModalService = createTriviaModalStore();
