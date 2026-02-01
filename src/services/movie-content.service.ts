/**
 * Content Extraction Service
 * Wrapper for UI that uses the shared extraction logic for movies, TV shows, awards, and anime
 */

import { invoke } from '@tauri-apps/api/core';
import { extractMovie as extractMovieCore } from '../../scripts/content/core/movie-extractor';
import { extractTv as extractTvCore } from '../../scripts/content/core/tv-extractor';
import { extractAwards as extractAwardsCore } from '../../scripts/content/core/awards-extractor';
import { extractAnime as extractAnimeCore } from '../../scripts/content/core/anime-extractor';
import type { AwardsDataLoader } from '../../scripts/content/core/awards-extractor';
import {
	initTauriAdapter,
	createTauriAdapter
} from '../../scripts/content/core/db/tauri-adapter';
import type {
	ExtractMovieOptions,
	ExtractTvOptions,
	ExtractAwardsOptions,
	ExtractAnimeOptions,
	ExtractResult,
	ExtractAwardsResult,
	ExtractAnimeResult,
	ApiKeys,
	AwardEvent
} from '../../scripts/content/core/types';
import type { ApiConfig } from '$services/fetch.service';
import * as awardsService from '$services/awards.service';

let adapterInitialized = false;

/**
 * Initialize the Tauri adapter (call once on app startup)
 */
export async function initMovieContentService(): Promise<void> {
	if (!adapterInitialized) {
		await initTauriAdapter();
		adapterInitialized = true;
	}
}

/**
 * Get API keys from the Tauri backend
 */
async function getApiKeys(): Promise<ApiKeys> {
	const config = await invoke<ApiConfig>('get_api_config');

	if (!config.omdbApiKey) {
		throw new Error('OMDB API key not configured. Go to Settings to add it.');
	}

	if (!config.tmdbApiKey) {
		throw new Error('TMDB API key not configured. Go to Settings to add it.');
	}

	return {
		omdb: config.omdbApiKey,
		tmdb: config.tmdbApiKey
	};
}

/**
 * Extract movie content by IMDB ID
 * This is the main entry point for UI-triggered extractions
 */
export async function extractMovieByImdbId(
	imdbId: string,
	options?: Partial<Omit<ExtractMovieOptions, 'imdbId' | 'apiKeys'>>
): Promise<ExtractResult> {
	await initMovieContentService();

	const apiKeys = await getApiKeys();
	const db = createTauriAdapter();

	try {
		return await extractMovieCore(
			{
				imdbId,
				apiKeys,
				...options
			},
			db
		);
	} finally {
		db.close();
	}
}

/**
 * Extract movie content by search query
 * Searches and extracts the first matching result
 */
export async function extractMovieBySearch(
	query: string,
	year?: string,
	options?: Partial<Omit<ExtractMovieOptions, 'searchQuery' | 'year' | 'apiKeys'>>
): Promise<ExtractResult> {
	await initMovieContentService();

	const apiKeys = await getApiKeys();
	const db = createTauriAdapter();

	try {
		return await extractMovieCore(
			{
				searchQuery: query,
				year,
				apiKeys,
				...options
			},
			db
		);
	} finally {
		db.close();
	}
}

/**
 * Dry run extraction to preview what would be created
 */
export async function previewMovieExtraction(
	imdbId: string,
	options?: Partial<Omit<ExtractMovieOptions, 'imdbId' | 'apiKeys' | 'dryRun'>>
): Promise<ExtractResult> {
	return extractMovieByImdbId(imdbId, { ...options, dryRun: true });
}

// ============================================================================
// TV SHOW EXTRACTION
// ============================================================================

/**
 * Extract TV show content by IMDB ID
 * This is the main entry point for UI-triggered TV extractions
 */
export async function extractTvByImdbId(
	imdbId: string,
	options?: Partial<Omit<ExtractTvOptions, 'imdbId' | 'apiKeys'>>
): Promise<ExtractResult> {
	await initMovieContentService();

	const apiKeys = await getApiKeys();
	const db = createTauriAdapter();

	try {
		return await extractTvCore(
			{
				imdbId,
				apiKeys,
				...options
			},
			db
		);
	} finally {
		db.close();
	}
}

/**
 * Extract TV show content by search query
 * Searches and extracts the first matching result
 */
export async function extractTvBySearch(
	query: string,
	year?: string,
	options?: Partial<Omit<ExtractTvOptions, 'searchQuery' | 'year' | 'apiKeys'>>
): Promise<ExtractResult> {
	await initMovieContentService();

	const apiKeys = await getApiKeys();
	const db = createTauriAdapter();

	try {
		return await extractTvCore(
			{
				searchQuery: query,
				year,
				apiKeys,
				...options
			},
			db
		);
	} finally {
		db.close();
	}
}

/**
 * Dry run TV extraction to preview what would be created
 */
export async function previewTvExtraction(
	imdbId: string,
	options?: Partial<Omit<ExtractTvOptions, 'imdbId' | 'apiKeys' | 'dryRun'>>
): Promise<ExtractResult> {
	return extractTvByImdbId(imdbId, { ...options, dryRun: true });
}

