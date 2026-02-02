/**
 * Game Entity Types
 *
 * Internal types for video games and gaming content.
 * These are the normalized internal representations used throughout the app.
 */

import type { ID } from './core.type';

/**
 * Video game representation (normalized from IGDB, etc.)
 */
export interface Game {
	id: string;
	name: string;
	slug: string;
	summary?: string;
	storyline?: string;
	releaseDate?: string; // ISO date
	rating?: number; // 0-100
	ratingCount?: number;
	aggregatedRating?: number;
	cover?: string;
	platforms?: string[];
	genres?: string[];
	themes?: string[];
	gameModes?: string[];
	developers?: string[];
	publishers?: string[];
	franchises?: string[];
	igdbId?: number;
	steamId?: number;
}

/**
 * Game image representation (normalized from SteamGridDB, IGDB, etc.)
 */
export interface GameImage {
	id: string;
	url: string;
	thumbUrl: string;
	type: 'grid' | 'hero' | 'logo' | 'icon' | 'screenshot' | 'artwork' | 'cover';
	width: number;
	height: number;
	style?: 'alternate' | 'blurred' | 'white_logo' | 'material' | 'no_logo';
	mimeType?: string;
	animated?: boolean;
	nsfw?: boolean;
	humor?: boolean;
	epilepsy?: boolean;
	score?: number;
	upvotes?: number;
	downvotes?: number;
	author?: {
		name: string;
		avatar?: string;
	};
}

/**
 * Game platform representation
 */
export interface GamePlatform {
	id: string;
	name: string;
	slug: string;
	abbreviation?: string;
	generation?: number;
	category?:
		| 'console'
		| 'arcade'
		| 'platform'
		| 'operating_system'
		| 'portable_console'
		| 'computer';
	logo?: string;
}

/**
 * Game company representation (developer/publisher)
 */
export interface GameCompany {
	id: string;
	name: string;
	slug: string;
	description?: string;
	logo?: string;
	country?: number; // ISO 3166-1 country code
	startDate?: string;
	websites?: string[];
}

/**
 * Game collection/franchise representation
 */
export interface GameFranchise {
	id: string;
	name: string;
	slug: string;
	games?: ID[];
}

/**
 * Game genre representation
 */
export interface GameGenre {
	id: string;
	name: string;
	slug: string;
}
