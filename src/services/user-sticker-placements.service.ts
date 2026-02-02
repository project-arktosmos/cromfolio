import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type { UserStickerPlacement } from '$types/user-sticker-placement.type';

/**
 * Get all sticker placements for a collection
 */
export async function getPlacementsByCollection(collectionId: ID): Promise<UserStickerPlacement[]> {
	return await invoke<UserStickerPlacement[]>('get_sticker_placements_by_collection', {
		collectionId: String(collectionId)
	});
}

/**
 * Get all placed sticker IDs (globally - across all collections)
 */
export async function getAllPlacedStickerIds(): Promise<string[]> {
	return await invoke<string[]>('get_all_placed_sticker_ids');
}

/**
 * Get placed sticker IDs for a specific collection
 */
export async function getPlacedStickerIdsForCollection(collectionId: ID): Promise<string[]> {
	return await invoke<string[]>('get_placed_sticker_ids_for_collection', {
		collectionId: String(collectionId)
	});
}

/**
 * Check if a sticker is placed anywhere
 */
export async function isStickerPlaced(stickerId: ID): Promise<boolean> {
	return await invoke<boolean>('is_sticker_placed', { stickerId: String(stickerId) });
}

/**
 * Place a sticker in a collection (stick it in the album)
 */
export async function placeSticker(stickerId: ID, collectionId: ID): Promise<UserStickerPlacement> {
	const placement: Partial<UserStickerPlacement> = {
		id: '',
		stickerId: String(stickerId),
		collectionId: String(collectionId),
		placedAt: ''
	};
	return await invoke<UserStickerPlacement>('place_sticker', { placement });
}

/**
 * Unstick a sticker from a collection
 */
export async function unstickSticker(stickerId: ID, collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('unstick_sticker', {
		stickerId: String(stickerId),
		collectionId: String(collectionId)
	});
}

/**
 * Clear all sticker placements from a collection
 */
export async function clearCollectionPlacements(collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('clear_collection_sticker_placements', {
		collectionId: String(collectionId)
	});
}

/**
 * Clear all sticker placements globally
 */
export async function clearAllPlacements(): Promise<number> {
	return await invoke<number>('clear_all_sticker_placements');
}

/**
 * Get the number of times a sticker is placed globally (across all collections)
 */
export async function getStickerPlacementCount(stickerId: ID): Promise<number> {
	return await invoke<number>('get_sticker_placement_count', {
		stickerId: String(stickerId)
	});
}

/**
 * Get placement counts for all stickers
 * Returns an array of [stickerId, count] tuples
 */
export async function getAllStickerPlacementCounts(): Promise<Map<string, number>> {
	const counts = await invoke<[string, number][]>('get_all_sticker_placement_counts');
	return new Map(counts);
}
