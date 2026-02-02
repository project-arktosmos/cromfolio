import type { ID } from '$types/core.type';

/**
 * User sticker placement - tracks which stickers are "stuck" in albums
 * Stored in the _user_sticker_placements SQLite table
 */
export interface UserStickerPlacement {
	id: ID;
	stickerId: ID;
	collectionId: ID;
	placedAt: string;
}
