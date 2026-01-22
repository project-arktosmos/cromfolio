import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWikiquote } from '$services/wikiquote.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query');
	const limitParam = url.searchParams.get('limit');
	const limit = limitParam ? parseInt(limitParam, 10) : 10;

	if (!query) {
		return json({ error: 'query parameter is required' }, { status: 400 });
	}

	try {
		const pages = await searchWikiquote(query, limit);

		return json({
			query,
			pages
		});
	} catch (error) {
		console.error('[api/quotes/search] Error:', error);
		return json({ error: 'Failed to search Wikiquote pages' }, { status: 500 });
	}
};
