/**
 * Source types for collectible card sources (formerly Album)
 */

import type { ID } from '$types/core.type';

export type SourceType =
	| 'movie'
	| 'tv'
	| 'videogame'
	| 'anime'
	| 'sports_league'
	| 'animal'
	| 'award_list'
	| 'grammy'
	| 'game_console';

export interface Source {
	id: ID;
	sourceType: SourceType;
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
	addedAt?: string;
}

export interface SourceCollection {
	sources: Source[];
}
