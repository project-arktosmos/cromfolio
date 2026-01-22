/**
 * IGDB Service
 * Provides functions for searching video games via the IGDB API
 *
 * Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables
 * Get credentials at: https://dev.twitch.tv/console/apps
 * (Create an app, then use Client ID and generate a Client Secret)
 */

import { env } from '$env/dynamic/private';

const IGDB_BASE_URL = 'https://api.igdb.com/v4';
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token';

// Cache for the access token
let cachedToken: { token: string; expiresAt: number } | null = null;

function getClientId(): string | undefined {
	return env.TWITCH_CLIENT_ID;
}

function getClientSecret(): string | undefined {
	return env.TWITCH_CLIENT_SECRET;
}

/**
 * Check if IGDB is configured
 */
export function isIgdbConfigured(): boolean {
	return !!getClientId() && !!getClientSecret();
}

/**
 * Get a valid access token, fetching a new one if needed
 */
async function getAccessToken(): Promise<string | null> {
	const clientId = getClientId();
	const clientSecret = getClientSecret();

	if (!clientId || !clientSecret) {
		return null;
	}

	// Check if we have a valid cached token
	if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
		return cachedToken.token;
	}

	try {
		const response = await fetch(
			`${TWITCH_AUTH_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
			{ method: 'POST' }
		);

		if (!response.ok) {
			console.error('[igdb.service] Failed to get access token:', response.status);
			return null;
		}

		const data = await response.json();
		cachedToken = {
			token: data.access_token,
			expiresAt: Date.now() + data.expires_in * 1000
		};

		return cachedToken.token;
	} catch (error) {
		console.error('[igdb.service] Error getting access token:', error);
		return null;
	}
}

/**
 * Make a request to the IGDB API
 */
async function igdbRequest<T>(endpoint: string, body: string): Promise<T | { error: string }> {
	const clientId = getClientId();
	const token = await getAccessToken();

	if (!clientId || !token) {
		return { error: 'IGDB not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.' };
	}

	try {
		const response = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
			method: 'POST',
			headers: {
				'Client-ID': clientId,
				Authorization: `Bearer ${token}`,
				'Content-Type': 'text/plain'
			},
			body
		});

		if (!response.ok) {
			throw new Error(`IGDB API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`[igdb.service] ${endpoint} error:`, error);
		return { error: `Failed to fetch from IGDB ${endpoint}` };
	}
}

export interface IGDBCover {
	id: number;
	game: number;
	url: string;
	width: number;
	height: number;
	image_id: string;
}

export interface IGDBScreenshot {
	id: number;
	game: number;
	url: string;
	width: number;
	height: number;
	image_id: string;
}

export interface IGDBArtwork {
	id: number;
	game: number;
	url: string;
	width: number;
	height: number;
	image_id: string;
}

export interface IGDBPlatform {
	id: number;
	name: string;
	abbreviation?: string;
}

export interface IGDBGenre {
	id: number;
	name: string;
}

export interface IGDBGame {
	id: number;
	name: string;
	slug: string;
	summary?: string;
	first_release_date?: number;
	rating?: number;
	aggregated_rating?: number;
	cover?: IGDBCover;
	platforms?: IGDBPlatform[];
	genres?: IGDBGenre[];
	screenshots?: IGDBScreenshot[];
	artworks?: IGDBArtwork[];
	url: string;
}

/**
 * Search IGDB for video games
 */
export async function searchIgdb(query: string, limit = 20): Promise<IGDBGame[] | { error: string }> {
	const body = `
		search "${query}";
		fields id, name, slug, summary, first_release_date, rating, aggregated_rating, url,
			cover.url, cover.width, cover.height, cover.image_id,
			platforms.id, platforms.name, platforms.abbreviation,
			genres.id, genres.name;
		limit ${limit};
	`;

	return igdbRequest<IGDBGame[]>('games', body);
}

/**
 * Get game details with images
 */
export async function getIgdbGameWithImages(gameId: number): Promise<IGDBGame | { error: string }> {
	const body = `
		fields id, name, slug, summary, first_release_date, rating, aggregated_rating, url,
			cover.url, cover.width, cover.height, cover.image_id,
			platforms.id, platforms.name, platforms.abbreviation,
			genres.id, genres.name,
			screenshots.url, screenshots.width, screenshots.height, screenshots.image_id,
			artworks.url, artworks.width, artworks.height, artworks.image_id;
		where id = ${gameId};
	`;

	const result = await igdbRequest<IGDBGame[]>('games', body);

	if ('error' in result) {
		return result;
	}

	if (result.length === 0) {
		return { error: 'Game not found' };
	}

	return result[0];
}

/**
 * Convert IGDB image URL to full size
 * IGDB returns URLs like //images.igdb.com/igdb/image/upload/t_thumb/xxx.jpg
 * We can change the size by replacing t_thumb with other sizes
 */
export function getIgdbImageUrl(imageId: string, size: 'thumb' | 'cover_big' | 'screenshot_big' | '1080p' | 'original' = 'cover_big'): string {
	return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}
