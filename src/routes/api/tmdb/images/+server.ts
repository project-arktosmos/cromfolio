import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getImagesByImdbId, isTmdbConfigured } from '$services/tmdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const imdbId = url.searchParams.get('imdbId');

	if (!isTmdbConfigured()) {
		return json(
			{
				error: 'TMDB API key not configured. Set TMDB_API_KEY in your .env file.'
			},
			{ status: 503 }
		);
	}

	if (!imdbId) {
		return json({ error: 'imdbId parameter is required' }, { status: 400 });
	}

	try {
		const result = await getImagesByImdbId(imdbId);

		if (!result) {
			return json({ error: 'Failed to fetch images from TMDB' }, { status: 500 });
		}

		return json(result);
	} catch (error) {
		console.error('[api/tmdb/images] Error:', error);
		return json({ error: 'Failed to fetch images from TMDB' }, { status: 500 });
	}
};
