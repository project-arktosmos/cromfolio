/**
 * User Collections Service
 * Tracks user progress on collections, persisted to SQLite via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type { UserCollection } from '$types/user-collection.type';

/**
 * Get all user collection progress records
 */
export async function getAllUserCollections(): Promise<UserCollection[]> {
	return await invoke<UserCollection[]>('get_all_user_collections');
}

/**
 * Get a specific user collection by ID
 */
export async function getUserCollection(id: ID): Promise<UserCollection | null> {
	return await invoke<UserCollection | null>('get_user_collection', { id: String(id) });
}

/**
 * Get user collection progress by collection ID
 */
export async function getUserCollectionByCollectionId(
	collectionId: ID
): Promise<UserCollection | null> {
	return await invoke<UserCollection | null>('get_user_collection_by_collection_id', {
		collectionId: String(collectionId)
	});
}

/**
 * Get all completed user collections
 */
export async function getCompletedUserCollections(): Promise<UserCollection[]> {
	return await invoke<UserCollection[]>('get_completed_user_collections');
}

/**
 * Get all in-progress (not completed) user collections
 */
export async function getInProgressUserCollections(): Promise<UserCollection[]> {
	return await invoke<UserCollection[]>('get_in_progress_user_collections');
}

/**
 * Start tracking a collection (create progress record)
 */
export async function startCollection(collectionId: ID): Promise<UserCollection> {
	const userCollection: Partial<UserCollection> = {
		id: '',
		collectionId: String(collectionId),
		startedAt: '',
		completedAt: null
	};

	return await invoke<UserCollection>('create_user_collection', { userCollection });
}

/**
 * Update a user collection progress record
 */
export async function updateUserCollection(userCollection: UserCollection): Promise<UserCollection> {
	return await invoke<UserCollection>('update_user_collection', { userCollection });
}

/**
 * Mark a collection as completed
 */
export async function markCollectionCompleted(collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('mark_user_collection_completed', {
		collectionId: String(collectionId)
	});
}

/**
 * Delete a user collection progress record by ID
 */
export async function deleteUserCollection(id: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_collection', { id: String(id) });
}

/**
 * Delete a user collection progress record by collection ID
 */
export async function deleteUserCollectionByCollectionId(collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_collection_by_collection_id', {
		collectionId: String(collectionId)
	});
}

/**
 * Delete all user collection progress records (reset all progress)
 */
export async function deleteAllUserCollections(): Promise<number> {
	return await invoke<number>('delete_all_user_collections');
}
