import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getImagesByImdbId } from '$services/tvmaze.service';

export const GET: RequestHandler = async ({ url }) => {
	const imdbId = url.searchParams.get('imdbId');

	if (!imdbId) {
		return json({ error: 'imdbId parameter is required' }, { status: 400 });
	}

	try {
		const result = await getImagesByImdbId(imdbId);

		return json(result);
	} catch (error) {
		console.error('[api/tvmaze/images] Error:', error);
		return json({ error: 'Failed to fetch images from TVMaze' }, { status: 500 });
	}
};
