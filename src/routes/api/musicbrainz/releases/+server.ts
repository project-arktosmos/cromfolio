import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchReleases, transformRelease, getReleaseCoverArt } from '$services/musicbrainz.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query) {
		return json({ error: 'Search query (q) parameter is required' }, { status: 400 });
	}

	try {
		const result = await searchReleases(query);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		// Transform releases and try to get cover art for first few
		const releases = await Promise.all(
			result.releases.map(async (release) => {
				const transformed = transformRelease(release);

				// Try to get cover art (only for first 5 to avoid rate limiting)
				if (result.releases.indexOf(release) < 5) {
					try {
						const coverArt = await getReleaseCoverArt(release.id);
						if (!('error' in coverArt) && coverArt.images?.length > 0) {
							const frontImage = coverArt.images.find((img) => img.front) || coverArt.images[0];
							transformed.imageUrl =
								frontImage.thumbnails['500'] || frontImage.thumbnails.large || frontImage.image;
						}
					} catch {
						// Ignore cover art errors
					}
				}

				return transformed;
			})
		);

		return json({ releases });
	} catch (error) {
		console.error('[api/musicbrainz/releases] Error:', error);
		return json({ error: 'Failed to search releases' }, { status: 500 });
	}
};
