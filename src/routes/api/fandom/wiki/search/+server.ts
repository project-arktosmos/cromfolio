import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchArticles } from '$services/fandom.service';

export const GET: RequestHandler = async ({ url }) => {
	const wiki = url.searchParams.get('wiki');
	const query = url.searchParams.get('query');
	const limit = parseInt(url.searchParams.get('limit') || '20', 10);

	if (!wiki) {
		return json({ error: 'Wiki parameter is required' }, { status: 400 });
	}

	if (!query) {
		return json({ error: 'Query parameter is required' }, { status: 400 });
	}

	try {
		const articles = await searchArticles(wiki, query, limit);
		return json({
			articles,
			total: articles.length,
			fromCache: false
		});
	} catch (error) {
		console.error('[api/fandom/wiki/search] Error:', error);
		return json({ error: 'Failed to search articles' }, { status: 500 });
	}
};
