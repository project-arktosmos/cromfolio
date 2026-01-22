/**
 * Album types for collectible card albums
 */

import type { ID } from '$types/core.type';

export type AlbumType =
	| 'movie'
	| 'tv'
	| 'videogame'
	| 'anime'
	| 'sports_league'
	| 'animal'
	| 'musician'
	| 'author';

export interface Album {
	id: ID;
	albumType: AlbumType;
	title: string;
	description: string;
	coverImage?: string;
	wikiaUrl?: string;
	// Movie/TV metadata
	imdbId?: string;
	tmdbId?: number;
	// Videogame metadata
	igdbId?: number;
	igdbSlug?: string;
	sgdbId?: number;
	// Anime metadata
	anilistId?: number;
	malId?: number;
	// Sports metadata
	sportsType?: 'team' | 'league' | 'player';
	sportsDbTeamId?: string;
	sportsDbLeagueId?: string;
	sportsDbPlayerId?: string;
	sport?: string;
	league?: string;
	country?: string;
	// Animal metadata
	wikidataId?: string;
	scientificName?: string;
	conservationStatus?: string;
	taxonomicClass?: string;
	// Music metadata
	musicbrainzArtistId?: string;
	musicbrainzReleaseId?: string;
	artistName?: string;
	musicType?: 'artist' | 'release';
	musicGenres?: string[];
	releaseYear?: number;
	recordLabel?: string;
	// Book metadata (Open Library)
	openLibraryAuthorId?: string;
	openLibraryWorkId?: string;
	authorName?: string;
	bookType?: 'author' | 'work';
	bookSubjects?: string[];
	firstPublishYear?: number;
	publisher?: string;
	addedAt?: string;
}

export interface AlbumCollection {
	albums: Album[];
}
