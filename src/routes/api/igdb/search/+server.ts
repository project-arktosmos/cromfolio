import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchIgdb, isIgdbConfigured, getIgdbImageUrl } from '$services/igdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query');

	if (!isIgdbConfigured()) {
		return json(
			{
				error:
					'IGDB not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in your .env file.'
			},
			{ status: 503 }
		);
	}

	if (!query) {
		return json({ error: 'Search query (query) parameter is required' }, { status: 400 });
	}

	try {
		const result = await searchIgdb(query);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		// Transform results to include full image URLs
		const games = result.map((game) => ({
			...game,
			cover: game.cover
				? {
						...game.cover,
						url: getIgdbImageUrl(game.cover.image_id, 'cover_big'),
						thumb_url: getIgdbImageUrl(game.cover.image_id, 'thumb')
					}
				: null
		}));

		return json({ results: games });
	} catch (error) {
		console.error('[api/igdb/search] Error:', error);
		return json({ error: 'Failed to search IGDB' }, { status: 500 });
	}
};
