/**
 * OMDB Adapter
 *
 * Transforms OMDB API responses to internal Movie type.
 * OMDB (Open Movie Database) provides movie, series, and episode data.
 */

import { AdapterClass } from './adapter.class';
import type { Movie } from '$types/media.type';

// ============================================================================
// OMDB API Types
// ============================================================================

/**
 * OMDB search result item
 */
export interface OMDBSearchResult {
	Title: string;
	Year: string;
	imdbID: string;
	Type: 'movie' | 'series' | 'episode';
	Poster: string;
}

/**
 * OMDB detailed result
 */
export interface OMDBDetailedResult {
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
	Ratings?: Array<{ Source: string; Value: string }>;
	Metascore?: string;
	imdbRating?: string;
	imdbVotes?: string;
	imdbID: string;
	Type: 'movie' | 'series' | 'episode';
	DVD?: string;
	BoxOffice?: string;
	Production?: string;
	Website?: string;
	Response: string;
	Error?: string;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class OMDBAdapter extends AdapterClass<OMDBDetailedResult, Movie> {
	constructor() {
		super('omdb');
	}

	/**
	 * Transform OMDB API response to internal Movie format
	 */
	fromApi(apiData: OMDBDetailedResult): Movie {
		return {
			id: apiData.imdbID,
			title: apiData.Title,
			year: this.parseYear(apiData.Year),
			type: apiData.Type,
			poster: this.normalizePoster(apiData.Poster),
			plot: apiData.Plot !== 'N/A' ? apiData.Plot : undefined,
			director: apiData.Director !== 'N/A' ? apiData.Director : undefined,
			actors: this.parseCommaList(apiData.Actors),
			genres: this.parseCommaList(apiData.Genre),
			rating: this.parseImdbRating(apiData.imdbRating),
			runtime: this.parseRuntime(apiData.Runtime),
			language: apiData.Language !== 'N/A' ? apiData.Language : undefined,
			country: apiData.Country !== 'N/A' ? apiData.Country : undefined,
			awards: apiData.Awards !== 'N/A' ? apiData.Awards : undefined,
			imdbId: apiData.imdbID
		};
	}

	/**
	 * Transform search result to Movie (partial data)
	 */
	fromSearchResult(result: OMDBSearchResult): Movie {
		return {
			id: result.imdbID,
			title: result.Title,
			year: this.parseYear(result.Year),
			type: result.Type,
			poster: this.normalizePoster(result.Poster),
			imdbId: result.imdbID
		};
	}

	/**
	 * Transform array of search results
	 */
	fromSearchResults(results: OMDBSearchResult[]): Movie[] {
		return results.map((r) => this.fromSearchResult(r));
	}

	/**
	 * Format movie for display
	 */
	toDisplayFormat(movie: Movie): string {
		return `${movie.title} (${movie.year})`;
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private parseYear(year: string): number {
		// Handle year ranges like "2019–2023"
		const match = year.match(/^\d{4}/);
		return match ? parseInt(match[0], 10) : new Date().getFullYear();
	}

	private normalizePoster(poster?: string): string | undefined {
		if (!poster || poster === 'N/A') {
			return undefined;
		}
		return poster;
	}

	private parseCommaList(str?: string): string[] | undefined {
		if (!str || str === 'N/A') {
			return undefined;
		}
		return str.split(',').map((s) => s.trim());
	}

	private parseImdbRating(rating?: string): number | undefined {
		if (!rating || rating === 'N/A') {
			return undefined;
		}
		const parsed = parseFloat(rating);
		return isNaN(parsed) ? undefined : parsed;
	}

	private parseRuntime(runtime?: string): number | undefined {
		if (!runtime || runtime === 'N/A') {
			return undefined;
		}
		const match = runtime.match(/(\d+)/);
		return match ? parseInt(match[1], 10) : undefined;
	}
}

export const omdbAdapter = new OMDBAdapter();
