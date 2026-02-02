/**
 * User Stickers Service
 * Tracks which stickers the user owns, persisted to SQLite via Tauri
 * Replaces the localStorage-based playerCardsService for /game routes
 */

import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type { UserSticker } from '$types/user-sticker.type';

/**
 * Get all user-owned stickers
 */
export async function getAllUserStickers(): Promise<UserSticker[]> {
	return await invoke<UserSticker[]>('get_all_user_stickers');
}

/**
 * Get all user-owned stickers for a specific source
 */
export async function getUserStickersBySource(sourceId: ID): Promise<UserSticker[]> {
	return await invoke<UserSticker[]>('get_user_stickers_by_source', {
		sourceId: String(sourceId)
	});
}

/**
 * Get a specific user sticker by ID
 */
export async function getUserSticker(id: ID): Promise<UserSticker | null> {
	return await invoke<UserSticker | null>('get_user_sticker', { id: String(id) });
}

/**
 * Check if the user owns a specific sticker
 */
export async function ownsSticker(stickerId: ID): Promise<boolean> {
	return await invoke<boolean>('user_owns_sticker', { stickerId: String(stickerId) });
}

/**
 * Get the number of copies of a specific sticker the user owns
 */
export async function getStickerCopyCount(stickerId: ID): Promise<number> {
	return await invoke<number>('get_user_sticker_copy_count', { stickerId: String(stickerId) });
}

/**
 * Get count of unique stickers owned for a specific source
 */
export async function getUniqueStickerCountBySource(sourceId: ID): Promise<number> {
	return await invoke<number>('get_user_unique_sticker_count_by_source', {
		sourceId: String(sourceId)
	});
}

/**
 * Get all unique sticker IDs owned by the user
 */
export async function getOwnedStickerIds(): Promise<string[]> {
	return await invoke<string[]>('get_user_owned_sticker_ids');
}

/**
 * Acquire a sticker (add to user's collection)
 * Duplicates are allowed - each acquisition creates a new record
 */
export async function acquireSticker(
	stickerId: ID,
	sourceId: ID,
	rarityId?: ID
): Promise<UserSticker> {
	const userSticker: Partial<UserSticker> = {
		id: '',
		stickerId: String(stickerId),
		sourceId: String(sourceId),
		rarityId: rarityId ? String(rarityId) : undefined,
		acquiredAt: ''
	};

	return await invoke<UserSticker>('acquire_user_sticker', { userSticker });
}

/**
 * Release a sticker (remove one copy from user's collection)
 */
export async function releaseSticker(stickerId: ID): Promise<boolean> {
	return await invoke<boolean>('release_user_sticker', { stickerId: String(stickerId) });
}

/**
 * Delete a specific user sticker by ID
 */
export async function deleteUserSticker(id: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_sticker', { id: String(id) });
}

/**
 * Delete all user stickers for a specific source
 */
export async function deleteUserStickersBySource(sourceId: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_stickers_by_source', { sourceId: String(sourceId) });
}

/**
 * Delete all user stickers (reset collection)
 */
export async function deleteAllUserStickers(): Promise<number> {
	return await invoke<number>('delete_all_user_stickers');
}

// ============================================================================
// STICKER MIXING (upgrade rarity by combining duplicates)
// ============================================================================

/**
 * Info about a sticker that can be mixed (has 2+ copies of same rarity)
 */
export interface MixableStickerInfo {
	stickerId: string;
	rarityId: string;
	count: number;
}

/**
 * Get all stickers that can be mixed (have 2+ copies of same sticker and rarity)
 */
export async function getMixableStickers(): Promise<MixableStickerInfo[]> {
	return await invoke<MixableStickerInfo[]>('get_mixable_user_stickers');
}

/**
 * Get copy count for a specific sticker and rarity combination
 */
export async function getStickerCopyCountByRarity(stickerId: ID, rarityId: ID): Promise<number> {
	return await invoke<number>('get_user_sticker_copy_count_by_rarity', {
		stickerId: String(stickerId),
		rarityId: String(rarityId)
	});
}

/**
 * Mix two stickers of the same type and rarity to create one of higher rarity
 * @param stickerId - The sticker template ID
 * @param currentRarityId - The current rarity of the stickers to mix
 * @param newRarityId - The target rarity for the new sticker
 * @param sourceId - The source/album ID for the new sticker
 * @returns The newly created sticker with upgraded rarity
 */
export async function mixStickers(
	stickerId: ID,
	currentRarityId: ID,
	newRarityId: ID,
	sourceId: ID
): Promise<UserSticker> {
	return await invoke<UserSticker>('mix_user_stickers', {
		stickerId: String(stickerId),
		currentRarityId: String(currentRarityId),
		newRarityId: String(newRarityId),
		sourceId: String(sourceId)
	});
}
