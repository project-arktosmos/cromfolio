/**
 * Card types for collectible cards within albums
 */

import type { ID } from '$types/core.type';

export interface Card {
	id: ID;
	albumId: ID;
	name: string;
	image: string;
	addedAt?: string;
}

export interface CardCollection {
	cards: Card[];
}
