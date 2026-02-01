/**
 * Sticker Types Service
 * Manages sticker types via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
import type { ID } from '$types/core.type';

/**
 * Get all sticker types from the database
 */
export async function getStickerTypeCollection(): Promise<StickerTypeEntity[]> {
	try {
		return await invoke<StickerTypeEntity[]>('get_all_sticker_types');
	} catch (e) {
		console.error('[sticker-types.service] getStickerTypeCollection:', e);
		return [];
	}
}

/**
 * Get a single sticker type by ID
 */
export async function getStickerType(id: ID): Promise<StickerTypeEntity | null> {
	try {
		return await invoke<StickerTypeEntity | null>('get_sticker_type', { id: String(id) });
	} catch (e) {
		console.error(`[sticker-types.service] getStickerType(${id}):`, e);
		return null;
	}
}

/**
 * Get sticker types by category
 */
export async function getStickerTypesByCategory(category: string): Promise<StickerTypeEntity[]> {
	try {
		return await invoke<StickerTypeEntity[]>('get_sticker_types_by_category', { category });
	} catch (e) {
		console.error(`[sticker-types.service] getStickerTypesByCategory(${category}):`, e);
		return [];
	}
}

/**
 * Get sticker types by source type
 */
export async function getStickerTypesBySourceType(sourceType: string): Promise<StickerTypeEntity[]> {
	try {
		return await invoke<StickerTypeEntity[]>('get_sticker_types_by_source_type', { sourceType });
	} catch (e) {
		console.error(`[sticker-types.service] getStickerTypesBySourceType(${sourceType}):`, e);
		return [];
	}
}

/**
 * Add a sticker type to the collection
 */
export async function addStickerType(stickerType: StickerTypeEntity): Promise<StickerTypeEntity | null> {
	try {
		return await invoke<StickerTypeEntity>('create_sticker_type', { stickerType });
	} catch (e) {
		console.error('[sticker-types.service] addStickerType:', e);
		return null;
	}
}

/**
 * Update a sticker type in the collection
 */
export async function updateStickerType(stickerType: StickerTypeEntity): Promise<StickerTypeEntity | null> {
	try {
		return await invoke<StickerTypeEntity>('update_sticker_type', { stickerType });
	} catch (e) {
		console.error('[sticker-types.service] updateStickerType:', e);
		return null;
	}
}

/**
 * Remove a sticker type from the collection
 */
export async function removeStickerType(stickerType: StickerTypeEntity): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_sticker_type', { id: String(stickerType.id) });
	} catch (e) {
		console.error('[sticker-types.service] removeStickerType:', e);
		return false;
	}
}
