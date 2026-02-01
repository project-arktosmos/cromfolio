/**
 * Torrent Manifest Service
 * Generates JSON manifests for collection export
 */

import type { Collection } from '$types/collection.type';
import type { Sticker } from '$types/sticker.type';
import type { TorrentManifest } from '$types/torrent-manifest.type';

const MANIFEST_VERSION = '1.0.0';

/**
 * Generate a torrent manifest from a collection and its stickers
 */
export function generateManifest(collection: Collection, stickers: Sticker[]): TorrentManifest {
	const imageSources = [
		...new Set(stickers.map((s) => s.imageSource).filter((src): src is string => !!src))
	];

	const hasAllImages = stickers.every((s) => !!s.image);

	return {
		version: MANIFEST_VERSION,
		generatedAt: new Date().toISOString(),
		collection: {
			id: collection.id,
			title: collection.title,
			description: collection.description,
			coverImage: collection.coverImage
		},
		stickers,
		metadata: {
			totalCount: stickers.length,
			hasImages: hasAllImages,
			sources: imageSources
		}
	};
}

/**
 * Convert manifest to formatted JSON string
 */
export function manifestToJson(manifest: TorrentManifest): string {
	return JSON.stringify(manifest, null, 2);
}

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFilename(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}
