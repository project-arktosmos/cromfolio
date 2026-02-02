/**
 * TMDB (The Movie Database) Service
 * Provides functions for fetching images and metadata via the TMDB API
 *
 * Requires TMDB_API_KEY environment variable to be set
 * Get a free API key at: https://www.themoviedb.org/settings/api
 */

import { env } from '$env/dynamic/private';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

function getApiKey(): string | undefined {
	return env.TMDB_API_KEY;
}

export interface TMDBImage {
	aspect_ratio: number;
	height: number;
	width: number;
	file_path: string;
	vote_average: number;
	vote_count: number;
	iso_639_1?: string;
}

export interface TMDBFindResult {
	movie_results: TMDBMovieResult[];
	tv_results: TMDBTVResult[];
}

export interface TMDBMovieResult {
	id: number;
	title: string;
	original_title: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string;
	vote_average: number;
}

export interface TMDBTVResult {
	id: number;
	name: string;
	original_name: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	first_air_date: string;
	vote_average: number;
}

export interface TMDBImagesResponse {
	id: number;
	backdrops: TMDBImage[];
	logos: TMDBImage[];
	posters: TMDBImage[];
}

export interface TMDBImageWithUrl extends TMDBImage {
	url: string;
	thumbUrl: string;
}

/**
 * Check if TMDB API key is configured
 */
export function isTmdbConfigured(): boolean {
	return !!getApiKey();
}

/**
 * Get full image URL from TMDB file path
 */
export function getTmdbImageUrl(filePath: string, size: string = 'original'): string {
	return `${TMDB_IMAGE_BASE_URL}/${size}${filePath}`;
}

/**
 * Find movie/TV show by IMDb ID
 */
export async function findByImdbId(imdbId: string): Promise<TMDBFindResult | null> {
	const apiKey = getApiKey();
	if (!apiKey) {
		console.error('[tmdb.service] TMDB API key not configured');
		return null;
	}

	try {
		const response = await fetch(
			`${TMDB_BASE_URL}/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`
		);

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tmdb.service] findByImdbId error:', error);
		return null;
	}
}

/**
 * Get images for a movie
 */
export async function getMovieImages(tmdbId: number): Promise<TMDBImagesResponse | null> {
	const apiKey = getApiKey();
	if (!apiKey) {
		console.error('[tmdb.service] TMDB API key not configured');
		return null;
	}

	try {
		const response = await fetch(
			`${TMDB_BASE_URL}/movie/${tmdbId}/images?api_key=${apiKey}&include_image_language=en,null`
		);

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tmdb.service] getMovieImages error:', error);
		return null;
	}
}

/**
 * Get images for a TV show
 */
export async function getTVImages(tmdbId: number): Promise<TMDBImagesResponse | null> {
	const apiKey = getApiKey();
	if (!apiKey) {
		console.error('[tmdb.service] TMDB API key not configured');
		return null;
	}

	try {
		const response = await fetch(
			`${TMDB_BASE_URL}/tv/${tmdbId}/images?api_key=${apiKey}&include_image_language=en,null`
		);

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tmdb.service] getTVImages error:', error);
		return null;
	}
}

/**
 * Get images by IMDb ID (auto-detects movie vs TV)
 */
export async function getImagesByImdbId(imdbId: string): Promise<{
	tmdbId: number | null;
	mediaType: 'movie' | 'tv' | null;
	posters: TMDBImageWithUrl[];
	backdrops: TMDBImageWithUrl[];
	logos: TMDBImageWithUrl[];
} | null> {
	const findResult = await findByImdbId(imdbId);
	if (!findResult) return null;

	let tmdbId: number | null = null;
	let mediaType: 'movie' | 'tv' | null = null;
	let imagesResponse: TMDBImagesResponse | null = null;

	// Check movie results first
	if (findResult.movie_results.length > 0) {
		tmdbId = findResult.movie_results[0].id;
		mediaType = 'movie';
		imagesResponse = await getMovieImages(tmdbId);
	}
	// Then check TV results
	else if (findResult.tv_results.length > 0) {
		tmdbId = findResult.tv_results[0].id;
		mediaType = 'tv';
		imagesResponse = await getTVImages(tmdbId);
	}

	if (!imagesResponse) {
		return { tmdbId, mediaType, posters: [], backdrops: [], logos: [] };
	}

	// Transform images to include URLs
	const transformImages = (images: TMDBImage[]): TMDBImageWithUrl[] =>
		images.map((img) => ({
			...img,
			url: getTmdbImageUrl(img.file_path, 'original'),
			thumbUrl: getTmdbImageUrl(img.file_path, 'w300')
		}));

	return {
		tmdbId,
		mediaType,
		posters: transformImages(imagesResponse.posters || []),
		backdrops: transformImages(imagesResponse.backdrops || []),
		logos: transformImages(imagesResponse.logos || [])
	};
}

// Credits/Cast types
export interface TMDBCastMember {
	id: number;
	name: string;
	character: string;
	profile_path: string | null;
	order: number;
	gender: number;
	known_for_department: string;
}

export interface TMDBCreditsResponse {
	id: number;
	cast: TMDBCastMember[];
}

export interface TMDBCastWithImages extends TMDBCastMember {
	profileUrl: string | null;
	profileThumbUrl: string | null;
}

/**
 * Get credits/cast for a movie
 */
export async function getMovieCredits(tmdbId: number): Promise<TMDBCreditsResponse | null> {
	const apiKey = getApiKey();
	if (!apiKey) {
		console.error('[tmdb.service] TMDB API key not configured');
		return null;
	}

	try {
		const response = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${apiKey}`);

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tmdb.service] getMovieCredits error:', error);
		return null;
	}
}

/**
 * Get credits/cast for a TV show
 */
export async function getTVCredits(tmdbId: number): Promise<TMDBCreditsResponse | null> {
	const apiKey = getApiKey();
	if (!apiKey) {
		console.error('[tmdb.service] TMDB API key not configured');
		return null;
	}

	try {
		const response = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/credits?api_key=${apiKey}`);

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tmdb.service] getTVCredits error:', error);
		return null;
	}
}

/**
 * Get credits/cast by TMDB ID with profile images
 */
export async function getCreditsByTmdbId(
	tmdbId: number,
	mediaType: 'movie' | 'tv'
): Promise<TMDBCastWithImages[]> {
	const creditsResponse =
		mediaType === 'movie' ? await getMovieCredits(tmdbId) : await getTVCredits(tmdbId);

	if (!creditsResponse) return [];

	// Transform cast to include profile URLs, filter those with images
	return creditsResponse.cast
		.filter((member) => member.profile_path)
		.map((member) => ({
			...member,
			profileUrl: member.profile_path ? getTmdbImageUrl(member.profile_path, 'original') : null,
			profileThumbUrl: member.profile_path ? getTmdbImageUrl(member.profile_path, 'w185') : null
		}));
}
