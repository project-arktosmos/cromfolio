/**
 * User Sources Service
 * Tracks which sources the user owns, persisted to SQLite via Tauri
 * Replaces the localStorage-based playerSourcesService for /game routes
 */

import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type { UserSource } from '$types/user-source.type';

/**
 * Get all user-owned sources
 */
export async function getAllUserSources(): Promise<UserSource[]> {
	return await invoke<UserSource[]>('get_all_user_sources');
}

/**
 * Get a specific user source by ID
 */
export async function getUserSource(id: ID): Promise<UserSource | null> {
	return await invoke<UserSource | null>('get_user_source', { id: String(id) });
}

/**
 * Check if the user owns a specific source
 */
export async function ownsSource(sourceId: ID): Promise<boolean> {
	return await invoke<boolean>('user_owns_source', { sourceId: String(sourceId) });
}

/**
 * Get all owned source IDs
 */
export async function getOwnedSourceIds(): Promise<string[]> {
	return await invoke<string[]>('get_user_owned_source_ids');
}

/**
 * Acquire a source (add to user's collection)
 * Only one copy per source is allowed
 */
export async function acquireSource(sourceId: ID): Promise<UserSource> {
	const userSource: Partial<UserSource> = {
		id: '',
		sourceId: String(sourceId),
		acquiredAt: ''
	};

	return await invoke<UserSource>('acquire_user_source', { userSource });
}

/**
 * Release a source (remove from user's collection)
 */
export async function releaseSource(sourceId: ID): Promise<boolean> {
	return await invoke<boolean>('release_user_source', { sourceId: String(sourceId) });
}

/**
 * Delete a specific user source by ID
 */
export async function deleteUserSource(id: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_source', { id: String(id) });
}

/**
 * Delete all user sources (reset collection)
 */
export async function deleteAllUserSources(): Promise<number> {
	return await invoke<number>('delete_all_user_sources');
}
