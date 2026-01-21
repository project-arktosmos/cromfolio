/**
 * Albums Service
 * Manages a collection of collectible card albums
 */

import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { Album } from '$types/album.type';

export const albumsService = new ArrayServiceClass<Album>('albums', []);

/**
 * Get the album collection
 */
export function getAlbumCollection() {
	return {
		albums: albumsService.all()
	};
}

/**
 * Add an album to the collection
 */
export function addAlbum(album: Album) {
	return albumsService.add(album);
}

/**
 * Remove an album from the collection
 */
export function removeAlbum(album: Album) {
	return albumsService.remove(album);
}

/**
 * Update an album in the collection
 */
export function updateAlbum(album: Album) {
	return albumsService.update(album);
}

/**
 * Check if an album exists in the collection
 */
export function albumExists(id: string | number) {
	return albumsService.exists(id);
}
