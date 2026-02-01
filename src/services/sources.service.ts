/**
 * Sources Service
 * Manages a collection of collectible card sources via Tauri backend
 */

import { tauriApiService } from '$services/tauri-api.service';
import type { Source } from '$types/source.type';

/**
 * Get all sources from the database
 */
export async function getSourceCollection(): Promise<Source[]> {
	return await tauriApiService.getAll<Source>('sources');
}

/**
 * Add a source to the collection
 */
export async function addSource(source: Source): Promise<Source | null> {
	return await tauriApiService.create<Source>('sources', source);
}

/**
 * Remove a source from the collection
 */
export async function removeSource(source: Source): Promise<boolean> {
	return await tauriApiService.delete('sources', String(source.id));
}

/**
 * Update a source in the collection
 */
export async function updateSource(source: Source): Promise<Source | null> {
	return await tauriApiService.update<Source>('sources', String(source.id), source);
}

/**
 * Check if a source exists in the collection
 */
export async function sourceExists(id: string | number): Promise<Source | null> {
	return await tauriApiService.get<Source>('sources', String(id));
}
