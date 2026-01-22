/**
 * Sketchfab API Service
 * Search and browse 3D models from Sketchfab
 * API Docs: https://docs.sketchfab.com/data-api/v3/index.html
 */

import type {
	SketchfabModel,
	SketchfabSearchResponse,
	SketchfabSearchOptions,
	SketchfabDownloadResponse
} from '$types/sketchfab.type';

const SKETCHFAB_API_URL = 'https://api.sketchfab.com/v3';

// Sketchfab model categories
export const SKETCHFAB_CATEGORIES = [
	{ id: 'animals-pets', label: 'Animals & Pets' },
	{ id: 'architecture', label: 'Architecture' },
	{ id: 'art-abstract', label: 'Art & Abstract' },
	{ id: 'cars-vehicles', label: 'Cars & Vehicles' },
	{ id: 'characters-creatures', label: 'Characters & Creatures' },
	{ id: 'cultural-heritage-history', label: 'Cultural Heritage & History' },
	{ id: 'electronics-gadgets', label: 'Electronics & Gadgets' },
	{ id: 'fashion-style', label: 'Fashion & Style' },
	{ id: 'food-drink', label: 'Food & Drink' },
	{ id: 'furniture-home', label: 'Furniture & Home' },
	{ id: 'music', label: 'Music' },
	{ id: 'nature-plants', label: 'Nature & Plants' },
	{ id: 'news-politics', label: 'News & Politics' },
	{ id: 'people', label: 'People' },
	{ id: 'places-travel', label: 'Places & Travel' },
	{ id: 'science-technology', label: 'Science & Technology' },
	{ id: 'sports-fitness', label: 'Sports & Fitness' },
	{ id: 'weapons-military', label: 'Weapons & Military' }
] as const;

// Sort options
export const SKETCHFAB_SORT_OPTIONS = [
	{ id: 'relevance', label: 'Relevance' },
	{ id: 'likeCount', label: 'Most Liked' },
	{ id: 'viewCount', label: 'Most Viewed' },
	{ id: 'publishedAt', label: 'Newest' }
] as const;

/**
 * Search for 3D models on Sketchfab
 * This endpoint is public and doesn't require authentication
 */
export async function searchSketchfab(
	options: SketchfabSearchOptions = {}
): Promise<{ results: SketchfabModel[]; nextCursor?: string; prevCursor?: string }> {
	const {
		query,
		categories,
		tags,
		downloadable = true, // Default to downloadable models only
		animated,
		staffpicked,
		minFaceCount,
		maxFaceCount,
		sortBy = 'relevance',
		cursor,
		count = 24
	} = options;

	const params = new URLSearchParams();

	// Search query
	if (query?.trim()) {
		params.set('q', query.trim());
	}

	// Only show downloadable models (Creative Commons)
	if (downloadable) {
		params.set('downloadable', 'true');
	}

	// Categories filter
	if (categories?.length) {
		categories.forEach((cat) => params.append('categories', cat));
	}

	// Tags filter
	if (tags?.length) {
		tags.forEach((tag) => params.append('tags', tag));
	}

	// Animation filter
	if (animated !== undefined) {
		params.set('animated', animated.toString());
	}

	// Staff picked filter
	if (staffpicked) {
		params.set('staffpicked', 'true');
	}

	// Face count filters
	if (minFaceCount !== undefined) {
		params.set('min_face_count', minFaceCount.toString());
	}
	if (maxFaceCount !== undefined) {
		params.set('max_face_count', maxFaceCount.toString());
	}

	// Sorting
	if (sortBy && sortBy !== 'relevance') {
		params.set('sort_by', `-${sortBy}`); // Prefix with - for descending
	}

	// Pagination
	params.set('count', count.toString());
	if (cursor) {
		params.set('cursor', cursor);
	}

	const url = `${SKETCHFAB_API_URL}/search?type=models&${params}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Sketchfab search failed: ${response.statusText}`);
	}

	const data: SketchfabSearchResponse = await response.json();

	return {
		results: data.results,
		nextCursor: data.cursors?.next,
		prevCursor: data.cursors?.previous
	};
}

/**
 * Get model details by UID
 */
export async function getModelDetails(uid: string): Promise<SketchfabModel> {
	const url = `${SKETCHFAB_API_URL}/models/${uid}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch model details: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get download links for a model (requires authentication)
 */
export async function getModelDownload(
	uid: string,
	apiToken: string
): Promise<SketchfabDownloadResponse> {
	const url = `${SKETCHFAB_API_URL}/models/${uid}/download`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Token ${apiToken}`
		}
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error('Authentication required. Please provide a valid API token.');
		}
		if (response.status === 403) {
			throw new Error('This model is not available for download.');
		}
		throw new Error(`Failed to get download link: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get the best thumbnail URL for a model
 */
export function getThumbnailUrl(model: SketchfabModel, preferredWidth = 256): string {
	if (!model.thumbnails?.images?.length) {
		return '';
	}

	// Sort by width and find closest to preferred
	const sorted = [...model.thumbnails.images].sort(
		(a, b) => Math.abs(a.width - preferredWidth) - Math.abs(b.width - preferredWidth)
	);

	return sorted[0]?.url || '';
}

/**
 * Get Sketchfab model page URL
 */
export function getModelPageUrl(model: SketchfabModel): string {
	return `https://sketchfab.com/3d-models/${model.uid}`;
}

/**
 * Get Sketchfab embed URL for viewer
 */
export function getEmbedUrl(uid: string): string {
	return `https://sketchfab.com/models/${uid}/embed`;
}

/**
 * Format face/vertex count for display
 */
export function formatCount(count: number): string {
	if (count >= 1000000) {
		return `${(count / 1000000).toFixed(1)}M`;
	}
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1)}K`;
	}
	return count.toString();
}

/**
 * Format file size in bytes to human readable
 */
export function formatFileSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}

	return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get license display info
 */
export function getLicenseInfo(model: SketchfabModel): string {
	if (!model.license) {
		return 'Standard License';
	}
	return model.license.label;
}
