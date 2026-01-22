import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const INATURALIST_API = 'https://api.inaturalist.org/v1';

interface INatPhoto {
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

interface INatObservation {
	id: number;
	quality_grade: string;
	photos: INatPhoto[];
}

interface INatTaxon {
	id: number;
	name: string;
	preferred_common_name?: string;
}

/**
 * GET /api/inaturalist/photos?name=Panthera+leo&limit=12
 * Fetches multiple photos for a species by scientific name
 */
export const GET: RequestHandler = async ({ url }) => {
	const scientificName = url.searchParams.get('name');
	const limit = parseInt(url.searchParams.get('limit') || '12', 10);

	if (!scientificName) {
		return json({ error: 'Missing required parameter: name' }, { status: 400 });
	}

	try {
		// Step 1: Search for the taxon by scientific name
		const taxonParams = new URLSearchParams({
			q: scientificName,
			rank: 'species',
			per_page: '1'
		});

		const taxonResponse = await fetch(`${INATURALIST_API}/taxa?${taxonParams}`);
		if (!taxonResponse.ok) {
			return json({ error: 'Failed to search taxon' }, { status: 500 });
		}

		const taxonData = await taxonResponse.json();
		const taxon: INatTaxon | undefined = taxonData.results[0];

		if (!taxon) {
			return json({ error: 'Taxon not found', photos: [] }, { status: 404 });
		}

		// Step 2: Get research-grade observations with photos
		const obsParams = new URLSearchParams({
			taxon_id: String(taxon.id),
			photos: 'true',
			quality_grade: 'research',
			per_page: String(Math.min(limit * 2, 30)), // Fetch more to ensure we get enough unique photos
			order: 'votes',
			order_by: 'votes'
		});

		const obsResponse = await fetch(`${INATURALIST_API}/observations?${obsParams}`);
		if (!obsResponse.ok) {
			return json({ error: 'Failed to fetch observations' }, { status: 500 });
		}

		const obsData = await obsResponse.json();
		const observations: INatObservation[] = obsData.results;

		// Step 3: Extract unique photos
		const photos: INatPhoto[] = [];
		const seenIds = new Set<number>();

		for (const obs of observations) {
			for (const photo of obs.photos) {
				if (!seenIds.has(photo.id) && photos.length < limit) {
					seenIds.add(photo.id);
					photos.push(photo);
				}
			}
			if (photos.length >= limit) break;
		}

		return json({
			taxon: {
				id: taxon.id,
				name: taxon.name,
				commonName: taxon.preferred_common_name
			},
			photos: photos.map((photo) => ({
				id: photo.id,
				url: photo.medium_url || photo.url,
				thumbUrl: photo.square_url || photo.small_url || photo.url,
				largeUrl: photo.large_url || photo.medium_url || photo.url,
				originalUrl: photo.original_url || photo.large_url || photo.url,
				attribution: photo.attribution,
				license: photo.license_code
			})),
			total: photos.length
		});
	} catch (error) {
		console.error('[api/inaturalist/photos] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
