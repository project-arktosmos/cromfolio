/**
 * Tag types for key-value tagging of cards
 */

import type { ID } from '$types/core.type';

export interface Tag {
	id: ID;
	key: string;
	value: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface CardTag {
	cardId: ID;
	tagId: ID;
	createdAt?: string;
}

export interface StickerTag {
	stickerId: ID;
	tagId: ID;
	createdAt?: string;
}
