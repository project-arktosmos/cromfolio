import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type { UserPlacedStamp } from '$types/user-placed-stamp.type';

/**
 * Get all placed stamps for a collection
 */
export async function getPlacedStampsByCollection(collectionId: ID): Promise<UserPlacedStamp[]> {
	return await invoke<UserPlacedStamp[]>('get_placed_stamps_by_collection', {
		collectionId
	});
}

/**
 * Get placed stamps for a specific page in a collection
 */
export async function getPlacedStampsByPage(
	collectionId: ID,
	pageIndex: number
): Promise<UserPlacedStamp[]> {
	return await invoke<UserPlacedStamp[]>('get_placed_stamps_by_page', {
		collectionId,
		pageIndex
	});
}

/**
 * Get a single placed stamp by ID
 */
export async function getPlacedStamp(id: ID): Promise<UserPlacedStamp | null> {
	return await invoke<UserPlacedStamp | null>('get_placed_stamp', { id });
}

/**
 * Place a stamp on an album page
 */
export async function placeStamp(
	stampId: ID,
	collectionId: ID,
	pageIndex: number,
	positionX: number,
	positionY: number,
	scale: number = 1.0,
	rotation: number = 0
): Promise<UserPlacedStamp> {
	const placedStamp: Partial<UserPlacedStamp> = {
		id: 0,
		stampId,
		collectionId,
		pageIndex,
		positionX,
		positionY,
		scale,
		rotation,
		placedAt: ''
	};
	return await invoke<UserPlacedStamp>('place_stamp', { placedStamp });
}

/**
 * Update a placed stamp's position, scale, or rotation
 */
export async function updatePlacedStamp(placedStamp: UserPlacedStamp): Promise<UserPlacedStamp> {
	return await invoke<UserPlacedStamp>('update_placed_stamp', { placedStamp });
}

/**
 * Remove a placed stamp
 */
export async function removePlacedStamp(id: ID): Promise<boolean> {
	return await invoke<boolean>('remove_placed_stamp', { id });
}

/**
 * Clear all stamps from a collection
 */
export async function clearCollectionStamps(collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('clear_collection_stamps', { collectionId });
}

/**
 * Clear all placed stamps
 */
export async function clearAllPlacedStamps(): Promise<number> {
	return await invoke<number>('clear_all_placed_stamps');
}
