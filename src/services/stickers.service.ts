/**
 * Stickers Service
 * Manages a collection of stickers within sources via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import { tauriApiService } from '$services/tauri-api.service';
import type { Sticker } from '$types/sticker.type';
import type { ID } from '$types/core.type';

/**
 * Get all stickers from the database
 */
export async function getStickerCollection(): Promise<Sticker[]> {
	return await tauriApiService.getAll<Sticker>('stickers');
}

/**
 * Get all stickers for a specific source
 */
export async function getStickersBySource(sourceId: ID): Promise<Sticker[]> {
	try {
		return await invoke<Sticker[]>('get_stickers_by_source', { sourceId });
	} catch (e) {
		console.error(`[stickers.service] getStickersBySource(${sourceId}):`, e);
		return [];
	}
}

/**
 * Add a sticker to the collection
 */
export async function addSticker(sticker: Sticker): Promise<Sticker | null> {
	return await tauriApiService.create<Sticker>('stickers', sticker);
}

/**
 * Add multiple stickers in a single transaction (all or nothing)
 */
export async function addStickersBatch(stickers: Sticker[]): Promise<Sticker[]> {
	try {
		return await invoke<Sticker[]>('create_stickers_batch', { stickers });
	} catch (e) {
		console.error('[stickers.service] addStickersBatch:', e);
		throw e;
	}
}

/**
 * Remove a sticker from the collection
 */
export async function removeSticker(sticker: Sticker): Promise<boolean> {
	return await tauriApiService.delete('stickers', sticker.id);
}

/**
 * Update a sticker in the collection
 */
export async function updateSticker(sticker: Sticker): Promise<Sticker | null> {
	return await tauriApiService.update<Sticker>('stickers', sticker.id, sticker);
}

/**
 * Get a sticker by ID
 */
export async function getSticker(id: ID): Promise<Sticker | null> {
	return await tauriApiService.get<Sticker>('stickers', id);
}

/**
 * Check if a sticker exists in the collection
 * @deprecated Use getSticker instead
 */
export async function stickerExists(id: ID): Promise<Sticker | null> {
	return getSticker(id);
}

/**
 * Remove all stickers for a specific source
 */
export async function removeStickersBySource(sourceId: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_stickers_by_source', { sourceId });
	} catch (e) {
		console.error(`[stickers.service] removeStickersBySource(${sourceId}):`, e);
		return false;
	}
}
