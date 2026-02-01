/**
 * Card types for collectible cards within sources
 */

import type { ID } from '$types/core.type';

export interface Card {
	id: ID;
	sourceId: ID;
	name: string;
	image: string;

	// Card type ID - FK reference to card_types table
	cardTypeId?: ID;

	// Rarity reference
	rarityId?: ID;

	// Image source metadata
	imageSource?: string; // e.g., 'tmdb', 'igdb', 'anilist', 'thesportsdb'

	addedAt?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface CardCollection {
	cards: Card[];
}