// ============================================================================
// AWARDS EXTRACTION
// ============================================================================

/**
 * Create an awards data loader that wraps the UI awards service
 */
function createAwardsDataLoader(): AwardsDataLoader {
	return {
		loadAwardEvent(eventId: string): AwardEvent | null {
			return awardsService.loadAwardEvent(eventId);
		},

		getEventName(eventId: string): string {
			return awardsService.getEventName(eventId);
		},

		getYearsForEvent(event: AwardEvent): string[] {
			return awardsService.getYearsForEvent(event);
		},

		getAwardTypesForYear(event: AwardEvent, year: string): string[] {
			return awardsService.getAwardTypesForYear(event, year);
		},

		getCategoriesForAwardType(
			event: AwardEvent,
			year: string,
			awardType: string
		): string[] {
			return awardsService.getCategoriesForAwardType(event, year, awardType);
		},

		getNomineesForCategory(
			event: AwardEvent,
			year: string,
			awardType: string,
			category: string
		): { nominee: string[]; winner: string[] } | null {
			return awardsService.getNomineesForCategory(event, year, awardType, category);
		},

		formatCategoryName(category: string): string {
			return awardsService.formatCategoryName(category);
		},

		formatAwardTypeName(awardType: string): string {
			return awardsService.formatAwardTypeName(awardType);
		}
	};
}

/**
 * Extract awards content for an event
 * This is the main entry point for UI-triggered award extractions
 */
export async function extractAwardsByEvent(
	eventId: string,
	options?: Partial<Omit<ExtractAwardsOptions, 'eventId' | 'apiKeys'>>
): Promise<ExtractAwardsResult> {
	await initMovieContentService();

	const apiKeys = await getApiKeys();
	const db = createTauriAdapter();
	const dataLoader = createAwardsDataLoader();

	try {
		return await extractAwardsCore(
			{
				eventId,
				apiKeys,
				...options
			},
			db,
			dataLoader
		);
	} finally {
		db.close();
	}
}

/**
 * Extract awards content for a specific year
 */
export async function extractAwardsByYear(
	eventId: string,
	year: string,
	options?: Partial<Omit<ExtractAwardsOptions, 'eventId' | 'year' | 'apiKeys'>>
): Promise<ExtractAwardsResult> {
	return extractAwardsByEvent(eventId, { year, ...options });
}

/**
 * Extract awards content for a specific award type
 */
export async function extractAwardsByType(
	eventId: string,
	year: string,
	awardType: string,
	options?: Partial<Omit<ExtractAwardsOptions, 'eventId' | 'year' | 'awardType' | 'apiKeys'>>
): Promise<ExtractAwardsResult> {
	return extractAwardsByEvent(eventId, { year, awardType, ...options });
}

/**
 * Dry run awards extraction to preview what would be created
 */
export async function previewAwardsExtraction(
	eventId: string,
	options?: Partial<Omit<ExtractAwardsOptions, 'eventId' | 'apiKeys' | 'dryRun'>>
): Promise<ExtractAwardsResult> {
	return extractAwardsByEvent(eventId, { ...options, dryRun: true });
}

// ============================================================================
// ANIME EXTRACTION
// ============================================================================

/**
 * Extract anime content by AniList ID
 * This is the main entry point for UI-triggered anime extractions
 */
export async function extractAnimeByAnilistId(
	anilistId: number,
	options?: Partial<Omit<ExtractAnimeOptions, 'anilistId'>>
): Promise<ExtractAnimeResult> {
	await initMovieContentService();

	const db = createTauriAdapter();

	try {
		return await extractAnimeCore(
			{
				anilistId,
				...options
			},
			db
		);
	} finally {
		db.close();
	}
}

/**
 * Extract anime content by MAL ID
 */
export async function extractAnimeByMalId(
	malId: number,
	options?: Partial<Omit<ExtractAnimeOptions, 'malId'>>
): Promise<ExtractAnimeResult> {
	await initMovieContentService();

	const db = createTauriAdapter();

	try {
		return await extractAnimeCore(
			{
				malId,
				...options
			},
			db
		);
	} finally {
		db.close();
	}
}

/**
 * Extract anime content by search query
 * Searches and extracts the first matching result
 */
export async function extractAnimeBySearch(
	query: string,
	options?: Partial<Omit<ExtractAnimeOptions, 'searchQuery'>>
): Promise<ExtractAnimeResult> {
	await initMovieContentService();

	const db = createTauriAdapter();

	try {
		return await extractAnimeCore(
			{
				searchQuery: query,
				...options
			},
			db
		);
	} finally {
		db.close();
	}
}

/**
 * Dry run anime extraction to preview what would be created
 */
export async function previewAnimeExtraction(
	anilistId: number,
	options?: Partial<Omit<ExtractAnimeOptions, 'anilistId' | 'dryRun'>>
): Promise<ExtractAnimeResult> {
	return extractAnimeByAnilistId(anilistId, { ...options, dryRun: true });
}
