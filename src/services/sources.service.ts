/**
 * Sources Service
 * Manages source tracking for duplicate prevention via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import type { Source, ExternalIdType, SourceType } from '$types/source.type';
import type { ID } from '$types/core.type';

/**
 * Check if a source with the given external ID already exists
 */
export async function sourceExists(
	externalIdType: ExternalIdType,
	externalId: string
): Promise<boolean> {
	try {
		return await invoke<boolean>('source_exists', {
			externalIdType,
			externalId
		});
	} catch (e) {
		console.error(`[sources.service] sourceExists(${externalIdType}, ${externalId}):`, e);
		return false;
	}
}

/**
 * Get a source by its external ID
 */
export async function getSourceByExternalId(
	externalIdType: ExternalIdType,
	externalId: string
): Promise<Source | null> {
	try {
		return await invoke<Source | null>('get_source_by_external_id', {
			externalIdType,
			externalId
		});
	} catch (e) {
		console.error(`[sources.service] getSourceByExternalId(${externalIdType}, ${externalId}):`, e);
		return null;
	}
}

/**
 * Get all sources for an album
 */
export async function getSourcesByAlbum(albumId: ID): Promise<Source[]> {
	try {
		return await invoke<Source[]>('get_sources_by_album', {
			albumId: String(albumId)
		});
	} catch (e) {
		console.error(`[sources.service] getSourcesByAlbum(${albumId}):`, e);
		return [];
	}
}

/**
 * Create a new source entry
 */
export async function createSource(
	albumId: ID,
	sourceType: SourceType,
	externalIdType: ExternalIdType,
	externalId: string
): Promise<Source | null> {
	try {
		const source: Source = {
			id: crypto.randomUUID(),
			albumId,
			sourceType,
			externalIdType,
			externalId
		};
		return await invoke<Source>('create_source', { source });
	} catch (e) {
		console.error(`[sources.service] createSource:`, e);
		return null;
	}
}

/**
 * Delete a source entry
 */
export async function deleteSource(id: ID): Promise<boolean> {
	try {
		return await invoke<boolean>('delete_source', { id: String(id) });
	} catch (e) {
		console.error(`[sources.service] deleteSource(${id}):`, e);
		return false;
	}
}
