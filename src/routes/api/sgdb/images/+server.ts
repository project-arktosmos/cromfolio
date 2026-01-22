import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllSgdbImagesByName, isSgdbConfigured } from '$services/sgdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const name = url.searchParams.get('name');

	if (!isSgdbConfigured()) {
		return json(
			{
				error: 'SteamGridDB API key not configured. Set STEAMGRIDDB_API_KEY in your .env file.'
			},
			{ status: 503 }
		);
	}

	if (!name) {
		return json({ error: 'Game name (name) parameter is required' }, { status: 400 });
	}

	try {
		const result = await getAllSgdbImagesByName(name);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		return json(result);
	} catch (error) {
		console.error('[api/sgdb/images] Error:', error);
		return json({ error: 'Failed to fetch SteamGridDB images' }, { status: 500 });
	}
};
