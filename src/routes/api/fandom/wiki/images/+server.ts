import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	searchImages,
	getImages,
	type ImageSortOption,
	type SortDirection
} from '$services/fandom.service';

export const GET: RequestHandler = async ({ url }) => {
	const wiki = url.searchParams.get('wiki');
	const query = url.searchParams.get('query');
	const limit = parseInt(url.searchParams.get('limit') || '24', 10);
	const thumbWidth = parseInt(url.searchParams.get('thumbWidth') || '200', 10);
	const from = url.searchParams.get('from') || undefined;
	const continueToken = url.searchParams.get('continue') || undefined;
	const sort = (url.searchParams.get('sort') as ImageSortOption) || 'name';
	const direction = (url.searchParams.get('direction') as SortDirection) || 'ascending';
	const prefix = url.searchParams.get('prefix') || undefined;
	const minSize = url.searchParams.get('minSize')
		? parseInt(url.searchParams.get('minSize')!, 10)
		: undefined;
	const maxSize = url.searchParams.get('maxSize')
		? parseInt(url.searchParams.get('maxSize')!, 10)
		: undefined;

	if (!wiki) {
		return json({ error: 'Wiki parameter is required' }, { status: 400 });
	}

	try {
		if (query) {
			// Search for images by query
			const images = await searchImages(wiki, query, limit, thumbWidth);
			return json({
				images,
				total: images.length,
				fromCache: false
			});
		} else {
			// Browse all images with sorting/filtering
			const result = await getImages(wiki, {
				limit,
				thumbWidth,
				from,
				continueToken,
				sort,
				direction,
				prefix,
				minSize,
				maxSize
			});
			return json({
				images: result.images,
				total: result.images.length,
				continueFrom: result.continueFrom,
				continueToken: result.continueToken,
				fromCache: false
			});
		}
	} catch (error) {
		console.error('[api/fandom/wiki/images] Error:', error);
		return json({ error: 'Failed to fetch images' }, { status: 500 });
	}
};
