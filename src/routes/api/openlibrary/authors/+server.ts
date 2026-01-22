import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchAuthors, transformAuthor } from '$services/openlibrary.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query) {
		return json({ error: 'Search query (q) parameter is required' }, { status: 400 });
	}

	try {
		const result = await searchAuthors(query);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		const authors = result.docs.map(transformAuthor);

		return json({ authors });
	} catch (error) {
		console.error('[api/openlibrary/authors] Error:', error);
		return json({ error: 'Failed to search authors' }, { status: 500 });
	}
};
