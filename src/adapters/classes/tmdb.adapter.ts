/**
 * TMDB Adapter
 *
 * Transforms TMDB (The Movie Database) API responses to internal Movie type.
 * TMDB provides rich movie and TV show data with high-quality images.
 */

import { AdapterClass } from './adapter.class';
import type { Movie, TVShow, CastMember, CrewMember, MediaImage } from '$types/media.type';

// ============================================================================
// TMDB API Types
// ============================================================================

/**
 * TMDB movie result
 */
export interface TMDBMovieResult {
	id: number;
	title: string;
	original_title?: string;
	overview?: string;
	release_date?: string;
	poster_path?: string;
	backdrop_path?: string;
	genre_ids?: number[];
	genres?: Array<{ id: number; name: string }>;
	vote_average?: number;
	vote_count?: number;
	popularity?: number;
	adult?: boolean;
	original_language?: string;
	runtime?: number;
	budget?: number;
	revenue?: number;
	status?: string;
	tagline?: string;
	imdb_id?: string;
}

/**
 * TMDB TV show result
 */
export interface TMDBTVResult {
	id: number;
	name: string;
	original_name?: string;
	overview?: string;
	first_air_date?: string;
	last_air_date?: string;
	poster_path?: string;
	backdrop_path?: string;
	genre_ids?: number[];
	genres?: Array<{ id: number; name: string }>;
	vote_average?: number;
	vote_count?: number;
	popularity?: number;
	original_language?: string;
	origin_country?: string[];
	status?: string;
	number_of_seasons?: number;
	number_of_episodes?: number;
	networks?: Array<{ id: number; name: string; logo_path?: string }>;
}

/**
 * TMDB cast member result
 */
export interface TMDBCastResult {
	id: number;
	name: string;
	original_name?: string;
	character?: string;
	profile_path?: string;
	order?: number;
	gender?: number;
	known_for_department?: string;
}

/**
 * TMDB crew member result
 */
export interface TMDBCrewResult {
	id: number;
	name: string;
	original_name?: string;
	job: string;
	department?: string;
	profile_path?: string;
	gender?: number;
}

/**
 * TMDB image result
 */
export interface TMDBImageResult {
	file_path: string;
	width: number;
	height: number;
	aspect_ratio?: number;
	vote_average?: number;
	vote_count?: number;
	iso_639_1?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// ============================================================================
// Adapter Implementation
// ============================================================================

class TMDBAdapter extends AdapterClass<TMDBMovieResult, Movie> {
	constructor() {
		super('tmdb');
	}

	/**
	 * Transform TMDB movie to internal Movie format
	 */
	fromApi(apiData: TMDBMovieResult): Movie {
		return {
			id: String(apiData.id),
			title: apiData.title,
			year: this.extractYear(apiData.release_date),
			type: 'movie',
			poster: this.buildImageUrl(apiData.poster_path, 'w500'),
			backdrop: this.buildImageUrl(apiData.backdrop_path, 'w1280'),
			plot: apiData.overview,
			genres: this.extractGenres(apiData),
			rating: apiData.vote_average,
			runtime: apiData.runtime,
			language: apiData.original_language,
			imdbId: apiData.imdb_id,
			tmdbId: apiData.id
		};
	}

	/**
	 * Transform TMDB TV show to internal TVShow format
	 */
	fromTVApi(apiData: TMDBTVResult): TVShow {
		return {
			id: String(apiData.id),
			name: apiData.name,
			status: this.normalizeStatus(apiData.status),
			premiered: apiData.first_air_date,
			ended: apiData.last_air_date,
			genres: this.extractGenres(apiData),
			rating: apiData.vote_average,
			image: this.buildImageUrl(apiData.poster_path, 'w500'),
			summary: apiData.overview,
			network: apiData.networks?.[0]?.name
		};
	}

	/**
	 * Transform TMDB cast to internal CastMember format
	 */
	fromCast(apiData: TMDBCastResult): CastMember {
		return {
			id: String(apiData.id),
			name: apiData.name,
			character: apiData.character,
			image: this.buildImageUrl(apiData.profile_path, 'w185'),
			order: apiData.order
		};
	}

	/**
	 * Transform TMDB crew to internal CrewMember format
	 */
	fromCrew(apiData: TMDBCrewResult): CrewMember {
		return {
			id: String(apiData.id),
			name: apiData.name,
			job: apiData.job,
			department: apiData.department,
			image: this.buildImageUrl(apiData.profile_path, 'w185')
		};
	}

	/**
	 * Transform TMDB image to internal MediaImage format
	 */
	fromImage(apiData: TMDBImageResult, type: MediaImage['type']): MediaImage {
		return {
			id: apiData.file_path,
			url: this.buildImageUrl(apiData.file_path, 'original') || '',
			type,
			width: apiData.width,
			height: apiData.height,
			aspectRatio: apiData.aspect_ratio,
			language: apiData.iso_639_1 || undefined
		};
	}

	/**
	 * Format movie for display
	 */
	toDisplayFormat(movie: Movie): string {
		return `${movie.title} (${movie.year})`;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromTVApiMany(apiDataArray: TMDBTVResult[]): TVShow[] {
		return apiDataArray.map((item) => this.fromTVApi(item));
	}

	fromCastMany(apiDataArray: TMDBCastResult[]): CastMember[] {
		return apiDataArray.map((item) => this.fromCast(item));
	}

	fromCrewMany(apiDataArray: TMDBCrewResult[]): CrewMember[] {
		return apiDataArray.map((item) => this.fromCrew(item));
	}

	fromImagesMany(apiDataArray: TMDBImageResult[], type: MediaImage['type']): MediaImage[] {
		return apiDataArray.map((item) => this.fromImage(item, type));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private extractYear(releaseDate?: string): number {
		if (!releaseDate) {
			return new Date().getFullYear();
		}
		return parseInt(releaseDate.substring(0, 4), 10);
	}

	private buildImageUrl(path?: string | null, size: string = 'original'): string | undefined {
		if (!path) {
			return undefined;
		}
		return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
	}

	private extractGenres(data: {
		genre_ids?: number[];
		genres?: Array<{ id: number; name: string }>;
	}): string[] {
		if (data.genres) {
			return data.genres.map((g) => g.name);
		}
		// If only genre_ids, we'd need a genre lookup - return empty for now
		return [];
	}

	private normalizeStatus(status?: string): TVShow['status'] {
		const statusMap: Record<string, TVShow['status']> = {
			'Returning Series': 'Running',
			'In Production': 'Running',
			Planned: 'In Development',
			Pilot: 'In Development',
			Ended: 'Ended',
			Canceled: 'Ended'
		};
		return statusMap[status || ''] || status || 'To Be Determined';
	}
}

export const tmdbAdapter = new TMDBAdapter();
