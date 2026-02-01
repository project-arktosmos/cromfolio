/**
 * Torrent manifest types for collection export
 */

import type { ID } from '$types/core.type';
import type { Sticker } from '$types/sticker.type';

export interface TorrentManifestCollection {
	id: ID;
	title: string;
	description: string;
	coverImage?: string;
}

export interface TorrentManifestMetadata {
	totalCount: number;
	hasImages: boolean;
	sources: string[];
}

export interface TorrentManifest {
	version: string;
	generatedAt: string;
	collection: TorrentManifestCollection;
	stickers: Sticker[];
	metadata: TorrentManifestMetadata;
}
