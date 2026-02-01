/**
 * Shared types for movie content extraction
 * Used by both CLI scripts and UI services
 */

// ============================================================================
// BASIC TYPES
// ============================================================================

export type ID = string | number;

// ============================================================================
// SOURCE TYPES
// ============================================================================

export type SourceType =
	| 'movie'
	| 'tv'
	| 'videogame'
	| 'anime'
	| 'sports_league'
	| 'animal'
	| 'award_list';

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

// ============================================================================
// STICKER TYPES
// ============================================================================

export interface Sticker {
	id: ID;
	sourceId: ID;
	name: string;
	image: string;
	stickerTypeId?: ID;
	rarityId?: ID;
	imageSource?: string;
	width?: number;
	height?: number;
	fragmentOf?: string;
	fragmentPosition?: 1 | 2 | 3 | 4;
	addedAt?: string;
	createdAt?: string;
	updatedAt?: string;
}

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type ProviderType =
	| 'movie'
	| 'tv'
	| 'game'
	| 'anime'
	| 'sports_team'
	| 'sports_league'
	| 'animal';

export type ExternalIdType =
	| 'imdb'
	| 'tmdb'
	| 'igdb'
	| 'sgdb'
	| 'anilist'
	| 'sportsdb_team'
	| 'sportsdb_league'
	| 'wikidata';

export interface Provider {
	id: ID;
	sourceId: ID;
	providerType: ProviderType;
	externalId: string;
	externalIdType: ExternalIdType;
	createdAt?: string;
}

// ============================================================================
// TAG TYPES
// ============================================================================

export interface Tag {
	id: ID;
	key: string;
	value: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface StickerTag {
	stickerId: ID;
	tagId: ID;
	createdAt?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface MovieSearchResult {
	title: string;
	year: string;
	imdbId: string;
	mediaType: string;
	poster?: string;
}

export interface TvSearchResult {
	title: string;
	year: string;
	imdbId: string;
	mediaType: string;
	poster?: string;
}

export interface ContentDetails {
	title: string;
	year: string;
	rated?: string;
	released?: string;
	runtime?: string;
	genre?: string;
	director?: string;
	writer?: string;
	actors?: string;
	plot?: string;
	language?: string;
	country?: string;
	awards?: string;
	poster?: string;
	imdbRating?: string;
	imdbVotes?: string;
	imdbId: string;
	mediaType: string;
	totalSeasons?: string;
	metascore?: string;
	boxOffice?: string;
	production?: string;
}

export interface TmdbIdResult {
	tmdbId: number;
	mediaType: string;
}

export interface ImageItem {
	url: string;
	thumbUrl: string;
	imageType: string;
	source: string;
	width?: number;
	height?: number;
	voteAverage?: number;
	likes?: number;
	language?: string;
}

export interface CharacterItem {
	id: string;
	name: string;
	characterName?: string;
	profileUrl: string;
	profileThumbUrl: string;
	order: number;
	source: string;
	isActorHeadshot: boolean;
}

// ============================================================================
// EXTRACTOR TYPES
// ============================================================================

export interface ExtractMovieOptions {
	imdbId?: string;
	searchQuery?: string;
	year?: string;
	withCast?: boolean;
	dryRun?: boolean;
	maxPosters?: number;
	maxBackdrops?: number;
	apiKeys: ApiKeys;
}

export interface ExtractTvOptions {
	imdbId?: string;
	searchQuery?: string;
	year?: string;
	withCast?: boolean;
	dryRun?: boolean;
	maxPosters?: number;
	maxBackdrops?: number;
	apiKeys: ApiKeys;
}

export interface ApiKeys {
	omdb: string;
	tmdb: string;
}

export interface ExtractResult {
	success: boolean;
	message: string;
	source?: Source;
	stickersCreated: number;
	tagsCreated: number;
	imagesSkipped: number;
	details?: ContentDetails;
	error?: string;
}

// ============================================================================
// AWARDS TYPES
// ============================================================================

export interface AwardCategory {
	nominee: string[];
	winner: string[];
}

export interface AwardType {
	[categoryName: string]: AwardCategory;
}

export interface AwardYear {
	[awardType: string]: AwardType;
}

export interface AwardEvent {
	[year: string]: AwardYear;
}

export interface EventInfo {
	id: string;
	name: string;
}

export interface ExtractAwardsOptions {
	eventId: string;
	year?: string;
	awardType?: string;
	category?: string;
	dryRun?: boolean;
	apiKeys: ApiKeys;
}

export interface ExtractAwardsResult {
	success: boolean;
	message: string;
	sourcesCreated: number;
	stickersCreated: number;
	tagsCreated: number;
	skipped: number;
	errors: string[];
}

// ============================================================================
// ANIME TYPES
// ============================================================================

export interface AnimeSearchResult {
	id: number;
	malId?: number;
	titleRomaji: string;
	titleEnglish?: string;
	coverImage: string;
	coverImageLarge?: string;
	bannerImage?: string;
	description?: string;
	startYear?: number;
	season?: string;
	format?: string;
	status?: string;
	episodes?: number;
	genres: string[];
	averageScore?: number;
}

export interface ExtractAnimeOptions {
	anilistId?: number;
	malId?: number;
	searchQuery?: string;
	withCharacters?: boolean;
	withJikanImages?: boolean;
	dryRun?: boolean;
	maxImages?: number;
	maxCharacters?: number;
}

export interface ExtractAnimeResult {
	success: boolean;
	message: string;
	source?: Source;
	stickersCreated: number;
	tagsCreated: number;
	imagesSkipped: number;
	anime?: AnimeSearchResult;
	error?: string;
}
