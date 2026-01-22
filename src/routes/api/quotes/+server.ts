import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchAllQuotes } from '$services/quotes.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query');
	const limitParam = url.searchParams.get('limit');
	const limit = limitParam ? parseInt(limitParam, 10) : 10;

	if (!query) {
		return json({ error: 'query parameter is required' }, { status: 400 });
	}

	try {
		const { results, totalQuotes } = await searchAllQuotes(query, limit);

		// Log the first quote to see what fields we're getting
		if (results[0]?.quotes[0]) {
			console.log('[api/quotes] Sample quote:', JSON.stringify(results[0].quotes[0], null, 2));
		}

		return json({
			query,
			totalQuotes,
			results
		});
	} catch (error) {
		console.error('[api/quotes] Error:', error);
		return json({ error: 'Failed to search quotes' }, { status: 500 });
	}
};
