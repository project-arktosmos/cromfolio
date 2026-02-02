/**
 * Grammy Awards TypeScript types
 */

// Grammy nominee/winner from the Wikipedia JSON
export interface GrammyNominee {
	wikipediaArticle: string;
	year: string;
	category: string;
	isWinner: boolean;
	entityType: GrammyEntityType;
}

// Entity types for Grammy nominees
export type GrammyEntityType = 'artist' | 'album' | 'recording';

// MusicBrainz search result types
export interface MusicBrainzArtistResult {
	mbid: string;
	name: string;
	sortName?: string;
	disambiguation?: string;
	country?: string;
	artistType?: string;
	score: number;
}

export interface MusicBrainzReleaseResult {
	mbid: string;
	title: string;
	artistCredit?: string;
	date?: string;
	country?: string;
	status?: string;
	releaseGroupMbid?: string;
	coverArtUrl?: string;
	score: number;
}

export interface MusicBrainzRecordingResult {
	mbid: string;
	title: string;
	artistCredit?: string;
	lengthMs?: number;
	firstReleaseDate?: string;
	releaseMbid?: string;
	releaseTitle?: string;
	score: number;
}

// Union type for any MusicBrainz result
export type MusicBrainzResult =
	| MusicBrainzArtistResult
	| MusicBrainzReleaseResult
	| MusicBrainzRecordingResult;

// Grammy nominee with matched MusicBrainz data
export interface GrammyNomineeWithMatch extends GrammyNominee {
	mbMatch?: MusicBrainzResult;
	mbSearchResults?: MusicBrainzResult[];
	isLoading: boolean;
	error?: string;
	selected: boolean;
	coverArtUrl?: string;
}

// Grammy data structure (from JSON)
export interface GrammyCategory {
	nominee: string[];
	winner: string[];
}

export interface GrammyYear {
	grammy: {
		[category: string]: GrammyCategory;
	};
}

export interface GrammyData {
	[year: string]: GrammyYear;
}
