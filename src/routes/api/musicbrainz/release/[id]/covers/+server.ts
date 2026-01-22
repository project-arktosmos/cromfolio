import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getReleaseCoverArt } from '$services/musicbrainz.service';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return json({ error: 'Release ID is required' }, { status: 400 });
	}

	try {
		const result = await getReleaseCoverArt(id);

		if ('error' in result) {
			// Return empty images array instead of error for 404s
			if (result.error.includes('No cover art')) {
				return json({ images: [] });
			}
			return json({ error: result.error }, { status: 500 });
		}

		// Transform images to our format
		const images = result.images.map((img) => ({
			url: img.image,
			thumbUrl: img.thumbnails['500'] || img.thumbnails.large || img.image,
			type: img.front ? 'front' : img.back ? 'back' : img.types?.[0]?.toLowerCase() || 'other'
		}));

		return json({ images });
	} catch (error) {
		console.error('[api/musicbrainz/release/covers] Error:', error);
		return json({ error: 'Failed to fetch cover art' }, { status: 500 });
	}
};
