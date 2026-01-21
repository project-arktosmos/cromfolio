import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMovieImagesFlat, getTVImagesFlat, isFanartConfigured } from '$services/fanart.service';

export const GET: RequestHandler = async ({ url }) => {
	const tmdbId = url.searchParams.get('tmdbId');
	const tvdbId = url.searchParams.get('tvdbId');
	const mediaType = url.searchParams.get('type') || 'movie';

	if (!isFanartConfigured()) {
		return json(
			{
				error: 'Fanart.tv API key not configured. Set FANART_API_KEY in your .env file.'
			},
			{ status: 503 }
		);
	}

	try {
		let images;

		if (mediaType === 'tv' && tvdbId) {
			images = await getTVImagesFlat(parseInt(tvdbId, 10));
		} else if (tmdbId) {
			images = await getMovieImagesFlat(parseInt(tmdbId, 10));
		} else {
			return json({ error: 'tmdbId or tvdbId parameter is required' }, { status: 400 });
		}

		return json({ images });
	} catch (error) {
		console.error('[api/fanart/images] Error:', error);
		return json({ error: 'Failed to fetch images from Fanart.tv' }, { status: 500 });
	}
};
