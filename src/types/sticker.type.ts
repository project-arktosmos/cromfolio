/**
 * Sticker types for image stickers within sources (formerly Blueprint/Template)
 */

import type { ID } from '$types/core.type';

/**
 * Fragment position for split stickers
 * 1=top-left, 2=top-right, 3=bottom-left, 4=bottom-right
 */
export type FragmentPosition = 1 | 2 | 3 | 4;

/**
 * Fragment position labels for display
 */
export const FRAGMENT_POSITION_LABELS: Record<FragmentPosition, string> = {
	1: 'Top Left',
	2: 'Top Right',
	3: 'Bottom Left',
	4: 'Bottom Right'
};

export interface Sticker {
	id: ID;
	sourceId: ID;
	name: string;
	image: string;

	// Sticker type ID - FK reference to sticker_types table
	stickerTypeId?: ID;

	// Rarity reference
	rarityId?: ID;

	// Image source metadata
	imageSource?: string; // e.g., 'tmdb', 'igdb', 'anilist', 'thesportsdb'

	// Image dimensions in pixels
	width?: number;
	height?: number;

	// Fragment metadata for split stickers (e.g., winners split into 4 pieces)
	// fragmentOf: ID that links all fragments of the same original sticker together
	fragmentOf?: string;
	// fragmentPosition: 1=top-left, 2=top-right, 3=bottom-left, 4=bottom-right
	fragmentPosition?: 1 | 2 | 3 | 4;

	addedAt?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface StickerCollection {
	stickers: Sticker[];
}
