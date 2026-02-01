/**
 * Player Sources Service
 * Tracks which sources the player owns, persisted to localStorage
 */

import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { ID } from '$types/core.type';

export interface OwnedSource {
	id: ID;
	sourceId: ID;
	acquiredAt: string;
}

export const playerSourcesService = new ArrayServiceClass<OwnedSource>('player-sources', []);

/**
 * Check if the player owns a specific source
 */
export function ownsSource(sourceId: ID): boolean {
	return playerSourcesService.find((owned) => owned.sourceId === sourceId) !== null;
}

/**
 * Add a source to the player's collection
 */
export function acquireSource(sourceId: ID): OwnedSource | null {
	if (ownsSource(sourceId)) {
		return null;
	}

	const ownedSource: OwnedSource = {
		id: crypto.randomUUID(),
		sourceId,
		acquiredAt: new Date().toISOString()
	};

	return playerSourcesService.add(ownedSource);
}

/**
 * Remove a source from the player's collection
 */
export function releaseSource(sourceId: ID): boolean {
	const owned = playerSourcesService.find((o) => o.sourceId === sourceId);
	if (owned) {
		playerSourcesService.remove(owned);
		return true;
	}
	return false;
}

/**
 * Get all owned source IDs
 */
export function getOwnedSourceIds(): ID[] {
	return playerSourcesService.all().map((o) => o.sourceId);
}
