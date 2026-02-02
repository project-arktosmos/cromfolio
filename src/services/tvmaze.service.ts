/**
 * TVMaze Service
 * Provides functions for fetching TV show images via the TVMaze API
 *
 * No API key required - TVMaze is a free public API
 * Documentation: https://www.tvmaze.com/api
 */

const TVMAZE_BASE_URL = 'https://api.tvmaze.com';

export interface TVMazeShow {
	id: number;
	name: string;
	type: string;
	language: string;
	genres: string[];
	status: string;
	premiered: string;
	ended: string | null;
	officialSite: string | null;
	rating: { average: number | null };
	image: { medium: string; original: string } | null;
	summary: string;
	externals: {
		tvrage: number | null;
		thetvdb: number | null;
		imdb: string | null;
	};
}

export interface TVMazeImage {
	id: number;
	type: string;
	main: boolean;
	resolutions: {
		original?: { url: string; width: number; height: number };
		medium?: { url: string; width: number; height: number };
	};
}

export interface TVMazeCastMember {
	person: {
		id: number;
		name: string;
		image: { medium: string; original: string } | null;
	};
	character: {
		id: number;
		name: string;
		image: { medium: string; original: string } | null;
	};
}

export interface TVMazeImageWithUrl {
	id: number;
	type: string;
	main: boolean;
	url: string;
	thumbUrl: string;
	width?: number;
	height?: number;
}

/**
 * Lookup show by IMDb ID
 */
export async function lookupByImdbId(imdbId: string): Promise<TVMazeShow | null> {
	try {
		const response = await fetch(`${TVMAZE_BASE_URL}/lookup/shows?imdb=${imdbId}`);

		if (response.status === 404) {
			// Show not found
			return null;
		}

		if (!response.ok) {
			throw new Error(`TVMaze API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tvmaze.service] lookupByImdbId error:', error);
		return null;
	}
}

/**
 * Get show images
 */
export async function getShowImages(showId: number): Promise<TVMazeImage[]> {
	try {
		const response = await fetch(`${TVMAZE_BASE_URL}/shows/${showId}/images`);

		if (!response.ok) {
			throw new Error(`TVMaze API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tvmaze.service] getShowImages error:', error);
		return [];
	}
}

/**
 * Get show cast
 */
export async function getShowCast(showId: number): Promise<TVMazeCastMember[]> {
	try {
		const response = await fetch(`${TVMAZE_BASE_URL}/shows/${showId}/cast`);

		if (!response.ok) {
			throw new Error(`TVMaze API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error('[tvmaze.service] getShowCast error:', error);
		return [];
	}
}

/**
 * Get images by IMDb ID (combines show lookup and image fetch)
 */
export async function getImagesByImdbId(imdbId: string): Promise<{
	show: TVMazeShow | null;
	images: TVMazeImageWithUrl[];
	castImages: TVMazeImageWithUrl[];
}> {
	const show = await lookupByImdbId(imdbId);

	if (!show) {
		return { show: null, images: [], castImages: [] };
	}

	// Fetch images and cast in parallel
	const [rawImages, cast] = await Promise.all([getShowImages(show.id), getShowCast(show.id)]);

	// Transform show images
	const images: TVMazeImageWithUrl[] = rawImages
		.map((img) => ({
			id: img.id,
			type: img.type,
			main: img.main,
			url: img.resolutions.original?.url || img.resolutions.medium?.url || '',
			thumbUrl: img.resolutions.medium?.url || img.resolutions.original?.url || '',
			width: img.resolutions.original?.width,
			height: img.resolutions.original?.height
		}))
		.filter((img) => img.url);

	// Extract cast images
	const castImages: TVMazeImageWithUrl[] = [];
	const seenIds = new Set<number>();

	for (const member of cast) {
		// Character images
		if (member.character.image && !seenIds.has(member.character.id)) {
			seenIds.add(member.character.id);
			castImages.push({
				id: member.character.id,
				type: 'character',
				main: false,
				url: member.character.image.original,
				thumbUrl: member.character.image.medium
			});
		}
		// Person images
		if (member.person.image && !seenIds.has(member.person.id + 100000)) {
			seenIds.add(member.person.id + 100000);
			castImages.push({
				id: member.person.id,
				type: 'person',
				main: false,
				url: member.person.image.original,
				thumbUrl: member.person.image.medium
			});
		}
	}

	return { show, images, castImages };
}
