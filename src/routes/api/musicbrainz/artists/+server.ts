import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchArtists, transformArtist } from '$services/musicbrainz.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query) {
		return json({ error: 'Search query (q) parameter is required' }, { status: 400 });
	}

	try {
		const result = await searchArtists(query);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		const artists = result.artists.map(transformArtist);

		return json({ artists });
	} catch (error) {
		console.error('[api/musicbrainz/artists] Error:', error);
		return json({ error: 'Failed to search artists' }, { status: 500 });
	}
};
