/**
 * Player Cards Service
 * Tracks which cards the player owns, persisted to localStorage
 */

import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { ID } from '$types/core.type';

export interface OwnedCard {
	id: ID;
	cardId: ID;
	sourceId: ID;
	acquiredAt: string;
}

export const playerCardsService = new ArrayServiceClass<OwnedCard>('player-cards', []);

/**
 * Check if the player owns a specific card
 */
export function ownsCard(cardId: ID): boolean {
	return playerCardsService.find((owned) => owned.cardId === cardId) !== null;
}

/**
 * Add a card to the player's collection (duplicates allowed)
 */
export function acquireCard(cardId: ID, sourceId: ID): OwnedCard {
	const ownedCard: OwnedCard = {
		id: crypto.randomUUID(),
		cardId,
		sourceId,
		acquiredAt: new Date().toISOString()
	};

	return playerCardsService.add(ownedCard);
}

/**
 * Get the number of copies of a specific card the player owns
 */
export function getCardCopyCount(cardId: ID): number {
	return playerCardsService.filter((o) => o.cardId === cardId).length;
}

/**
 * Remove a card from the player's collection
 */
export function releaseCard(cardId: ID): boolean {
	const owned = playerCardsService.find((o) => o.cardId === cardId);
	if (owned) {
		playerCardsService.remove(owned);
		return true;
	}
	return false;
}

/**
 * Get all owned card IDs
 */
export function getOwnedCardIds(): ID[] {
	return playerCardsService.all().map((o) => o.cardId);
}

/**
 * Get all owned cards for a specific source
 */
export function getOwnedCardsBySource(sourceId: ID): OwnedCard[] {
	return playerCardsService.filter((o) => o.sourceId === sourceId);
}

/**
 * Get count of total card copies for a specific source
 */
export function getOwnedCardCountBySource(sourceId: ID): number {
	return getOwnedCardsBySource(sourceId).length;
}

/**
 * Get count of unique cards owned for a specific source
 */
export function getUniqueOwnedCardCountBySource(sourceId: ID): number {
	const ownedCards = getOwnedCardsBySource(sourceId);
	const uniqueCardIds = new Set(ownedCards.map((o) => o.cardId));
	return uniqueCardIds.size;
}
