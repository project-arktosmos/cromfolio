/**
 * Collections Service
 * Manages collections and collection-sticker relationships via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { Collection, CollectionSticker } from '$types/collection.type';
import type { Sticker } from '$types/sticker.type';
import type { ID } from '$types/core.type';

// ============================================================================
// COLLECTION CRUD OPERATIONS
// ============================================================================

/**
 * Get all collections from the database
 */
export async function getAllCollections(): Promise<Collection[]> {
	try {
		return await invoke<Collection[]>('get_all_collections');
	} catch (e) {
		console.error('[collections.service] getAllCollections:', e);
		return [];
	}
}

/**
 * Get a single collection by ID
 */
export async function getCollection(id: ID): Promise<Collection | null> {
	try {
		return await invoke<Collection | null>('get_collection', { id });
	} catch (e) {
		console.error(`[collections.service] getCollection(${id}):`, e);
		return null;
	}
}

/**
 * Create a new collection
 */
export async function createCollection(
	collection: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Collection | null> {
	try {
		return await invoke<Collection>('create_collection', { collection });
	} catch (e) {
		console.error('[collections.service] createCollection:', e);
		return null;
	}
}

/**
 * Update an existing collection
 */
export async function updateCollection(collection: Collection): Promise<Collection | null> {
	try {
		return await invoke<Collection>('update_collection', { collection });
	} catch (e) {
		console.error('[collections.service] updateCollection:', e);
		return null;
	}
}

/**
 * Delete a collection by ID
 */
export async function deleteCollection(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_collection', { id });
	} catch (e) {
		console.error(`[collections.service] deleteCollection(${id}):`, e);
		return false;
	}
}

// ============================================================================
// COLLECTION-STICKER RELATIONSHIP OPERATIONS
// ============================================================================

/**
 * Add a sticker to a collection
 */
export async function addStickerToCollection(
	collectionId: ID,
	stickerId: ID,
	sortOrder: number = 0
): Promise<CollectionSticker | null> {
	try {
		return await invoke<CollectionSticker>('add_sticker_to_collection', {
			collectionId,
			stickerId,
			sortOrder
		});
	} catch (e) {
		console.error(
			`[collections.service] addStickerToCollection(${collectionId}, ${stickerId}):`,
			e
		);
		return null;
	}
}

/**
 * Remove a sticker from a collection
 */
export async function removeStickerFromCollection(
	collectionId: ID,
	stickerId: ID
): Promise<boolean> {
	try {
		return await invoke<boolean>('remove_sticker_from_collection', {
			collectionId,
			stickerId
		});
	} catch (e) {
		console.error(
			`[collections.service] removeStickerFromCollection(${collectionId}, ${stickerId}):`,
			e
		);
		return false;
	}
}

/**
 * Get all stickers in a collection
 */
export async function getStickersForCollection(collectionId: ID): Promise<Sticker[]> {
	try {
		return await invoke<Sticker[]>('get_stickers_for_collection', {
			collectionId
		});
	} catch (e) {
		console.error(`[collections.service] getStickersForCollection(${collectionId}):`, e);
		return [];
	}
}
