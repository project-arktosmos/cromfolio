import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getArtistReleaseGroups,
	getReleaseGroupCoverArt,
	transformReleaseGroup
} from '$services/musicbrainz.service';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const limit = parseInt(url.searchParams.get('limit') || '100', 10);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	const withCovers = url.searchParams.get('covers') === 'true';

	if (!id) {
		return json({ error: 'Artist ID is required' }, { status: 400 });
	}

	try {
		const result = await getArtistReleaseGroups(id, limit, offset);

		if ('error' in result) {
			return json({ error: result.error }, { status: 500 });
		}

		// Transform release groups
		let releases = result['release-groups'].map(transformReleaseGroup);

		// Optionally fetch cover art for first N releases (to avoid rate limiting)
		if (withCovers) {
			const maxCoversToFetch = 10;
			releases = await Promise.all(
				releases.map(async (release, index) => {
					if (index < maxCoversToFetch) {
						try {
							const coverArt = await getReleaseGroupCoverArt(release.id);
							if (!('error' in coverArt) && coverArt.images?.length > 0) {
								const frontImage =
									coverArt.images.find((img) => img.front) || coverArt.images[0];
								return {
									...release,
									imageUrl:
										frontImage.thumbnails['500'] ||
										frontImage.thumbnails.large ||
										frontImage.image,
									thumbUrl:
										frontImage.thumbnails['250'] ||
										frontImage.thumbnails.small ||
										frontImage.thumbnails['500']
								};
							}
						} catch {
							// Ignore cover art errors
						}
					}
					return release;
				})
			);
		}

		return json({
			releases,
			total: result['release-group-count'],
			offset: result['release-group-offset']
		});
	} catch (error) {
		console.error('[api/musicbrainz/artist/releases] Error:', error);
		return json({ error: 'Failed to fetch artist releases' }, { status: 500 });
	}
};
