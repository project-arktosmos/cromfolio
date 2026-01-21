/**
 * OMDB Service
 * Provides functions for searching movies, series, and episodes via the OMDB API
 *
 * Requires OMDB_API_KEY environment variable to be set
 * Get a free API key at: https://www.omdbapi.com/apikey.aspx
 */

import { env } from '$env/dynamic/private';

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

function getApiKey(): string | undefined {
	return env.OMDB_API_KEY;
}

export interface OMDBSearchResult {
	Title: string;
	Year: string;
	imdbID: string;
	Type: 'movie' | 'series' | 'episode';
	Poster: string;
}

export interface OMDBSearchResponse {
	Search?: OMDBSearchResult[];
	totalResults?: string;
	Response: 'True' | 'False';
	Error?: string;
}

export interface OMDBDetailedResult {
	Title: string;
	Year: string;
	Rated: string;
	Released: string;
	Runtime: string;
	Genre: string;
	Director: string;
	Writer: string;
	Actors: string;
	Plot: string;
	Language: string;
	Country: string;
	Awards: string;
	Poster: string;
	Ratings: Array<{ Source: string; Value: string }>;
	Metascore: string;
	imdbRating: string;
	imdbVotes: string;
	imdbID: string;
	Type: 'movie' | 'series' | 'episode';
	DVD?: string;
	BoxOffice?: string;
	Production?: string;
	Website?: string;
	totalSeasons?: string;
	Response: 'True' | 'False';
	Error?: string;
}

/**
 * Check if OMDB API key is configured
 */
export function isOmdbConfigured(): boolean {
	return !!getApiKey();
}

/**
 * Search OMDB for movies, series, or episodes
 */
export async function searchOmdb(
	query: string,
	options?: {
		type?: 'movie' | 'series' | 'episode';
		year?: string;
		page?: number;
	}
): Promise<OMDBSearchResponse> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			Response: 'False',
			Error: 'OMDB API key not configured. Set OMDB_API_KEY environment variable.'
		};
	}

	try {
		const params = new URLSearchParams({
			apikey: apiKey,
			s: query
		});

		if (options?.type) {
			params.set('type', options.type);
		}
		if (options?.year) {
			params.set('y', options.year);
		}
		if (options?.page) {
			params.set('page', options.page.toString());
		}

		const response = await fetch(`${OMDB_BASE_URL}?${params.toString()}`);

		if (!response.ok) {
			throw new Error(`OMDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[omdb.service] searchOmdb error:', error);
		return {
			Response: 'False',
			Error: 'Failed to search OMDB'
		};
	}
}

/**
 * Get detailed information about a specific title by IMDb ID
 */
export async function getOmdbDetails(imdbId: string): Promise<OMDBDetailedResult> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			Response: 'False',
			Error: 'OMDB API key not configured. Set OMDB_API_KEY environment variable.'
		} as OMDBDetailedResult;
	}

	try {
		const params = new URLSearchParams({
			apikey: apiKey,
			i: imdbId,
			plot: 'full'
		});

		const response = await fetch(`${OMDB_BASE_URL}?${params.toString()}`);

		if (!response.ok) {
			throw new Error(`OMDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[omdb.service] getOmdbDetails error:', error);
		return {
			Response: 'False',
			Error: 'Failed to get OMDB details'
		} as OMDBDetailedResult;
	}
}

/**
 * Get detailed information about a specific title by name
 */
export async function getOmdbByTitle(
	title: string,
	options?: {
		type?: 'movie' | 'series' | 'episode';
		year?: string;
	}
): Promise<OMDBDetailedResult> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			Response: 'False',
			Error: 'OMDB API key not configured. Set OMDB_API_KEY environment variable.'
		} as OMDBDetailedResult;
	}

	try {
		const params = new URLSearchParams({
			apikey: apiKey,
			t: title,
			plot: 'full'
		});

		if (options?.type) {
			params.set('type', options.type);
		}
		if (options?.year) {
			params.set('y', options.year);
		}

		const response = await fetch(`${OMDB_BASE_URL}?${params.toString()}`);

		if (!response.ok) {
			throw new Error(`OMDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[omdb.service] getOmdbByTitle error:', error);
		return {
			Response: 'False',
			Error: 'Failed to get OMDB details'
		} as OMDBDetailedResult;
	}
}
