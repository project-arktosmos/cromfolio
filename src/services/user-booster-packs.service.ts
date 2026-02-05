/**
 * User Booster Packs Service
 * Tracks booster packs earned from games, persisted to SQLite via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type { UserBoosterPack, BoosterPackSummary } from '$types/user-booster-pack.type';

/**
 * Get all user booster packs (both opened and unopened)
 */
export async function getAllUserBoosterPacks(): Promise<UserBoosterPack[]> {
	return await invoke<UserBoosterPack[]>('get_all_user_booster_packs');
}

/**
 * Get all unopened booster packs
 */
export async function getUnopenedUserBoosterPacks(): Promise<UserBoosterPack[]> {
	return await invoke<UserBoosterPack[]>('get_unopened_user_booster_packs');
}

/**
 * Get all unopened booster packs for a specific collection
 */
export async function getUnopenedUserBoosterPacksByCollection(
	collectionId: ID
): Promise<UserBoosterPack[]> {
	return await invoke<UserBoosterPack[]>('get_unopened_user_booster_packs_by_collection', {
		collectionId
	});
}

/**
 * Get all booster packs for a specific collection (both opened and unopened)
 */
export async function getUserBoosterPacksByCollection(
	collectionId: ID
): Promise<UserBoosterPack[]> {
	return await invoke<UserBoosterPack[]>('get_user_booster_packs_by_collection', {
		collectionId
	});
}

/**
 * Get a specific booster pack by ID
 */
export async function getUserBoosterPack(id: ID): Promise<UserBoosterPack | null> {
	return await invoke<UserBoosterPack | null>('get_user_booster_pack', { id });
}

/**
 * Count total unopened booster packs
 */
export async function countUnopenedUserBoosterPacks(): Promise<number> {
	return await invoke<number>('count_unopened_user_booster_packs');
}

/**
 * Count unopened booster packs for a specific collection
 */
export async function countUnopenedUserBoosterPacksByCollection(collectionId: ID): Promise<number> {
	return await invoke<number>('count_unopened_user_booster_packs_by_collection', {
		collectionId
	});
}

/**
 * Award a single booster pack to the user
 */
export async function awardUserBoosterPack(
	collectionId: ID,
	earnedFrom: string
): Promise<UserBoosterPack> {
	const boosterPack: Partial<UserBoosterPack> = {
		id: 0,
		collectionId,
		earnedFrom,
		earnedAt: ''
	};

	return await invoke<UserBoosterPack>('award_user_booster_pack', { boosterPack });
}

/**
 * Award multiple booster packs to the user at once
 */
export async function awardUserBoosterPacksBatch(
	count: number,
	collectionId: ID,
	earnedFrom: string
): Promise<UserBoosterPack[]> {
	return await invoke<UserBoosterPack[]>('award_user_booster_packs_batch', {
		count,
		collectionId,
		earnedFrom
	});
}

/**
 * Mark a booster pack as opened
 */
export async function openUserBoosterPack(id: ID): Promise<UserBoosterPack> {
	return await invoke<UserBoosterPack>('open_user_booster_pack', { id });
}

/**
 * Mark multiple booster packs as opened for a collection
 * Returns the IDs of the packs that were opened
 */
export async function openUserBoosterPacksBatch(
	collectionId: ID,
	count: number
): Promise<number[]> {
	return await invoke<number[]>('open_user_booster_packs_batch', {
		collectionId,
		count
	});
}

/**
 * Delete a booster pack by ID
 */
export async function deleteUserBoosterPack(id: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_booster_pack', { id });
}

/**
 * Delete all booster packs for a collection
 */
export async function deleteUserBoosterPacksByCollection(collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_booster_packs_by_collection', {
		collectionId
	});
}

/**
 * Delete all user booster packs
 */
export async function deleteAllUserBoosterPacks(): Promise<number> {
	return await invoke<number>('delete_all_user_booster_packs');
}

/**
 * Get summary of unopened packs grouped by collection
 */
export async function getUnopenedUserBoosterPacksSummary(): Promise<BoosterPackSummary[]> {
	return await invoke<BoosterPackSummary[]>('get_unopened_user_booster_packs_summary');
}
