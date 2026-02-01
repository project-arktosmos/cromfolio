import type { ID } from '$types/core.type';

/**
 * User-owned sticker - tracks which stickers the user owns
 * Stored in the _user_stickers SQLite table
 */
export interface UserSticker {
	id: ID;
	stickerId: ID;
	sourceId: ID;
	acquiredAt: string;
}
