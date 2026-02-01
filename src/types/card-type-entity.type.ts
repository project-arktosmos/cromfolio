/**
 * Card type entity stored in the database
 * This replaces the hardcoded CardType enum with a database-backed entity
 */

import type { ID } from '$types/core.type';

export interface CardTypeEntity {
	/** Unique identifier (e.g., "poster", "backdrop", "character") */
	id: ID;
	/** Display name (e.g., "Poster", "Backdrop", "Character") */
	name: string;
	/** Description of what this card type represents */
	description: string;
	/** Category grouping (e.g., "Movie/TV", "Videogame", "Anime") */
	category: string;
	/** Associated album type (e.g., "movie", "tv", "videogame", "anime", "sports_league", "animal") */
	albumType?: string;
	/** DaisyUI badge class for styling (e.g., "badge-primary") */
	badgeColor: string;
	/** Sort order within category (lower = first) */
	sortOrder: number;
	createdAt?: string;
	updatedAt?: string;
}

/** Available card type categories */
export const CARD_TYPE_CATEGORIES = [
	'Generic',
	'Movie/TV',
	'Videogame',
	'Anime',
	'Sports',
	'Animal'
] as const;

export type CardTypeCategory = (typeof CARD_TYPE_CATEGORIES)[number];

/** Available badge colors for card types */
export const BADGE_COLORS = [
	'badge-primary',
	'badge-secondary',
	'badge-accent',
	'badge-info',
	'badge-success',
	'badge-warning',
	'badge-error',
	'badge-neutral',
	'badge-ghost'
] as const;

export type BadgeColor = (typeof BADGE_COLORS)[number];
