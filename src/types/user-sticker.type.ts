import type { ID } from '$types/core.type';

/**
 * User-owned sticker - tracks which stickers the user owns
 * Stored in the _user_stickers SQLite table
 */
export interface UserSticker {
	id: ID;
	stickerId: ID;
	sourceId: ID;
	collectionId?: ID; // Which collection the sticker was earned from
	rarityId?: ID;
	acquiredAt: string;
}
