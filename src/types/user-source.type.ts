import type { ID } from '$types/core.type';

/**
 * User-owned source - tracks which sources the user owns
 * Stored in the _user_sources SQLite table
 */
export interface UserSource {
	id: ID;
	sourceId: ID;
	acquiredAt: string;
}
