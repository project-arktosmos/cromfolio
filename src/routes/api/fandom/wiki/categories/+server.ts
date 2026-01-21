import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCategories } from '$services/fandom.service';

export const GET: RequestHandler = async ({ url }) => {
	const wiki = url.searchParams.get('wiki');
	const limit = parseInt(url.searchParams.get('limit') || '50', 10);

	if (!wiki) {
		return json({ error: 'Wiki parameter is required' }, { status: 400 });
	}

	try {
		const categories = await getCategories(wiki, limit);
		return json({
			categories,
			fromCache: false
		});
	} catch (error) {
		console.error('[api/fandom/wiki/categories] Error:', error);
		return json({ error: 'Failed to get categories' }, { status: 500 });
	}
};
