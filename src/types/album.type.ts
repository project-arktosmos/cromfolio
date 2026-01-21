/**
 * Album types for collectible card albums
 */

import type { ID } from '$types/core.type';

export interface Album {
	id: ID;
	title: string;
	description: string;
	coverImage?: string;
	wikiaUrl?: string;
	imdbId?: string;
	tmdbId?: number;
	addedAt?: string;
}

export interface AlbumCollection {
	albums: Album[];
}
