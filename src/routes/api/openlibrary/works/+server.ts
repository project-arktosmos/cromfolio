import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWorks, transformWorkSearch } from '$services/openlibrary.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query) {
		return json({ error: 'Search query (q) parameter is required' }, { status: 400 });
	}

	try {
		const result = await searchWorks(query);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		const works = result.docs.map(transformWorkSearch);

		return json({ works });
	} catch (error) {
		console.error('[api/openlibrary/works] Error:', error);
		return json({ error: 'Failed to search works' }, { status: 500 });
	}
};
