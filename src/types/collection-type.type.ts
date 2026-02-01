/**
 * Collection type entity for categorizing collections (e.g., anime, awards)
 */

import type { ID } from '$types/core.type';

export interface CollectionType {
	id: ID;
	name: string;
	description: string;
	icon?: string;
	sortOrder: number;
	createdAt?: string;
	updatedAt?: string;
}
