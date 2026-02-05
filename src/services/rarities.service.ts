/**
 * Rarities Service
 * Manages card rarity levels via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { Rarity } from '$types/rarity.type';
import type { ID } from '$types/core.type';

/**
 * Get all rarities from the database
 */
export async function getRarityCollection(): Promise<Rarity[]> {
	try {
		return await invoke<Rarity[]>('get_all_rarities');
	} catch (e) {
		console.error('[rarities.service] getRarityCollection:', e);
		return [];
	}
}

/**
 * Get a single rarity by ID
 */
export async function getRarity(id: ID): Promise<Rarity | null> {
	try {
		return await invoke<Rarity | null>('get_rarity', { id });
	} catch (e) {
		console.error(`[rarities.service] getRarity(${id}):`, e);
		return null;
	}
}

/**
 * Add a rarity to the collection
 */
export async function addRarity(rarity: Rarity): Promise<Rarity | null> {
	try {
		return await invoke<Rarity>('create_rarity', { rarity });
	} catch (e) {
		console.error('[rarities.service] addRarity:', e);
		return null;
	}
}

/**
 * Update a rarity in the collection
 */
export async function updateRarity(rarity: Rarity): Promise<Rarity | null> {
	try {
		return await invoke<Rarity>('update_rarity', { rarity });
	} catch (e) {
		console.error('[rarities.service] updateRarity:', e);
		return null;
	}
}

/**
 * Remove a rarity from the collection
 */
export async function removeRarity(rarity: Rarity): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_rarity', { id: rarity.id });
	} catch (e) {
		console.error('[rarities.service] removeRarity:', e);
		return false;
	}
}
