/**
 * TMDB API client for movie/TV images and credits
 * Uses native fetch - works in both Node.js and browser
 */

import type { TmdbIdResult, ImageItem, CharacterItem } from '../types.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface TmdbFindResponse {
	movie_results: Array<{ id: number }>;
	tv_results: Array<{ id: number }>;
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
export async function findByImdbId(
	apiKey: string,
	imdbId: string
): Promise<TmdbIdResult | null> {
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
 * Get images for a movie
 */
export async function getMovieImages(
	apiKey: string,
	tmdbId: number
): Promise<ImageItem[]> {
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
export async function getTvImages(
	apiKey: string,
	tmdbId: number
): Promise<ImageItem[]> {
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
export async function getMovieCredits(
	apiKey: string,
	tmdbId: number
): Promise<CharacterItem[]> {
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
export async function getTvCredits(
	apiKey: string,
	tmdbId: number
): Promise<CharacterItem[]> {
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
