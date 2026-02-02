/**
 * TMDB API client for movie/TV images and credits
 * Uses native fetch - works in both Node.js and browser
 */

import type { TmdbIdResult, ImageItem, CharacterItem, ContentDetails } from '../types.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface TmdbFindResponse {
	movie_results: Array<{
		id: number;
		title: string;
		release_date?: string;
		poster_path?: string;
		overview?: string;
	}>;
	tv_results: Array<{
		id: number;
		name: string;
		first_air_date?: string;
		poster_path?: string;
		overview?: string;
	}>;
}

interface TmdbMovieDetails {
	id: number;
	title: string;
	release_date?: string;
	poster_path?: string;
	overview?: string;
	runtime?: number;
	genres?: Array<{ id: number; name: string }>;
	vote_average?: number;
	imdb_id?: string;
}

interface TmdbTvDetails {
	id: number;
	name: string;
	first_air_date?: string;
	poster_path?: string;
	overview?: string;
	number_of_seasons?: number;
	genres?: Array<{ id: number; name: string }>;
	vote_average?: number;
}

interface TmdbImagesResponse {
	posters?: TmdbImage[];
	backdrops?: TmdbImage[];
	logos?: TmdbImage[];
}

interface TmdbImage {
	file_path: string;
	width: number;
	height: number;
	vote_average: number;
	iso_639_1?: string;
}

interface TmdbCreditsResponse {
	cast: TmdbCastMember[];
}

interface TmdbCastMember {
	id: number;
	name: string;
	character: string;
	profile_path?: string;
	order: number;
}

/**
 * Find TMDB ID from IMDb ID
 */
export async function findByImdbId(apiKey: string, imdbId: string): Promise<TmdbIdResult | null> {
	const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: TmdbFindResponse = await response.json();

	// Check movie results first
	if (data.movie_results.length > 0) {
		return {
			tmdbId: data.movie_results[0].id,
			mediaType: 'movie'
		};
	}

	// Then check TV results
	if (data.tv_results.length > 0) {
		return {
			tmdbId: data.tv_results[0].id,
			mediaType: 'tv'
		};
	}

	return null;
}

/**
 * Get movie details by TMDB ID
 */
export async function getMovieDetails(apiKey: string, tmdbId: number): Promise<TmdbMovieDetails> {
	const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${apiKey}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get TV show details by TMDB ID
 */
export async function getTvDetails(apiKey: string, tmdbId: number): Promise<TmdbTvDetails> {
	const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${apiKey}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get content details from TMDB using IMDB ID
 * Returns the same format as OMDB for compatibility
 */
export async function getContentDetailsFromTmdb(
	apiKey: string,
	imdbId: string
): Promise<ContentDetails> {
	// First find the TMDB ID
	const findResult = await findByImdbId(apiKey, imdbId);

	if (!findResult) {
		throw new Error(`Content not found in TMDB for IMDB ID: ${imdbId}`);
	}

	const { tmdbId, mediaType } = findResult;

	if (mediaType === 'movie') {
		const movie = await getMovieDetails(apiKey, tmdbId);
		const year = movie.release_date ? movie.release_date.substring(0, 4) : '';

		return {
			title: movie.title,
			year,
			plot: movie.overview,
			poster: movie.poster_path ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}` : undefined,
			runtime: movie.runtime ? `${movie.runtime} min` : undefined,
			genre: movie.genres?.map((g) => g.name).join(', '),
			imdbId,
			imdbRating: movie.vote_average?.toString(),
			mediaType: 'movie'
		};
	} else {
		const tv = await getTvDetails(apiKey, tmdbId);
		const year = tv.first_air_date ? tv.first_air_date.substring(0, 4) : '';

		return {
			title: tv.name,
			year,
			plot: tv.overview,
			poster: tv.poster_path ? `${TMDB_IMAGE_BASE}/w500${tv.poster_path}` : undefined,
			genre: tv.genres?.map((g) => g.name).join(', '),
			imdbId,
			imdbRating: tv.vote_average?.toString(),
			mediaType: 'series',
			totalSeasons: tv.number_of_seasons?.toString()
		};
	}
}

/**
 * Get images for a movie
 */
export async function getMovieImages(apiKey: string, tmdbId: number): Promise<ImageItem[]> {
	const url = `${TMDB_BASE_URL}/movie/${tmdbId}/images?api_key=${apiKey}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: TmdbImagesResponse = await response.json();
	return convertImages(data);
}

/**
 * Get images for a TV show
 */
export async function getTvImages(apiKey: string, tmdbId: number): Promise<ImageItem[]> {
	const url = `${TMDB_BASE_URL}/tv/${tmdbId}/images?api_key=${apiKey}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: TmdbImagesResponse = await response.json();
	return convertImages(data);
}

/**
 * Get cast/credits for a movie
 */
export async function getMovieCredits(apiKey: string, tmdbId: number): Promise<CharacterItem[]> {
	const url = `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${apiKey}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: TmdbCreditsResponse = await response.json();
	return convertCast(data.cast);
}

/**
 * Get cast/credits for a TV show
 */
export async function getTvCredits(apiKey: string, tmdbId: number): Promise<CharacterItem[]> {
	const url = `${TMDB_BASE_URL}/tv/${tmdbId}/credits?api_key=${apiKey}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
	}

	const data: TmdbCreditsResponse = await response.json();
	return convertCast(data.cast);
}

/**
 * Convert TMDB images response to ImageItem array
 */
function convertImages(data: TmdbImagesResponse): ImageItem[] {
	const images: ImageItem[] = [];

	// Process posters
	for (const img of data.posters || []) {
		images.push({
			url: `${TMDB_IMAGE_BASE}/original${img.file_path}`,
			thumbUrl: `${TMDB_IMAGE_BASE}/w185${img.file_path}`,
			imageType: 'poster',
			source: 'tmdb',
			width: img.width,
			height: img.height,
			voteAverage: img.vote_average > 0 ? img.vote_average : undefined,
			language: img.iso_639_1
		});
	}

	// Process backdrops
	for (const img of data.backdrops || []) {
		images.push({
			url: `${TMDB_IMAGE_BASE}/original${img.file_path}`,
			thumbUrl: `${TMDB_IMAGE_BASE}/w300${img.file_path}`,
			imageType: 'backdrop',
			source: 'tmdb',
			width: img.width,
			height: img.height,
			voteAverage: img.vote_average > 0 ? img.vote_average : undefined,
			language: img.iso_639_1
		});
	}

	// Process logos
	for (const img of data.logos || []) {
		images.push({
			url: `${TMDB_IMAGE_BASE}/original${img.file_path}`,
			thumbUrl: `${TMDB_IMAGE_BASE}/w185${img.file_path}`,
			imageType: 'logo',
			source: 'tmdb',
			width: img.width,
			height: img.height,
			voteAverage: img.vote_average > 0 ? img.vote_average : undefined,
			language: img.iso_639_1
		});
	}

	return images;
}

/**
 * Convert TMDB cast to CharacterItem array
 */
function convertCast(cast: TmdbCastMember[]): CharacterItem[] {
	return cast
		.filter((member) => member.profile_path)
		.map((member) => ({
			id: member.id.toString(),
			name: member.name,
			characterName: member.character,
			profileUrl: `${TMDB_IMAGE_BASE}/original${member.profile_path}`,
			profileThumbUrl: `${TMDB_IMAGE_BASE}/w185${member.profile_path}`,
			order: member.order,
			source: 'tmdb-cast',
			isActorHeadshot: true
		}));
}
