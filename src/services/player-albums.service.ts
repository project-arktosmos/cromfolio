/**
 * Player Albums Service
 * Tracks which albums the player owns, persisted to localStorage
 */

import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { ID } from '$types/core.type';

export interface OwnedAlbum {
	id: ID;
	albumId: ID;
	acquiredAt: string;
}

export const playerAlbumsService = new ArrayServiceClass<OwnedAlbum>('player-albums', []);

/**
 * Check if the player owns a specific album
 */
export function ownsAlbum(albumId: ID): boolean {
	return playerAlbumsService.find((owned) => owned.albumId === albumId) !== null;
}

/**
 * Add an album to the player's collection
 */
export function acquireAlbum(albumId: ID): OwnedAlbum | null {
	if (ownsAlbum(albumId)) {
		return null;
	}

	const ownedAlbum: OwnedAlbum = {
		id: crypto.randomUUID(),
		albumId,
		acquiredAt: new Date().toISOString()
	};

	return playerAlbumsService.add(ownedAlbum);
}

/**
 * Remove an album from the player's collection
 */
export function releaseAlbum(albumId: ID): boolean {
	const owned = playerAlbumsService.find((o) => o.albumId === albumId);
	if (owned) {
		playerAlbumsService.remove(owned);
		return true;
	}
	return false;
}

/**
 * Get all owned album IDs
 */
export function getOwnedAlbumIds(): ID[] {
	return playerAlbumsService.all().map((o) => o.albumId);
}
