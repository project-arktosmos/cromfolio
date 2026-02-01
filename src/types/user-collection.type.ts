import type { ID } from '$types/core.type';

/**
 * User collection progress - tracks user progress on collections
 * Stored in the _user_collections SQLite table
 */
export interface UserCollection {
	id: ID;
	collectionId: ID;
	startedAt: string;
	completedAt: string | null;
}
