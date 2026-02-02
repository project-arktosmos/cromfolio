/**
 * Jikan API client (MyAnimeList unofficial API)
 * For additional anime pictures and characters
 * Uses REST - no API key required
 * Works in both Node.js and browser
 */

import type { ImageItem, CharacterItem } from '../types.js';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

// Rate limiting: Jikan has a 3 requests/second limit
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 350; // ms between requests

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;

	if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
		await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
	}

	lastRequestTime = Date.now();
	return fetch(url);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

interface JikanPicturesResponse {
	data: {
		jpg: {
			image_url?: string;
			small_image_url?: string;
			large_image_url?: string;
		};
		webp?: {
			image_url?: string;
			small_image_url?: string;
			large_image_url?: string;
		};
	}[];
}

interface JikanCharactersResponse {
	data: {
		character: {
			mal_id: number;
			name: string;
			images: {
				jpg: {
					image_url?: string;
					small_image_url?: string;
				};
			};
		};
		role: string;
		voice_actors: {
			person: {
				mal_id: number;
				name: string;
				images: {
					jpg: {
						image_url?: string;
					};
				};
			};
			language: string;
		}[];
	}[];
}

interface JikanSearchResponse {
	data: {
		mal_id: number;
		title: string;
		images: {
			jpg: {
				image_url?: string;
				small_image_url?: string;
				large_image_url?: string;
			};
		};
		synopsis?: string;
		year?: number;
		season?: string;
		type?: string;
		status?: string;
		episodes?: number;
		score?: number;
		genres?: { name: string }[];
	}[];
}

/**
 * Get additional pictures for an anime by MAL ID
 */
export async function getAnimePictures(malId: number): Promise<ImageItem[]> {
	const url = `${JIKAN_BASE_URL}/anime/${malId}/pictures`;

	const response = await rateLimitedFetch(url);

	if (response.status === 404) {
		return [];
	}

	if (!response.ok) {
		throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
	}

	const data: JikanPicturesResponse = await response.json();

	return data.data
		.map((pic) => {
			const url = pic.jpg.large_image_url || pic.jpg.image_url;
			const thumbUrl = pic.jpg.small_image_url || pic.jpg.image_url;

			if (!url || !thumbUrl) return null;

			return {
				url,
				thumbUrl,
				imageType: 'picture',
				source: 'jikan'
			} as ImageItem;
		})
		.filter((img): img is ImageItem => img !== null);
}

/**
 * Get characters for an anime by MAL ID
 */
export async function getAnimeCharacters(malId: number): Promise<CharacterItem[]> {
	const url = `${JIKAN_BASE_URL}/anime/${malId}/characters`;

	const response = await rateLimitedFetch(url);

	if (response.status === 404) {
		return [];
	}

	if (!response.ok) {
		throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
	}

	const data: JikanCharactersResponse = await response.json();

	return data.data
		.map((charData, index) => {
			const profileUrl = charData.character.images.jpg.image_url;
			if (!profileUrl) return null;

			const profileThumbUrl = charData.character.images.jpg.small_image_url || profileUrl;

			// Find Japanese voice actor
			const jpVa = charData.voice_actors.find((va) => va.language === 'Japanese');

			return {
				id: charData.character.mal_id.toString(),
				name: charData.character.name,
				characterName: jpVa?.person.name,
				profileUrl,
				profileThumbUrl,
				order: index,
				source: 'jikan',
				isActorHeadshot: false
			} as CharacterItem;
		})
		.filter((char): char is CharacterItem => char !== null);
}

/**
 * Search for MAL ID by title
 */
export async function findMalId(title: string): Promise<number | null> {
	const url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(title)}&limit=1`;

	const response = await rateLimitedFetch(url);

	if (!response.ok) {
		throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
	}

	const data: JikanSearchResponse = await response.json();

	if (data.data.length === 0) {
		return null;
	}

	return data.data[0].mal_id;
}

/**
 * Search for anime by title (alternative to AniList)
 */
export async function searchAnime(
	query: string,
	limit: number = 15
): Promise<
	{
		malId: number;
		title: string;
		coverImage?: string;
		coverImageLarge?: string;
		synopsis?: string;
		year?: number;
		season?: string;
		type?: string;
		status?: string;
		episodes?: number;
		score?: number;
		genres: string[];
	}[]
> {
	const url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=${limit}`;

	const response = await rateLimitedFetch(url);

	if (!response.ok) {
		throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
	}

	const data: JikanSearchResponse = await response.json();

	return data.data.map((item) => ({
		malId: item.mal_id,
		title: item.title,
		coverImage: item.images.jpg.small_image_url,
		coverImageLarge: item.images.jpg.large_image_url || item.images.jpg.image_url,
		synopsis: item.synopsis,
		year: item.year,
		season: item.season,
		type: item.type,
		status: item.status,
		episodes: item.episodes,
		score: item.score,
		genres: item.genres?.map((g) => g.name) || []
	}));
}
