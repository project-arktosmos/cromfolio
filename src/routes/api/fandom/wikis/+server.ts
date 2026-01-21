import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWikis } from '$services/fandom.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query');
	const limit = parseInt(url.searchParams.get('limit') || '10', 10);

	if (!query) {
		return json({ error: 'Query parameter is required' }, { status: 400 });
	}

	try {
		const wikis = await searchWikis(query, limit);
		return json({
			wikis,
			total: wikis.length,
			fromCache: false
		});
	} catch (error) {
		console.error('[api/fandom/wikis] Error:', error);
		return json({ error: 'Failed to search wikis' }, { status: 500 });
	}
};
