import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchOmdb, isOmdbConfigured } from '$services/omdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('s');
	const type = url.searchParams.get('type') as 'movie' | 'series' | 'episode' | null;
	const year = url.searchParams.get('y');
	const page = url.searchParams.get('page');

	if (!isOmdbConfigured()) {
		return json(
			{
				error: 'OMDB API key not configured. Set OMDB_API_KEY in your .env file.',
				Response: 'False'
			},
			{ status: 503 }
		);
	}

	if (!query) {
		return json(
			{ error: 'Search query (s) parameter is required', Response: 'False' },
			{ status: 400 }
		);
	}

	try {
		const result = await searchOmdb(query, {
			type: type || undefined,
			year: year || undefined,
			page: page ? parseInt(page, 10) : undefined
		});

		return json(result);
	} catch (error) {
		console.error('[api/omdb/search] Error:', error);
		return json({ error: 'Failed to search OMDB', Response: 'False' }, { status: 500 });
	}
};
