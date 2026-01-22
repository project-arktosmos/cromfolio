import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getIgdbGameWithImages, isIgdbConfigured, getIgdbImageUrl } from '$services/igdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const gameId = url.searchParams.get('id');

	if (!isIgdbConfigured()) {
		return json(
			{
				error: 'IGDB not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in your .env file.'
			},
			{ status: 503 }
		);
	}

	if (!gameId) {
		return json({ error: 'Game ID (id) parameter is required' }, { status: 400 });
	}

	try {
		const result = await getIgdbGameWithImages(parseInt(gameId, 10));

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		// Transform to include full URLs
		const images = {
			cover: result.cover
				? {
						url: getIgdbImageUrl(result.cover.image_id, '1080p'),
						thumb_url: getIgdbImageUrl(result.cover.image_id, 'cover_big'),
						width: result.cover.width,
						height: result.cover.height
					}
				: null,
			screenshots: (result.screenshots || []).map((s) => ({
				url: getIgdbImageUrl(s.image_id, '1080p'),
				thumb_url: getIgdbImageUrl(s.image_id, 'screenshot_big'),
				width: s.width,
				height: s.height
			})),
			artworks: (result.artworks || []).map((a) => ({
				url: getIgdbImageUrl(a.image_id, '1080p'),
				thumb_url: getIgdbImageUrl(a.image_id, 'screenshot_big'),
				width: a.width,
				height: a.height
			}))
		};

		return json(images);
	} catch (error) {
		console.error('[api/igdb/images] Error:', error);
		return json({ error: 'Failed to fetch IGDB images' }, { status: 500 });
	}
};
