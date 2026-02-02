/**
 * Provider types for tracking external provider IDs and preventing duplicates (formerly Source)
 */

import type { ID } from '$types/core.type';

export interface Provider {
	id: ID;
	sourceId: ID;
	providerType: ProviderType;
	externalId: string;
	externalIdType: ExternalIdType;
	createdAt?: string;
}

export type ProviderType =
	| 'movie'
	| 'tv'
	| 'game'
	| 'anime'
	| 'sports_team'
	| 'sports_league'
	| 'animal'
	| 'music_artist'
	| 'music_album'
	| 'music_recording';

export type ExternalIdType =
	| 'imdb'
	| 'tmdb'
	| 'igdb'
	| 'sgdb'
	| 'anilist'
	| 'sportsdb_team'
	| 'sportsdb_league'
	| 'wikidata'
	| 'musicbrainz';
