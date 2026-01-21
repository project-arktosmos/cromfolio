/**
 * Cards Service
 * Manages a collection of cards within albums
 */

import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { Card } from '$types/card.type';
import type { ID } from '$types/core.type';

export const cardsService = new ArrayServiceClass<Card>('cards', []);

/**
 * Get the card collection
 */
export function getCardCollection() {
	return {
		cards: cardsService.all()
	};
}

/**
 * Get all cards for a specific album
 */
export function getCardsByAlbum(albumId: ID) {
	return cardsService.filter((card) => card.albumId === albumId);
}

/**
 * Add a card to the collection
 */
export function addCard(card: Card) {
	return cardsService.add(card);
}

/**
 * Remove a card from the collection
 */
export function removeCard(card: Card) {
	return cardsService.remove(card);
}

/**
 * Update a card in the collection
 */
export function updateCard(card: Card) {
	return cardsService.update(card);
}

/**
 * Check if a card exists in the collection
 */
export function cardExists(id: ID) {
	return cardsService.exists(id);
}

/**
 * Remove all cards for a specific album
 */
export function removeCardsByAlbum(albumId: ID) {
	const albumCards = getCardsByAlbum(albumId);
	albumCards.forEach((card) => cardsService.remove(card));
}
