/**
 * SteamGridDB Service
 * Provides functions for fetching video game artwork via the SteamGridDB API
 *
 * Requires STEAMGRIDDB_API_KEY environment variable to be set
 * Get a free API key at: https://www.steamgriddb.com/profile/preferences/api
 */

import { env } from '$env/dynamic/private';

const SGDB_BASE_URL = 'https://www.steamgriddb.com/api/v2';

function getApiKey(): string | undefined {
	return env.STEAMGRIDDB_API_KEY;
}

export interface SGDBGame {
	id: number;
	name: string;
	types: string[];
	verified: boolean;
}

export interface SGDBImage {
	id: number;
	score: number;
	style: string;
	width: number;
	height: number;
	nsfw: boolean;
	humor: boolean;
	notes: string | null;
	mime: string;
	language: string;
	url: string;
	thumb: string;
	lock: boolean;
	epilepsy: boolean;
	upvotes: number;
	downvotes: number;
	author: {
		name: string;
		steam64: string;
		avatar: string;
	};
}

export interface SGDBSearchResponse {
	success: boolean;
	data: SGDBGame[];
}

export interface SGDBImagesResponse {
	success: boolean;
	data: SGDBImage[];
}

/**
 * Check if SteamGridDB API key is configured
 */
export function isSgdbConfigured(): boolean {
	return !!getApiKey();
}

/**
 * Search SteamGridDB for games by name
 */
export async function searchSgdbGames(
	name: string
): Promise<SGDBSearchResponse | { error: string }> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			error: 'SteamGridDB API key not configured. Set STEAMGRIDDB_API_KEY environment variable.'
		};
	}

	try {
		const response = await fetch(
			`${SGDB_BASE_URL}/search/autocomplete/${encodeURIComponent(name)}`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`
				}
			}
		);

		if (!response.ok) {
			throw new Error(`SteamGridDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[sgdb.service] searchSgdbGames error:', error);
		return {
			error: 'Failed to search SteamGridDB'
		};
	}
}

/**
 * Get grids (cover art) for a game by game ID
 */
export async function getSgdbGrids(
	gameId: number
): Promise<SGDBImagesResponse | { error: string }> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			error: 'SteamGridDB API key not configured. Set STEAMGRIDDB_API_KEY environment variable.'
		};
	}

	try {
		const response = await fetch(
			`${SGDB_BASE_URL}/grids/game/${gameId}?dimensions=600x900,342x482,460x215`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`
				}
			}
		);

		if (!response.ok) {
			throw new Error(`SteamGridDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[sgdb.service] getSgdbGrids error:', error);
		return {
			error: 'Failed to get SteamGridDB grids'
		};
	}
}

/**
 * Get heroes (banner images) for a game by game ID
 */
export async function getSgdbHeroes(
	gameId: number
): Promise<SGDBImagesResponse | { error: string }> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			error: 'SteamGridDB API key not configured. Set STEAMGRIDDB_API_KEY environment variable.'
		};
	}

	try {
		const response = await fetch(`${SGDB_BASE_URL}/heroes/game/${gameId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		if (!response.ok) {
			throw new Error(`SteamGridDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[sgdb.service] getSgdbHeroes error:', error);
		return {
			error: 'Failed to get SteamGridDB heroes'
		};
	}
}

/**
 * Get logos for a game by game ID
 */
export async function getSgdbLogos(
	gameId: number
): Promise<SGDBImagesResponse | { error: string }> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			error: 'SteamGridDB API key not configured. Set STEAMGRIDDB_API_KEY environment variable.'
		};
	}

	try {
		const response = await fetch(`${SGDB_BASE_URL}/logos/game/${gameId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		if (!response.ok) {
			throw new Error(`SteamGridDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[sgdb.service] getSgdbLogos error:', error);
		return {
			error: 'Failed to get SteamGridDB logos'
		};
	}
}

/**
 * Get icons for a game by game ID
 */
export async function getSgdbIcons(
	gameId: number
): Promise<SGDBImagesResponse | { error: string }> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			error: 'SteamGridDB API key not configured. Set STEAMGRIDDB_API_KEY environment variable.'
		};
	}

	try {
		const response = await fetch(`${SGDB_BASE_URL}/icons/game/${gameId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		if (!response.ok) {
			throw new Error(`SteamGridDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[sgdb.service] getSgdbIcons error:', error);
		return {
			error: 'Failed to get SteamGridDB icons'
		};
	}
}

/**
 * Get all images for a game by name (searches and then fetches images)
 */
export async function getAllSgdbImagesByName(name: string): Promise<
	| {
			gameId: number | null;
			images: Array<{ url: string; thumb: string; type: string; width: number; height: number }>;
	  }
	| { error: string }
> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			error: 'SteamGridDB API key not configured. Set STEAMGRIDDB_API_KEY environment variable.'
		};
	}

	try {
		// First, search for the game
		const searchResult = await searchSgdbGames(name);
		if ('error' in searchResult) {
			return searchResult;
		}

		if (!searchResult.data || searchResult.data.length === 0) {
			return { gameId: null, images: [] };
		}

		const gameId = searchResult.data[0].id;

		// Fetch all image types in parallel
		const [grids, heroes, logos] = await Promise.all([
			getSgdbGrids(gameId),
			getSgdbHeroes(gameId),
			getSgdbLogos(gameId)
		]);

		const images: Array<{
			url: string;
			thumb: string;
			type: string;
			width: number;
			height: number;
		}> = [];

		// Process grids (cover art)
		if (!('error' in grids) && grids.data) {
			for (const img of grids.data.slice(0, 10)) {
				images.push({
					url: img.url,
					thumb: img.thumb,
					type: 'grid',
					width: img.width,
					height: img.height
				});
			}
		}

		// Process heroes (banner images)
		if (!('error' in heroes) && heroes.data) {
			for (const img of heroes.data.slice(0, 10)) {
				images.push({
					url: img.url,
					thumb: img.thumb,
					type: 'hero',
					width: img.width,
					height: img.height
				});
			}
		}

		// Process logos
		if (!('error' in logos) && logos.data) {
			for (const img of logos.data.slice(0, 5)) {
				images.push({
					url: img.url,
					thumb: img.thumb,
					type: 'logo',
					width: img.width,
					height: img.height
				});
			}
		}

		return { gameId, images };
	} catch (error) {
		console.error('[sgdb.service] getAllSgdbImagesByName error:', error);
		return {
			error: 'Failed to get SteamGridDB images'
		};
	}
}
