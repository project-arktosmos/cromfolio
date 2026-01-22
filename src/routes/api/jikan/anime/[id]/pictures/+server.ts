import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { JikanAnimePicture } from '../../../../../admin/sources/sources.types';

const JIKAN_ENDPOINT = 'https://api.jikan.moe/v4';

interface JikanAnimePicturesResponse {
	data: JikanAnimePicture[];
}

async function fetchFromJikan(animeId: number): Promise<JikanAnimePicturesResponse> {
	const response = await fetch(`${JIKAN_ENDPOINT}/anime/${animeId}/pictures`);

	if (!response.ok) {
		throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		const animeId = parseInt(params.id, 10);

		if (isNaN(animeId)) {
			return json({ error: 'Invalid anime ID' }, { status: 400 });
		}

		const result = await fetchFromJikan(animeId);

		return json(result);
	} catch (err) {
		console.error('Jikan anime pictures error:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
};
