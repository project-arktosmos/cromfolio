/**
 * Collection Types Service
 * Manages collection types via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { CollectionType } from '$types/collection-type.type';
import type { ID } from '$types/core.type';

/**
 * Get all collection types from the database
 */
export async function getAllCollectionTypes(): Promise<CollectionType[]> {
	try {
		return await invoke<CollectionType[]>('get_all_collection_types');
	} catch (e) {
		console.error('[collection-types.service] getAllCollectionTypes:', e);
		return [];
	}
}

/**
 * Get a single collection type by ID
 */
export async function getCollectionType(id: ID): Promise<CollectionType | null> {
	try {
		return await invoke<CollectionType | null>('get_collection_type', { id: String(id) });
	} catch (e) {
		console.error(`[collection-types.service] getCollectionType(${id}):`, e);
		return null;
	}
}

/**
 * Create a new collection type
 */
export async function createCollectionType(
	collectionType: Omit<CollectionType, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CollectionType | null> {
	try {
		return await invoke<CollectionType>('create_collection_type', { collectionType });
	} catch (e) {
		console.error('[collection-types.service] createCollectionType:', e);
		return null;
	}
}

/**
 * Update an existing collection type
 */
export async function updateCollectionType(
	collectionType: CollectionType
): Promise<CollectionType | null> {
	try {
		return await invoke<CollectionType>('update_collection_type', { collectionType });
	} catch (e) {
		console.error('[collection-types.service] updateCollectionType:', e);
		return null;
	}
}

/**
 * Delete a collection type by ID
 */
export async function deleteCollectionType(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_collection_type', { id: String(id) });
	} catch (e) {
		console.error(`[collection-types.service] deleteCollectionType(${id}):`, e);
		return false;
	}
}
