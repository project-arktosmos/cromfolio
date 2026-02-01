import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ============================================================================
// TYPES
// ============================================================================

export type FetchStatus = 'pending' | 'fetching' | 'success' | 'failed' | 'rateLimited' | 'timeout';

export interface FetchProgressEvent {
	operationId: string;
	source: string;
	status: FetchStatus;
	progress: number;
	message?: string;
}

export interface ImageItem {
	url: string;
	thumbUrl: string;
	imageType: string;
	source: string;
	width?: number;
	height?: number;
	/** Vote average / rating from TMDB (0-10 scale) */
	voteAverage?: number;
	/** Number of likes */
	likes?: number;
	/** Language/region code for the image (e.g., "en", "de") */
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

export interface SourceError {
	source: string;
	error: string;
	retryable: boolean;
}

export interface BatchFetchResult {
	operationId: string;
	images: ImageItem[];
	characters: CharacterItem[];
	sourcesCompleted: string[];
	sourcesFailed: SourceError[];
	totalDurationMs: number;
}

export type ContentType = 'movie' | 'tv' | 'game' | 'anime' | 'sports' | 'animal';

// ============================================================================
// SEARCH RESULT TYPES
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

export interface GameSearchResult {
	id: number;
	name: string;
	slug: string;
	summary?: string;
	firstReleaseDate?: number;
	coverUrl?: string;
	coverThumbUrl?: string;
	rating?: number;
	platforms: string[];
	genres: string[];
	/** Source of the search result: "igdb" or "sgdb" */
	source?: string;
}

export interface AnimeSearchResult {
	id: number;
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

export interface SportsTeamSearchResult {
	id: string;
	name: string;
	shortName?: string;
	sport: string;
	league: string;
	leagueId: string;
	country?: string;
	badgeUrl?: string;
	logoUrl?: string;
	stadium?: string;
	formedYear?: string;
}

export interface SportsLeagueSearchResult {
	id: string;
	name: string;
	sport: string;
	country?: string;
	badgeUrl?: string;
	logoUrl?: string;
	bannerUrl?: string;
	formedYear?: string;
}

export interface AnimalSearchResult {
	wikidataId: string;
	genusName: string;
	commonName?: string;
	description?: string;
	imageUrl?: string;
	thumbUrl?: string;
	taxonomicFamily?: string;
}

export interface SpeciesResult {
	wikidataId: string;
	scientificName: string;
	speciesEpithet: string;
	commonName?: string;
	description?: string;
	imageUrl?: string;
	thumbUrl?: string;
}

export interface ApiConfig {
	omdbApiKey?: string;
	tmdbApiKey?: string;
	twitchClientId?: string;
	twitchClientSecret?: string;
	steamgriddbApiKey?: string;
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

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

export async function searchMovies(
	query: string,
	year?: string
): Promise<MovieSearchResult[]> {
	return invoke<MovieSearchResult[]>('search_movies', { query, year });
}

export async function searchTv(
	query: string,
	year?: string
): Promise<TvSearchResult[]> {
	return invoke<TvSearchResult[]>('search_tv', { query, year });
}

export async function searchGames(query: string): Promise<GameSearchResult[]> {
	return invoke<GameSearchResult[]>('search_games', { query });
}

export async function searchAnime(
	query: string,
	page?: number,
	perPage?: number
): Promise<AnimeSearchResult[]> {
	return invoke<AnimeSearchResult[]>('search_anime', { query, page, perPage });
}

export async function searchSportsTeams(
	query: string
): Promise<SportsTeamSearchResult[]> {
	return invoke<SportsTeamSearchResult[]>('search_sports_teams', { query });
}

export async function searchSportsLeagues(
	country: string
): Promise<SportsLeagueSearchResult[]> {
	return invoke<SportsLeagueSearchResult[]>('search_sports_leagues', { country });
}

export async function searchAnimals(query: string): Promise<AnimalSearchResult[]> {
	return invoke<AnimalSearchResult[]>('search_animals', { query });
}

export async function getContentDetails(imdbId: string): Promise<ContentDetails> {
	return invoke<ContentDetails>('get_content_details', { imdbId });
}

// ============================================================================
// BATCH FETCH
// ============================================================================

export interface FetchSourceImagesOptions {
	contentType: ContentType;
	externalId: string;
	externalIdType: string;
	sources: string[];
	onProgress?: (event: FetchProgressEvent) => void;
}

export async function fetchSourceImages(
	options: FetchSourceImagesOptions
): Promise<BatchFetchResult> {
	let unlisten: UnlistenFn | null = null;

	try {
		// Subscribe to progress events if callback provided
		if (options.onProgress) {
			unlisten = await listen<FetchProgressEvent>('fetch_progress', (event) => {
				options.onProgress!(event.payload);
			});
		}

		// Call the backend command
		// Note: Tauri automatically converts camelCase (JS) to snake_case (Rust)
		const result = await invoke<BatchFetchResult>('fetch_source_images', {
			contentType: options.contentType,
			externalId: options.externalId,
			externalIdType: options.externalIdType,
			sources: options.sources
		});

		return result;
	} finally {
		if (unlisten) {
			unlisten();
		}
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export async function getSpeciesInGenus(
	genusWikidataId: string
): Promise<SpeciesResult[]> {
	return invoke<SpeciesResult[]>('get_species_in_genus', { genusWikidataId });
}

export async function getTeamsInLeague(
	leagueName: string
): Promise<SportsTeamSearchResult[]> {
	return invoke<SportsTeamSearchResult[]>('get_teams_in_league', { leagueName });
}

// ============================================================================
// API CONFIG
// ============================================================================

export async function getApiConfig(): Promise<ApiConfig> {
	return invoke<ApiConfig>('get_api_config');
}

export async function updateApiConfig(config: ApiConfig): Promise<void> {
	return invoke<void>('update_api_config', { config });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get available sources for a content type
 */
export function getSourcesForContentType(contentType: ContentType): string[] {
	switch (contentType) {
		case 'movie':
			return ['tmdb', 'credits'];
		case 'tv':
			return ['tmdb', 'tvmaze', 'credits'];
		case 'game':
			return ['igdb', 'sgdb'];
		case 'anime':
			return ['anilist', 'anilist_characters', 'jikan', 'jikan_characters'];
		case 'sports':
			return ['team', 'league'];
		case 'animal':
			return ['wikidata', 'inaturalist'];
		default:
			return [];
	}
}

/**
 * Filter images by source
 */
export function filterImagesBySource(images: ImageItem[], source: string): ImageItem[] {
	return images.filter((img) => img.source === source);
}

/**
 * Group images by type
 */
export function groupImagesByType(images: ImageItem[]): Map<string, ImageItem[]> {
	const groups = new Map<string, ImageItem[]>();
	for (const img of images) {
		const existing = groups.get(img.imageType) || [];
		existing.push(img);
		groups.set(img.imageType, existing);
	}
	return groups;
}
