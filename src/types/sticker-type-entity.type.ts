/**
 * Sticker type entity stored in the database (formerly BlueprintTypeEntity/TemplateTypeEntity)
 * This mirrors the CardTypeEntity structure for stickers
 */

import type { ID } from '$types/core.type';

export interface StickerTypeEntity {
	/** Unique identifier (e.g., "poster", "backdrop", "character") */
	id: ID;
	/** Display name (e.g., "Poster", "Backdrop", "Character") */
	name: string;
	/** Description of what this sticker type represents */
	description: string;
	/** Category grouping (e.g., "Movie/TV", "Videogame", "Anime") */
	category: string;
	/** Associated source type (e.g., "movie", "tv", "videogame", "anime", "sports_league", "animal") */
	sourceType?: string;
	/** DaisyUI badge class for styling (e.g., "badge-primary") */
	badgeColor: string;
	/** Sort order within category (lower = first) */
	sortOrder: number;
	createdAt?: string;
	updatedAt?: string;
}

/** Available sticker type categories */
export const STICKER_TYPE_CATEGORIES = [
	'Generic',
	'Movie/TV',
	'Videogame',
	'Anime',
	'Sports',
	'Animal'
] as const;

export type StickerTypeCategory = (typeof STICKER_TYPE_CATEGORIES)[number];
