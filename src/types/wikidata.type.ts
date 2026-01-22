import type { ID } from '$types/core.type';

// Wikipedia Search API response types
export interface WikipediaSearchResult {
	pageid: number;
	title: string;
	snippet: string;
	size: number;
	wordcount: number;
	timestamp: string;
}

export interface WikipediaSearchResponse {
	query: {
		search: WikipediaSearchResult[];
		searchinfo: {
			totalhits: number;
		};
	};
}

// Wikidata entity types
export interface WikidataLabel {
	language: string;
	value: string;
}

export interface WikidataDescription {
	language: string;
	value: string;
}

export interface WikidataClaim {
	mainsnak: {
		snaktype: string;
		property: string;
		datavalue?: {
			value: unknown;
			type: string;
		};
		datatype: string;
	};
	type: string;
	rank: string;
}

export interface WikidataEntity {
	type: string;
	id: string;
	labels: Record<string, WikidataLabel>;
	descriptions: Record<string, WikidataDescription>;
	claims: Record<string, WikidataClaim[]>;
}

export interface WikidataResponse {
	entities: Record<string, WikidataEntity>;
	success: number;
}

// Parsed/simplified types for UI display
export interface WikidataProperty {
	id: string;
	label: string;
	value: string;
	valueType: 'string' | 'entity' | 'time' | 'quantity' | 'url' | 'image' | 'unknown';
}

export interface WikidataItem {
	entityId: string;
	wikipediaTitle: string;
	label: string;
	description: string;
	properties: WikidataProperty[];
	imageUrl?: string;
}

// Common Wikidata property IDs
export const WIKIDATA_PROPERTIES = {
	// Media
	IMAGE: 'P18',
	LOGO_IMAGE: 'P154',
	POSTER: 'P3383',

	// Identifiers
	IMDB_ID: 'P345',
	TMDB_MOVIE_ID: 'P4947',
	TMDB_TV_ID: 'P4983',
	SPOTIFY_ARTIST_ID: 'P1902',
	MUSICBRAINZ_ARTIST_ID: 'P434',

	// Basic info
	INSTANCE_OF: 'P31',
	GENRE: 'P136',
	COUNTRY: 'P17',
	PUBLICATION_DATE: 'P577',
	INCEPTION: 'P571',
	START_TIME: 'P580',
	END_TIME: 'P582',

	// People
	DIRECTOR: 'P57',
	PRODUCER: 'P162',
	CAST_MEMBER: 'P161',
	AUTHOR: 'P50',
	COMPOSER: 'P86',
	PERFORMER: 'P175',

	// Media specific
	DURATION: 'P2047',
	NUMBER_OF_EPISODES: 'P1113',
	NUMBER_OF_SEASONS: 'P2437',
	ORIGINAL_NETWORK: 'P449',
	DISTRIBUTED_BY: 'P750',

	// Music
	RECORD_LABEL: 'P264',
	DISCOGRAPHY: 'P358',
	MUSIC_VIDEO: 'P6718'
} as const;

export type WikidataPropertyId = (typeof WIKIDATA_PROPERTIES)[keyof typeof WIKIDATA_PROPERTIES];
