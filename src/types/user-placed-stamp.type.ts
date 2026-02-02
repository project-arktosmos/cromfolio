import type { ID } from '$types/core.type';

/**
 * User-placed stamp - tracks stamps placed on album pages
 * Stored in the _user_placed_stamps SQLite table
 */
export interface UserPlacedStamp {
	id: ID;
	stampId: ID;
	collectionId: ID;
	pageIndex: number;
	positionX: number; // Percentage 0-100
	positionY: number; // Percentage 0-100
	scale: number; // 0.5 - 2.0
	rotation: number; // -180 to 180 degrees
	placedAt: string;
}
