/**
 * Card types for collectible cards within albums
 */

import type { ID } from '$types/core.type';

/**
 * Card type enum - what the card image represents
 * Must match the Rust CardType enum in src-tauri/src/models/card.rs
 */
export type CardType =
	// Generic/fallback
	| 'other'
	// Movie/TV types
	| 'poster'
	| 'backdrop'
	| 'logo'
	| 'cast'
	| 'characterart'
	// Videogame types
	| 'cover'
	| 'screenshot'
	| 'artwork'
	| 'hero'
	| 'icon'
	| 'grid'
	// Anime types
	| 'character'
	| 'main_character'
	// Sports types
	| 'player'
	| 'team_badge'
	// Animal types
	| 'photo'
	// Music types
	| 'album'
	| 'artistthumb'
	| 'artistbackground'
	// Book types
	| 'book_cover';

/**
 * Maps raw image type strings from APIs to normalized CardType values
 */
export function normalizeCardType(rawType: string): CardType {
	const typeMap: Record<string, CardType> = {
		// Movie/TV
		poster: 'poster',
		backdrop: 'backdrop',
		logo: 'logo',
		hdmovielogo: 'logo',
		hdtvlogo: 'logo',
		clearlogo: 'logo',
		cast: 'cast',
		characterart: 'characterart',
		// Videogame
		cover: 'cover',
		screenshot: 'screenshot',
		artwork: 'artwork',
		hero: 'hero',
		icon: 'icon',
		grid: 'grid',
		// Anime
		character: 'character',
		'main-character': 'main_character',
		main_character: 'main_character',
		// Sports
		player: 'player',
		'team-badge': 'team_badge',
		team_badge: 'team_badge',
		// Animal
		photo: 'photo',
		// Music
		album: 'album',
		single: 'album',
		ep: 'album',
		compilation: 'album',
		live: 'album',
		artistthumb: 'artistthumb',
		artistbackground: 'artistbackground',
		// Book
		'book-cover': 'book_cover',
		book_cover: 'book_cover'
	};

	return typeMap[rawType.toLowerCase()] || 'other';
}

export interface Card {
	id: ID;
	albumId: ID;
	name: string;
	image: string;

	// Card type - what this image represents
	cardType?: CardType;

	// Rarity reference
	rarityId?: ID;

	// Image source metadata
	imageSource?: string; // e.g., 'tmdb', 'fanart', 'igdb', 'anilist'

	// Music release metadata (when card represents a music release)
	musicbrainzReleaseGroupId?: string;
	releaseType?: string;
	releaseYear?: number;

	addedAt?: string;
}

export interface CardCollection {
	cards: Card[];
}
