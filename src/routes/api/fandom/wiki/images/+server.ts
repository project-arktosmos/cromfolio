import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchImages, getImages } from '$services/fandom.service';

export const GET: RequestHandler = async ({ url }) => {
	const wiki = url.searchParams.get('wiki');
	const query = url.searchParams.get('query');
	const limit = parseInt(url.searchParams.get('limit') || '20', 10);
	const thumbWidth = parseInt(url.searchParams.get('thumbWidth') || '200', 10);
	const from = url.searchParams.get('from') || undefined;

	if (!wiki) {
		return json({ error: 'Wiki parameter is required' }, { status: 400 });
	}

	try {
		if (query) {
			// Search for images by query
			const images = await searchImages(wiki, query, limit, thumbWidth);
			// Debug: log first image URLs
			if (images.length > 0) {
				console.log('[api/fandom/wiki/images] First image URLs:', {
					url: images[0].url,
					thumbUrl: images[0].thumbUrl
				});
			}
			return json({
				images,
				total: images.length,
				fromCache: false
			});
		} else {
			// Browse all images
			const result = await getImages(wiki, limit, thumbWidth, from);
			// Debug: log first image URLs
			if (result.images.length > 0) {
				console.log('[api/fandom/wiki/images] First image URLs:', {
					url: result.images[0].url,
					thumbUrl: result.images[0].thumbUrl
				});
			}
			return json({
				images: result.images,
				total: result.images.length,
				continueFrom: result.continueFrom,
				fromCache: false
			});
		}
	} catch (error) {
		console.error('[api/fandom/wiki/images] Error:', error);
		return json({ error: 'Failed to fetch images' }, { status: 500 });
	}
};
