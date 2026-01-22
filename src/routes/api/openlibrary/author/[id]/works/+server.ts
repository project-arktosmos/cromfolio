import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAuthorWorks,
	getAuthorDetails,
	transformWork,
	getCoverUrl
} from '$services/openlibrary.service';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const limit = parseInt(url.searchParams.get('limit') || '50', 10);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);

	if (!id) {
		return json({ error: 'Author ID is required' }, { status: 400 });
	}

	try {
		// Fetch author details for name
		const authorDetails = await getAuthorDetails(id);
		const authorName = 'error' in authorDetails ? undefined : authorDetails.name;

		// Fetch author works
		const result = await getAuthorWorks(id, limit, offset);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		// Transform works and add cover images
		const works = result.entries.map((work) => {
			const transformed = transformWork(work, id, authorName);

			// Get cover images if available
			const images =
				work.covers
					?.filter((coverId) => coverId > 0)
					.map((coverId) => ({
						url: getCoverUrl(coverId, 'L'),
						thumbUrl: getCoverUrl(coverId, 'M'),
						type: 'cover',
						source: 'openlibrary' as const
					})) || [];

			return {
				...transformed,
				images
			};
		});

		return json({
			works,
			total: result.size,
			offset
		});
	} catch (error) {
		console.error('[api/openlibrary/author/works] Error:', error);
		return json({ error: 'Failed to fetch author works' }, { status: 500 });
	}
};
