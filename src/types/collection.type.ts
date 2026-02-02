/**
 * Collection types for grouping stickers
 */

import type { ID } from '$types/core.type';

export interface Collection {
	id: ID;
	collectionTypeId?: ID;
	title: string;
	description: string;
	region?: string;
	coverImage?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface CollectionSticker {
	collectionId: ID;
	stickerId: ID;
	sortOrder: number;
	addedAt?: string;
}
