/**
 * Source types for tracking external source IDs and preventing duplicates
 */

import type { ID } from '$types/core.type';

export interface Source {
	id: ID;
	albumId: ID;
	sourceType: SourceType;
	externalId: string;
	externalIdType: ExternalIdType;
	createdAt?: string;
}

export type SourceType =
	| 'movie'
	| 'tv'
	| 'game'
	| 'anime'
	| 'sports_team'
	| 'sports_league'
	| 'animal'
	| 'music'
	| 'book_author'
	| 'book_work';

export type ExternalIdType =
	| 'imdb'
	| 'tmdb'
	| 'igdb'
	| 'anilist'
	| 'sportsdb_team'
	| 'sportsdb_league'
	| 'wikidata'
	| 'musicbrainz_artist'
	| 'openlibrary_author'
	| 'openlibrary_work';
