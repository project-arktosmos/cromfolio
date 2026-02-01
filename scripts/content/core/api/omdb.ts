/**
 * OMDB API client for movie/TV search and details
 * Uses native fetch - works in both Node.js and browser
 */

import type { MovieSearchResult, TvSearchResult, ContentDetails } from '../types.js';

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

interface OmdbSearchResponse {
	Search?: OmdbSearchItem[];
	Response: string;
	Error?: string;
	totalResults?: string;
}

interface OmdbSearchItem {
	Title: string;
	Year: string;
	imdbID: string;
	Type: string;
	Poster: string;
}

interface OmdbDetailResponse {
	Title: string;
	Year: string;
	Rated?: string;
	Released?: string;
	Runtime?: string;
	Genre?: string;
	Director?: string;
	Writer?: string;
	Actors?: string;
	Plot?: string;
	Language?: string;
	Country?: string;
	Awards?: string;
	Poster?: string;
	imdbRating?: string;
	imdbVotes?: string;
	imdbID: string;
	Type: string;
	totalSeasons?: string;
	Metascore?: string;
	BoxOffice?: string;
	Production?: string;
	Response: string;
	Error?: string;
}

/**
 * Clean optional string value - convert "N/A" to undefined
 */
function cleanOption(value: string | undefined): string | undefined {
	if (!value || value === 'N/A' || value.trim() === '') {
		return undefined;
	}
	return value;
}

/**
 * Search for movies by title
 */
export async function searchMovies(
	apiKey: string,
	query: string,
	year?: string
): Promise<MovieSearchResult[]> {
	const params = new URLSearchParams({
		apikey: apiKey,
		s: query,
		type: 'movie'
	});

	if (year) {
		params.set('y', year);
	}

	const url = `${OMDB_BASE_URL}?${params.toString()}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`OMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: OmdbSearchResponse = await response.json();

	if (data.Response === 'False') {
		if (data.Error?.includes('not found') || data.Error?.includes('No results')) {
			return [];
		}
		throw new Error(`OMDB API error: ${data.Error}`);
	}

	return (data.Search || []).map((item) => ({
		title: item.Title,
		year: item.Year,
		imdbId: item.imdbID,
		mediaType: item.Type,
		poster: item.Poster === 'N/A' ? undefined : item.Poster
	}));
}

/**
 * Search for TV series by title
 */
export async function searchTv(
	apiKey: string,
	query: string,
	year?: string
): Promise<TvSearchResult[]> {
	const params = new URLSearchParams({
		apikey: apiKey,
		s: query,
		type: 'series'
	});

	if (year) {
		params.set('y', year);
	}

	const url = `${OMDB_BASE_URL}?${params.toString()}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`OMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: OmdbSearchResponse = await response.json();

	if (data.Response === 'False') {
		if (data.Error?.includes('not found') || data.Error?.includes('No results')) {
			return [];
		}
		throw new Error(`OMDB API error: ${data.Error}`);
	}

	return (data.Search || []).map((item) => ({
		title: item.Title,
		year: item.Year,
		imdbId: item.imdbID,
		mediaType: item.Type,
		poster: item.Poster === 'N/A' ? undefined : item.Poster
	}));
}

/**
 * Get detailed information for a movie or TV show by IMDb ID
 */
export async function getContentDetails(
	apiKey: string,
	imdbId: string
): Promise<ContentDetails> {
	const params = new URLSearchParams({
		apikey: apiKey,
		i: imdbId,
		plot: 'full'
	});

	const url = `${OMDB_BASE_URL}?${params.toString()}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`OMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: OmdbDetailResponse = await response.json();

	if (data.Response === 'False') {
		if (data.Error) {
			throw new Error(`OMDB API error: ${data.Error}`);
		}
		throw new Error('Movie not found');
	}

	return {
		title: data.Title,
		year: data.Year,
		rated: cleanOption(data.Rated),
		released: cleanOption(data.Released),
		runtime: cleanOption(data.Runtime),
		genre: cleanOption(data.Genre),
		director: cleanOption(data.Director),
		writer: cleanOption(data.Writer),
		actors: cleanOption(data.Actors),
		plot: cleanOption(data.Plot),
		language: cleanOption(data.Language),
		country: cleanOption(data.Country),
		awards: cleanOption(data.Awards),
		poster: cleanOption(data.Poster),
		imdbRating: cleanOption(data.imdbRating),
		imdbVotes: cleanOption(data.imdbVotes),
		imdbId: data.imdbID,
		mediaType: data.Type,
		totalSeasons: cleanOption(data.totalSeasons),
		metascore: cleanOption(data.Metascore),
		boxOffice: cleanOption(data.BoxOffice),
		production: cleanOption(data.Production)
	};
}

// Alias for backwards compatibility
export const getMovieDetails = getContentDetails;
