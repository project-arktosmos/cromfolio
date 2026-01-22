import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCreditsByTmdbId, isTmdbConfigured } from '$services/tmdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const tmdbId = url.searchParams.get('tmdbId');
	const mediaType = url.searchParams.get('type') as 'movie' | 'tv' | null;

	if (!isTmdbConfigured()) {
		return json(
			{
				error: 'TMDB API key not configured. Set TMDB_API_KEY in your .env file.'
			},
			{ status: 503 }
		);
	}

	if (!tmdbId) {
		return json({ error: 'tmdbId parameter is required' }, { status: 400 });
	}

	if (!mediaType || !['movie', 'tv'].includes(mediaType)) {
		return json({ error: 'type parameter must be "movie" or "tv"' }, { status: 400 });
	}

	try {
		const cast = await getCreditsByTmdbId(Number(tmdbId), mediaType);

		return json({
			tmdbId: Number(tmdbId),
			mediaType,
			cast
		});
	} catch (error) {
		console.error('[api/tmdb/credits] Error:', error);
		return json({ error: 'Failed to fetch credits from TMDB' }, { status: 500 });
	}
};
