import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMusicImagesFlat, isFanartConfigured } from '$services/fanart.service';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!isFanartConfigured()) {
		return json(
			{
				error: 'Fanart.tv API key not configured. Set FANART_API_KEY in your .env file.'
			},
			{ status: 503 }
		);
	}

	if (!id) {
		return json({ error: 'MusicBrainz artist ID is required' }, { status: 400 });
	}

	try {
		const images = await getMusicImagesFlat(id);

		return json({
			images: images.map((img) => ({
				url: img.url,
				thumbUrl: img.thumbUrl,
				type: img.type
			}))
		});
	} catch (error) {
		console.error('[api/fanart/music/artist] Error:', error);
		return json({ error: 'Failed to fetch images from Fanart.tv' }, { status: 500 });
	}
};
