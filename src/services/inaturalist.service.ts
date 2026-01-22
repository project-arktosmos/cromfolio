/**
 * iNaturalist API Service
 * Fetches species images from iNaturalist observations
 */

const INATURALIST_API = 'https://api.inaturalist.org/v1';

export interface INatTaxon {
	id: number;
	name: string;
	rank: string;
	preferred_common_name?: string;
	default_photo?: {
		id: number;
		square_url: string;
		medium_url: string;
		url: string;
	};
	observations_count: number;
}

export interface INatPhoto {
	id: number;
	url: string;
	square_url: string;
	small_url: string;
	medium_url: string;
	large_url: string;
	original_url: string;
	attribution: string;
	license_code: string;
}

export interface INatObservation {
	id: number;
	quality_grade: string;
	photos: INatPhoto[];
	taxon?: INatTaxon;
}

export interface INatTaxaResponse {
	total_results: number;
	page: number;
	per_page: number;
	results: INatTaxon[];
}

export interface INatObservationsResponse {
	total_results: number;
	page: number;
	per_page: number;
	results: INatObservation[];
}

/**
 * Search for a taxon by scientific name
 */
export async function searchTaxon(scientificName: string): Promise<INatTaxon | null> {
	const params = new URLSearchParams({
		q: scientificName,
		rank: 'species',
		per_page: '1'
	});

	const response = await fetch(`${INATURALIST_API}/taxa?${params}`);
	if (!response.ok) {
		throw new Error(`iNaturalist taxa search failed: ${response.statusText}`);
	}

	const data: INatTaxaResponse = await response.json();
	return data.results[0] || null;
}

/**
 * Get observations with photos for a taxon ID
 * Returns research-grade observations with photos
 */
export async function getObservationsWithPhotos(
	taxonId: number,
	limit: number = 12
): Promise<INatObservation[]> {
	const params = new URLSearchParams({
		taxon_id: String(taxonId),
		photos: 'true',
		quality_grade: 'research',
		per_page: String(limit),
		order: 'votes',
		order_by: 'votes'
	});

	const response = await fetch(`${INATURALIST_API}/observations?${params}`);
	if (!response.ok) {
		throw new Error(`iNaturalist observations fetch failed: ${response.statusText}`);
	}

	const data: INatObservationsResponse = await response.json();
	return data.results;
}

/**
 * Get multiple photos for a species by scientific name
 * Returns an array of photo URLs
 */
export async function getSpeciesPhotos(
	scientificName: string,
	limit: number = 12
): Promise<INatPhoto[]> {
	// First, find the taxon
	const taxon = await searchTaxon(scientificName);
	if (!taxon) {
		return [];
	}

	// Then get observations with photos
	const observations = await getObservationsWithPhotos(taxon.id, limit);

	// Extract unique photos from observations
	const photos: INatPhoto[] = [];
	const seenIds = new Set<number>();

	for (const obs of observations) {
		for (const photo of obs.photos) {
			if (!seenIds.has(photo.id)) {
				seenIds.add(photo.id);
				photos.push(photo);
			}
		}
	}

	return photos.slice(0, limit);
}

/**
 * Convert iNaturalist photo URL to different sizes
 * iNat URLs have size in the path: square, small, medium, large, original
 */
export function getPhotoUrl(photo: INatPhoto, size: 'square' | 'small' | 'medium' | 'large' | 'original' = 'medium'): string {
	// iNat photo URLs follow pattern: https://static.inaturalist.org/photos/{id}/{size}.{ext}
	// or https://inaturalist-open-data.s3.amazonaws.com/photos/{id}/{size}.{ext}
	switch (size) {
		case 'square':
			return photo.square_url || photo.url;
		case 'small':
			return photo.small_url || photo.medium_url || photo.url;
		case 'medium':
			return photo.medium_url || photo.url;
		case 'large':
			return photo.large_url || photo.medium_url || photo.url;
		case 'original':
			return photo.original_url || photo.large_url || photo.url;
		default:
			return photo.url;
	}
}
