/**
 * Albums Service
 * Manages a collection of collectible card albums via Tauri backend
 */

import { tauriApiService } from '$services/tauri-api.service';
import type { Album } from '$types/album.type';

/**
 * Get all albums from the database
 */
export async function getAlbumCollection(): Promise<Album[]> {
	return await tauriApiService.getAll<Album>('albums');
}

/**
 * Add an album to the collection
 */
export async function addAlbum(album: Album): Promise<Album | null> {
	return await tauriApiService.create<Album>('albums', album);
}

/**
 * Remove an album from the collection
 */
export async function removeAlbum(album: Album): Promise<boolean> {
	return await tauriApiService.delete('albums', String(album.id));
}

/**
 * Update an album in the collection
 */
export async function updateAlbum(album: Album): Promise<Album | null> {
	return await tauriApiService.update<Album>('albums', String(album.id), album);
}

/**
 * Check if an album exists in the collection
 */
export async function albumExists(id: string | number): Promise<Album | null> {
	return await tauriApiService.get<Album>('albums', String(id));
}
