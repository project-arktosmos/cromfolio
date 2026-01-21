/**
 * Fanart.tv Service
 * Provides functions for fetching high-quality fan art via the Fanart.tv API
 *
 * Requires FANART_API_KEY environment variable to be set
 * Get a free API key at: https://fanart.tv/get-an-api-key/
 */

import { env } from '$env/dynamic/private';

const FANART_BASE_URL = 'https://webservice.fanart.tv/v3';

function getApiKey(): string | undefined {
	return env.FANART_API_KEY;
}

export interface FanartImage {
	id: string;
	url: string;
	lang: string;
	likes: string;
}

export interface FanartMovieResponse {
	name: string;
	tmdb_id: string;
	imdb_id: string;
	hdmovielogo?: FanartImage[];
	movielogo?: FanartImage[];
	hdmovieclearart?: FanartImage[];
	movieart?: FanartImage[];
	movieposter?: FanartImage[];
	hdmovieclearlogo?: FanartImage[];
	moviethumb?: FanartImage[];
	moviebanner?: FanartImage[];
	moviebackground?: FanartImage[];
	moviedisc?: FanartImage[];
}

export interface FanartTVResponse {
	name: string;
	thetvdb_id: string;
	hdtvlogo?: FanartImage[];
	tvlogo?: FanartImage[];
	clearlogo?: FanartImage[];
	hdclearart?: FanartImage[];
	clearart?: FanartImage[];
	tvposter?: FanartImage[];
	tvbanner?: FanartImage[];
	showbackground?: FanartImage[];
	tvthumb?: FanartImage[];
	seasonposter?: FanartImage[];
	seasonthumb?: FanartImage[];
	seasonbanner?: FanartImage[];
	characterart?: FanartImage[];
}

export interface FanartImageWithType extends FanartImage {
	type: string;
	thumbUrl: string;
}

/**
 * Check if Fanart.tv API key is configured
 */
export function isFanartConfigured(): boolean {
	return !!getApiKey();
}

/**
 * Generate thumbnail URL (Fanart.tv supports /preview/ path for thumbs)
 */
function getThumbUrl(url: string): string {
	// Fanart.tv URLs can be converted to preview by adding /preview/ before the filename
	return url.replace('/fanart/', '/preview/');
}

/**
 * Get movie images by TMDB ID
 */
export async function getMovieImagesByTmdbId(tmdbId: number): Promise<FanartMovieResponse | null> {
	const apiKey = getApiKey();
	if (!apiKey) {
		console.error('[fanart.service] Fanart.tv API key not configured');
		return null;
	}

	try {
		const response = await fetch(
			`${FANART_BASE_URL}/movies/${tmdbId}?api_key=${apiKey}`
		);

		if (response.status === 404) {
			// No images found for this movie
			return null;
		}

		if (!response.ok) {
			throw new Error(`Fanart.tv API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[fanart.service] getMovieImagesByTmdbId error:', error);
		return null;
	}
}

/**
 * Get TV show images by TVDB ID
 * Note: Fanart.tv uses TVDB IDs for TV shows, not TMDB IDs
 */
export async function getTVImagesByTvdbId(tvdbId: number): Promise<FanartTVResponse | null> {
	const apiKey = getApiKey();
	if (!apiKey) {
		console.error('[fanart.service] Fanart.tv API key not configured');
		return null;
	}

	try {
		const response = await fetch(
			`${FANART_BASE_URL}/tv/${tvdbId}?api_key=${apiKey}`
		);

		if (response.status === 404) {
			// No images found for this show
			return null;
		}

		if (!response.ok) {
			throw new Error(`Fanart.tv API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[fanart.service] getTVImagesByTvdbId error:', error);
		return null;
	}
}

/**
 * Get all movie images as a flat array with types
 */
export async function getMovieImagesFlat(tmdbId: number): Promise<FanartImageWithType[]> {
	const data = await getMovieImagesByTmdbId(tmdbId);
	if (!data) return [];

	const images: FanartImageWithType[] = [];
	const imageTypes: (keyof FanartMovieResponse)[] = [
		'movieposter',
		'moviebackground',
		'hdmovielogo',
		'movielogo',
		'hdmovieclearart',
		'movieart',
		'hdmovieclearlogo',
		'moviethumb',
		'moviebanner',
		'moviedisc'
	];

	for (const type of imageTypes) {
		const typeImages = data[type];
		if (Array.isArray(typeImages)) {
			for (const img of typeImages) {
				images.push({
					...img,
					type,
					thumbUrl: getThumbUrl(img.url)
				});
			}
		}
	}

	return images;
}

/**
 * Get all TV images as a flat array with types
 */
export async function getTVImagesFlat(tvdbId: number): Promise<FanartImageWithType[]> {
	const data = await getTVImagesByTvdbId(tvdbId);
	if (!data) return [];

	const images: FanartImageWithType[] = [];
	const imageTypes: (keyof FanartTVResponse)[] = [
		'tvposter',
		'showbackground',
		'hdtvlogo',
		'tvlogo',
		'clearlogo',
		'hdclearart',
		'clearart',
		'tvbanner',
		'tvthumb',
		'seasonposter',
		'seasonthumb',
		'seasonbanner',
		'characterart'
	];

	for (const type of imageTypes) {
		const typeImages = data[type];
		if (Array.isArray(typeImages)) {
			for (const img of typeImages) {
				images.push({
					...img,
					type,
					thumbUrl: getThumbUrl(img.url)
				});
			}
		}
	}

	return images;
}
